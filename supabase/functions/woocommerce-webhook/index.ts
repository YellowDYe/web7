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

interface WCCouponLine {
  id: number;
  code: string;
  discount: string;
}

interface WCTaxLine {
  id: number;
  rate_percent: number;
  tax_total: string;
  label: string;
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
  coupon_lines?: WCCouponLine[];
  tax_lines?: WCTaxLine[];
  meta_data?: WCMetaData[];
  payment_method?: string;
  payment_method_title?: string;
  date_paid?: string | null;
  date_created?: string | null;
  transaction_id?: string;
  cart_tax?: string;
  discount_total?: string;
  shipping_total?: string;
  currency?: string;
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

interface WooConfig {
  id: string;
  webhook_secret: string;
  cutoff_day: number;
  cutoff_hour: number;
  test_mode: boolean;
}

// ── Financial field extractor ─────────────────────────────────────────────────

interface FinancialFields {
  payment_method: string | null;
  payment_method_title: string | null;
  payment_date: string | null;
  payment_transaction_id: string | null;
  payment_fee: number | null;
  total_amount: number | null;
  cart_tax: number | null;
  tax_rate_percent: number | null;
  discount_total: number | null;
  coupon_codes: string[] | null;
  shipping_total: number | null;
  currency: string | null;
  wc_billing_colonia: string | null;
}

function extractFinancialFields(wcOrder: WCOrder): FinancialFields {
  const metaData = wcOrder.meta_data ?? [];

  const getMetaValue = (key: string): string | null => {
    const entry = metaData.find(m => m.key === key);
    return entry ? String(entry.value) : null;
  };

  const mpPaymentId = getMetaValue("_Mercado_Pago_Payment_IDs") ?? wcOrder.transaction_id ?? null;
  const mpFeeRaw = getMetaValue("mercadopago_fee");
  const mpFee = mpFeeRaw ? parseFloat(mpFeeRaw) : null;
  const colonia = getMetaValue("_billing_wooccm12");

  const couponCodes = (wcOrder.coupon_lines ?? [])
    .map(c => c.code)
    .filter(Boolean);

  const taxRate = (wcOrder.tax_lines ?? [])[0]?.rate_percent ?? null;

  return {
    payment_method: wcOrder.payment_method ?? null,
    payment_method_title: wcOrder.payment_method_title ?? null,
    payment_date: wcOrder.date_paid ?? null,
    payment_transaction_id: mpPaymentId || null,
    payment_fee: mpFee,
    total_amount: wcOrder.total ? parseFloat(wcOrder.total) : null,
    cart_tax: wcOrder.cart_tax ? parseFloat(wcOrder.cart_tax) : null,
    tax_rate_percent: taxRate ?? null,
    discount_total: wcOrder.discount_total ? parseFloat(wcOrder.discount_total) : null,
    coupon_codes: couponCodes.length > 0 ? couponCodes : null,
    shipping_total: wcOrder.shipping_total ? parseFloat(wcOrder.shipping_total) : null,
    currency: wcOrder.currency ?? null,
    wc_billing_colonia: colonia,
  };
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

async function verifySignature(
  rawBody: string,
  signature: string | null,
  secret: string
): Promise<boolean> {
  if (!signature) return false;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(rawBody));
  const expected = btoa(String.fromCharCode(...new Uint8Array(sig)));
  return expected === signature;
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

// ── Main Handler ──────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const rawBody = await req.text();
  let wcOrder: WCOrder;

  try {
    wcOrder = JSON.parse(rawBody);
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data: config } = await supabase
    .from("woocommerce_config")
    .select("id, webhook_secret, cutoff_day, cutoff_hour, test_mode")
    .eq("is_active", true)
    .maybeSingle() as { data: WooConfig | null };

  if (config?.webhook_secret) {
    const signature = req.headers.get("x-wc-webhook-signature");
    const valid = await verifySignature(rawBody, signature, config.webhook_secret);
    if (!valid) {
      return new Response(JSON.stringify({ error: "Invalid signature" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  const wcOrderId = String(wcOrder.id);
  const wcOrderNumber = wcOrder.number || wcOrderId;
  const customerEmail = wcOrder.billing?.email ?? "";
  const financialFields = extractFinancialFields(wcOrder);

  const { data: existingImport } = await supabase
    .from("woocommerce_order_imports")
    .select("id, status, app_order_id")
    .eq("wc_order_id", wcOrderId)
    .maybeSingle();

  const REPROCESSABLE_STATUSES = ["failed", "test"];
  if (existingImport && !REPROCESSABLE_STATUSES.includes(existingImport.status)) {
    return new Response(JSON.stringify({ received: true, duplicate: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (existingImport) {
    await supabase
      .from("woocommerce_order_imports")
      .update({ status: "pending_review", error_message: null, raw_payload: wcOrder, wc_date_created: wcOrder.date_created ?? null, ...financialFields })
      .eq("id", existingImport.id);
  } else {
    const { error: insertErr } = await supabase
      .from("woocommerce_order_imports")
      .insert([{
        wc_order_id: wcOrderId,
        wc_order_number: wcOrderNumber,
        customer_email: customerEmail,
        status: "pending_review",
        raw_payload: wcOrder,
        wc_date_created: wcOrder.date_created ?? null,
        ...financialFields,
      }]);

    if (insertErr) {
      console.error("Failed to create import log:", insertErr);
    }
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});

// ── processOrder ──────────────────────────────────────────────────────────────

async function processOrder(
  supabase: ReturnType<typeof createClient>,
  wcOrder: WCOrder,
  importId: string,
  config: WooConfig | null
) {
  const markFailed = async (msg: string) => {
    await supabase
      .from("woocommerce_order_imports")
      .update({ status: "failed", error_message: msg })
      .eq("id", importId);
  };

  try {
    // ── 1. Fetch product mappings ──────────────────────────────────────────────
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
      await markFailed("No se encontraron mapeos activos para los productos de este pedido: " + allProductIds.join(", "));
      return;
    }

    // ── 2. Resolve target week ─────────────────────────────────────────────────
    const cutoffDay = config?.cutoff_day ?? 5;
    const cutoffHour = config?.cutoff_hour ?? 12;
    const weekIndex = chooseWeekIndex(cutoffDay, cutoffHour);

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
    if (!weeksData || weeksData.length === 0) throw new Error("No hay semanas disponibles configuradas en el sistema");

    // ── 3. Find or create customer ─────────────────────────────────────────────
    const billing = wcOrder.billing;
    const email = billing.email;
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

    const { data: existingCustomers } = await supabase
      .from("customers")
      .select("id, customer_id, customer_name, customer_lastname, customer_email")
      .eq("customer_email", email)
      .limit(1);

    let customerId: string;
    let customerName: string;

    if (existingCustomers && existingCustomers.length > 0) {
      customerId = existingCustomers[0].customer_id;
      customerName = `${existingCustomers[0].customer_name} ${existingCustomers[0].customer_lastname}`.trim();
    } else {
      const { data: allCustomers } = await supabase
        .from("customers")
        .select("customer_id");

      const numericParts = (allCustomers ?? [])
        .map((c: { customer_id: string }) => parseInt(c.customer_id.replace("CUST-", "")))
        .filter((n: number) => !isNaN(n));
      const maxNum = numericParts.length > 0 ? Math.max(...numericParts) : 0;
      customerId = `CUST-${String(maxNum + 1).padStart(4, "0")}`;
      customerName = `${billing.first_name} ${billing.last_name}`.trim();

      const baseNotes = `Importado desde WooCommerce. Empresa: ${billing.company || "N/A"}`;
      const customerNotes = allergyNote ? `${baseNotes} | ${allergyNote}` : baseNotes;

      const { error: customerErr } = await supabase
        .from("customers")
        .insert([{
          customer_id: customerId,
          customer_name: billing.first_name,
          customer_lastname: billing.last_name,
          customer_email: email,
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
        }]);

      if (customerErr) throw new Error(`Error creating customer: ${customerErr.message}`);
    }

    // ── 4. Resolve delivery option from shipping total amount ──────────────────
    let resolvedDeliveryOptionId: string | null = null;
    const wcShippingTotal = parseFloat(wcOrder.shipping_lines?.[0]?.total ?? "0") || 0;

    {
      const { data: shippingMapping } = await supabase
        .from("woocommerce_shipping_mappings")
        .select("delivery_option_id")
        .eq("shipping_total", wcShippingTotal)
        .eq("is_active", true)
        .maybeSingle();

      if (shippingMapping?.delivery_option_id) {
        resolvedDeliveryOptionId = shippingMapping.delivery_option_id;
      } else {
        console.warn(`No active shipping mapping found for shipping_total: ${wcShippingTotal}`);
      }
    }

    // ── 5. Generate order ID ───────────────────────────────────────────────────
    const { data: orderIdData, error: orderIdErr } = await supabase.rpc("generate_next_order_id");
    if (orderIdErr || !orderIdData) throw new Error(`Error generating order ID: ${orderIdErr?.message}`);
    const appOrderId: string = orderIdData;

    // ── 6. Create order ────────────────────────────────────────────────────────
    const orderTotal = parseFloat(wcOrder.total) || 0;

    const { error: orderErr } = await supabase
      .from("orders")
      .insert([{
        order_id: appOrderId,
        customer_id: customerId,
        order_customer_name: customerName,
        order_customer_email: email,
        order_total_price: orderTotal,
        order_invoice_number: "",
        order_status: "pending",
        delivery_option_id: resolvedDeliveryOptionId,
        order_notes: [
          `Pedido WooCommerce #${wcOrder.number}`,
          wcOrder.customer_note ? `Nota del cliente: ${wcOrder.customer_note}` : null,
          allergyNote ? `Notas: ${allergyNote}` : null,
        ].filter(Boolean).join(" | "),
      }]);

    if (orderErr) throw new Error(`Error creating order: ${orderErr.message}`);

    // ── 7. Create order_weeks ──────────────────────────────────────────────────
    for (const lineItem of wcOrder.line_items) {
      const matchingMapping =
        (lineItem.variation_id > 0
          ? mappings.find(m => m.wc_product_id === String(lineItem.variation_id))
          : null) ??
        mappings.find(m => m.wc_product_id === String(lineItem.product_id));

      if (!matchingMapping) continue;

      const quantities = buildQuantityColumns(
        matchingMapping.days_of_week,
        matchingMapping.meal_types
      );

      if (Object.keys(quantities).length === 0) continue;

      const numWeeks = matchingMapping.num_weeks ?? 1;

      for (let i = 0; i < numWeeks; i++) {
        const weekForRow = weeksData[Math.min(weekIndex + i, weeksData.length - 1)];

        if (!weekForRow) {
          console.warn(`Week at index ${weekIndex + i} not found — skipping week ${i + 1}/${numWeeks} for product ${lineItem.product_id}`);
          continue;
        }

        const { error: owErr } = await supabase
          .from("order_weeks")
          .insert([{
            order_week_id: `OW-${crypto.randomUUID()}`,
            order_id: appOrderId,
            week_id: weekForRow.week_id,
            meal_plan_id: matchingMapping.meal_plan_id,
            delivery_date: weekForRow.week_date ?? null,
            ...quantities,
          }]);

        if (owErr) {
          console.error(`Error creating order_week (week ${i + 1}/${numWeeks}) for product ${lineItem.product_id}:`, owErr);
        }
      }
    }

    // ── 8. Resolve bank account from payment method mapping ───────────────────
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

    // ── 9. Create invoice matching WC payment status ───────────────────────────
    const rawInvoiceStatus = mapWcStatusToInvoiceStatus(wcOrder.status, wcOrder.date_paid);
    const invoiceStatus = rawInvoiceStatus === "paid" && !resolvedBankAccountId ? "draft" : rawInvoiceStatus;
    const paymentDate = invoiceStatus === "paid" ? (wcOrder.date_paid ?? null) : null;

    const { data: invoiceRows, error: invoiceErr } = await supabase.rpc("create_invoice_atomic", {
      p_order_id: appOrderId,
      p_customer_name: customerName,
      p_customer_email: email,
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

    if (invoiceErr) {
      console.error("Error creating invoice:", invoiceErr);
    } else {
      const invoiceNumber: string = Array.isArray(invoiceRows) && invoiceRows.length > 0
        ? (invoiceRows[0] as { invoice_number: string }).invoice_number
        : "";
      if (invoiceNumber) {
        await supabase
          .from("orders")
          .update({ order_invoice_number: invoiceNumber })
          .eq("order_id", appOrderId);
      }
    }

    // ── 9. Update import log ───────────────────────────────────────────────────
    await supabase
      .from("woocommerce_order_imports")
      .update({ status: "pending_review", app_order_id: appOrderId, error_message: null })
      .eq("id", importId);

  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido al procesar el pedido";
    console.error("WooCommerce webhook processing error:", msg);
    await supabase
      .from("woocommerce_order_imports")
      .update({ status: "failed", error_message: msg })
      .eq("id", importId);
  }
}
