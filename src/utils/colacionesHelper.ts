import { PendingOrderItem, BILLABLE_MEAL_TYPES } from '../types/orderMenu';

const PLANS_WITH_COLACIONES = ['MP1', 'MP3'];

export function planIncludesColaciones(mealPlanId: string | null): boolean {
  if (!mealPlanId) return false;
  return PLANS_WITH_COLACIONES.includes(mealPlanId);
}

export function calculateRequiredColaciones(billableMealCount: number): number {
  if (billableMealCount < 3) return 0;
  return Math.min(billableMealCount * 2, 10);
}

export function getColacionesForWeek(orderItems: PendingOrderItem[], weekName: string): number {
  return orderItems
    .filter(item =>
      item.week_name === weekName &&
      (item.meal_type === 'Colación AM' || item.meal_type === 'Colación PM')
    )
    .reduce((sum, item) => sum + item.quantity, 0);
}

export function getBillableMealsForWeek(orderItems: PendingOrderItem[], weekName: string, mealPlanId?: string): number {
  return orderItems
    .filter(item => {
      const matchesWeek = item.week_name === weekName;
      const isBillable = BILLABLE_MEAL_TYPES.includes(item.meal_type);
      const matchesPlan = mealPlanId ? item.meal_plans_id === mealPlanId : true;
      return matchesWeek && isBillable && matchesPlan;
    })
    .reduce((sum, item) => sum + item.quantity, 0);
}

export interface ColacionesRequirement {
  required: number;
  current: number;
  isMet: boolean;
  remaining: number;
}

export function getColacionesRequirement(
  orderItems: PendingOrderItem[],
  weekName: string,
  mealPlanId: string | null
): ColacionesRequirement | null {
  if (!planIncludesColaciones(mealPlanId)) {
    return null;
  }

  const billableMeals = getBillableMealsForWeek(orderItems, weekName, mealPlanId || undefined);
  const required = calculateRequiredColaciones(billableMeals);
  const current = getColacionesForWeek(orderItems, weekName);

  return {
    required,
    current,
    isMet: required === 0 || current === required,
    remaining: Math.max(0, required - current)
  };
}
