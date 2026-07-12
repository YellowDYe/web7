import { QuantityColumns, DayOfWeek, MealTypeLabel } from './mealTypes';

// Order week with embedded meal quantities
export interface OrderWeek extends Partial<QuantityColumns> {
  id: string;
  order_week_id: string;
  order_id: string;
  week_id: string;
  meal_plan_id: string | null;
  delivery_date: string | null;
  family_member_id?: string | null;
  created_at: string;
}

// Order week with week details
export interface OrderWeekWithDetails extends OrderWeek {
  week_name?: string;
  meal_plan_name?: string;
  family_member_name?: string;
  family_member_restrictions?: string[];
}

// Helper type for creating order week data
export interface CreateOrderWeekData {
  order_id: string;
  week_id: string;
  meal_plan_id?: string | null;
  delivery_date?: string | null;
  family_member_id?: string | null;
  quantities?: Partial<QuantityColumns>;
}

// Helper interface for UI state management of order items
export interface OrderMenuItem {
  day: DayOfWeek;
  mealType: MealTypeLabel;
  quantity: number;
  mealPlanId: string;
  mealPlanName: string;
  mealPlanPrice: number;
  weekName: string;
}

// Interface for pending order items (before saving)
export interface PendingOrderItem {
  tempId: string;
  order_week_id?: string;
  meal_plans_id: string;
  meal_type: MealTypeLabel;
  day_of_week: DayOfWeek;
  quantity: number;
  meal_plan_name: string;
  meal_plan_price: number;
  recipe_name?: string;
  week_name: string;
  week_id?: string;
  family_member_id?: string | null;
  family_member_name?: string;
}

// Type for selected week in order creation
export interface SelectedWeek {
  week: {
    id: string;
    week_id: string;
    week_name: string;
  };
  family_member_id?: string | null;
  family_member_name?: string;
  family_member_restrictions?: string[];
}
