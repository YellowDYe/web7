import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.53.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface IMSSRequest {
  payload: string;
  credential_id: string;
  registro_patronal: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { payload, credential_id, registro_patronal }: IMSSRequest =
      await req.json();

    if (!payload || !credential_id || !registro_patronal) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: payload, credential_id, registro_patronal" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch IDSE credentials from database
    const { data: credential, error: credError } = await supabase
      .from("idse_credentials")
      .select("*")
      .eq("id", credential_id)
      .maybeSingle();

    if (credError || !credential) {
      return new Response(
        JSON.stringify({ error: "IDSE credential not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build the SOAP envelope for IMSS/IDSE submission
    const timestamp = new Date().toISOString();
    const batchNumber = `BATCH-${Date.now()}`;

    // IDSE SOAP endpoint (production)
    const idseUrl = "https://idse.imss.gob.mx/PortalIDSE/IDSE/Movimientos/MovimientosAfiliatorios";

    const soapEnvelope = buildSOAPEnvelope(
      payload,
      registro_patronal,
      credential.certificado_serial || "",
      timestamp
    );

    // Submit to IMSS IDSE web service
    const idseResponse = await fetch(idseUrl, {
      method: "POST",
      headers: {
        "Content-Type": "text/xml; charset=utf-8",
        "SOAPAction": "http://www.imss.gob.mx/IDSE/Movimientos",
      },
      body: soapEnvelope,
    });

    const responseText = await idseResponse.text();

    if (!idseResponse.ok) {
      // IMSS may be unreachable or certificate invalid
      // Store attempt and return error for manual retry
      return new Response(
        JSON.stringify({
          error: `IMSS IDSE responded with status ${idseResponse.status}`,
          raw_response: responseText.substring(0, 2000),
        }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse SOAP response to extract acuse
    const acuseXml = extractAcuseFromResponse(responseText);
    const acuseNumber = extractAcuseNumber(responseText);
    const { accepted, rejected } = extractMovementCounts(responseText);

    return new Response(
      JSON.stringify({
        success: true,
        batch_number: batchNumber,
        acuse_xml: acuseXml,
        acuse_number: acuseNumber,
        accepted,
        rejected,
        raw_response: responseText.substring(0, 5000),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function buildSOAPEnvelope(
  payload: string,
  registroPatronal: string,
  certificateSerial: string,
  timestamp: string
): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
  xmlns:mov="http://www.imss.gob.mx/IDSE/Movimientos">
  <soapenv:Header>
    <wsse:Security xmlns:wsse="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd">
      <wsu:Timestamp xmlns:wsu="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd">
        <wsu:Created>${timestamp}</wsu:Created>
      </wsu:Timestamp>
      <wsse:BinarySecurityToken
        EncodingType="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-soap-message-security-1.0#Base64Binary"
        ValueType="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-x509-token-profile-1.0#X509v3">
        ${certificateSerial}
      </wsse:BinarySecurityToken>
    </wsse:Security>
  </soapenv:Header>
  <soapenv:Body>
    <mov:EnviarMovimientos>
      <mov:registroPatronal>${registroPatronal}</mov:registroPatronal>
      <mov:contenido>${payload}</mov:contenido>
    </mov:EnviarMovimientos>
  </soapenv:Body>
</soapenv:Envelope>`;
}

function extractAcuseFromResponse(xml: string): string {
  const match = xml.match(/<acuse[^>]*>([\s\S]*?)<\/acuse>/i);
  return match ? match[0] : "";
}

function extractAcuseNumber(xml: string): string {
  const match = xml.match(/<numeroAcuse[^>]*>([^<]+)<\/numeroAcuse>/i) ||
    xml.match(/<acuseRecibo[^>]*>([^<]+)<\/acuseRecibo>/i);
  return match ? match[1] : "";
}

function extractMovementCounts(xml: string): { accepted: number; rejected: number } {
  const acceptedMatch = xml.match(/<movimientosAceptados[^>]*>(\d+)<\/movimientosAceptados>/i);
  const rejectedMatch = xml.match(/<movimientosRechazados[^>]*>(\d+)<\/movimientosRechazados>/i);
  return {
    accepted: acceptedMatch ? parseInt(acceptedMatch[1]) : 0,
    rejected: rejectedMatch ? parseInt(rejectedMatch[1]) : 0,
  };
}
