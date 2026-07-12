import { supabase } from '../config/supabase';
import { ProteinPlan, CreateProteinPlanData, UpdateProteinPlanData } from '../types/proteinPlan';

export class ProteinPlanService {
  // Generate next protein plan ID (PP1, PP2, PP3...)
  private async generateNextPlanId(): Promise<string> {
    const { data, error } = await supabase
      .from('protein_plans')
      .select('protein_plans_id');

    if (error) {
      console.error('Error fetching last protein plan ID:', error);
      return `PP${Math.floor(Math.random() * 100000000)}`;
    }

    if (!data || data.length === 0) {
      return 'PP1';
    }

    // Parse all numeric parts and find the maximum
    const numericParts = data
      .map(item => parseInt(item.protein_plans_id.replace('PP', '')))
      .filter(num => !isNaN(num));
    
    const maxNumber = numericParts.length > 0 ? Math.max(...numericParts) : 0;
    return `PP${maxNumber + 1}`;
  }

  // Create new protein plan
  async createPlan(planData: CreateProteinPlanData): Promise<ProteinPlan> {
    const protein_plans_id = await this.generateNextPlanId();

    const { data, error } = await supabase
      .from('protein_plans')
      .insert([
        {
          protein_plans_id,
          ...planData
        }
      ])
      .select()
      .single();

    if (error) {
      throw new Error(`Error creating protein plan: ${error.message}`);
    }

    return data;
  }

  // Get all protein plans
  async getPlans(): Promise<ProteinPlan[]> {
    const { data, error } = await supabase
      .from('protein_plans')
      .select('*')
      .order('created_at', { ascending: true });

    if (error) {
      throw new Error(`Error fetching protein plans: ${error.message}`);
    }

    return data || [];
  }

  // Get single protein plan by ID
  async getPlanById(id: string): Promise<ProteinPlan | null> {
    const { data, error } = await supabase
      .from('protein_plans')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Not found
      }
      throw new Error(`Error fetching protein plan: ${error.message}`);
    }

    return data;
  }

  // Update protein plan
  async updatePlan(id: string, updateData: UpdateProteinPlanData): Promise<ProteinPlan> {
    const { data, error } = await supabase
      .from('protein_plans')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Error updating protein plan: ${error.message}`);
    }

    return data;
  }

  // Delete protein plan
  async deletePlan(id: string): Promise<void> {
    const { error } = await supabase
      .from('protein_plans')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`Error deleting protein plan: ${error.message}`);
    }
  }
}

export const proteinPlanService = new ProteinPlanService();