import { supabase } from '../config/supabase';

export interface WooCommerceConfig {
  id: string;
  store_url: string;
  consumer_key: string;
  consumer_secret: string;
  webhook_secret: string;
  cutoff_day: number;
  cutoff_hour: number;
  test_mode: boolean;
  is_active: boolean;
  last_sync_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface WooCommerceConfigForm {
  store_url: string;
  consumer_key: string;
  consumer_secret: string;
  webhook_secret: string;
  cutoff_day: number;
  cutoff_hour: number;
  test_mode: boolean;
}

export interface WooCommerceProductMapping {
  id: string;
  wc_product_id: string;
  product_name: string;
  meal_plan_id: string;
  days_of_week: string[];
  meal_types: string[];
  num_weeks: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface WooCommerceProductMappingForm {
  wc_product_id: string;
  product_name: string;
  meal_plan_id: string;
  days_of_week: string[];
  meal_types: string[];
  num_weeks: number;
  is_active: boolean;
}

export interface WooCommerceShippingMapping {
  id: string;
  shipping_total: number;
  method_title: string;
  delivery_option_id: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface WooCommerceShippingMappingForm {
  shipping_total: number;
  method_title: string;
  delivery_option_id: string;
  is_active: boolean;
}

export interface WooCommercePaymentMapping {
  id: string;
  wc_method_id: string;
  method_title: string;
  internal_label: string;
  bank_account_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface WooCommercePaymentMappingForm {
  wc_method_id: string;
  method_title: string;
  internal_label: string;
  bank_account_id: string | null;
  is_active: boolean;
}

export interface WooCommerceOrderImport {
  id: string;
  wc_order_id: string;
  wc_order_number: string;
  app_order_id: string | null;
  status: 'pending_review' | 'approved' | 'failed' | 'duplicate' | 'test' | 'test_processed';
  customer_email: string;
  raw_payload: Record<string, unknown> | null;
  error_message: string | null;
  imported_at: string;
  created_at: string;
  // Financial fields extracted at import time
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

export interface WooCommerceTestCustomer {
  id: string;
  customer_id: string;
  customer_name: string;
  customer_lastname: string;
  customer_email: string;
  customer_phone: string;
  customer_street: string;
  customer_street_number: string;
  customer_interior_number: string;
  customer_colonia: string;
  customer_delegacion: string;
  customer_postal_code: string;
  customer_delivery_instructions: string;
  customer_notes: string;
  billing_name: string;
  billing_street: string;
  billing_postal_code: string;
  billing_neighborhood: string;
  billing_state: string;
  billing_municipality: string;
  created_at: string;
}

export interface WooCommerceTestOrder {
  id: string;
  order_id: string;
  customer_id: string;
  order_customer_name: string;
  order_customer_email: string;
  order_total_price: number;
  order_status: string;
  order_notes: string;
  delivery_option_id: string | null;
  created_at: string;
}

export interface WooCommerceTestOrderWeek {
  order_week_id: string;
  order_id: string;
  week_id: string;
  meal_plan_id: string | null;
  delivery_date: string | null;
  meal_plan_name: string | null;
  week_name: string | null;
  lunes_desayuno_qty: number;
  lunes_colacion_am_qty: number;
  lunes_comida_qty: number;
  lunes_colacion_pm_qty: number;
  lunes_cena_qty: number;
  martes_desayuno_qty: number;
  martes_colacion_am_qty: number;
  martes_comida_qty: number;
  martes_colacion_pm_qty: number;
  martes_cena_qty: number;
  miercoles_desayuno_qty: number;
  miercoles_colacion_am_qty: number;
  miercoles_comida_qty: number;
  miercoles_colacion_pm_qty: number;
  miercoles_cena_qty: number;
  jueves_desayuno_qty: number;
  jueves_colacion_am_qty: number;
  jueves_comida_qty: number;
  jueves_colacion_pm_qty: number;
  jueves_cena_qty: number;
  viernes_desayuno_qty: number;
  viernes_colacion_am_qty: number;
  viernes_comida_qty: number;
  viernes_colacion_pm_qty: number;
  viernes_cena_qty: number;
}

class WooCommerceConfigService {
  private configCache: WooCommerceConfig | null = null;
  private cacheTimestamp = 0;
  private readonly CACHE_DURATION = 5 * 60 * 1000;

  // ── Config ──────────────────────────────────────────────────────────────

  async getConfig(): Promise<WooCommerceConfig | null> {
    const now = Date.now();
    if (this.configCache && now - this.cacheTimestamp < this.CACHE_DURATION) {
      return this.configCache;
    }
    const { data, error } = await supabase
      .from('woocommerce_config')
      .select('*')
      .eq('is_active', true)
      .maybeSingle();
    if (error) throw new Error(`Error al cargar configuración de WooCommerce: ${error.message}`);
    this.configCache = data;
    this.cacheTimestamp = now;
    return data;
  }

  async getConfigForm(): Promise<WooCommerceConfigForm> {
    const config = await this.getConfig();
    if (!config) {
      return { store_url: '', consumer_key: '', consumer_secret: '', webhook_secret: '', cutoff_day: 5, cutoff_hour: 12, test_mode: false };
    }
    return {
      store_url: config.store_url,
      consumer_key: config.consumer_key,
      consumer_secret: config.consumer_secret,
      webhook_secret: config.webhook_secret,
      cutoff_day: config.cutoff_day,
      cutoff_hour: config.cutoff_hour,
      test_mode: config.test_mode ?? false,
    };
  }

  async saveConfig(form: WooCommerceConfigForm): Promise<void> {
    this.clearCache();
    const existing = await this.getConfig();
    if (existing) {
      const { error } = await supabase
        .from('woocommerce_config')
        .update({ ...form, updated_at: new Date().toISOString() })
        .eq('id', existing.id);
      if (error) throw new Error(`Error al guardar configuración: ${error.message}`);
    } else {
      const { error } = await supabase
        .from('woocommerce_config')
        .insert([{ ...form, is_active: true }]);
      if (error) throw new Error(`Error al crear configuración: ${error.message}`);
    }
    this.clearCache();
  }

  async isConfigured(): Promise<boolean> {
    try {
      const config = await this.getConfig();
      return !!(config?.store_url && config?.consumer_key && config?.consumer_secret);
    } catch {
      return false;
    }
  }

  clearCache(): void {
    this.configCache = null;
    this.cacheTimestamp = 0;
  }

  getWebhookUrl(): string {
    return `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/woocommerce-webhook`;
  }

  // ── Product Mappings ─────────────────────────────────────────────────────

  async getMappings(): Promise<WooCommerceProductMapping[]> {
    const { data, error } = await supabase
      .from('woocommerce_product_mappings')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw new Error(`Error al cargar mapeos: ${error.message}`);
    return data ?? [];
  }

  async createMapping(form: WooCommerceProductMappingForm): Promise<WooCommerceProductMapping> {
    const { data, error } = await supabase
      .from('woocommerce_product_mappings')
      .insert([form])
      .select()
      .single();
    if (error) {
      if (error.code === '23505') throw new Error('Ya existe un mapeo con ese ID de producto de WooCommerce');
      throw new Error(`Error al crear mapeo: ${error.message}`);
    }
    return data;
  }

  async updateMapping(id: string, form: Partial<WooCommerceProductMappingForm>): Promise<void> {
    const { error } = await supabase
      .from('woocommerce_product_mappings')
      .update({ ...form, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) {
      if (error.code === '23505') throw new Error('Ya existe un mapeo con ese ID de producto de WooCommerce');
      throw new Error(`Error al actualizar mapeo: ${error.message}`);
    }
  }

  async deleteMapping(id: string): Promise<void> {
    const { error } = await supabase
      .from('woocommerce_product_mappings')
      .delete()
      .eq('id', id);
    if (error) throw new Error(`Error al eliminar mapeo: ${error.message}`);
  }

  // ── Shipping Mappings ────────────────────────────────────────────────────

  async getShippingMappings(): Promise<WooCommerceShippingMapping[]> {
    const { data, error } = await supabase
      .from('woocommerce_shipping_mappings')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw new Error(`Error al cargar mapeos de envío: ${error.message}`);
    return data ?? [];
  }

  async createShippingMapping(form: WooCommerceShippingMappingForm): Promise<WooCommerceShippingMapping> {
    const { data, error } = await supabase
      .from('woocommerce_shipping_mappings')
      .insert([form])
      .select()
      .single();
    if (error) {
      if (error.code === '23505') throw new Error('Ya existe un mapeo con ese método de envío de WooCommerce');
      throw new Error(`Error al crear mapeo de envío: ${error.message}`);
    }
    return data;
  }

  async updateShippingMapping(id: string, form: Partial<WooCommerceShippingMappingForm>): Promise<void> {
    const { error } = await supabase
      .from('woocommerce_shipping_mappings')
      .update({ ...form, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) {
      if (error.code === '23505') throw new Error('Ya existe un mapeo con ese método de envío de WooCommerce');
      throw new Error(`Error al actualizar mapeo de envío: ${error.message}`);
    }
  }

  async deleteShippingMapping(id: string): Promise<void> {
    const { error } = await supabase
      .from('woocommerce_shipping_mappings')
      .delete()
      .eq('id', id);
    if (error) throw new Error(`Error al eliminar mapeo de envío: ${error.message}`);
  }

  // ── Payment Mappings ─────────────────────────────────────────────────────

  async getPaymentMappings(): Promise<WooCommercePaymentMapping[]> {
    const { data, error } = await supabase
      .from('woocommerce_payment_mappings')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw new Error(`Error al cargar mapeos de pago: ${error.message}`);
    return data ?? [];
  }

  async createPaymentMapping(form: WooCommercePaymentMappingForm): Promise<WooCommercePaymentMapping> {
    const { data, error } = await supabase
      .from('woocommerce_payment_mappings')
      .insert([form])
      .select()
      .single();
    if (error) {
      if (error.code === '23505') throw new Error('Ya existe un mapeo con ese ID de método de pago');
      throw new Error(`Error al crear mapeo de pago: ${error.message}`);
    }
    return data;
  }

  async updatePaymentMapping(id: string, form: Partial<WooCommercePaymentMappingForm>): Promise<void> {
    const { error } = await supabase
      .from('woocommerce_payment_mappings')
      .update({ ...form, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) {
      if (error.code === '23505') throw new Error('Ya existe un mapeo con ese ID de método de pago');
      throw new Error(`Error al actualizar mapeo de pago: ${error.message}`);
    }
  }

  async deletePaymentMapping(id: string): Promise<void> {
    const { error } = await supabase
      .from('woocommerce_payment_mappings')
      .delete()
      .eq('id', id);
    if (error) throw new Error(`Error al eliminar mapeo de pago: ${error.message}`);
  }

  // ── Order Imports ────────────────────────────────────────────────────────

  async getOrderImports(limit = 50): Promise<WooCommerceOrderImport[]> {
    const { data, error } = await supabase
      .from('woocommerce_order_imports')
      .select('*')
      .order('wc_date_created', { ascending: false, nullsFirst: false })
      .limit(limit);
    if (error) throw new Error(`Error al cargar importaciones: ${error.message}`);
    return (data ?? []) as WooCommerceOrderImport[];
  }

  async fetchOrdersFromApi(options?: { perPage?: number; status?: string }): Promise<{
    fetched: number;
    new: number;
    duplicates: number;
    test_mode: boolean;
    errors?: string[];
  }> {
    const { data, error } = await supabase.functions.invoke('woocommerce-fetch-orders', {
      body: {
        per_page: options?.perPage ?? 10,
        status: options?.status ?? 'processing',
      },
    });
    if (error) throw new Error(`Error al importar pedidos: ${error.message}`);
    if (!data?.success) throw new Error(data?.error ?? 'Error desconocido al importar pedidos');
    return data;
  }

  async processTestOrder(importId: string): Promise<{ app_order_id: string; customer_id: string }> {
    const { data, error } = await supabase.functions.invoke('woocommerce-process-test-order', {
      body: { import_id: importId },
    });
    if (error) throw new Error(`Error al procesar pedido de prueba: ${error.message}`);
    if (!data?.success) throw new Error(data?.error ?? 'Error desconocido al procesar pedido de prueba');
    return { app_order_id: data.app_order_id, customer_id: data.customer_id };
  }

  // ── Test Data ────────────────────────────────────────────────────────────

  async getTestCustomers(): Promise<WooCommerceTestCustomer[]> {
    const { data, error } = await supabase
      .from('customers')
      .select(`id, customer_id, customer_name, customer_lastname, customer_email, customer_phone,
        customer_street, customer_street_number, customer_interior_number, customer_colonia,
        customer_delegacion, customer_postal_code, customer_delivery_instructions, customer_notes,
        billing_name, billing_street, billing_postal_code, billing_neighborhood,
        billing_state, billing_municipality, created_at`)
      .eq('is_test', true)
      .order('created_at', { ascending: false });
    if (error) throw new Error(`Error al cargar clientes de prueba: ${error.message}`);
    return (data ?? []) as WooCommerceTestCustomer[];
  }

  async getTestOrders(): Promise<WooCommerceTestOrder[]> {
    const { data, error } = await supabase
      .from('orders')
      .select('id, order_id, customer_id, order_customer_name, order_customer_email, order_total_price, order_status, order_notes, delivery_option_id, created_at')
      .eq('is_test', true)
      .order('created_at', { ascending: false });
    if (error) throw new Error(`Error al cargar pedidos de prueba: ${error.message}`);
    return (data ?? []) as WooCommerceTestOrder[];
  }

  async getTestOrderWeeks(orderId: string): Promise<WooCommerceTestOrderWeek[]> {
    const { data, error } = await supabase
      .from('order_weeks')
      .select(`order_week_id, order_id, week_id, meal_plan_id, delivery_date,
        lunes_desayuno_qty, lunes_colacion_am_qty, lunes_comida_qty, lunes_colacion_pm_qty, lunes_cena_qty,
        martes_desayuno_qty, martes_colacion_am_qty, martes_comida_qty, martes_colacion_pm_qty, martes_cena_qty,
        miercoles_desayuno_qty, miercoles_colacion_am_qty, miercoles_comida_qty, miercoles_colacion_pm_qty, miercoles_cena_qty,
        jueves_desayuno_qty, jueves_colacion_am_qty, jueves_comida_qty, jueves_colacion_pm_qty, jueves_cena_qty,
        viernes_desayuno_qty, viernes_colacion_am_qty, viernes_comida_qty, viernes_colacion_pm_qty, viernes_cena_qty,
        weeks!inner(week_name), meal_plans(meal_plans_name)`)
      .eq('order_id', orderId)
      .order('delivery_date', { ascending: true });
    if (error) throw new Error(`Error al cargar semanas del pedido: ${error.message}`);
    return ((data ?? []) as unknown[]).map((row: unknown) => {
      const r = row as Record<string, unknown>;
      return {
        ...r,
        week_name: (r.weeks as Record<string, unknown> | null)?.week_name ?? null,
        meal_plan_name: (r.meal_plans as Record<string, unknown> | null)?.meal_plans_name ?? null,
      } as WooCommerceTestOrderWeek;
    });
  }

  async deleteTestCustomer(customerId: string): Promise<void> {
    const { data: testOrders } = await supabase
      .from('orders')
      .select('order_id')
      .eq('customer_id', customerId)
      .eq('is_test', true);

    if (testOrders && testOrders.length > 0) {
      const orderIds = testOrders.map((o: { order_id: string }) => o.order_id);
      await supabase.from('order_weeks').delete().in('order_id', orderIds);
      await supabase.from('invoices').delete().in('order_id', orderIds);
      await supabase.from('orders').delete().in('order_id', orderIds);
    }

    const { error } = await supabase
      .from('customers')
      .delete()
      .eq('customer_id', customerId)
      .eq('is_test', true);
    if (error) throw new Error(`Error al eliminar cliente de prueba: ${error.message}`);
  }

  async deleteTestOrder(orderId: string): Promise<void> {
    await supabase.from('order_weeks').delete().eq('order_id', orderId);
    await supabase.from('invoices').delete().eq('order_id', orderId);
    const { error } = await supabase
      .from('orders')
      .delete()
      .eq('order_id', orderId)
      .eq('is_test', true);
    if (error) throw new Error(`Error al eliminar pedido de prueba: ${error.message}`);
  }

  async deleteAllTestCustomers(): Promise<void> {
    const customers = await this.getTestCustomers();
    for (const c of customers) {
      await this.deleteTestCustomer(c.customer_id);
    }
  }

  async deleteAllTestOrders(): Promise<void> {
    const orders = await this.getTestOrders();
    for (const o of orders) {
      await this.deleteTestOrder(o.order_id);
    }
  }
}

export const woocommerceConfigService = new WooCommerceConfigService();
