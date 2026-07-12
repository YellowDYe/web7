import { supabase } from '../config/supabase';
import { StripeConfig } from '../types/stripeConfig';

export interface StripeConfigForm {
  publishable_key: string;
  secret_key: string;
  webhook_secret: string;
  environment: 'test' | 'live';
}

class StripeConfigService {
  private configCache: StripeConfig | null = null;
  private cacheTimestamp: number = 0;
  private readonly CACHE_DURATION = 5 * 60 * 1000;

  async getStripeConfig(): Promise<StripeConfig | null> {
    const now = Date.now();
    if (this.configCache && (now - this.cacheTimestamp) < this.CACHE_DURATION) {
      return this.configCache;
    }

    try {
      const { data, error } = await supabase
        .from('stripe_config')
        .select('*')
        .eq('is_active', true)
        .maybeSingle();

      if (error) {
        console.error('Supabase error fetching Stripe config:', error);
        throw error;
      }

      this.configCache = data;
      this.cacheTimestamp = now;

      return data;
    } catch (error: any) {
      console.error('Error fetching Stripe config:', error);
      throw new Error(`Error al cargar la configuración de Stripe: ${error.message || 'Error desconocido'}`);
    }
  }

  async getStripeConfigForm(): Promise<StripeConfigForm> {
    const config = await this.getStripeConfig();

    if (!config) {
      return {
        publishable_key: '',
        secret_key: '',
        webhook_secret: '',
        environment: 'test'
      };
    }

    return {
      publishable_key: config.publishable_key,
      secret_key: config.secret_key,
      webhook_secret: config.webhook_secret,
      environment: config.environment
    };
  }

  private validateAndNormalizeEnvironment(environment: string): 'test' | 'live' {
    const normalized = environment.toLowerCase().trim();

    if (normalized !== 'test' && normalized !== 'live') {
      throw new Error(`Entorno inválido: "${environment}". Debe ser "test" o "live"`);
    }

    return normalized as 'test' | 'live';
  }

  async updateStripeConfig(configForm: StripeConfigForm): Promise<void> {
    try {
      this.clearCache();

      const normalizedEnvironment = this.validateAndNormalizeEnvironment(configForm.environment);
      const normalizedPublishableKey = configForm.publishable_key.trim();
      const normalizedSecretKey = configForm.secret_key.trim();
      const normalizedWebhookSecret = configForm.webhook_secret.trim();

      console.log('Saving Stripe config with environment:', normalizedEnvironment);

      const existingConfig = await this.getStripeConfig();

      if (existingConfig) {
        console.log('Updating existing Stripe config:', existingConfig.id);
        const { data, error } = await supabase
          .from('stripe_config')
          .update({
            publishable_key: normalizedPublishableKey,
            secret_key: normalizedSecretKey,
            webhook_secret: normalizedWebhookSecret,
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
        console.log('Creating new Stripe config');
        const { data, error } = await supabase
          .from('stripe_config')
          .insert([{
            publishable_key: normalizedPublishableKey,
            secret_key: normalizedSecretKey,
            webhook_secret: normalizedWebhookSecret,
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
      console.error('Error updating Stripe config:', error);

      if (error.code === '23505') {
        throw new Error('Ya existe una configuración activa de Stripe');
      } else if (error.code === '23514') {
        throw new Error('Datos inválidos: verifique que el entorno sea test o live');
      } else if (error.message) {
        throw new Error(`Error al actualizar la configuración: ${error.message}`);
      } else {
        throw new Error('Error al actualizar la configuración de Stripe');
      }
    }
  }

  async isConfigured(): Promise<boolean> {
    try {
      const config = await this.getStripeConfig();
      return !!(config && config.publishable_key && config.secret_key);
    } catch (error) {
      console.error('Error checking Stripe configuration:', error);
      return false;
    }
  }

  clearCache(): void {
    this.configCache = null;
    this.cacheTimestamp = 0;
  }

  getApiUrl(environment: 'test' | 'live'): string {
    return 'https://api.stripe.com';
  }

  getWebhookUrl(): string {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    return `${supabaseUrl}/functions/v1/stripe-webhook`;
  }
}

export const stripeConfigService = new StripeConfigService();
