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
  const configured = (Deno.env.get("ALLOWED_SITE_URLS") || Deno.env.get("ALLOWED_RETURN_ORIGINS") || "")
    .split(",")
    .map((o) => o.trim().replace(/\/$/, ""))
    .filter(Boolean);
  const siteUrl = (Deno.env.get("PUBLIC_SITE_URL") || Deno.env.get("SITE_URL") || "").trim().replace(/\/$/, "");
  if (siteUrl) configured.push(siteUrl);
  return configured;
}

function resolveBackUrl(requested: unknown, req: Request, storefrontOrigin: string | null): string | null {
  const allowed = allowedReturnOrigins();
  if (storefrontOrigin) {
    const rest = allowed.filter((o) => o !== storefrontOrigin);
    allowed.splice(0, allowed.length, storefrontOrigin, ...rest);
  }

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

async function loadStorefrontOrigin(supabase: any): Promise<string | null> {
  const { data } = await supabase
    .from("cms_settings")
    .select("value")
    .eq("setting_name", "site_url")
    .maybeSingle();
  const configured = typeof data?.value === "string" ? data.value.trim() : "";
  if (!configured) return null;
  try {
    return new URL(configured).origin;
  } catch {
    return null;
  }
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
        .select("is_active, test_mode, public_key, test_access_token, test_public_key, enable_credit_card, enable_debit_card, enable_ticket, enable_bank_transfer, enable_mercado_pago_wallet, enable_checkout_pro, max_installments")
        .maybeSingle();

      const testSession = !!cfg && await usesTestCredentials(supabase, cfg, callerId);

      return jsonResponse({
        success: true,
        is_active: cfg?.is_active ?? false,
        test_mode: testSession,
        public_key: (testSession ? cfg?.test_public_key : cfg?.public_key) || null,
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

    const testSession = await usesTestCredentials(supabase, config, callerId);
    const accessToken = testSession ? config.test_access_token : config.access_token;
    const publicKey = (testSession ? config.test_public_key : config.public_key) || null;

    switch (action) {
      case "create-preference":
        return await handleCreatePreference(supabase, accessToken, body, publicKey, callerId, req, config);

      case "get-payment-status":
        return await handleGetPaymentStatus(supabase, accessToken, body, callerId);

      case "process-payment":
        return await handleProcessPayment(supabase, accessToken, body, callerId, config);

      case "confirm-order-payment":
        return await handleConfirmOrderPayment(supabase, accessToken, body, callerId);

      case "get-recent-payment-errors":
        return await handleRecentPaymentErrors(supabase, callerId);

      case "get-order-snapshot": {
        const quoteId = typeof body.quote_id === "string" ? body.quote_id.replace(/^quote_/, "") : "";
        const snapPaymentId = body.payment_id ? String(body.payment_id) : "";
        if (!quoteId || !snapPaymentId) return jsonResponse({ error: "quote_id y payment_id requeridos" }, 400);
        const { data: existingOrder } = await supabase
          .from("orders")
          .select("id")
          .eq("mp_payment_id", snapPaymentId)
          .maybeSingle();
        if (existingOrder) return jsonResponse({ success: true, order_snapshot: null, order_exists: true });
        const { data: snap, error: snapErr } = await supabase
          .from("payment_quotes")
          .select("order_snapshot, order_id")
          .eq("id", quoteId)
          .eq("auth_user_id", callerId)
          .maybeSingle();
        if (snapErr) return jsonResponse({ error: "Error al cargar el pedido" }, 500);
        if (snap?.order_id) return jsonResponse({ success: true, order_snapshot: null, order_exists: true });
        return jsonResponse({ success: true, order_snapshot: snap?.order_snapshot ?? null });
      }

      default:
        return jsonResponse({ error: "Accion no reconocida" }, 400);
    }
  } catch (err: any) {
    console.error("Edge function error:", err);
    return jsonResponse({ error: "Error interno del servidor" }, 500);
  }
});

const REJECTION_MESSAGES: Record<string, string> = {
  cc_rejected_bad_filled_card_number: "Revisa el numero de la tarjeta.",
  cc_rejected_bad_filled_date: "Revisa la fecha de vencimiento de la tarjeta.",
  cc_rejected_bad_filled_security_code: "Revisa el codigo de seguridad de la tarjeta.",
  cc_rejected_bad_filled_other: "Revisa los datos de la tarjeta.",
  cc_rejected_insufficient_amount: "La tarjeta no tiene fondos suficientes.",
  cc_rejected_call_for_authorize: "Tu banco necesita que autorices este pago. Llama a tu banco e intenta de nuevo.",
  cc_rejected_card_disabled: "La tarjeta no esta activa. Llama a tu banco para activarla.",
  cc_rejected_duplicated_payment: "Ya hiciste un pago por este monto. Si necesitas pagar de nuevo, usa otra tarjeta.",
  cc_rejected_high_risk: "El pago fue rechazado por seguridad. Intenta con otra tarjeta o metodo de pago.",
  cc_rejected_blacklist: "El pago fue rechazado por seguridad. Intenta con otra tarjeta o metodo de pago.",
  cc_rejected_max_attempts: "Llegaste al limite de intentos con esta tarjeta. Intenta con otra.",
  cc_rejected_invalid_installments: "La tarjeta no acepta ese numero de pagos.",
  cc_rejected_card_type_not_allowed: "Este tipo de tarjeta no se acepta. Intenta con otra.",
  cc_rejected_other_reason: "Tu banco rechazo el pago. Intenta con otra tarjeta o metodo de pago.",
  rejected_by_bank: "Tu banco rechazo el pago. Intenta con otra tarjeta o metodo de pago.",
  rejected_insufficient_data: "Faltan datos para procesar el pago. Revisa el formulario.",
};

function describeRejection(statusDetail: unknown): string {
  return (typeof statusDetail === "string" && REJECTION_MESSAGES[statusDetail]) ||
    "El pago fue rechazado. Intenta con otra tarjeta o metodo de pago.";
}

function describeMpRequestError(errText: string): { message: string; code: string } {
  let parsed: any = null;
  try {
    parsed = JSON.parse(errText);
  } catch {
    /* non-JSON body */
  }
  const causes: any[] = Array.isArray(parsed?.cause) ? parsed.cause : [];
  const codes = causes.map((c) => String(c?.code ?? "")).filter(Boolean);
  const text = [parsed?.message, parsed?.error, ...causes.map((c) => c?.description)]
    .filter((v) => typeof v === "string")
    .join(" ")
    .toLowerCase();
  const details = [parsed?.message, ...causes.map((c) => c?.description)]
    .filter((v) => typeof v === "string" && v)
    .join(" | ");
  const baseCode = codes.join(",") || String(parsed?.error || parsed?.status || "unknown");
  const code = (details ? `${baseCode}: ${details}` : baseCode).slice(0, 300);
  const has = (...list: string[]) => list.some((c) => codes.includes(c));

  if (text.includes("live credentials") || text.includes("test user") || has("7")) {
    return { code, message: "Esta tarjeta no se puede usar con la cuenta actual de la tienda. Las tarjetas de prueba solo funcionan en modo de prueba." };
  }
  if (has("2006", "3003", "2062") || text.includes("card_token") || text.includes("card token")) {
    return { code, message: "Los datos de la tarjeta expiraron o no son validos. Vuelve a capturarlos e intenta de nuevo." };
  }
  if (has("2067", "324") || text.includes("identification")) {
    return { code, message: "Revisa el documento de identificacion capturado." };
  }
  if (has("4050") || text.includes("email")) {
    return { code, message: "Revisa el correo electronico capturado en el formulario de pago." };
  }
  if (has("3034", "3032", "3030", "3031") || text.includes("card_number") || text.includes("security_code")) {
    return { code, message: "Revisa los datos de la tarjeta." };
  }
  if (has("10102", "10103") || text.includes("issuer")) {
    return { code, message: "No reconocimos el banco de la tarjeta. Intenta con otra tarjeta." };
  }
  if (has("2034", "106") || text.includes("users involved") || text.includes("same user")) {
    return { code, message: "No se puede pagar con la misma cuenta que recibe el pago. Usa otra cuenta o tarjeta." };
  }
  if (text.includes("payment_method") || has("4033", "2002")) {
    return { code, message: "Este metodo de pago no esta disponible. Intenta con otro." };
  }
  return { code, message: "Mercado Pago no pudo procesar el pago. Revisa los datos o intenta con otro metodo de pago." };
}

async function isAdminOrManager(supabase: any, callerId: string): Promise<boolean> {
  const { data } = await supabase
    .from("app_users")
    .select("role_id, is_active")
    .eq("auth_user_id", callerId)
    .maybeSingle();
  const role = String(data?.role_id ?? "").toUpperCase();
  return !!data && data.is_active !== false && ["ADMIN", "SUPER_ADMIN", "MANAGER"].includes(role);
}

// Mercado Pago test cards only work with test credentials, so admins can opt into
// them while shoppers keep paying with the live keys.
async function usesTestCredentials(supabase: any, config: any, callerId: string): Promise<boolean> {
  if (!config?.test_mode || !config.test_access_token || !config.test_public_key) return false;
  return await isAdminOrManager(supabase, callerId);
}

async function handleRecentPaymentErrors(supabase: any, callerId: string) {
  if (!(await isAdminOrManager(supabase, callerId))) {
    return jsonResponse({ error: "No autorizado" }, 403);
  }
  const { data, error } = await supabase
    .from("payment_quotes")
    .select("id, amount, last_error, last_error_code, last_error_at")
    .not("last_error_at", "is", null)
    .order("last_error_at", { ascending: false })
    .limit(10);
  if (error) {
    console.error("Error loading payment errors:", error);
    return jsonResponse({ error: "Error al cargar los pagos rechazados" }, 500);
  }
  return jsonResponse({ success: true, errors: data ?? [] });
}

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
  const { items, payer, installments, back_url, shipment_cost, description, cart, order_snapshot } = body;

  if (!items || !Array.isArray(items) || items.length === 0 || items.length > 50) {
    return jsonResponse({ error: "Se requieren items para la preferencia" }, 400);
  }

  // Prices sent by the browser are a display hint only. For customer sessions we
  // re-price the cart from the database and charge that amount.
  const callerIsStaff = await isStaff(supabase, callerId);
  let serverTotal: number | null = null;

  if (!callerIsStaff) {
    const cartItems = Array.isArray(cart?.items) ? cart.items : null;
    const proteinItems = Array.isArray(cart?.protein_items) ? cart.protein_items : [];

    if (!cartItems || (cartItems.length === 0 && proteinItems.length === 0)) {
      return jsonResponse({ error: "No se pudo validar el carrito" }, 400);
    }
    if (cartItems.length > 500 || proteinItems.length > 500) {
      return jsonResponse({ error: "El carrito es demasiado grande" }, 400);
    }

    const sanitize = (list: any[], idField: string) =>
      list.map((entry: any) => ({
        [idField]: String(entry?.[idField] ?? ""),
        quantity: Math.max(0, Math.min(500, Math.trunc(Number(entry?.quantity) || 0))),
      }));

    const { data: pricedTotal, error: priceError } = await supabase.rpc(
      "price_customer_cart",
      {
        p_items: sanitize(cartItems, "meal_plans_id"),
        p_protein_items: sanitize(proteinItems, "protein_plans_id"),
        p_delivery_option_id: cart?.delivery_option_id ? String(cart.delivery_option_id) : null,
        p_coupon_code: cart?.coupon_code ? String(cart.coupon_code) : null,
      },
    );

    if (priceError || pricedTotal === null || pricedTotal === undefined) {
      console.error("Could not price cart server-side:", priceError);
      return jsonResponse({ error: "No se pudo calcular el total del pedido" }, 400);
    }

    serverTotal = Math.round(Number(pricedTotal) * 100) / 100;
    if (!Number.isFinite(serverTotal) || serverTotal <= 0) {
      return jsonResponse({ error: "No se pudo calcular el total del pedido" }, 400);
    }
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

  if (serverTotal !== null) {
    // Charge the server-computed amount; collapse the line items so the
    // preference total cannot disagree with it.
    quotedTotal = serverTotal;
    normalizedItems.length = 0;
    normalizedItems.push({
      title: typeof description === "string" && description.trim()
        ? description.trim().slice(0, 120)
        : "Pedido",
      description: undefined,
      quantity: 1,
      unit_price: serverTotal,
      currency_id: "MXN",
    });
  }

  if (quotedTotal < MIN_AMOUNT || quotedTotal > MAX_AMOUNT) {
    return jsonResponse({ error: "El total del pedido esta fuera del rango permitido" }, 400);
  }

  const baseUrl = resolveBackUrl(back_url, req, await loadStorefrontOrigin(supabase));
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
      order_snapshot: order_snapshot && typeof order_snapshot === "object" ? order_snapshot : null,
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
  // Server-side pricing already includes delivery, so never add it again.
  const safeShipmentCost = serverTotal !== null ? 0 : Number(shipment_cost);
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
    notification_url: `${Deno.env.get("SUPABASE_URL")}/functions/v1/mercado-pago-webhook`,
    payer: {
      email: payment_data.payer?.email,
      identification: payment_data.payer?.identification,
    },
  };

  // The card token is single-use, so keying on it lets a shopper retry with
  // corrected data while still deduplicating network-level resends.
  const attemptKey = typeof payment_data.token === "string" && payment_data.token
    ? payment_data.token.slice(0, 64)
    : crypto.randomUUID();

  const response = await fetch(`${MP_API_BASE}/v1/payments`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "X-Idempotency-Key": attemptKey,
    },
    body: JSON.stringify(paymentBody),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error("MP payment error:", errText);
    const { message, code } = describeMpRequestError(errText);
    await supabase
      .from("payment_quotes")
      .update({
        status: "pending",
        claimed_at: null,
        last_error: message,
        last_error_code: code,
        last_error_at: new Date().toISOString(),
      })
      .eq("id", quote_id);
    return jsonResponse({ error: message, code }, 502);
  }

  const payment = await response.json();
  const accepted = ["approved", "pending", "in_process"].includes(payment.status);

  if (accepted) {
    await supabase
      .from("payment_quotes")
      .update({ payment_id: String(payment.id ?? "") })
      .eq("id", quote_id);
  } else {
    await supabase
      .from("payment_quotes")
      .update({
        status: "pending",
        claimed_at: null,
        last_error: describeRejection(payment.status_detail),
        last_error_code: String(payment.status_detail || payment.status || ""),
        last_error_at: new Date().toISOString(),
      })
      .eq("id", quote_id);
  }

  return jsonResponse({
    success: true,
    payment_id: payment.id,
    status: payment.status,
    status_detail: payment.status_detail,
    message: accepted ? null : describeRejection(payment.status_detail),
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

// Rounding between the cart total and the charged total can differ by cents.
const AMOUNT_TOLERANCE = 1;
const CASH_PAYMENT_TYPES = ["ticket", "atm", "bank_transfer"];

async function handleConfirmOrderPayment(
  supabase: any,
  accessToken: string,
  body: any,
  callerId: string,
) {
  const orderId = typeof body.order_id === "string" ? body.order_id : "";
  const paymentId = body.payment_id ? String(body.payment_id) : "";
  if (!orderId || !/^\d+$/.test(paymentId)) {
    return jsonResponse({ error: "Datos de pago incompletos" }, 400);
  }

  const { data: order } = await supabase
    .from("orders")
    .select("id, customer_id, order_total_price, order_status, stripe_payment_status, mp_payment_id")
    .eq("id", orderId)
    .maybeSingle();
  if (!order) return jsonResponse({ error: "Pedido no encontrado" }, 404);

  const callerIsStaff = await isStaff(supabase, callerId);
  if (!callerIsStaff) {
    const { data: ownsIt } = await supabase
      .from("customers")
      .select("customer_id")
      .eq("customer_id", order.customer_id)
      .eq("auth_user_id", callerId)
      .maybeSingle();
    if (!ownsIt) return jsonResponse({ error: "No autorizado" }, 403);
  }

  if (order.mp_payment_id && order.mp_payment_id !== paymentId) {
    return jsonResponse({ error: "El pago no corresponde a este pedido" }, 409);
  }

  const mpRes = await fetch(`${MP_API_BASE}/v1/payments/${encodeURIComponent(paymentId)}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!mpRes.ok) {
    console.error("MP status error:", await mpRes.text());
    return jsonResponse({ error: "Error al consultar el pago" }, 502);
  }
  const payment = await mpRes.json();

  const externalRef = typeof payment.external_reference === "string" ? payment.external_reference : "";
  const quoteId = externalRef.startsWith("quote_") ? externalRef.slice(6) : "";
  if (!quoteId) return jsonResponse({ error: "El pago no corresponde a este pedido" }, 409);

  const { data: quote } = await supabase
    .from("payment_quotes")
    .select("id, auth_user_id, order_id")
    .eq("id", quoteId)
    .maybeSingle();
  if (!quote || (!callerIsStaff && quote.auth_user_id !== callerId) ||
      (quote.order_id && quote.order_id !== orderId)) {
    return jsonResponse({ error: "El pago no corresponde a este pedido" }, 409);
  }

  const { data: otherOrder } = await supabase
    .from("orders")
    .select("id")
    .eq("mp_payment_id", paymentId)
    .neq("id", orderId)
    .maybeSingle();
  if (otherOrder) return jsonResponse({ error: "El pago ya esta asociado a otro pedido" }, 409);

  const status = String(payment.status || "");
  const paidAmount = Number(payment.transaction_amount ?? 0);
  const orderTotal = Number(order.order_total_price) || 0;
  if (status === "approved" && !(orderTotal > 0 && paidAmount + AMOUNT_TOLERANCE >= orderTotal)) {
    console.error(`Refusing to settle order ${orderId}: paid ${paidAmount}, total ${orderTotal}`);
    return jsonResponse({ error: "El monto pagado no cubre el pedido" }, 409);
  }

  await supabase
    .from("payment_quotes")
    .update({ order_id: orderId, payment_id: paymentId })
    .eq("id", quoteId);

  let newlyPaid = false;
  if (status === "approved") {
    const { data: settled } = await supabase
      .from("orders")
      .update({
        order_status: "completed",
        stripe_payment_status: "succeeded",
        stripe_paid_at: new Date().toISOString(),
        payment_provider: "mercadopago",
        mp_payment_id: paymentId,
      })
      .eq("id", orderId)
      .or("stripe_payment_status.is.null,stripe_payment_status.neq.succeeded")
      .in("order_status", ["pending", "pending_cash_payment", "processing"])
      .select("id");
    newlyPaid = Array.isArray(settled) && settled.length > 0;
  } else if (["pending", "in_process", "authorized"].includes(status)) {
    const isCash = CASH_PAYMENT_TYPES.includes(String(payment.payment_type_id || ""));
    await supabase
      .from("orders")
      .update({
        payment_provider: "mercadopago",
        mp_payment_id: paymentId,
        stripe_payment_status: "pending",
        ...(isCash ? { order_status: "pending_cash_payment" } : {}),
      })
      .eq("id", orderId)
      .or("stripe_payment_status.is.null,stripe_payment_status.neq.succeeded");
  }

  return jsonResponse({
    success: true,
    status,
    payment_type_id: payment.payment_type_id ?? null,
    newly_paid: newlyPaid,
  });
}

function jsonResponse(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
