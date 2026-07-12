import { supabase } from '../config/supabase';
import { FacturamaConfig, FacturamaConfigForm } from '../types/facturamaConfig';

class FacturamaConfigService {
  private configCache: FacturamaConfig | null = null;
  private cacheTimestamp: number = 0;
  private readonly CACHE_DURATION = 5 * 60 * 1000;

  async getFacturamaConfig(): Promise<FacturamaConfig | null> {
    const now = Date.now();
    if (this.configCache && (now - this.cacheTimestamp) < this.CACHE_DURATION) {
      return this.configCache;
    }

    try {
      const { data, error } = await supabase
        .from('facturama_config')
        .select('*')
        .eq('is_active', true)
        .maybeSingle();

      if (error) {
        console.error('Supabase error fetching Facturama config:', error);
        throw error;
      }

      this.configCache = data;
      this.cacheTimestamp = now;

      return data;
    } catch (error: any) {
      console.error('Error fetching Facturama config:', error);
      throw new Error(`Error al cargar la configuración de Facturama: ${error.message || 'Error desconocido'}`);
    }
  }

  async getFacturamaConfigForm(): Promise<FacturamaConfigForm> {
    const config = await this.getFacturamaConfig();

    if (!config) {
      return {
        username: '',
        password: '',
        environment: 'sandbox',
        issuer_rfc: '',
        issuer_name: '',
        issuer_tax_regime: '',
        issuer_street: '',
        issuer_exterior_number: '',
        issuer_interior_number: '',
        issuer_neighborhood: '',
        issuer_municipality: '',
        issuer_state: '',
        issuer_postal_code: '',
        default_product_key: '50192200',
        default_unit_key: 'E48',
        default_unit_name: 'Unidad de servicio',
      };
    }

    return {
      username: config.username,
      password: config.password,
      environment: config.environment,
      issuer_rfc: config.issuer_rfc,
      issuer_name: config.issuer_name,
      issuer_tax_regime: config.issuer_tax_regime,
      issuer_street: config.issuer_street,
      issuer_exterior_number: config.issuer_exterior_number,
      issuer_interior_number: config.issuer_interior_number,
      issuer_neighborhood: config.issuer_neighborhood,
      issuer_municipality: config.issuer_municipality,
      issuer_state: config.issuer_state,
      issuer_postal_code: config.issuer_postal_code,
      default_product_key: config.default_product_key,
      default_unit_key: config.default_unit_key,
      default_unit_name: config.default_unit_name,
    };
  }

  async updateFacturamaConfig(configForm: FacturamaConfigForm): Promise<void> {
    try {
      this.clearCache();

      const environment = configForm.environment === 'production' ? 'production' : 'sandbox';

      const existingConfig = await this.getFacturamaConfig();

      const payload = {
        username: configForm.username.trim(),
        password: configForm.password.trim(),
        environment,
        issuer_rfc: configForm.issuer_rfc.trim().toUpperCase(),
        issuer_name: configForm.issuer_name.trim(),
        issuer_tax_regime: configForm.issuer_tax_regime.trim(),
        issuer_street: configForm.issuer_street.trim(),
        issuer_exterior_number: configForm.issuer_exterior_number.trim(),
        issuer_interior_number: configForm.issuer_interior_number.trim(),
        issuer_neighborhood: configForm.issuer_neighborhood.trim(),
        issuer_municipality: configForm.issuer_municipality.trim(),
        issuer_state: configForm.issuer_state.trim(),
        issuer_postal_code: configForm.issuer_postal_code.trim(),
        default_product_key: configForm.default_product_key.trim(),
        default_unit_key: configForm.default_unit_key.trim(),
        default_unit_name: configForm.default_unit_name.trim(),
      };

      if (existingConfig) {
        const { error } = await supabase
          .from('facturama_config')
          .update(payload)
          .eq('id', existingConfig.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('facturama_config')
          .insert([{ ...payload, is_active: true }]);

        if (error) throw error;
      }

      this.clearCache();
    } catch (error: any) {
      console.error('Error updating Facturama config:', error);

      if (error.code === '23505') {
        throw new Error('Ya existe una configuración activa de Facturama');
      } else if (error.message) {
        throw new Error(`Error al actualizar la configuración: ${error.message}`);
      } else {
        throw new Error('Error al actualizar la configuración de Facturama');
      }
    }
  }

  async isConfigured(): Promise<boolean> {
    try {
      const config = await this.getFacturamaConfig();
      return !!(config && config.username && config.password && config.issuer_rfc);
    } catch {
      return false;
    }
  }

  clearCache(): void {
    this.configCache = null;
    this.cacheTimestamp = 0;
  }

  getBaseUrl(environment: 'sandbox' | 'production'): string {
    return environment === 'production'
      ? 'https://api.facturama.mx'
      : 'https://apisandbox.facturama.mx';
  }
}

export const facturamaConfigService = new FacturamaConfigService();
