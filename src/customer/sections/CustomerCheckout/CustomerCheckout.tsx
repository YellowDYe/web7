import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CircleCheck as CheckCircle,
  Circle as XCircle,
  Loader as Loader2,
  Trash2,
  ArrowLeft,
  CreditCard,
  Calendar,
  MapPin,
  User,
  Phone,
  Package,
  Chrome as Home,
  Zap,
} from 'lucide-react';
import { useCart } from '../../contexts/CartContext';
import { useCustomerAuth } from '../../contexts/CustomerAuthContext';
import {
  customerOrderSubmissionService,
  OrderConfirmationData,
} from '../../services/customerOrderSubmissionService';
import { BILLABLE_MEAL_TYPES } from '../../../types/orderMenu';
import { calculatePriceBreakdown } from '../../../utils/priceCalculations';
import { supabase } from '../../../config/supabase';

type CheckoutStep = 'review' | 'payment' | 'processing' | 'success';

declare global {
  interface Window {
    MercadoPago: any;
  }
}

export const CustomerCheckout: React.FC = () => {
  const [step, setStep] = useState<CheckoutStep>('review');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [confirmationData, setConfirmationData] =
    useState<OrderConfirmationData | null>(null);
  const [planDiscounts, setPlanDiscounts] = useState<
    { planId: string; planName: string; percentage: number; amount: number }[]
  >([]);
  const [loadingDiscounts, setLoadingDiscounts] = useState(false);
  const [mpPublicKey, setMpPublicKey] = useState<string | null>(null);
  const [preferenceId, setPreferenceId] = useState<string | null>(null);
  const [createdOrderId, setCreatedOrderId] = useState<string | null>(null);
  const [mpSdkLoaded, setMpSdkLoaded] = useState(false);
  const mpContainerRef = useRef<HTMLDivElement>(null);
  const mpInstanceRef = useRef<any>(null);
  const walletBrickRef = useRef<any>(null);
  const brickAmountRef = useRef<number>(0);

  const {
    cart,
    clearCart,
    hasItems,
    proteinCart,
    clearProteinCart,
    proteinSubtotal,
    hasProteinItems,
  } = useCart();
  const { customer } = useCustomerAuth();
  const navigate = useNavigate();

  const formatDate = (dateString: string) => {
    const [year, month, day] = dateString.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString('es-MX', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatCustomerAddress = () => {
    if (!customer) return '';
    const parts: string[] = [];
    if (customer.customer_street && customer.customer_street_number) {
      parts.push(
        `${customer.customer_street} ${customer.customer_street_number}`
      );
    }
    if (customer.customer_interior_number) {
      parts.push(`Int. ${customer.customer_interior_number}`);
    }
    if (customer.customer_colonia) parts.push(customer.customer_colonia);
    if (customer.customer_delegacion) parts.push(customer.customer_delegacion);
    if (customer.customer_postal_code)
      parts.push(`CP ${customer.customer_postal_code}`);
    return parts.join(', ');
  };

  const calculatePlanDiscounts = async () => {
    if (!cart) return;
    try {
      setLoadingDiscounts(true);
      const planCounts: Record<
        string,
        { count: number; price: number; name: string }
      > = {};

      cart.orderItems.forEach((item) => {
        if (BILLABLE_MEAL_TYPES.includes(item.meal_type as any)) {
          const planId = item.meal_plans_id;
          if (!planCounts[planId]) {
            planCounts[planId] = {
              count: 0,
              price: item.meal_plan_price,
              name: item.meal_plan_name || 'Plan',
            };
          }
          planCounts[planId].count += item.quantity;
        }
      });

      const discounts: {
        planId: string;
        planName: string;
        percentage: number;
        amount: number;
      }[] = [];

      for (const [planId, { count, name }] of Object.entries(planCounts)) {
        const { data } = await supabase
          .from('discounts')
          .select('*')
          .eq('meal_plans_id', planId)
          .lte('threshold', count)
          .eq('discount_active', true)
          .order('threshold', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (data) {
          const planTotal = cart.orderItems
            .filter(
              (item) =>
                item.meal_plans_id === planId &&
                BILLABLE_MEAL_TYPES.includes(item.meal_type as any)
            )
            .reduce(
              (sum, item) => sum + item.meal_plan_price * item.quantity,
              0
            );
          discounts.push({
            planId,
            planName: name,
            percentage: data.discount_percentage,
            amount: planTotal * (data.discount_percentage / 100),
          });
        }
      }

      setPlanDiscounts(discounts);
    } catch (err) {
      console.error('Error calculating plan discounts:', err);
      setPlanDiscounts([]);
    } finally {
      setLoadingDiscounts(false);
    }
  };

  useEffect(() => {
    if (cart && cart.orderItems.length > 0) {
      calculatePlanDiscounts();
    }
  }, [cart?.orderItems]);

  useEffect(() => {
    if (!hasItems && !hasProteinItems && step !== 'success') {
      navigate('/cart');
    }
  }, [hasItems, hasProteinItems, navigate, step]);

  useEffect(() => {
    if (!mpPublicKey) return;
    if (document.getElementById('mercadopago-sdk')) {
      setMpSdkLoaded(true);
      return;
    }
    const script = document.createElement('script');
    script.id = 'mercadopago-sdk';
    script.src = 'https://sdk.mercadopago.com/js/v2';
    script.async = true;
    script.onload = () => setMpSdkLoaded(true);
    document.head.appendChild(script);
  }, [mpPublicKey]);

  const saveProteinOrders = async (orderId: string) => {
    try {
      const rows = proteinCart.map((item) => ({
        order_id: orderId,
        customer_id: customer?.customer_id,
        protein_plan_id: item.proteinPlan.id,
        protein_plan_name: item.proteinPlan.protein_plans_name,
        quantity: item.quantity,
        unit_price: item.proteinPlan.protein_plans_price,
        total_price: item.proteinPlan.protein_plans_price * item.quantity,
        status: 'pending',
      }));
      await supabase.from('protein_orders').insert(rows);
    } catch (err) {
      console.warn('Could not save protein orders:', err);
    }
  };

  const createOrderAndPreference = async () => {
    if (!customer) {
      setSubmitError('Informacion del cliente incompleta');
      return;
    }
    if (!cart && !hasProteinItems) {
      setSubmitError('El carrito esta vacio');
      return;
    }

    try {
      setSubmitting(true);
      setSubmitError(null);

      let orderId = '';
      let orderNumber = '';
      let totalAmount = 0;

      if (cart && cart.orderItems.length > 0) {
        const result = await customerOrderSubmissionService.submitOrder({
          customer,
          planDuration: cart.planDuration,
          selectedWeeks: cart.selectedWeeks,
          orderItems: cart.orderItems,
          orderNotes: cart.orderNotes,
          selectedDeliveryOption: cart.selectedDeliveryOption!,
          appliedCoupon: cart.appliedCoupon,
          couponDiscountAmount: cart.couponDiscountAmount,
        });

        if (!result.success || !result.orderId || !result.orderNumber) {
          setSubmitError(result.message);
          return;
        }

        orderId = result.orderId;
        orderNumber = result.orderNumber;

        const totals = result.totals ?? {
          subtotal: 0,
          planDiscount: 0,
          deliveryPrice:
            cart.selectedDeliveryOption?.delivery_options_price ?? 0,
          couponDiscount: cart.couponDiscountAmount,
          taxAmount: 0,
          finalTotal: 0,
        };

        if (hasProteinItems) {
          totals.subtotal += proteinSubtotal;
          totals.finalTotal += proteinSubtotal * 1.16;
        }

        totalAmount = Math.round(totals.finalTotal);

        const confirmData: OrderConfirmationData = {
          orderId,
          orderNumber,
          customer,
          selectedWeeks: cart.selectedWeeks,
          totals,
          deliveryOptionName:
            cart.selectedDeliveryOption?.delivery_options_name ?? '',
          couponCode: cart.appliedCoupon?.code,
        };

        if (hasProteinItems) {
          await saveProteinOrders(orderId);
        }

        setConfirmationData(confirmData);
      } else if (hasProteinItems) {
        const taxAmount = proteinSubtotal * 0.16;
        const finalTotal = proteinSubtotal + taxAmount;
        totalAmount = Math.round(finalTotal);

        const { data: orderRow } = await supabase
          .from('orders')
          .insert({
            customer_id: customer.customer_id,
            order_customer_name:
              `${customer.customer_name} ${customer.customer_lastname}`.trim(),
            order_customer_email: customer.customer_email,
            order_status: 'pending',
            order_notes: 'Pedido de proteinas',
            order_total_price: totalAmount,
            order_invoice_number: '',
            stripe_payment_status: 'pending',
          })
          .select('id, order_id')
          .single();

        if (orderRow) {
          orderId = orderRow.id;
          orderNumber = orderRow.order_id;
          await saveProteinOrders(orderId);
        }

        setConfirmationData({
          orderId,
          orderNumber,
          customer,
          selectedWeeks: [],
          totals: {
            subtotal: proteinSubtotal,
            planDiscount: 0,
            deliveryPrice: 0,
            couponDiscount: 0,
            taxAmount,
            finalTotal,
          },
          deliveryOptionName: 'Por coordinar',
          couponCode: undefined,
        });
      }

      setCreatedOrderId(orderId);

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

      const response = await fetch(
        `${supabaseUrl}/functions/v1/mercado-pago-checkout`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${supabaseAnonKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            action: 'create-preference',
            items: [
              {
                title: `Pedido #${orderNumber}`,
                quantity: 1,
                unit_price: Math.round(totalAmount * 100) / 100,
              },
            ],
            payer: {
              name: customer.customer_name,
              surname: customer.customer_lastname,
              email: customer.customer_email,
              phone: customer.customer_phone,
            },
            external_reference: orderId,
            installments: 6,
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`Error al crear preferencia de pago (${response.status})`);
      }

      const prefData = await response.json();
      if (!prefData.success || !prefData.preference_id) {
        throw new Error(prefData.error || 'No se pudo crear la preferencia de pago');
      }

      setPreferenceId(prefData.preference_id);
      if (prefData.public_key) {
        setMpPublicKey(prefData.public_key);
      }
      setStep('payment');
    } catch (err: any) {
      console.error('Error creating order:', err);
      setSubmitError(
        err.message || 'Error al procesar el pedido. Por favor intenta de nuevo.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const cartTotals = useMemo(() => {
    if (!cart && !hasProteinItems) return null;

    const mealItemsTotal = cart
      ? cart.orderItems.reduce((total, item) => {
          if (BILLABLE_MEAL_TYPES.includes(item.meal_type as any)) {
            return total + item.meal_plan_price * item.quantity;
          }
          return total;
        }, 0)
      : 0;

    const totalPlanDiscount = planDiscounts.reduce(
      (sum, d) => sum + d.amount,
      0
    );
    const deliveryPrice =
      cart?.selectedDeliveryOption?.delivery_options_price || 0;
    const couponDiscountAmount = cart?.couponDiscountAmount || 0;
    const taxRate = 16;

    const result = calculatePriceBreakdown(
      mealItemsTotal + proteinSubtotal,
      totalPlanDiscount,
      deliveryPrice,
      couponDiscountAmount,
      0,
      taxRate
    );
    if (result) brickAmountRef.current = Math.round(result.finalTotal * 100) / 100;
    return result;
  }, [cart, hasProteinItems, planDiscounts, proteinSubtotal]);

  const renderPaymentBrick = useCallback(async () => {
    if (
      !mpPublicKey ||
      !mpSdkLoaded ||
      !preferenceId ||
      !mpContainerRef.current ||
      !brickAmountRef.current
    )
      return;

    if (walletBrickRef.current) {
      try {
        walletBrickRef.current.unmount();
      } catch (_) {}
      walletBrickRef.current = null;
    }

    mpContainerRef.current.innerHTML = '';

    try {
      const mp = new window.MercadoPago(mpPublicKey, { locale: 'es-MX' });
      mpInstanceRef.current = mp;

      const bricksBuilder = mp.bricks();
      const paymentBrick = await bricksBuilder.create('payment', 'mp-payment-container', {
        initialization: {
          amount: brickAmountRef.current,
          preferenceId: preferenceId!,
        },
        customization: {
          paymentMethods: {
            creditCard: 'all',
            debitCard: 'all',
            ticket: 'all',
            bankTransfer: 'all',
            mercadoPago: 'all',
          },
          visual: {
            style: {
              customVariables: {
                borderRadiusMedium: '12px',
                borderRadiusLarge: '16px',
              },
            },
          },
        },
        callbacks: {
          onReady: () => {},
          onSubmit: async ({ selectedPaymentMethod, formData }: any) => {
            setStep('processing');
            setSubmitError(null);
            try {
              const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
              const response = await fetch(
                `${supabaseUrl}/functions/v1/mercado-pago-checkout`,
                {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    action: 'process-payment',
                    payment_data: formData,
                    order_id: createdOrderId,
                  }),
                }
              );
              const result = await response.json();
              if (result.success && result.status === 'approved') {
                if (confirmationData) {
                  await customerOrderSubmissionService.markOrderAsPaid(confirmationData);
                }
                clearCart();
                clearProteinCart();
                setStep('success');
              } else if (result.status === 'in_process' || result.status === 'pending') {
                setSubmitError(
                  'Tu pago esta siendo procesado. Te notificaremos cuando se confirme.'
                );
                setStep('payment');
              } else {
                setSubmitError(
                  result.status_detail
                    ? `Pago rechazado: ${result.status_detail}`
                    : 'No se pudo procesar el pago. Intenta con otro metodo.'
                );
                setStep('payment');
              }
            } catch (err) {
              console.error('Payment processing error:', err);
              setSubmitError('Error al procesar el pago. Intenta de nuevo.');
              setStep('payment');
            }
          },
          onError: (error: any) => {
            console.error('Payment Brick error:', error);
            setSubmitError('Error en el formulario de pago. Intenta de nuevo.');
          },
        },
      });

      walletBrickRef.current = paymentBrick;
    } catch (err) {
      console.error('Error rendering payment brick:', err);
      setSubmitError('Error al cargar el formulario de pago. Intenta de nuevo.');
    }
  }, [mpPublicKey, mpSdkLoaded, preferenceId, createdOrderId, confirmationData, clearCart, clearProteinCart]);

  useEffect(() => {
    if (step === 'payment' && preferenceId && mpSdkLoaded && !walletBrickRef.current) {
      const timer = setTimeout(() => renderPaymentBrick(), 300);
      return () => clearTimeout(timer);
    }
  }, [step, preferenceId, mpSdkLoaded, renderPaymentBrick]);

  if (!hasItems && !hasProteinItems && step !== 'success') {
    return null;
  }

  // ─── Success Screen ─────────────────────────────────────────────────
  if (step === 'success' && confirmationData) {
    const {
      orderNumber,
      customer: c,
      selectedWeeks,
      totals,
      deliveryOptionName,
      couponCode,
    } = confirmationData;
    const address = (() => {
      const parts: string[] = [];
      if (c.customer_street && c.customer_street_number)
        parts.push(`${c.customer_street} ${c.customer_street_number}`);
      if (c.customer_interior_number)
        parts.push(`Int. ${c.customer_interior_number}`);
      if (c.customer_colonia) parts.push(c.customer_colonia);
      if (c.customer_delegacion) parts.push(c.customer_delegacion);
      if (c.customer_postal_code) parts.push(`CP ${c.customer_postal_code}`);
      return parts.join(', ');
    })();

    return (
      <div className="min-h-screen bg-gray-50 py-8 px-4">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-8">
            <div className="relative inline-flex items-center justify-center mb-6">
              <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center">
                <CheckCircle className="w-14 h-14 text-green-600" />
              </div>
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              !Pedido Confirmado!
            </h1>
            <p className="text-gray-500 text-base">
              Te hemos enviado una confirmacion a{' '}
              <span className="font-medium text-gray-700">
                {c.customer_email}
              </span>
            </p>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 mb-5 text-center">
            <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-1">
              Numero de Orden
            </p>
            <p className="text-4xl font-bold text-red-600 tracking-wide">
              #{orderNumber}
            </p>
          </div>

          {selectedWeeks.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 mb-5">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400 mb-4 flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Fechas de Entrega
              </h2>
              <div className="space-y-3">
                {selectedWeeks.map((week, index) => (
                  <div
                    key={week.tempId}
                    className="flex items-start justify-between py-3 border-b border-gray-100 last:border-0"
                  >
                    <div>
                      <p className="text-xs text-gray-400 mb-0.5">
                        Semana {index + 1}
                      </p>
                      <p className="font-semibold text-gray-800">
                        {week.week.week_name}
                      </p>
                    </div>
                    <div className="text-right">
                      {week.week.week_date ? (
                        <p className="text-sm font-bold text-green-700 bg-green-50 px-3 py-1.5 rounded-lg">
                          {formatDate(week.week.week_date)}
                        </p>
                      ) : (
                        <p className="text-sm text-gray-400 italic">
                          Por confirmar
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 mb-5">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400 mb-4 flex items-center gap-2">
              <MapPin className="w-4 h-4" />
              Direccion de Entrega
            </h2>
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <User className="w-4 h-4 text-gray-500" />
              </div>
              <div>
                <p className="font-semibold text-gray-900">
                  {c.customer_name} {c.customer_lastname}
                </p>
                <p className="text-sm text-gray-500 mt-0.5">
                  {address || 'Direccion registrada en tu cuenta'}
                </p>
                {c.customer_phone && (
                  <p className="text-sm text-gray-500 mt-1 flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5" />
                    {c.customer_phone}
                  </p>
                )}
                <p className="text-xs text-gray-400 mt-2 bg-gray-50 inline-block px-2 py-1 rounded">
                  Metodo: {deliveryOptionName}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 mb-6">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400 mb-4 flex items-center gap-2">
              <Package className="w-4 h-4" />
              Resumen del Pedido
            </h2>
            <div className="space-y-2.5 text-sm">
              <div className="flex justify-between text-gray-600">
                <span>Subtotal</span>
                <span className="font-medium text-gray-800">
                  ${Math.round(totals.subtotal).toFixed(0)} MXN
                </span>
              </div>
              {totals.planDiscount > 0 && (
                <div className="flex justify-between text-green-600">
                  <span>Descuento por volumen</span>
                  <span className="font-medium">
                    -${Math.round(totals.planDiscount).toFixed(0)} MXN
                  </span>
                </div>
              )}
              <div className="flex justify-between text-gray-600">
                <span>Envio ({deliveryOptionName})</span>
                <span className="font-medium text-gray-800">
                  ${Math.round(totals.deliveryPrice).toFixed(0)} MXN
                </span>
              </div>
              {totals.couponDiscount > 0 && couponCode && (
                <div className="flex justify-between text-green-600">
                  <span>Cupon {couponCode}</span>
                  <span className="font-medium">
                    -${Math.round(totals.couponDiscount).toFixed(0)} MXN
                  </span>
                </div>
              )}
              <div className="flex justify-between text-gray-600">
                <span>IVA (16%)</span>
                <span className="font-medium text-gray-800">
                  ${Math.round(totals.taxAmount).toFixed(0)} MXN
                </span>
              </div>
              <div className="pt-3 mt-1 border-t border-gray-200 flex justify-between">
                <span className="font-bold text-gray-900 text-base">Total</span>
                <span className="font-bold text-xl text-red-600">
                  ${Math.round(totals.finalTotal).toFixed(0)} MXN
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => navigate('/account?tab=orders')}
              className="flex-1 bg-red-600 hover:bg-red-700 text-white px-6 py-3.5 rounded-xl font-semibold text-sm transition-colors flex items-center justify-center gap-2"
            >
              <Package className="w-4 h-4" />
              Ver mis pedidos
            </button>
            <button
              onClick={() => navigate('/')}
              className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 px-6 py-3.5 rounded-xl font-semibold text-sm transition-colors flex items-center justify-center gap-2"
            >
              <Home className="w-4 h-4" />
              Volver al inicio
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── Processing Screen ──────────────────────────────────────────────
  if (step === 'processing') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="text-center">
          <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Procesando tu pago...
          </h2>
          <p className="text-gray-500">
            Por favor no cierres esta pagina
          </p>
        </div>
      </div>
    );
  }

  // ─── Payment Step ───────────────────────────────────────────────────
  if (step === 'payment') {
    return (
      <div className="min-h-screen bg-gray-50 py-8 px-4">
        <div className="max-w-2xl mx-auto">
          <button
            onClick={() => setStep('review')}
            className="flex items-center text-gray-600 hover:text-gray-900 mb-6 transition-colors"
          >
            <ArrowLeft className="h-5 w-5 mr-2" />
            Volver al resumen
          </button>

          <h1 className="text-3xl font-bold font-antonio text-gray-900 mb-2">
            Metodo de Pago
          </h1>
          <p className="text-gray-600 mb-8">
            Selecciona como deseas pagar tu pedido
          </p>

          {submitError && (
            <div className="mb-6 bg-red-50 border border-red-200 rounded-xl p-4 flex items-center space-x-3">
              <XCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
              <span className="text-red-800">{submitError}</span>
            </div>
          )}

          {/* MercadoPago Payment Brick Container */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
            {cartTotals && (
              <div className="flex justify-between items-center mb-6 pb-4 border-b border-gray-100">
                <span className="font-semibold text-gray-900">
                  Total a pagar
                </span>
                <span className="text-2xl font-bold text-red-600">
                  ${cartTotals.finalTotal.toFixed(0)} MXN
                </span>
              </div>
            )}

            <div id="mp-payment-container" ref={mpContainerRef} className="min-h-[200px]" />

            {!mpSdkLoaded && (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-5 h-5 text-gray-400 animate-spin mr-2" />
                <span className="text-sm text-gray-500">
                  Cargando opciones de pago...
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ─── Review Step (default) ──────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      {(hasItems || hasProteinItems) && step === 'review' && (
        <div className="max-w-6xl mx-auto">
          <div className="mb-8">
            <button
              onClick={() => navigate('/cart')}
              className="flex items-center text-gray-600 hover:text-gray-900 mb-4 transition-colors"
            >
              <ArrowLeft className="h-5 w-5 mr-2" />
              Volver al carrito
            </button>
            <h1 className="text-3xl font-bold font-antonio text-gray-900">
              Revisar Pedido
            </h1>
            <p className="text-gray-600 mt-2">
              Revisa y confirma tu pedido antes de finalizar
            </p>
          </div>

          {submitError && (
            <div className="mb-6 bg-red-50 border border-red-200 rounded-xl p-4 flex items-center space-x-3">
              <XCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
              <span className="text-red-800">{submitError}</span>
            </div>
          )}

          {/* Delivery Dates */}
          {cart &&
            cart.selectedWeeks &&
            cart.selectedWeeks.length > 0 && (
              <div className="mb-6 bg-gradient-to-r from-green-50 to-green-100 border-2 border-green-300 rounded-xl p-6">
                <div className="flex items-center mb-4">
                  <Calendar className="w-6 h-6 text-green-700 mr-3" />
                  <h3 className="text-2xl font-bold text-green-900">
                    Fechas de Entrega
                  </h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {cart.selectedWeeks.map((week, index) => (
                    <div
                      key={`delivery-${week.week.week_id}-${index}`}
                      className="bg-white rounded-lg p-4 shadow-sm border border-green-200"
                    >
                      <p className="text-sm text-gray-600 mb-1">
                        Semana {index + 1}
                      </p>
                      <p className="font-bold text-gray-900 mb-2">
                        {week.week.week_name}
                      </p>
                      {week.week.week_date && (
                        <p className="text-lg font-bold text-green-700">
                          {formatDate(week.week.week_date)}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              {customer && (
                <div className="bg-white rounded-xl p-6 border-2 border-gray-200 shadow-sm">
                  <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
                    <MapPin className="w-5 h-5 mr-2 text-green-600" />
                    Informacion de Entrega
                  </h3>
                  <div className="space-y-3">
                    <div className="flex items-start">
                      <User className="w-5 h-5 text-gray-500 mr-3 mt-0.5" />
                      <div>
                        <p className="text-sm text-gray-600">Nombre</p>
                        <p className="font-semibold text-gray-900">
                          {customer.customer_name} {customer.customer_lastname}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start">
                      <MapPin className="w-5 h-5 text-gray-500 mr-3 mt-0.5" />
                      <div>
                        <p className="text-sm text-gray-600">
                          Direccion de Entrega
                        </p>
                        <p className="font-semibold text-gray-900">
                          {formatCustomerAddress() ||
                            'Sin direccion registrada'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start">
                      <Phone className="w-5 h-5 text-gray-500 mr-3 mt-0.5" />
                      <div>
                        <p className="text-sm text-gray-600">Telefono</p>
                        <p className="font-semibold text-gray-900">
                          {customer.customer_phone}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Protein Plans Summary */}
              {hasProteinItems && (
                <div className="bg-gray-50 rounded-xl p-6">
                  <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <Zap className="w-4 h-4 text-red-500" />
                    Planes de Proteina
                  </h3>
                  <div className="space-y-2">
                    {proteinCart.map((item) => (
                      <div
                        key={item.proteinPlan.id}
                        className="flex justify-between text-sm"
                      >
                        <span className="text-gray-700">
                          {item.proteinPlan.protein_plans_name} (
                          {item.quantity}x)
                        </span>
                        <span className="font-medium text-gray-900">
                          $
                          {(
                            item.proteinPlan.protein_plans_price * item.quantity
                          ).toFixed(2)}
                        </span>
                      </div>
                    ))}
                    <div className="pt-2 border-t border-gray-200 flex justify-between text-sm font-semibold">
                      <span className="text-gray-700">
                        Subtotal proteinas
                      </span>
                      <span className="text-gray-900">
                        ${proteinSubtotal.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Meal Plan Details */}
              {cart && cart.orderItems.length > 0 && (
                <>
                  <div className="bg-gray-50 rounded-xl p-6">
                    <h3 className="font-bold text-gray-900 mb-4">
                      Detalles del Pedido
                    </h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Duracion:</span>
                        <span className="font-medium">
                          {cart.planDuration}{' '}
                          {cart.planDuration === 1 ? 'semana' : 'semanas'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Semanas:</span>
                        <span className="font-medium">
                          {cart.selectedWeeks
                            .map((w) => w.week.week_name)
                            .join(', ')}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">
                          Total de comidas:
                        </span>
                        <span className="font-medium">
                          {
                            cart.orderItems.filter((item) =>
                              BILLABLE_MEAL_TYPES.includes(
                                item.meal_type as any
                              )
                            ).length
                          }
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Envio:</span>
                        <span className="font-medium">
                          {
                            cart.selectedDeliveryOption
                              ?.delivery_options_name
                          }
                        </span>
                      </div>
                      {cart.appliedCoupon && (
                        <div className="flex justify-between text-green-600">
                          <span>Cupon aplicado:</span>
                          <span className="font-medium">
                            {cart.appliedCoupon.code}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="bg-gray-50 rounded-xl p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-bold text-gray-900">
                        Comidas Seleccionadas
                      </h3>
                      <span className="inline-flex items-center justify-center min-w-[2.5rem] px-3 py-1 rounded-full bg-red-600 text-white text-xl font-bold leading-none">
                        {cart.orderItems.reduce(
                          (sum, item) =>
                            sum +
                            (BILLABLE_MEAL_TYPES.includes(
                              item.meal_type as any
                            )
                              ? item.quantity
                              : 0),
                          0
                        )}
                      </span>
                    </div>
                    <div className="space-y-4">
                      {cart.selectedWeeks.map((week) => {
                        const weekItems = cart.orderItems.filter(
                          (item) =>
                            item.week_name === week.week.week_name
                        );
                        if (weekItems.length === 0) return null;
                        return (
                          <div
                            key={week.tempId}
                            className="border border-gray-200 rounded-lg p-4"
                          >
                            <h4 className="font-medium text-gray-900 mb-3">
                              {week.week.week_name}
                            </h4>
                            <div className="space-y-2">
                              {weekItems.map((item) => {
                                const isBillable =
                                  BILLABLE_MEAL_TYPES.includes(
                                    item.meal_type as any
                                  );
                                const itemPrice = isBillable
                                  ? item.meal_plan_price * item.quantity
                                  : 0;
                                return (
                                  <div
                                    key={item.tempId}
                                    className="flex justify-between text-sm"
                                  >
                                    <span className="flex flex-col text-gray-700">
                                      <span>
                                        {item.day_of_week} -{' '}
                                        {item.meal_type} ({item.quantity}
                                        x)
                                      </span>
                                      {item.meal_plan_name && (
                                        <span className="inline-block w-fit mt-1 px-2 py-0.5 rounded-full bg-gray-200 text-gray-700 text-xs font-medium">
                                          {item.meal_plan_name}
                                        </span>
                                      )}
                                    </span>
                                    <span className="font-medium text-gray-900">
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
                  </div>

                  {cart.orderNotes && (
                    <div className="bg-gray-50 rounded-xl p-6">
                      <h3 className="font-bold text-gray-900 mb-2">
                        Notas del Pedido
                      </h3>
                      <p className="text-sm text-gray-700">
                        {cart.orderNotes}
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Sidebar Summary */}
            <div className="lg:col-span-1">
              <div className="bg-gray-50 rounded-xl p-6 sticky top-6">
                <h3 className="font-bold text-gray-900 mb-4">Resumen</h3>

                {cartTotals && (
                  <div className="space-y-3 text-sm mb-6">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Subtotal:</span>
                      <span className="font-medium">
                        ${Math.round(cartTotals.itemsSubtotal).toFixed(0)}
                      </span>
                    </div>

                    {planDiscounts.length > 0 && (
                      <div className="border-t border-gray-200 pt-2">
                        {planDiscounts.map((discount, index) => (
                          <div
                            key={index}
                            className="flex justify-between text-green-600"
                          >
                            <span>
                              Descuento {discount.planName} (
                              {discount.percentage}%):
                            </span>
                            <span>
                              -${Math.round(discount.amount).toFixed(0)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="flex justify-between">
                      <span className="text-gray-600">Envio:</span>
                      <span className="font-medium">
                        ${Math.round(cartTotals.deliveryPrice).toFixed(0)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">IVA (16%):</span>
                      <span className="font-medium">
                        ${Math.round(cartTotals.taxAmount).toFixed(0)}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>IVA Envio:</span>
                      <span>
                        $
                        {Math.round(cartTotals.deliveryTaxAmount).toFixed(
                          0
                        )}
                      </span>
                    </div>

                    {cart?.appliedCoupon &&
                      (cart?.couponDiscountAmount ?? 0) > 0 && (
                        <div className="flex justify-between text-green-600 border-t border-gray-200 pt-2">
                          <span>Cupon {cart.appliedCoupon.code}:</span>
                          <span>
                            -$
                            {Math.round(
                              cart.couponDiscountAmount
                            ).toFixed(0)}
                          </span>
                        </div>
                      )}

                    <div className="pt-3 border-t border-gray-300 flex justify-between">
                      <span className="font-bold text-gray-900">
                        Total:
                      </span>
                      <span className="font-bold text-xl text-red-600">
                        ${cartTotals.finalTotal.toFixed(0)}
                      </span>
                    </div>
                  </div>
                )}

                {/* Payment Method Badges */}
                <div className="mb-4 pb-4 border-b border-gray-200">
                  <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">
                    Metodos de pago aceptados
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <span className="text-xs bg-blue-50 text-blue-700 px-2.5 py-1 rounded-full font-medium">
                      Tarjeta
                    </span>
                    <span className="text-xs bg-orange-50 text-orange-700 px-2.5 py-1 rounded-full font-medium">
                      OXXO
                    </span>
                    <span className="text-xs bg-green-50 text-green-700 px-2.5 py-1 rounded-full font-medium">
                      Vales
                    </span>
                    <span className="text-xs bg-teal-50 text-teal-700 px-2.5 py-1 rounded-full font-medium">
                      MSI
                    </span>
                  </div>
                </div>

                <div className="space-y-3">
                  <button
                    onClick={createOrderAndPreference}
                    disabled={submitting || loadingDiscounts}
                    className="w-full bg-green-500 hover:bg-green-600 text-white px-6 py-3 rounded-xl font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                        Procesando...
                      </>
                    ) : (
                      <>
                        <CreditCard className="w-5 h-5 mr-2" />
                        Continuar al Pago
                      </>
                    )}
                  </button>

                  <button
                    onClick={() => {
                      clearCart();
                      clearProteinCart();
                    }}
                    disabled={submitting}
                    className="w-full bg-red-50 hover:bg-red-100 text-red-600 px-6 py-3 rounded-xl font-medium transition-colors flex items-center justify-center"
                  >
                    <Trash2 className="w-5 h-5 mr-2" />
                    Cancelar Pedido
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

