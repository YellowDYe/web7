import { RecipeColumns, DayOfWeek, MealTypeKey, MealTypeLabel } from './mealTypes';

// Menu recipes with embedded recipe assignments
export interface MenuRecipes extends Partial<RecipeColumns> {
  id: string;
  menu_id: string;
  meal_plan_id: string;
  created_at: string;
  updated_at: string;
}

// Menu recipes with additional details
export interface MenuRecipesWithDetails extends MenuRecipes {
  menu_name?: string;
  meal_plan_name?: string;
}

// Interface for creating/updating menu recipes
export interface MenuRecipesFormData {
  menu_id: string;
  meal_plan_id: string;
  recipes: Partial<RecipeColumns>;
}

// Legacy interface for backward compatibility during migration
// Maps to the old MenuPlanFormData structure
export interface LegacyMenuPlanFormData {
  [key: string]: {
    [K in MealTypeKey]?: string | null;
  };
}

// Recipe details for display
export interface Recipe {
  recipe_id: string;
  recipe_name: string;
  recipe_plan?: string;
  recipe_total_cost?: number;
  recipe_total_calories?: number;
}

// Meal plan summary for display
export interface MealPlanSummary {
  meal_plan_id: string;
  meal_plan_name: string;
  total_cost: number;
  total_calories: number;
}

// Helper to convert legacy form data to new RecipeColumns format
export function convertLegacyToRecipeColumns(
  mealPlanId: string,
  day: DayOfWeek,
  legacyData: { [K in MealTypeKey]?: string | null }
): Partial<RecipeColumns> {
  const result: Partial<RecipeColumns> = {};
  const dayPrefix = day.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  Object.entries(legacyData).forEach(([mealKey, recipeId]) => {
    const columnName = `${dayPrefix}_${mealKey}_recipe_id` as keyof RecipeColumns;
    result[columnName] = recipeId || null;
  });

  return result;
}

// Helper to extract recipe ID for a specific day/meal combination
export function getRecipeId(
  menuRecipes: MenuRecipes,
  day: DayOfWeek,
  mealType: MealTypeLabel
): string | null {
  const dayMap: Record<DayOfWeek, string> = {
    'Lunes': 'lunes',
    'Martes': 'martes',
    'Miércoles': 'miercoles',
    'Jueves': 'jueves',
    'Viernes': 'viernes'
  };

  const mealKeyMap: Record<MealTypeLabel, string> = {
    'Desayuno': 'desayuno',
    'Colación AM': 'colacion_am',
    'Comida': 'comida',
    'Colación PM': 'colacion_pm',
    'Cena': 'cena'
  };

  const dayPrefix = dayMap[day];
  const mealKey = mealKeyMap[mealType];
  const columnName = `${dayPrefix}_${mealKey}_recipe_id` as keyof RecipeColumns;

  return menuRecipes[columnName] || null;
}
