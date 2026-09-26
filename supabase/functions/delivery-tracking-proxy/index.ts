import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

const STAFF_ROLES = ["admin", "super_admin", "manager", "staff"];

const ALLOWED_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"];

/**
 * Only these carrier paths may be reached through the proxy. Without an
 * allowlist the `endpoint` field is a server-side request forgery primitive:
 * it is appended to the carrier base URL and sent with the operator's API key.
 */
const ALLOWED_ENDPOINT_PATTERNS: RegExp[] = [
  /^\/orders(\?[^#]*)?$/,
  /^\/orders\/[A-Za-z0-9_-]{1,64}(\/[A-Za-z0-9_-]{1,64})?(\?[^#]*)?$/,
  /^\/drivers(\?[^#]*)?$/,
  /^\/drivers\/[A-Za-z0-9_-]{1,64}(\?[^#]*)?$/,
  /^\/routes(\?[^#]*)?$/,
  /^\/routes\/[A-Za-z0-9_-]{1,64}(\?[^#]*)?$/,
  /^\/deliveries(\?[^#]*)?$/,
  /^\/deliveries\/[A-Za-z0-9_-]{1,64}(\?[^#]*)?$/,
  /^\/tracking\/[A-Za-z0-9_-]{1,64}(\?[^#]*)?$/,
  /^\/webhooks(\?[^#]*)?$/,
];

function isAllowedEndpoint(endpoint: unknown): endpoint is string {
  if (typeof endpoint !== "string" || endpoint.length > 300) return false;
  // Must be a relative path on the configured host, never an absolute URL and
  // never an attempt to climb out of it.
  if (!endpoint.startsWith("/") || endpoint.startsWith("//")) return false;
  if (endpoint.includes("..") || endpoint.includes("\\") || /[\x00-\x1f]/.test(endpoint)) return false;
  return ALLOWED_ENDPOINT_PATTERNS.some((re) => re.test(endpoint));
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // This proxy signs requests with the operator's carrier API key, so only
    // active staff may use it. The published anon key is not a session.
    const token = (req.headers.get("Authorization") ?? "")
      .replace(/^Bearer\s+/i, "")
      .trim();
    if (!token || token === supabaseServiceKey) {
      return jsonResponse({ error: "No autorizado" }, 401);
    }

    const { data: authData, error: authError } = await supabase.auth.getUser(token);
    const callerId = authData?.user?.id;
    if (authError || !callerId) {
      return jsonResponse({ error: "No autorizado" }, 401);
    }

    const { data: staffRow } = await supabase
      .from("app_users")
      .select("role_id, is_active")
      .eq("auth_user_id", callerId)
      .maybeSingle();

    const isStaff =
      !!staffRow && staffRow.is_active !== false &&
      STAFF_ROLES.includes(String(staffRow.role_id).toLowerCase());

    if (!isStaff) {
      return jsonResponse({ error: "No autorizado" }, 403);
    }

    const body = await req.json();
    const { action, endpoint, method, payload } = body;

    const { data: config, error: configErr } = await supabase
      .from("delivery_tracking_config")
      .select("*")
      .eq("is_active", true)
      .maybeSingle();

    if (configErr) {
      console.error("Error loading delivery tracking config:", configErr);
      return jsonResponse({ error: "Error al cargar la configuracion" }, 500);
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

    return jsonResponse({ error: "Accion no reconocida" }, 400);
  } catch (err: any) {
    console.error("Edge function error:", err);
    return jsonResponse({ error: "Error interno del servidor" }, 500);
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
    console.error("Delivery tracking connection test failed:", err);
    return jsonResponse(
      { success: false, message: "No se pudo conectar con Delivery Tracking" },
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
  if (!isAllowedEndpoint(endpoint)) {
    console.error("Blocked delivery tracking endpoint:", endpoint);
    return jsonResponse({ error: "Ruta no permitida" }, 400);
  }

  const requestedMethod = String(method || "POST").toUpperCase();
  if (!ALLOWED_METHODS.includes(requestedMethod)) {
    return jsonResponse({ error: "Metodo no permitido" }, 400);
  }

  const baseUrl = config.app_url.replace(/\/$/, "");
  const url = `${baseUrl}${endpoint}`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
    "X-API-Key": config.api_key,
  };

  const fetchOptions: RequestInit = {
    method: requestedMethod,
    headers,
    redirect: "manual",
  };

  if (payload && requestedMethod !== "GET") {
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
