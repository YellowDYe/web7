import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.53.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

const MP_API_BASE = "https://api.mercadopago.com";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    const { action } = body;

    const { data: config, error: configErr } = await supabase
      .from("mercado_pago_config")
      .select("*")
      .maybeSingle();

    if (configErr) {
      return jsonResponse(
        { error: `Error loading config: ${configErr.message}` },
        500
      );
    }

    if (!config || !config.access_token) {
      return jsonResponse(
        {
          error:
            "Mercado Pago no esta configurado. Agrega tu Access Token en Configuraciones.",
        },
        400
      );
    }

    const accessToken = config.access_token;

    const publicKey = config.public_key || null;

    switch (action) {
      case "create-preference":
        return await handleCreatePreference(accessToken, body, publicKey);

      case "get-payment-status":
        return await handleGetPaymentStatus(supabase, accessToken, body);

      case "process-payment":
        return await handleProcessPayment(supabase, accessToken, body);

      default:
        return jsonResponse({ error: `Accion no reconocida: ${action}` }, 400);
    }
  } catch (err: any) {
    console.error("Edge function error:", err);
    return jsonResponse(
      { error: err.message || "Error interno del servidor" },
      500
    );
  }
});

async function handleCreatePreference(accessToken: string, body: any, publicKey: string | null) {
  const { items, payer, external_reference, installments, back_url } = body;

  if (!items || !Array.isArray(items) || items.length === 0) {
    return jsonResponse({ error: "Se requieren items para la preferencia" }, 400);
  }

  const baseUrl = back_url || "https://example.com";
  const successUrl = `${baseUrl}/checkout/return?status=approved&order_id=${external_reference || ""}`;
  const failureUrl = `${baseUrl}/checkout/return?status=failure&order_id=${external_reference || ""}`;
  const pendingUrl = `${baseUrl}/checkout/return?status=pending&order_id=${external_reference || ""}`;

  const preferenceBody: any = {
    items: items.map((item: any) => ({
      title: item.title || "Pedido",
      quantity: item.quantity || 1,
      unit_price: Number(item.unit_price),
      currency_id: "MXN",
    })),
    payer: payer
      ? {
          name: payer.name || "",
          surname: payer.surname || "",
          email: payer.email || "",
          phone: payer.phone ? { number: payer.phone } : undefined,
        }
      : undefined,
    back_urls: {
      success: successUrl,
      failure: failureUrl,
      pending: pendingUrl,
    },
    auto_return: "approved",
    payment_methods: {
      excluded_payment_types: [],
      installments: installments || 6,
      default_installments: 1,
    },
    external_reference: external_reference || undefined,
    statement_descriptor: "Pedido Comida",
  };


  const response = await fetch(`${MP_API_BASE}/checkout/preferences`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(preferenceBody),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error("MP preference error:", errText);
    return jsonResponse(
      {
        error: `Error al crear preferencia de pago (${response.status})`,
        details: errText,
      },
      500
    );
  }

  const preference = await response.json();

  return jsonResponse({
    success: true,
    preference_id: preference.id,
    init_point: preference.init_point,
    sandbox_init_point: preference.sandbox_init_point,
    public_key: publicKey,
  });
}

async function handleProcessPayment(
  supabase: any,
  accessToken: string,
  body: any
) {
  const { payment_data, order_id } = body;

  if (!payment_data) {
    return jsonResponse({ error: "Se requieren datos de pago" }, 400);
  }

  const paymentBody: any = {
    transaction_amount: payment_data.transaction_amount,
    token: payment_data.token,
    description: payment_data.description || "Pedido",
    installments: payment_data.installments || 1,
    payment_method_id: payment_data.payment_method_id,
    issuer_id: payment_data.issuer_id,
    payer: {
      email: payment_data.payer?.email,
      identification: payment_data.payer?.identification,
    },
  };

  const response = await fetch(`${MP_API_BASE}/v1/payments`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "X-Idempotency-Key": `${order_id}-${Date.now()}`,
    },
    body: JSON.stringify(paymentBody),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error("MP payment error:", errText);
    return jsonResponse(
      {
        error: `Error al procesar pago (${response.status})`,
        details: errText,
      },
      500
    );
  }

  const payment = await response.json();

  return jsonResponse({
    success: true,
    payment_id: payment.id,
    status: payment.status,
    status_detail: payment.status_detail,
    payment_method_id: payment.payment_method_id,
    payment_type_id: payment.payment_type_id,
    transaction_details: payment.transaction_details,
  });
}

async function handleGetPaymentStatus(
  supabase: any,
  accessToken: string,
  body: any
) {
  const { payment_id, order_id } = body;

  if (!payment_id) {
    return jsonResponse({ error: "Se requiere payment_id" }, 400);
  }

  const response = await fetch(`${MP_API_BASE}/v1/payments/${payment_id}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    const errText = await response.text();
    return jsonResponse(
      { error: `Error al consultar pago (${response.status})`, details: errText },
      500
    );
  }

  const payment = await response.json();

  if (order_id && payment.status === "approved") {
    await supabase
      .from("orders")
      .update({
        stripe_payment_status: "succeeded",
        stripe_paid_at: new Date().toISOString(),
        order_status: "completed",
      })
      .eq("id", order_id);
  }

  return jsonResponse({
    success: true,
    payment_id: payment.id,
    status: payment.status,
    status_detail: payment.status_detail,
  });
}

function jsonResponse(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
