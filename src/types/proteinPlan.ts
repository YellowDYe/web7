export interface ProteinPlan {
  id: string;
  protein_plans_id: string;
  protein_plans_name: string;
  protein_plans_description: string;
  protein_plans_price: number;
  created_at: string;
  updated_at: string;
}

export interface CreateProteinPlanData {
  protein_plans_name: string;
  protein_plans_description: string;
  protein_plans_price: number;
}

export interface UpdateProteinPlanData {
  protein_plans_name?: string;
  protein_plans_description?: string;
  protein_plans_price?: number;
}