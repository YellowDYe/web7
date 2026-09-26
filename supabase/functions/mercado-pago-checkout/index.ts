import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.53.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

const MP_API_BASE = "https://api.mercadopago.com";

const STAFF_ROLES = ["admin", "super_admin", "manager", "staff"];

// Amounts outside this range are never legitimate for this shop.
const MIN_AMOUNT = 1;
const MAX_AMOUNT = 200000;

/**
 * Only these origins may be used to build the provider return links, so a
 * caller cannot make Mercado Pago bounce shoppers to a site they control.
 */
function allowedReturnOrigins(): string[] {
  const configured = (Deno.env.get("ALLOWED_RETURN_ORIGINS") || "")
    .split(",")
    .map((o) => o.trim().replace(/\/$/, ""))
    .filter(Boolean);
  const siteUrl = (Deno.env.get("SITE_URL") || "").trim().replace(/\/$/, "");
  if (siteUrl) configured.push(siteUrl);
  return configured;
}

function resolveBackUrl(requested: unknown, req: Request): string | null {
  const allowed = allowedReturnOrigins();

  let requestedOrigin: string | null = null;
  if (typeof requested === "string" && requested.trim()) {
    try {
      requestedOrigin = new URL(requested.trim()).origin;
    } catch {
      requestedOrigin = null;
    }
  }

  if (allowed.length > 0) {
    return requestedOrigin && allowed.includes(requestedOrigin) ? requestedOrigin : allowed[0];
  }

  const headerOrigin = req.headers.get("origin");
  if (headerOrigin) {
    try {
      const parsed = new URL(headerOrigin);
      if (parsed.protocol === "https:" || parsed.protocol === "http:") {
        return parsed.origin;
      }
    } catch {
      /* ignore */
    }
  }
  return null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const token = (req.headers.get("Authorization") ?? "")
      .replace(/^Bearer\s+/i, "")
      .trim();
    if (!token || token === supabaseServiceKey) {
      return jsonResponse({ error: "No autorizado" }, 401);
    }

    const { data: authData, error: authError } = await supabase.auth.getUser(token);
    const callerId = authData?.user?.id;
    if (authError || !callerId) {
      return jsonResponse({ error: "No autorizado" }, 401);
    }

    const body = await req.json();
    const { action } = body;

    if (action === "get-checkout-config") {
      const { data: cfg } = await supabase
        .from("mercado_pago_config")
        .select("is_active, test_mode, public_key, enable_credit_card, enable_debit_card, enable_ticket, enable_bank_transfer, enable_mercado_pago_wallet, enable_checkout_pro, max_installments")
        .maybeSingle();

      return jsonResponse({
        success: true,
        is_active: cfg?.is_active ?? false,
        test_mode: cfg?.test_mode ?? true,
        public_key: cfg?.public_key || null,
        enable_credit_card: cfg?.enable_credit_card ?? true,
        enable_debit_card: cfg?.enable_debit_card ?? true,
        enable_ticket: cfg?.enable_ticket ?? true,
        enable_bank_transfer: cfg?.enable_bank_transfer ?? true,
        enable_mercado_pago_wallet: cfg?.enable_mercado_pago_wallet ?? true,
        enable_checkout_pro: cfg?.enable_checkout_pro ?? true,
        max_installments: cfg?.max_installments ?? 12,
      });
    }

    const { data: config, error: configErr } = await supabase
      .from("mercado_pago_config")
      .select("*")
      .maybeSingle();

    if (configErr) {
      console.error("Error loading Mercado Pago config:", configErr);
      return jsonResponse({ error: "Error al cargar la configuracion de pagos" }, 500);
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
        return await handleCreatePreference(supabase, accessToken, body, publicKey, callerId, req, config);

      case "get-payment-status":
        return await handleGetPaymentStatus(supabase, accessToken, body, callerId);

      case "process-payment":
        return await handleProcessPayment(supabase, accessToken, body, callerId, config);

      default:
        return jsonResponse({ error: "Accion no reconocida" }, 400);
    }
  } catch (err: any) {
    console.error("Edge function error:", err);
    return jsonResponse({ error: "Error interno del servidor" }, 500);
  }
});

async function isStaff(supabase: any, callerId: string): Promise<boolean> {
  const { data: staffRow } = await supabase
    .from("app_users")
    .select("role_id, is_active")
    .eq("auth_user_id", callerId)
    .maybeSingle();
  return !!staffRow && staffRow.is_active !== false && STAFF_ROLES.includes(staffRow.role_id);
}

async function handleCreatePreference(
  supabase: any,
  accessToken: string,
  body: any,
  publicKey: string | null,
  callerId: string,
  req: Request,
  config: any,
) {
  const { items, payer, installments, back_url, shipment_cost, description } = body;

  if (!items || !Array.isArray(items) || items.length === 0 || items.length > 50) {
    return jsonResponse({ error: "Se requieren items para la preferencia" }, 400);
  }

  const normalizedItems = [];
  let quotedTotal = 0;
  for (const item of items) {
    const unitPrice = Number(item?.unit_price);
    const quantity = Number(item?.quantity ?? 1);
    if (
      !Number.isFinite(unitPrice) || unitPrice <= 0 ||
      !Number.isInteger(quantity) || quantity < 1 || quantity > 500
    ) {
      return jsonResponse({ error: "Los importes del pedido no son validos" }, 400);
    }
    quotedTotal += unitPrice * quantity;
    normalizedItems.push({
      title: typeof item?.title === "string" && item.title.trim() ? item.title.trim().slice(0, 120) : "Pedido",
      description: typeof item?.description === "string" && item.description.trim() ? item.description.trim().slice(0, 256) : undefined,
      quantity,
      unit_price: Math.round(unitPrice * 100) / 100,
      currency_id: "MXN",
    });
  }

  quotedTotal = Math.round(quotedTotal * 100) / 100;
  if (quotedTotal < MIN_AMOUNT || quotedTotal > MAX_AMOUNT) {
    return jsonResponse({ error: "El total del pedido esta fuera del rango permitido" }, 400);
  }

  const baseUrl = resolveBackUrl(back_url, req);
  if (!baseUrl) {
    console.error("No allowed return origin configured (SITE_URL / ALLOWED_RETURN_ORIGINS)");
    return jsonResponse({ error: "La tienda no esta configurada para recibir pagos" }, 500);
  }

  // Record the amount server-side FIRST so we can use the quote_id as external_reference
  const { data: quote, error: quoteError } = await supabase
    .from("payment_quotes")
    .insert({
      auth_user_id: callerId,
      amount: quotedTotal,
    })
    .select("id")
    .maybeSingle();

  if (quoteError || !quote) {
    console.error("Could not record payment quote:", quoteError);
    return jsonResponse({ error: "Error al preparar el pago" }, 500);
  }

  const externalReference = `quote_${quote.id}`;

  const successUrl = `${baseUrl}/checkout/return?status=approved&ref=${encodeURIComponent(externalReference)}`;
  const failureUrl = `${baseUrl}/checkout/return?status=failure&ref=${encodeURIComponent(externalReference)}`;
  const pendingUrl = `${baseUrl}/checkout/return?status=pending&ref=${encodeURIComponent(externalReference)}`;

  const requestedInstallments = Number(installments);
  const safeInstallments =
    Number.isInteger(requestedInstallments) && requestedInstallments >= 1 && requestedInstallments <= 12
      ? requestedInstallments
      : 6;

  const excludedTypes: { id: string }[] = [];
  if (config.enable_credit_card === false) excludedTypes.push({ id: "credit_card" });
  if (config.enable_debit_card === false) excludedTypes.push({ id: "debit_card" });
  if (config.enable_ticket === false) excludedTypes.push({ id: "ticket" });
  if (config.enable_bank_transfer === false) excludedTypes.push({ id: "bank_transfer" });

  const maxInstallments = Number(config.max_installments) || safeInstallments;
  const descriptor = (config.statement_descriptor || "Pedido Comida").slice(0, 22);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const notificationUrl = supabaseUrl ? `${supabaseUrl}/functions/v1/mercado-pago-webhook` : undefined;

  // Preference expiration: valid for 2 hours (matches quote TTL)
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 2 * 60 * 60 * 1000);

  // Cash payment expiration: 24 hours
  const cashExpiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  // Build payer object with address if provided
  let payerObj: any = undefined;
  if (payer) {
    payerObj = {
      name: payer.name || "",
      surname: payer.surname || "",
      email: payer.email || "",
      phone: payer.phone ? { number: payer.phone } : undefined,
    };
    if (payer.address) {
      payerObj.address = {
        street_name: payer.address.street_name || "",
        street_number: payer.address.street_number ? Number(payer.address.street_number) : undefined,
        zip_code: payer.address.zip_code || "",
      };
    }
  }

  // Build shipments if delivery cost is provided
  const safeShipmentCost = Number(shipment_cost);
  const shipments = Number.isFinite(safeShipmentCost) && safeShipmentCost > 0
    ? { cost: Math.round(safeShipmentCost * 100) / 100, mode: "not_specified" as const }
    : undefined;

  const preferenceBody: any = {
    items: normalizedItems,
    payer: payerObj,
    back_urls: {
      success: successUrl,
      failure: failureUrl,
      pending: pendingUrl,
    },
    auto_return: "approved",
    binary_mode: true,
    notification_url: notificationUrl,
    payment_methods: {
      excluded_payment_types: excludedTypes,
      installments: maxInstallments,
      default_installments: 1,
    },
    external_reference: externalReference,
    statement_descriptor: descriptor,
    expires: true,
    expiration_date_from: now.toISOString(),
    expiration_date_to: expiresAt.toISOString(),
    date_of_expiration: cashExpiresAt.toISOString(),
    ...(shipments ? { shipments } : {}),
  };

  console.log("Creating MP preference with external_reference:", externalReference);

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
    return jsonResponse({ error: "Error al crear la preferencia de pago" }, 502);
  }

  const preference = await response.json();

  // Update the quote with the preference_id now that we have it
  await supabase
    .from("payment_quotes")
    .update({ preference_id: preference.id })
    .eq("id", quote.id);

  return jsonResponse({
    success: true,
    quote_id: quote.id,
    preference_id: preference.id,
    init_point: preference.init_point,
    sandbox_init_point: preference.sandbox_init_point,
    public_key: publicKey,
    external_reference: externalReference,
  });
}

async function handleProcessPayment(
  supabase: any,
  accessToken: string,
  body: any,
  callerId: string,
  config: any,
) {
  const { payment_data, quote_id, order_id } = body;

  if (!payment_data) {
    return jsonResponse({ error: "Se requieren datos de pago" }, 400);
  }
  if (typeof quote_id !== "string" || !quote_id) {
    return jsonResponse({ error: "Falta la referencia del pago" }, 400);
  }

  const { data: claimed, error: claimError } = await supabase
    .from("payment_quotes")
    .update({ status: "claimed", claimed_at: new Date().toISOString() })
    .eq("id", quote_id)
    .eq("auth_user_id", callerId)
    .eq("status", "pending")
    .gt("expires_at", new Date().toISOString())
    .select("id, amount")
    .maybeSingle();

  if (claimError) {
    console.error("Error claiming payment quote:", claimError);
    return jsonResponse({ error: "Error al procesar el pago" }, 500);
  }
  if (!claimed) {
    return jsonResponse({ error: "La sesion de pago expiro. Vuelve a intentarlo." }, 409);
  }

  const amount = Number(claimed.amount);
  if (!Number.isFinite(amount) || amount < MIN_AMOUNT || amount > MAX_AMOUNT) {
    return jsonResponse({ error: "El total del pedido no es valido" }, 400);
  }

  const paymentBody: any = {
    transaction_amount: amount,
    token: payment_data.token,
    description: payment_data.description || (config.statement_descriptor || "Pedido"),
    installments: Number(payment_data.installments) > 0 ? Number(payment_data.installments) : 1,
    payment_method_id: payment_data.payment_method_id,
    issuer_id: payment_data.issuer_id,
    statement_descriptor: (config.statement_descriptor || "Pedido Comida").slice(0, 22),
    binary_mode: true,
    external_reference: `quote_${quote_id}`,
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
      "X-Idempotency-Key": `${quote_id}`,
    },
    body: JSON.stringify(paymentBody),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error("MP payment error:", errText);
    await supabase
      .from("payment_quotes")
      .update({ status: "pending", claimed_at: null })
      .eq("id", quote_id);
    return jsonResponse({ error: "Error al procesar el pago" }, 502);
  }

  const payment = await response.json();

  await supabase
    .from("payment_quotes")
    .update({ payment_id: String(payment.id ?? "") })
    .eq("id", quote_id);

  return jsonResponse({
    success: true,
    payment_id: payment.id,
    status: payment.status,
    status_detail: payment.status_detail,
    payment_method_id: payment.payment_method_id,
    payment_type_id: payment.payment_type_id,
    transaction_details: payment.transaction_details,
    order_id: order_id ?? null,
  });
}

async function handleGetPaymentStatus(
  supabase: any,
  accessToken: string,
  body: any,
  callerId: string
) {
  const { payment_id, order_id } = body;

  if (!payment_id) {
    return jsonResponse({ error: "Se requiere payment_id" }, 400);
  }

  const response = await fetch(
    `${MP_API_BASE}/v1/payments/${encodeURIComponent(String(payment_id))}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!response.ok) {
    const errText = await response.text();
    console.error("MP status error:", errText);
    return jsonResponse({ error: "Error al consultar el pago" }, 502);
  }

  const payment = await response.json();

  if (order_id && payment.status === "approved") {
    const { data: order } = await supabase
      .from("orders")
      .select("id, customer_id, order_total_price")
      .eq("id", order_id)
      .maybeSingle();

    if (!order) {
      return jsonResponse({ error: "Pedido no encontrado" }, 404);
    }

    if (!(await isStaff(supabase, callerId))) {
      const { data: ownsIt } = await supabase
        .from("customers")
        .select("customer_id")
        .eq("customer_id", order.customer_id)
        .eq("auth_user_id", callerId)
        .maybeSingle();
      if (!ownsIt) {
        return jsonResponse({ error: "No autorizado" }, 403);
      }
    }

    const paidAmount = Number(payment.transaction_amount);
    const orderTotal = Number(order.order_total_price);
    const referenceMatches =
      typeof payment.external_reference === "string" &&
      payment.external_reference === String(order_id);

    if (!referenceMatches || !Number.isFinite(paidAmount) || !Number.isFinite(orderTotal) ||
        paidAmount + 0.01 < orderTotal) {
      console.error("Refusing to settle order: payment does not match order", order_id);
      return jsonResponse({ error: "El pago no corresponde a este pedido" }, 409);
    }

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
