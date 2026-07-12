export interface MealPlan {
  id: string;
  meal_plans_id: string;
  meal_plans_name: string;
  meal_plans_description: string;
  meal_plans_price: number;
  created_at: string;
  updated_at: string;
}

export interface CreateMealPlanData {
  meal_plans_name: string;
  meal_plans_description: string;
  meal_plans_price: number;
}

export interface UpdateMealPlanData {
  meal_plans_name?: string;
  meal_plans_description?: string;
  meal_plans_price?: number;
}