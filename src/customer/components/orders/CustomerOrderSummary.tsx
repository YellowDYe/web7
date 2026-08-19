import React from 'react';
import { Receipt, Trash2, Package, Users } from 'lucide-react';
import { PendingOrderItem, BILLABLE_MEAL_TYPES } from '../../../types/orderMenu';
import { DeliveryOption } from '../../../types/deliveryOption';
import { Coupon } from '../../../types/coupon';
import { DiscountWithAmount } from '../../../components/orders/OrderSummary';
import { calculatePriceBreakdown } from '../../../utils/priceCalculations';
import { getBillableMealCountForWeek, getTotalMealCountForWeek } from '../../../utils/orderValidation';

interface CustomerOrderSummaryProps {
  orderItems: PendingOrderItem[];
  selectedDeliveryOption: DeliveryOption | null;
  appliedDiscounts: DiscountWithAmount[];
  couponDiscountAmount: number;
  appliedCoupon: Coupon | null;
  onRemoveItem: (itemToRemove: PendingOrderItem | string) => void;
  disabled?: boolean;
}

const CustomerOrderSummary: React.FC<CustomerOrderSummaryProps> = ({
  orderItems,
  selectedDeliveryOption,
  appliedDiscounts,
  couponDiscountAmount,
  appliedCoupon,
  onRemoveItem,
  disabled = false
}) => {
  // Group items by week
  const itemsByWeek = orderItems.reduce((acc, item) => {
    const weekName = item.week_name || 'Sin semana';
    if (!acc[weekName]) {
      acc[weekName] = [];
    }
    acc[weekName].push(item);
    return acc;
  }, {} as Record<string, PendingOrderItem[]>);

  // Calculate total billable meals across all weeks
  const totalBillableMeals = orderItems
    .filter(item => BILLABLE_MEAL_TYPES.includes(item.meal_type))
    .reduce((sum, item) => sum + item.quantity, 0);

  // Calculate total meals including colaciones
  const totalMeals = orderItems.reduce((sum, item) => sum + item.quantity, 0);

  // Calculate totals
  const itemsTotal = orderItems.reduce((total, item) => {
    if (BILLABLE_MEAL_TYPES.includes(item.meal_type as any)) {
      return total + (item.meal_plan_price * item.quantity);
    }
    return total;
  }, 0);

  const totalPlanDiscounts = appliedDiscounts.reduce((sum, d) => sum + d.amount, 0);
  const deliveryPrice = selectedDeliveryOption ? selectedDeliveryOption.delivery_options_price : 0;
  const taxRate = 16;

  const priceBreakdown = calculatePriceBreakdown(
    itemsTotal,
    totalPlanDiscounts,
    deliveryPrice,
    couponDiscountAmount,
    0, // No custom discount for customers
    taxRate
  );

  return (
    <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
      <div className="flex items-center space-x-3 mb-6">
        <div className="bg-green-100 p-2 rounded-lg">
          <Receipt className="w-5 h-5 text-green-600" />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Resumen del Pedido</h2>
          <p className="text-sm text-gray-600">Revisa tu selección</p>
        </div>
      </div>

      {/* Order Info - More Prominent */}
      <div className="mb-6 p-5 bg-gradient-to-br from-green-50 to-blue-50 border-2 border-green-300 rounded-xl">
        <p className="text-base text-gray-700 mb-2">
          Comidas principales: <strong className="text-gray-900">{totalBillableMeals}</strong>
          {totalMeals > totalBillableMeals && (
            <span className="text-sm text-gray-600 ml-2">
              (+ {totalMeals - totalBillableMeals} colación{totalMeals - totalBillableMeals > 1 ? 'es' : ''})
            </span>
          )}
        </p>
        {selectedDeliveryOption && (
          <p className="text-base text-gray-700">
            Opción de envío: <strong className="text-gray-900">{selectedDeliveryOption.delivery_options_name}: ${Math.round(selectedDeliveryOption.delivery_options_price * 1.16)}</strong>
          </p>
        )}
      </div>

      {/* Items by Week */}
      <div className="space-y-6 mb-6">
        {Object.entries(itemsByWeek).map(([weekName, items]) => {
          const billableCount = getBillableMealCountForWeek(orderItems, weekName);
          const totalCount = getTotalMealCountForWeek(orderItems, weekName);

          return (
            <div key={weekName} className="border border-gray-200 rounded-xl p-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2">
                  <Package className="w-4 h-4 text-gray-600" />
                  <h3 className="font-semibold text-gray-900">{weekName}</h3>
                </div>
                <div className="text-sm text-gray-600">
                  <span className="font-medium text-gray-900">{billableCount} comidas principales</span>
                  {totalCount > billableCount && (
                    <span className="ml-2">
                      (+ {totalCount - billableCount} colación{totalCount - billableCount > 1 ? 'es' : ''})
                    </span>
                  )}
                </div>
              </div>

            <div className="space-y-2">
              {items.map((item) => (
                <div
                  key={item.tempId}
                  className="flex items-center justify-between py-2 border-b border-gray-100 last:border-b-0"
                >
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 flex-wrap">
                      <span className="text-sm font-medium text-gray-900">
                        {item.day_of_week} - {item.meal_type}
                      </span>
                      {BILLABLE_MEAL_TYPES.includes(item.meal_type as any) && (
                        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                          {item.meal_plan_name}
                        </span>
                      )}
                      {item.family_member_name && (
                        <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded inline-flex items-center">
                          <Users className="w-3 h-3 mr-1" />
                          {item.family_member_name}
                        </span>
                      )}
                    </div>
                    {item.recipe_name && (
                      <p className="text-xs text-gray-500 italic mt-1">
                        {item.recipe_name}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center space-x-4">
                    <button
                      onClick={() => !disabled && onRemoveItem(item.tempId!)}
                      disabled={disabled}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
          );
        })}
      </div>

      {/* Price Breakdown */}
      <div className="border-t border-gray-200 pt-4 space-y-3">
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Subtotal de comidas:</span>
          <span className="font-medium text-gray-900">${itemsTotal.toFixed(2)}</span>
        </div>

        {appliedDiscounts.length > 0 && (
          <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-2 space-y-1.5">
            {appliedDiscounts.map((discountWithAmount, index) => (
              <div key={index} className="flex justify-between items-center">
                <div className="flex items-center space-x-1.5">
                  <span className="w-2 h-2 bg-green-500 rounded-full flex-shrink-0"></span>
                  <span className="text-sm font-medium text-green-800">
                    {discountWithAmount.discount.discount_name} ({discountWithAmount.discount.discount_percentage}%)
                  </span>
                </div>
                <span className="text-sm font-bold text-green-700">-${discountWithAmount.amount.toFixed(2)}</span>
              </div>
            ))}
          </div>
        )}

        {selectedDeliveryOption && (
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Envío ({selectedDeliveryOption.delivery_options_name}):</span>
            <span className="font-medium text-gray-900">${deliveryPrice.toFixed(2)}</span>
          </div>
        )}

        {appliedCoupon && couponDiscountAmount > 0 && (
          <div className="flex justify-between text-sm text-purple-600">
            <span>Cupón ({appliedCoupon.code}):</span>
            <span>-${couponDiscountAmount.toFixed(2)}</span>
          </div>
        )}

        <div className="flex justify-between text-sm">
          <span className="text-gray-600">IVA (16%):</span>
          <span className="font-medium text-gray-900">${priceBreakdown.taxAmount.toFixed(2)}</span>
        </div>

        <div className="pt-3 border-t border-gray-300 flex justify-between">
          <span className="text-lg font-bold text-gray-900">Total:</span>
          <span className="text-2xl font-bold text-red-600">${priceBreakdown.finalTotal.toFixed(2)}</span>
        </div>
      </div>
    </div>
  );
};

export default CustomerOrderSummary;
