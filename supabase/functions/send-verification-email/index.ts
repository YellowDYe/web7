import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.53.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface VerificationRequest {
  email: string;
  siteUrl: string;
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get email config from database
    const { data: emailConfig, error: configError } = await supabase
      .from("email_config")
      .select("*")
      .limit(1)
      .maybeSingle();

    if (configError || !emailConfig?.mailgun_api_key) {
      throw new Error("Email configuration not found. Please configure Mailgun in admin settings.");
    }

    // Parse request body
    const { email, siteUrl }: VerificationRequest = await req.json();

    if (!email || !email.includes("@")) {
      return new Response(
        JSON.stringify({ success: false, error: "Valid email is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Request verification token
    const { data: verificationData, error: verificationError } = await supabase
      .rpc("request_email_verification", {
        p_email: email,
      })
      .single();

    if (verificationError || !verificationData.success) {
      throw new Error(verificationData?.error || "Failed to create verification token");
    }

    const { token, is_existing_customer } = verificationData;

    // Build magic link
    const magicLink = `${siteUrl}/shop/verify-email?token=${token}`;

    // Get site branding
    const { data: siteSettings } = await supabase
      .from("cms_settings")
      .select("value")
      .eq("key", "site_name")
      .maybeSingle();

    const siteName = siteSettings?.value || "Hola Dieta";

    // Prepare email content
    const subject = is_existing_customer
      ? `${siteName} - Verifica tu correo para crear tu cuenta`
      : `${siteName} - Verifica tu correo electrónico`;

    const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verifica tu correo electrónico</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 0;">
        <table role="presentation" style="width: 600px; border-collapse: collapse; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 20px; text-align: center;">
              <h1 style="margin: 0; color: #1a1a1a; font-size: 28px; font-weight: 600;">${siteName}</h1>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 0 40px 40px;">
              ${is_existing_customer ? `
                <p style="margin: 0 0 20px; color: #4a5568; font-size: 16px; line-height: 1.5;">
                  ¡Hola! Ya te conocemos. Haz clic en el botón de abajo para verificar tu correo y crear tu contraseña.
                </p>
              ` : `
                <p style="margin: 0 0 20px; color: #4a5568; font-size: 16px; line-height: 1.5;">
                  ¡Bienvenido! Haz clic en el botón de abajo para verificar tu correo electrónico y continuar con tu registro.
                </p>
              `}
              
              <!-- CTA Button -->
              <table role="presentation" style="width: 100%; margin: 30px 0;">
                <tr>
                  <td align="center">
                    <a href="${magicLink}" style="display: inline-block; padding: 16px 40px; background-color: #bfd730; color: #000000; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">Verificar mi correo</a>
                  </td>
                </tr>
              </table>
              
              <p style="margin: 20px 0 0; color: #718096; font-size: 14px; line-height: 1.5;">
                Si no solicitaste esta verificación, puedes ignorar este correo con seguridad.
              </p>
              
              <p style="margin: 20px 0 0; color: #a0aec0; font-size: 12px; line-height: 1.5;">
                Este enlace expira en 1 hora.
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 20px 40px; background-color: #f7fafc; border-top: 1px solid #e2e8f0; border-radius: 0 0 8px 8px;">
              <p style="margin: 0; color: #a0aec0; font-size: 12px; text-align: center;">
                © ${new Date().getFullYear()} ${siteName}. Todos los derechos reservados.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `;

    const textBody = `
Verifica tu correo electrónico

${is_existing_customer ? "¡Hola! Ya te conocemos. Verifica tu correo para crear tu contraseña." : "¡Bienvenido! Verifica tu correo para continuar con tu registro."}

Haz clic en el siguiente enlace (expira en 1 hora):
${magicLink}

Si no solicitaste esta verificación, puedes ignorar este correo.

© ${new Date().getFullYear()} ${siteName}
    `;

    // Send email via Mailgun
    const mailgunDomain = emailConfig.mailgun_domain || "mg.holadieta.mx";
    const mailgunApiKey = emailConfig.mailgun_api_key;
    const fromEmail = emailConfig.from_email || `noreply@${mailgunDomain}`;
    const fromName = emailConfig.from_name || siteName;

    const formData = new FormData();
    formData.append("from", `${fromName} <${fromEmail}>`);
    formData.append("to", email);
    formData.append("subject", subject);
    formData.append("text", textBody);
    formData.append("html", htmlBody);

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
      throw new Error(`Failed to send email: ${mailgunResponse.statusText}`);
    }

    const mailgunData = await mailgunResponse.json();

    return new Response(
      JSON.stringify({
        success: true,
        message: "Verification email sent successfully",
        email,
        is_existing_customer,
        mailgun_id: mailgunData.id,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error in send-verification-email:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || "Failed to send verification email",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
