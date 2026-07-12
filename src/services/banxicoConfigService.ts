import { supabase } from '../config/supabase';

export interface BanxicoConfig {
  id: string;
  api_token: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface BanxicoConfigForm {
  api_token: string;
  is_active: boolean;
}

class BanxicoConfigService {
  private configCache: BanxicoConfig | null = null;
  private cacheTimestamp: number = 0;
  private readonly CACHE_DURATION = 5 * 60 * 1000;

  async getConfig(): Promise<BanxicoConfig | null> {
    const now = Date.now();
    if (this.configCache && (now - this.cacheTimestamp) < this.CACHE_DURATION) {
      return this.configCache;
    }

    const { data, error } = await supabase
      .from('banxico_config')
      .select('*')
      .maybeSingle();

    if (error) throw new Error(`Error al cargar configuracion de Banxico: ${error.message}`);

    this.configCache = data;
    this.cacheTimestamp = now;
    return data;
  }

  async getConfigForm(): Promise<BanxicoConfigForm> {
    const config = await this.getConfig();
    if (!config) {
      return { api_token: '', is_active: false };
    }
    return { api_token: config.api_token, is_active: config.is_active };
  }

  async updateConfig(form: BanxicoConfigForm): Promise<void> {
    const existing = await this.getConfig();

    if (existing) {
      const { error } = await supabase
        .from('banxico_config')
        .update({
          api_token: form.api_token,
          is_active: form.is_active,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id);

      if (error) throw new Error(`Error al guardar: ${error.message}`);
    } else {
      const { error } = await supabase
        .from('banxico_config')
        .insert({
          api_token: form.api_token,
          is_active: form.is_active,
        });

      if (error) throw new Error(`Error al guardar: ${error.message}`);
    }

    this.clearCache();
  }

  clearCache() {
    this.configCache = null;
    this.cacheTimestamp = 0;
  }
}

export const banxicoConfigService = new BanxicoConfigService();
