import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, stripe-signature",
};

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

    if (!stripeConfig || !stripeConfig.webhook_secret) {
      console.warn("Stripe webhook secret not configured, skipping signature verification");
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
