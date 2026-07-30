import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShoppingCart, Trash2, Plus, ArrowLeft, Package, Tag, Truck, Users, Zap } from 'lucide-react';
import { useCart } from '../../contexts/CartContext';
import { useCustomerAuth } from '../../contexts/CustomerAuthContext';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { calculatePriceBreakdown } from '../../../utils/priceCalculations';
import { BILLABLE_MEAL_TYPES } from '../../../types/orderMenu';
import { couponService } from '../../../services/couponService';
import CustomerCouponInput from '../../components/orders/CustomerCouponInput';

export const CustomerCart: React.FC = () => {
  const navigate = useNavigate();
  const { cart, clearCart, updateCart, proteinCart, removeProteinFromCart, proteinSubtotal, hasItems } = useCart();
  const { customer } = useCustomerAuth();
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [validatingCoupon, setValidatingCoupon] = useState(false);
  const [couponError, setCouponError] = useState<string | null>(null);

  // Format date without timezone issues
  const formatDate = (dateString: string) => {
    const [year, month, day] = dateString.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString('es-MX', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  // Format customer address from individual fields
  const formatCustomerAddress = () => {
    if (!customer) return '';

    const parts = [];

    // Street and number
    if (customer.customer_street && customer.customer_street_number) {
      parts.push(`${customer.customer_street} ${customer.customer_street_number}`);
    }

    // Interior number (optional)
    if (customer.customer_interior_number) {
      parts.push(`Int. ${customer.customer_interior_number}`);
    }

    // Colonia
    if (customer.customer_colonia) {
      parts.push(customer.customer_colonia);
    }

    // Delegacion/Municipality
    if (customer.customer_delegacion) {
      parts.push(customer.customer_delegacion);
    }

    // Postal code
    if (customer.customer_postal_code) {
      parts.push(`CP ${customer.customer_postal_code}`);
    }

    return parts.join(', ');
  };

  const handleClearCart = () => {
    clearCart();
    setShowClearConfirm(false);
  };

  const handleRemoveProtein = (planId: string) => {
    removeProteinFromCart(planId);
  };

  const handleApplyCoupon = async (code: string) => {
    if (!cart || !cart.orderItems || cart.orderItems.length === 0) {
      setCouponError('No hay artículos en el carrito');
      return;
    }
    try {
      setValidatingCoupon(true);
      setCouponError(null);

      const itemsTotal = cart.orderItems.reduce((total, item) => {
        if (BILLABLE_MEAL_TYPES.includes(item.meal_type as any)) {
          return total + (item.meal_plan_price * item.quantity);
        }
        return total;
      }, 0);

      const deliveryPrice = cart.selectedDeliveryOption?.delivery_options_price || 0;
      const priceBreakdown = calculatePriceBreakdown(itemsTotal, 0, deliveryPrice, 0, 0, 16);
      const orderTotal = priceBreakdown.totalBeforeCustomDiscount;

      const result = await couponService.validateCoupon(code, customer?.id || null, orderTotal);

      if (result.valid && result.coupon && result.discount_amount !== undefined) {
        updateCart({ appliedCoupon: result.coupon, couponDiscountAmount: result.discount_amount });
        setCouponError(null);
      } else {
        setCouponError(result.message || 'Cupón no válido');
      }
    } catch (err: any) {
      setCouponError(err.message || 'Error al validar el cupón');
    } finally {
      setValidatingCoupon(false);
    }
  };

  const handleRemoveCoupon = () => {
    if (cart) {
      updateCart({
        appliedCoupon: null,
        couponDiscountAmount: 0
      });
      setCouponError(null);
    }
  };

  const handleContinueShopping = () => {
    navigate('/order');
  };

  const handleProceedToCheckout = () => {
    navigate('/checkout');
  };

  const hasMealItems = cart && cart.orderItems && cart.orderItems.length > 0;
  const hasProteinCartItems = proteinCart && proteinCart.length > 0;

  // Calculate pricing
  const priceBreakdown = cart && cart.selectedDeliveryOption && cart.orderItems
    ? (() => {
        const itemsTotal = cart.orderItems.reduce((total, item) => {
          if (BILLABLE_MEAL_TYPES.includes(item.meal_type as any)) {
            return total + (item.meal_plan_price * item.quantity);
          }
          return total;
        }, 0);

        const deliveryPrice = cart.selectedDeliveryOption.delivery_options_price || 0;
        const taxRate = 16;

        return calculatePriceBreakdown(
          itemsTotal + proteinSubtotal,
          0,
          deliveryPrice,
          cart.couponDiscountAmount || 0,
          0,
          taxRate
        );
      })()
    : hasProteinCartItems
      ? (() => {
          const taxRate = 16;
          return calculatePriceBreakdown(proteinSubtotal, 0, 0, 0, 0, taxRate);
        })()
      : null;

  if (!hasMealItems && !hasProteinCartItems) {
    return (
      <div className="min-h-screen bg-gray-50 py-12 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-lg shadow-sm p-12 text-center">
            <div className="flex justify-center mb-6">
              <ShoppingCart className="h-24 w-24 text-gray-300" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Tu carrito está vacío</h2>
            <p className="text-gray-600 mb-8">
              Agrega planes de comida o proteínas a tu carrito para continuar
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button
                onClick={handleContinueShopping}
                className="bg-green-600 hover:bg-green-700 text-white px-8 py-3 rounded-full text-lg"
              >
                <Plus className="h-5 w-5 mr-2" />
                Explorar Planes
              </Button>
              <Button
                onClick={() => navigate('/proteinas')}
                className="bg-red-500 hover:bg-red-600 text-white px-8 py-3 rounded-full text-lg"
              >
                <Zap className="h-5 w-5 mr-2" />
                Ver Proteínas
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={handleContinueShopping}
            className="flex items-center text-gray-600 hover:text-gray-900 mb-4 transition-colors"
          >
            <ArrowLeft className="h-5 w-5 mr-2" />
            Continuar comprando
          </button>
          <h1 className="text-3xl font-bold font-antonio text-gray-900">Tu Carrito</h1>
          <p className="text-gray-600 mt-2">Revisa tu pedido antes de proceder al pago</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Cart Items */}
          <div className="lg:col-span-2 space-y-6">

            {/* Protein Plans Card */}
            {hasProteinCartItems && (
              <Card className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-xl font-bold text-gray-900 mb-1">Planes de Proteína</h3>
                    <p className="text-sm text-gray-500">Productos seleccionados</p>
                  </div>
                  <Zap className="h-6 w-6 text-red-500" />
                </div>
                <div className="space-y-3">
                  {proteinCart.map(item => (
                    <div key={item.proteinPlan.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-900 truncate">{item.proteinPlan.protein_plans_name}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{item.proteinPlan.protein_plans_id} · ${item.proteinPlan.protein_plans_price.toFixed(2)} MXN / unidad</p>
                      </div>
                      <div className="flex items-center gap-3 ml-3 shrink-0">
                        <span className="text-sm font-bold text-gray-700">x{item.quantity}</span>
                        <span className="text-sm font-bold text-gray-900">${(item.proteinPlan.protein_plans_price * item.quantity).toFixed(2)}</span>
                        <button
                          onClick={() => handleRemoveProtein(item.proteinPlan.id)}
                          className="text-red-400 hover:text-red-600 p-1 transition-colors"
                          title="Eliminar"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-4 pt-3 border-t border-gray-100 flex justify-between items-center">
                  <span className="text-sm text-gray-600">Subtotal proteínas</span>
                  <span className="font-bold text-gray-900">${proteinSubtotal.toFixed(2)} MXN</span>
                </div>
              </Card>
            )}

            {/* Meal Plan Cards */}
            {hasMealItems && cart && (
              <>
                {/* Plan Details Card */}
                <Card className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-xl font-bold text-gray-900 mb-2">Semanas</h3>
                      <p className="text-gray-600">
                        Duración: <span className="font-medium">{cart.planDuration} {cart.planDuration === 1 ? 'semana' : 'semanas'}</span>
                      </p>
                    </div>
                    <Package className="h-6 w-6 text-green-600" />
                  </div>

                  {/* Selected Weeks */}
                  <div className="border-t pt-4 mt-4">
                    <h4 className="font-bold text-gray-900 mb-3">Semanas Seleccionadas</h4>
                    <div className="space-y-2">
                      {cart.selectedWeeks && cart.selectedWeeks.map((week, index) => (
                        <div key={`week-${week.week.week_id}-${index}`} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <div className="flex-1">
                            <p className="font-medium text-gray-900">{week.week.week_name}</p>
                            {week.week.week_date && (
                              <p className="text-sm text-gray-600">
                                Entrega: {formatDate(week.week.week_date)}
                              </p>
                            )}
                            {week.family_member_name && (
                              <div className="mt-1 inline-flex items-center px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                                <Users className="w-3 h-3 mr-1" />
                                Para: {week.family_member_name}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </Card>

                {/* Detailed Meals List */}
                <Card className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="font-bold text-gray-900">Comidas Seleccionadas</h4>
                    <span className="font-bold text-gray-900">
                      ${cart.orderItems.reduce((sum, item) => sum + (BILLABLE_MEAL_TYPES.includes(item.meal_type as any) ? item.meal_plan_price * item.quantity : 0), 0).toFixed(2)}
                    </span>
                  </div>
                  <div className="space-y-4">
                    {cart.selectedWeeks.map(week => {
                      const weekItems = cart.orderItems.filter(item => item.week_name === week.week.week_name);
                      if (weekItems.length === 0) return null;

                      return (
                        <div key={week.tempId} className="border border-gray-200 rounded-lg p-4">
                          <div className="flex items-center justify-between mb-3">
                            <h5 className="font-medium text-gray-900">{week.week.week_name}</h5>
                            {week.family_member_name && (
                              <span className="inline-flex items-center px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                                <Users className="w-3 h-3 mr-1" />
                                {week.family_member_name}
                              </span>
                            )}
                          </div>
                          <div className="space-y-2">
                            {weekItems.map(item => {
                              const isBillable = BILLABLE_MEAL_TYPES.includes(item.meal_type as any);
                              const itemPrice = isBillable ? item.meal_plan_price * item.quantity : 0;

                              return (
                                <div key={item.tempId} className="flex justify-between text-sm gap-2">
                                  <div className="flex-1 min-w-0">
                                    <span className="block text-gray-700">
                                      {item.day_of_week} - {item.meal_type} ({item.quantity}x)
                                    </span>
                                    {item.meal_plan_name && (
                                      <span className="inline-block mt-1 px-2 py-0.5 rounded-full bg-gray-200 text-gray-700 text-xs font-medium">
                                        {item.meal_plan_name}
                                      </span>
                                    )}
                                    {item.recipe_name && (
                                      <p className="text-xs text-gray-500 italic truncate">
                                        {item.recipe_name}
                                      </p>
                                    )}
                                  </div>
                                  <span className="font-medium text-gray-900 shrink-0">
                                    ${itemPrice.toFixed(2)}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </Card>

                {/* Delivery Option */}
                {cart.selectedDeliveryOption && (
                  <Card className="p-6">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center mb-2">
                          <Truck className="h-5 w-5 text-green-600 mr-2" />
                          <h3 className="text-lg font-bold text-gray-900">Opción de Entrega</h3>
                        </div>
                        <p className="text-gray-900 font-medium">{cart.selectedDeliveryOption.delivery_options_name}</p>
                        <p className="text-gray-600 text-sm mt-1">{cart.selectedDeliveryOption.delivery_options_description}</p>
                        <p className="text-gray-900 font-semibold mt-2">
                          ${(cart.selectedDeliveryOption.delivery_options_price || 0).toFixed(2)} MXN
                        </p>
                      </div>
                    </div>
                  </Card>
                )}

                {/* Coupon Input */}
                <Card className="p-6">
                  <div className="flex items-center mb-4">
                    <Tag className="h-5 w-5 text-gray-500 mr-2" />
                    <h3 className="text-lg font-bold text-gray-900">Cupón de Descuento</h3>
                  </div>
                  <CustomerCouponInput
                    onApplyCoupon={handleApplyCoupon}
                    onRemoveCoupon={handleRemoveCoupon}
                    appliedCoupon={cart.appliedCoupon || null}
                    couponDiscountAmount={cart.couponDiscountAmount || 0}
                    validating={validatingCoupon}
                    error={couponError}
                  />
                </Card>

                {/* Order Notes */}
                {cart.orderNotes && (
                  <Card className="p-6">
                    <h3 className="text-lg font-bold text-gray-900 mb-2">Notas del Pedido</h3>
                    <p className="text-gray-700 whitespace-pre-wrap">{cart.orderNotes}</p>
                  </Card>
                )}
              </>
            )}
          </div>

          {/* Order Summary Sidebar */}
          <div className="lg:col-span-1">
            <div className="sticky top-8">
              <Card className="p-6">
                <h3 className="text-xl font-bold text-gray-900 mb-6">Resumen del Pedido</h3>

                {priceBreakdown && (
                  <div className="space-y-3">
                    {/* Subtotal (items before tax, after plan discounts) */}
                    <div className="flex justify-between text-gray-700">
                      <span>Subtotal</span>
                      <span className="font-medium">${(priceBreakdown.subtotalAfterPlanDiscounts || 0).toFixed(2)}</span>
                    </div>

                    {/* Plan Discount */}
                    {(priceBreakdown.planDiscountsTotal || 0) > 0 && (
                      <div className="flex justify-between text-green-600 text-sm">
                        <span>Descuento de Plan</span>
                        <span className="font-medium">-${(priceBreakdown.planDiscountsTotal || 0).toFixed(2)}</span>
                      </div>
                    )}

                    {/* IVA on items */}
                    <div className="flex justify-between text-gray-700">
                      <span>IVA (16%)</span>
                      <span className="font-medium">${(priceBreakdown.taxAmount || 0).toFixed(2)}</span>
                    </div>

                    {/* Coupon Discount */}
                    {(priceBreakdown.couponDiscountAmount || 0) > 0 && (
                      <div className="flex justify-between text-green-600">
                        <span>Descuento Cupón</span>
                        <span className="font-medium">-${(priceBreakdown.couponDiscountAmount || 0).toFixed(2)}</span>
                      </div>
                    )}

                    <div className="border-t pt-3 mt-1" />

                    {/* Delivery Fee */}
                    <div className="flex justify-between text-gray-700">
                      <span>Envío</span>
                      <span className="font-medium">${(priceBreakdown.deliveryPrice || 0).toFixed(2)}</span>
                    </div>

                    {/* Delivery Tax */}
                    <div className="flex justify-between text-gray-700">
                      <span>IVA del Envío (16%)</span>
                      <span className="font-medium">${(priceBreakdown.deliveryTaxAmount || 0).toFixed(2)}</span>
                    </div>

                    <div className="border-t pt-4 mt-1">
                      <div className="flex justify-between text-xl font-bold text-gray-900">
                        <span>Total</span>
                        <span>${(priceBreakdown.finalTotal || 0).toFixed(2)}</span>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="space-y-3 pt-4">
                      <Button
                        onClick={handleProceedToCheckout}
                        className="w-full bg-green-600 hover:bg-green-700 text-white py-6 text-lg rounded-full"
                      >
                        Proceder al Pago
                      </Button>

                      <Button
                        onClick={handleContinueShopping}
                        variant="outline"
                        className="w-full py-6 text-lg rounded-full"
                      >
                        Continuar Comprando
                      </Button>

                      <button
                        onClick={() => setShowClearConfirm(true)}
                        className="w-full text-red-600 hover:text-red-700 py-3 text-sm font-medium transition-colors"
                      >
                        Vaciar Carrito
                      </button>
                    </div>
                  </div>
                )}
              </Card>
            </div>
          </div>
        </div>

        {/* Clear Cart Confirmation Modal */}
        {showClearConfirm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <Card className="max-w-md w-full p-6">
              <h3 className="text-xl font-bold text-gray-900 mb-4">¿Vaciar carrito?</h3>
              <p className="text-gray-600 mb-6">
                Esta acción eliminará todos los artículos de tu carrito. ¿Estás seguro?
              </p>
              <div className="flex gap-3">
                <Button
                  onClick={handleClearCart}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                >
                  Sí, vaciar carrito
                </Button>
                <Button
                  onClick={() => setShowClearConfirm(false)}
                  variant="outline"
                  className="flex-1"
                >
                  Cancelar
                </Button>
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
};
