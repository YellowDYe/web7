import React from 'react';
import { Trash2, Calendar, UtensilsCrossed, Truck, Percent, Tag } from 'lucide-react';
import { PendingOrderItem, BILLABLE_MEAL_TYPES } from '../../types/orderMenu';
import { DeliveryOption } from '../../types/deliveryOption';
import { Discount } from '../../types/discount';
import { Coupon } from '../../types/coupon';
import { calculatePriceBreakdown } from '../../utils/priceCalculations';

export interface DiscountWithAmount {
  discount: Discount;
  amount: number;
}

interface OrderSummaryProps {
  orderItems: PendingOrderItem[];
  selectedDeliveryOption: DeliveryOption | null;
  appliedDiscounts: DiscountWithAmount[];
  couponDiscountAmount?: number;
  appliedCoupon?: Coupon | null;
  customDiscountAmount?: number;
  onRemoveItem: (tempId: string) => void;
  disabled?: boolean;
}

const OrderSummary: React.FC<OrderSummaryProps> = ({
  orderItems,
  selectedDeliveryOption,
  appliedDiscounts,
  couponDiscountAmount = 0,
  appliedCoupon = null,
  customDiscountAmount = 0,
  onRemoveItem,
  disabled = false
}) => {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(Math.round(amount));
  };

  const getMealTypeLabel = (mealType: string) => {
    return mealType;
  };

  const getDayLabel = (day: string) => {
    return day;
  };

  // Calculate total price (only billable meal types)
  const calculateItemsTotal = () => {
    return orderItems.reduce((total, item) => {
      // Only count billable meal types (exclude snacks)
      if (BILLABLE_MEAL_TYPES.includes(item.meal_type as any)) {
        return total + (item.meal_plan_price * item.quantity);
      }
      return total;
    }, 0);
  };

  const calculateBillableDishes = () => {
    return orderItems.reduce((total, item) => {
      if (BILLABLE_MEAL_TYPES.includes(item.meal_type as any)) {
        return total + item.quantity;
      }
      return total;
    }, 0);
  };

  // Group items by week
  const groupedItems = orderItems.reduce((groups, item) => {
    const weekKey = item.week_name;
    if (!groups[weekKey]) {
      groups[weekKey] = [];
    }
    groups[weekKey].push(item);
    return groups;
  }, {} as Record<string, PendingOrderItem[]>);

  // Debug logging
  React.useEffect(() => {
    console.log('[OrderSummary] Order items received:', orderItems.map(item => ({
      tempId: item.tempId,
      recipe_name: item.recipe_name,
      meal_type: item.meal_type,
      day_of_week: item.day_of_week,
      meal_plan_name: item.meal_plan_name
    })));
  }, [orderItems]);

  // Calculate totals using centralized utility
  const itemsTotal = calculateItemsTotal();
  const billableDishes = calculateBillableDishes();
  const totalPlanDiscounts = appliedDiscounts.reduce((sum, d) => sum + d.amount, 0);
  const deliveryPrice = selectedDeliveryOption ? selectedDeliveryOption.delivery_options_price : 0;
  const taxRate = 16; // TODO: Get from tax service

  // Use centralized price calculation utility for consistency
  const priceBreakdown = calculatePriceBreakdown(
    itemsTotal,
    totalPlanDiscounts,
    deliveryPrice,
    couponDiscountAmount,
    customDiscountAmount,
    taxRate
  );

  // Extract values from breakdown for display
  const subtotalAfterPlanDiscounts = priceBreakdown.subtotalAfterPlanDiscounts;
  const itemTaxAmount = priceBreakdown.taxAmount;
  const deliveryTaxAmount = priceBreakdown.deliveryTaxAmount;
  const totalPrice = priceBreakdown.finalTotal;
  const totalPlatillos = orderItems.reduce((total, item) => total + item.quantity, 0);

  if (orderItems.length === 0) {
    return (
      <div className="bg-white rounded-2xl shadow-lg p-2 sm:p-6 lg:p-8 mx-1 sm:mx-0">
        <div className="flex items-center space-x-3 mb-6">
          <div className="bg-success-100 p-2 rounded-lg">
            <UtensilsCrossed className="w-5 h-5 text-success-600" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900 font-poppins">
            Resumen del Pedido
          </h2>
        </div>
        
        <div className="text-center py-8">
          <div className="bg-gray-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
            <UtensilsCrossed className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            No hay elementos en el pedido
          </h3>
          <p className="text-gray-600">
            Agrega elementos desde la planificación de menú
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-lg p-2 sm:p-4 md:p-6 lg:p-8">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <div className="bg-success-100 p-2 rounded-lg">
            <UtensilsCrossed className="w-5 h-5 text-success-600" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900 font-poppins">
            Resumen del Pedido
          </h2>
        </div>
        
        <div className="text-sm text-gray-600">
          {orderItems.length} elemento{orderItems.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Order Items by Week */}
      <div className="space-y-6">
        {Object.entries(groupedItems).map(([weekName, items]) => (
          <div key={weekName} className="border border-gray-200 rounded-xl p-4">
            <div className="flex items-center space-x-2 mb-3">
              <Calendar className="w-4 h-4 text-primary-600" />
              <h3 className="font-semibold text-gray-900">
                {weekName}
              </h3>
              <span className="text-xs text-gray-500">
                ({items.length} elemento{items.length !== 1 ? 's' : ''})
              </span>
            </div>
            
            <div className="space-y-2">
              {items.map((item) => (
                <div
                  key={item.tempId}
                  className="flex items-center justify-between p-2 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center justify-between w-full text-xs sm:text-sm">
                    <div className="flex items-center space-x-2 flex-1 min-w-0">
                      <span className="font-medium text-gray-900 truncate">
                        {item.meal_plan_name}
                      </span>
                      {item.family_member_name && (
                        <span className="inline-flex items-center px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs font-medium whitespace-nowrap">
                          {item.family_member_name}
                        </span>
                      )}
                      <span className={`truncate ${item.recipe_name ? 'text-gray-600' : 'text-gray-400 italic'}`}>
                        {item.recipe_name || 'Sin receta'}
                      </span>
                      <span className="text-gray-500 whitespace-nowrap hidden sm:inline">
                        {getMealTypeLabel(item.meal_type)}
                      </span>
                      <span className="text-gray-500 whitespace-nowrap hidden sm:inline">
                        {getDayLabel(item.day_of_week)}
                      </span>
                      {/* Mobile: Show meal type and day in abbreviated form */}
                      <span className="text-gray-500 whitespace-nowrap sm:hidden">
                        {item.meal_type.charAt(0)}/{item.day_of_week.substring(0, 3)}
                      </span>
                      <span className="text-gray-700 font-medium whitespace-nowrap">
                        x{item.quantity}
                      </span>
                      {BILLABLE_MEAL_TYPES.includes(item.meal_type as any) && (
                        <span className="font-semibold text-gray-900 whitespace-nowrap">
                          {formatCurrency(item.meal_plan_price * item.quantity)}
                        </span>
                      )}
                    </div>
                  </div>

                  {!disabled && (
                    <button
                      onClick={() => onRemoveItem(item.tempId)}
                      className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0"
                      title="Eliminar elemento"
                      aria-label={`Eliminar ${item.recipe_name || 'elemento'} del ${item.day_of_week}`}
                    >
                      <Trash2 className="w-3 h-3 sm:w-4 sm:h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Total Price */}
      <div className="mt-6 pt-6 border-t border-gray-200">
        {/* Delivery Option */}
        {selectedDeliveryOption && (
          <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Truck className="w-5 h-5 text-blue-600" />
                <div>
                  <h4 className="font-medium text-blue-900">
                    {selectedDeliveryOption.delivery_options_name}
                  </h4>
                  <p className="text-sm text-blue-700">
                    {selectedDeliveryOption.delivery_options_description}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-semibold text-blue-900">
                  {formatCurrency(selectedDeliveryOption.delivery_options_price)}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Subtotals */}
        <div className="space-y-2 mb-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">Subtotal (comidas):</span>
            <span className="font-medium text-gray-900">
              {formatCurrency(itemsTotal)}
            </span>
          </div>
          
          {/* Plan-specific Discounts */}
          {appliedDiscounts.length > 0 && appliedDiscounts.map((discountWithAmount, index) => (
            <div key={index} className="flex items-center justify-between text-sm">
              <div className="flex items-center space-x-2">
                <Percent className="w-4 h-4 text-green-600" />
                <span className="text-green-600">
                  Descuento {discountWithAmount.discount.discount_name} ({discountWithAmount.discount.discount_percentage}%):
                </span>
              </div>
              <span className="font-medium text-green-600">
                -{formatCurrency(discountWithAmount.amount)}
              </span>
            </div>
          ))}

          {/* Coupon Discount */}
          {couponDiscountAmount > 0 && appliedCoupon && (
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center space-x-2">
                <Tag className="w-4 h-4 text-purple-600" />
                <span className="text-purple-600 font-medium">
                  Cupón {appliedCoupon.code}:
                </span>
              </div>
              <span className="font-semibold text-purple-600">
                -{formatCurrency(couponDiscountAmount)}
              </span>
            </div>
          )}

          {/* Custom Discount */}
          {customDiscountAmount > 0 && (
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center space-x-2">
                <Percent className="w-4 h-4 text-yellow-600" />
                <span className="text-yellow-600 font-medium">
                  Descuento personalizado:
                </span>
              </div>
              <span className="font-semibold text-yellow-600">
                -{formatCurrency(customDiscountAmount)}
              </span>
            </div>
          )}

          <div className="flex items-center justify-between text-sm pt-2 border-t border-gray-200">
            <span className="text-gray-700 font-medium">Subtotal (platillos):</span>
            <span className="font-semibold text-gray-900">
              {formatCurrency(subtotalAfterPlanDiscounts)}
            </span>
          </div>

          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">IVA platillos ({taxRate}%):</span>
            <span className="font-medium text-gray-900">
              {formatCurrency(itemTaxAmount)}
            </span>
          </div>

          {selectedDeliveryOption && (
            <>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Envío:</span>
                <span className="font-medium text-gray-900">
                  {formatCurrency(deliveryPrice)}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">IVA envío ({taxRate}%):</span>
                <span className="font-medium text-gray-900">
                  {formatCurrency(deliveryTaxAmount)}
                </span>
              </div>
            </>
          )}

          <div className="flex items-center justify-between text-sm pt-2 border-t border-gray-200">
            <span className="text-gray-700 font-semibold">Total:</span>
            <span className="font-bold text-gray-900">
              {formatCurrency(totalPrice)}
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-600">
              Total del Pedido
            </p>
            <p className="text-xs text-gray-500 mt-1">
              * Comidas + envío (excluye colaciones)
            </p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-gray-900 font-poppins">
              {formatCurrency(totalPrice)}
            </p>
            <p className="text-sm text-gray-500">
              {billableDishes} platillo{billableDishes !== 1 ? 's' : ''} facturab{billableDishes !== 1 ? 'les' : 'le'}
              {appliedDiscounts.length > 0 && (
                <span className="block text-green-600 font-medium">
                  {appliedDiscounts.length === 1
                    ? `Descuento aplicado: ${appliedDiscounts[0].discount.discount_name}`
                    : `${appliedDiscounts.length} descuentos aplicados`
                  }
                </span>
              )}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OrderSummary;