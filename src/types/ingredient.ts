export interface Ingredient {
  id: string;
  ingredient_id: string;
  ingredient_name: string;
  ingredient_category_id: string;
  supplier_id: string;
  ingredient_restriction: boolean;
  ingredient_spicy: boolean;
  ingredient_calories: number;
  ingredient_carbs: number;
  ingredient_protein: number;
  ingredient_fats: number;
  ingredient_cost: number;
  ingredient_shrinkage: number;
  created_at: string;
  updated_at: string;
}

export interface CreateIngredientData {
  ingredient_name: string;
  ingredient_category_id: string;
  supplier_id: string;
  ingredient_restriction: boolean;
  ingredient_spicy: boolean;
  ingredient_calories: number;
  ingredient_carbs: number;
  ingredient_protein: number;
  ingredient_fats: number;
  ingredient_cost: number;
  ingredient_shrinkage: number;
}

export interface UpdateIngredientData {
  ingredient_name?: string;
  ingredient_category_id?: string;
  supplier_id?: string;
  ingredient_restriction?: boolean;
  ingredient_spicy?: boolean;
  ingredient_calories?: number;
  ingredient_carbs?: number;
  ingredient_protein?: number;
  ingredient_fats?: number;
  ingredient_cost?: number;
  ingredient_shrinkage?: number;
}

// Extended interface with category and supplier names for display
export interface IngredientWithDetails extends Ingredient {
  category_name?: string;
  supplier_name?: string;
}