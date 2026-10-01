import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.53.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface SignupNotificationRequest {
  customerName?: string;
  customerEmail: string;
  customerPhone?: string;
  shopUrl?: string;
}

async function sendMailgun(
  ctx: { apiKey: string; domain: string; fromEmail: string },
  message: { to: string; subject: string; html: string; text: string }
): Promise<string> {
  const form = new FormData();
  form.append("from", ctx.fromEmail);
  form.append("to", message.to);
  form.append("subject", message.subject);
  form.append("html", message.html);
  form.append("text", message.text);

  const res = await fetch(`https://api.mailgun.net/v3/${ctx.domain}/messages`, {
    method: "POST",
    headers: { Authorization: `Basic ${btoa(`api:${ctx.apiKey}`)}` },
    body: form,
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Mailgun error ${res.status}: ${body}`);
  }

  const data = await res.json();
  return data.id ?? "";
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildTemplate(params: SignupNotificationRequest, siteName: string): string {
  const name = escapeHtml(params.customerName?.trim() || "Nuevo cliente");
  const email = escapeHtml(params.customerEmail);
  const phone = params.customerPhone ? escapeHtml(params.customerPhone) : "No proporcionado";
  const when = new Date().toLocaleString("es-MX", { timeZone: "America/Mexico_City" });
  const shopUrl = params.shopUrl ? escapeHtml(params.shopUrl) : "";

  return `<!DOCTYPE html>
<html lang="es"><head><meta charset="utf-8"></head>
<body style="margin:0;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;color:#111827;">
  <div style="max-width:560px;margin:0 auto;padding:24px;">
    <div style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
      <div style="background:#ef4444;padding:20px 24px;">
        <h1 style="margin:0;color:#ffffff;font-size:18px;">Nuevo registro de cliente</h1>
      </div>
      <div style="padding:24px;">
        <p style="margin:0 0 16px;font-size:14px;color:#374151;">Un cliente acaba de crear una cuenta en ${escapeHtml(siteName)}.</p>
        <table style="width:100%;border-collapse:collapse;font-size:14px;">
          <tr><td style="padding:8px 0;color:#6b7280;width:120px;">Nombre</td><td style="padding:8px 0;color:#111827;font-weight:600;">${name}</td></tr>
          <tr><td style="padding:8px 0;color:#6b7280;">Correo</td><td style="padding:8px 0;color:#111827;font-weight:600;">${email}</td></tr>
          <tr><td style="padding:8px 0;color:#6b7280;">Teléfono</td><td style="padding:8px 0;color:#111827;">${phone}</td></tr>
          <tr><td style="padding:8px 0;color:#6b7280;">Fecha</td><td style="padding:8px 0;color:#111827;">${escapeHtml(when)}</td></tr>
        </table>
        ${shopUrl ? `<p style="margin:20px 0 0;"><a href="${shopUrl}" style="display:inline-block;background:#ef4444;color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:8px;font-size:14px;">Ir al panel</a></p>` : ""}
      </div>
      <div style="padding:16px 24px;border-top:1px solid #e5e7eb;">
        <p style="margin:0;font-size:12px;color:#9ca3af;">&copy; ${new Date().getFullYear()} ${escapeHtml(siteName)}. Notificación automática.</p>
      </div>
    </div>
  </div>
</body></html>`;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
    if (!token || token === supabaseKey) {
      return new Response(
        JSON.stringify({ success: false, error: "No autorizado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: authData, error: authError } = await supabase.auth.getUser(token);
    const callerId = authData?.user?.id;
    if (authError || !callerId) {
      return new Response(
        JSON.stringify({ success: false, error: "No autorizado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const params: SignupNotificationRequest = await req.json();
    if (!params.customerEmail) {
      return new Response(
        JSON.stringify({ success: false, error: "Customer email is required." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // The caller may only trigger a notification for their own account.
    const { data: ownRow } = await supabase
      .from("customers")
      .select("customer_email")
      .eq("auth_user_id", callerId)
      .maybeSingle();

    const ownEmail = (ownRow?.customer_email || "").trim().toLowerCase();
    if (!ownEmail || ownEmail !== String(params.customerEmail).trim().toLowerCase()) {
      return new Response(
        JSON.stringify({ success: false, error: "No autorizado" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: notifRow } = await supabase
      .from("cms_settings")
      .select("value")
      .eq("setting_name", "notification_settings")
      .maybeSingle();

    const notif = notifRow?.value;
    if (!notif || !notif.enabled || notif.notify_on_signup === false) {
      return new Response(
        JSON.stringify({ success: true, skipped: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const emails: string[] = (notif.emails || []).filter(
      (e: string) => typeof e === "string" && e.trim().length > 0 && e.includes("@")
    );
    if (emails.length === 0) {
      return new Response(
        JSON.stringify({ success: true, skipped: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: configRows } = await supabase
      .from("email_configuration")
      .select("config_key, config_value");

    const configMap: Record<string, string> = {};
    for (const row of configRows ?? []) {
      configMap[row.config_key] = row.config_value;
    }

    const mailgunApiKey = configMap["mailgun_api_key"];
    const mailgunDomain = configMap["mailgun_domain"] || "mg.holadieta.mx";
    if (!mailgunApiKey) {
      return new Response(
        JSON.stringify({ success: false, error: "No se pudo enviar el correo" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: siteSettings } = await supabase
      .from("cms_settings")
      .select("value")
      .eq("key", "site_name")
      .maybeSingle();

    const siteName = siteSettings?.value || "Hola Dieta";
    const fromEmail = `${siteName} <noreply@${mailgunDomain}>`;
    const ctx = { apiKey: mailgunApiKey, domain: mailgunDomain, fromEmail };

    const html = buildTemplate(params, siteName);
    const text = `Nuevo registro de cliente en ${siteName}: ${params.customerName || ""} (${params.customerEmail}).`;
    const subject = `Nuevo cliente registrado - ${siteName}`;

    const ids: string[] = [];
    for (const email of emails) {
      try {
        const id = await sendMailgun(ctx, { to: email.trim(), subject, html, text });
        ids.push(id);
      } catch (err) {
        console.warn(`Failed to send signup notification to ${email}:`, err);
      }
    }

    return new Response(
      JSON.stringify({ success: true, mailgun_ids: ids }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("send-signup-notification error:", err);
    return new Response(
      JSON.stringify({ success: false, error: "Error interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
