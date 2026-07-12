import { supabase } from '../config/supabase';
import { Discount, CreateDiscountData, UpdateDiscountData } from '../types/discount';

export class DiscountService {
  // Generate next discount ID (DES1, DES2, DES3...)
  private async generateNextDiscountId(): Promise<string> {
    const { data, error } = await supabase
      .from('discounts')
      .select('discount_id');

    if (error) {
      console.error('Error fetching last discount ID:', error);
      return 'DES1';
    }

    if (!data || data.length === 0) {
      return 'DES1';
    }

    // Parse all numeric parts and find the maximum
    const numericParts = data
      .map(item => parseInt(item.discount_id.replace('DES', '')))
      .filter(num => !isNaN(num));
    
    const maxNumber = numericParts.length > 0 ? Math.max(...numericParts) : 0;
    return `DES${maxNumber + 1}`;
  }

  // Create new discount
  async createDiscount(discountData: CreateDiscountData): Promise<Discount> {
    const discount_id = await this.generateNextDiscountId();

    const { data, error } = await supabase
      .from('discounts')
      .insert([
        {
          discount_id,
          ...discountData
        }
      ])
      .select()
      .single();

    if (error) {
      throw new Error(`Error creating discount: ${error.message}`);
    }

    return data;
  }

  // Get all discounts (including expired)
  async getDiscounts(): Promise<Discount[]> {
    const { data, error } = await supabase
      .from('discounts')
      .select('*')
      .order('meal_plans_id', { ascending: true })
      .order('threshold', { ascending: true });

    if (error) {
      throw new Error(`Error fetching discounts: ${error.message}`);
    }

    return data || [];
  }

  // Get only active discounts (not expired)
  async getActiveDiscounts(): Promise<Discount[]> {
    const { data, error } = await supabase
      .from('discounts')
      .select('*')
      .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
      .order('meal_plans_id', { ascending: true })
      .order('threshold', { ascending: true });

    if (error) {
      throw new Error(`Error fetching active discounts: ${error.message}`);
    }

    return data || [];
  }

  // Get all discounts for a specific meal plan
  async getDiscountsByMealPlan(mealPlansId: string): Promise<Discount[]> {
    const { data, error } = await supabase
      .from('discounts')
      .select('*')
      .eq('meal_plans_id', mealPlansId)
      .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
      .order('threshold', { ascending: true });

    if (error) {
      throw new Error(`Error fetching discounts for meal plan: ${error.message}`);
    }

    return data || [];
  }

  // Get applicable discount for a meal plan and dish count
  // Returns the highest threshold discount that the dish count qualifies for
  async getApplicableDiscount(mealPlansId: string, dishCount: number): Promise<Discount | null> {
    const { data, error } = await supabase
      .from('discounts')
      .select('*')
      .eq('meal_plans_id', mealPlansId)
      .lte('threshold', dishCount)
      .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
      .order('threshold', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      throw new Error(`Error fetching applicable discount: ${error.message}`);
    }

    return data;
  }

  // Alias for backward compatibility
  async getAllDiscounts(): Promise<Discount[]> {
    return this.getDiscounts();
  }

  // Get single discount by ID
  async getDiscountById(id: string): Promise<Discount | null> {
    const { data, error } = await supabase
      .from('discounts')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Not found
      }
      throw new Error(`Error fetching discount: ${error.message}`);
    }

    return data;
  }

  // Update discount
  async updateDiscount(id: string, updateData: UpdateDiscountData): Promise<Discount> {
    const { data, error } = await supabase
      .from('discounts')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Error updating discount: ${error.message}`);
    }

    return data;
  }

  // Delete discount
  async deleteDiscount(id: string): Promise<void> {
    const { error } = await supabase
      .from('discounts')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`Error deleting discount: ${error.message}`);
    }
  }
}

export const discountService = new DiscountService();