import { supabase } from '../config/supabase';
import { ManychatConfig, ManychatConfigForm } from '../types/manychatConfig';

class ManychatConfigService {
  private configCache: ManychatConfig | null = null;
  private cacheTimestamp: number = 0;
  private readonly CACHE_DURATION = 5 * 60 * 1000;

  async getConfig(): Promise<ManychatConfig | null> {
    const now = Date.now();
    if (this.configCache && (now - this.cacheTimestamp) < this.CACHE_DURATION) {
      return this.configCache;
    }

    const { data, error } = await supabase
      .from('manychat_config')
      .select('*')
      .eq('is_active', true)
      .maybeSingle();

    if (error) {
      console.error('Error fetching Manychat config:', error);
      throw new Error(`Error al cargar la configuración de Manychat: ${error.message}`);
    }

    this.configCache = data;
    this.cacheTimestamp = now;
    return data;
  }

  async getConfigForm(): Promise<ManychatConfigForm> {
    const config = await this.getConfig();
    if (!config) {
      return {
        api_token: '',
        environment: 'production',
        default_phone_field: 'phone',
        default_email_field: 'email',
      };
    }
    return {
      api_token: config.api_token,
      environment: config.environment,
      default_phone_field: config.default_phone_field,
      default_email_field: config.default_email_field,
    };
  }

  async saveConfig(form: ManychatConfigForm): Promise<void> {
    this.clearCache();

    const existing = await this.getConfig();

    if (existing) {
      const { error } = await supabase
        .from('manychat_config')
        .update({
          api_token: form.api_token.trim(),
          environment: form.environment,
          default_phone_field: form.default_phone_field.trim(),
          default_email_field: form.default_email_field.trim(),
        })
        .eq('id', existing.id);

      if (error) {
        console.error('Error updating Manychat config:', error);
        throw new Error(`Error al actualizar la configuración: ${error.message}`);
      }
    } else {
      const { error } = await supabase
        .from('manychat_config')
        .insert([{
          api_token: form.api_token.trim(),
          environment: form.environment,
          default_phone_field: form.default_phone_field.trim(),
          default_email_field: form.default_email_field.trim(),
          is_active: true,
        }]);

      if (error) {
        console.error('Error inserting Manychat config:', error);
        throw new Error(`Error al guardar la configuración: ${error.message}`);
      }
    }

    this.clearCache();
  }

  async isConfigured(): Promise<boolean> {
    try {
      const config = await this.getConfig();
      return !!(config && config.api_token);
    } catch {
      return false;
    }
  }

  clearCache(): void {
    this.configCache = null;
    this.cacheTimestamp = 0;
  }
}

export const manychatConfigService = new ManychatConfigService();
