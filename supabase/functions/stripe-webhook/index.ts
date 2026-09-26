import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, stripe-signature",
};

// Stripe signs every webhook with an HMAC-SHA256 over `${timestamp}.${body}`.
// Verifying it is the only thing that distinguishes a real Stripe event from a
// forged POST, because this endpoint is deliberately unauthenticated.
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function verifyStripeSignature(
  body: string,
  header: string | null,
  secret: string,
): Promise<boolean> {
  if (!header) return false;

  let timestamp = "";
  const candidates: string[] = [];
  for (const part of header.split(",")) {
    const [key, value] = part.trim().split("=");
    if (key === "t") timestamp = value ?? "";
    if (key === "v1" && value) candidates.push(value);
  }

  if (!timestamp || candidates.length === 0) return false;

  // Reject replays of an old, legitimately signed payload.
  const age = Math.abs(Math.floor(Date.now() / 1000) - Number(timestamp));
  if (!Number.isFinite(age) || age > 300) return false;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`${timestamp}.${body}`),
  );
  const expected = Array.from(new Uint8Array(mac))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return candidates.some((c) => timingSafeEqual(expected, c));
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

    const signature = req.headers.get("stripe-signature");
    const body = await req.text();

    const { data: stripeConfig } = await supabase
      .from("stripe_config")
      .select("*")
      .eq("is_active", true)
      .maybeSingle();

    // Without a configured secret there is nothing to verify against, so refuse
    // rather than acting on an unauthenticated payment event.
    if (!stripeConfig || !stripeConfig.webhook_secret) {
      console.error("Stripe webhook secret not configured; rejecting event");
      return new Response(
        JSON.stringify({ error: "Webhook not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!(await verifyStripeSignature(body, signature, stripeConfig.webhook_secret))) {
      console.error("Stripe webhook signature verification failed");
      return new Response(
        JSON.stringify({ error: "Invalid signature" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    let event;
    try {
      event = JSON.parse(body);
    } catch (err) {
      console.error("Invalid JSON:", err);
      throw new Error("Invalid JSON");
    }

    console.log(`Processing Stripe webhook event: ${event.type}`);

    switch (event.type) {
      case "payment_intent.succeeded": {
        const paymentIntent = event.data.object;
        console.log(`Payment succeeded: ${paymentIntent.id}`);

        await supabase
          .from("stripe_payment_intents")
          .update({
            status: "succeeded",
          })
          .eq("payment_intent_id", paymentIntent.id);

        if (paymentIntent.metadata?.order_id) {
          await supabase
            .from("orders")
            .update({
              stripe_payment_status: "succeeded",
              stripe_paid_at: new Date().toISOString(),
            })
            .eq("id", paymentIntent.metadata.order_id);
        }
        break;
      }

      case "payment_intent.payment_failed": {
        const paymentIntent = event.data.object;
        console.log(`Payment failed: ${paymentIntent.id}`);

        await supabase
          .from("stripe_payment_intents")
          .update({
            status: "failed",
            last_payment_error: paymentIntent.last_payment_error,
          })
          .eq("payment_intent_id", paymentIntent.id);

        if (paymentIntent.metadata?.order_id) {
          await supabase
            .from("orders")
            .update({
              stripe_payment_status: "failed",
            })
            .eq("id", paymentIntent.metadata.order_id);
        }
        break;
      }

      case "payment_intent.canceled": {
        const paymentIntent = event.data.object;
        console.log(`Payment canceled: ${paymentIntent.id}`);

        await supabase
          .from("stripe_payment_intents")
          .update({
            status: "canceled",
          })
          .eq("payment_intent_id", paymentIntent.id);

        if (paymentIntent.metadata?.order_id) {
          await supabase
            .from("orders")
            .update({
              stripe_payment_status: "canceled",
            })
            .eq("id", paymentIntent.metadata.order_id);
        }
        break;
      }

      case "charge.refunded": {
        const charge = event.data.object;
        console.log(`Charge refunded: ${charge.id}`);

        if (charge.payment_intent) {
          await supabase
            .from("stripe_payment_intents")
            .update({
              status: "refunded",
            })
            .eq("payment_intent_id", charge.payment_intent);

          const { data: paymentIntent } = await supabase
            .from("stripe_payment_intents")
            .select("order_id")
            .eq("payment_intent_id", charge.payment_intent)
            .maybeSingle();

          if (paymentIntent?.order_id) {
            await supabase
              .from("orders")
              .update({
                stripe_payment_status: "refunded",
              })
              .eq("id", paymentIntent.order_id);
          }
        }
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return new Response(
      JSON.stringify({ received: true }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error: any) {
    console.error("Error processing webhook:", error);
    return new Response(
      JSON.stringify({
        error: error.message || "Error al procesar webhook",
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
