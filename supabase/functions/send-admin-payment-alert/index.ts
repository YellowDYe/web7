import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.53.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const MP_API_BASE = "https://api.mercadopago.com";

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function sendMailgun(
  ctx: { apiKey: string; domain: string; fromEmail: string },
  message: { to: string; subject: string; html: string; text: string },
) {
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
  if (!res.ok) throw new Error(`Mailgun error ${res.status}: ${await res.text()}`);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Internal only: callable by other edge functions holding the service key.
    const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
    if (!token || token !== serviceKey) {
      return jsonResponse({ success: false, error: "No autorizado" }, 401);
    }

    const supabase = createClient(supabaseUrl, serviceKey);
    const { payment_id } = await req.json();
    if (!payment_id) return jsonResponse({ success: false, error: "payment_id required" }, 400);

    const { data: existingOrder } = await supabase
      .from("orders")
      .select("id")
      .eq("mp_payment_id", String(payment_id))
      .maybeSingle();
    if (existingOrder) return jsonResponse({ success: true, skipped: "order_exists" });

    const { data: config } = await supabase
      .from("mercado_pago_config")
      .select("access_token")
      .maybeSingle();
    if (!config?.access_token) return jsonResponse({ success: false, error: "MP config missing" }, 500);

    const mpRes = await fetch(`${MP_API_BASE}/v1/payments/${encodeURIComponent(String(payment_id))}`, {
      headers: { Authorization: `Bearer ${config.access_token}` },
    });
    if (!mpRes.ok) return jsonResponse({ success: false, error: "Could not fetch payment" }, 502);
    const payment = await mpRes.json();

    if (!["approved", "pending", "in_process", "authorized"].includes(payment.status)) {
      return jsonResponse({ success: true, skipped: "status_not_paid" });
    }

    const externalRef: string = typeof payment.external_reference === "string" ? payment.external_reference : "";
    const quoteId = externalRef.startsWith("quote_") ? externalRef.slice(6) : null;

    let customerLine = "";
    if (quoteId) {
      // Claim the alert atomically so repeated notifications send only one email.
      const { data: claimed } = await supabase
        .from("payment_quotes")
        .update({ admin_alerted_at: new Date().toISOString() })
        .eq("id", quoteId)
        .is("admin_alerted_at", null)
        .is("order_id", null)
        .select("auth_user_id")
        .maybeSingle();
      if (!claimed) return jsonResponse({ success: true, skipped: "already_alerted_or_linked" });

      if (claimed.auth_user_id) {
        const { data: cust } = await supabase
          .from("customers")
          .select("customer_name, customer_lastname, customer_email, customer_phone")
          .eq("auth_user_id", claimed.auth_user_id)
          .maybeSingle();
        if (cust) {
          customerLine = [
            `${cust.customer_name || ""} ${cust.customer_lastname || ""}`.trim(),
            cust.customer_email,
            cust.customer_phone,
          ].filter(Boolean).join(" · ");
        }
      }
    }

    const { data: notifRow } = await supabase
      .from("cms_settings")
      .select("value")
      .eq("setting_name", "notification_settings")
      .maybeSingle();
    const notif = notifRow?.value;
    const emails: string[] = (notif?.emails || []).filter(
      (e: unknown) => typeof e === "string" && e.includes("@"),
    );
    if (!notif?.enabled || emails.length === 0) {
      return jsonResponse({ success: true, skipped: "no_recipients" });
    }

    const { data: configRows } = await supabase
      .from("email_configuration")
      .select("config_key, config_value");
    const configMap: Record<string, string> = {};
    for (const row of configRows ?? []) configMap[row.config_key] = row.config_value;
    const apiKey = configMap["mailgun_api_key"];
    const domain = configMap["mailgun_domain"] || "mg.holadieta.mx";
    if (!apiKey) return jsonResponse({ success: false, error: "Mailgun not configured" }, 500);

    const { data: siteSettings } = await supabase
      .from("cms_settings")
      .select("value")
      .eq("key", "site_name")
      .maybeSingle();
    const siteName = siteSettings?.value || "Hola Dieta";

    const amount = Number(payment.transaction_amount ?? 0).toLocaleString("es-MX", { style: "currency", currency: "MXN" });
    const paidAt = new Date(payment.date_approved || payment.date_created || Date.now())
      .toLocaleString("es-MX", { timeZone: "America/Mexico_City" });
    const payerEmail = payment.payer?.email || "";
    const items: string[] = (payment.additional_info?.items || []).map(
      (it: any) => `${it.quantity ?? 1} x ${it.title ?? "Artículo"}`,
    );

    const rows: [string, string][] = [
      ["Monto", amount],
      ["Estado del pago", String(payment.status)],
      ["ID de pago MP", String(payment_id)],
      ["Fecha", paidAt],
      ["Cliente", customerLine || "No identificado"],
      ["Correo del pagador", payerEmail || "No disponible"],
      ["Referencia", externalRef || "Sin referencia"],
    ];

    const html = `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"></head>
<body style="margin:0;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;color:#111827;">
<div style="max-width:560px;margin:0 auto;padding:24px;">
<div style="background:#fff;border-radius:12px;overflow:hidden;">
<div style="background:#b91c1c;padding:20px 24px;"><h1 style="margin:0;color:#fff;font-size:18px;">Pago recibido SIN pedido registrado</h1></div>
<div style="padding:24px;">
<p style="margin:0 0 16px;font-size:14px;color:#374151;">Mercado Pago confirmó un pago, pero no existe ningún pedido asociado en ${escapeHtml(siteName)}. Revisa y contacta al cliente.</p>
<table style="width:100%;border-collapse:collapse;font-size:14px;">
${rows.map(([k, v]) => `<tr><td style="padding:6px 0;color:#6b7280;width:150px;">${escapeHtml(k)}</td><td style="padding:6px 0;font-weight:600;">${escapeHtml(v)}</td></tr>`).join("")}
</table>
${items.length ? `<p style="margin:16px 0 4px;font-size:13px;color:#6b7280;">Artículos cobrados</p><ul style="margin:0;padding-left:18px;font-size:14px;">${items.map((i) => `<li>${escapeHtml(i)}</li>`).join("")}</ul>` : ""}
</div></div></div></body></html>`;

    const text = `Pago recibido sin pedido registrado.\n${rows.map(([k, v]) => `${k}: ${v}`).join("\n")}\n${items.join("\n")}`;
    const subject = `ALERTA: pago de ${amount} sin pedido - ${siteName}`;
    const ctx = { apiKey, domain, fromEmail: `${siteName} <noreply@${domain}>` };

    let sent = 0;
    for (const to of emails) {
      try {
        await sendMailgun(ctx, { to: to.trim(), subject, html, text });
        sent++;
      } catch (err) {
        console.warn(`Payment alert to ${to} failed:`, err);
      }
    }

    if (sent === 0 && quoteId) {
      await supabase.from("payment_quotes").update({ admin_alerted_at: null }).eq("id", quoteId);
    }

    return jsonResponse({ success: sent > 0, sent });
  } catch (err) {
    console.error("send-admin-payment-alert error:", err);
    return jsonResponse({ success: false, error: "Error interno" }, 500);
  }
});
