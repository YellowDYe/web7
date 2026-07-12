import {
  DayOfWeek,
  MealTypeLabel,
  DAYS_OF_WEEK,
  MEAL_TYPES,
  buildQuantityColumn,
  QuantityColumns
} from '../types/mealTypes';
import { PendingOrderItem } from '../types/orderWeek';
import { OrderWeek } from '../types/orderWeek';

export interface OrderWeekWithQuantities extends Partial<QuantityColumns> {
  order_week_id: string;
  order_id: string;
  week_id: string;
  meal_plan_id: string | null;
  delivery_date: string | null;
}

export interface MealPlanInfo {
  meal_plans_id: string;
  meal_plans_name: string;
  meal_plans_price: number;
}

export interface RecipeNameLookup {
  [key: string]: string;
}

export function unpivotOrderWeek(
  orderWeek: OrderWeekWithQuantities,
  mealPlanInfo: MealPlanInfo,
  weekName: string,
  recipeNameLookup?: RecipeNameLookup
): PendingOrderItem[] {
  const items: PendingOrderItem[] = [];

  for (const day of DAYS_OF_WEEK) {
    for (const mealType of MEAL_TYPES) {
      const columnName = buildQuantityColumn(day, mealType.label);
      const quantity = orderWeek[columnName] || 0;

      if (quantity > 0) {
        const lookupKey = `${day}-${mealType.label}`;
        const recipeName = recipeNameLookup?.[lookupKey] || undefined;

        items.push({
          tempId: `${orderWeek.order_week_id}-${day}-${mealType.label}-${Date.now()}`,
          order_week_id: orderWeek.order_week_id,
          meal_plans_id: mealPlanInfo.meal_plans_id,
          meal_type: mealType.label,
          day_of_week: day,
          quantity,
          meal_plan_name: mealPlanInfo.meal_plans_name,
          meal_plan_price: mealPlanInfo.meal_plans_price,
          recipe_name: recipeName,
          week_name: weekName,
          week_id: orderWeek.week_id
        });
      }
    }
  }

  return items;
}

export function pivotOrderItems(
  orderItems: PendingOrderItem[]
): Partial<QuantityColumns> {
  const quantities: Partial<QuantityColumns> = {};

  for (const day of DAYS_OF_WEEK) {
    for (const mealType of MEAL_TYPES) {
      const columnName = buildQuantityColumn(day, mealType.label);
      quantities[columnName] = 0;
    }
  }

  for (const item of orderItems) {
    const columnName = buildQuantityColumn(item.day_of_week, item.meal_type);
    quantities[columnName] = (quantities[columnName] || 0) + item.quantity;
  }

  return quantities;
}

export function buildQuantityUpdates(
  orderItems: PendingOrderItem[]
): Record<string, number> {
  const quantities = pivotOrderItems(orderItems);
  const updates: Record<string, number> = {};

  for (const [key, value] of Object.entries(quantities)) {
    updates[key] = value;
  }

  return updates;
}

export interface GroupedOrderItems {
  [key: string]: {
    meal_plan_id: string;
    meal_plan_name: string;
    meal_plan_price: number;
    items: PendingOrderItem[];
  };
}

export function groupItemsByWeekAndPlan(
  orderItems: PendingOrderItem[]
): GroupedOrderItems {
  const grouped: GroupedOrderItems = {};

  for (const item of orderItems) {
    const key = `${item.week_id || item.week_name}-${item.meal_plans_id}`;

    if (!grouped[key]) {
      grouped[key] = {
        meal_plan_id: item.meal_plans_id,
        meal_plan_name: item.meal_plan_name,
        meal_plan_price: item.meal_plan_price,
        items: []
      };
    }

    grouped[key].items.push(item);
  }

  return grouped;
}

export function extractNonZeroQuantities(
  orderWeek: OrderWeekWithQuantities
): Array<{ day: DayOfWeek; mealType: MealTypeLabel; quantity: number }> {
  const nonZero: Array<{ day: DayOfWeek; mealType: MealTypeLabel; quantity: number }> = [];

  for (const day of DAYS_OF_WEEK) {
    for (const mealType of MEAL_TYPES) {
      const columnName = buildQuantityColumn(day, mealType.label);
      const quantity = orderWeek[columnName] || 0;

      if (quantity > 0) {
        nonZero.push({
          day,
          mealType: mealType.label,
          quantity
        });
      }
    }
  }

  return nonZero;
}

export function validateQuantities(quantities: Partial<QuantityColumns>): boolean {
  for (const value of Object.values(quantities)) {
    if (typeof value !== 'number' || value < 0 || !Number.isInteger(value)) {
      console.error('Invalid quantity value:', value);
      return false;
    }
  }
  return true;
}

export function logTransformation(
  operation: 'unpivot' | 'pivot',
  input: any,
  output: any
): void {
  if (process.env.NODE_ENV === 'development') {
    console.log(`[OrderWeeksTransformer] ${operation} operation:`, {
      input,
      output,
      timestamp: new Date().toISOString()
    });
  }
}
