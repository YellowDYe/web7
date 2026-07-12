import { supabase } from '../config/supabase';
import { MealPlan, CreateMealPlanData, UpdateMealPlanData } from '../types/mealPlan';

export class MealPlanService {
  // Generate next meal plan ID (MP1, MP2, MP3...)
  private async generateNextPlanId(): Promise<string> {
    const { data, error } = await supabase
      .from('meal_plans')
      .select('meal_plans_id');

    if (error) {
      console.error('Error fetching last meal plan ID:', error);
      return `MP${Math.floor(Math.random() * 100000000)}`;
    }

    if (!data || data.length === 0) {
      return 'MP1';
    }

    // Parse all numeric parts and find the maximum
    const numericParts = data
      .map(item => parseInt(item.meal_plans_id.replace('MP', '')))
      .filter(num => !isNaN(num));
    
    const maxNumber = numericParts.length > 0 ? Math.max(...numericParts) : 0;
    return `MP${maxNumber + 1}`;
  }

  // Create new meal plan
  async createPlan(planData: CreateMealPlanData): Promise<MealPlan> {
    const meal_plans_id = await this.generateNextPlanId();

    const { data, error } = await supabase
      .from('meal_plans')
      .insert([
        {
          meal_plans_id,
          ...planData
        }
      ])
      .select()
      .single();

    if (error) {
      throw new Error(`Error creating meal plan: ${error.message}`);
    }

    return data;
  }

  // Get all meal plans
  async getPlans(): Promise<MealPlan[]> {
    const { data, error } = await supabase
      .from('meal_plans')
      .select('*')
      .order('created_at', { ascending: true });

    if (error) {
      throw new Error(`Error fetching meal plans: ${error.message}`);
    }

    return data || [];
  }

  // Get single meal plan by ID
  async getPlanById(id: string): Promise<MealPlan | null> {
    const { data, error } = await supabase
      .from('meal_plans')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Not found
      }
      throw new Error(`Error fetching meal plan: ${error.message}`);
    }

    return data;
  }

  // Update meal plan
  async updatePlan(id: string, updateData: UpdateMealPlanData): Promise<MealPlan> {
    const { data, error } = await supabase
      .from('meal_plans')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Error updating meal plan: ${error.message}`);
    }

    return data;
  }

  // Delete meal plan
  async deletePlan(id: string): Promise<void> {
    const { error } = await supabase
      .from('meal_plans')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`Error deleting meal plan: ${error.message}`);
    }
  }
}

export const mealPlanService = new MealPlanService();