// Shared type definitions for meals, days, and columns

export const DAYS_OF_WEEK = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'] as const;
export type DayOfWeek = typeof DAYS_OF_WEEK[number];

export const MEAL_TYPES = [
  { key: 'desayuno', label: 'Desayuno' },
  { key: 'colacion_am', label: 'Colación AM' },
  { key: 'comida', label: 'Comida' },
  { key: 'colacion_pm', label: 'Colación PM' },
  { key: 'cena', label: 'Cena' }
] as const;

export type MealTypeKey = typeof MEAL_TYPES[number]['key'];
export type MealTypeLabel = typeof MEAL_TYPES[number]['label'];

// Billable meal types (excluding snacks/colaciones)
export const BILLABLE_MEAL_TYPES: MealTypeLabel[] = ['Desayuno', 'Comida', 'Cena'];

// Helper type for creating day/meal column names
export type DayMealColumn<Suffix extends string> =
  | `lunes_${MealTypeKey}_${Suffix}`
  | `martes_${MealTypeKey}_${Suffix}`
  | `miercoles_${MealTypeKey}_${Suffix}`
  | `jueves_${MealTypeKey}_${Suffix}`
  | `viernes_${MealTypeKey}_${Suffix}`;

// Quantity columns for order_weeks
export type QuantityColumns = {
  [K in DayMealColumn<'qty'>]: number;
};

// Recipe ID columns for menu_recipes
export type RecipeColumns = {
  [K in DayMealColumn<'recipe_id'>]: string | null;
};

// Helper to convert meal type label to key
export function mealLabelToKey(label: MealTypeLabel): MealTypeKey {
  const mealType = MEAL_TYPES.find(mt => mt.label === label);
  return mealType?.key || 'desayuno';
}

// Helper to convert meal type key to label
export function mealKeyToLabel(key: MealTypeKey): MealTypeLabel {
  const mealType = MEAL_TYPES.find(mt => mt.key === key);
  return mealType?.label || 'Desayuno';
}

// Helper to convert day to lowercase for column names
export function dayToColumnPrefix(day: DayOfWeek): string {
  const dayMap: Record<DayOfWeek, string> = {
    'Lunes': 'lunes',
    'Martes': 'martes',
    'Miércoles': 'miercoles',
    'Jueves': 'jueves',
    'Viernes': 'viernes'
  };
  return dayMap[day];
}

// Helper to build column name for quantity
export function buildQuantityColumn(day: DayOfWeek, mealType: MealTypeLabel): keyof QuantityColumns {
  const dayPrefix = dayToColumnPrefix(day);
  const mealKey = mealLabelToKey(mealType);
  return `${dayPrefix}_${mealKey}_qty` as keyof QuantityColumns;
}

// Helper to build column name for recipe
export function buildRecipeColumn(day: DayOfWeek, mealType: MealTypeLabel): keyof RecipeColumns {
  const dayPrefix = dayToColumnPrefix(day);
  const mealKey = mealLabelToKey(mealType);
  return `${dayPrefix}_${mealKey}_recipe_id` as keyof RecipeColumns;
}
