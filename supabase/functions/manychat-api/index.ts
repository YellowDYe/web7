import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

const MC_API_BASE = "https://api.manychat.com";
const FUNCTION_VERSION = "2026-06-21-v3";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    const { action } = body;

    const { data: config, error: configErr } = await supabase
      .from("manychat_config")
      .select("*")
      .eq("is_active", true)
      .maybeSingle();

    if (configErr) {
      return jsonResponse({ error: `Error loading config: ${configErr.message}` }, 500);
    }

    if (!config || !config.api_token) {
      return jsonResponse(
        { error: "Manychat no esta configurado. Agrega tu API Token en Configuraciones." },
        400
      );
    }

    const apiToken = config.api_token;

    switch (action) {
      case "test-connection":
        return await handleTestConnection(apiToken);

      case "get-custom-fields":
        return await handleGetCustomFields(apiToken);

      case "find-by-system-field":
        return await handleFindBySystemField(apiToken, body);

      case "find-by-custom-field":
        return await handleFindByCustomField(apiToken, body);

      case "get-subscriber-info":
        return await handleGetSubscriberInfo(apiToken, body);

      case "set-custom-field":
        return await handleSetCustomField(apiToken, body);

      case "set-custom-field-by-name":
        return await handleSetCustomFieldByName(apiToken, body);

      case "create-subscriber":
        return await handleCreateSubscriber(apiToken, body);

      case "add-tag-by-name":
        return await handleAddTagByName(apiToken, body);

      case "send-flow":
        return await handleSendFlow(apiToken, body);

      case "debug-find":
        return await handleDebugFind(apiToken, body);

      case "get-version":
        return jsonResponse({ version: FUNCTION_VERSION }, 200);

      default:
        return jsonResponse({ error: `Accion no reconocida: ${action}` }, 400);
    }
  } catch (err: any) {
    console.error("Edge function error:", err);
    return jsonResponse({ error: err.message || "Error interno del servidor" }, 500);
  }
});

async function handleTestConnection(apiToken: string) {
  const response = await mcGet(apiToken, "/fb/page/getCustomFields");
  if (!response.ok) {
    const errText = await response.text();
    return jsonResponse(
      { success: false, message: `Error de autenticacion (${response.status}). Verifica tu API Token.`, details: errText },
      200
    );
  }
  const json = await response.json();
  const fields = json?.data || [];

  const requiredFields = [
    { id: 13626542, name: "Waphone" },
    { id: 13592478, name: "Delivery" },
    { id: 13592466, name: "Horario Entrega" },
  ];

  const fieldResults = requiredFields.map((req) => {
    const found = fields.find((f: any) => f.id === req.id);
    return {
      id: req.id,
      expected_name: req.name,
      found: !!found,
      actual_name: found?.name || null,
      type: found?.type || null,
    };
  });

  const allFound = fieldResults.every((f) => f.found);

  return jsonResponse({
    success: true,
    message: allFound
      ? "Conexion exitosa. Todos los campos requeridos existen."
      : "Conexion exitosa, pero faltan campos requeridos.",
    fields: fieldResults,
    total_custom_fields: fields.length,
  }, 200);
}

async function handleGetCustomFields(apiToken: string) {
  const response = await mcGet(apiToken, "/fb/page/getCustomFields");
  if (!response.ok) {
    const errText = await response.text();
    return jsonResponse({ error: `Manychat API error (${response.status}): ${errText}` }, 200);
  }
  const json = await response.json();
  return jsonResponse(json, 200);
}

async function handleFindBySystemField(apiToken: string, body: any) {
  const { field, value } = body;
  if (!field || !value) {
    return jsonResponse({ error: "Se requieren 'field' y 'value'" }, 400);
  }
  const response = await mcGet(apiToken, `/fb/subscriber/findBySystemField?field=${encodeURIComponent(field)}&value=${encodeURIComponent(value)}`);
  if (!response.ok) {
    if (response.status === 404) return jsonResponse({ status: "success", data: [] }, 200);
    const errText = await response.text();
    return jsonResponse({ error: `Manychat API error (${response.status}): ${errText}` }, 200);
  }
  const json = await response.json();
  return jsonResponse(json, 200);
}

async function handleFindByCustomField(apiToken: string, body: any) {
  const { field_id, value } = body;
  if (!field_id || !value) {
    return jsonResponse({ error: "Se requieren 'field_id' y 'value'", _version: FUNCTION_VERSION }, 400);
  }
  const url = `/fb/subscriber/findByCustomField?field_id=${field_id}&field_value=${encodeURIComponent(value)}`;
  console.log("findByCustomField request URL:", url);
  const response = await mcGet(apiToken, url);
  console.log("findByCustomField response status:", response.status);
  if (!response.ok) {
    const errText = await response.text();
    console.error("findByCustomField error:", response.status, errText);
    return jsonResponse({ error: `Manychat API error (${response.status}): ${errText}`, _version: FUNCTION_VERSION, _debug: { url, status: response.status } }, 200);
  }
  const json = await response.json();
  console.log("findByCustomField raw response:", JSON.stringify(json));
  return jsonResponse({ ...json, _version: FUNCTION_VERSION, _request_url: url }, 200);
}

async function handleGetSubscriberInfo(apiToken: string, body: any) {
  const { subscriber_id } = body;
  if (!subscriber_id) {
    return jsonResponse({ error: "Se requiere 'subscriber_id'" }, 400);
  }
  const response = await mcGet(apiToken, `/fb/subscriber/getInfo?subscriber_id=${subscriber_id}`);
  if (!response.ok) {
    const errText = await response.text();
    return jsonResponse({ error: `Manychat API error (${response.status}): ${errText}` }, 200);
  }
  const json = await response.json();
  return jsonResponse(json, 200);
}

async function handleSetCustomField(apiToken: string, body: any) {
  const { subscriber_id, field_id, field_value } = body;
  if (!subscriber_id || !field_id) {
    return jsonResponse({ error: "Se requieren 'subscriber_id' y 'field_id'" }, 400);
  }
  const response = await mcPost(apiToken, "/fb/subscriber/setCustomField", {
    subscriber_id,
    field_id,
    field_value,
  });
  if (!response.ok) {
    const errText = await response.text();
    return jsonResponse({ error: `Manychat API error (${response.status}): ${errText}` }, 200);
  }
  const json = await response.json();
  return jsonResponse(json, 200);
}

async function handleSetCustomFieldByName(apiToken: string, body: any) {
  const { subscriber_id, field_name, field_value } = body;
  if (!subscriber_id || !field_name) {
    return jsonResponse({ error: "Se requieren 'subscriber_id' y 'field_name'" }, 400);
  }
  const response = await mcPost(apiToken, "/fb/subscriber/setCustomFieldByName", {
    subscriber_id,
    field_name,
    field_value,
  });
  if (!response.ok) {
    const errText = await response.text();
    return jsonResponse({ error: `Manychat API error (${response.status}): ${errText}` }, 200);
  }
  const json = await response.json();
  return jsonResponse(json, 200);
}

async function handleCreateSubscriber(apiToken: string, body: any) {
  const { first_name, last_name, whatsapp_phone, consent_phrase } = body;
  if (!first_name || !whatsapp_phone) {
    return jsonResponse({ error: "Se requieren 'first_name' y 'whatsapp_phone'" }, 400);
  }
  const response = await mcPost(apiToken, "/fb/subscriber/createSubscriber", {
    first_name,
    last_name: last_name || "",
    whatsapp_phone,
    consent_phrase: consent_phrase || "Acepto recibir mensajes",
  });
  if (!response.ok) {
    const errText = await response.text();
    return jsonResponse({ error: `Manychat API error (${response.status}): ${errText}` }, 200);
  }
  const json = await response.json();
  return jsonResponse(json, 200);
}

async function handleAddTagByName(apiToken: string, body: any) {
  const { subscriber_id, tag_name } = body;
  if (!subscriber_id || !tag_name) {
    return jsonResponse({ error: "Se requieren 'subscriber_id' y 'tag_name'" }, 400);
  }
  const response = await mcPost(apiToken, "/fb/subscriber/addTagByName", {
    subscriber_id,
    tag_name,
  });
  if (!response.ok) {
    const errText = await response.text();
    return jsonResponse({ error: `Manychat API error (${response.status}): ${errText}` }, 200);
  }
  const json = await response.json();
  return jsonResponse(json, 200);
}

async function handleSendFlow(apiToken: string, body: any) {
  const { subscriber_id, flow_ns } = body;
  if (!subscriber_id || !flow_ns) {
    return jsonResponse({ error: "Se requieren 'subscriber_id' y 'flow_ns'" }, 400);
  }
  const response = await mcPost(apiToken, "/fb/sending/sendFlow", {
    subscriber_id,
    flow_ns,
  });
  if (!response.ok) {
    const errText = await response.text();
    return jsonResponse({ error: `Manychat API error (${response.status}): ${errText}` }, 200);
  }
  const json = await response.json();
  return jsonResponse(json, 200);
}

async function handleDebugFind(apiToken: string, body: any) {
  const { field_id, value } = body;
  const url = `/fb/subscriber/findByCustomField?field_id=${field_id}&field_value=${encodeURIComponent(value || "")}`;
  const fullUrl = `${MC_API_BASE}${url}`;
  const response = await fetch(fullUrl, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${apiToken}`,
      Accept: "application/json",
    },
  });
  const rawText = await response.text();
  let parsed = null;
  try {
    parsed = JSON.parse(rawText);
  } catch { /* not json */ }
  return jsonResponse({
    _version: FUNCTION_VERSION,
    _debug: {
      full_url: fullUrl,
      field_id,
      field_value_sent: value,
      encoded_value: encodeURIComponent(value || ""),
      http_status: response.status,
      response_headers: Object.fromEntries(response.headers.entries()),
      raw_response: rawText.substring(0, 2000),
      parsed_response: parsed,
      token_length: apiToken.length,
      token_prefix: apiToken.substring(0, 5),
    },
  }, 200);
}

function mcGet(apiToken: string, path: string) {
  return fetch(`${MC_API_BASE}${path}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${apiToken}`,
      Accept: "application/json",
    },
  });
}

function mcPost(apiToken: string, path: string, data: unknown) {
  return fetch(`${MC_API_BASE}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiToken}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(data),
  });
}

function jsonResponse(data: unknown, status: number) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
