import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

// ── Types ─────────────────────────────────────────────────────────────────────

interface WCBillingAddress {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  address_1: string;
  address_2: string;
  city: string;
  state: string;
  postcode: string;
  country: string;
  company: string;
}

interface WCLineItem {
  id: number;
  product_id: number;
  variation_id: number;
  name: string;
  quantity: number;
  total: string;
}

interface WCShippingLine {
  id: number;
  method_id: string;
  method_title: string;
  total: string;
}

interface WCMetaData {
  id: number;
  key: string;
  value: unknown;
}

interface WCOrder {
  id: number;
  number: string;
  status: string;
  total: string;
  customer_note: string;
  billing: WCBillingAddress;
  line_items: WCLineItem[];
  shipping_lines: WCShippingLine[];
  meta_data?: WCMetaData[];
  payment_method?: string;
  payment_method_title?: string;
  date_paid?: string | null;
  transaction_id?: string;
  cart_tax?: string;
  discount_total?: string;
  shipping_total?: string;
  currency?: string;
}

interface WooConfig {
  cutoff_day: number;
  cutoff_hour: number;
}

interface ProductMapping {
  id: string;
  wc_product_id: string;
  product_name: string;
  meal_plan_id: string;
  days_of_week: string[];
  meal_types: string[];
  num_weeks: number;
  delivery_option_id: string | null;
  is_active: boolean;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Splits "Calle Reforma 123" → { street: "Calle Reforma", number: "123" }
 * Scans right-to-left for the last token that starts with a digit.
 */
function parseStreetAddress(address: string): { street: string; number: string } {
  const trimmed = address.trim();
  if (!trimmed) return { street: "", number: "" };
  const tokens = trimmed.split(/\s+/);
  for (let i = tokens.length - 1; i >= 0; i--) {
    if (/^\d/.test(tokens[i])) {
      return {
        street: tokens.slice(0, i).join(" ") || trimmed,
        number: tokens.slice(i).join(" "),
      };
    }
  }
  return { street: trimmed, number: "" };
}

/** Strips all non-digit characters from a phone string. */
function sanitizePhone(phone: string): string {
  return phone.replace(/\D/g, "");
}

function chooseWeekIndex(cutoffDay: number, cutoffHour: number): number {
  const now = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Mexico_City" }));
  const day = now.getDay();
  const hour = now.getHours();
  const isPastCutoff = day > cutoffDay || (day === cutoffDay && hour >= cutoffHour);
  return isPastCutoff ? 1 : 0;
}

function buildQuantityColumns(daysOfWeek: string[], mealTypes: string[]): Record<string, number> {
  const dayMap: Record<string, string> = {
    "Lunes": "lunes",
    "Martes": "martes",
    "Miércoles": "miercoles",
    "Miercoles": "miercoles",
    "Jueves": "jueves",
    "Viernes": "viernes",
  };
  const mealMap: Record<string, string> = {
    "Desayuno": "desayuno",
    "Colación AM": "colacion_am",
    "Colacion AM": "colacion_am",
    "Comida": "comida",
    "Colación PM": "colacion_pm",
    "Colacion PM": "colacion_pm",
    "Cena": "cena",
  };
  const cols: Record<string, number> = {};
  for (const day of daysOfWeek) {
    const dayKey = dayMap[day.trim().normalize("NFC")] ?? dayMap[day.trim()];
    if (!dayKey) continue;
    for (const meal of mealTypes) {
      const mealKey = mealMap[meal.trim().normalize("NFC")] ?? mealMap[meal.trim()];
      if (!mealKey) continue;
      cols[`${dayKey}_${mealKey}_qty`] = 1;
    }
  }
  return cols;
}

function mapWcStatusToInvoiceStatus(wcStatus: string, datePaid: string | null | undefined): "draft" | "paid" | "cancelled" {
  if (wcStatus === "cancelled" || wcStatus === "refunded" || wcStatus === "failed") return "cancelled";
  if (wcStatus === "completed" || wcStatus === "processing" || datePaid) return "paid";
  return "draft";
}

// ── Main test-order processor ─────────────────────────────────────────────────

async function processTestOrder(
  supabase: ReturnType<typeof createClient>,
  wcOrder: WCOrder,
  importId: string,
  config: WooConfig
): Promise<{ app_order_id: string; customer_id: string; invoice_number: string; order_weeks_created: number }> {
  const productIds = wcOrder.line_items.map(li => String(li.product_id));
  const variationIds = wcOrder.line_items
    .filter(li => li.variation_id > 0)
    .map(li => String(li.variation_id));
  const allProductIds = [...new Set([...productIds, ...variationIds])];

  const { data: mappingsData, error: mappingsError } = await supabase
    .from("woocommerce_product_mappings")
    .select("*")
    .in("wc_product_id", allProductIds)
    .eq("is_active", true);

  if (mappingsError) throw new Error(`Error fetching mappings: ${mappingsError.message}`);

  const mappings = (mappingsData ?? []) as ProductMapping[];

  if (mappings.length === 0) {
    throw new Error("No se encontraron mapeos activos para los productos: " + allProductIds.join(", "));
  }

  const weekIndex = chooseWeekIndex(config.cutoff_day ?? 5, config.cutoff_hour ?? 12);

  const today = new Date().toLocaleString("en-CA", {
    timeZone: "America/Mexico_City",
    year: "numeric", month: "2-digit", day: "2-digit",
  }).split(",")[0];

  const { data: weeksData, error: weeksError } = await supabase
    .from("weeks")
    .select("id, week_id, week_name, week_date, weekly_menu")
    .gte("week_date", today)
    .order("week_date", { ascending: true })
    .limit(6);

  if (weeksError) throw new Error(`Error fetching weeks: ${weeksError.message}`);
  if (!weeksData || weeksData.length === 0) throw new Error("No hay semanas disponibles en el sistema");

  const billing = wcOrder.billing;
  const metaData = wcOrder.meta_data ?? [];
  const delegacionValue = metaData.find(m => m.key === "_billing_wooccm12");
  const delegacion = delegacionValue ? String(delegacionValue.value) : "";
  const colonia = billing.city || "";
  const allergyNote = (() => {
    const v = metaData.find(m => m.key === "_billing_wooccm11");
    return v ? String(v.value).trim() : "";
  })();
  const parsedAddr = parseStreetAddress(billing.address_1 || "");
  const sanitizedPhone = sanitizePhone(billing.phone || "");

  // Always create a new test customer — never reuse existing ones
  const { data: allCustomers } = await supabase.from("customers").select("customer_id");
  const numericParts = (allCustomers ?? [])
    .map((c: { customer_id: string }) => parseInt(c.customer_id.replace("CUST-", "")))
    .filter((n: number) => !isNaN(n));
  const maxNum = numericParts.length > 0 ? Math.max(...numericParts) : 0;
  const customerId = `CUST-${String(maxNum + 1).padStart(4, "0")}`;
  const customerName = `${billing.first_name} ${billing.last_name}`.trim();

  const baseNotes = `[PRUEBA] Importado desde WooCommerce #${wcOrder.number}. Email real: ${billing.email}. Empresa: ${billing.company || "N/A"}`;
  const customerNotes = allergyNote ? `${baseNotes} | ${allergyNote}` : baseNotes;

  const { error: customerErr } = await supabase.from("customers").insert([{
    customer_id: customerId,
    customer_name: billing.first_name,
    customer_lastname: billing.last_name,
    customer_email: `test+${importId}@test.holadieta.mx`,
    customer_phone: sanitizedPhone,
    customer_street: parsedAddr.street,
    customer_street_number: parsedAddr.number,
    customer_interior_number: billing.address_2 || "",
    customer_colonia: colonia,
    customer_delegacion: delegacion,
    customer_postal_code: billing.postcode || "",
    customer_delivery_instructions: "",
    customer_restrictions: [],
    customer_notes: customerNotes,
    country_code: "+52",
    billing_name: billing.company || customerName,
    billing_street: parsedAddr.street,
    billing_exterior_number: parsedAddr.number,
    billing_postal_code: billing.postcode || "",
    billing_neighborhood: colonia,
    billing_interior_number: billing.address_2 || "",
    billing_state: billing.state || "",
    billing_municipality: delegacion,
    is_test: true,
  }]);

  if (customerErr) throw new Error(`Error creating test customer: ${customerErr.message}`);

  let resolvedDeliveryOptionId: string | null = null;
  const wcMethodId = wcOrder.shipping_lines?.[0]?.method_id ?? null;
  if (wcMethodId) {
    const { data: shippingMapping } = await supabase
      .from("woocommerce_shipping_mappings")
      .select("delivery_option_id")
      .eq("wc_method_id", wcMethodId)
      .eq("is_active", true)
      .maybeSingle();
    if (shippingMapping?.delivery_option_id) {
      resolvedDeliveryOptionId = shippingMapping.delivery_option_id;
    }
  }

  const { data: orderIdData, error: orderIdErr } = await supabase.rpc("generate_next_order_id");
  if (orderIdErr || !orderIdData) throw new Error(`Error generating order ID: ${orderIdErr?.message}`);
  const appOrderId: string = orderIdData;

  const orderTotal = parseFloat(wcOrder.total) || 0;

  const { error: orderErr } = await supabase.from("orders").insert([{
    order_id: appOrderId,
    customer_id: customerId,
    order_customer_name: customerName,
    order_customer_email: billing.email,
    order_total_price: orderTotal,
    order_invoice_number: "",
    order_status: "pending",
    delivery_option_id: resolvedDeliveryOptionId,
    order_notes: [
      `[PRUEBA] Pedido WooCommerce #${wcOrder.number}`,
      wcOrder.customer_note ? `Nota del cliente: ${wcOrder.customer_note}` : null,
      allergyNote ? `Notas: ${allergyNote}` : null,
    ].filter(Boolean).join(" | "),
    is_test: true,
  }]);

  if (orderErr) throw new Error(`Error creating test order: ${orderErr.message}`);

  // ── Create order_weeks ────────────────────────────────────────────────────
  let orderWeeksCreated = 0;
  for (const lineItem of wcOrder.line_items) {
    const matchingMapping =
      (lineItem.variation_id > 0
        ? mappings.find(m => m.wc_product_id === String(lineItem.variation_id))
        : null) ??
      mappings.find(m => m.wc_product_id === String(lineItem.product_id));

    if (!matchingMapping) continue;

    const quantities = buildQuantityColumns(matchingMapping.days_of_week, matchingMapping.meal_types);
    if (Object.keys(quantities).length === 0) continue;

    const numWeeks = matchingMapping.num_weeks ?? 1;
    for (let i = 0; i < numWeeks; i++) {
      const weekForRow = weeksData[Math.min(weekIndex + i, weeksData.length - 1)];
      if (!weekForRow) continue;

      const { error: owErr } = await supabase.from("order_weeks").insert([{
        order_week_id: `OW-${crypto.randomUUID()}`,
        order_id: appOrderId,
        week_id: weekForRow.week_id,
        meal_plan_id: matchingMapping.meal_plan_id,
        delivery_date: weekForRow.week_date ?? null,
        ...quantities,
      }]);

      if (owErr) throw new Error(`Error creating order_week (week ${i + 1}/${numWeeks}) for product ${lineItem.product_id}: ${owErr.message}`);
      orderWeeksCreated++;
    }
  }

  // ── Resolve bank account from payment method mapping ─────────────────────
  let resolvedBankAccountId: string | null = null;
  const wcPaymentMethodId = wcOrder.payment_method ?? null;
  if (wcPaymentMethodId) {
    const { data: paymentMapping } = await supabase
      .from("woocommerce_payment_mappings")
      .select("bank_account_id")
      .eq("wc_method_id", wcPaymentMethodId)
      .eq("is_active", true)
      .maybeSingle();
    if (paymentMapping?.bank_account_id) {
      resolvedBankAccountId = paymentMapping.bank_account_id;
    }
  }

  // ── Create invoice matching WC payment status ─────────────────────────────
  const rawInvoiceStatus = mapWcStatusToInvoiceStatus(wcOrder.status, wcOrder.date_paid);
  // Downgrade paid→draft if no bank account is mapped (trigger requires account_id NOT NULL)
  const invoiceStatus = rawInvoiceStatus === "paid" && !resolvedBankAccountId ? "draft" : rawInvoiceStatus;
  const paymentDate = invoiceStatus === "paid" ? (wcOrder.date_paid ?? null) : null;

  const { data: invoiceRows, error: invoiceErr } = await supabase.rpc("create_invoice_atomic", {
    p_order_id: appOrderId,
    p_customer_name: customerName,
    p_customer_email: billing.email,
    p_invoice_summary: `Pedido WooCommerce #${wcOrder.number}`,
    p_subtotal: orderTotal,
    p_delivery_option_price: 0,
    p_tax_amount: 0,
    p_delivery_tax_amount: 0,
    p_total_amount: orderTotal,
    p_invoice_status: invoiceStatus,
    p_bank_account_id: resolvedBankAccountId,
    p_plan_discount_amount: 0,
    p_coupon_discount_amount: 0,
    p_custom_discount_amount: 0,
    p_payment_date: paymentDate,
  });

  if (invoiceErr) throw new Error(`Error creating invoice: ${invoiceErr.message}`);

  const invoiceNumber: string = Array.isArray(invoiceRows) && invoiceRows.length > 0
    ? (invoiceRows[0] as { invoice_number: string }).invoice_number
    : "";

  if (invoiceNumber) {
    await supabase
      .from("orders")
      .update({ order_invoice_number: invoiceNumber })
      .eq("order_id", appOrderId);
  }

  await supabase
    .from("woocommerce_order_imports")
    .update({ status: "test_processed", app_order_id: appOrderId, error_message: null })
    .eq("id", importId);

  return { app_order_id: appOrderId, customer_id: customerId, invoice_number: invoiceNumber, order_weeks_created: orderWeeksCreated };
}

// ── Main Handler ──────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { import_id } = await req.json();
    if (!import_id) {
      return new Response(JSON.stringify({ success: false, error: "import_id requerido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: importRow, error: importErr } = await supabase
      .from("woocommerce_order_imports")
      .select("*")
      .eq("id", import_id)
      .maybeSingle();

    if (importErr || !importRow) {
      return new Response(JSON.stringify({ success: false, error: "Importación no encontrada" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (importRow.status !== "test") {
      return new Response(JSON.stringify({ success: false, error: `Solo se pueden procesar registros con estado 'test', este tiene '${importRow.status}'` }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!importRow.raw_payload) {
      return new Response(JSON.stringify({ success: false, error: "El registro no tiene payload guardado" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: configData } = await supabase
      .from("woocommerce_config")
      .select("cutoff_day, cutoff_hour")
      .limit(1)
      .maybeSingle();

    const config: WooConfig = {
      cutoff_day: configData?.cutoff_day ?? 5,
      cutoff_hour: configData?.cutoff_hour ?? 12,
    };

    const wcOrder = importRow.raw_payload as WCOrder;

    const result = await processTestOrder(supabase, wcOrder, import_id, config);

    return new Response(JSON.stringify({ success: true, ...result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
