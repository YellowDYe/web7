import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

const STAFF_ROLES = ["ADMIN", "MANAGER", "AGENTE", "STAFF", "DELIVERY"];
const ALLOWED_FORMATS = ["pdf", "xml", "html"];

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const token = (req.headers.get("Authorization") ?? "")
      .replace(/^Bearer\s+/i, "")
      .trim();

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    if (!token || token === supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: "Not authorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);

    // Verify the bearer token really belongs to a signed-in user.
    const { data: authData, error: authError } = await supabaseClient.auth.getUser(token);
    const callerId = authData?.user?.id;
    if (authError || !callerId) {
      return new Response(
        JSON.stringify({ error: "Not authorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const url = new URL(req.url);
    const cfdiId = url.searchParams.get("cfdiId");
    const format = url.searchParams.get("format") || "pdf";

    if (!cfdiId) {
      return new Response(
        JSON.stringify({ error: "cfdiId parameter is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!ALLOWED_FORMATS.includes(format)) {
      return new Response(
        JSON.stringify({ error: "Unsupported format" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Staff may download any invoice; a customer may only download their own.
    const { data: staffRow } = await supabaseClient
      .from("app_users")
      .select("role_id, is_active")
      .eq("auth_user_id", callerId)
      .maybeSingle();

    const isStaff = !!staffRow && staffRow.is_active !== false &&
      STAFF_ROLES.includes(staffRow.role_id);

    if (!isStaff) {
      const { data: cfdiRow } = await supabaseClient
        .from("cfdis")
        .select("customer_id")
        .eq("facturama_cfdi_id", cfdiId)
        .maybeSingle();

      if (!cfdiRow?.customer_id) {
        return new Response(
          JSON.stringify({ error: "Not authorized" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: ownsIt } = await supabaseClient
        .from("customers")
        .select("customer_id")
        .eq("customer_id", cfdiRow.customer_id)
        .eq("auth_user_id", callerId)
        .maybeSingle();

      if (!ownsIt) {
        return new Response(
          JSON.stringify({ error: "Not authorized" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    const { data: config, error: configError } = await supabaseClient
      .from("facturama_config")
      .select("*")
      .eq("is_active", true)
      .maybeSingle();

    if (configError || !config) {
      return new Response(
        JSON.stringify({ error: "Facturama not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const baseUrl = config.environment === "production"
      ? "https://api.facturama.mx"
      : "https://apisandbox.facturama.mx";

    const facturamaAuth = "Basic " + btoa(`${config.username}:${config.password}`);

    const downloadTypes = ["issuedLite", "payroll", "issued"];
    let data: unknown = null;

    for (const type of downloadTypes) {
      const downloadUrl = `${baseUrl}/Cfdi/${format}/${type}/${cfdiId}`;
      console.log(`[facturama-download] Trying: ${downloadUrl}`);

      const response = await fetch(downloadUrl, {
        headers: { "Authorization": facturamaAuth },
      });

      if (response.ok) {
        data = await response.json();
        console.log(`[facturama-download] Success with type: ${type}`);
        break;
      }

      if (response.status === 404 && type !== downloadTypes[downloadTypes.length - 1]) {
        console.log(`[facturama-download] 404 with type "${type}", trying next...`);
        continue;
      }

      const errorBody = await response.text().catch(() => "");
      console.error(`[facturama-download] Facturama returned ${response.status}:`, errorBody);
      return new Response(
        JSON.stringify({
          error: `Facturama returned ${response.status}`,
        }),
        { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[facturama-download] Error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
