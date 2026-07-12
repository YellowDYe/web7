import { supabase } from '../config/supabase';
import type { DeliveryTrackingConfig, DeliveryTrackingConfigForm } from '../types/deliveryTrackingConfig';

class DeliveryTrackingConfigService {
  private configCache: DeliveryTrackingConfig | null = null;
  private cacheTimestamp: number = 0;
  private CACHE_DURATION = 5 * 60 * 1000;

  async getConfig(): Promise<DeliveryTrackingConfig | null> {
    const now = Date.now();
    if (this.configCache && (now - this.cacheTimestamp) < this.CACHE_DURATION) {
      return this.configCache;
    }

    const { data, error } = await supabase
      .from('delivery_tracking_config')
      .select('*')
      .eq('is_active', true)
      .maybeSingle();

    if (error) {
      console.error('Error fetching delivery tracking config:', error);
      throw new Error('Error al cargar la configuración de Delivery Tracking');
    }

    this.configCache = data;
    this.cacheTimestamp = now;
    return data;
  }

  async getConfigForm(): Promise<DeliveryTrackingConfigForm> {
    const config = await this.getConfig();
    if (!config) {
      return {
        app_url: 'https://iqvqkxtucphubzmygiaq.supabase.co/functions/v1/delivery-api',
        api_key: '',
      };
    }
    return {
      app_url: config.app_url,
      api_key: config.api_key,
    };
  }

  async saveConfig(form: DeliveryTrackingConfigForm): Promise<void> {
    this.clearCache();

    const existing = await this.getConfig();
    const trimmedForm = {
      app_url: form.app_url.trim(),
      api_key: form.api_key.trim(),
    };

    if (existing) {
      const { error } = await supabase
        .from('delivery_tracking_config')
        .update({
          ...trimmedForm,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id);

      if (error) {
        console.error('Error updating delivery tracking config:', error);
        throw new Error('Error al actualizar la configuración');
      }
    } else {
      const { error } = await supabase
        .from('delivery_tracking_config')
        .insert({
          ...trimmedForm,
          is_active: true,
        });

      if (error) {
        console.error('Error inserting delivery tracking config:', error);
        throw new Error('Error al guardar la configuración');
      }
    }

    this.clearCache();
  }

  async testConnection(): Promise<{ success: boolean; message: string }> {
    const config = await this.getConfig();
    if (!config) {
      return { success: false, message: 'No hay configuración guardada' };
    }

    try {
      const { data, error } = await supabase.functions.invoke('delivery-tracking-proxy', {
        body: { action: 'test-connection' },
      });

      if (error) {
        return { success: false, message: error.message || 'Error al probar la conexión' };
      }

      return {
        success: data?.success ?? false,
        message: data?.message || 'Respuesta inesperada del servidor',
      };
    } catch (err: any) {
      return { success: false, message: err.message || 'No se pudo conectar con la aplicación' };
    }
  }

  clearCache(): void {
    this.configCache = null;
    this.cacheTimestamp = 0;
  }
}

export const deliveryTrackingConfigService = new DeliveryTrackingConfigService();
