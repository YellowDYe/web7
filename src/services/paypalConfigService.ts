import { supabase } from '../config/supabase';
import { PayPalConfig, PayPalConfigForm } from '../types/paypalConfig';

class PayPalConfigService {
  private configCache: PayPalConfig | null = null;
  private cacheTimestamp: number = 0;
  private readonly CACHE_DURATION = 5 * 60 * 1000;

  async getPayPalConfig(): Promise<PayPalConfig | null> {
    const now = Date.now();
    if (this.configCache && (now - this.cacheTimestamp) < this.CACHE_DURATION) {
      return this.configCache;
    }

    try {
      const { data, error } = await supabase
        .from('paypal_config')
        .select('*')
        .eq('is_active', true)
        .maybeSingle();

      if (error) {
        console.error('Supabase error fetching PayPal config:', error);
        throw error;
      }

      this.configCache = data;
      this.cacheTimestamp = now;

      return data;
    } catch (error: any) {
      console.error('Error fetching PayPal config:', error);
      throw new Error(`Error al cargar la configuración de PayPal: ${error.message || 'Error desconocido'}`);
    }
  }

  async getPayPalConfigForm(): Promise<PayPalConfigForm> {
    const config = await this.getPayPalConfig();

    if (!config) {
      return {
        client_id: '',
        client_secret: '',
        environment: 'sandbox'
      };
    }

    return {
      client_id: config.client_id,
      client_secret: config.client_secret,
      environment: config.environment
    };
  }

  private validateAndNormalizeEnvironment(environment: string): 'sandbox' | 'production' {
    const normalized = environment.toLowerCase().trim();

    if (normalized !== 'sandbox' && normalized !== 'production') {
      throw new Error(`Entorno inválido: "${environment}". Debe ser "sandbox" o "production"`);
    }

    return normalized as 'sandbox' | 'production';
  }

  async updatePayPalConfig(configForm: PayPalConfigForm): Promise<void> {
    try {
      this.clearCache();

      const normalizedEnvironment = this.validateAndNormalizeEnvironment(configForm.environment);
      const normalizedClientId = configForm.client_id.trim();
      const normalizedClientSecret = configForm.client_secret.trim();

      console.log('Saving PayPal config with environment:', normalizedEnvironment);

      const existingConfig = await this.getPayPalConfig();

      if (existingConfig) {
        console.log('Updating existing PayPal config:', existingConfig.id);
        const { data, error } = await supabase
          .from('paypal_config')
          .update({
            client_id: normalizedClientId,
            client_secret: normalizedClientSecret,
            environment: normalizedEnvironment
          })
          .eq('id', existingConfig.id)
          .select();

        if (error) {
          console.error('Supabase update error:', error);
          throw error;
        }
        console.log('Update successful:', data);
      } else {
        console.log('Creating new PayPal config');
        const { data, error } = await supabase
          .from('paypal_config')
          .insert([{
            client_id: normalizedClientId,
            client_secret: normalizedClientSecret,
            environment: normalizedEnvironment,
            is_active: true
          }])
          .select();

        if (error) {
          console.error('Supabase insert error:', error);
          throw error;
        }
        console.log('Insert successful:', data);
      }

      this.clearCache();
    } catch (error: any) {
      console.error('Error updating PayPal config:', error);

      if (error.code === '23505') {
        throw new Error('Ya existe una configuración activa de PayPal');
      } else if (error.code === '23514') {
        throw new Error('Datos inválidos: verifique que el entorno sea sandbox o production');
      } else if (error.message) {
        throw new Error(`Error al actualizar la configuración: ${error.message}`);
      } else {
        throw new Error('Error al actualizar la configuración de PayPal');
      }
    }
  }

  async isConfigured(): Promise<boolean> {
    try {
      const config = await this.getPayPalConfig();
      return !!(config && config.client_id && config.client_secret);
    } catch (error) {
      console.error('Error checking PayPal configuration:', error);
      return false;
    }
  }

  clearCache(): void {
    this.configCache = null;
    this.cacheTimestamp = 0;
  }

  getBaseUrl(environment: 'sandbox' | 'production'): string {
    return environment === 'production'
      ? 'https://api-m.paypal.com'
      : 'https://api-m.sandbox.paypal.com';
  }
}

export const paypalConfigService = new PayPalConfigService();
