import React, { useState, useEffect } from 'react';
import { Utensils, Check, Loader2 } from 'lucide-react';
import { SelectedWeek } from '../../../types/week';
import { MealPlan } from '../../../types/mealPlan';
import { PendingOrderItem, BILLABLE_MEAL_TYPES } from '../../../types/orderMenu';
import { mealPlanService } from '../../../services/mealPlanService';

interface CustomerMealPlanSelectorProps {
  activeWeek: SelectedWeek;
  selectedPlan: MealPlan | null;
  onPlanSelect: (plan: MealPlan | null) => void;
  disabled?: boolean;
  orderItems?: PendingOrderItem[];
}

const CustomerMealPlanSelector: React.FC<CustomerMealPlanSelectorProps> = ({
  activeWeek,
  selectedPlan,
  onPlanSelect,
  disabled = false,
  orderItems = []
}) => {
  const [mealPlans, setMealPlans] = useState<MealPlan[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadMealPlans();
  }, []);

  const loadMealPlans = async () => {
    try {
      setLoading(true);
      const plans = await mealPlanService.getPlans();
      setMealPlans(plans);
    } catch (error) {
      console.error('Error loading meal plans:', error);
    } finally {
      setLoading(false);
    }
  };

  // Calculate billable dish count per plan for active week
  const getDishCountForPlan = (planId: string) => {
    return orderItems
      .filter(item =>
        item.meal_plans_id === planId &&
        item.week_name === activeWeek.week.week_name &&
        BILLABLE_MEAL_TYPES.includes(item.meal_type)
      )
      .reduce((sum, item) => sum + item.quantity, 0);
  };

  return (
    <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
      <div className="flex items-center space-x-3 mb-6">
        <div className="bg-orange-100 p-2 rounded-lg">
          <Utensils className="w-5 h-5 text-orange-600" />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Selecciona tu Plan</h2>
          <p className="text-sm text-gray-600">
            Para la semana: <span className="font-medium text-gray-900">{activeWeek.week.week_name}</span>
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-red-500" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {mealPlans.map((plan) => {
            const dishCount = getDishCountForPlan(plan.meal_plans_id);
            const hasDishes = dishCount > 0;

            return (
              <button
                key={plan.meal_plans_id}
                onClick={() => !disabled && onPlanSelect(plan)}
                disabled={disabled}
                className={`relative p-6 rounded-xl border-2 transition-all duration-200 text-left ${
                  selectedPlan?.meal_plans_id === plan.meal_plans_id
                    ? 'border-red-500 bg-red-50'
                    : hasDishes
                    ? 'border-green-500 bg-green-50'
                    : 'border-gray-200 hover:border-red-300 bg-white'
                } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
              >
                <div className="absolute top-4 right-4 flex items-center space-x-2">
                  {hasDishes && (
                    <div className="w-7 h-7 bg-green-500 rounded-full flex items-center justify-center">
                      <span className="text-xs font-bold text-white">{dishCount}</span>
                    </div>
                  )}
                  {selectedPlan?.meal_plans_id === plan.meal_plans_id && (
                    <div className="w-6 h-6 bg-red-500 rounded-full flex items-center justify-center">
                      <Check className="w-4 h-4 text-white" />
                    </div>
                  )}
                </div>

              <div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">
                  {plan.meal_plans_name}
                </h3>

                <div className="mt-4">
                  <p className="text-sm text-gray-600">
                    Selecciona tus comidas favoritas del menú semanal
                  </p>
                </div>
              </div>
            </button>
          );
        })}
        </div>
      )}

      {selectedPlan && (
        <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-xl">
          <p className="text-sm text-green-800">
            Plan seleccionado: <strong>{selectedPlan.meal_plans_name}</strong>
          </p>
        </div>
      )}
    </div>
  );
};

export default CustomerMealPlanSelector;
