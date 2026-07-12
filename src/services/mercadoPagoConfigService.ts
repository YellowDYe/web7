import { supabase } from '../config/supabase';

export interface MercadoPagoConfig {
  id: string;
  access_token: string;
  user_id: string | null;
  is_active: boolean;
  last_sync_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface MercadoPagoConfigForm {
  access_token: string;
  is_active: boolean;
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
      return { access_token: '', is_active: false };
    }
    return { access_token: config.access_token, is_active: config.is_active };
  }

  async updateConfig(form: MercadoPagoConfigForm): Promise<void> {
    const existing = await this.getConfig();

    if (existing) {
      const { error } = await supabase
        .from('mercado_pago_config')
        .update({
          access_token: form.access_token,
          is_active: form.is_active,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id);

      if (error) throw new Error(`Error al guardar: ${error.message}`);
    } else {
      const { error } = await supabase
        .from('mercado_pago_config')
        .insert({
          access_token: form.access_token,
          is_active: form.is_active,
        });

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
