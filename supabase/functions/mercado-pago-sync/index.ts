import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.53.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

const MP_API_BASE = "https://api.mercadopago.com";

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
      .from("mercado_pago_config")
      .select("*")
      .maybeSingle();

    if (configErr) {
      return jsonResponse({ error: `Error loading config: ${configErr.message}` }, 500);
    }

    if (!config || !config.access_token) {
      return jsonResponse(
        { error: "Mercado Pago no esta configurado. Agrega tu Access Token en Configuraciones." },
        400
      );
    }

    const accessToken = config.access_token;

    switch (action) {
      case "test-connection":
        return await handleTestConnection(supabase, config, accessToken);

      case "sync":
        return await handleSync(supabase, config, accessToken, body);

      case "sync-outgoing":
        return await handleSyncOutgoing(supabase, config, accessToken, body);

      case "sync-withdrawals":
        return await handleSyncWithdrawals(supabase, config, accessToken, body);

      case "diagnose-payout":
        return await handleDiagnosePayout(accessToken, body);

      default:
        return jsonResponse({ error: `Accion no reconocida: ${action}` }, 400);
    }
  } catch (err: any) {
    console.error("Edge function error:", err);
    return jsonResponse({ error: err.message || "Error interno del servidor" }, 500);
  }
});

async function handleTestConnection(supabase: any, config: any, accessToken: string) {
  const response = await fetch(`${MP_API_BASE}/users/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    const errText = await response.text();
    return jsonResponse(
      { error: `Error de autenticacion (${response.status}). Verifica tu Access Token.`, details: errText },
      400
    );
  }

  const user = await response.json();
  const userId = String(user.id);

  await supabase
    .from("mercado_pago_config")
    .update({ user_id: userId, updated_at: new Date().toISOString() })
    .eq("id", config.id);

  return jsonResponse({
    success: true,
    user_id: userId,
    first_name: user.first_name || "",
    last_name: user.last_name || "",
    email: user.email || "",
  });
}

// ─── Incoming payments sync (existing logic) ───────────────────────────────

async function handleSync(supabase: any, config: any, accessToken: string, body: any) {
  const daysBack = body.days_back || 30;
  const now = new Date();
  const beginDate = new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000);

  const beginDateStr = beginDate.toISOString().split(".")[0] + ".000Z";
  const endDateStr = now.toISOString().split(".")[0] + ".000Z";

  let totalProcessed = 0;
  let totalNew = 0;
  let totalSkipped = 0;
  let offset = 0;
  const limit = 50;
  let hasMore = true;

  while (hasMore) {
    const searchUrl = new URL(`${MP_API_BASE}/v1/payments/search`);
    searchUrl.searchParams.set("sort", "date_created");
    searchUrl.searchParams.set("criteria", "desc");
    searchUrl.searchParams.set("range", "date_created");
    searchUrl.searchParams.set("begin_date", beginDateStr);
    searchUrl.searchParams.set("end_date", endDateStr);
    searchUrl.searchParams.set("limit", String(limit));
    searchUrl.searchParams.set("offset", String(offset));

    const response = await fetch(searchUrl.toString(), {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      const errText = await response.text();
      return jsonResponse(
        { error: `Error al consultar Mercado Pago (${response.status})`, details: errText, processed_before_error: totalNew },
        500
      );
    }

    const data = await response.json();
    const payments = data.results || [];
    const paging = data.paging || {};

    for (const payment of payments) {
      totalProcessed++;

      const feeAmount = payment.fee_details?.reduce(
        (sum: number, fee: any) => sum + (fee.amount || 0), 0
      ) || 0;

      const netAmount =
        payment.transaction_details?.net_received_amount ||
        payment.transaction_amount - feeAmount;

      const paymentType = classifyPaymentType(payment);
      const mpPaymentId = String(payment.id);

      const { data: existing } = await supabase
        .from("mercado_pago_movements")
        .select("id")
        .eq("mp_payment_id", mpPaymentId)
        .maybeSingle();

      if (existing) {
        totalSkipped++;
        continue;
      }

      const { data: lastMovement } = await supabase
        .from("mercado_pago_movements")
        .select("movement_id")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      let nextNum = 1;
      if (lastMovement?.movement_id) {
        const match = lastMovement.movement_id.match(/^MPM(\d+)$/);
        if (match) nextNum = parseInt(match[1]) + 1;
      }

      const movementId = `MPM${nextNum}`;

      const { error: insertErr } = await supabase
        .from("mercado_pago_movements")
        .insert({
          movement_id: movementId,
          mp_payment_id: mpPaymentId,
          date_created: payment.date_created,
          description: payment.description || payment.statement_descriptor || `Pago #${mpPaymentId}`,
          concepto: payment.reason || payment.additional_info?.items?.[0]?.title || null,
          payment_type: paymentType,
          payment_method: payment.payment_method_id || payment.payment_type_id || "",
          currency: payment.currency_id || "MXN",
          transaction_amount: payment.transaction_amount || 0,
          fee_amount: feeAmount,
          net_amount: netAmount,
          payer_email: payment.payer?.email || null,
          external_reference: payment.external_reference || null,
          import_status: "pending",
          raw_data: payment,
        });

      if (insertErr) {
        console.error(`Error inserting MPM${nextNum}:`, insertErr.message);
      } else {
        totalNew++;
      }
    }

    offset += limit;
    hasMore = offset < (paging.total || 0) && payments.length === limit;
    if (totalProcessed >= 500) break;
  }

  await supabase
    .from("mercado_pago_config")
    .update({ last_sync_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", config.id);

  return jsonResponse({
    success: true,
    total_processed: totalProcessed,
    new_imported: totalNew,
    skipped_duplicates: totalSkipped,
    days_back: daysBack,
  });
}

// ─── Diagnose payout: test if a specific ID is fetchable via Payments API ──

async function handleDiagnosePayout(accessToken: string, body: any) {
  const payoutId = body.payout_id || "158845275553";
  const daysBack = body.days_back || 30;
  const now = new Date();
  const beginDate = new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000);
  const beginDateStr = beginDate.toISOString().split(".")[0] + ".000Z";
  const endDateStr = now.toISOString().split(".")[0] + ".000Z";

  const results: any = { payout_id: payoutId, tests: {} };

  // Test 1: GET /v1/payments/{id} directly
  const directRes = await fetch(`${MP_API_BASE}/v1/payments/${payoutId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  results.tests.direct_get = {
    status: directRes.status,
    body: null as any,
  };
  try {
    results.tests.direct_get.body = await directRes.json();
  } catch (_) {
    results.tests.direct_get.body = await directRes.text().catch(() => "unreadable");
  }

  // Test 2: Search with payment_method_id=spei
  const speiUrl = new URL(`${MP_API_BASE}/v1/payments/search`);
  speiUrl.searchParams.set("payment_method_id", "spei");
  speiUrl.searchParams.set("range", "date_created");
  speiUrl.searchParams.set("begin_date", beginDateStr);
  speiUrl.searchParams.set("end_date", endDateStr);
  speiUrl.searchParams.set("limit", "5");

  const speiRes = await fetch(speiUrl.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  results.tests.search_spei = { status: speiRes.status, body: null as any };
  try {
    const speiData = await speiRes.json();
    results.tests.search_spei.body = {
      total: speiData.paging?.total,
      results_count: speiData.results?.length,
      sample: speiData.results?.slice(0, 2).map((p: any) => ({
        id: p.id, operation_type: p.operation_type, payment_method_id: p.payment_method_id,
        payment_type_id: p.payment_type_id, status: p.status, transaction_amount: p.transaction_amount,
        description: p.description, date_created: p.date_created,
      })),
    };
  } catch (_) {
    results.tests.search_spei.body = await speiRes.text().catch(() => "unreadable");
  }

  // Test 3: Search with operation_type=money_transfer
  const mtUrl = new URL(`${MP_API_BASE}/v1/payments/search`);
  mtUrl.searchParams.set("operation_type", "money_transfer");
  mtUrl.searchParams.set("range", "date_created");
  mtUrl.searchParams.set("begin_date", beginDateStr);
  mtUrl.searchParams.set("end_date", endDateStr);
  mtUrl.searchParams.set("limit", "5");

  const mtRes = await fetch(mtUrl.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  results.tests.search_money_transfer = { status: mtRes.status, body: null as any };
  try {
    const mtData = await mtRes.json();
    results.tests.search_money_transfer.body = {
      total: mtData.paging?.total,
      results_count: mtData.results?.length,
      sample: mtData.results?.slice(0, 2).map((p: any) => ({
        id: p.id, operation_type: p.operation_type, payment_method_id: p.payment_method_id,
        payment_type_id: p.payment_type_id, status: p.status, transaction_amount: p.transaction_amount,
        description: p.description, date_created: p.date_created,
      })),
    };
  } catch (_) {
    results.tests.search_money_transfer.body = await mtRes.text().catch(() => "unreadable");
  }

  // Test 4: Search with operation_type=payout (undocumented but worth trying)
  const poUrl = new URL(`${MP_API_BASE}/v1/payments/search`);
  poUrl.searchParams.set("operation_type", "payout");
  poUrl.searchParams.set("range", "date_created");
  poUrl.searchParams.set("begin_date", beginDateStr);
  poUrl.searchParams.set("end_date", endDateStr);
  poUrl.searchParams.set("limit", "5");

  const poRes = await fetch(poUrl.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  results.tests.search_payout = { status: poRes.status, body: null as any };
  try {
    const poData = await poRes.json();
    results.tests.search_payout.body = {
      total: poData.paging?.total,
      results_count: poData.results?.length,
      sample: poData.results?.slice(0, 2).map((p: any) => ({
        id: p.id, operation_type: p.operation_type, payment_method_id: p.payment_method_id,
        payment_type_id: p.payment_type_id, status: p.status, transaction_amount: p.transaction_amount,
        description: p.description, date_created: p.date_created,
      })),
    };
  } catch (_) {
    results.tests.search_payout.body = await poRes.text().catch(() => "unreadable");
  }

  return jsonResponse(results);
}

// ─── Outgoing movements sync via Release Report ────────────────────────────

async function handleSyncOutgoing(supabase: any, config: any, accessToken: string, body: any) {
  const daysBack = body.days_back || 30;
  const now = new Date();
  const beginDate = new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000);

  const beginDateStr = beginDate.toISOString().split(".")[0] + ".000Z";
  const endDateStr = now.toISOString().split(".")[0] + ".000Z";

  const reportTypes = ["release_report", "settlement_report", "bank_report"];
  let reportCreated = false;
  let usedReportType = "";
  const diagnostics: { type: string; configStatus: number; reportStatus: number; reportBody?: string }[] = [];

  for (const reportType of reportTypes) {
    const configRes = await fetch(`${MP_API_BASE}/v1/account/${reportType}/config`, {
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    });

    const configStatus = configRes.status;

    if (configStatus === 404) {
      const createConfigRes = await fetch(`${MP_API_BASE}/v1/account/${reportType}/config`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          file_name_prefix: `${reportType.replace("_report", "")}-report`,
          include_withdrawal_at_end: true,
          separator: ",",
          display_timezone: "GMT-06",
        }),
      });
      if (!createConfigRes.ok) {
        console.log(`Could not create config for ${reportType}: ${createConfigRes.status}`);
      }
    }

    const createReportRes = await fetch(`${MP_API_BASE}/v1/account/${reportType}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ begin_date: beginDateStr, end_date: endDateStr }),
    });

    const reportStatus = createReportRes.status;
    let reportBody = "";

    if (reportStatus === 202) {
      reportCreated = true;
      usedReportType = reportType;
      diagnostics.push({ type: reportType, configStatus, reportStatus });
      break;
    }

    if (reportStatus === 200 || reportStatus === 203) {
      usedReportType = reportType;
      reportCreated = reportStatus === 200;
      diagnostics.push({ type: reportType, configStatus, reportStatus });
      break;
    }

    try { reportBody = await createReportRes.text(); } catch (_) { /* ignore */ }
    diagnostics.push({ type: reportType, configStatus, reportStatus, reportBody: reportBody.slice(0, 200) });
    console.log(`Report type ${reportType}: config=${configStatus}, report=${reportStatus}, body=${reportBody.slice(0, 100)}`);
  }

  if (!usedReportType) {
    return jsonResponse(
      {
        error: "No se pudo acceder a ninguno de los reportes de MercadoPago. Verifica que tu aplicacion tenga Checkout Pro activado y que el token sea de produccion.",
        diagnostics,
      },
      400
    );
  }

  if (reportCreated) {
    await sleep(5000);
  }

  const listRes = await fetch(
    `${MP_API_BASE}/v1/account/${usedReportType}/list`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!listRes.ok) {
    const errText = await listRes.text();
    return jsonResponse(
      { error: `Error al listar reportes (${listRes.status})`, details: errText },
      500
    );
  }

  const reports: any[] = await listRes.json();

  if (!reports || reports.length === 0) {
    if (reportCreated) {
      return jsonResponse({
        success: true,
        message: "El reporte fue solicitado y se esta generando. Intenta sincronizar de nuevo en 1-2 minutos.",
        new_imported: 0,
      });
    }
    return jsonResponse({
      success: true,
      message: "No hay reportes disponibles.",
      new_imported: 0,
    });
  }

  const sortedReports = reports
    .filter((r: any) => r.status === "processed" || r.status === "ready")
    .sort((a: any, b: any) => {
      const dateA = new Date(a.generation_date || a.end_date || 0).getTime();
      const dateB = new Date(b.generation_date || b.end_date || 0).getTime();
      return dateB - dateA;
    });

  if (sortedReports.length === 0) {
    return jsonResponse({
      success: true,
      message: "El reporte se esta generando. Intenta sincronizar de nuevo en 1-2 minutos.",
      new_imported: 0,
    });
  }

  const latestReport = sortedReports[0];
  const fileName = latestReport.file_name;

  if (!fileName) {
    return jsonResponse({
      success: true,
      message: "El reporte aun no tiene archivo disponible. Intenta de nuevo en unos minutos.",
      new_imported: 0,
    });
  }

  const downloadRes = await fetch(
    `${MP_API_BASE}/v1/account/${usedReportType}/${fileName}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!downloadRes.ok) {
    const errText = await downloadRes.text();
    return jsonResponse(
      { error: `Error al descargar reporte (${downloadRes.status})`, details: errText },
      500
    );
  }

  const csvText = await downloadRes.text();

  const result = usedReportType === "release_report"
    ? await importOutgoingFromReleaseCSV(supabase, csvText)
    : await importOutgoingFromSettlementCSV(supabase, csvText);

  await supabase
    .from("mercado_pago_config")
    .update({ last_sync_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", config.id);

  return jsonResponse({
    success: true,
    report_type: usedReportType,
    report_file: fileName,
    total_rows: result.totalRows,
    outgoing_found: result.outgoingFound,
    new_imported: result.newImported,
    skipped_duplicates: result.skipped,
    csv_preview: csvText.split("\n").slice(0, 3).join("\n"),
  });
}

// Release report CSV columns: DATE, SOURCE_ID, EXTERNAL_REFERENCE, RECORD_TYPE, DESCRIPTION,
// NET_CREDIT_AMOUNT, NET_DEBIT_AMOUNT, GROSS_AMOUNT, MP_FEE_AMOUNT, FINANCING_FEE_AMOUNT,
// SHIPPING_FEE_AMOUNT, TAXES_AMOUNT, COUPON_AMOUNT, INSTALLMENTS, PAYMENT_METHOD
async function importOutgoingFromReleaseCSV(supabase: any, csvText: string) {
  const lines = csvText.split("\n").filter((l: string) => l.trim());
  if (lines.length < 2) return { totalRows: 0, outgoingFound: 0, newImported: 0, skipped: 0 };

  const headerLine = lines[0];
  const separator = headerLine.includes(";") ? ";" : ",";
  const headers = parseCSVLine(headerLine, separator).map((h: string) => h.trim());

  const col = (name: string) => headers.indexOf(name);
  const iDate = col("DATE");
  const iSourceId = col("SOURCE_ID");
  const iExternalRef = col("EXTERNAL_REFERENCE");
  const iRecordType = col("RECORD_TYPE");
  const iDescription = col("DESCRIPTION");
  const iSaleDetail = col("SALE_DETAIL");
  const iNetCredit = col("NET_CREDIT_AMOUNT");
  const iNetDebit = col("NET_DEBIT_AMOUNT");
  const iGrossAmount = col("GROSS_AMOUNT");
  const iFee = col("MP_FEE_AMOUNT");
  const iPaymentMethod = col("PAYMENT_METHOD");

  let totalRows = 0;
  let outgoingFound = 0;
  let newImported = 0;
  let skipped = 0;

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i], separator);
    if (cols.length < 5) continue;
    totalRows++;

    const description = (iDescription >= 0 ? cols[iDescription]?.trim() : "").toLowerCase();
    const recordType = (iRecordType >= 0 ? cols[iRecordType]?.trim() : "").toLowerCase();
    const netDebit = parseFloat(cols[iNetDebit >= 0 ? iNetDebit : -1] || "0");
    const grossAmount = parseFloat(cols[iGrossAmount >= 0 ? iGrossAmount : -1] || "0");

    // Match outgoing: description/recordType contains "payout" or "withdraw"
    // Amount can be NET_DEBIT > 0 OR GROSS_AMOUNT < 0
    const textMatchesPayout =
      description.includes("payout") || description.includes("withdraw") ||
      recordType.includes("payout") || recordType.includes("withdraw");

    const amountIsOutgoing = netDebit > 0 || grossAmount < 0;

    const isOutgoing = textMatchesPayout && amountIsOutgoing;

    if (!isOutgoing) continue;
    outgoingFound++;

    const sourceId = (iSourceId >= 0 ? cols[iSourceId]?.trim() : "") || `row-${i}`;
    const mpPaymentId = `RPT-${sourceId}`;

    const { data: existing } = await supabase
      .from("mercado_pago_movements")
      .select("id")
      .eq("mp_payment_id", mpPaymentId)
      .maybeSingle();

    if (existing) {
      skipped++;
      continue;
    }

    const txDate = (iDate >= 0 ? cols[iDate]?.trim() : "") || new Date().toISOString();
    const feeAmount = Math.abs(parseFloat(cols[iFee >= 0 ? iFee : -1] || "0"));
    const paymentMethod = (iPaymentMethod >= 0 ? cols[iPaymentMethod]?.trim() : "") || "bank_transfer";
    const externalRef = (iExternalRef >= 0 ? cols[iExternalRef]?.trim() : "") || null;

    const isCancel = description.includes("cancel");
    const paymentType = isCancel ? "refund" : "withdrawal";
    const finalAmount = grossAmount < 0 ? grossAmount : -(Math.abs(grossAmount) || netDebit);
    const finalNet = netDebit > 0 ? -netDebit : (grossAmount < 0 ? grossAmount : 0);

    const movementId = await getNextMovementId(supabase);

    const { error: insertErr } = await supabase
      .from("mercado_pago_movements")
      .insert({
        movement_id: movementId,
        mp_payment_id: mpPaymentId,
        date_created: txDate,
        description: `Retiro a cuenta bancaria`,
        concepto: (iSaleDetail >= 0 ? cols[iSaleDetail]?.trim() : null) || null,
        payment_type: paymentType,
        payment_method: paymentMethod,
        currency: "MXN",
        transaction_amount: finalAmount,
        fee_amount: feeAmount,
        net_amount: finalNet,
        payer_email: null,
        external_reference: externalRef,
        import_status: "pending",
        raw_data: {
          source: "release_report",
          description: description,
          record_type: recordType,
          source_id: sourceId,
          row_data: Object.fromEntries(headers.map((h: string, idx: number) => [h, cols[idx]?.trim()])),
        },
      });

    if (insertErr) {
      console.error(`Error inserting ${movementId}:`, insertErr.message);
    } else {
      newImported++;
    }
  }

  return { totalRows, outgoingFound, newImported, skipped };
}

// ─── Withdrawals sync via bank_report exclusively ─────────────────────────

async function handleSyncWithdrawals(supabase: any, config: any, accessToken: string, body: any) {
  const daysBack = body.days_back || 30;
  const now = new Date();
  const beginDate = new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000);
  const beginDateStr = beginDate.toISOString().split(".")[0] + ".000Z";
  const endDateStr = now.toISOString().split(".")[0] + ".000Z";

  const reportType = "bank_report";

  // Ensure config exists
  const configRes = await fetch(`${MP_API_BASE}/v1/account/${reportType}/config`, {
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
  });
  if (configRes.status === 404) {
    await fetch(`${MP_API_BASE}/v1/account/${reportType}/config`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        file_name_prefix: "bank-report",
        separator: ",",
        display_timezone: "GMT-06",
      }),
    });
  }

  // Request new report
  const createRes = await fetch(`${MP_API_BASE}/v1/account/${reportType}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ begin_date: beginDateStr, end_date: endDateStr }),
  });

  const reportCreated = createRes.status === 202 || createRes.status === 200;

  if (!createRes.ok && createRes.status !== 202) {
    const errText = await createRes.text().catch(() => "");
    return jsonResponse(
      { error: `No se pudo generar el reporte de retiros (${createRes.status}). Verifica que tu cuenta tenga el reporte de dinero en cuenta habilitado.`, details: errText.slice(0, 300) },
      400
    );
  }

  if (reportCreated) {
    await sleep(5000);
  }

  const listRes = await fetch(`${MP_API_BASE}/v1/account/${reportType}/list`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!listRes.ok) {
    const errText = await listRes.text();
    return jsonResponse({ error: `Error al listar reportes de retiros (${listRes.status})`, details: errText }, 500);
  }

  const reports: any[] = await listRes.json();

  const sortedReports = (reports || [])
    .filter((r: any) => r.status === "processed" || r.status === "ready")
    .sort((a: any, b: any) => {
      const dateA = new Date(a.generation_date || a.end_date || 0).getTime();
      const dateB = new Date(b.generation_date || b.end_date || 0).getTime();
      return dateB - dateA;
    });

  if (sortedReports.length === 0) {
    return jsonResponse({
      success: true,
      message: "El reporte de retiros se esta generando. Intenta de nuevo en 1-2 minutos.",
      new_imported: 0,
    });
  }

  const latestReport = sortedReports[0];
  const fileName = latestReport.file_name;

  if (!fileName) {
    return jsonResponse({
      success: true,
      message: "El reporte de retiros aun no tiene archivo disponible. Intenta de nuevo en unos minutos.",
      new_imported: 0,
    });
  }

  const downloadRes = await fetch(`${MP_API_BASE}/v1/account/${reportType}/${fileName}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!downloadRes.ok) {
    const errText = await downloadRes.text();
    return jsonResponse({ error: `Error al descargar reporte de retiros (${downloadRes.status})`, details: errText }, 500);
  }

  const csvText = await downloadRes.text();
  const result = await importWithdrawalsFromBankReportCSV(supabase, csvText);

  await supabase
    .from("mercado_pago_config")
    .update({ last_sync_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", config.id);

  return jsonResponse({
    success: true,
    report_type: reportType,
    report_file: fileName,
    total_rows: result.totalRows,
    outgoing_found: result.outgoingFound,
    new_imported: result.newImported,
    skipped_duplicates: result.skipped,
    csv_preview: csvText.split("\n").slice(0, 3).join("\n"),
  });
}

// bank_report CSV columns include: DATE, SOURCE_ID, EXTERNAL_REFERENCE, RECORD_TYPE,
// DESCRIPTION, NET_CREDIT_AMOUNT, NET_DEBIT_AMOUNT, GROSS_AMOUNT, MP_FEE_AMOUNT, NOMBRE_DEL_TITULAR
async function importWithdrawalsFromBankReportCSV(supabase: any, csvText: string) {
  const lines = csvText.split("\n").filter((l: string) => l.trim());
  if (lines.length < 2) return { totalRows: 0, outgoingFound: 0, newImported: 0, skipped: 0 };

  const headerLine = lines[0];
  const separator = headerLine.includes(";") ? ";" : ",";
  const headers = parseCSVLine(headerLine, separator).map((h: string) => h.trim());

  const col = (name: string) => headers.indexOf(name);
  const iDate = col("DATE");
  const iSourceId = col("SOURCE_ID");
  const iExternalRef = col("EXTERNAL_REFERENCE");
  const iRecordType = col("RECORD_TYPE");
  const iDescription = col("DESCRIPTION");
  const iNetCredit = col("NET_CREDIT_AMOUNT");
  const iNetDebit = col("NET_DEBIT_AMOUNT");
  const iGrossAmount = col("GROSS_AMOUNT");
  const iFee = col("MP_FEE_AMOUNT");
  const iTitular = col("NOMBRE_DEL_TITULAR");

  let totalRows = 0;
  let outgoingFound = 0;
  let newImported = 0;
  let skipped = 0;

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i], separator);
    if (cols.length < 3) continue;
    totalRows++;

    const recordType = (iRecordType >= 0 ? cols[iRecordType]?.trim() : "").toLowerCase();
    const description = (iDescription >= 0 ? cols[iDescription]?.trim() : "").toLowerCase();
    const grossAmount = parseFloat(cols[iGrossAmount >= 0 ? iGrossAmount : -1] || "0");
    const netDebit = parseFloat(cols[iNetDebit >= 0 ? iNetDebit : -1] || "0");

    const isWithdrawal =
      recordType.includes("withdrawal") || recordType.includes("payout") ||
      description.includes("withdrawal") || description.includes("payout") ||
      description.includes("retiro") ||
      (grossAmount < 0 || netDebit > 0);

    if (!isWithdrawal) continue;
    outgoingFound++;

    const sourceId = (iSourceId >= 0 ? cols[iSourceId]?.trim() : "") || `bk-row-${i}`;
    const mpPaymentId = `BK-${sourceId}`;

    const { data: existing } = await supabase
      .from("mercado_pago_movements")
      .select("id")
      .eq("mp_payment_id", mpPaymentId)
      .maybeSingle();

    if (existing) {
      skipped++;
      continue;
    }

    const txDate = (iDate >= 0 ? cols[iDate]?.trim() : "") || new Date().toISOString();
    const feeAmount = Math.abs(parseFloat(cols[iFee >= 0 ? iFee : -1] || "0"));
    const externalRef = (iExternalRef >= 0 ? cols[iExternalRef]?.trim() : "") || null;
    const titularName = (iTitular >= 0 ? cols[iTitular]?.trim() : "") || null;

    const finalAmount = grossAmount < 0 ? grossAmount : -(Math.abs(grossAmount) || netDebit);
    const netCredit = parseFloat(cols[iNetCredit >= 0 ? iNetCredit : -1] || "0");
    const finalNet = netDebit > 0 ? -netDebit : (netCredit < 0 ? netCredit : (grossAmount < 0 ? grossAmount : 0));

    const movementId = await getNextMovementId(supabase);

    const { error: insertErr } = await supabase
      .from("mercado_pago_movements")
      .insert({
        movement_id: movementId,
        mp_payment_id: mpPaymentId,
        date_created: txDate,
        description: `Retiro a cuenta bancaria`,
        concepto: titularName,
        payment_type: "withdrawal",
        payment_method: "bank_transfer",
        currency: "MXN",
        transaction_amount: finalAmount,
        fee_amount: feeAmount,
        net_amount: finalNet,
        payer_email: null,
        external_reference: externalRef || null,
        import_status: "pending",
        raw_data: {
          source: "bank_report",
          record_type: recordType,
          source_id: sourceId,
          nombre_del_titular: titularName,
          row_data: Object.fromEntries(headers.map((h: string, idx: number) => [h, cols[idx]?.trim()])),
        },
      });

    if (insertErr) {
      console.error(`Error inserting ${movementId}:`, insertErr.message);
    } else {
      newImported++;
    }
  }

  return { totalRows, outgoingFound, newImported, skipped };
}

// Settlement report CSV columns: SOURCE_ID, TRANSACTION_TYPE, TRANSACTION_AMOUNT, etc.
async function importOutgoingFromSettlementCSV(supabase: any, csvText: string) {
  const lines = csvText.split("\n").filter((l: string) => l.trim());
  if (lines.length < 2) return { totalRows: 0, outgoingFound: 0, newImported: 0, skipped: 0 };

  const headerLine = lines[0];
  const separator = headerLine.includes(";") ? ";" : ",";
  const headers = parseCSVLine(headerLine, separator).map((h: string) => h.trim());

  const col = (name: string) => headers.indexOf(name);
  const iSourceId = col("SOURCE_ID");
  const iTransactionType = col("TRANSACTION_TYPE");
  const iTransactionAmount = col("TRANSACTION_AMOUNT");
  const iTransactionCurrency = col("TRANSACTION_CURRENCY");
  const iTransactionDate = col("TRANSACTION_DATE");
  const iFeeAmount = col("FEE_AMOUNT");
  const iNetAmount = col("SETTLEMENT_NET_AMOUNT");
  const iPaymentMethod = col("PAYMENT_METHOD");
  const iPaymentMethodType = col("PAYMENT_METHOD_TYPE");
  const iExternalRef = col("EXTERNAL_REFERENCE");
  const iDescription = col("DESCRIPTION");
  const iSaleDetail = col("SALE_DETAIL");

  if (iSourceId === -1 || iTransactionType === -1) {
    return { totalRows: lines.length - 1, outgoingFound: 0, newImported: 0, skipped: 0 };
  }

  let totalRows = 0;
  let outgoingFound = 0;
  let newImported = 0;
  let skipped = 0;

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i], separator);
    if (cols.length < 5) continue;
    totalRows++;

    const txType = cols[iTransactionType]?.trim().toUpperCase();
    if (!txType.includes("PAYOUT") && !txType.includes("WITHDRAW")) continue;
    outgoingFound++;

    const sourceId = cols[iSourceId]?.trim();
    if (!sourceId) continue;

    const mpPaymentId = `RPT-${sourceId}`;

    const { data: existing } = await supabase
      .from("mercado_pago_movements")
      .select("id")
      .eq("mp_payment_id", mpPaymentId)
      .maybeSingle();

    if (existing) {
      skipped++;
      continue;
    }

    const txAmount = parseFloat(cols[iTransactionAmount] || "0");
    const feeAmount = Math.abs(parseFloat(cols[iFeeAmount] || "0"));
    const netAmount = parseFloat(cols[iNetAmount] || "0");
    const txDate = cols[iTransactionDate]?.trim() || new Date().toISOString();
    const currency = cols[iTransactionCurrency]?.trim() || "MXN";
    const paymentMethod = cols[iPaymentMethod]?.trim() || cols[iPaymentMethodType]?.trim() || "bank_transfer";
    const externalRef = cols[iExternalRef]?.trim() || null;
    const description = cols[iDescription]?.trim() || `Retiro ${sourceId}`;

    const paymentType = txType === "WITHDRAWAL_CANCEL" ? "refund" : "withdrawal";
    const finalAmount = txAmount > 0 ? -txAmount : txAmount;
    const finalNet = netAmount > 0 ? -netAmount : netAmount;

    const movementId = await getNextMovementId(supabase);

    const { error: insertErr } = await supabase
      .from("mercado_pago_movements")
      .insert({
        movement_id: movementId,
        mp_payment_id: mpPaymentId,
        date_created: txDate,
        description: description,
        concepto: (iSaleDetail >= 0 ? cols[iSaleDetail]?.trim() : null) || null,
        payment_type: paymentType,
        payment_method: paymentMethod,
        currency: currency,
        transaction_amount: finalAmount,
        fee_amount: feeAmount,
        net_amount: finalNet,
        payer_email: null,
        external_reference: externalRef,
        import_status: "pending",
        raw_data: {
          source: "settlement_report",
          transaction_type: txType,
          source_id: sourceId,
          row_data: Object.fromEntries(headers.map((h: string, idx: number) => [h, cols[idx]?.trim()])),
        },
      });

    if (insertErr) {
      console.error(`Error inserting ${movementId}:`, insertErr.message);
    } else {
      newImported++;
    }
  }

  return { totalRows, outgoingFound, newImported, skipped };
}

async function getNextMovementId(supabase: any): Promise<string> {
  const { data: lastMovement } = await supabase
    .from("mercado_pago_movements")
    .select("movement_id")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let nextNum = 1;
  if (lastMovement?.movement_id) {
    const match = lastMovement.movement_id.match(/^MPM(\d+)$/);
    if (match) nextNum = parseInt(match[1]) + 1;
  }
  return `MPM${nextNum}`;
}

function parseCSVLine(line: string, separator: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === separator && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function classifyPaymentType(payment: any): string {
  const method = payment.payment_method_id || "";
  const type = payment.payment_type_id || "";
  const status = payment.status || "";

  if (status === "refunded") return "refund";
  if (type === "bank_transfer" || method === "bank_transfer") return "withdrawal";
  if (type === "account_money" && payment.transaction_amount < 0) return "withdrawal";
  if (type === "account_money") return "transfer";
  if (type === "credit_card" || type === "debit_card") return "sale";
  if (method === "account_money") return "transfer";

  return type || "other";
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function jsonResponse(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
