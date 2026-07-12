import React from 'react';
import { UtensilsCrossed, Coffee, CheckCircle, Users } from 'lucide-react';
import { SelectedWeek } from '../../../types/week';
import { MealPlan } from '../../../types/mealPlan';
import { PendingOrderItem, BILLABLE_MEAL_TYPES } from '../../../types/orderMenu';
import MenuPlanningGrid from '../../../components/orders/MenuPlanningGrid';
import { CustomerWithDetails } from '../../../types/customer';
import { FamilyMember } from '../../../types/familyMember';
import { getColacionesRequirement, planIncludesColaciones } from '../../../utils/colacionesHelper';

interface CustomerMenuGridProps {
  activeWeek: SelectedWeek;
  selectedPlan: MealPlan;
  customer: any;
  selectedFamilyMember?: FamilyMember | null;
  onAddToOrder: (item: PendingOrderItem) => void;
  onRemoveFromOrder: (itemToRemove: PendingOrderItem | string) => void;
  orderItems: PendingOrderItem[];
  disabled?: boolean;
}

const CustomerMenuGrid: React.FC<CustomerMenuGridProps> = ({
  activeWeek,
  selectedPlan,
  customer,
  selectedFamilyMember,
  onAddToOrder,
  onRemoveFromOrder,
  orderItems,
  disabled = false
}) => {
  const effectiveRestrictions = selectedFamilyMember
    ? selectedFamilyMember.family_member_restrictions
    : (customer?.customer_restrictions || []);

  const customerWithDetails: CustomerWithDetails | null = customer ? {
    id: customer.id,
    customer_id: customer.customer_id,
    customer_name: customer.customer_name,
    customer_lastname: customer.customer_lastname,
    customer_email: customer.customer_email,
    customer_phone: customer.customer_phone,
    customer_street: customer.customer_street,
    customer_street_number: customer.customer_street_number,
    customer_interior_number: customer.customer_interior_number,
    customer_colonia: customer.customer_colonia,
    customer_delegacion: customer.customer_delegacion,
    customer_postal_code: customer.customer_postal_code,
    customer_delivery_instructions: customer.customer_delivery_instructions,
    customer_restrictions: effectiveRestrictions,
    full_name: `${customer.customer_name} ${customer.customer_lastname}`,
    rfc: customer.rfc,
    billing_name: customer.billing_name,
    tax_regime: customer.tax_regime,
    billing_street: customer.billing_street,
    created_at: customer.created_at,
    updated_at: customer.updated_at
  } : null;

  // Count items for this week
  const itemCountForWeek = orderItems.filter(
    item => item.week_name === activeWeek.week.week_name
  ).reduce((sum, item) => sum + item.quantity, 0);

  // Count billable meals for this week
  const billableMealsCount = orderItems.filter(
    item => item.week_name === activeWeek.week.week_name && BILLABLE_MEAL_TYPES.includes(item.meal_type)
  ).reduce((sum, item) => sum + item.quantity, 0);

  // Get colaciones requirement
  const colacionesReq = getColacionesRequirement(
    orderItems,
    activeWeek.week.week_name,
    selectedPlan.meal_plans_id
  );

  const needsColaciones = planIncludesColaciones(selectedPlan.meal_plans_id);

  const personName = selectedFamilyMember
    ? selectedFamilyMember.family_member_name
    : `${customer?.customer_name} ${customer?.customer_lastname}`;

  return (
    <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <div className="bg-purple-100 p-2 rounded-lg">
            <UtensilsCrossed className="w-5 h-5 text-purple-600" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Selecciona tus Comidas</h2>
            <p className="text-sm text-gray-600">
              Haz clic en las comidas que deseas para <span className="font-medium">{activeWeek.week.week_name}</span>
              {selectedFamilyMember && (
                <span className="ml-2 inline-flex items-center px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full text-xs font-medium">
                  <Users className="w-3 h-3 mr-1" />
                  {personName}
                </span>
              )}
            </p>
          </div>
        </div>

        {itemCountForWeek > 0 && (
          <div className="px-4 py-2 bg-green-100 rounded-lg">
            <p className="text-sm font-medium text-green-700">
              {itemCountForWeek} {itemCountForWeek === 1 ? 'comida seleccionada' : 'comidas seleccionadas'}
            </p>
          </div>
        )}
      </div>

      {billableMealsCount < 3 && (
        <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-xl">
          <p className="text-sm text-yellow-800">
            Selecciona al menos 3 comidas principales para continuar. Has seleccionado {billableMealsCount} {billableMealsCount === 1 ? 'comida' : 'comidas'}.
          </p>
        </div>
      )}

      {needsColaciones && billableMealsCount >= 3 && colacionesReq && colacionesReq.required > 0 && (
        <div className={`mb-4 p-4 border rounded-xl ${
          colacionesReq.isMet
            ? 'bg-green-50 border-green-200'
            : 'bg-blue-50 border-blue-200'
        }`}>
          <div className="flex items-start space-x-3">
            <div className={`p-1.5 rounded-lg ${
              colacionesReq.isMet ? 'bg-green-100' : 'bg-blue-100'
            }`}>
              {colacionesReq.isMet ? (
                <CheckCircle className="w-5 h-5 text-green-600" />
              ) : (
                <Coffee className="w-5 h-5 text-blue-600" />
              )}
            </div>
            <div className="flex-1">
              <h3 className={`text-sm font-semibold mb-1 ${
                colacionesReq.isMet ? 'text-green-900' : 'text-blue-900'
              }`}>
                {colacionesReq.isMet ? '¡Colaciones Incluidas!' : 'Ajustando Colaciones...'}
              </h3>
              <p className={`text-sm ${
                colacionesReq.isMet ? 'text-green-800' : 'text-blue-800'
              }`}>
                {colacionesReq.isMet ? (
                  <>
                    Tu plan incluye <strong>{colacionesReq.required} colaciones</strong> para esta semana
                    ({billableMealsCount} comidas × 2, máximo 10). Puedes cambiarlas en el menú.
                  </>
                ) : (
                  <>
                    Con {billableMealsCount} comidas principales tu plan requiere exactamente <strong>{colacionesReq.required} colaciones</strong>.
                    Actualmente tienes {colacionesReq.current}.
                  </>
                )}
              </p>
            </div>
          </div>
        </div>
      )}

      <MenuPlanningGrid
        activeWeek={activeWeek}
        selectedPlan={selectedPlan}
        selectedCustomer={customerWithDetails}
        onAddToOrder={onAddToOrder}
        onRemoveFromOrder={onRemoveFromOrder}
        orderItems={orderItems}
        disabled={disabled}
      />
    </div>
  );
};

export default CustomerMenuGrid;
