import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.53.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface ResetRequest {
  email: string;
  siteUrl?: string;
  redirectPath?: string;
}

const MAX_REQUESTS_PER_WINDOW = 3;
const WINDOW_MINUTES = 15;

// Only these in-app pages may receive a recovery link. Prevents an attacker
// from pointing the branded reset link at a page they control.
const ALLOWED_REDIRECT_PATHS = ["/reset-password", "/admin/reset-password"];

/**
 * The recovery link must point at this site. Building the origin from a value
 * in the request body would let anyone mail a branded reset link that hands the
 * token to a site they control, so prefer the configured allowlist / env and
 * fall back only to the browser-asserted Origin header.
 */
function resolveSiteUrl(requested: unknown, req: Request): string | null {
  const allowed = (Deno.env.get("ALLOWED_SITE_URLS") || Deno.env.get("ALLOWED_RETURN_ORIGINS") || "")
    .split(",")
    .map((o) => o.trim().replace(/\/$/, ""))
    .filter(Boolean);
  const configured = (Deno.env.get("PUBLIC_SITE_URL") || Deno.env.get("SITE_URL") || "").trim().replace(/\/$/, "");
  if (configured) allowed.unshift(configured);

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
      if (parsed.protocol === "https:" || parsed.protocol === "http:") return parsed.origin;
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

  // A generic success response the caller cannot distinguish from a real send,
  // so the endpoint never reveals whether an address has an account.
  const genericSuccess = (email: string) =>
    new Response(
      JSON.stringify({ success: true, message: "Password reset email sent", email }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: configRows, error: configError } = await supabase
      .from("email_configuration")
      .select("config_key, config_value");

    const configMap: Record<string, string> = {};
    for (const row of configRows ?? []) {
      configMap[row.config_key] = row.config_value;
    }

    if (configError || !configMap["mailgun_api_key"]) {
      console.error("Email configuration missing", configError);
      return new Response(
        JSON.stringify({ success: false, error: "No se pudo enviar el correo de recuperación" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { email: rawEmail, siteUrl, redirectPath }: ResetRequest = await req.json();
    const email = typeof rawEmail === "string" ? rawEmail.trim().toLowerCase() : "";

    if (!email || !/^[^@\s]+@[^@\s.]+\.[^@\s]+$/.test(email) || email.length > 254) {
      return new Response(
        JSON.stringify({ success: false, error: "Valid email is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const path = ALLOWED_REDIRECT_PATHS.includes(redirectPath as string)
      ? (redirectPath as string)
      : "/reset-password";

    // Customer reset links must always land on the public storefront, regardless
    // of which host requested the reset. Admin links keep using the request origin.
    let siteBase: string | null = null;
    if (!path.startsWith("/admin")) {
      const { data: siteUrlRow } = await supabase
        .from("cms_settings")
        .select("value")
        .eq("setting_name", "site_url")
        .maybeSingle();
      const configuredUrl = typeof siteUrlRow?.value === "string" ? siteUrlRow.value.trim() : "";
      if (configuredUrl) {
        try {
          siteBase = new URL(configuredUrl).origin;
        } catch {
          siteBase = null;
        }
      }
    }
    if (!siteBase) {
      siteBase = resolveSiteUrl(siteUrl, req);
    }
    if (!siteBase) {
      console.error("No site URL configured for password reset links");
      return new Response(
        JSON.stringify({ success: false, error: "No se pudo enviar el correo de recuperación" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Throttle so one address cannot be used to flood a mailbox.
    const windowStart = new Date(Date.now() - WINDOW_MINUTES * 60 * 1000).toISOString();
    const { count: recentCount } = await supabase
      .from("password_reset_requests")
      .select("id", { count: "exact", head: true })
      .eq("email", email)
      .gte("created_at", windowStart);

    if ((recentCount ?? 0) >= MAX_REQUESTS_PER_WINDOW) {
      return genericSuccess(email);
    }

    // Generate a recovery token. If the address has no account this errors; we
    // still return the generic success so account existence stays hidden.
    const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
      type: "recovery",
      email,
      options: { redirectTo: `${siteBase}${path}` },
    });

    if (linkError || !linkData?.properties?.hashed_token) {
      console.log("generateLink did not return a token (likely no account):", linkError?.message);
      return genericSuccess(email);
    }

    await supabase.from("password_reset_requests").insert({ email });

    const hashedToken = linkData.properties.hashed_token;
    const resetLink = `${siteBase}${path}?token_hash=${encodeURIComponent(hashedToken)}&type=recovery`;

    const { data: siteSettings } = await supabase
      .from("cms_settings")
      .select("value")
      .eq("setting_name", "site_name")
      .maybeSingle();

    const siteName = siteSettings?.value || "Hola Dieta";
    const subject = `${siteName} - Restablece tu contraseña`;

    const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Restablece tu contraseña</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 0;">
        <table role="presentation" style="width: 600px; max-width: 100%; border-collapse: collapse; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          <tr>
            <td style="background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); padding: 40px 40px 32px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 26px; font-weight: 700;">${siteName}</h1>
              <p style="margin: 8px 0 0; color: #fee2e2; font-size: 15px;">Restablecer contraseña</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 36px 40px 40px;">
              <p style="margin: 0 0 20px; color: #4a5568; font-size: 16px; line-height: 1.5;">
                Recibimos una solicitud para restablecer la contraseña de tu cuenta. Haz clic en el botón de abajo para elegir una nueva contraseña.
              </p>
              <table role="presentation" style="width: 100%; margin: 30px 0;">
                <tr>
                  <td align="center">
                    <a href="${resetLink}" style="display: inline-block; padding: 16px 40px; background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">Restablecer mi contraseña</a>
                  </td>
                </tr>
              </table>
              <p style="margin: 20px 0 0; color: #718096; font-size: 14px; line-height: 1.5;">
                Si no solicitaste este cambio, puedes ignorar este correo con seguridad. Tu contraseña no cambiará.
              </p>
              <p style="margin: 16px 0 0; color: #a0aec0; font-size: 12px; line-height: 1.5;">
                Este enlace expira en 1 hora y solo puede usarse una vez.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding: 20px 40px; background-color: #f7fafc; border-top: 1px solid #e2e8f0;">
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

    const textBody = `Restablece tu contraseña

Recibimos una solicitud para restablecer la contraseña de tu cuenta.

Abre el siguiente enlace para elegir una nueva contraseña (expira en 1 hora):
${resetLink}

Si no solicitaste este cambio, puedes ignorar este correo.

© ${new Date().getFullYear()} ${siteName}`;

    const mailgunDomain = configMap["mailgun_domain"] || "mg.holadieta.mx";
    const mailgunApiKey = configMap["mailgun_api_key"];
    const fromEmail = configMap["from_email"] || `noreply@${mailgunDomain}`;
    const fromName = configMap["from_name"] || siteName;

    const formData = new FormData();
    formData.append("from", `${fromName} <${fromEmail}>`);
    formData.append("to", email);
    formData.append("subject", subject);
    formData.append("text", textBody);
    formData.append("html", htmlBody);
    // Disable click tracking so Mailgun does not pre-fetch (and consume) the
    // single-use recovery link before the customer clicks it.
    formData.append("o:tracking", "no");
    formData.append("o:tracking-clicks", "no");
    formData.append("o:tracking-opens", "no");

    const mailgunResponse = await fetch(
      `https://api.mailgun.net/v3/${mailgunDomain}/messages`,
      {
        method: "POST",
        headers: { Authorization: `Basic ${btoa(`api:${mailgunApiKey}`)}` },
        body: formData,
      }
    );

    if (!mailgunResponse.ok) {
      const errorText = await mailgunResponse.text();
      console.error("Mailgun error:", errorText);
      return new Response(
        JSON.stringify({ success: false, error: "No se pudo enviar el correo de recuperación" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    await mailgunResponse.json().catch(() => ({}));

    return genericSuccess(email);
  } catch (error: any) {
    console.error("Error in send-password-reset:", error);
    return new Response(
      JSON.stringify({ success: false, error: "No se pudo enviar el correo de recuperación" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
