import { supabase } from '../config/supabase';
import { DeliveryOption, CreateDeliveryOptionData, UpdateDeliveryOptionData } from '../types/deliveryOption';

export class DeliveryOptionService {
  // Generate next delivery option ID (DO1, DO2, DO3...)
  private async generateNextOptionId(): Promise<string> {
    const { data, error } = await supabase
      .from('delivery_options')
      .select('delivery_options_id');

    if (error) {
      console.error('Error fetching last delivery option ID:', error);
      return `DO${Math.floor(Math.random() * 100000000)}`;
    }

    if (!data || data.length === 0) {
      return 'DO1';
    }

    // Parse all numeric parts and find the maximum
    const numericParts = data
      .map(item => parseInt(item.delivery_options_id.replace('DO', '')))
      .filter(num => !isNaN(num));
    
    const maxNumber = numericParts.length > 0 ? Math.max(...numericParts) : 0;
    return `DO${maxNumber + 1}`;
  }

  // Create new delivery option
  async createOption(optionData: CreateDeliveryOptionData): Promise<DeliveryOption> {
    const delivery_options_id = await this.generateNextOptionId();

    const { data, error } = await supabase
      .from('delivery_options')
      .insert([
        {
          delivery_options_id,
          ...optionData
        }
      ])
      .select()
      .single();

    if (error) {
      throw new Error(`Error creating delivery option: ${error.message}`);
    }

    return data;
  }

  // Get all delivery options
  async getOptions(): Promise<DeliveryOption[]> {
    const { data, error } = await supabase
      .from('delivery_options')
      .select('*')
      .order('created_at', { ascending: true });

    if (error) {
      throw new Error(`Error fetching delivery options: ${error.message}`);
    }

    return data || [];
  }

  // Get single delivery option by ID
  async getOptionById(id: string): Promise<DeliveryOption | null> {
    const { data, error } = await supabase
      .from('delivery_options')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Not found
      }
      throw new Error(`Error fetching delivery option: ${error.message}`);
    }

    return data;
  }

  // Update delivery option
  async updateOption(id: string, updateData: UpdateDeliveryOptionData): Promise<DeliveryOption> {
    const { data, error } = await supabase
      .from('delivery_options')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Error updating delivery option: ${error.message}`);
    }

    return data;
  }

  // Delete delivery option
  async deleteOption(id: string): Promise<void> {
    const { error } = await supabase
      .from('delivery_options')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`Error deleting delivery option: ${error.message}`);
    }
  }
}

export const deliveryOptionService = new DeliveryOptionService();