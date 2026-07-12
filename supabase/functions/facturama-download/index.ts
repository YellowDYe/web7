import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "No authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);

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

    const url = new URL(req.url);
    const cfdiId = url.searchParams.get("cfdiId");
    const format = url.searchParams.get("format") || "pdf";

    if (!cfdiId) {
      return new Response(
        JSON.stringify({ error: "cfdiId parameter is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
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
          detail: errorBody,
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
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
