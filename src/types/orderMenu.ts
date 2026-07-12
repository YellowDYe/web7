// DEPRECATED: This file is kept for backward compatibility during migration
// Use types from orderWeek.ts and mealTypes.ts instead

import { DayOfWeek, MealTypeLabel, BILLABLE_MEAL_TYPES as BILLABLE_TYPES } from './mealTypes';

// Legacy interface - kept for backward compatibility
// The order_menu table has been merged into order_weeks
export interface OrderMenu {
  id: string;
  order_menu_id: string;
  order_week_id: string;
  meal_plans_id: string;
  meal_type: MealTypeLabel;
  day_of_week: DayOfWeek;
  quantity: number;
  created_at: string;
}

// Legacy interface - kept for backward compatibility
export interface CreateOrderMenuData {
  order_week_id: string;
  meal_plans_id: string;
  meal_type: MealTypeLabel;
  day_of_week: DayOfWeek;
  quantity: number;
}

// Legacy interface - kept for backward compatibility
export interface OrderMenuItem extends OrderMenu {
  meal_plan_name?: string;
  meal_plan_price?: number;
  recipe_name?: string;
}

// Re-export PendingOrderItem from orderWeek.ts to avoid duplication
export type { PendingOrderItem } from './orderWeek';

// Re-export for backward compatibility
export const BILLABLE_MEAL_TYPES = BILLABLE_TYPES;