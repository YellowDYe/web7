import { supabase } from '../config/supabase';

export interface MercadoPagoConfig {
  id: string;
  access_token: string;
  public_key: string | null;
  user_id: string | null;
  is_active: boolean;
  test_mode: boolean;
  enable_credit_card: boolean;
  enable_debit_card: boolean;
  enable_ticket: boolean;
  enable_bank_transfer: boolean;
  enable_mercado_pago_wallet: boolean;
  max_installments: number;
  statement_descriptor: string | null;
  webhook_secret: string | null;
  last_sync_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface MercadoPagoConfigForm {
  access_token: string;
  public_key: string;
  is_active: boolean;
  test_mode: boolean;
  enable_credit_card: boolean;
  enable_debit_card: boolean;
  enable_ticket: boolean;
  enable_bank_transfer: boolean;
  enable_mercado_pago_wallet: boolean;
  max_installments: number;
  statement_descriptor: string;
  webhook_secret: string;
}

class MercadoPagoConfigService {
  private configCache: MercadoPagoConfig | null = null;
  private cacheTimestamp: number = 0;
  private readonly CACHE_DURATION = 5 * 60 * 1000;

  async getConfig(): Promise<MercadoPagoConfig | null> {
    const now = Date.now();
    if (this.configCache && (now - this.cacheTimestamp) < this.CACHE_DURATION) {
      return this.configCache;
    }

    const { data, error } = await supabase
      .from('mercado_pago_config')
      .select('*')
      .maybeSingle();

    if (error) throw new Error(`Error al cargar configuracion de Mercado Pago: ${error.message}`);

    this.configCache = data;
    this.cacheTimestamp = now;
    return data;
  }

  async getConfigForm(): Promise<MercadoPagoConfigForm> {
    const config = await this.getConfig();
    if (!config) {
      return {
        access_token: '',
        public_key: '',
        is_active: false,
        test_mode: true,
        enable_credit_card: true,
        enable_debit_card: true,
        enable_ticket: true,
        enable_bank_transfer: true,
        enable_mercado_pago_wallet: true,
        max_installments: 12,
        statement_descriptor: '',
        webhook_secret: '',
      };
    }
    return {
      access_token: config.access_token,
      public_key: config.public_key || '',
      is_active: config.is_active,
      test_mode: config.test_mode,
      enable_credit_card: config.enable_credit_card,
      enable_debit_card: config.enable_debit_card,
      enable_ticket: config.enable_ticket,
      enable_bank_transfer: config.enable_bank_transfer,
      enable_mercado_pago_wallet: config.enable_mercado_pago_wallet,
      max_installments: config.max_installments,
      statement_descriptor: config.statement_descriptor || '',
      webhook_secret: config.webhook_secret || '',
    };
  }

  async updateConfig(form: MercadoPagoConfigForm): Promise<void> {
    const existing = await this.getConfig();

    const payload = {
      access_token: form.access_token,
      public_key: form.public_key,
      is_active: form.is_active,
      test_mode: form.test_mode,
      enable_credit_card: form.enable_credit_card,
      enable_debit_card: form.enable_debit_card,
      enable_ticket: form.enable_ticket,
      enable_bank_transfer: form.enable_bank_transfer,
      enable_mercado_pago_wallet: form.enable_mercado_pago_wallet,
      max_installments: form.max_installments,
      statement_descriptor: form.statement_descriptor || null,
      webhook_secret: form.webhook_secret || null,
      updated_at: new Date().toISOString(),
    };

    if (existing) {
      const { error } = await supabase
        .from('mercado_pago_config')
        .update(payload)
        .eq('id', existing.id);

      if (error) throw new Error(`Error al guardar: ${error.message}`);
    } else {
      const { error } = await supabase
        .from('mercado_pago_config')
        .insert(payload);

      if (error) throw new Error(`Error al guardar: ${error.message}`);
    }

    this.clearCache();
  }

  async updateLastSync(userId?: string): Promise<void> {
    const existing = await this.getConfig();
    if (!existing) return;

    const updates: Record<string, any> = {
      last_sync_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    if (userId) updates.user_id = userId;

    const { error } = await supabase
      .from('mercado_pago_config')
      .update(updates)
      .eq('id', existing.id);

    if (error) throw new Error(`Error al actualizar: ${error.message}`);
    this.clearCache();
  }

  clearCache() {
    this.configCache = null;
    this.cacheTimestamp = 0;
  }
}

export const mercadoPagoConfigService = new MercadoPagoConfigService();
