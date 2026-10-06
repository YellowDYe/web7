import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Receipt, Trash2, Package, Users, ShoppingCart, Tag, Loader, LogIn, ChevronDown, ListChecks } from 'lucide-react';
import { PendingOrderItem, BILLABLE_MEAL_TYPES } from '../../../types/orderMenu';
import { MEAL_TYPES } from '../../../types/mealTypes';
import { DeliveryOption } from '../../../types/deliveryOption';
import { Coupon } from '../../../types/coupon';
import { DiscountWithAmount } from '../../../components/orders/OrderSummary';
import { calculatePriceBreakdown } from '../../../utils/priceCalculations';
import { getValidationMessage } from '../../../utils/orderValidation';
import { validateOrderWeeks } from '../../../utils/orderValidation';
import { ORDER_PAGE_DEFAULT_TEXTS, type OrderPageTexts } from '../../sections/CustomerOrder/orderPageContent';

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
  isLoggedIn: boolean;
  selectedWeekNames?: string[];
  weekLabels?: Record<string, string>;
  texts?: OrderPageTexts;
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
  isLoggedIn,
  selectedWeekNames = [],
  weekLabels = {},
  texts = ORDER_PAGE_DEFAULT_TEXTS,
}) => {
  const [confirmClear, setConfirmClear] = useState(false);
  const [expandedWeeks, setExpandedWeeks] = useState<Record<string, boolean>>({});

  const toggleWeekDetail = (weekName: string) =>
    setExpandedWeeks(prev => ({ ...prev, [weekName]: !prev[weekName] }));

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

  const orderValidation = validateOrderWeeks(orderItems, selectedWeekNames);

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
      {/* Title */}
      <div className="px-4 sm:px-5 pt-5 pb-3 flex items-center justify-between">
        <h2 className="text-xl font-bold font-antonio text-gray-900">Resumen del pedido</h2>
        <div className="flex items-center gap-2">
          {!loading && (
            <button
              onClick={handleClearClick}
              title="Vaciar pedido"
              className="flex items-center space-x-1.5 text-xs text-gray-400 hover:text-red-500 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Vaciar pedido</span>
            </button>
          )}
          {confirmClear && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-2 py-1 flex items-center gap-1.5">
              <span className="text-xs text-red-700 font-medium">¿Vaciar?</span>
              <button
                type="button"
                onClick={handleConfirmClear}
                className="bg-red-500 hover:bg-red-600 text-white text-xs font-semibold px-2 py-0.5 rounded transition-colors"
              >
                Sí
              </button>
              <button
                type="button"
                onClick={handleCancelClear}
                className="bg-gray-200 hover:bg-gray-300 text-gray-700 text-xs font-semibold px-2 py-0.5 rounded transition-colors"
              >
                No
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Detail section - always visible */}
      <div>
        <div className="px-4 sm:px-5 pb-5 space-y-5">
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
              <div className="flex justify-between gap-3 text-sm">
                <span className="text-gray-500 min-w-0">Envío ({selectedDeliveryOption.delivery_options_name})</span>
                <span className="font-medium text-gray-900 whitespace-nowrap">{formatCurrency(deliveryPrice)}</span>
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
              <span className="font-medium text-gray-900">{formatCurrency(priceBreakdown.taxAmount + priceBreakdown.deliveryTaxAmount)}</span>
            </div>

            <div className="pt-2 border-t border-gray-200 flex justify-between items-baseline">
              <span className="text-base font-bold text-gray-900">Total</span>
              <span className="text-xl font-bold text-red-600">{formatCurrency(priceBreakdown.finalTotal)}</span>
            </div>
          </div>

          {/* Add to Cart Button */}
          <div>
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
                {!isLoggedIn
                  ? ''
                  : !orderValidation.isValid
                    ? getValidationMessage(orderValidation.incompleteWeeks)
                    : !selectedDeliveryOption
                      ? texts.deliveryOptionRequired
                      : ''}
              </p>
            )}
            {!isLoggedIn && (
              <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-xl text-center">
                {texts.loginPrompt && (
                  <p className="text-sm text-amber-800 font-medium mb-2">
                    {texts.loginPrompt}
                  </p>
                )}
                <div className="flex gap-2">
                  <Link
                    to="/login?returnTo=/order"
                    className="flex-1 inline-flex items-center justify-center gap-1.5 bg-red-500 hover:bg-red-600 text-white text-xs font-semibold py-2 px-3 rounded-lg transition-colors"
                  >
                    <LogIn className="w-3.5 h-3.5" />
                    {texts.loginButton}
                  </Link>
                  <Link
                    to="/signup?returnTo=/order"
                    className="flex-1 inline-flex items-center justify-center gap-1.5 border border-red-500 text-red-500 hover:bg-red-50 text-xs font-semibold py-2 px-3 rounded-lg transition-colors"
                  >
                    {texts.signupButton}
                  </Link>
                </div>
              </div>
            )}
          </div>

          {/* Items by Week */}
          <div className="space-y-4">
            {Object.entries(itemsByWeek).map(([weekName, items]) => {
              const isWeekOpen = !!expandedWeeks[weekName];

              const planNames = Array.from(
                new Set(
                  items
                    .filter(i => BILLABLE_MEAL_TYPES.includes(i.meal_type as any) && i.meal_plan_name)
                    .map(i => i.meal_plan_name as string)
                )
              );

              const mealTypeCounts = MEAL_TYPES.map(mt => {
                const qty = items
                  .filter(i => i.meal_type === mt.label)
                  .reduce((sum, i) => sum + i.quantity, 0);
                return { label: mt.label, qty, billable: BILLABLE_MEAL_TYPES.includes(mt.label) };
              }).filter(m => m.qty > 0);

              return (
                <div key={weekName} className="border border-gray-200 rounded-xl overflow-hidden">
                  <div className="bg-gray-50 px-3 py-2.5 border-b border-gray-200 flex items-center space-x-2 min-w-0">
                    <Package className="w-4 h-4 text-gray-500 flex-shrink-0" />
                    <span className="text-sm font-semibold text-gray-800">
                      {weekLabels[weekName] ?? weekName}
                    </span>
                  </div>

                  {/* Per-week overview: plan + dish counts by meal type */}
                  <div className="px-3 py-2.5 space-y-2">
                    {planNames.length > 0 && (
                      <div className="flex items-center flex-wrap gap-1">
                        <span className="text-xs text-gray-500">Plan:</span>
                        {planNames.map(name => (
                          <span
                            key={name}
                            className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-medium"
                          >
                            {name}
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="flex flex-wrap gap-1.5">
                      {mealTypeCounts.map(m => (
                        <span
                          key={m.label}
                          className={`text-xs px-2 py-1 rounded-lg font-medium ${
                            m.billable
                              ? 'bg-gray-100 text-gray-700'
                              : 'bg-green-50 text-green-700'
                          }`}
                        >
                          {m.label}
                          <span className="font-bold"> x{m.qty}</span>
                          {!m.billable && <span className="italic font-normal"> · incluida</span>}
                        </span>
                      ))}
                    </div>

                    <button
                      type="button"
                      onClick={() => toggleWeekDetail(weekName)}
                      className="flex items-center gap-1 text-xs font-medium text-red-600 hover:text-red-700 transition-colors"
                    >
                      <ListChecks className="w-3.5 h-3.5" />
                      {isWeekOpen ? 'Ocultar platillos' : 'Ver platillos seleccionados'}
                      <ChevronDown
                        className={`w-3.5 h-3.5 transition-transform duration-200 ${isWeekOpen ? 'rotate-180' : ''}`}
                      />
                    </button>
                  </div>

                  {isWeekOpen && (
                    <div className="divide-y divide-gray-50 border-t border-gray-100">
                      {items.map(item => (
                        <div key={item.tempId} className="flex items-start justify-between gap-2 px-3 py-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center flex-wrap gap-1">
                              <span className="text-xs font-medium text-gray-900">
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
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Always-visible footer: first-order banner, notes, and cart button */}
      <div className="p-4 sm:p-5 space-y-4 border-t border-gray-100">
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
        <div>
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

      </div>
    </div>
  );
};

export default CustomerOrderSidePanel;
