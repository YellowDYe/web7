import { supabase } from '../../config/supabase';
import { weekService } from '../../services/weekService';
import { PendingOrderItem } from '../../types/orderMenu';
import { SelectedWeek } from '../../types/week';
import { MealPlan } from '../../types/mealPlan';
import { DAYS_OF_WEEK, MEAL_TYPES, dayToColumnPrefix, mealLabelToKey } from '../../types/mealTypes';

interface RepeatOrderResult {
  planDuration: 1 | 2 | 4;
  selectedWeeks: SelectedWeek[];
  selectedPlan: MealPlan | null;
  orderItems: PendingOrderItem[];
}

export async function buildRepeatOrderCart(orderId: string): Promise<RepeatOrderResult> {
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select('order_id')
    .eq('id', orderId)
    .single();

  if (orderError || !order) throw new Error('No se pudo cargar el pedido original');

  const { data: orderWeeks, error: weeksError } = await supabase
    .from('order_weeks')
    .select(`
      *,
      weeks(week_name, weekly_menu),
      meal_plans(id, meal_plans_id, meal_plans_name, meal_plans_price, meal_plans_description, created_at, updated_at)
    `)
    .eq('order_id', order.order_id);

  if (weeksError) throw new Error('No se pudieron cargar las semanas del pedido');
  if (!orderWeeks || orderWeeks.length === 0) throw new Error('El pedido no tiene semanas registradas');

  const weekCount = orderWeeks.length as 1 | 2 | 4;
  const normalizedDuration: 1 | 2 | 4 = weekCount <= 1 ? 1 : weekCount <= 2 ? 2 : 4;

  const upcomingWeeks = await weekService.getUpcomingWeeks(normalizedDuration);
  if (!upcomingWeeks || upcomingWeeks.length === 0) {
    throw new Error('No hay semanas disponibles para ordenar en este momento');
  }

  const selectedWeeks: SelectedWeek[] = upcomingWeeks.slice(0, normalizedDuration).map((week, index) => ({
    week,
    tempId: `repeat_${Date.now()}_${index}`
  }));

  const firstWeekWithPlan = orderWeeks.find(ow => ow.meal_plans);
  const selectedPlan: MealPlan | null = firstWeekWithPlan?.meal_plans
    ? {
        id: firstWeekWithPlan.meal_plans.id,
        meal_plans_id: firstWeekWithPlan.meal_plans.meal_plans_id,
        meal_plans_name: firstWeekWithPlan.meal_plans.meal_plans_name,
        meal_plans_description: firstWeekWithPlan.meal_plans.meal_plans_description || '',
        meal_plans_price: firstWeekWithPlan.meal_plans.meal_plans_price,
        created_at: firstWeekWithPlan.meal_plans.created_at,
        updated_at: firstWeekWithPlan.meal_plans.updated_at
      }
    : null;

  const orderItems: PendingOrderItem[] = [];

  for (let i = 0; i < Math.min(orderWeeks.length, selectedWeeks.length); i++) {
    const originalWeek = orderWeeks[i];
    const targetWeek = selectedWeeks[i];
    const mealPlan = originalWeek.meal_plans;

    if (!mealPlan) continue;

    for (const day of DAYS_OF_WEEK) {
      const dayPrefix = dayToColumnPrefix(day);
      for (const mt of MEAL_TYPES) {
        const col = `${dayPrefix}_${mt.key}_qty`;
        const qty = originalWeek[col];
        if (typeof qty === 'number' && qty > 0) {
          orderItems.push({
            tempId: `repeat_item_${i}_${dayPrefix}_${mt.key}_${Date.now()}`,
            meal_plans_id: mealPlan.meal_plans_id,
            meal_type: mt.label,
            day_of_week: day,
            quantity: qty,
            meal_plan_name: mealPlan.meal_plans_name,
            meal_plan_price: mt.key === 'colacion_am' || mt.key === 'colacion_pm' ? 0 : mealPlan.meal_plans_price,
            week_name: targetWeek.week.week_name,
            week_id: targetWeek.week.id,
            family_member_id: originalWeek.family_member_id || null
          });
        }
      }
    }
  }

  return {
    planDuration: normalizedDuration,
    selectedWeeks,
    selectedPlan,
    orderItems
  };
}
