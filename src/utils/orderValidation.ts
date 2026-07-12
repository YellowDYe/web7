import { PendingOrderItem } from '../types/orderWeek';
import { BILLABLE_MEAL_TYPES } from '../types/mealTypes';

export const MINIMUM_MEALS_PER_WEEK = 3;

export interface WeekMealCount {
  weekName: string;
  weekId: string;
  billableMealCount: number;
  totalMealCount: number;
  meetsMinimum: boolean;
  colacionesRequired?: number;
  colacionesSelected?: number;
  needsMoreColaciones?: boolean;
}

export interface ValidationResult {
  isValid: boolean;
  weekCounts: WeekMealCount[];
  incompleteWeeks: WeekMealCount[];
  weeksNeedingColaciones: WeekMealCount[];
}

export function calculateBillableMealsPerWeek(
  orderItems: PendingOrderItem[]
): Map<string, WeekMealCount> {
  const weekMap = new Map<string, WeekMealCount>();

  orderItems.forEach(item => {
    const weekKey = item.week_name;

    if (!weekMap.has(weekKey)) {
      weekMap.set(weekKey, {
        weekName: item.week_name,
        weekId: item.week_id || '',
        billableMealCount: 0,
        totalMealCount: 0,
        meetsMinimum: false
      });
    }

    const weekCount = weekMap.get(weekKey)!;
    weekCount.totalMealCount += item.quantity;

    if (BILLABLE_MEAL_TYPES.includes(item.meal_type)) {
      weekCount.billableMealCount += item.quantity;
    }

    weekCount.meetsMinimum = weekCount.billableMealCount >= MINIMUM_MEALS_PER_WEEK;
    weekMap.set(weekKey, weekCount);
  });

  return weekMap;
}

export function validateOrderWeeks(orderItems: PendingOrderItem[]): ValidationResult {
  const weekCounts = Array.from(calculateBillableMealsPerWeek(orderItems).values());
  const incompleteWeeks = weekCounts.filter(week => !week.meetsMinimum);

  return {
    isValid: incompleteWeeks.length === 0 && weekCounts.length > 0,
    weekCounts,
    incompleteWeeks,
    weeksNeedingColaciones: []
  };
}

export function getValidationMessage(incompleteWeeks: WeekMealCount[]): string {
  if (incompleteWeeks.length === 0) {
    return '';
  }

  if (incompleteWeeks.length === 1) {
    const week = incompleteWeeks[0];
    const needed = MINIMUM_MEALS_PER_WEEK - week.billableMealCount;
    return `${week.weekName} necesita ${needed} comida${needed > 1 ? 's' : ''} más (${week.billableMealCount}/${MINIMUM_MEALS_PER_WEEK})`;
  }

  const messages = incompleteWeeks.map(week => {
    const needed = MINIMUM_MEALS_PER_WEEK - week.billableMealCount;
    return `${week.weekName}: ${needed} más`;
  });

  return `Completa estas semanas: ${messages.join(', ')}`;
}

export function getColacionesValidationMessage(weeksNeedingColaciones: WeekMealCount[]): string {
  if (weeksNeedingColaciones.length === 0) {
    return '';
  }

  if (weeksNeedingColaciones.length === 1) {
    const week = weeksNeedingColaciones[0];
    return `${week.weekName} requiere exactamente ${week.colacionesRequired} colaciones (tienes ${week.colacionesSelected})`;
  }

  const messages = weeksNeedingColaciones.map(week =>
    `${week.weekName}: ${week.colacionesSelected}/${week.colacionesRequired}`
  );

  return `Colaciones incorrectas: ${messages.join(', ')}`;
}

export function getBillableMealCountForWeek(
  orderItems: PendingOrderItem[],
  weekName: string
): number {
  return orderItems
    .filter(item => item.week_name === weekName && BILLABLE_MEAL_TYPES.includes(item.meal_type))
    .reduce((sum, item) => sum + item.quantity, 0);
}

export function getTotalMealCountForWeek(
  orderItems: PendingOrderItem[],
  weekName: string
): number {
  return orderItems
    .filter(item => item.week_name === weekName)
    .reduce((sum, item) => sum + item.quantity, 0);
}
