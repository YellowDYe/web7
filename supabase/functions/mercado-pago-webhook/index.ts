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
    const externalRef = payment.external_reference;

    // Try to find the order by checking the payment_quotes table first
    let orderId: string | null = null;

    // Check if we have a payment quote with this payment_id
    const { data: quote } = await supabase
      .from("payment_quotes")
      .select("id, auth_user_id")
      .eq("payment_id", String(paymentId))
      .maybeSingle();

    // Find the order: try by mp_payment_id first, then by external_reference
    const { data: orderByMp } = await supabase
      .from("orders")
      .select("id, order_status, stripe_payment_status, mp_payment_id, order_customer_email, customer_id")
      .eq("mp_payment_id", String(paymentId))
      .maybeSingle();

    if (orderByMp) {
      orderId = orderByMp.id;
    }

    // If no order found by mp_payment_id, look for a pending order with this payment amount
    // that was created around the same time
    if (!orderId && externalRef) {
      const { data: orderByRef } = await supabase
        .from("orders")
        .select("id, order_status, stripe_payment_status, mp_payment_id, order_customer_email, customer_id")
        .eq("id", externalRef)
        .maybeSingle();

      if (orderByRef) {
        orderId = orderByRef.id;
      }
    }

    if (!orderId) {
      console.warn(`Webhook: No order found for payment ${paymentId}`);
      return jsonResponse({ received: true, order_found: false });
    }

    // Re-fetch the order with all needed fields
    const { data: order } = await supabase
      .from("orders")
      .select("id, order_status, stripe_payment_status, order_customer_email, order_customer_name, customer_id, order_id, order_total_price")
      .eq("id", orderId)
      .maybeSingle();

    if (!order) {
      return jsonResponse({ received: true, order_found: false });
    }

    // Only update if the order isn't already marked as completed/paid
    if (mpStatus === "approved" && order.stripe_payment_status !== "succeeded") {
      await supabase
        .from("orders")
        .update({
          order_status: "completed",
          stripe_payment_status: "succeeded",
          stripe_paid_at: new Date().toISOString(),
          payment_provider: "mercadopago",
          mp_payment_id: String(paymentId),
        })
        .eq("id", orderId)
        .in("order_status", ["pending", "pending_cash_payment", "processing"]);

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
          const siteUrl = Deno.env.get("SITE_URL") || supabaseUrl;

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
