import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    const { action, endpoint, method, payload } = body;

    const { data: config, error: configErr } = await supabase
      .from("delivery_tracking_config")
      .select("*")
      .eq("is_active", true)
      .maybeSingle();

    if (configErr) {
      return jsonResponse(
        { error: `Error loading config: ${configErr.message}` },
        500
      );
    }

    if (!config || !config.api_key || !config.app_url) {
      return jsonResponse(
        { error: "Delivery Tracking no esta configurado. Agrega la URL y API Key en Configuraciones." },
        400
      );
    }

    if (action === "test-connection") {
      return await handleTestConnection(config);
    }

    if (action === "proxy-request") {
      return await handleProxyRequest(config, endpoint, method, payload);
    }

    return jsonResponse({ error: `Accion no reconocida: ${action}` }, 400);
  } catch (err: any) {
    console.error("Edge function error:", err);
    return jsonResponse(
      { error: err.message || "Error interno del servidor" },
      500
    );
  }
});

async function handleTestConnection(config: any) {
  try {
    const baseUrl = config.app_url.replace(/\/$/, "");
    const response = await fetch(`${baseUrl}/orders?date=2000-01-01`, {
      method: "GET",
      headers: {
        "X-API-Key": config.api_key,
        Accept: "application/json",
      },
    });

    if (response.ok) {
      return jsonResponse(
        { success: true, message: "Conexion exitosa con Delivery Tracking" },
        200
      );
    }

    if (response.status === 401) {
      return jsonResponse(
        { success: false, message: "API Key invalida. Verifica la clave en configuraciones." },
        200
      );
    }

    return jsonResponse(
      { success: false, message: `Error de conexion: HTTP ${response.status}` },
      200
    );
  } catch (err: any) {
    return jsonResponse(
      { success: false, message: `No se pudo conectar: ${err.message}` },
      200
    );
  }
}

async function handleProxyRequest(
  config: any,
  endpoint: string,
  method: string,
  payload: any
) {
  const baseUrl = config.app_url.replace(/\/$/, "");
  const url = `${baseUrl}${endpoint}`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
    "X-API-Key": config.api_key,
  };

  const fetchOptions: RequestInit = {
    method: method || "POST",
    headers,
  };

  if (payload && method !== "GET") {
    fetchOptions.body = JSON.stringify(payload);
  }

  const response = await fetch(url, fetchOptions);
  const responseText = await response.text();

  let data;
  try {
    data = JSON.parse(responseText);
  } catch {
    data = { raw: responseText };
  }

  if (!response.ok) {
    const errorMessage =
      data?.message || data?.error || response.statusText || responseText;
    return jsonResponse(
      {
        error: `Delivery Tracking API Error (${response.status}): ${errorMessage}`,
        status: response.status,
        data,
      },
      200
    );
  }

  return jsonResponse({ success: true, data }, 200);
}

function jsonResponse(data: unknown, status: number) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
