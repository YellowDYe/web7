import { supabase } from '../config/supabase';

import { supabase } from '../config/supabase';
import { Tax, CreateTaxData, UpdateTaxData } from '../types/tax';

export interface Tax {
  id: string;
  tax_id: string;
  tax_name: string;
  tax_percentage: number;
  created_at: string;
  updated_at: string;
}

export class TaxService {
  // Generate next tax ID (TAX1, TAX2, TAX3...)
  private async generateNextTaxId(): Promise<string> {
    const { data, error } = await supabase
      .from('taxes')
      .select('tax_id');

    if (error) {
      console.error('Error fetching last tax ID:', error);
      return 'TAX1';
    }

    if (!data || data.length === 0) {
      return 'TAX1';
    }

    // Parse all numeric parts and find the maximum
    const numericParts = data
      .map(item => parseInt(item.tax_id.replace('TAX', '')))
      .filter(num => !isNaN(num));
    
    const maxNumber = numericParts.length > 0 ? Math.max(...numericParts) : 0;
    return `TAX${maxNumber + 1}`;
  }

  // Create new tax
  async createTax(taxData: CreateTaxData): Promise<Tax> {
    const tax_id = await this.generateNextTaxId();

    const { data, error } = await supabase
      .from('taxes')
      .insert([
        {
          tax_id,
          ...taxData
        }
      ])
      .select()
      .single();

    if (error) {
      throw new Error(`Error creating tax: ${error.message}`);
    }

    return data;
  }

  // Update tax
  async updateTax(id: string, updateData: UpdateTaxData): Promise<Tax> {
    const { data, error } = await supabase
      .from('taxes')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Error updating tax: ${error.message}`);
    }

    return data;
  }

  // Delete tax
  async deleteTax(id: string): Promise<void> {
    const { error } = await supabase
      .from('taxes')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`Error deleting tax: ${error.message}`);
    }
  }

  // Get all taxes
  async getTaxes(): Promise<Tax[]> {
    const { data, error } = await supabase
      .from('taxes')
      .select('*')
      .order('created_at', { ascending: true });

    if (error) {
      throw new Error(`Error fetching taxes: ${error.message}`);
    }

    return data || [];
  }

  // Get default IVA tax (16% in Mexico)
  async getDefaultIVA(): Promise<Tax | null> {
    const { data, error } = await supabase
      .from('taxes')
      .select('*')
      .eq('tax_name', 'IVA')
      .single();

    if (error) {
      if ((error as any).code === 'PGRST116') {
        // If no IVA tax found, return default 16%
        return {
          id: 'default',
          tax_id: 'IVA',
          tax_name: 'IVA',
          tax_percentage: 16,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
      }
      throw new Error(`Error fetching IVA tax: ${error.message}`);
    }

    return data as Tax;
  }
}

export const taxService = new TaxService();
