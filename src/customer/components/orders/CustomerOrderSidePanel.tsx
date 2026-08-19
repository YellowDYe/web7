import React from 'react';
import { Receipt, Trash2, Package, Users, ShoppingCart, Tag, Loader } from 'lucide-react';
import { PendingOrderItem, BILLABLE_MEAL_TYPES } from '../../../types/orderMenu';
import { DeliveryOption } from '../../../types/deliveryOption';
import { Coupon } from '../../../types/coupon';
import { DiscountWithAmount } from '../../../components/orders/OrderSummary';
import { calculatePriceBreakdown } from '../../../utils/priceCalculations';
import { getBillableMealCountForWeek, getTotalMealCountForWeek } from '../../../utils/orderValidation';
import { getValidationMessage } from '../../../utils/orderValidation';
import { validateOrderWeeks } from '../../../utils/orderValidation';

interface CustomerOrderSidePanelProps {
  orderItems: PendingOrderItem[];
  selectedDeliveryOption: DeliveryOption | null;
  appliedDiscounts: DiscountWithAmount[];
  couponDiscountAmount: number;
  appliedCoupon: Coupon | null;
  onRemoveItem: (itemToRemove: PendingOrderItem | string) => void;
  onAddToCart: () => void;
  onClearOrder: () => void;
  orderNotes: string;
  onOrderNotesChange: (notes: string) => void;
  isFirstOrder: boolean;
  loading: boolean;
  canAddToCart: boolean;
}

const formatCurrency = (amount: number): string =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(amount);

const CustomerOrderSidePanel: React.FC<CustomerOrderSidePanelProps> = ({
  orderItems,
  selectedDeliveryOption,
  appliedDiscounts,
  couponDiscountAmount,
  appliedCoupon,
  onRemoveItem,
  onAddToCart,
  onClearOrder,
  orderNotes,
  onOrderNotesChange,
  isFirstOrder,
  loading,
  canAddToCart,
}) => {
  const [confirmClear, setConfirmClear] = React.useState(false);

  const handleClearClick = () => setConfirmClear(true);
  const handleConfirmClear = () => { setConfirmClear(false); onClearOrder(); };
  const handleCancelClear = () => setConfirmClear(false);
  const itemsByWeek = orderItems.reduce((acc, item) => {
    const weekName = item.week_name || 'Sin semana';
    if (!acc[weekName]) acc[weekName] = [];
    acc[weekName].push(item);
    return acc;
  }, {} as Record<string, PendingOrderItem[]>);

  const totalBillableMeals = orderItems
    .filter(item => BILLABLE_MEAL_TYPES.includes(item.meal_type))
    .reduce((sum, item) => sum + item.quantity, 0);

  const totalMeals = orderItems.reduce((sum, item) => sum + item.quantity, 0);

  const itemsTotal = orderItems.reduce((total, item) => {
    if (BILLABLE_MEAL_TYPES.includes(item.meal_type as any)) {
      return total + item.meal_plan_price * item.quantity;
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
    0,
    taxRate
  );

  const orderValidation = validateOrderWeeks(orderItems);

  if (orderItems.length === 0) {
    return (
      <div className="bg-white rounded-2xl shadow-lg p-6 flex flex-col items-center justify-center text-center min-h-[300px]">
        <div className="bg-gray-100 p-4 rounded-full mb-4">
          <Receipt className="w-8 h-8 text-gray-400" />
        </div>
        <p className="text-gray-500 font-medium">Tu pedido está vacío</p>
        <p className="text-sm text-gray-400 mt-1">Selecciona tiempos de comida y agrega al pedido</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-lg overflow-hidden flex flex-col">
      {/* Header - always visible */}
      <div className="bg-gradient-to-r from-gray-900 to-gray-700 px-5 py-4 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Receipt className="w-5 h-5 text-white" />
            <h2 className="text-base font-semibold text-white">Resumen del Pedido</h2>
          </div>
          <div className="flex items-center space-x-3">
            <div className="text-right">
              <p className="text-xs text-gray-300">{totalBillableMeals} comidas</p>
              {totalMeals > totalBillableMeals && (
                <p className="text-xs text-gray-400">+{totalMeals - totalBillableMeals} colaciones</p>
              )}
            </div>
            {!loading && (
              <button
                onClick={handleClearClick}
                title="Vaciar pedido"
                className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-white/10 rounded-lg transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {confirmClear && (
          <div className="mt-3 bg-white/10 rounded-xl px-4 py-3">
            <p className="text-xs text-white font-medium mb-2">¿Vaciar todos los platillos seleccionados?</p>
            <div className="flex space-x-2">
              <button
                onClick={handleConfirmClear}
                className="flex-1 bg-red-500 hover:bg-red-600 text-white text-xs font-semibold py-1.5 rounded-lg transition-colors"
              >
                Sí, vaciar
              </button>
              <button
                onClick={handleCancelClear}
                className="flex-1 bg-white/20 hover:bg-white/30 text-white text-xs font-semibold py-1.5 rounded-lg transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="p-5 space-y-5">
        {/* Items by Week */}
        <div className="space-y-4">
          {Object.entries(itemsByWeek).map(([weekName, items]) => {
            const billableCount = getBillableMealCountForWeek(orderItems, weekName);
            const totalCount = getTotalMealCountForWeek(orderItems, weekName);

            return (
              <div key={weekName} className="border border-gray-200 rounded-xl overflow-hidden">
                <div className="bg-gray-50 px-3 py-2 border-b border-gray-200 flex items-center justify-between">
                  <div className="flex items-center space-x-1.5">
                    <Package className="w-3.5 h-3.5 text-gray-500" />
                    <span className="text-xs font-semibold text-gray-700">{weekName}</span>
                  </div>
                  <span className="text-xs text-gray-500">
                    {billableCount} comida{billableCount !== 1 ? 's' : ''}
                    {totalCount > billableCount && ` + ${totalCount - billableCount} col.`}
                  </span>
                </div>

                <div className="divide-y divide-gray-50">
                  {items.map(item => (
                    <div key={item.tempId} className="flex items-start justify-between px-3 py-2">
                      <div className="flex-1 min-w-0 pr-2">
                        <div className="flex items-center flex-wrap gap-1">
                          <span className="text-xs font-medium text-gray-900 truncate">
                            {item.day_of_week} · {item.meal_type}
                          </span>
                          {BILLABLE_MEAL_TYPES.includes(item.meal_type as any) && (
                            <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-medium">
                              {item.meal_plan_name}
                            </span>
                          )}
                          {item.family_member_name && (
                            <span className="text-xs bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded inline-flex items-center gap-0.5">
                              <Users className="w-2.5 h-2.5" />
                              {item.family_member_name}
                            </span>
                          )}
                        </div>
                        {item.recipe_name && (
                          <p className="text-xs text-gray-400 italic mt-0.5 truncate">{item.recipe_name}</p>
                        )}
                      </div>

                      <div className="flex items-center space-x-2 flex-shrink-0">
                        {BILLABLE_MEAL_TYPES.includes(item.meal_type as any) ? (
                          <span className="text-xs font-semibold text-gray-800">
                            x{item.quantity}
                          </span>
                        ) : (
                          <span className="text-xs text-green-600 font-medium italic">incluida</span>
                        )}
                        <button
                          onClick={() => !loading && onRemoveItem(item.tempId!)}
                          disabled={loading}
                          className="p-1 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded transition-colors disabled:opacity-40"
                        >
                          <Trash2 className="w-3 h-3" />
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
        <div className="border-t border-gray-100 pt-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Subtotal</span>
            <span className="font-medium text-gray-900">{formatCurrency(itemsTotal)}</span>
          </div>

          {appliedDiscounts.length > 0 && (
            <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-2">
              <div className="flex justify-between items-center">
                <div className="flex items-center space-x-1.5">
                  <Tag className="w-3.5 h-3.5 text-green-600 flex-shrink-0" />
                  <span className="text-sm font-medium text-green-800">
                    Descuento por cantidad
                  </span>
                </div>
                <span className="text-sm font-bold text-green-700">-{formatCurrency(appliedDiscounts.reduce((sum, d) => sum + d.amount, 0))}</span>
              </div>
            </div>
          )}

          {selectedDeliveryOption && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Envío ({selectedDeliveryOption.delivery_options_name})</span>
              <span className="font-medium text-gray-900">{formatCurrency(deliveryPrice)}</span>
            </div>
          )}

          {appliedCoupon && couponDiscountAmount > 0 && (
            <div className="flex justify-between text-sm text-green-600">
              <span>Cupón ({appliedCoupon.code})</span>
              <span>-{formatCurrency(couponDiscountAmount)}</span>
            </div>
          )}

          <div className="flex justify-between text-sm">
            <span className="text-gray-500">IVA (16%)</span>
            <span className="font-medium text-gray-900">{formatCurrency(priceBreakdown.taxAmount)}</span>
          </div>

          <div className="pt-2 border-t border-gray-200 flex justify-between items-baseline">
            <span className="text-base font-bold text-gray-900">Total</span>
            <span className="text-xl font-bold text-red-600">{formatCurrency(priceBreakdown.finalTotal)}</span>
          </div>
        </div>

        {/* First Order Banner */}
        {isFirstOrder && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-3 flex items-start space-x-2">
            <Tag className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-xs font-semibold text-green-800">Descuento de primer pedido</p>
              <p className="text-xs text-green-700 mt-0.5">
                Cupón <span className="font-mono font-bold">PRIMERPEDIDO</span> aplicado (15% off)
              </p>
            </div>
          </div>
        )}

        {/* Order Notes */}
        <div className="border-t border-gray-100 pt-4">
          <p className="text-sm font-semibold text-gray-700 mb-2">Notas (Opcional)</p>
          <textarea
            value={orderNotes}
            onChange={e => onOrderNotesChange(e.target.value)}
            disabled={loading}
            maxLength={500}
            rows={2}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 resize-none"
            placeholder="Instrucciones especiales..."
          />
          <p className="mt-1 text-xs text-gray-400">{orderNotes.length}/500</p>
        </div>

        {/* Add to Cart Button */}
        <div className="border-t border-gray-100 pt-4">
          <button
            onClick={onAddToCart}
            disabled={!canAddToCart || loading}
            className="w-full bg-red-500 hover:bg-red-600 disabled:bg-gray-200 disabled:text-gray-400 text-white px-4 py-3.5 rounded-xl font-semibold text-sm transition-all active:scale-95 disabled:cursor-not-allowed disabled:active:scale-100 flex items-center justify-center space-x-2"
          >
            {loading ? (
              <>
                <Loader className="w-4 h-4 animate-spin" />
                <span>Procesando...</span>
              </>
            ) : (
              <>
                <ShoppingCart className="w-4 h-4" />
                <span>Agregar al Carrito</span>
              </>
            )}
          </button>
          {!canAddToCart && !loading && orderItems.length > 0 && (
            <p className="mt-2 text-center text-xs text-orange-600 font-medium">
              {!orderValidation.isValid
                ? getValidationMessage(orderValidation.incompleteWeeks)
                : !selectedDeliveryOption
                  ? 'Selecciona una opción de entrega para continuar'
                  : ''}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default CustomerOrderSidePanel;
