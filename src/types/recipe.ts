// Main Recipe types
export interface Recipe {
  id: string;
  recipe_id: string;
  recipe_name: string;
  recipe_image: string;
  image: string;
  recipe_plan: string;
  recipe_container: string;
  recipe_total_cost: number;
  recipe_total_calories: number;
  recipe_total_carbohydrates: number;
  recipe_total_proteins: number;
  recipe_total_fats: number;
  created_at: string;
  updated_at: string;
}

// Recipe ingredient details for display
export interface RecipeIngredientDetails {
  ingredient_id: string;
  ingredient_name?: string;
  recipe_ingredient_quantity: number;
  recipe_ingredient_unit: string;
  recipe_ingredient_restriction_management?: string;
  recipe_substitute_ingredient_id?: string;
  substitute_ingredient_name?: string;
}

// Recipe cooking step details for display
export interface RecipeCookingStepDetails {
  ingredient_id: string;
  ingredient_name?: string;
  cooking_step_id: string;
  cooking_step_name?: string;
  cooking_step_description?: string;
  ingredient_quantity: number;
}

// Recipe with all details for viewing
export interface RecipeWithDetails extends Recipe {
  plan_name?: string;
  container_name?: string;
  ingredients?: RecipeIngredientDetails[];
  steps?: RecipeCookingStepDetails[];
}

// Form data interfaces
export interface IngredientFormData {
  ingredient_id: string;
  ingredient_name?: string;
  quantity: number;
  unit: 'gr' | 'ml';
  ingredient_cost?: number;
  ingredient_calories?: number;
  ingredient_carbs?: number;
  ingredient_protein?: number;
  ingredient_fats?: number;
  ingredient_restriction?: boolean;
  restriction_management?: 'remove' | 'substitute' | 'none';
  substitution_ingredient_id?: string;
  substitution_ingredient_name?: string;
}

export interface CookingStepFormData {
  cooking_step_id: string;
  cooking_step_name?: string;
  ingredient_id: string;
  ingredient_name?: string;
  ingredient_quantity: number;
}

// Create/Update data interfaces
export interface CreateRecipeIngredientData {
  ingredient_id: string;
  recipe_ingredient_quantity: number;
  recipe_ingredient_unit: string;
  recipe_ingredient_restriction_management?: string;
  recipe_substitute_ingredient_id?: string;
}

export interface CreateRecipeStepData {
  ingredient_id: string;
  cooking_step_id: string;
  ingredient_quantity: number;
}

export interface CreateRecipeData {
  recipe_name: string;
  recipe_image: string;
  image: string;
  recipe_plan: string;
  recipe_container: string;
  recipe_ingredients: CreateRecipeIngredientData[];
  recipe_cooking_steps: CreateRecipeStepData[];
}

export interface UpdateRecipeData {
  recipe_name?: string;
  recipe_image?: string;
  image?: string;
  recipe_plan?: string;
  recipe_container?: string;
  recipe_ingredients?: CreateRecipeIngredientData[];
  recipe_cooking_steps?: CreateRecipeStepData[];
}

export interface RecipeIngredient {
  ingredient_id: string;
  ingredient_name: string;
  quantity: number;
  unit: string;
}