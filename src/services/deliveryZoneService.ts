import { supabase } from '../config/supabase';
import { DeliveryZone } from '../types/deliveryZone';

export class DeliveryZoneService {
  async getZones(): Promise<DeliveryZone[]> {
    const { data, error } = await supabase
      .from('delivery_zones')
      .select('*')
      .eq('is_active', true)
      .order('postal_code', { ascending: true });

    if (error) {
      throw new Error(`Error fetching delivery zones: ${error.message}`);
    }

    return data || [];
  }
}

export const deliveryZoneService = new DeliveryZoneService();
