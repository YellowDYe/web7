import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.53.0";
import { extractText } from "npm:unpdf@0.12.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface GmailMessage {
  id: string;
  threadId: string;
  payload: {
    headers: { name: string; value: string }[];
    mimeType: string;
    body?: { data?: string; size: number };
    parts?: GmailPart[];
  };
  internalDate: string;
}

interface GmailPart {
  mimeType: string;
  filename?: string;
  body?: { attachmentId?: string; data?: string; size: number };
  parts?: GmailPart[];
}

interface ExtractedData {
  supplier_name?: string;
  supplier_rfc?: string;
  invoice_number?: string;
  invoice_date?: string;
  subtotal?: number;
  iva?: number;
  isr?: number;
  total?: number;
  currency?: string;
  description?: string;
  confidence: number;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const debugMode = url.searchParams.get("debug") === "true";
    const forceIds = url.searchParams.get("force_ids");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Get Gmail config
    const { data: config, error: configError } = await supabase
      .from("gmail_config")
      .select("*")
      .limit(1)
      .maybeSingle();

    if (configError || !config) {
      return new Response(
        JSON.stringify({ error: "Gmail not configured" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!config.is_active || !config.refresh_token) {
      return new Response(
        JSON.stringify({ error: "Gmail integration is not active or not connected" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Refresh access token if expired
    let accessToken = config.access_token;
    const tokenExpiry = config.token_expiry ? new Date(config.token_expiry) : new Date(0);

    if (tokenExpiry <= new Date()) {
      const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: config.client_id,
          client_secret: config.client_secret,
          refresh_token: config.refresh_token,
          grant_type: "refresh_token",
        }),
      });

      if (!tokenResponse.ok) {
        const errBody = await tokenResponse.text();
        return new Response(
          JSON.stringify({ error: "Failed to refresh token", details: errBody }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const tokenData = await tokenResponse.json();
      accessToken = tokenData.access_token;
      const newExpiry = new Date(Date.now() + tokenData.expires_in * 1000).toISOString();

      await supabase
        .from("gmail_config")
        .update({
          access_token: accessToken,
          token_expiry: newExpiry,
          updated_at: new Date().toISOString(),
        })
        .eq("id", config.id);
    }

    // FORCE IDS MODE: process specific messages by ID (for debugging)
    if (forceIds) {
      const ids = forceIds.split(",").map((id) => id.trim()).filter(Boolean);
      const results: { id: string; status: string; detail: string }[] = [];

      for (const msgId of ids) {
        try {
          const msgUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msgId}?format=full`;
          const msgResponse = await fetch(msgUrl, {
            headers: { Authorization: `Bearer ${accessToken}` },
          });

          if (!msgResponse.ok) {
            results.push({ id: msgId, status: "fetch_failed", detail: `HTTP ${msgResponse.status}` });
            continue;
          }

          const fullMsg: GmailMessage = await msgResponse.json();
          const headers = fullMsg.payload.headers;
          const fromHeader = headers.find((h) => h.name.toLowerCase() === "from")?.value || "";
          const subject = headers.find((h) => h.name.toLowerCase() === "subject")?.value || "";
          const dateHeader = headers.find((h) => h.name.toLowerCase() === "date")?.value || "";

          const fromEmail = extractEmail(fromHeader);
          const fromName = extractName(fromHeader);
          const receivedAt = dateHeader ? new Date(dateHeader).toISOString() : new Date(parseInt(fullMsg.internalDate)).toISOString();

          // Check if already in DB
          const { data: existing } = await supabase
            .from("gmail_invoice_imports")
            .select("id, import_id")
            .eq("gmail_message_id", msgId)
            .maybeSingle();

          if (existing) {
            results.push({ id: msgId, status: "already_exists", detail: `import_id: ${existing.import_id}` });
            continue;
          }

          // Get next import_id
          const { data: lastImport } = await supabase
            .from("gmail_invoice_imports")
            .select("import_id")
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          let nextIdNum = 1;
          if (lastImport?.import_id) {
            const num = parseInt(lastImport.import_id.replace("GII", ""));
            if (!isNaN(num)) nextIdNum = num + 1;
          }

          // INSERT FIRST with skeleton data
          const importId = `GII${nextIdNum}`;
          const { error: insertError } = await supabase.from("gmail_invoice_imports").insert([{
            import_id: importId,
            gmail_message_id: msgId,
            gmail_thread_id: fullMsg.threadId,
            from_email: fromEmail,
            from_name: fromName,
            subject,
            received_at: receivedAt,
            source_type: "body",
            status: "pending",
            extracted_data: { confidence: 0, description: "Processing..." },
            raw_body_preview: null,
            attachment_filename: null,
          }]);

          if (insertError) {
            results.push({ id: msgId, status: "insert_failed", detail: insertError.message });
            continue;
          }

          // Phase 1: Extract body text (safe - no crash risk)
          let bodyText = "";
          try {
            bodyText = await getBodyText(fullMsg.payload, msgId, accessToken);
          } catch (bodyErr) {
            console.error(`Body text error for ${msgId}:`, bodyErr);
          }
          const bodyPreview = bodyText.length > 0 ? bodyText.substring(0, 4000) : null;
          let extractedData: ExtractedData = bodyText.length > 0 ? extractFromBody(bodyText) : { confidence: 0 };
          let sourceType: "body" | "pdf" | "xml" = "body";
          let attachmentFilename: string | null = null;

          // Persist body results immediately (survives if PDF parsing crashes later)
          await supabase
            .from("gmail_invoice_imports")
            .update({
              source_type: sourceType,
              extracted_data: extractedData,
              raw_body_preview: bodyPreview,
              updated_at: new Date().toISOString(),
            })
            .eq("gmail_message_id", msgId);

          // Phase 2: Try XML/PDF extraction (may crash for PDF)
          try {
            const extraction = await extractMessageData(fullMsg, msgId, accessToken);
            if (extraction.extractedData.confidence > extractedData.confidence) {
              extractedData = extraction.extractedData;
              sourceType = extraction.sourceType;
            }
            if (extraction.attachmentFilename) {
              attachmentFilename = extraction.attachmentFilename;
            }
          } catch (extractErr) {
            if (extractedData.confidence === 0) {
              extractedData = { description: `Extraction error: ${String(extractErr).substring(0, 200)}`, confidence: 0 };
            }
          }

          // Final update with best results
          const { error: updateError } = await supabase
            .from("gmail_invoice_imports")
            .update({
              source_type: sourceType,
              extracted_data: extractedData,
              raw_body_preview: bodyPreview,
              attachment_filename: attachmentFilename,
              updated_at: new Date().toISOString(),
            })
            .eq("gmail_message_id", msgId);

          results.push({
            id: msgId,
            status: updateError ? "inserted_update_failed" : "success",
            detail: `${importId} | from: ${fromEmail} | subject: ${subject} | source: ${sourceType} | body_len: ${bodyText.length}${updateError ? ` | update_err: ${updateError.message}` : ""}`,
          });
        } catch (err) {
          results.push({ id: msgId, status: "crash", detail: String(err).substring(0, 300) });
        }
      }

      return new Response(
        JSON.stringify({ force_mode: true, results }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch messages from Gmail within the last 30 days - paginate through all results
    const messages: { id: string; threadId: string }[] = [];
    let nextPageToken: string | undefined;
    let pageCount = 0;
    const debugPages: { page: number; messagesInPage: number; hasNextPage: boolean }[] = [];

    // Gmail search: only fetch emails likely to be invoices/receipts/billing
    const gmailQuery = "newer_than:30d {subject:(factura invoice receipt recibo pago payment billing statement cargo cobro suscripcion subscription pedido order compra purchase credit nota) has:attachment filename:pdf has:attachment filename:xml from:paypal from:stripe from:uber}";

    do {
      const params = new URLSearchParams({
        maxResults: "500",
        q: gmailQuery,
      });
      if (nextPageToken) {
        params.set("pageToken", nextPageToken);
      }
      const listUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages?${params.toString()}`;

      const listResponse = await fetch(listUrl, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!listResponse.ok) {
        const errBody = await listResponse.text();
        return new Response(
          JSON.stringify({ error: "Failed to fetch messages", details: errBody, debug_pages: debugPages }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const listData = await listResponse.json();
      const pageMessages: { id: string; threadId: string }[] = listData.messages || [];
      messages.push(...pageMessages);
      pageCount++;
      nextPageToken = listData.nextPageToken;
      debugPages.push({ page: pageCount, messagesInPage: pageMessages.length, hasNextPage: !!nextPageToken });
    } while (nextPageToken);

    // DEBUG MODE: Fetch subject/from for every message and return raw listing
    if (debugMode) {
      const debugMessages: { id: string; threadId: string; from: string; subject: string; date: string }[] = [];

      for (const msg of messages) {
        try {
          const msgUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`;
          const msgResponse = await fetch(msgUrl, {
            headers: { Authorization: `Bearer ${accessToken}` },
          });
          if (!msgResponse.ok) {
            debugMessages.push({ id: msg.id, threadId: msg.threadId, from: "FETCH_ERROR", subject: "FETCH_ERROR", date: "" });
            continue;
          }
          const msgData = await msgResponse.json();
          const hdrs = msgData.payload?.headers || [];
          const from = hdrs.find((h: { name: string; value: string }) => h.name.toLowerCase() === "from")?.value || "unknown";
          const subject = hdrs.find((h: { name: string; value: string }) => h.name.toLowerCase() === "subject")?.value || "no subject";
          const date = hdrs.find((h: { name: string; value: string }) => h.name.toLowerCase() === "date")?.value || "";
          debugMessages.push({ id: msg.id, threadId: msg.threadId, from, subject, date });
        } catch {
          debugMessages.push({ id: msg.id, threadId: msg.threadId, from: "ERROR", subject: "ERROR", date: "" });
        }
      }

      // Check which are already in database
      const allIds = messages.map((m) => m.id);
      const existingDbIds = await batchCheckExisting(supabase, allIds);

      // Check for Celonis specifically
      const celonisMessages = debugMessages.filter(
        (m) => m.from.toLowerCase().includes("celonis") || m.subject.toLowerCase().includes("celonis")
      );

      return new Response(
        JSON.stringify({
          debug: true,
          total_messages_from_api: messages.length,
          pages: debugPages,
          already_in_db: existingDbIds.size,
          would_be_new: messages.length - existingDbIds.size,
          celonis_found: celonisMessages.length > 0,
          celonis_messages: celonisMessages,
          all_messages: debugMessages.map((m) => ({
            id: m.id,
            from: m.from,
            subject: m.subject,
            date: m.date,
            already_imported: existingDbIds.has(m.id),
          })),
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (messages.length === 0) {
      await supabase
        .from("gmail_config")
        .update({ last_sync_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq("id", config.id);

      return new Response(
        JSON.stringify({ processed: 0, message: "No messages found" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check which messages have already been processed (batched to avoid URL limits)
    const messageIds = messages.map((m) => m.id);
    const existingIds = await batchCheckExisting(supabase, messageIds);
    const newMessages = messages.filter((m) => !existingIds.has(m.id));

    // Get next import_id
    const { data: lastImport } = await supabase
      .from("gmail_invoice_imports")
      .select("import_id")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    let nextIdNum = 1;
    if (lastImport?.import_id) {
      const num = parseInt(lastImport.import_id.replace("GII", ""));
      if (!isNaN(num)) nextIdNum = num + 1;
    }

    let processed = 0;
    const skipped: { id: string; reason: string }[] = [];
    const errors: { id: string; error: string }[] = [];
    const insertFailed: { id: string; error: string }[] = [];

    // Fetch discard rules to skip unwanted emails server-side
    const { data: discardRules } = await supabase
      .from("gmail_invoice_rules")
      .select("*")
      .eq("is_active", true);

    // Limit processing to 50 messages per run
    const messagesToProcess = newMessages.slice(0, 50);

    for (const msg of messagesToProcess) {
      try {
        // Fetch full message
        const msgUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=full`;
        const msgResponse = await fetch(msgUrl, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });

        if (!msgResponse.ok) {
          skipped.push({ id: msg.id, reason: `fetch_failed_${msgResponse.status}` });
          continue;
        }

        const fullMsg: GmailMessage = await msgResponse.json();
        const headers = fullMsg.payload.headers;
        const fromHeader = headers.find((h) => h.name.toLowerCase() === "from")?.value || "";
        const subject = headers.find((h) => h.name.toLowerCase() === "subject")?.value || "";
        const dateHeader = headers.find((h) => h.name.toLowerCase() === "date")?.value || "";

        const fromEmail = extractEmail(fromHeader);
        const fromName = extractName(fromHeader);
        const receivedAt = dateHeader ? new Date(dateHeader).toISOString() : new Date(parseInt(fullMsg.internalDate)).toISOString();

        // Check discard rules -- skip emails that match a discard rule
        const escapeForRegex = (str: string) =>
          str.replace(/([.+?^${}()|[\]\\])/g, "\\$1").replace(/\*/g, ".*");

        const matchedRule = (discardRules || []).find((rule: { sender_email_pattern: string; subject_pattern: string | null; rule_action: string; is_active: boolean }) => {
          if (!new RegExp(escapeForRegex(rule.sender_email_pattern), "i").test(fromEmail)) return false;
          if (rule.subject_pattern) {
            if (!new RegExp(escapeForRegex(rule.subject_pattern), "i").test(subject)) return false;
          }
          return true;
        });

        if (matchedRule && matchedRule.rule_action === "discard") {
          skipped.push({ id: msg.id, reason: `discard_rule:${matchedRule.sender_email_pattern}` });
          continue;
        }

        // Server-side relevance filter: skip emails that are clearly not invoices/receipts
        const hasAttachment = !!(findAttachment(fullMsg.payload, "application/pdf") ||
          findAttachment(fullMsg.payload, "application/xml") ||
          findAttachment(fullMsg.payload, "text/xml") ||
          findAttachmentByFilename(fullMsg.payload, ".pdf") ||
          findAttachmentByFilename(fullMsg.payload, ".xml"));

        if (!hasAttachment && !isLikelyInvoiceEmail(fromEmail, subject)) {
          skipped.push({ id: msg.id, reason: `not_invoice:${fromEmail}` });
          continue;
        }

        // INSERT SKELETON RECORD FIRST -- guarantees the message appears in the list
        const importId = `GII${nextIdNum++}`;
        const { error: insertError } = await supabase.from("gmail_invoice_imports").insert([{
          import_id: importId,
          gmail_message_id: msg.id,
          gmail_thread_id: msg.threadId,
          from_email: fromEmail,
          from_name: fromName,
          subject,
          received_at: receivedAt,
          source_type: "body",
          status: "pending",
          extracted_data: { confidence: 0 },
          raw_body_preview: null,
          attachment_filename: null,
        }]);

        if (insertError) {
          insertFailed.push({ id: msg.id, error: insertError.message });
          continue;
        }

        // Phase 1: Extract body text (safe - no crash risk)
        let bodyText = "";
        try {
          bodyText = await getBodyText(fullMsg.payload, msg.id, accessToken);
        } catch (bodyErr) {
          console.error(`Body text error for ${msg.id}:`, bodyErr);
        }
        const bodyPreview = bodyText.length > 0 ? bodyText.substring(0, 4000) : null;
        let extractedData: ExtractedData = bodyText.length > 0 ? extractFromBody(bodyText) : { confidence: 0 };
        let sourceType: "body" | "pdf" | "xml" = "body";
        let attachmentFilename: string | null = null;

        // Persist body results immediately (survives if PDF parsing crashes later)
        await supabase
          .from("gmail_invoice_imports")
          .update({
            source_type: sourceType,
            extracted_data: extractedData,
            raw_body_preview: bodyPreview,
            updated_at: new Date().toISOString(),
          })
          .eq("gmail_message_id", msg.id);

        // Phase 2: Try XML/PDF extraction (may crash for PDF)
        try {
          const extraction = await extractMessageData(fullMsg, msg.id, accessToken);
          if (extraction.extractedData.confidence > extractedData.confidence) {
            extractedData = extraction.extractedData;
            sourceType = extraction.sourceType;
            attachmentFilename = extraction.attachmentFilename;
            if (extraction.bodyPreview) {
              // PDF text overrides body preview only if better
            }
          }
          if (extraction.attachmentFilename) {
            attachmentFilename = extraction.attachmentFilename;
          }
        } catch (extractErr) {
          if (extractedData.confidence === 0) {
            extractedData = { description: `Extraction error: ${String(extractErr).substring(0, 200)}`, confidence: 0 };
          }
        }

        // Use sender-derived supplier name: override for known senders, fallback otherwise
        const senderSupplier = deriveSupplierFromSender(fromEmail, fromName);
        if (senderSupplier) {
          const isKnownSender = ["uber.com", "paypal.com", "stripe.com", "facebook.com", "mailchimp.com"]
            .some(domain => fromEmail.toLowerCase().includes(domain));
          if (isKnownSender || !extractedData.supplier_name) {
            extractedData.supplier_name = senderSupplier;
          }
        }

        // Final update with best results
        await supabase
          .from("gmail_invoice_imports")
          .update({
            source_type: sourceType,
            extracted_data: extractedData,
            raw_body_preview: bodyPreview,
            attachment_filename: attachmentFilename,
            updated_at: new Date().toISOString(),
          })
          .eq("gmail_message_id", msg.id);

        processed++;
      } catch (msgError) {
        errors.push({ id: msg.id, error: String(msgError).substring(0, 200) });
        console.error(`Error processing message ${msg.id}:`, msgError);
      }
    }

    // Update last sync time
    await supabase
      .from("gmail_config")
      .update({ last_sync_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("id", config.id);

    return new Response(
      JSON.stringify({
        processed,
        total_found: messages.length,
        new_messages: newMessages.length,
        processed_this_run: messagesToProcess.length,
        remaining: newMessages.length - messagesToProcess.length,
        skipped: skipped.length,
        skipped_details: skipped,
        insert_failures: insertFailed.length,
        insert_failure_details: insertFailed,
        errors: errors.length,
        error_details: errors,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Gmail sync error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error", details: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// --- Batch check existing message IDs (avoids URL length issues with large .in() queries) ---

async function batchCheckExisting(
  supabase: ReturnType<typeof createClient>,
  messageIds: string[]
): Promise<Set<string>> {
  const existingIds = new Set<string>();
  const BATCH_SIZE = 100;

  for (let i = 0; i < messageIds.length; i += BATCH_SIZE) {
    const batch = messageIds.slice(i, i + BATCH_SIZE);
    const { data, error } = await supabase
      .from("gmail_invoice_imports")
      .select("gmail_message_id")
      .in("gmail_message_id", batch);

    if (error) {
      console.error(`Batch check error at offset ${i}:`, error);
      continue;
    }
    (data || []).forEach((row: { gmail_message_id: string }) => existingIds.add(row.gmail_message_id));
  }

  return existingIds;
}

// --- Extract message data (PDF/XML/body) with timeout protection ---
// IMPORTANT: Body text is extracted FIRST (safe, no crash risk), then XML, then PDF last.
// pdf-parse can crash the Deno runtime, so body must be captured before attempting it.

async function extractMessageData(
  fullMsg: GmailMessage,
  msgId: string,
  accessToken: string
): Promise<{
  extractedData: ExtractedData;
  sourceType: "body" | "pdf" | "xml";
  attachmentFilename: string | null;
  bodyPreview: string | null;
}> {
  let extractedData: ExtractedData = { confidence: 0 };
  let sourceType: "body" | "pdf" | "xml" = "body";
  let attachmentFilename: string | null = null;
  let bodyPreview: string | null = null;

  // Collect part structure for diagnostics
  const partSummary: string[] = [];
  function summarizeParts(parts: GmailPart[], depth = 0) {
    for (const p of parts) {
      const hasData = !!p.body?.data;
      const hasAttId = !!p.body?.attachmentId;
      const size = p.body?.size || 0;
      partSummary.push(`${"  ".repeat(depth)}${p.mimeType} fn=${p.filename || ""} data=${hasData} attId=${hasAttId} size=${size}`);
      if (p.parts) summarizeParts(p.parts, depth + 1);
    }
  }
  if (fullMsg.payload.parts) summarizeParts(fullMsg.payload.parts);

  // STEP 1: Always extract body text FIRST (safe operation, no crash risk)
  const bodyText = await getBodyText(fullMsg.payload, msgId, accessToken);
  if (bodyText.length > 0) {
    bodyPreview = bodyText.substring(0, 4000);
    const bodyExtracted = extractFromBody(bodyText);
    if (bodyExtracted.confidence > 0) {
      extractedData = bodyExtracted;
      sourceType = "body";
    }
  }

  // STEP 2: Check for XML attachments (CFDI) - overrides body if found
  const xmlPart = findAttachment(fullMsg.payload, "application/xml") ||
    findAttachment(fullMsg.payload, "text/xml") ||
    findAttachmentByFilename(fullMsg.payload, ".xml");

  if (xmlPart && xmlPart.body) {
    let xmlBase64Data: string | null = null;

    if (xmlPart.body.data) {
      xmlBase64Data = xmlPart.body.data;
    } else if (xmlPart.body.attachmentId) {
      const attachUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msgId}/attachments/${xmlPart.body.attachmentId}`;
      const attachResponse = await fetch(attachUrl, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (attachResponse.ok) {
        const attachData = await attachResponse.json();
        xmlBase64Data = attachData.data;
      }
    }

    if (xmlBase64Data) {
      const xmlContent = base64UrlDecode(xmlBase64Data);
      const xmlExtracted = extractFromXml(xmlContent);
      if (xmlExtracted.confidence > extractedData.confidence) {
        extractedData = xmlExtracted;
        sourceType = "xml";
        attachmentFilename = xmlPart.filename || "factura.xml";
      }
    }
  }

  // STEP 3: Check for PDF attachments (risky - pdf-parse can crash runtime)
  // Only attempt if we don't already have high-confidence data
  if (extractedData.confidence < 0.5) {
    const pdfPart = findAttachment(fullMsg.payload, "application/pdf") ||
      findAttachmentByFilename(fullMsg.payload, ".pdf");

    if (pdfPart && pdfPart.body) {
      attachmentFilename = pdfPart.filename || "factura.pdf";

      if (pdfPart.body.size && pdfPart.body.size > 8 * 1024 * 1024) {
        if (extractedData.confidence === 0) {
          extractedData = {
            description: `PDF (too large to parse: ${Math.round(pdfPart.body.size / 1024 / 1024)}MB): ${pdfPart.filename}`,
            confidence: 0.1,
          };
        }
      } else {
        let pdfBase64Data: string | null = null;

        if (pdfPart.body.data) {
          pdfBase64Data = pdfPart.body.data;
        } else if (pdfPart.body.attachmentId) {
          const attachUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msgId}/attachments/${pdfPart.body.attachmentId}`;
          const attachResponse = await fetch(attachUrl, {
            headers: { Authorization: `Bearer ${accessToken}` },
          });
          if (attachResponse.ok) {
            const attachData = await attachResponse.json();
            pdfBase64Data = attachData.data;
          }
        }

        if (pdfBase64Data) {
          try {
            const pdfRawBytes = base64UrlToBuffer(pdfBase64Data);
            const pdfResult = await Promise.race([
              extractText(pdfRawBytes, { mergePages: true }),
              new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error("PDF parse timeout (15s)")), 15000)
              ),
            ]);
            const pdfText = (pdfResult.text as string) || "";

            if (pdfText.trim().length > 0) {
              const pdfExtracted = extractFromBody(pdfText);
              if (pdfExtracted.confidence > extractedData.confidence) {
                bodyPreview = pdfText.substring(0, 4000);
                extractedData = pdfExtracted;
                sourceType = "pdf";
                if (!extractedData.supplier_name) {
                  const firstLines = pdfText.split("\n").slice(0, 5).join(" ").trim();
                  if (firstLines.length > 2 && firstLines.length < 100) {
                    extractedData.supplier_name = firstLines.split("\n")[0].trim();
                  }
                }
              }
            }
          } catch (pdfErr) {
            console.error(`PDF parse error for ${pdfPart.filename}:`, pdfErr);
            if (extractedData.confidence === 0) {
              extractedData = {
                description: `PDF (parse error): ${pdfPart.filename} - ${String(pdfErr).substring(0, 100)}`,
                confidence: 0.1,
              };
            }
          }
        }
      }
    }
  }

  // If nothing was extracted, add diagnostic info
  if (extractedData.confidence === 0 && !bodyPreview) {
    extractedData.description = `No data extracted. Parts: ${partSummary.join(" | ").substring(0, 500)}`;
  }

  return { extractedData, sourceType, attachmentFilename, bodyPreview };
}

// --- Helper Functions ---

function deriveSupplierFromSender(fromEmail: string, fromName: string): string | null {
  // Known sender mappings
  const knownSenders: Record<string, string> = {
    "noreply@uber.com": "Uber",
    "uber.com": "Uber",
    "paypal.com": "PayPal",
    "stripe.com": "Stripe",
    "facebook.com": "Meta/Facebook",
    "mailchimp.com": "Mailchimp",
  };

  for (const [domain, name] of Object.entries(knownSenders)) {
    if (fromEmail.toLowerCase().includes(domain)) return name;
  }

  // Use fromName if it looks like a company (not generic like "noreply" or "no-reply")
  if (fromName && fromName.length > 2) {
    const cleaned = fromName
      .replace(/^recibos?\s+de\s+/i, "")
      .replace(/^factura(s|cion)?\s+de\s+/i, "")
      .replace(/^billing\s+/i, "")
      .replace(/^invoices?\s+from\s+/i, "")
      .trim();
    if (cleaned.length > 2 && !/^(no-?reply|info|support|admin|mail|notification)/i.test(cleaned)) {
      return cleaned.substring(0, 80);
    }
  }

  return null;
}

function isLikelyInvoiceEmail(fromEmail: string, subject: string): boolean {
  const lowerFrom = fromEmail.toLowerCase();
  const lowerSubject = subject.toLowerCase();

  // Known billing/invoice senders (always accept)
  const knownBillingSenders = [
    "paypal", "stripe", "invoice", "factura", "billing", "cobro",
    "noreply@uber.com", "business-updates.facebook.com", "mailchimp",
    "todocfdi", "maxiave",
  ];
  if (knownBillingSenders.some((s) => lowerFrom.includes(s))) return true;

  // Subject keywords that indicate an invoice/receipt/payment
  const invoiceKeywords = [
    "factura", "invoice", "receipt", "recibo", "pago", "payment",
    "billing", "statement", "cargo", "cobro", "suscripcion", "subscription",
    "pedido", "order", "compra", "purchase", "credit", "nota de credito",
    "transferencia", "fondos", "formato de pago", "pagó", "paid",
    "charge", "renewal", "renovacion", "plan", "precio", "price",
    "total", "amount due", "monto",
  ];
  if (invoiceKeywords.some((kw) => lowerSubject.includes(kw))) return true;

  return false;
}

function extractEmail(from: string): string {
  const match = from.match(/<([^>]+)>/);
  return match ? match[1] : from.trim();
}

function extractName(from: string): string {
  const match = from.match(/^"?([^"<]+)"?\s*</);
  return match ? match[1].trim() : extractEmail(from);
}

function base64UrlDecode(data: string): string {
  const base64 = data.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

function base64UrlToBuffer(data: string): Uint8Array {
  const base64 = data.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Parses a number string that may use either "." or "," as decimal separator.
 */
function parseLocalizedNumber(str: string): number {
  const cleaned = str.trim();
  const hasDot = cleaned.includes(".");
  const hasComma = cleaned.includes(",");

  if (hasDot && hasComma) {
    const lastDot = cleaned.lastIndexOf(".");
    const lastComma = cleaned.lastIndexOf(",");

    if (lastComma > lastDot) {
      return parseFloat(cleaned.replace(/\./g, "").replace(",", "."));
    } else {
      return parseFloat(cleaned.replace(/,/g, ""));
    }
  }

  if (hasComma && !hasDot) {
    const parts = cleaned.split(",");
    if (parts.length > 2) {
      return parseFloat(cleaned.replace(/,/g, ""));
    }
    if (parts.length === 2) {
      const afterComma = parts[1];
      if (afterComma.length === 3 && parseInt(parts[0]) >= 1) {
        return parseFloat(cleaned.replace(/,/g, ""));
      }
      return parseFloat(cleaned.replace(",", "."));
    }
    return parseFloat(cleaned.replace(",", "."));
  }

  if (hasDot && !hasComma) {
    const parts = cleaned.split(".");
    if (parts.length > 2) {
      return parseFloat(cleaned.replace(/\./g, ""));
    }
    if (parts.length === 2) {
      return parseFloat(cleaned);
    }
    return parseFloat(cleaned);
  }

  return parseFloat(cleaned);
}

function findAttachment(payload: GmailMessage["payload"], mimeType: string): GmailPart | null {
  function search(parts: GmailPart[]): GmailPart | null {
    for (const part of parts) {
      if (part.mimeType === mimeType && part.body && (part.body.attachmentId || part.body.data || part.body.size > 0)) return part;
      if (part.parts) {
        const found = search(part.parts);
        if (found) return found;
      }
    }
    return null;
  }
  if (payload.mimeType === mimeType && payload.body) return payload as unknown as GmailPart;
  return payload.parts ? search(payload.parts) : null;
}

function findAttachmentByFilename(payload: GmailMessage["payload"], extension: string): GmailPart | null {
  function search(parts: GmailPart[]): GmailPart | null {
    for (const part of parts) {
      if (part.filename && part.filename.toLowerCase().endsWith(extension) && part.body && (part.body.attachmentId || part.body.data || part.body.size > 0)) return part;
      if (part.parts) {
        const found = search(part.parts);
        if (found) return found;
      }
    }
    return null;
  }
  return payload.parts ? search(payload.parts) : null;
}

async function getBodyText(payload: GmailMessage["payload"], msgId: string, accessToken: string): Promise<string> {
  async function findText(parts: GmailPart[], mime: string): Promise<string | null> {
    for (const part of parts) {
      if (part.mimeType === mime && part.body) {
        if (part.body.data) {
          return base64UrlDecode(part.body.data);
        }
        if (part.body.attachmentId) {
          const attachUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msgId}/attachments/${part.body.attachmentId}`;
          const attachResponse = await fetch(attachUrl, {
            headers: { Authorization: `Bearer ${accessToken}` },
          });
          if (attachResponse.ok) {
            const attachData = await attachResponse.json();
            if (attachData.data) return base64UrlDecode(attachData.data);
          }
        }
      }
      if (part.parts) {
        const found = await findText(part.parts, mime);
        if (found) return found;
      }
    }
    return null;
  }

  // Top-level body (no multipart)
  if ((payload.mimeType === "text/plain" || payload.mimeType === "text/html") && payload.body?.data) {
    const decoded = base64UrlDecode(payload.body.data);
    if (payload.mimeType === "text/html") {
      return stripHtmlToText(decoded);
    }
    return decoded;
  }
  // Multipart: search parts recursively
  if (payload.parts) {
    const plain = await findText(payload.parts, "text/plain");
    if (plain) return plain;
    const html = await findText(payload.parts, "text/html");
    if (html) return stripHtmlToText(html);
  }
  return "";
}

function stripHtmlToText(html: string): string {
  let text = html;
  // Remove style blocks (including content)
  text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ");
  // Remove script blocks (including content)
  text = text.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ");
  // Remove HTML comments
  text = text.replace(/<!--[\s\S]*?-->/g, " ");
  // Replace <br>, <p>, <div>, <tr>, <li> with newlines for better structure
  text = text.replace(/<br\s*\/?>/gi, "\n");
  text = text.replace(/<\/(p|div|tr|li|h[1-6])>/gi, "\n");
  // Remove remaining HTML tags
  text = text.replace(/<[^>]*>/g, " ");
  // Decode common HTML entities
  text = text.replace(/&nbsp;/gi, " ");
  text = text.replace(/&amp;/gi, "&");
  text = text.replace(/&lt;/gi, "<");
  text = text.replace(/&gt;/gi, ">");
  text = text.replace(/&quot;/gi, '"');
  text = text.replace(/&#39;/gi, "'");
  text = text.replace(/&apos;/gi, "'");
  text = text.replace(/&#\d+;/g, " ");
  // Collapse whitespace (preserve newlines)
  text = text.replace(/[^\S\n]+/g, " ");
  text = text.replace(/\n\s*\n/g, "\n");
  return text.trim();
}

function extractFromXml(xmlContent: string): ExtractedData {
  const data: ExtractedData = { confidence: 0 };

  const rfcEmisor = xmlContent.match(/Rfc="([A-Z&]{12,13})"/i);
  const nombre = xmlContent.match(/cfdi:Emisor[^>]*Nombre="([^"]+)"/i) ||
    xmlContent.match(/Nombre="([^"]+)"[^>]*Rfc/i);
  const total = xmlContent.match(/Total="([0-9.]+)"/i);
  const subtotal = xmlContent.match(/SubTotal="([0-9.]+)"/i);
  const fecha = xmlContent.match(/Fecha="([^"]+)"/i);
  const folio = xmlContent.match(/Folio="([^"]+)"/i);
  const serie = xmlContent.match(/Serie="([^"]+)"/i);

  const ivaMatch = xmlContent.match(/Impuesto="002"[^>]*Importe="([0-9.]+)"/i) ||
    xmlContent.match(/Importe="([0-9.]+)"[^>]*Impuesto="002"/i);

  const isrMatch = xmlContent.match(/Impuesto="001"[^>]*Importe="([0-9.]+)"/i) ||
    xmlContent.match(/Importe="([0-9.]+)"[^>]*Impuesto="001"/i);

  if (rfcEmisor) data.supplier_rfc = rfcEmisor[1];
  if (nombre) data.supplier_name = nombre[1];
  if (total) data.total = parseFloat(total[1]);
  if (subtotal) data.subtotal = parseFloat(subtotal[1]);
  if (ivaMatch) data.iva = parseFloat(ivaMatch[1]);
  if (isrMatch) data.isr = parseFloat(isrMatch[1]);
  if (fecha) data.invoice_date = fecha[1].split("T")[0];
  if (folio) {
    data.invoice_number = serie ? `${serie[1]}${folio[1]}` : folio[1];
  }
  data.currency = xmlContent.match(/Moneda="([^"]+)"/i)?.[1] || "MXN";

  let fields = 0;
  if (data.supplier_rfc) fields++;
  if (data.supplier_name) fields++;
  if (data.total) fields++;
  if (data.subtotal) fields++;
  if (data.invoice_date) fields++;
  if (data.invoice_number) fields++;
  data.confidence = Math.min(fields / 5, 1);

  return data;
}

function extractFromBody(text: string): ExtractedData {
  const data: ExtractedData = { confidence: 0 };

  const rfcMatch = text.match(/[A-Z&]{3,4}\d{6}[A-Z0-9]{3}/);
  if (rfcMatch) data.supplier_rfc = rfcMatch[0];

  const amountPattern = /[\d]+(?:[.,]\d{3})*(?:[.,]\d{1,2})?/;

  const totalPatterns = [
    // "Total MXN 79.95" or "Total MXN 2,212.20" (no $ sign, just currency code + space + number)
    new RegExp(`total\\s+(?:MXN|USD|EUR)\\s+(${amountPattern.source})`, "i"),
    // "Total MXN$123.45" or "Total MXN $123.45"
    new RegExp(`total\\s*(?:MXN|USD|EUR)?\\s*\\$\\s*(${amountPattern.source})`, "i"),
    new RegExp(`total\\s*:?\\s*\\$?\\s*(${amountPattern.source})`, "i"),
    new RegExp(`monto\\s*total\\s*:?\\s*\\$?\\s*(${amountPattern.source})`, "i"),
    new RegExp(`importe\\s*:?\\s*\\$?\\s*(${amountPattern.source})`, "i"),
    new RegExp(`amount\\s*due\\s*:?\\s*\\$?\\s*(${amountPattern.source})`, "i"),
    new RegExp(`total\\s*amount\\s*:?\\s*\\$?\\s*(${amountPattern.source})`, "i"),
    new RegExp(`balance\\s*due\\s*:?\\s*\\$?\\s*(${amountPattern.source})`, "i"),
    new RegExp(`grand\\s*total\\s*:?\\s*\\$?\\s*(${amountPattern.source})`, "i"),
    // "$123.45 MXN" pattern
    new RegExp(`\\$\\s*(${amountPattern.source})\\s*(?:MXN|mxn)`, "i"),
  ];
  for (const pattern of totalPatterns) {
    const match = text.match(pattern);
    if (match) {
      const parsed = parseLocalizedNumber(match[1]);
      if (!isNaN(parsed) && parsed > 0) {
        data.total = parsed;
        break;
      }
    }
  }

  const ivaPatterns = [
    // "IVA MXN 12.34" (currency code + space + number, no $)
    new RegExp(`(?:iva|i\\.v\\.a\\.)\\s+(?:MXN|USD|EUR)\\s+(${amountPattern.source})`, "i"),
    new RegExp(`(?:iva|i\\.v\\.a\\.|vat|tax)\\s*:?\\s*\\$?\\s*(${amountPattern.source})`, "i"),
  ];
  for (const pattern of ivaPatterns) {
    const match = text.match(pattern);
    if (match) {
      const parsed = parseLocalizedNumber(match[1]);
      if (!isNaN(parsed) && parsed > 0) {
        data.iva = parsed;
        break;
      }
    }
  }

  const subtotalPatterns = [
    // "Subtotal del artículo MXN 2,239.75" or "Subtotal MXN 123.45"
    new RegExp(`subtotal(?:\\s+del\\s+art[ií]culo)?\\s+(?:MXN|USD|EUR)\\s+(${amountPattern.source})`, "i"),
    new RegExp(`subtotal\\s*:?\\s*\\$?\\s*(${amountPattern.source})`, "i"),
    new RegExp(`sub-total\\s*:?\\s*\\$?\\s*(${amountPattern.source})`, "i"),
  ];
  for (const pattern of subtotalPatterns) {
    const match = text.match(pattern);
    if (match) {
      const parsed = parseLocalizedNumber(match[1]);
      if (!isNaN(parsed) && parsed > 0) {
        data.subtotal = parsed;
        break;
      }
    }
  }

  const dateMatch = text.match(/(\d{4})-(\d{2})-(\d{2})/) ||
    text.match(/(\d{1,2})[/-](\d{1,2})[/-](\d{4})/) ||
    text.match(/(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+(\d{1,2}),?\s+(\d{4})/i) ||
    text.match(/(\d{1,2})\s+(?:de\s+)?(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\s+(?:de\s+)?(\d{4})/i);

  if (dateMatch) {
    if (dateMatch[0].match(/^\d{4}-/)) {
      data.invoice_date = dateMatch[0];
    } else if (dateMatch[1].match(/^[A-Za-z]/)) {
      const monthMap: Record<string, string> = {
        jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
        jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
      };
      const m = monthMap[dateMatch[1].substring(0, 3).toLowerCase()] || "01";
      data.invoice_date = `${dateMatch[3]}-${m}-${dateMatch[2].padStart(2, "0")}`;
    } else if (dateMatch[2] && dateMatch[2].match(/^[a-z]/i)) {
      const spanishMonthMap: Record<string, string> = {
        enero: "01", febrero: "02", marzo: "03", abril: "04", mayo: "05", junio: "06",
        julio: "07", agosto: "08", septiembre: "09", octubre: "10", noviembre: "11", diciembre: "12",
      };
      const m = spanishMonthMap[dateMatch[2].toLowerCase()] || "01";
      data.invoice_date = `${dateMatch[3]}-${m}-${dateMatch[1].padStart(2, "0")}`;
    } else {
      data.invoice_date = `${dateMatch[3]}-${dateMatch[2].padStart(2, "0")}-${dateMatch[1].padStart(2, "0")}`;
    }
  }

  // Invoice number: require a separator (no., #, :, number) and at least 3 alphanumeric chars
  const folioMatch = text.match(/(?:folio|factura|invoice)\s*(?:no\.?|#|:| number)\s*:?\s*([A-Z0-9][\w-]{2,})/i) ||
    text.match(/(?:recibo|nota)\s+(?:no\.?|#|:)\s*([A-Z0-9][\w-]{2,})/i);
  if (folioMatch) data.invoice_number = folioMatch[1];

  if (!data.supplier_rfc) {
    const companyMatch = text.match(/(?:from|bill\s*to|remitente|emisor)\s*:?\s*([A-Z][A-Za-z\s&.,]+?)(?:\n|$)/i) ||
      text.match(/(?:company|empresa|razón\s*social)\s*:?\s*([A-Z][A-Za-z\s&.,]+?)(?:\n|$)/i);
    if (companyMatch) {
      data.supplier_name = companyMatch[1].trim().substring(0, 80);
    }
  }

  if (text.match(/USD|\$\s*US|U\.S\.\s*Dollar/i)) {
    data.currency = "USD";
  } else if (text.match(/EUR|€/i)) {
    data.currency = "EUR";
  } else if (text.match(/MXN|pesos?\s*(?:mexicanos?)?/i)) {
    data.currency = "MXN";
  }

  let fields = 0;
  if (data.supplier_rfc || data.supplier_name) fields++;
  if (data.total) fields++;
  if (data.subtotal) fields++;
  if (data.invoice_date) fields++;
  if (data.invoice_number) fields++;
  data.confidence = Math.min(fields / 4, 1);

  return data;
}
