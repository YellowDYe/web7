import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.53.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface OrderEmailRequest {
  customerName: string;
  customerEmail: string;
  orderNumber: string;
  deliveryAddress: string;
  deliveryWeeks: Array<{ weekName: string; deliveryDate: string | null }>;
  totals: {
    subtotal: number;
    planDiscount: number;
    deliveryPrice: number;
    couponDiscount: number;
    taxAmount: number;
    finalTotal: number;
  };
  deliveryOptionName: string;
  couponCode?: string;
  shopUrl: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Load Mailgun config from database
    const { data: configRows, error: configError } = await supabase
      .from("email_configuration")
      .select("config_key, config_value");

    if (configError || !configRows || configRows.length === 0) {
      throw new Error("Email configuration not found in database.");
    }

    const configMap: Record<string, string> = {};
    for (const row of configRows) {
      configMap[row.config_key] = row.config_value;
    }

    const mailgunApiKey = configMap["mailgun_api_key"];
    const mailgunDomain = configMap["mailgun_domain"] || "mg.holadieta.mx";

    if (!mailgunApiKey) {
      throw new Error("Mailgun API key not configured.");
    }

    // Parse request body
    const params: OrderEmailRequest = await req.json();

    if (!params.customerEmail || !params.orderNumber) {
      return new Response(
        JSON.stringify({ success: false, error: "Customer email and order number are required." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build the email HTML
    const htmlBody = generateOrderConfirmationTemplate(params);
    const textBody = `¡Gracias por tu pedido, ${params.customerName}! Tu número de orden es ${params.orderNumber}. Total: $${Math.round(params.totals.finalTotal)} MXN.`;

    // Get site branding for sender name
    const { data: siteSettings } = await supabase
      .from("cms_settings")
      .select("value")
      .eq("key", "site_name")
      .maybeSingle();

    const siteName = siteSettings?.value || "Hola Dieta";
    const fromEmail = `${siteName} <noreply@${mailgunDomain}>`;

    // Send via Mailgun
    const formData = new FormData();
    formData.append("from", fromEmail);
    formData.append("to", params.customerEmail);
    formData.append("subject", `Confirmación de Pedido #${params.orderNumber} - ${siteName}`);
    formData.append("html", htmlBody);
    formData.append("text", textBody);

    const mailgunResponse = await fetch(
      `https://api.mailgun.net/v3/${mailgunDomain}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${btoa(`api:${mailgunApiKey}`)}`,
        },
        body: formData,
      }
    );

    if (!mailgunResponse.ok) {
      const errorText = await mailgunResponse.text();
      console.error("Mailgun error:", errorText);
      throw new Error(`Mailgun API error: ${mailgunResponse.status} - ${errorText}`);
    }

    const mailgunData = await mailgunResponse.json();

    return new Response(
      JSON.stringify({ success: true, mailgun_id: mailgunData.id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in send-order-email:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message || "Failed to send order email" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function generateOrderConfirmationTemplate(params: OrderEmailRequest): string {
  const firstName = params.customerName.split(" ")[0];

  const formatDate = (dateString: string | null): string => {
    if (!dateString) return "Por confirmar";
    const [year, month, day] = dateString.split("-").map(Number);
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString("es-MX", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const weeksRows = params.deliveryWeeks
    .map(
      (w, i) => `
      <tr style="border-bottom: 1px solid #f3f4f6;">
        <td style="padding: 14px 16px; color: #374151; font-size: 14px;">
          <span style="font-weight: 600; color: #111827;">Semana ${i + 1}</span><br>
          <span style="color: #6b7280;">${w.weekName}</span>
        </td>
        <td style="padding: 14px 16px; color: #059669; font-size: 14px; font-weight: 600; text-align: right;">
          ${formatDate(w.deliveryDate)}
        </td>
      </tr>
    `
    )
    .join("");

  const showPlanDiscount = params.totals.planDiscount > 0;
  const showCoupon = params.totals.couponDiscount > 0 && params.couponCode;

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Confirmaci&oacute;n de Pedido</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6; color: #1f2937;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6; padding: 32px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.08);">

          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); padding: 48px 32px; text-align: center;">
              <div style="width: 72px; height: 72px; background-color: rgba(255,255,255,0.2); border-radius: 50%; margin: 0 auto 20px; line-height: 72px; font-size: 36px; text-align: center;">
                &#10003;
              </div>
              <h1 style="margin: 0 0 8px; font-size: 28px; font-weight: 700; color: #ffffff; letter-spacing: -0.5px;">&#161;Pedido Confirmado!</h1>
              <p style="margin: 0; font-size: 16px; color: rgba(255,255,255,0.9);">Hola Dieta &mdash; Tu comida est&aacute; en camino</p>
            </td>
          </tr>

          <!-- Greeting -->
          <tr>
            <td style="padding: 40px 32px 0;">
              <p style="margin: 0 0 8px; font-size: 18px; color: #374151;">Hola, <strong style="color: #111827;">${firstName}</strong></p>
              <p style="margin: 0; font-size: 15px; color: #6b7280; line-height: 1.6;">Gracias por tu pedido. Hemos recibido tu orden y estamos preparando todo para las fechas de entrega indicadas.</p>
            </td>
          </tr>

          <!-- Order number badge -->
          <tr>
            <td style="padding: 24px 32px;">
              <div style="background-color: #fef2f2; border: 2px solid #fca5a5; border-radius: 12px; padding: 20px; text-align: center;">
                <p style="margin: 0 0 4px; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; color: #9ca3af;">N&uacute;mero de Orden</p>
                <p style="margin: 0; font-size: 28px; font-weight: 700; color: #dc2626; letter-spacing: 1px;">#${params.orderNumber}</p>
              </div>
            </td>
          </tr>

          ${
            params.deliveryWeeks.length > 0
              ? `
          <!-- Delivery dates -->
          <tr>
            <td style="padding: 0 32px 24px;">
              <h3 style="margin: 0 0 16px; font-size: 16px; font-weight: 700; color: #111827;">&#128197; Fechas de Entrega</h3>
              <table width="100%" cellpadding="0" cellspacing="0" style="border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden;">
                <thead>
                  <tr style="background-color: #f9fafb;">
                    <th style="padding: 12px 16px; text-align: left; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: #6b7280;">Semana</th>
                    <th style="padding: 12px 16px; text-align: right; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: #6b7280;">Fecha de Entrega</th>
                  </tr>
                </thead>
                <tbody>
                  ${weeksRows}
                </tbody>
              </table>
            </td>
          </tr>`
              : ""
          }

          <!-- Delivery address -->
          <tr>
            <td style="padding: 0 32px 24px;">
              <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px; padding: 20px;">
                <p style="margin: 0 0 8px; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: #6b7280;">&#128205; Direcci&oacute;n de Entrega</p>
                <p style="margin: 0 0 4px; font-size: 15px; font-weight: 600; color: #111827;">${params.customerName}</p>
                <p style="margin: 0 0 4px; font-size: 14px; color: #374151;">${params.deliveryAddress || "Direcci&oacute;n registrada en tu cuenta"}</p>
                <p style="margin: 8px 0 0; font-size: 13px; color: #6b7280;">M&eacute;todo de env&iacute;o: <strong>${params.deliveryOptionName}</strong></p>
              </div>
            </td>
          </tr>

          <!-- Price breakdown -->
          <tr>
            <td style="padding: 0 32px 32px;">
              <h3 style="margin: 0 0 16px; font-size: 16px; font-weight: 700; color: #111827;">Resumen del Pedido</h3>
              <table width="100%" cellpadding="0" cellspacing="0" style="border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden;">
                <tbody>
                  <tr>
                    <td style="padding: 12px 16px; font-size: 14px; color: #6b7280; border-bottom: 1px solid #f3f4f6;">Subtotal</td>
                    <td style="padding: 12px 16px; font-size: 14px; color: #111827; font-weight: 500; text-align: right; border-bottom: 1px solid #f3f4f6;">$${Math.round(params.totals.subtotal)} MXN</td>
                  </tr>
                  ${
                    showPlanDiscount
                      ? `
                  <tr>
                    <td style="padding: 12px 16px; font-size: 14px; color: #059669; border-bottom: 1px solid #f3f4f6;">Descuento por volumen</td>
                    <td style="padding: 12px 16px; font-size: 14px; color: #059669; font-weight: 500; text-align: right; border-bottom: 1px solid #f3f4f6;">-$${Math.round(params.totals.planDiscount)} MXN</td>
                  </tr>`
                      : ""
                  }
                  <tr>
                    <td style="padding: 12px 16px; font-size: 14px; color: #6b7280; border-bottom: 1px solid #f3f4f6;">Env&iacute;o (${params.deliveryOptionName})</td>
                    <td style="padding: 12px 16px; font-size: 14px; color: #111827; font-weight: 500; text-align: right; border-bottom: 1px solid #f3f4f6;">$${Math.round(params.totals.deliveryPrice)} MXN</td>
                  </tr>
                  ${
                    showCoupon
                      ? `
                  <tr>
                    <td style="padding: 12px 16px; font-size: 14px; color: #059669; border-bottom: 1px solid #f3f4f6;">Cup&oacute;n ${params.couponCode}</td>
                    <td style="padding: 12px 16px; font-size: 14px; color: #059669; font-weight: 500; text-align: right; border-bottom: 1px solid #f3f4f6;">-$${Math.round(params.totals.couponDiscount)} MXN</td>
                  </tr>`
                      : ""
                  }
                  <tr>
                    <td style="padding: 12px 16px; font-size: 14px; color: #6b7280; border-bottom: 1px solid #e5e7eb;">IVA (16%)</td>
                    <td style="padding: 12px 16px; font-size: 14px; color: #111827; font-weight: 500; text-align: right; border-bottom: 1px solid #e5e7eb;">$${Math.round(params.totals.taxAmount)} MXN</td>
                  </tr>
                  <tr style="background-color: #f9fafb;">
                    <td style="padding: 16px; font-size: 16px; font-weight: 700; color: #111827;">Total</td>
                    <td style="padding: 16px; font-size: 20px; font-weight: 700; color: #dc2626; text-align: right;">$${Math.round(params.totals.finalTotal)} MXN</td>
                  </tr>
                </tbody>
              </table>
            </td>
          </tr>

          <!-- CTA -->
          <tr>
            <td style="padding: 0 32px 40px; text-align: center;">
              <a href="${params.shopUrl}/account" style="display: inline-block; background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); color: #ffffff; padding: 16px 40px; text-decoration: none; border-radius: 12px; font-weight: 600; font-size: 15px; box-shadow: 0 4px 12px rgba(239,68,68,0.35);">
                Ver mis pedidos
              </a>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 28px 32px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0 0 8px; font-size: 15px; font-weight: 700; color: #111827;">Hola Dieta</p>
              <p style="margin: 0 0 4px; font-size: 13px; color: #9ca3af;">&copy; ${new Date().getFullYear()} Hola Dieta. Todos los derechos reservados.</p>
              <p style="margin: 0; font-size: 12px; color: #d1d5db;">Este correo es una confirmaci&oacute;n autom&aacute;tica. Por favor no respondas a este mensaje.</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
