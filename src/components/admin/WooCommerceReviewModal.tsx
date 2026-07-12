import React, { useState, useEffect } from 'react';
import { X, User, MapPin, Mail, FileText, CircleAlert as AlertCircle, CircleCheck as CheckCircle, Loader as Loader2, ChevronDown, ShoppingCart, CreditCard, TriangleAlert as AlertTriangle, Save, ArrowRight, Check, Package, Pencil, Calendar, Truck, Circle as XCircle } from 'lucide-react';
import { supabase } from '../../config/supabase';
import { customerService } from '../../services/customerService';
import { orderService } from '../../services/orderService';
import { woocommerceConfigService } from '../../services/woocommerceConfigService';
import { manychatService } from '../../services/manychatService';
import { syncOrderToHolaEntregas, AutoSyncResult } from '../../utils/holaEntregasAutoSync';
import { CreateCustomerData, UpdateCustomerData, Customer } from '../../types/customer';
import { CreateOrderData, PendingOrderItem, SelectedWeek } from '../../types/order';
import { DeliveryOption } from '../../types/deliveryOption';
import { BankAccount } from '../../types/bankAccount';
import { MealPlan } from '../../types/mealPlan';
import { Week } from '../../types/week';
import {
  WooCommerceOrderImport,
  WooCommerceProductMapping,
  WooCommerceShippingMapping,
  WooCommercePaymentMapping,
} from '../../services/woocommerceConfigService';
import DelegacionDropdown from '../customers/DelegacionDropdown';
import PostalCodeSearchDropdown from '../customers/PostalCodeSearchDropdown';
import RestrictionSelector from '../customers/RestrictionSelector';

// ── Country codes ──────────────────────────────────────────────────────────────

const COUNTRY_CODES = [
  { code: '+52', country: 'MX', name: 'México' },
  { code: '+1',  country: 'US', name: 'Estados Unidos' },
  { code: '+1',  country: 'CA', name: 'Canadá' },
  { code: '+34', country: 'ES', name: 'España' },
  { code: '+57', country: 'CO', name: 'Colombia' },
  { code: '+54', country: 'AR', name: 'Argentina' },
];

// ── WC payload types ───────────────────────────────────────────────────────────

interface WcBilling {
  first_name: string;
  last_name:  string;
  email:      string;
  phone:      string;
  address_1:  string;
  address_2:  string;
  city:       string;
  postcode:   string;
  company:    string;
}

interface WcLineItem {
  id: number;
  name: string;
  product_id: number;
  variation_id: number;
  quantity: number;
  sku: string;
  total: string;
}

interface WcPayload {
  billing:        WcBilling;
  shipping_lines: { id: number; method_id: string; method_title: string; total: string }[];
  line_items:     WcLineItem[];
  meta_data:      { id: number; key: string; value: string | object }[];
  total:          string;
  shipping_total: string;
  date_paid:      string | null;
  customer_note:  string;
  payment_method: string;
  number:         string;
  date_created:   string | null;
}

// ── Props ──────────────────────────────────────────────────────────────────────

export interface WooCommerceReviewModalProps {
  imp:                    WooCommerceOrderImport;
  isTest:                 boolean;
  productMappings:        WooCommerceProductMapping[];
  shippingMappings:       WooCommerceShippingMapping[];
  shippingMappingsLoading?: boolean;
  paymentMappings:        WooCommercePaymentMapping[];
  mealPlans:              MealPlan[];
  deliveryOptions:        DeliveryOption[];
  bankAccounts:           BankAccount[];
  onClose:                () => void;
  onSuccess:              (appOrderId: string) => void;
}

// ── Week resolution helpers ────────────────────────────────────────────────────

/**
 * Given an order's creation date and the WC cutoff config (day=6=Saturday,
 * hour in local time), returns an array of N consecutive Sunday dates
 * (YYYY-MM-DD) starting from the correct delivery Sunday.
 *
 * Rules:
 * - If the order arrives on Saturday BEFORE the cutoff hour → next day (Sunday)
 * - If the order arrives on Saturday AT/AFTER the cutoff hour → Sunday in 8 days
 * - If the order arrives on Sunday → Sunday in 7 days (next Sunday)
 * - All other days → next coming Sunday
 */
function computeDeliverySundays(
  orderDate: Date,
  cutoffDay: number,  // 0=Sun … 6=Sat
  cutoffHour: number,
  numWeeks: number
): string[] {
  const dow = orderDate.getDay(); // 0=Sun, 6=Sat
  const hour = orderDate.getHours();

  let daysUntilFirstSunday: number;

  if (dow === cutoffDay && hour < cutoffHour) {
    // Saturday before cutoff → next day (Sunday)
    daysUntilFirstSunday = 1;
  } else if (dow === 0) {
    // Sunday → skip to next Sunday
    daysUntilFirstSunday = 7;
  } else {
    // Any other day (including Saturday at/after cutoff) → next Sunday
    daysUntilFirstSunday = (7 - dow) % 7 || 7;
  }

  const sundays: string[] = [];
  for (let i = 0; i < numWeeks; i++) {
    const d = new Date(orderDate);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + daysUntilFirstSunday + i * 7);
    sundays.push(d.toISOString().split('T')[0]);
  }
  return sundays;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function parseStreetAddress(addr: string): { street: string; number: string } {
  const s = addr.trim();
  if (!s) return { street: '', number: '' };
  const tokens = s.split(/\s+/);
  for (let i = tokens.length - 1; i >= 0; i--) {
    if (/^\d/.test(tokens[i])) {
      return { street: tokens.slice(0, i).join(' ') || s, number: tokens.slice(i).join(' ') };
    }
  }
  return { street: s, number: '' };
}

function extractMeta(metaData: { key: string; value: string | object }[], key: string): string {
  const found = metaData.find(m => m.key === key);
  return found ? String(found.value).trim() : '';
}

function formatCurrency(amount: string | number): string {
  const n = typeof amount === 'string' ? parseFloat(amount) : amount;
  return isNaN(n) ? '—' : `$${n.toFixed(2)}`;
}

/**
 * Build PendingOrderItem[] from a single WC line item + its product mapping,
 * for a specific week.
 */
function buildOrderItems(
  lineItems: WcLineItem[],
  productMappings: WooCommerceProductMapping[],
  weekId: string,
  weekName: string,
  mealPlans: MealPlan[]
): PendingOrderItem[] {
  const items: PendingOrderItem[] = [];
  let tempCounter = 0;

  for (const li of lineItems) {
    const mapping = productMappings.find(
      m => m.is_active && (
        m.wc_product_id === String(li.variation_id) ||
        m.wc_product_id === String(li.product_id) ||
        m.wc_product_id === li.sku
      )
    );
    if (!mapping) continue;

    const mealPlanPrice = mealPlans.find(p => p.meal_plans_id === mapping.meal_plan_id)?.meal_plans_price ?? 0;

    for (const day of mapping.days_of_week) {
      for (const mealType of mapping.meal_types) {
        items.push({
          tempId:          `wc-${li.id}-${weekId}-${day}-${mealType}-${tempCounter++}`,
          meal_plans_id:   mapping.meal_plan_id,
          meal_type:       mealType as any,
          day_of_week:     day as any,
          quantity:        li.quantity,
          meal_plan_name:  mapping.product_name,
          meal_plan_price: mealPlanPrice,
          week_name:       weekName,
          week_id:         weekId,
        });
      }
    }
  }
  return items;
}

// ── Component ──────────────────────────────────────────────────────────────────

const WooCommerceReviewModal: React.FC<WooCommerceReviewModalProps> = ({
  imp,
  isTest,
  productMappings,
  shippingMappings,
  shippingMappingsLoading = false,
  paymentMappings,
  mealPlans,
  deliveryOptions,
  bankAccounts,
  onClose,
  onSuccess,
}) => {
  const payload  = imp.raw_payload as WcPayload | null;
  const billing  = payload?.billing;
  const metaData = (payload?.meta_data ?? []) as { key: string; value: string | object }[];

  const delegacion  = extractMeta(metaData, '_billing_wooccm12');
  const allergyNote = extractMeta(metaData, '_billing_wooccm11');
  const parsedAddr  = parseStreetAddress(billing?.address_1 ?? '');
  const baseNotes   = allergyNote
    ? `Importado desde WooCommerce | ${allergyNote}`
    : 'Importado desde WooCommerce';

  // ── Resolve shipping / payment from WC payload ─────────────────────────────
  const wcShippingTotal = parseFloat(
    payload?.shipping_total ?? payload?.shipping_lines?.[0]?.total ?? '0'
  ) || 0;
  const shippingMapping = shippingMappings.find(
    m => m.is_active && Number(m.shipping_total).toFixed(2) === wcShippingTotal.toFixed(2)
  ) ?? null;
  const resolvedDeliveryOption: DeliveryOption | null = shippingMapping
    ? deliveryOptions.find(d => d.delivery_options_id === shippingMapping.delivery_option_id) ?? null
    : null;

  const wcPaymentMethodId = payload?.payment_method ?? imp.payment_method ?? null;
  const paymentMapping    = wcPaymentMethodId
    ? paymentMappings.find(m => m.is_active && m.wc_method_id === wcPaymentMethodId) ?? null
    : null;
  const resolvedBankAccount: BankAccount | null = paymentMapping?.bank_account_id
    ? bankAccounts.find(b => b.id === paymentMapping.bank_account_id || b.account_id === paymentMapping.bank_account_id) ?? null
    : null;

  // ── Tab / wizard state ─────────────────────────────────────────────────────
  const [activeTab,    setActiveTab]    = useState<'customer' | 'order'>('customer');
  const [customerDone, setCustomerDone] = useState(false);
  const [savedCustomer, setSavedCustomer] = useState<Customer | null>(null);

  // ── Customer tab ───────────────────────────────────────────────────────────
  const [existingCustomer, setExistingCustomer] = useState<Customer | null | undefined>(undefined);
  const [customerLoading,  setCustomerLoading]  = useState(true);
  const [customerSaving,   setCustomerSaving]   = useState(false);
  const [customerError,    setCustomerError]    = useState<string | null>(null);
  const [customerErrors,   setCustomerErrors]   = useState<Record<string, string>>({});
  const [manychatDuplicateWarning, setManychatDuplicateWarning] = useState(false);

  const [customerForm, setCustomerForm] = useState<CreateCustomerData>({
    customer_name:                  billing?.first_name ?? '',
    customer_lastname:              billing?.last_name  ?? '',
    customer_email:                 billing?.email      ?? '',
    customer_phone:                 (billing?.phone ?? '').replace(/\D/g, ''),
    customer_street:                parsedAddr.street,
    customer_street_number:         parsedAddr.number,
    customer_interior_number:       billing?.address_2  ?? '',
    customer_colonia:               billing?.city       ?? '',
    customer_delegacion:            delegacion,
    customer_postal_code:           billing?.postcode   ?? '',
    customer_delivery_instructions: '',
    customer_restrictions:          [],
    customer_notes:                 baseNotes,
    country_code:                   '+52',
    billing_name:                   billing?.company || `${billing?.first_name ?? ''} ${billing?.last_name ?? ''}`.trim(),
    billing_street:                 parsedAddr.street,
    billing_exterior_number:        parsedAddr.number,
    billing_postal_code:            billing?.postcode ?? '',
    billing_municipality:           delegacion,
  });

  // ── Order tab state ────────────────────────────────────────────────────────
  const [selectedDeliveryOption, setSelectedDeliveryOption] = useState<DeliveryOption | null>(resolvedDeliveryOption);
  const [isPaid,       setIsPaid]       = useState<boolean>(!!payload?.date_paid);
  const [paymentDate,  setPaymentDate]  = useState<string>(
    payload?.date_paid ? payload.date_paid.split('T')[0] : new Date().toISOString().split('T')[0]
  );
  const [orderNotes, setOrderNotes] = useState<string>(() => {
    const parts = [`Pedido WooCommerce #${payload?.number ?? imp.wc_order_number}`];
    if (payload?.customer_note) parts.push(`Nota: ${payload.customer_note}`);
    if (allergyNote) parts.push(`Notas: ${allergyNote}`);
    return parts.join(' | ');
  });
  const [orderSaving, setOrderSaving] = useState(false);
  const [orderError,  setOrderError]  = useState<string | null>(null);
  const [syncResult,  setSyncResult]  = useState<AutoSyncResult | null>(null);

  // ── Week resolution state ──────────────────────────────────────────────────
  const [resolvedWeeks,    setResolvedWeeks]    = useState<Week[]>([]);
  const [weeksLoading,     setWeeksLoading]     = useState(false);
  const [unmappedProducts, setUnmappedProducts] = useState<string[]>([]);

  // ── Load existing customer ─────────────────────────────────────────────────
  useEffect(() => {
    const email = billing?.email;
    if (!email) { setCustomerLoading(false); setExistingCustomer(null); return; }
    (async () => {
      try {
        const { data } = await supabase
          .from('customers')
          .select('*')
          .eq('customer_email', email)
          .eq('is_test', false)
          .maybeSingle();
        const found = data as Customer | null;
        setExistingCustomer(found ?? null);
        if (found) {
          setSavedCustomer(found);
          setCustomerDone(true);
          setCustomerForm(prev => ({
            ...prev,
            customer_name:                  found.customer_name,
            customer_lastname:              found.customer_lastname,
            customer_email:                 found.customer_email,
            customer_phone:                 found.customer_phone,
            customer_street:                found.customer_street,
            customer_street_number:         found.customer_street_number,
            customer_interior_number:       found.customer_interior_number ?? '',
            customer_colonia:               found.customer_colonia,
            customer_delegacion:            found.customer_delegacion,
            customer_postal_code:           found.customer_postal_code,
            customer_delivery_instructions: found.customer_delivery_instructions ?? '',
            customer_restrictions:          found.customer_restrictions ?? [],
            customer_notes:                 found.customer_notes ?? '',
            country_code:                   found.country_code ?? '+52',
          }));
        }
      } catch {
        setExistingCustomer(null);
      } finally {
        setCustomerLoading(false);
      }
    })();
  }, [billing?.email]);

  // ── Resolve delivery weeks when order tab is opened ────────────────────────
  useEffect(() => {
    if (activeTab !== 'order') return;
    if (resolvedWeeks.length > 0) return;

    setWeeksLoading(true);
    (async () => {
      try {
        // Determine how many weeks from the product mappings (max of all line items)
        const lineItems = payload?.line_items ?? [];
        let maxNumWeeks = 1;
        for (const li of lineItems) {
          const mapping = productMappings.find(
            m => m.is_active && (
              m.wc_product_id === String(li.variation_id) ||
              m.wc_product_id === String(li.product_id) ||
              m.wc_product_id === li.sku
            )
          );
          if (mapping && mapping.num_weeks > maxNumWeeks) {
            maxNumWeeks = mapping.num_weeks;
          }
        }

        // Track unmapped products
        const unmapped = lineItems
          .filter(li => !productMappings.find(
            m => m.is_active && (
              m.wc_product_id === String(li.variation_id) ||
              m.wc_product_id === String(li.product_id) ||
              m.wc_product_id === li.sku
            )
          ))
          .map(li => li.name);
        setUnmappedProducts(unmapped);

        // Get WC config for cutoff day/hour
        const config = await woocommerceConfigService.getConfig();
        const cutoffDay  = config?.cutoff_day  ?? 6;
        const cutoffHour = config?.cutoff_hour ?? 11;

        // Use order creation date (or now if not present)
        const rawDate = payload?.date_created ?? imp.created_at ?? new Date().toISOString();
        const orderDate = new Date(rawDate);

        // Compute the target Sunday dates
        const sundays = computeDeliverySundays(orderDate, cutoffDay, cutoffHour, maxNumWeeks);

        // Look up weeks by week_date
        const { data: weekRows } = await supabase
          .from('weeks')
          .select('*')
          .in('week_date', sundays)
          .order('week_date', { ascending: true });

        // If a week doesn't exist for a Sunday, we need to note it
        const found = (weekRows ?? []) as Week[];

        // Sort by the order of sundays
        const sorted = sundays.map(s => found.find(w => w.week_date === s)).filter(Boolean) as Week[];

        setResolvedWeeks(sorted);
      } catch (e) {
        console.error('Error resolving weeks:', e);
      } finally {
        setWeeksLoading(false);
      }
    })();
  }, [activeTab]);

  // ── Sync resolved delivery option when mappings load ──────────────────────
  useEffect(() => {
    if (resolvedDeliveryOption && !selectedDeliveryOption) {
      setSelectedDeliveryOption(resolvedDeliveryOption);
    }
  }, [shippingMappings, deliveryOptions]);

  useEffect(() => {
    if (activeTab === 'order' && resolvedDeliveryOption && !selectedDeliveryOption) {
      setSelectedDeliveryOption(resolvedDeliveryOption);
    }
  }, [activeTab]);

  // ── Customer field change ──────────────────────────────────────────────────
  const handleCustomerFieldChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setCustomerForm(prev => ({ ...prev, [name]: value }));
    if (customerErrors[name]) setCustomerErrors(prev => ({ ...prev, [name]: '' }));
  };

  // ── Customer validation ────────────────────────────────────────────────────
  const validateCustomer = (): boolean => {
    const errs: Record<string, string> = {};
    if (!customerForm.customer_name.trim())      errs.customer_name      = 'El nombre es requerido';
    if (!customerForm.customer_lastname.trim())   errs.customer_lastname  = 'El apellido es requerido';
    if (!customerForm.customer_email.trim())      errs.customer_email     = 'El email es requerido';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerForm.customer_email)) errs.customer_email = 'Email inválido';
    if (!customerForm.customer_phone.trim())      errs.customer_phone     = 'El teléfono es requerido';
    else if (!/^\d{10}$/.test(customerForm.customer_phone)) errs.customer_phone = 'Debe tener 10 dígitos';
    if (!customerForm.customer_street.trim())     errs.customer_street    = 'La calle es requerida';
    if (!customerForm.customer_colonia.trim())    errs.customer_colonia   = 'La colonia es requerida';
    if (!customerForm.customer_delegacion.trim()) errs.customer_delegacion = 'La delegación es requerida';
    setCustomerErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // ── Save customer ──────────────────────────────────────────────────────────
  const handleSaveCustomer = async () => {
    if (!validateCustomer()) return;
    setCustomerSaving(true);
    setCustomerError(null);
    try {
      if (existingCustomer) {
        const updateData: UpdateCustomerData = {
          customer_name:                  customerForm.customer_name,
          customer_lastname:              customerForm.customer_lastname,
          customer_phone:                 customerForm.customer_phone,
          customer_street:                customerForm.customer_street,
          customer_street_number:         customerForm.customer_street_number,
          customer_interior_number:       customerForm.customer_interior_number,
          customer_colonia:               customerForm.customer_colonia,
          customer_delegacion:            customerForm.customer_delegacion,
          customer_postal_code:           customerForm.customer_postal_code,
          customer_delivery_instructions: customerForm.customer_delivery_instructions,
          customer_restrictions:          customerForm.customer_restrictions ?? [],
          customer_notes:                 customerForm.customer_notes,
          country_code:                   customerForm.country_code,
        };
        const updated = await customerService.updateCustomer(existingCustomer.id, updateData);
        setSavedCustomer(updated as Customer);
      } else {
        const createData: CreateCustomerData = {
          ...customerForm,
          ...(isTest ? { is_test: true } as any : {}),
        };
        const created = await customerService.createCustomer(createData);
        setSavedCustomer(created as Customer);

        // Attempt ManyChat contact creation for new customers (best-effort)
        if (customerForm.customer_phone.trim()) {
          const countryCode = (customerForm.country_code || '52').replace('+', '');
          const phone = `${countryCode}${customerForm.customer_phone.replace(/\D/g, '')}`;
          try {
            await manychatService.createContactAndTag(phone, customerForm.customer_name, customerForm.customer_lastname);
          } catch (mcErr: any) {
            const errMsg: string = mcErr?.message || '';
            if (errMsg.toLowerCase().includes('already') || errMsg.toLowerCase().includes('exist')) {
              setManychatDuplicateWarning(true);
            }
            // Non-duplicate errors are silently ignored — customer was saved successfully
          }
        }
      }
      setCustomerDone(true);
      setActiveTab('order');
    } catch (err) {
      setCustomerError(err instanceof Error ? err.message : 'Error al guardar el cliente');
    } finally {
      setCustomerSaving(false);
    }
  };

  // ── Create order ───────────────────────────────────────────────────────────
  const handleCreateOrder = async () => {
    if (!savedCustomer) { setOrderError('El cliente no ha sido guardado'); return; }
    if (resolvedWeeks.length === 0) { setOrderError('No se encontraron semanas para las fechas de entrega calculadas. Crea las semanas primero.'); return; }

    const lineItems = payload?.line_items ?? [];
    // Build all PendingOrderItems across all resolved weeks
    const allOrderItems: PendingOrderItem[] = [];
    const selectedWeeks: SelectedWeek[] = [];

    for (const week of resolvedWeeks) {
      const items = buildOrderItems(lineItems, productMappings, week.week_id, week.week_name, mealPlans);
      if (items.length === 0) continue;
      allOrderItems.push(...items);
      selectedWeeks.push({
        week: {
          id:        week.id,
          week_id:   week.week_id,
          week_name: week.week_name,
        },
      });
    }

    if (allOrderItems.length === 0) {
      setOrderError('No se pudieron mapear los productos del pedido. Verifica que los mapeos de productos estén configurados.');
      return;
    }

    // week_date is the delivery date for each week
    const weekDeliveryDates: Record<string, string> = {};
    for (const week of resolvedWeeks) {
      if (week.week_date) {
        weekDeliveryDates[week.week_id] = week.week_date;
      }
    }

    setOrderSaving(true);
    setOrderError(null);
    try {
      const customerName = `${savedCustomer.customer_name} ${savedCustomer.customer_lastname}`.trim();
      const orderTotal   = parseFloat(payload?.total ?? '0') || 0;

      const orderData: CreateOrderData = {
        customer_id:           savedCustomer.customer_id,
        order_customer_name:   customerName,
        order_customer_email:  savedCustomer.customer_email,
        order_total_price:     orderTotal,
        order_invoice_number:  '',
        order_status:          isPaid ? 'completed' : 'pending',
        order_notes:           orderNotes || null,
        ...(isTest ? { is_test: true } as any : {}),
      };

      const created = await orderService.createCompleteOrder(
        orderData as any,
        selectedWeeks as any,
        allOrderItems,
        selectedDeliveryOption,
        0,
        0,
        0,
        weekDeliveryDates,
        resolvedBankAccount ?? undefined,
        isPaid,
        isPaid ? paymentDate : undefined
      );

      await supabase
        .from('woocommerce_order_imports')
        .update({
          status:       isTest ? 'test_processed' : 'approved',
          app_order_id: created.order_id,
        })
        .eq('id', imp.id);

      // Auto-sync with Hola Entregas (non-blocking)
      const sync = await syncOrderToHolaEntregas(created.order_id, weekDeliveryDates);
      setSyncResult(sync);

      onSuccess(created.order_id);
    } catch (err) {
      setOrderError(err instanceof Error ? err.message : 'Error al crear el pedido');
    } finally {
      setOrderSaving(false);
    }
  };

  const selectedCountry = COUNTRY_CODES.find(c => c.code === customerForm.country_code) || COUNTRY_CODES[0];
  const lineItems = payload?.line_items ?? [];
  const canCreateOrder = resolvedWeeks.length > 0 && !weeksLoading;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[200] p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[94vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-gray-900">
                Revisar pedido WC #{imp.wc_order_number || imp.wc_order_id}
              </h2>
              {isTest && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium">Prueba</span>
              )}
            </div>
            {billing?.email && (
              <p className="text-sm text-gray-500 mt-0.5">{billing.email}</p>
            )}
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-100 flex-shrink-0 px-6">
          <button
            onClick={() => setActiveTab('customer')}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors -mb-px ${
              activeTab === 'customer'
                ? 'border-gray-900 text-gray-900'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <User className="w-4 h-4" />
            Cliente
            {customerDone && <Check className="w-3.5 h-3.5 text-green-600" />}
          </button>
          <button
            onClick={() => customerDone && setActiveTab('order')}
            disabled={!customerDone}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors -mb-px ${
              activeTab === 'order'
                ? 'border-gray-900 text-gray-900'
                : customerDone
                  ? 'border-transparent text-gray-500 hover:text-gray-700'
                  : 'border-transparent text-gray-300 cursor-not-allowed'
            }`}
          >
            <ShoppingCart className="w-4 h-4" />
            Pedido
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">

          {/* ── CUSTOMER TAB ── */}
          {activeTab === 'customer' && (
            <div className="p-6 space-y-6">
              {customerLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                </div>
              ) : (
                <div className="space-y-6">

                  {existingCustomer ? (
                    <div className="flex items-start gap-3 p-4 bg-green-50 border border-green-200 rounded-xl">
                      <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-semibold text-green-900">Cliente existente encontrado</p>
                        <p className="text-sm text-green-700 mt-0.5">Revisa y actualiza los datos si es necesario antes de continuar.</p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl">
                      <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                      <p className="text-sm text-amber-800">Cliente nuevo — revisa y guarda los datos antes de continuar.</p>
                    </div>
                  )}

                  {customerError && (
                    <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
                      <AlertCircle className="w-4 h-4 flex-shrink-0" />
                      {customerError}
                    </div>
                  )}

                  {manychatDuplicateWarning && (
                    <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
                      <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-medium">Contacto de ManyChat ya existe</p>
                        <p className="text-amber-700 mt-0.5">El cliente fue guardado correctamente. El número de teléfono ya tenía un contacto en ManyChat.</p>
                      </div>
                    </div>
                  )}

                  {/* Personal info */}
                  <section>
                    <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-1.5">
                      <User className="w-4 h-4" /> Información personal
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField label="Nombre *" error={customerErrors.customer_name}>
                        <input name="customer_name" value={customerForm.customer_name} onChange={handleCustomerFieldChange}
                          className={fc(customerErrors.customer_name)} placeholder="Nombre" />
                      </FormField>
                      <FormField label="Apellido *" error={customerErrors.customer_lastname}>
                        <input name="customer_lastname" value={customerForm.customer_lastname} onChange={handleCustomerFieldChange}
                          className={fc(customerErrors.customer_lastname)} placeholder="Apellido" />
                      </FormField>
                      <FormField label="Email *" error={customerErrors.customer_email}>
                        <div className="relative">
                          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                          <input
                            name="customer_email" type="email"
                            value={customerForm.customer_email}
                            onChange={handleCustomerFieldChange}
                            disabled={!!existingCustomer}
                            className={`${fc(customerErrors.customer_email)} pl-9 ${existingCustomer ? 'bg-gray-50 text-gray-500' : ''}`}
                            placeholder="email@ejemplo.com"
                          />
                        </div>
                      </FormField>
                      <FormField label="Teléfono *" error={customerErrors.customer_phone}>
                        <div className={`flex border rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-gray-900 ${customerErrors.customer_phone ? 'border-red-400' : 'border-gray-300'}`}>
                          <select name="country_code" value={customerForm.country_code} onChange={handleCustomerFieldChange}
                            className="appearance-none bg-gray-50 border-r border-gray-300 px-2 py-2.5 pr-6 text-xs font-medium text-gray-700 focus:outline-none">
                            {COUNTRY_CODES.map(c => (
                              <option key={`${c.code}-${c.country}`} value={c.code}>{c.name}</option>
                            ))}
                          </select>
                          <ChevronDown className="self-center -ml-5 w-3 h-3 text-gray-400 pointer-events-none mr-1" />
                          <span className="flex items-center px-2 bg-gray-50 border-r border-gray-300 text-xs font-medium text-gray-600">{selectedCountry.code}</span>
                          <input name="customer_phone" type="tel" value={customerForm.customer_phone} onChange={handleCustomerFieldChange}
                            maxLength={10} className="flex-1 px-3 py-2.5 focus:outline-none text-sm" placeholder="5512345678" />
                        </div>
                      </FormField>
                    </div>
                  </section>

                  {/* Address */}
                  <section>
                    <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-1.5">
                      <MapPin className="w-4 h-4" /> Dirección de entrega
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <FormField label="Calle *" error={customerErrors.customer_street} className="md:col-span-2">
                        <input name="customer_street" value={customerForm.customer_street} onChange={handleCustomerFieldChange}
                          className={fc(customerErrors.customer_street)} placeholder="Nombre de la calle" />
                      </FormField>
                      <FormField label="Núm. Exterior" error={customerErrors.customer_street_number}>
                        <input name="customer_street_number" value={customerForm.customer_street_number} onChange={handleCustomerFieldChange}
                          className={fc(customerErrors.customer_street_number)} placeholder="123" />
                      </FormField>
                      <FormField label="Núm. Interior">
                        <input name="customer_interior_number" value={customerForm.customer_interior_number ?? ''} onChange={handleCustomerFieldChange}
                          className={fc()} placeholder="Apt 4B" />
                      </FormField>
                      <FormField label="Colonia *" error={customerErrors.customer_colonia}>
                        <input name="customer_colonia" value={customerForm.customer_colonia} onChange={handleCustomerFieldChange}
                          className={fc(customerErrors.customer_colonia)} placeholder="Colonia" />
                      </FormField>
                      <FormField label="Delegación *" error={customerErrors.customer_delegacion}>
                        <DelegacionDropdown
                          selectedDelegacion={customerForm.customer_delegacion}
                          onDelegacionSelect={d => {
                            setCustomerForm(p => ({ ...p, customer_delegacion: d, billing_municipality: d }));
                            if (customerErrors.customer_delegacion) setCustomerErrors(p => ({ ...p, customer_delegacion: '' }));
                          }}
                          error={customerErrors.customer_delegacion}
                          required
                        />
                      </FormField>
                      <FormField label="Código Postal" error={customerErrors.customer_postal_code}>
                        <PostalCodeSearchDropdown
                          selectedPostalCode={customerForm.customer_postal_code}
                          onPostalCodeSelect={(pc, neighborhood) => {
                            setCustomerForm(p => ({ ...p, customer_postal_code: pc, billing_postal_code: pc }));
                            if (neighborhood && !customerForm.customer_colonia.trim()) setCustomerForm(p => ({ ...p, customer_colonia: neighborhood }));
                            if (customerErrors.customer_postal_code) setCustomerErrors(p => ({ ...p, customer_postal_code: '' }));
                          }}
                          error={customerErrors.customer_postal_code}
                        />
                      </FormField>
                    </div>
                    <div className="mt-4">
                      <FormField label="Instrucciones de entrega">
                        <textarea name="customer_delivery_instructions" value={customerForm.customer_delivery_instructions ?? ''} onChange={handleCustomerFieldChange}
                          rows={2} className={`${fc()} resize-none`} placeholder="Instrucciones especiales..." />
                      </FormField>
                    </div>
                  </section>

                  {/* Restrictions */}
                  <section>
                    <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4" /> Restricciones dietéticas
                    </h3>
                    <RestrictionSelector
                      selectedRestrictions={customerForm.customer_restrictions ?? []}
                      onRestrictionsChange={v => setCustomerForm(p => ({ ...p, customer_restrictions: v }))}
                    />
                  </section>

                  {/* Notes */}
                  <section>
                    <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-1.5">
                      <FileText className="w-4 h-4" /> Notas del cliente
                    </h3>
                    <FormField label="Notas">
                      <textarea name="customer_notes" value={customerForm.customer_notes ?? ''} onChange={handleCustomerFieldChange}
                        rows={2} className={`${fc()} resize-none`} placeholder="Observaciones sobre el cliente..." />
                    </FormField>
                  </section>

                  <button
                    onClick={handleSaveCustomer}
                    disabled={customerSaving}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gray-900 text-white rounded-xl hover:bg-gray-800 disabled:opacity-50 transition-colors text-sm font-medium"
                  >
                    {customerSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : existingCustomer ? <Pencil className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                    {customerSaving
                      ? 'Guardando...'
                      : existingCustomer
                        ? 'Guardar cambios y continuar'
                        : 'Crear cliente y continuar'
                    }
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ── ORDER TAB ── */}
          {activeTab === 'order' && (
            <div className="p-6 space-y-5">

              {/* Customer bar */}
              {savedCustomer && (
                <div className="flex items-center gap-3 p-3 bg-gray-50 border border-gray-200 rounded-xl">
                  <User className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <span className="text-sm font-medium text-gray-900">{savedCustomer.customer_name} {savedCustomer.customer_lastname}</span>
                    <span className="text-xs text-gray-500 ml-2">{savedCustomer.customer_id} · {savedCustomer.customer_email}</span>
                  </div>
                  <button onClick={() => setActiveTab('customer')} className="text-xs text-gray-400 hover:text-gray-700 transition-colors flex items-center gap-1">
                    <Pencil className="w-3 h-3" /> Editar
                  </button>
                </div>
              )}

              {orderError && (
                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {orderError}
                </div>
              )}

              {syncResult && !syncResult.skipped && syncResult.results.length > 0 && (
                <div className={`p-3 rounded-xl border text-sm ${syncResult.results.every(r => r.success) ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'}`}>
                  <div className="flex items-center gap-2 mb-1.5">
                    <Truck className={`w-4 h-4 flex-shrink-0 ${syncResult.results.every(r => r.success) ? 'text-green-600' : 'text-amber-600'}`} />
                    <span className={`font-medium ${syncResult.results.every(r => r.success) ? 'text-green-800' : 'text-amber-800'}`}>
                      {syncResult.results.every(r => r.success) ? 'Sincronizado con Hola Entregas' : 'Error al sincronizar con Hola Entregas'}
                    </span>
                  </div>
                  <div className="space-y-1 pl-6">
                    {syncResult.results.map((r, i) => (
                      <div key={i} className="flex items-center gap-2">
                        {r.success
                          ? <CheckCircle className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                          : <XCircle className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
                        }
                        <span className={`text-xs ${r.success ? 'text-green-700' : 'text-amber-700'}`}>
                          {r.date}{!r.success && r.error ? `: ${r.error}` : ''}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* WC line items summary */}
              <section>
                <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-1.5">
                  <Package className="w-4 h-4" /> Productos del pedido
                </h3>
                {lineItems.length > 0 ? (
                  <div className="border border-gray-200 rounded-xl overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">Producto</th>
                          <th className="text-center px-3 py-2.5 text-xs font-medium text-gray-500">Cant.</th>
                          <th className="text-right px-4 py-2.5 text-xs font-medium text-gray-500">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {lineItems.map(li => {
                          const mapping = productMappings.find(
                            m => m.is_active && (
                              m.wc_product_id === String(li.variation_id) ||
                              m.wc_product_id === String(li.product_id) ||
                              m.wc_product_id === li.sku
                            )
                          );
                          const plan = mapping ? mealPlans.find(p => p.meal_plans_id === mapping.meal_plan_id) : null;
                          return (
                            <tr key={li.id} className="bg-white">
                              <td className="px-4 py-3">
                                <p className="font-medium text-gray-900">{li.name}</p>
                                {plan ? (
                                  <p className="text-xs text-gray-400 mt-0.5">→ {plan.meal_plans_name} · {mapping?.num_weeks} sem.</p>
                                ) : (
                                  <p className="text-xs text-amber-500 mt-0.5 flex items-center gap-1">
                                    <AlertTriangle className="w-3 h-3" /> Sin mapeo
                                  </p>
                                )}
                              </td>
                              <td className="px-3 py-3 text-center text-gray-700">{li.quantity}</td>
                              <td className="px-4 py-3 text-right text-gray-900 font-medium">{formatCurrency(li.total)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot className="bg-gray-50 border-t border-gray-200">
                        <tr>
                          <td colSpan={2} className="px-4 py-2.5 text-sm font-semibold text-gray-700 text-right">Total WooCommerce</td>
                          <td className="px-4 py-2.5 text-sm font-bold text-gray-900 text-right">{formatCurrency(payload?.total ?? '0')}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 p-3 bg-gray-50 rounded-xl">Sin productos en el payload</p>
                )}
                {unmappedProducts.length > 0 && (
                  <div className="mt-2 flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl">
                    <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-medium text-amber-800">Productos sin mapeo (no generarán semanas):</p>
                      <p className="text-xs text-amber-700 mt-0.5">{unmappedProducts.join(', ')}</p>
                    </div>
                  </div>
                )}
              </section>

              {/* Resolved weeks */}
              <section>
                <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-1.5">
                  <Calendar className="w-4 h-4" /> Semanas asignadas automáticamente
                </h3>
                {weeksLoading ? (
                  <div className="flex items-center gap-2 p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-500">
                    <Loader2 className="w-4 h-4 animate-spin" /> Calculando semanas...
                  </div>
                ) : resolvedWeeks.length > 0 ? (
                  <div className="border border-gray-200 rounded-xl overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">Semana</th>
                          <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">Fecha de entrega</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {resolvedWeeks.map(w => (
                          <tr key={w.week_id} className="bg-white">
                            <td className="px-4 py-2.5 font-medium text-gray-900">{w.week_name}</td>
                            <td className="px-4 py-2.5 text-gray-600">{w.week_date ?? '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-xl">
                    <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-medium text-red-800">No se encontraron semanas para las fechas calculadas.</p>
                      <p className="text-xs text-red-700 mt-0.5">Crea las semanas correspondientes en el módulo de Semanas antes de procesar este pedido.</p>
                    </div>
                  </div>
                )}
              </section>

              {/* Delivery option */}
              <section>
                <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-1.5">
                  <ShoppingCart className="w-4 h-4" /> Opción de envío
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1.5">Monto de envío WooCommerce</label>
                    <div className="px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-700">
                      {payload?.shipping_lines?.[0]?.method_title
                        ? `${payload.shipping_lines[0].method_title} — $${wcShippingTotal.toFixed(2)}`
                        : `$${wcShippingTotal.toFixed(2)}`}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1.5">Opción de entrega asignada</label>
                    <select
                      value={selectedDeliveryOption?.delivery_options_id ?? ''}
                      onChange={e => {
                        const opt = deliveryOptions.find(d => d.delivery_options_id === e.target.value) ?? null;
                        setSelectedDeliveryOption(opt);
                      }}
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                    >
                      <option value="">Sin asignar</option>
                      {deliveryOptions.map(d => (
                        <option key={d.delivery_options_id} value={d.delivery_options_id}>{d.delivery_options_name}</option>
                      ))}
                    </select>
                    {shippingMappingsLoading && (
                      <p className="text-xs text-gray-400 mt-1">Cargando mapeos...</p>
                    )}
                    {!shippingMappingsLoading && !selectedDeliveryOption && wcShippingTotal > 0 && (
                      <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        Sin mapeo para monto ${wcShippingTotal.toFixed(2)}
                      </p>
                    )}
                  </div>
                </div>
              </section>

              {/* Payment info */}
              <section>
                <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-1.5">
                  <CreditCard className="w-4 h-4" /> Pago
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1.5">Método de pago WC</label>
                    <div className="px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-700">
                      {imp.payment_method_title ?? wcPaymentMethodId ?? '—'}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1.5">Cuenta bancaria</label>
                    <div className={`px-3 py-2.5 border rounded-xl text-sm ${resolvedBankAccount ? 'bg-gray-50 border-gray-200 text-gray-700' : 'bg-amber-50 border-amber-200 text-amber-700'}`}>
                      {resolvedBankAccount
                        ? resolvedBankAccount.account_name
                        : <span className="flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5" /> Sin mapeo de pago</span>
                      }
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 mb-3">
                  <button
                    type="button"
                    onClick={() => setIsPaid(p => !p)}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${isPaid ? 'bg-green-600' : 'bg-gray-300'}`}
                  >
                    <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${isPaid ? 'translate-x-4' : 'translate-x-1'}`} />
                  </button>
                  <span className="text-sm text-gray-700">{isPaid ? 'Pagado' : 'Pendiente de pago'}</span>
                </div>

                {isPaid && (
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1.5">Fecha de pago</label>
                    <input
                      type="date"
                      value={paymentDate}
                      onChange={e => setPaymentDate(e.target.value)}
                      className="px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                    />
                  </div>
                )}
              </section>

              {/* Order notes */}
              <section>
                <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1.5">
                  <FileText className="w-4 h-4" /> Notas del pedido
                </h3>
                <textarea
                  value={orderNotes}
                  onChange={e => setOrderNotes(e.target.value)}
                  rows={3}
                  maxLength={500}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 resize-none"
                  placeholder="Notas adicionales del pedido..."
                />
              </section>

              {/* Create */}
              <button
                onClick={handleCreateOrder}
                disabled={orderSaving || !canCreateOrder}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gray-900 text-white rounded-xl hover:bg-gray-800 disabled:opacity-50 transition-colors text-sm font-medium"
              >
                {orderSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShoppingCart className="w-4 h-4" />}
                {orderSaving ? 'Creando pedido...' : 'Crear pedido'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ── Small helpers ──────────────────────────────────────────────────────────────

const FormField: React.FC<{
  label: string;
  error?: string;
  children: React.ReactNode;
  className?: string;
}> = ({ label, error, children, className }) => (
  <div className={className}>
    <label className="block text-xs font-medium text-gray-700 mb-1">{label}</label>
    {children}
    {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
  </div>
);

const fc = (error?: string) =>
  `w-full px-3 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 transition-all ${
    error ? 'border-red-400' : 'border-gray-300'
  }`;

export default WooCommerceReviewModal;