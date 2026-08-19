import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const STAFF_ROLES = ["ADMIN", "MANAGER", "AGENTE", "STAFF", "DELIVERY"];

interface PaymentIntentRequest {
  order_id?: string;
  currency?: string;
  metadata?: Record<string, unknown>;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    // 1. The caller must present a real user token.
    const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
    if (!token || token === supabaseServiceRoleKey) {
      return json({ error: "No autorizado" }, 401);
    }

    const { data: authData, error: authError } = await supabase.auth.getUser(token);
    const callerId = authData?.user?.id;
    if (authError || !callerId) {
      return json({ error: "No autorizado" }, 401);
    }

    const body: PaymentIntentRequest = await req.json();
    const orderId = typeof body.order_id === "string" ? body.order_id.trim() : "";
    if (!orderId) {
      return json({ error: "Falta el pedido" }, 400);
    }

    // 2. The amount is read from the stored order, never from the request.
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("order_id, customer_id, order_total_price, stripe_payment_status")
      .eq("order_id", orderId)
      .maybeSingle();

    if (orderError || !order) {
      return json({ error: "Pedido no encontrado" }, 404);
    }

    // 3. The caller must own the order, or be staff acting on it.
    const { data: staffRow } = await supabase
      .from("app_users")
      .select("role_id, is_active")
      .eq("auth_user_id", callerId)
      .maybeSingle();

    const isStaff = !!staffRow && staffRow.is_active !== false && STAFF_ROLES.includes(staffRow.role_id);

    if (!isStaff) {
      const { data: ownsIt } = await supabase
        .from("customers")
        .select("customer_id")
        .eq("customer_id", order.customer_id)
        .eq("auth_user_id", callerId)
        .maybeSingle();

      if (!ownsIt) {
        return json({ error: "No autorizado" }, 403);
      }
    }

    if (order.stripe_payment_status === "paid" || order.stripe_payment_status === "succeeded") {
      return json({ error: "Este pedido ya fue pagado" }, 409);
    }

    const total = Number(order.order_total_price);
    if (!Number.isFinite(total) || total <= 0) {
      return json({ error: "El total del pedido no es válido" }, 400);
    }

    const amountInCents = Math.round(total * 100);
    if (amountInCents < 100 || amountInCents > 100_000_000) {
      return json({ error: "El total del pedido está fuera del rango permitido" }, 400);
    }

    const currency = /^[a-z]{3}$/i.test(body.currency ?? "") ? body.currency!.toLowerCase() : "mxn";

    const { data: stripeConfig, error: configError } = await supabase
      .from("stripe_config")
      .select("secret_key")
      .eq("is_active", true)
      .maybeSingle();

    if (configError || !stripeConfig?.secret_key) {
      console.error("Stripe config unavailable", configError);
      return json({ error: "Stripe no está configurado" }, 400);
    }

    const stripeResponse = await fetch("https://api.stripe.com/v1/payment_intents", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${stripeConfig.secret_key}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        amount: amountInCents.toString(),
        currency,
        "automatic_payment_methods[enabled]": "true",
        "metadata[customer_id]": String(order.customer_id ?? ""),
        "metadata[order_id]": String(order.order_id),
      }),
    });

    if (!stripeResponse.ok) {
      const errorText = await stripeResponse.text();
      console.error("Stripe API error:", errorText);
      return json({ error: "No se pudo iniciar el pago" }, 400);
    }

    const paymentIntent = await stripeResponse.json();

    return json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      amount: amountInCents,
      currency,
    });
  } catch (error) {
    console.error("Error creating payment intent:", error);
    return json({ error: "Error al crear el intento de pago" }, 400);
  }
});
