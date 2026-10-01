import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.53.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

const MP_API_BASE = "https://api.mercadopago.com";

// Constant-time string comparison to avoid leaking the expected signature.
function timingSafeEqualStrings(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(message),
  );
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Verifies the Mercado Pago `x-signature` header.
 * Manifest format: id:<data.id>;request-id:<x-request-id>;ts:<ts>;
 */
async function verifyMercadoPagoSignature(
  req: Request,
  paymentId: string,
  secret: string,
): Promise<boolean> {
  const signatureHeader = req.headers.get("x-signature") || "";
  const requestId = req.headers.get("x-request-id") || "";
  if (!signatureHeader) return false;

  let ts = "";
  let v1 = "";
  for (const part of signatureHeader.split(",")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    if (k === "ts") ts = v;
    else if (k === "v1") v1 = v;
  }
  if (!ts || !v1) return false;

  // Reject stale notifications (replay window of 10 minutes).
  const tsMs = Number(ts) > 1e12 ? Number(ts) : Number(ts) * 1000;
  if (!Number.isFinite(tsMs) || Math.abs(Date.now() - tsMs) > 10 * 60 * 1000) {
    return false;
  }

  const manifest = `id:${paymentId.toLowerCase()};request-id:${requestId};ts:${ts};`;
  const expected = await hmacSha256Hex(secret, manifest);
  return timingSafeEqualStrings(expected, v1.toLowerCase());
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Mercado Pago sends webhook notifications as POST with JSON body
    // or as query params for IPN-style notifications
    let paymentId: string | null = null;
    let topic: string | null = null;

    if (req.method === "POST") {
      const body = await req.json();

      // Webhook v2 format: { action, data: { id }, type }
      if (body.data?.id && body.type === "payment") {
        paymentId = String(body.data.id);
        topic = "payment";
      }
      // IPN format: { topic, id }
      else if (body.topic === "payment" && body.id) {
        paymentId = String(body.id);
        topic = "payment";
      }
      // Merchant order
      else if (body.topic === "merchant_order" || body.type === "merchant_order") {
        // We only care about payment notifications
        return jsonResponse({ received: true });
      }
    } else if (req.method === "GET") {
      // IPN-style query param notifications
      const url = new URL(req.url);
      topic = url.searchParams.get("topic");
      const id = url.searchParams.get("id");
      if (topic === "payment" && id) {
        paymentId = id;
      }
    }

    if (!paymentId || topic !== "payment") {
      return jsonResponse({ received: true, ignored: true });
    }

    // Load Mercado Pago config to get the access token
    const { data: config, error: configErr } = await supabase
      .from("mercado_pago_config")
      .select("access_token, webhook_secret")
      .maybeSingle();

    if (configErr || !config?.access_token) {
      console.error("Could not load MP config for webhook:", configErr);
      return jsonResponse({ error: "Config not found" }, 500);
    }

    // This endpoint is public (no JWT). When a webhook secret is configured we
    // require a valid Mercado Pago signature, otherwise anyone could replay an
    // arbitrary payment id and drive the settle-order path.
    if (config.webhook_secret) {
      const validSignature = await verifyMercadoPagoSignature(
        req,
        String(paymentId),
        config.webhook_secret,
      );
      if (!validSignature) {
        console.warn("Webhook: rejected notification with invalid signature");
        return jsonResponse({ error: "Invalid signature" }, 401);
      }
    } else {
      console.warn(
        "Webhook: no webhook_secret configured; notifications are unverified",
      );
    }

    // Fetch payment details from Mercado Pago API
    const mpResponse = await fetch(
      `${MP_API_BASE}/v1/payments/${encodeURIComponent(paymentId)}`,
      { headers: { Authorization: `Bearer ${config.access_token}` } }
    );

    if (!mpResponse.ok) {
      console.error("Could not fetch payment from MP:", await mpResponse.text());
      return jsonResponse({ error: "Could not verify payment" }, 502);
    }

    const payment = await mpResponse.json();
    const mpStatus = payment.status; // approved, pending, rejected, cancelled, refunded, etc.
    const externalRef: string = typeof payment.external_reference === "string" ? payment.external_reference : "";
    const quoteId = externalRef.startsWith("quote_") ? externalRef.slice(6) : null;

    let orderId: string | null = null;

    if (quoteId) {
      const { data: quote } = await supabase
        .from("payment_quotes")
        .select("id, order_id, payment_id")
        .eq("id", quoteId)
        .maybeSingle();
      if (quote) {
        if (!quote.payment_id) {
          await supabase
            .from("payment_quotes")
            .update({ payment_id: String(paymentId) })
            .eq("id", quoteId)
            .is("payment_id", null);
        }
        if (quote.order_id) orderId = quote.order_id;
      }
    }

    if (!orderId) {
      const { data: orderByMp } = await supabase
        .from("orders")
        .select("id")
        .eq("mp_payment_id", String(paymentId))
        .maybeSingle();
      if (orderByMp) orderId = orderByMp.id;
    }

    // Legacy flow: the reference was the order id itself.
    if (!orderId && externalRef && !quoteId &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(externalRef)) {
      const { data: orderByRef } = await supabase
        .from("orders")
        .select("id")
        .eq("id", externalRef)
        .maybeSingle();
      if (orderByRef) orderId = orderByRef.id;
    }

    if (!orderId) {
      console.warn(`Webhook: No order found for payment ${paymentId}`);
      if (["approved", "pending", "in_process", "authorized"].includes(mpStatus)) {
        // Give the customer's browser time to register the order before alerting.
        const alertTask = (async () => {
          await new Promise((r) => setTimeout(r, 90_000));
          const res = await fetch(`${supabaseUrl}/functions/v1/send-admin-payment-alert`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${supabaseServiceKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ payment_id: String(paymentId) }),
          });
          if (!res.ok) console.error("Admin payment alert failed:", await res.text());
        })().catch((e) => console.error("Admin payment alert error:", e));
        // @ts-ignore EdgeRuntime is provided by the Supabase runtime
        if (typeof EdgeRuntime !== "undefined") EdgeRuntime.waitUntil(alertTask);
      }
      return jsonResponse({ received: true, order_found: false });
    }

    // Re-fetch the order with all needed fields
    const { data: order } = await supabase
      .from("orders")
      .select("id, order_status, stripe_payment_status, order_customer_email, order_customer_name, customer_id, order_id, order_total_price, mp_payment_id")
      .eq("id", orderId)
      .maybeSingle();

    if (!order) {
      return jsonResponse({ received: true, order_found: false });
    }

    if (order.mp_payment_id && order.mp_payment_id !== String(paymentId)) {
      console.error(`Webhook: order ${orderId} already linked to payment ${order.mp_payment_id}`);
      return jsonResponse({ received: true, settled: false });
    }

    // The payment must actually cover the order, otherwise a 1-peso payment
    // could be pointed at an expensive order and settle it. A peso of slack
    // absorbs rounding between the cart total and the charged total.
    const orderTotal = Number(order.order_total_price) || 0;
    const paidAmount = Number(
      payment.transaction_amount ??
        payment.transaction_details?.total_paid_amount ??
        0,
    );
    const amountCoversOrder = orderTotal > 0 && paidAmount + 1 >= orderTotal;

    // Only update if the order isn't already marked as completed/paid
    if (mpStatus === "approved" && !amountCoversOrder) {
      console.error(
        `Webhook: payment ${paymentId} of ${paidAmount} does not cover order ${orderId} total ${orderTotal}; not settling`,
      );
      return jsonResponse({ received: true, settled: false }, 200);
    }

    if (mpStatus === "approved" && order.stripe_payment_status !== "succeeded") {
      const { data: settled } = await supabase
        .from("orders")
        .update({
          order_status: "completed",
          stripe_payment_status: "succeeded",
          stripe_paid_at: new Date().toISOString(),
          payment_provider: "mercadopago",
          mp_payment_id: String(paymentId),
        })
        .eq("id", orderId)
        .or("stripe_payment_status.is.null,stripe_payment_status.neq.succeeded")
        .in("order_status", ["pending", "pending_cash_payment", "processing"])
        .select("id");

      // Another path (the customer's return page) already settled it and sent the email.
      if (!Array.isArray(settled) || settled.length === 0) {
        return jsonResponse({ received: true, status: mpStatus, order_id: orderId });
      }

      // Also update related invoice if exists
      const { data: invoice } = await supabase
        .from("invoices")
        .select("id")
        .eq("order_id", orderId)
        .maybeSingle();

      if (invoice?.id) {
        await supabase
          .from("invoices")
          .update({
            invoice_status: "paid",
            payment_date: new Date().toISOString(),
          })
          .eq("id", invoice.id);
      }

      // Send confirmation email
      try {
        const emailUrl = `${supabaseUrl}/functions/v1/send-order-email`;
        
        // Fetch customer details for the email
        let customerName = order.order_customer_name || "";
        let customerEmail = order.order_customer_email || "";

        if (order.customer_id && (!customerEmail || !customerName)) {
          const { data: cust } = await supabase
            .from("customers")
            .select("customer_name, customer_lastname, customer_email")
            .eq("customer_id", order.customer_id)
            .maybeSingle();
          if (cust) {
            customerName = `${cust.customer_name || ""} ${cust.customer_lastname || ""}`.trim();
            customerEmail = cust.customer_email || customerEmail;
          }
        }

        if (customerEmail) {
          const siteUrl = Deno.env.get("PUBLIC_SITE_URL") || Deno.env.get("SITE_URL") || supabaseUrl;

          await fetch(emailUrl, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${supabaseServiceKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              customerName,
              customerEmail,
              orderNumber: order.order_id || orderId,
              deliveryAddress: "",
              deliveryWeeks: [],
              totals: {
                subtotal: Number(order.order_total_price) || 0,
                planDiscount: 0,
                deliveryPrice: 0,
                couponDiscount: 0,
                taxAmount: 0,
                finalTotal: Number(order.order_total_price) || 0,
              },
              deliveryOptionName: "",
              shopUrl: siteUrl,
            }),
          });
        }
      } catch (emailErr) {
        console.warn("Webhook: Could not send confirmation email:", emailErr);
      }

      console.log(`Webhook: Order ${orderId} marked as paid (payment ${paymentId})`);
    } else if (["pending", "in_process", "authorized"].includes(mpStatus) && order.stripe_payment_status !== "succeeded") {
      const isCash = ["ticket", "atm", "bank_transfer"].includes(String(payment.payment_type_id || ""));
      await supabase
        .from("orders")
        .update({
          payment_provider: "mercadopago",
          mp_payment_id: String(paymentId),
          stripe_payment_status: "pending",
          ...(isCash ? { order_status: "pending_cash_payment" } : {}),
        })
        .eq("id", orderId)
        .or("stripe_payment_status.is.null,stripe_payment_status.neq.succeeded");
    } else if (mpStatus === "cancelled" || mpStatus === "refunded" || mpStatus === "charged_back") {
      // Mark order as cancelled if the payment was reversed
      if (order.order_status !== "cancelled") {
        await supabase
          .from("orders")
          .update({
            order_status: "cancelled",
            stripe_payment_status: mpStatus,
          })
          .eq("id", orderId);

        console.log(`Webhook: Order ${orderId} cancelled (payment ${paymentId}, status: ${mpStatus})`);
      }
    }

    return jsonResponse({ received: true, status: mpStatus, order_id: orderId });
  } catch (err: any) {
    console.error("Webhook error:", err);
    return jsonResponse({ error: "Internal server error" }, 500);
  }
});

function jsonResponse(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
