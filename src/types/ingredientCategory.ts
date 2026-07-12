export interface IngredientCategory {
  id: string;
  ingredient_category_id: string;
  ingredient_category: string;
  description: string;
  created_at: string;
  updated_at: string;
}

export interface CreateIngredientCategoryData {
  ingredient_category: string;
  description: string;
}

export interface UpdateIngredientCategoryData {
  ingredient_category?: string;
  description?: string;
}