import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import JSZip from "npm:jszip@3.10.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

async function blobToBinaryString(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return binary;
}

interface QueryRequest {
  action:
    | "validate-fiel"
    | "query"
    | "verify"
    | "download"
    | "download-zip"
    | "get-config-status"
    | "backfill-taxes";
  dateStart?: string;
  dateEnd?: string;
  downloadType?: "emitidos" | "recibidos";
  requestType?: "metadata" | "xml";
  documentStatus?: "active" | "cancelled" | "undefined";
  requestId?: string;
  packageIds?: string[];
  packageId?: string;
  cerBase64?: string;
  keyBase64?: string;
  password?: string;
}

function extractXmlAttribute(xml: string, tag: string, attr: string): string {
  const tagPattern = new RegExp(`<[^>]*?${tag}[^>]*?>`, "i");
  const tagMatch = xml.match(tagPattern);
  if (!tagMatch) return "";
  const attrPattern = new RegExp(`${attr}="([^"]*)"`, "i");
  const attrMatch = tagMatch[0].match(attrPattern);
  return attrMatch ? attrMatch[1] : "";
}

function parseCfdiTaxes(xmlContent: string) {
  let ivaTrasladado: number | null = null;
  let isrRetenido: number | null = null;
  let ivaRetenido: number | null = null;
  let iepsTrasladado: number | null = null;

  // Find the comprobante-level Impuestos node (not concept-level)
  // The comprobante-level node is a direct child of cfdi:Comprobante, after cfdi:Conceptos
  const impuestosPattern = /<(?:cfdi:)?Impuestos[^>]*>[\s\S]*?<\/(?:cfdi:)?Impuestos>/gi;
  const matches = xmlContent.match(impuestosPattern);
  if (!matches || matches.length === 0) return { ivaTrasladado, isrRetenido, ivaRetenido, iepsTrasladado };

  // The last Impuestos block is the comprobante-level one (concept-level ones come first)
  const impuestosBlock = matches[matches.length - 1];

  // Extract Traslados (taxes charged)
  const trasladosPattern = /<(?:cfdi:)?Traslado[^/]*?Impuesto="([^"]*)"[^/]*?Importe="([^"]*)"[^/]*?\/?>/gi;
  let match;
  while ((match = trasladosPattern.exec(impuestosBlock)) !== null) {
    const impuesto = match[1];
    const importe = parseFloat(match[2] || "0");
    if (impuesto === "002") ivaTrasladado = (ivaTrasladado || 0) + importe;
    else if (impuesto === "003") iepsTrasladado = (iepsTrasladado || 0) + importe;
  }

  // Extract Retenciones (taxes withheld)
  const retencionesPattern = /<(?:cfdi:)?Retencion[^/]*?Impuesto="([^"]*)"[^/]*?Importe="([^"]*)"[^/]*?\/?>/gi;
  while ((match = retencionesPattern.exec(impuestosBlock)) !== null) {
    const impuesto = match[1];
    const importe = parseFloat(match[2] || "0");
    if (impuesto === "001") isrRetenido = (isrRetenido || 0) + importe;
    else if (impuesto === "002") ivaRetenido = (ivaRetenido || 0) + importe;
  }

  // Fallback: use TotalImpuestosTrasladados/TotalImpuestosRetenidos attributes
  if (ivaTrasladado === null && iepsTrasladado === null) {
    const totalTrasladados = extractXmlAttribute(impuestosBlock, "Impuestos", "TotalImpuestosTrasladados");
    if (totalTrasladados) ivaTrasladado = parseFloat(totalTrasladados);
  }

  return { ivaTrasladado, isrRetenido, ivaRetenido, iepsTrasladado };
}

function parseCfdiXml(xmlContent: string) {
  const rfcEmisor = extractXmlAttribute(xmlContent, "cfdi:Emisor", "Rfc") ||
    extractXmlAttribute(xmlContent, "Emisor", "Rfc");
  const nombreEmisor = extractXmlAttribute(xmlContent, "cfdi:Emisor", "Nombre") ||
    extractXmlAttribute(xmlContent, "Emisor", "Nombre");
  const rfcReceptor = extractXmlAttribute(xmlContent, "cfdi:Receptor", "Rfc") ||
    extractXmlAttribute(xmlContent, "Receptor", "Rfc");
  const nombreReceptor = extractXmlAttribute(xmlContent, "cfdi:Receptor", "Nombre") ||
    extractXmlAttribute(xmlContent, "Receptor", "Nombre");

  const total = extractXmlAttribute(xmlContent, "cfdi:Comprobante", "Total") ||
    extractXmlAttribute(xmlContent, "Comprobante", "Total");
  const subtotal = extractXmlAttribute(xmlContent, "cfdi:Comprobante", "SubTotal") ||
    extractXmlAttribute(xmlContent, "Comprobante", "SubTotal");
  const fecha = extractXmlAttribute(xmlContent, "cfdi:Comprobante", "Fecha") ||
    extractXmlAttribute(xmlContent, "Comprobante", "Fecha");
  const tipoComprobante = extractXmlAttribute(xmlContent, "cfdi:Comprobante", "TipoDeComprobante") ||
    extractXmlAttribute(xmlContent, "Comprobante", "TipoDeComprobante");
  const metodoPago = extractXmlAttribute(xmlContent, "cfdi:Comprobante", "MetodoPago") ||
    extractXmlAttribute(xmlContent, "Comprobante", "MetodoPago");
  const formaPago = extractXmlAttribute(xmlContent, "cfdi:Comprobante", "FormaPago") ||
    extractXmlAttribute(xmlContent, "Comprobante", "FormaPago");
  const moneda = extractXmlAttribute(xmlContent, "cfdi:Comprobante", "Moneda") ||
    extractXmlAttribute(xmlContent, "Comprobante", "Moneda");

  const uuidFromTfd = extractXmlAttribute(xmlContent, "tfd:TimbreFiscalDigital", "UUID") ||
    extractXmlAttribute(xmlContent, "TimbreFiscalDigital", "UUID");

  const taxes = parseCfdiTaxes(xmlContent);

  return {
    rfc_emisor: rfcEmisor,
    nombre_emisor: nombreEmisor,
    rfc_receptor: rfcReceptor,
    nombre_receptor: nombreReceptor,
    total: parseFloat(total || "0"),
    subtotal: parseFloat(subtotal || "0"),
    fecha_emision: fecha || null,
    tipo_comprobante: tipoComprobante,
    metodo_pago: metodoPago,
    forma_pago: formaPago,
    moneda: moneda || "MXN",
    uuid_from_tfd: uuidFromTfd,
    iva_trasladado: taxes.ivaTrasladado,
    isr_retenido: taxes.isrRetenido,
    iva_retenido: taxes.ivaRetenido,
    ieps_trasladado: taxes.iepsTrasladado,
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "No authorization header" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user },
      error: authError,
    } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body: QueryRequest = await req.json();

    switch (body.action) {
      case "get-config-status": {
        const { data: config } = await supabase
          .from("sat_efirma_config")
          .select("id, rfc, is_active, expires_at, created_at, updated_at")
          .eq("is_active", true)
          .maybeSingle();

        return new Response(
          JSON.stringify({
            configured: !!config,
            config: config
              ? {
                  rfc: config.rfc,
                  isActive: config.is_active,
                  expiresAt: config.expires_at,
                  updatedAt: config.updated_at,
                }
              : null,
          }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      case "validate-fiel": {
        if (!body.cerBase64 || !body.keyBase64 || !body.password) {
          return new Response(
            JSON.stringify({
              error:
                "Se requieren los archivos .cer, .key y la contrasena",
            }),
            {
              status: 400,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }

        // Import the SAT library dynamically
        const {
          Fiel,
        } = await import("npm:@nodecfdi/sat-ws-descarga-masiva@2.0.0");

        try {
          const cerContent = atob(body.cerBase64);
          const keyContent = atob(body.keyBase64);

          const fiel = Fiel.create(cerContent, keyContent, body.password);

          if (!fiel.isValid()) {
            return new Response(
              JSON.stringify({
                valid: false,
                error:
                  "La e.firma no es valida. Puede estar expirada o ser un CSD en lugar de FIEL.",
              }),
              {
                headers: {
                  ...corsHeaders,
                  "Content-Type": "application/json",
                },
              }
            );
          }

          const rfc = fiel.getRfc();

          return new Response(
            JSON.stringify({
              valid: true,
              rfc,
            }),
            {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        } catch (e: unknown) {
          const errorMsg =
            e instanceof Error ? e.message : "Error desconocido al validar la e.firma";
          return new Response(
            JSON.stringify({ valid: false, error: errorMsg }),
            {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }
      }

      case "query": {
        if (!body.dateStart || !body.dateEnd) {
          return new Response(
            JSON.stringify({ error: "Se requieren fechas de inicio y fin" }),
            {
              status: 400,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }

        const { data: config } = await supabase
          .from("sat_efirma_config")
          .select("*")
          .eq("is_active", true)
          .maybeSingle();

        if (!config) {
          return new Response(
            JSON.stringify({
              error: "No hay configuracion de e.firma activa",
            }),
            {
              status: 400,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }

        // Download the .cer and .key files from storage
        const { data: cerData, error: cerError } = await supabase.storage
          .from("sat-efirma")
          .download(config.cer_file_path);
        const { data: keyData, error: keyError } = await supabase.storage
          .from("sat-efirma")
          .download(config.key_file_path);

        if (cerError || keyError || !cerData || !keyData) {
          return new Response(
            JSON.stringify({
              error: "No se pudieron leer los archivos de e.firma del almacenamiento",
            }),
            {
              status: 500,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }

        const {
          Fiel: FielClass,
          HttpsWebClient,
          FielRequestBuilder,
          Service,
          ServiceEndpoints,
          QueryParameters,
          DateTimePeriod,
          DownloadType,
          RequestType,
          DocumentStatus,
        } = await import("npm:@nodecfdi/sat-ws-descarga-masiva@2.0.0");

        const cerText = await blobToBinaryString(cerData);
        const keyText = await blobToBinaryString(keyData);

        let fiel;
        try {
          fiel = FielClass.create(cerText, keyText, config.fiel_password);
          if (!fiel.isValid()) {
            return new Response(
              JSON.stringify({
                error:
                  "La e.firma almacenada ya no es valida o esta expirada",
              }),
              {
                status: 400,
                headers: {
                  ...corsHeaders,
                  "Content-Type": "application/json",
                },
              }
            );
          }
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : "Error al cargar e.firma";
          return new Response(JSON.stringify({ error: msg }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const webClient = new HttpsWebClient();
        const requestBuilder = new FielRequestBuilder(fiel);
        const service = new Service(
          requestBuilder,
          webClient,
          undefined,
          ServiceEndpoints.cfdi()
        );

        const downloadType =
          body.downloadType === "recibidos"
            ? new DownloadType("received")
            : new DownloadType("issued");
        const requestType =
          body.requestType === "xml"
            ? new RequestType("xml")
            : new RequestType("metadata");

        // For XML requests, SAT requires filtering to only active (vigente) documents
        let docStatus: string;
        if (body.documentStatus && body.documentStatus !== "undefined") {
          docStatus = body.documentStatus;
        } else if (body.requestType === "xml") {
          docStatus = "active";
        } else {
          docStatus = "undefined";
        }

        let parameters = QueryParameters.create(
          DateTimePeriod.createFromValues(body.dateStart, body.dateEnd)
        )
          .withDownloadType(downloadType)
          .withRequestType(requestType);

        if (docStatus !== "undefined") {
          parameters = parameters.withDocumentStatus(new DocumentStatus(docStatus));
        }

        const queryResult = await service.query(parameters);

        if (!queryResult.getStatus().isAccepted()) {
          // Save failed request to DB
          await supabase.from("sat_download_requests").insert({
            date_start: body.dateStart,
            date_end: body.dateEnd,
            download_type: body.downloadType || "emitidos",
            request_type: body.requestType || "metadata",
            status: "failed",
            error_message: queryResult.getStatus().getMessage(),
            created_by: user.id,
          });

          return new Response(
            JSON.stringify({
              success: false,
              error: `Fallo al presentar la consulta: ${queryResult.getStatus().getMessage()}`,
            }),
            {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }

        const satRequestId = queryResult.getRequestId();

        // Save successful request to DB
        const { data: insertedRequest } = await supabase
          .from("sat_download_requests")
          .insert({
            request_id: satRequestId,
            date_start: body.dateStart,
            date_end: body.dateEnd,
            download_type: body.downloadType || "emitidos",
            request_type: body.requestType || "metadata",
            status: "processing",
            created_by: user.id,
          })
          .select()
          .single();

        return new Response(
          JSON.stringify({
            success: true,
            requestId: satRequestId,
            dbRequestId: insertedRequest?.id,
            message: `Solicitud enviada al SAT con ID: ${satRequestId}`,
          }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      case "verify": {
        if (!body.requestId) {
          return new Response(
            JSON.stringify({ error: "Se requiere el requestId" }),
            {
              status: 400,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }

        const { data: config } = await supabase
          .from("sat_efirma_config")
          .select("*")
          .eq("is_active", true)
          .maybeSingle();

        if (!config) {
          return new Response(
            JSON.stringify({ error: "No hay configuracion de e.firma activa" }),
            {
              status: 400,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }

        const { data: cerData } = await supabase.storage
          .from("sat-efirma")
          .download(config.cer_file_path);
        const { data: keyData } = await supabase.storage
          .from("sat-efirma")
          .download(config.key_file_path);

        if (!cerData || !keyData) {
          return new Response(
            JSON.stringify({ error: "No se pudieron leer archivos e.firma" }),
            {
              status: 500,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }

        const {
          Fiel: FielVerify,
          HttpsWebClient: HttpsWebClientVerify,
          FielRequestBuilder: FielRequestBuilderVerify,
          Service: ServiceVerify,
          ServiceEndpoints: ServiceEndpointsVerify,
        } = await import("npm:@nodecfdi/sat-ws-descarga-masiva@2.0.0");

        const cerText = await blobToBinaryString(cerData);
        const keyText = await blobToBinaryString(keyData);
        const fiel = FielVerify.create(cerText, keyText, config.fiel_password);
        const webClient = new HttpsWebClientVerify();
        const requestBuilder = new FielRequestBuilderVerify(fiel);
        const service = new ServiceVerify(
          requestBuilder,
          webClient,
          undefined,
          ServiceEndpointsVerify.cfdi()
        );

        const verify = await service.verify(body.requestId);

        if (!verify.getStatus().isAccepted()) {
          await supabase
            .from("sat_download_requests")
            .update({
              status: "failed",
              error_message: verify.getStatus().getMessage(),
              updated_at: new Date().toISOString(),
            })
            .eq("request_id", body.requestId);

          return new Response(
            JSON.stringify({
              success: false,
              status: "failed",
              error: verify.getStatus().getMessage(),
            }),
            {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }

        const statusRequest = verify.getStatusRequest();
        let status = "processing";

        if (
          statusRequest.isTypeOf("Expired") ||
          statusRequest.isTypeOf("Failure") ||
          statusRequest.isTypeOf("Rejected")
        ) {
          status = statusRequest.isTypeOf("Expired")
            ? "expired"
            : statusRequest.isTypeOf("Rejected")
            ? "rejected"
            : "failed";
        } else if (
          statusRequest.isTypeOf("InProgress") ||
          statusRequest.isTypeOf("Accepted")
        ) {
          status = "processing";
        } else if (statusRequest.isTypeOf("Finished")) {
          status = "finished";
        }

        const packageIds = verify.getPackageIds();
        const packagesCount = verify.countPackages();

        await supabase
          .from("sat_download_requests")
          .update({
            status,
            packages_count: packagesCount,
            package_ids: packageIds,
            updated_at: new Date().toISOString(),
          })
          .eq("request_id", body.requestId);

        return new Response(
          JSON.stringify({
            success: true,
            status,
            packagesCount,
            packageIds,
            message:
              status === "finished"
                ? `Listo. ${packagesCount} paquete(s) disponible(s) para descarga.`
                : status === "processing"
                ? "La solicitud sigue en proceso. Intenta verificar nuevamente en unos segundos."
                : `La solicitud termino con estado: ${status}`,
          }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      case "download": {
        if (!body.requestId || !body.packageIds || body.packageIds.length === 0) {
          return new Response(
            JSON.stringify({
              error: "Se requieren requestId y packageIds",
            }),
            {
              status: 400,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }

        const { data: config } = await supabase
          .from("sat_efirma_config")
          .select("*")
          .eq("is_active", true)
          .maybeSingle();

        if (!config) {
          return new Response(
            JSON.stringify({ error: "No hay configuracion de e.firma activa" }),
            {
              status: 400,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }

        const { data: cerData } = await supabase.storage
          .from("sat-efirma")
          .download(config.cer_file_path);
        const { data: keyData } = await supabase.storage
          .from("sat-efirma")
          .download(config.key_file_path);

        if (!cerData || !keyData) {
          return new Response(
            JSON.stringify({ error: "No se pudieron leer archivos e.firma" }),
            {
              status: 500,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }

        const satLib = await import(
          "npm:@nodecfdi/sat-ws-descarga-masiva@2.0.0"
        );

        const cerText = await blobToBinaryString(cerData);
        const keyText = await blobToBinaryString(keyData);
        const fiel = satLib.Fiel.create(cerText, keyText, config.fiel_password);
        const webClient = new satLib.HttpsWebClient();
        const requestBuilder = new satLib.FielRequestBuilder(fiel);
        const service = new satLib.Service(
          requestBuilder,
          webClient,
          undefined,
          satLib.ServiceEndpoints.cfdi()
        );

        // Get the DB request to know the request_type
        const { data: dbRequest } = await supabase
          .from("sat_download_requests")
          .select("*")
          .eq("request_id", body.requestId)
          .maybeSingle();

        let totalCfdis = 0;
        const errors: string[] = [];

        for (const packageId of body.packageIds) {
          try {
            const download = await service.download(packageId);
            if (!download.getStatus().isAccepted()) {
              errors.push(
                `Paquete ${packageId}: ${download.getStatus().getMessage()}`
              );
              continue;
            }

            const packageContent = download.getPackageContent();
            const zipBytes = Uint8Array.from(atob(packageContent), c => c.charCodeAt(0));
            const zip = await JSZip.loadAsync(zipBytes);

            // Store the raw zip in Supabase Storage for later download
            const zipStoragePath = `packages/${dbRequest?.id}/${packageId}.zip`;
            await supabase.storage
              .from("sat-efirma")
              .upload(zipStoragePath, zipBytes, {
                contentType: "application/zip",
                upsert: true,
              });

            if (dbRequest?.request_type === "metadata") {
              for (const [filename, zipEntry] of Object.entries(zip.files)) {
                if ((zipEntry as JSZip.JSZipObject).dir) continue;
                if (!filename.toLowerCase().endsWith(".txt")) continue;

                const csvText = await (zipEntry as JSZip.JSZipObject).async("text");
                const lines = csvText.split(/\r?\n/).filter(l => l.trim() !== "");
                if (lines.length < 2) continue;

                const headers = lines[0].split("~");
                const normalizedHeaders = headers.map(h => h.charAt(0).toLowerCase() + h.slice(1));

                for (let i = 1; i < lines.length; i++) {
                  const values = lines[i].split("~");
                  const record: Record<string, string> = {};
                  for (let j = 0; j < normalizedHeaders.length; j++) {
                    record[normalizedHeaders[j]] = values[j] || "";
                  }

                  const cfdiData = {
                    uuid_cfdi: record["uuid"] || "",
                    rfc_emisor: record["rfcEmisor"] || "",
                    nombre_emisor: record["nombreEmisor"] || "",
                    rfc_receptor: record["rfcReceptor"] || "",
                    nombre_receptor: record["nombreReceptor"] || "",
                    fecha_emision: record["fechaEmision"] || null,
                    fecha_certificacion: record["fechaCertificacion"] || null,
                    tipo_comprobante: record["tipoComprobante"] || "",
                    efecto: record["efecto"] || "",
                    total: parseFloat(record["total"] || "0"),
                    subtotal: parseFloat(record["subtotal"] || "0"),
                    metodo_pago: record["metodoPago"] || "",
                    forma_pago: record["formaPago"] || "",
                    moneda: record["moneda"] || "MXN",
                    estado: record["estado"] === "0" ? "cancelado" : "vigente",
                    fecha_cancelacion: record["fechaCancelacion"] || null,
                    download_request_id: dbRequest?.id,
                  };

                  if (cfdiData.uuid_cfdi) {
                    await supabase
                      .from("sat_cfdis")
                      .upsert(cfdiData, { onConflict: "uuid_cfdi" });
                    totalCfdis++;
                  }
                }
              }
            } else {
              for (const [filename, zipEntry] of Object.entries(zip.files)) {
                if ((zipEntry as JSZip.JSZipObject).dir) continue;
                if (!filename.toLowerCase().endsWith(".xml")) continue;

                const xmlContent = await (zipEntry as JSZip.JSZipObject).async("text");
                const baseName = filename.split("/").pop() || filename;
                const fileUuid = baseName.replace(/\.xml$/i, "");
                const storagePath = `cfdis/${dbRequest?.id}/${baseName}`;

                // Parse XML to extract CFDI metadata
                const parsed = parseCfdiXml(xmlContent);
                const uuid = parsed.uuid_from_tfd || fileUuid;

                await supabase.storage
                  .from("sat-efirma")
                  .upload(storagePath, xmlContent, {
                    contentType: "application/xml",
                    upsert: true,
                  });

                await supabase.from("sat_cfdis").upsert(
                  {
                    uuid_cfdi: uuid,
                    rfc_emisor: parsed.rfc_emisor || null,
                    nombre_emisor: parsed.nombre_emisor || null,
                    rfc_receptor: parsed.rfc_receptor || null,
                    nombre_receptor: parsed.nombre_receptor || null,
                    fecha_emision: parsed.fecha_emision,
                    tipo_comprobante: parsed.tipo_comprobante || null,
                    total: parsed.total,
                    subtotal: parsed.subtotal,
                    metodo_pago: parsed.metodo_pago || null,
                    forma_pago: parsed.forma_pago || null,
                    moneda: parsed.moneda,
                    estado: "vigente",
                    xml_storage_path: storagePath,
                    download_request_id: dbRequest?.id,
                    iva_trasladado: parsed.iva_trasladado,
                    isr_retenido: parsed.isr_retenido,
                    iva_retenido: parsed.iva_retenido,
                    ieps_trasladado: parsed.ieps_trasladado,
                  },
                  { onConflict: "uuid_cfdi" }
                );
                totalCfdis++;
              }
            }
          } catch (pkgError: unknown) {
            const msg = pkgError instanceof Error ? pkgError.message : String(pkgError);
            errors.push(`Paquete ${packageId}: ${msg}`);
          }
        }

        // Update the request with final count
        await supabase
          .from("sat_download_requests")
          .update({
            cfdis_count: totalCfdis,
            status: errors.length > 0 && totalCfdis === 0 ? "failed" : "finished",
            error_message: errors.length > 0 ? errors.join("; ") : null,
            updated_at: new Date().toISOString(),
          })
          .eq("request_id", body.requestId);

        return new Response(
          JSON.stringify({
            success: true,
            totalCfdis,
            errors: errors.length > 0 ? errors : undefined,
            message: `Se procesaron ${totalCfdis} CFDI(s) exitosamente.${
              errors.length > 0
                ? ` ${errors.length} paquete(s) con error.`
                : ""
            }`,
          }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      case "download-zip": {
        if (!body.requestId || !body.packageId) {
          return new Response(
            JSON.stringify({ error: "Se requieren requestId y packageId" }),
            {
              status: 400,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }

        const { data: dbReq } = await supabase
          .from("sat_download_requests")
          .select("id")
          .eq("request_id", body.requestId)
          .maybeSingle();

        if (!dbReq) {
          return new Response(
            JSON.stringify({ error: "Solicitud no encontrada" }),
            {
              status: 404,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }

        const zipPath = `packages/${dbReq.id}/${body.packageId}.zip`;
        const { data: signedUrlData, error: signedUrlError } = await supabase.storage
          .from("sat-efirma")
          .createSignedUrl(zipPath, 300);

        if (signedUrlError || !signedUrlData?.signedUrl) {
          return new Response(
            JSON.stringify({ error: "No se encontro el archivo zip. Puede que necesites volver a descargar los paquetes." }),
            {
              status: 404,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }

        return new Response(
          JSON.stringify({
            success: true,
            url: signedUrlData.signedUrl,
          }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      case "backfill-taxes": {
        // Re-parse all stored XMLs to populate tax columns and correct totals
        const { data: cfdisToBackfill, error: fetchErr } = await supabase
          .from("sat_cfdis")
          .select("id, xml_storage_path")
          .not("xml_storage_path", "is", null)
          .limit(200);

        if (fetchErr) {
          return new Response(
            JSON.stringify({ error: fetchErr.message }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        let updated = 0;
        const backfillErrors: string[] = [];

        for (const row of cfdisToBackfill || []) {
          try {
            const { data: fileData, error: dlErr } = await supabase.storage
              .from("sat-efirma")
              .download(row.xml_storage_path!);
            if (dlErr || !fileData) {
              backfillErrors.push(`${row.id}: download failed`);
              continue;
            }
            const xmlText = await fileData.text();
            const parsed = parseCfdiXml(xmlText);

            await supabase.from("sat_cfdis").update({
              subtotal: parsed.subtotal,
              total: parsed.total,
              iva_trasladado: parsed.iva_trasladado,
              isr_retenido: parsed.isr_retenido,
              iva_retenido: parsed.iva_retenido,
              ieps_trasladado: parsed.ieps_trasladado,
            }).eq("id", row.id);

            updated++;
          } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            backfillErrors.push(`${row.id}: ${msg}`);
          }
        }

        return new Response(
          JSON.stringify({
            success: true,
            updated,
            remaining: (cfdisToBackfill?.length || 0) - updated,
            errors: backfillErrors.length > 0 ? backfillErrors : undefined,
            message: `Actualizados ${updated} CFDIs con datos fiscales del XML.`,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      default:
        return new Response(
          JSON.stringify({ error: "Accion no reconocida" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
    }
  } catch (error: unknown) {
    const errorMsg =
      error instanceof Error ? error.message : "Error interno del servidor";
    return new Response(JSON.stringify({ error: errorMsg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
