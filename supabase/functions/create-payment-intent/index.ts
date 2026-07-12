import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface PaymentIntentRequest {
  amount: number;
  currency: string;
  customer_id: string;
  order_id?: string;
  metadata?: Record<string, any>;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    const { data: stripeConfig, error: configError } = await supabase
      .from("stripe_config")
      .select("*")
      .eq("is_active", true)
      .maybeSingle();

    if (configError || !stripeConfig) {
      throw new Error("Stripe no está configurado");
    }

    if (!stripeConfig.secret_key) {
      throw new Error("Falta la Secret Key de Stripe");
    }

    const requestBody: PaymentIntentRequest = await req.json();

    if (!requestBody.amount || !requestBody.currency || !requestBody.customer_id) {
      throw new Error("Faltan parámetros requeridos");
    }

    const stripeResponse = await fetch("https://api.stripe.com/v1/payment_intents", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${stripeConfig.secret_key}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        amount: requestBody.amount.toString(),
        currency: requestBody.currency,
        "automatic_payment_methods[enabled]": "true",
        "metadata[customer_id]": requestBody.customer_id,
        ...(requestBody.order_id && { "metadata[order_id]": requestBody.order_id }),
        ...(requestBody.metadata && Object.fromEntries(
          Object.entries(requestBody.metadata).map(([key, value]) => [`metadata[${key}]`, String(value)])
        )),
      }),
    });

    if (!stripeResponse.ok) {
      const errorText = await stripeResponse.text();
      console.error("Stripe API error:", errorText);
      throw new Error(`Error de Stripe: ${stripeResponse.statusText}`);
    }

    const paymentIntent = await stripeResponse.json();

    return new Response(
      JSON.stringify({
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
      }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error: any) {
    console.error("Error creating payment intent:", error);
    return new Response(
      JSON.stringify({
        error: error.message || "Error al crear el intento de pago",
      }),
      {
        status: 400,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
});
