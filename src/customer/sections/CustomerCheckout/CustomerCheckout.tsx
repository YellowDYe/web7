import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { CircleCheck as CheckCircle, Circle as XCircle, Loader as Loader2, Trash2, ArrowLeft, CreditCard, Calendar, MapPin, User, Phone, Zap, ShieldCheck, Mail, CircleAlert as AlertCircle, Wallet, ExternalLink, Store } from 'lucide-react';
import { useCart } from '../../contexts/CartContext';
import { useCustomerAuth } from '../../contexts/CustomerAuthContext';
import {
  customerOrderSubmissionService,
  OrderConfirmationData,
} from '../../services/customerOrderSubmissionService';
import { BILLABLE_MEAL_TYPES } from '../../../types/orderMenu';
import { calculatePriceBreakdown } from '../../../utils/priceCalculations';
import { supabase } from '../../../config/supabase';
import { friendlyError } from '../../utils/friendlyError';


declare global {
  interface Window {
    MercadoPago: any;
  }
}

function loadMercadoPagoSdk(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.MercadoPago) {
      resolve();
      return;
    }
    const existing = document.querySelector('script[src*="sdk.mercadopago.com"]');
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('Error cargando SDK de Mercado Pago')));
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://sdk.mercadopago.com/js/v2';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Error cargando SDK de Mercado Pago'));
    document.head.appendChild(script);
  });
}

type CheckoutStep = 'review' | 'payment' | 'success' | 'error';

interface ConfirmationDetails {
  orderNumber: string;
  deliveryWeeks: Array<{ weekName: string; deliveryDate: string | null }>;
  deliveryAddress: string;
  deliveryOptionName: string;
  totals: {
    subtotal: number;
    planDiscount: number;
    deliveryPrice: number;
    couponDiscount: number;
    taxAmount: number;
    finalTotal: number;
  };
  couponCode?: string;
  emailSent: boolean;
  emailError?: string;
}

export const CustomerCheckout: React.FC = () => {
  const [step, setStep] = useState<CheckoutStep>('review');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [planDiscounts, setPlanDiscounts] = useState<
    { planId: string; planName: string; percentage: number; amount: number }[]
  >([]);
  const [loadingDiscounts, setLoadingDiscounts] = useState(false);
  const [brickLoading, setBrickLoading] = useState(false);
  const [paymentResult, setPaymentResult] = useState<any>(null);
  const [createdOrderNumber, setCreatedOrderNumber] = useState<string | null>(null);
  const [paymentTotalAmount, setPaymentTotalAmount] = useState(0);
  const [confirmationDetails, setConfirmationDetails] = useState<ConfirmationDetails | null>(null);
  const [mpTestMode, setMpTestMode] = useState(false);
  const [mpPaymentMethods, setMpPaymentMethods] = useState<any>(null);
  const [mpCheckoutProEnabled, setMpCheckoutProEnabled] = useState(false);
  const [mpInitPoint, setMpInitPoint] = useState<string | null>(null);

  const paymentQuoteIdRef = useRef<string | null>(null);
  const brickControllerRef = useRef<any>(null);
  const brickContainerRef = useRef<HTMLDivElement>(null);
  const brickInitializedRef = useRef(false);

  const {
    cart, clearCart, hasItems,
    proteinCart, clearProteinCart, proteinSubtotal, hasProteinItems,
  } = useCart();
  const { customer } = useCustomerAuth();
  const navigate = useNavigate();

  // Snapshot cart data at the moment user clicks "Proceed to Payment"
  // so it stays available inside the brick callback even after React state changes
  useEffect(() => {
    const fetchCheckoutConfig = async () => {
      try {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        if (!token) return;
        const res = await fetch(`${supabaseUrl}/functions/v1/mercado-pago-checkout`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ action: 'get-checkout-config' }),
        });
        if (!res.ok) return;
        const cfg = await res.json();
        if (cfg?.success) {
          setMpTestMode(cfg.test_mode ?? false);
          setMpPaymentMethods({
            creditCard: cfg.enable_credit_card ? 'all' : [],
            debitCard: cfg.enable_debit_card ? 'all' : [],
            ticket: cfg.enable_ticket ? 'all' : [],
            bankTransfer: cfg.enable_bank_transfer ? 'all' : [],
            mercadoPago: cfg.enable_mercado_pago_wallet ? 'all' : [],
          });
          setMpCheckoutProEnabled(cfg.enable_checkout_pro ?? false);
        }
      } catch (_) {}
    };
    fetchCheckoutConfig();
  }, []);

  const cartSnapshotRef = useRef<typeof cart>(null);
  const proteinCartSnapshotRef = useRef<typeof proteinCart>([]);
  const proteinSubtotalSnapshotRef = useRef(0);
  const planDiscountsSnapshotRef = useRef<typeof planDiscounts>([]);

  const formatDate = (dateString: string) => {
    const [year, month, day] = dateString.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString('es-MX', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    });
  };

  const formatCustomerAddress = () => {
    if (!customer) return '';
    const parts: string[] = [];
    if (customer.customer_street && customer.customer_street_number)
      parts.push(`${customer.customer_street} ${customer.customer_street_number}`);
    if (customer.customer_interior_number) parts.push(`Int. ${customer.customer_interior_number}`);
    if (customer.customer_colonia) parts.push(customer.customer_colonia);
    if (customer.customer_delegacion) parts.push(customer.customer_delegacion);
    if (customer.customer_postal_code) parts.push(`CP ${customer.customer_postal_code}`);
    return parts.join(', ');
  };

  const calculatePlanDiscountsAsync = async () => {
    if (!cart) return;
    try {
      setLoadingDiscounts(true);
      const planCounts: Record<string, { count: number; price: number; name: string }> = {};
      cart.orderItems.forEach((item) => {
        if (BILLABLE_MEAL_TYPES.includes(item.meal_type as any)) {
          const planId = item.meal_plans_id;
          if (!planCounts[planId]) {
            planCounts[planId] = { count: 0, price: item.meal_plan_price, name: item.meal_plan_name || 'Plan' };
          }
          planCounts[planId].count += item.quantity;
        }
      });

      const discounts: { planId: string; planName: string; percentage: number; amount: number }[] = [];
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
            .filter((i) => i.meal_plans_id === planId && BILLABLE_MEAL_TYPES.includes(i.meal_type as any))
            .reduce((sum, i) => sum + i.meal_plan_price * i.quantity, 0);
          discounts.push({
            planId, planName: name, percentage: data.discount_percentage,
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
    if (cart && cart.orderItems.length > 0) calculatePlanDiscountsAsync();
  }, [cart?.orderItems]);

  useEffect(() => {
    if (!hasItems && !hasProteinItems && step === 'review') navigate('/cart');
  }, [hasItems, hasProteinItems, navigate, step]);

  const saveProteinOrders = async (orderId: string, proteinItems: typeof proteinCart) => {
    try {
      const rows = proteinItems.map((item) => ({
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

  const createOrderAfterPayment = useCallback(async (mpPaymentId: string, mpStatus: string, mpPaymentTypeId?: string): Promise<{ orderId: string; orderNumber: string } | null> => {
    const isCashPayment = mpPaymentTypeId === 'ticket' || mpPaymentTypeId === 'atm';
    const orderStatus = mpStatus === 'approved' ? 'completed' : isCashPayment ? 'pending_cash_payment' : 'pending';
    const paymentStatus = mpStatus === 'approved' ? 'succeeded' : 'pending';
    if (!customer) return null;

    const snappedCart = cartSnapshotRef.current;
    const snappedProteinCart = proteinCartSnapshotRef.current;
    const snappedProteinSubtotal = proteinSubtotalSnapshotRef.current;
    const hasSnappedProtein = snappedProteinCart.length > 0;

    try {
      let orderId = '';
      let orderNumber = '';
      let emailSent = false;
      let emailError: string | undefined;

      if (snappedCart && snappedCart.orderItems.length > 0) {
        const result = await customerOrderSubmissionService.submitOrder({
          customer,
          planDuration: snappedCart.planDuration,
          selectedWeeks: snappedCart.selectedWeeks,
          orderItems: snappedCart.orderItems,
          orderNotes: snappedCart.orderNotes,
          selectedDeliveryOption: snappedCart.selectedDeliveryOption!,
          appliedCoupon: snappedCart.appliedCoupon,
          couponDiscountAmount: snappedCart.couponDiscountAmount,
        });

        if (!result.success || !result.orderId || !result.orderNumber) {
          console.error('Order creation failed after payment:', result.message);
          return null;
        }

        orderId = result.orderId;
        orderNumber = result.orderNumber;

        if (hasSnappedProtein) await saveProteinOrders(orderId, snappedProteinCart);

        const totals = result.totals!;
        if (hasSnappedProtein) {
          totals.subtotal += snappedProteinSubtotal;
          totals.finalTotal += snappedProteinSubtotal * 1.16;
        }

        const confirmData: OrderConfirmationData = {
          orderId, orderNumber, customer,
          selectedWeeks: snappedCart.selectedWeeks, totals,
          deliveryOptionName: snappedCart.selectedDeliveryOption?.delivery_options_name ?? '',
          couponCode: snappedCart.appliedCoupon?.code,
        };

        // Update order with payment info
        await supabase
          .from('orders')
          .update({
            payment_provider: 'mercadopago',
            mp_payment_id: mpPaymentId || null,
            order_status: orderStatus,
            stripe_payment_status: paymentStatus,
            ...(mpStatus === 'approved' ? { stripe_paid_at: new Date().toISOString() } : {}),
          })
          .eq('id', orderId);

        if (mpStatus === 'approved') {
          try {
            await customerOrderSubmissionService.markOrderAsPaid(confirmData);
            emailSent = true;
          } catch (err: any) {
            emailError = 'No pudimos enviar el correo de confirmacion.';
          }
        }

        const formatAddress = (): string => {
          const parts: string[] = [];
          if (customer.customer_street && customer.customer_street_number)
            parts.push(`${customer.customer_street} ${customer.customer_street_number}`);
          if (customer.customer_interior_number) parts.push(`Int. ${customer.customer_interior_number}`);
          if (customer.customer_colonia) parts.push(customer.customer_colonia);
          if (customer.customer_delegacion) parts.push(customer.customer_delegacion);
          if (customer.customer_postal_code) parts.push(`CP ${customer.customer_postal_code}`);
          return parts.join(', ');
        };

        setConfirmationDetails({
          orderNumber,
          deliveryWeeks: snappedCart.selectedWeeks.map(sw => ({
            weekName: sw.week.week_name,
            deliveryDate: sw.week.week_date
          })),
          deliveryAddress: formatAddress(),
          deliveryOptionName: snappedCart.selectedDeliveryOption?.delivery_options_name ?? '',
          totals,
          couponCode: snappedCart.appliedCoupon?.code,
          emailSent,
          emailError,
        });
      } else if (hasSnappedProtein) {
        const taxAmount = snappedProteinSubtotal * 0.16;
        const finalTotal = snappedProteinSubtotal + taxAmount;
        const totalAmount = Math.round(finalTotal * 100) / 100;

        const { data: orderRow } = await supabase
          .from('orders')
          .insert({
            customer_id: customer.customer_id,
            order_customer_name: `${customer.customer_name} ${customer.customer_lastname}`.trim(),
            order_customer_email: customer.customer_email,
            order_status: orderStatus,
            order_notes: 'Pedido de proteinas',
            order_total_price: totalAmount,
            order_invoice_number: '',
            stripe_payment_status: paymentStatus,
            stripe_paid_at: mpStatus === 'approved' ? new Date().toISOString() : null,
            payment_provider: 'mercadopago',
            mp_payment_id: mpPaymentId || null,
          })
          .select('id, order_id')
          .single();

        if (orderRow) {
          orderId = orderRow.id;
          orderNumber = orderRow.order_id;
          await saveProteinOrders(orderId, snappedProteinCart);

          if (mpStatus === 'approved') {
            try {
              const formatAddress = (): string => {
                const parts: string[] = [];
                if (customer.customer_street && customer.customer_street_number)
                  parts.push(`${customer.customer_street} ${customer.customer_street_number}`);
                if (customer.customer_interior_number) parts.push(`Int. ${customer.customer_interior_number}`);
                if (customer.customer_colonia) parts.push(customer.customer_colonia);
                if (customer.customer_delegacion) parts.push(customer.customer_delegacion);
                if (customer.customer_postal_code) parts.push(`CP ${customer.customer_postal_code}`);
                return parts.join(', ');
              };
              const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
              const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
              const { data: { session: emailSession } } = await supabase.auth.getSession();
              const emailResp = await fetch(`${supabaseUrl}/functions/v1/send-order-email`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${emailSession?.access_token || supabaseAnonKey}`,
                },
                body: JSON.stringify({
                  customerName: `${customer.customer_name} ${customer.customer_lastname}`.trim(),
                  customerEmail: customer.customer_email,
                  orderNumber,
                  deliveryAddress: formatAddress(),
                  deliveryWeeks: [],
                  totals: {
                    subtotal: snappedProteinSubtotal,
                    planDiscount: 0,
                    deliveryPrice: 0,
                    couponDiscount: 0,
                    taxAmount: snappedProteinSubtotal * 0.16,
                    finalTotal: snappedProteinSubtotal * 1.16,
                  },
                  deliveryOptionName: 'Proteinas',
                  shopUrl: window.location.origin,
                }),
              });
              if (emailResp.ok) {
                emailSent = true;
              } else {
                emailError = 'No pudimos enviar el correo de confirmacion.';
              }
            } catch (err: any) {
              emailError = 'No pudimos enviar el correo de confirmacion.';
              console.warn('Could not send protein order email:', err);
            }
          }

          setConfirmationDetails({
            orderNumber,
            deliveryWeeks: [],
            deliveryAddress: '',
            deliveryOptionName: 'Proteinas',
            totals: {
              subtotal: snappedProteinSubtotal,
              planDiscount: 0,
              deliveryPrice: 0,
              couponDiscount: 0,
              taxAmount: snappedProteinSubtotal * 0.16,
              finalTotal: snappedProteinSubtotal * 1.16,
            },
            emailSent,
            emailError,
          });
        }
      }

      return { orderId, orderNumber };
    } catch (err) {
      console.error('Error creating order after payment:', err);
      return null;
    }
  }, [customer]);

  const initializeBrick = useCallback(async (amount: number, prefId: string, pubKey: string) => {
    if (brickInitializedRef.current) return;
    brickInitializedRef.current = true;

    try {
      setBrickLoading(true);
      await loadMercadoPagoSdk();
      await new Promise((r) => setTimeout(r, 300));

      const mp = new window.MercadoPago(pubKey, { locale: 'es-MX' });

      if (brickControllerRef.current) {
        brickControllerRef.current.unmount();
        brickControllerRef.current = null;
      }

      const containerId = 'paymentBrick_container';
      const container = document.getElementById(containerId);
      if (!container) {
        console.error('Payment brick container not found');
        brickInitializedRef.current = false;
        setBrickLoading(false);
        return;
      }

      const controller = await mp.bricks().create('payment', containerId, {
        initialization: {
          amount: amount,
          preferenceId: prefId,
        },
        customization: {
          visual: {
            style: { theme: 'default' },
            hideFormTitle: true,
            hidePaymentButton: false,
          },
          paymentMethods: mpPaymentMethods || {
            creditCard: 'all',
            debitCard: 'all',
            ticket: 'all',
            mercadoPago: 'all',
          },
        },
        callbacks: {
          onReady: () => {
            setBrickLoading(false);
          },
          onSubmit: async ({ selectedPaymentMethod, formData }: any) => {
            try {
              const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
              const { data: { session: paySession } } = await supabase.auth.getSession();

              // Step 1: Process payment with MercadoPago (no order in DB yet)
              const response = await fetch(`${supabaseUrl}/functions/v1/mercado-pago-checkout`, {
                method: 'POST',
                headers: {
                  Authorization: `Bearer ${paySession?.access_token || import.meta.env.VITE_SUPABASE_ANON_KEY}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  action: 'process-payment',
                  payment_data: formData,
                  quote_id: paymentQuoteIdRef.current,
                }),
              });

              const result = await response.json();

              if (!response.ok || !result.success) {
                throw new Error(result.error || 'Error al procesar el pago');
              }

              setPaymentResult(result);

              if (result.status === 'approved' || result.status === 'pending' || result.status === 'in_process') {
                // Step 2: Payment succeeded/pending -> NOW create the order
                const orderResult = await createOrderAfterPayment(result.payment_id, result.status, result.payment_type_id);

                if (orderResult) {
                  setCreatedOrderNumber(orderResult.orderNumber);
                } else {
                  setCreatedOrderNumber(`MP-${result.payment_id}`);
                  console.error('Payment succeeded but order creation failed. Payment ID:', result.payment_id);
                }

                clearCart();
                clearProteinCart();
                setStep('success');
              } else {
                setSubmitError(
                  result.status_detail === 'cc_rejected_other_reason'
                    ? 'La tarjeta fue rechazada. Intenta con otro metodo de pago.'
                    : `El pago fue rechazado: ${result.status_detail || result.status}`
                );
              }
            } catch (err: any) {
              console.error('Payment processing error:', err);
              setSubmitError(friendlyError(err, 'Error al procesar el pago'));
            }
          },
          onError: (error: any) => {
            console.error('Brick error:', error);
            setBrickLoading(false);
          },
        },
      });

      brickControllerRef.current = controller;
    } catch (err: any) {
      console.error('Error initializing payment brick:', err);
      setSubmitError('Error al cargar el formulario de pago. Recarga la pagina e intenta de nuevo.');
      brickInitializedRef.current = false;
      setBrickLoading(false);
    }
  }, [createOrderAfterPayment, clearCart, clearProteinCart]);

  useEffect(() => {
    return () => {
      if (brickControllerRef.current) {
        try { brickControllerRef.current.unmount(); } catch (_) {}
        brickControllerRef.current = null;
        brickInitializedRef.current = false;
      }
    };
  }, []);

  const handleProceedToPayment = async () => {
    if (!customer) { setSubmitError('Informacion del cliente incompleta'); return; }
    if (!cart && !hasProteinItems) { setSubmitError('El carrito esta vacio'); return; }

    try {
      setSubmitting(true);
      setSubmitError(null);

      // Build itemized list and calculate total
      let totalAmount = 0;
      const mpItems: { title: string; description: string; quantity: number; unit_price: number }[] = [];
      let deliveryPrice = 0;

      if (cart && cart.orderItems.length > 0) {
        const itemsTotal = cart.orderItems.reduce((total, item) => {
          if (BILLABLE_MEAL_TYPES.includes(item.meal_type as any))
            return total + item.meal_plan_price * item.quantity;
          return total;
        }, 0);

        // Group billable items by meal plan for cleaner MP line items
        const planGroups: Record<string, { name: string; count: number; total: number }> = {};
        for (const item of cart.orderItems) {
          if (!BILLABLE_MEAL_TYPES.includes(item.meal_type as any)) continue;
          const key = item.meal_plan_name || 'Plan';
          if (!planGroups[key]) planGroups[key] = { name: key, count: 0, total: 0 };
          planGroups[key].count += item.quantity;
          planGroups[key].total += item.meal_plan_price * item.quantity;
        }
        for (const g of Object.values(planGroups)) {
          const unitPrice = Math.round((g.total / g.count) * 100) / 100;
          mpItems.push({
            title: g.name,
            description: `${g.count} platillo(s) - ${g.name}`,
            quantity: g.count,
            unit_price: unitPrice,
          });
        }

        // Add protein items as separate lines
        if (hasProteinItems) {
          for (const pi of proteinCart) {
            mpItems.push({
              title: pi.proteinPlan.protein_plans_name,
              description: `Proteina - ${pi.proteinPlan.protein_plans_name}`,
              quantity: pi.quantity,
              unit_price: Math.round(pi.proteinPlan.protein_plans_price * 100) / 100,
            });
          }
        }

        const totalPlanDiscount = planDiscounts.reduce((sum, d) => sum + d.amount, 0);
        deliveryPrice = cart.selectedDeliveryOption?.delivery_options_price || 0;
        const couponDiscount = Math.min(cart.couponDiscountAmount || 0, itemsTotal - totalPlanDiscount + deliveryPrice);

        let subtotalBase = itemsTotal + proteinSubtotal;
        const subtotalAfterDiscount = subtotalBase - totalPlanDiscount + deliveryPrice - couponDiscount;
        const taxAmount = subtotalAfterDiscount * 0.16;
        totalAmount = Math.round((subtotalAfterDiscount + taxAmount) * 100) / 100;

        // If there are discounts, adjust items so MP total matches our total
        // We send one consolidated item with the final pre-tax amount and a tax line
        if (totalPlanDiscount > 0 || couponDiscount > 0) {
          const preDiscountTotal = mpItems.reduce((s, i) => s + i.unit_price * i.quantity, 0);
          if (preDiscountTotal !== subtotalAfterDiscount) {
            mpItems.length = 0;
            mpItems.push({
              title: 'Pedido de comida',
              description: `Pedido con ${Object.keys(planGroups).length} plan(es)`,
              quantity: 1,
              unit_price: totalAmount,
            });
            deliveryPrice = 0; // already included
          }
        }
      } else if (hasProteinItems) {
        for (const pi of proteinCart) {
          mpItems.push({
            title: pi.proteinPlan.protein_plans_name,
            description: `Proteina - ${pi.proteinPlan.protein_plans_name}`,
            quantity: pi.quantity,
            unit_price: Math.round(pi.proteinPlan.protein_plans_price * 100) / 100,
          });
        }
        const taxAmount = proteinSubtotal * 0.16;
        totalAmount = Math.round((proteinSubtotal + taxAmount) * 100) / 100;
        // Consolidate with tax for MP
        mpItems.length = 0;
        mpItems.push({
          title: 'Pedido de proteinas',
          description: `${proteinCart.length} producto(s) de proteina`,
          quantity: 1,
          unit_price: totalAmount,
        });
      }

      // Snapshot cart data so the brick callback can use it later
      cartSnapshotRef.current = cart ? { ...cart } : null;
      proteinCartSnapshotRef.current = [...proteinCart];
      proteinSubtotalSnapshotRef.current = proteinSubtotal;
      planDiscountsSnapshotRef.current = [...planDiscounts];
      setPaymentTotalAmount(totalAmount);

      // Create MercadoPago preference (no DB order)
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

      // Ensure the session is fresh — an expired JWT causes a silent 401
      const { data: { session: prefSession }, error: sessionError } = await supabase.auth.refreshSession();
      if (sessionError || !prefSession?.access_token) {
        setSubmitError('Tu sesion ha expirado. Por favor vuelve a iniciar sesion.');
        setSubmitting(false);
        return;
      }

      const currentOrigin = window.location.origin;

      const response = await fetch(`${supabaseUrl}/functions/v1/mercado-pago-checkout`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${prefSession.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'create-preference',
          items: mpItems,
          payer: {
            name: customer.customer_name,
            surname: customer.customer_lastname,
            email: customer.customer_email,
            phone: customer.customer_phone,
            address: {
              street_name: [customer.customer_street, customer.customer_colonia].filter(Boolean).join(', '),
              street_number: customer.customer_street_number || undefined,
              zip_code: customer.customer_postal_code || undefined,
            },
          },
          shipment_cost: deliveryPrice > 0 ? deliveryPrice : undefined,
          installments: 6,
          back_url: currentOrigin,
        }),
      });

      if (!response.ok) {
        const errBody = await response.json().catch(() => ({}));
        throw new Error(errBody?.error || `Error al crear preferencia de pago (${response.status})`);
      }

      const prefData = await response.json();
      if (!prefData.success) {
        throw new Error(prefData.error || 'No se pudo crear la preferencia de pago');
      }

      paymentQuoteIdRef.current = prefData.quote_id || null;

      // Store Checkout Pro redirect URL
      const initPointUrl = mpTestMode ? prefData.sandbox_init_point : prefData.init_point;
      setMpInitPoint(initPointUrl || null);

      // Save cart snapshot to localStorage for the redirect return page
      try {
        const pendingOrderData = {
          customer,
          cart: cartSnapshotRef.current,
          proteinCart: proteinCartSnapshotRef.current,
          proteinSubtotal: proteinSubtotalSnapshotRef.current,
          planDiscounts: planDiscountsSnapshotRef.current,
          totalAmount,
        };
        localStorage.setItem('mp_pending_order_data', JSON.stringify(pendingOrderData));
        localStorage.setItem('mp_pending_quote_id', prefData.quote_id || '');
      } catch (_) {}

      setStep('payment');

      setTimeout(() => {
        initializeBrick(totalAmount, prefData.preference_id, prefData.public_key);
      }, 100);

    } catch (err: any) {
      console.error('Error preparing payment:', err);
      setSubmitError(friendlyError(err, 'Error al preparar el pago. Por favor intenta de nuevo.'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleSimulatePayment = async (simulatedStatus: 'approved' | 'pending' | 'rejected') => {
    try {
      setSubmitting(true);
      setSubmitError(null);

      const fakePaymentId = `TEST-${Date.now()}`;

      if (simulatedStatus === 'rejected') {
        setSubmitError('Pago rechazado (simulado). Intenta con otro metodo de pago.');
        setSubmitting(false);
        return;
      }

      setPaymentResult({ status: simulatedStatus, payment_id: fakePaymentId });

      const orderResult = await createOrderAfterPayment(fakePaymentId, simulatedStatus);

      if (orderResult) {
        setCreatedOrderNumber(orderResult.orderNumber);
      } else {
        setCreatedOrderNumber(fakePaymentId);
        console.error('Simulated payment succeeded but order creation failed.');
      }

      clearCart();
      clearProteinCart();
      setStep('success');
    } catch (err: any) {
      console.error('Simulate payment error:', err);
      setSubmitError(friendlyError(err, 'Error en la simulacion de pago'));
    } finally {
      setSubmitting(false);
    }
  };

  const cartTotals = useMemo(() => {
    if (!cart && !hasProteinItems) return null;
    const mealItemsTotal = cart
      ? cart.orderItems.reduce((total, item) => {
          if (BILLABLE_MEAL_TYPES.includes(item.meal_type as any)) return total + item.meal_plan_price * item.quantity;
          return total;
        }, 0)
      : 0;
    const totalPlanDiscount = planDiscounts.reduce((sum, d) => sum + d.amount, 0);
    const deliveryPrice = cart?.selectedDeliveryOption?.delivery_options_price || 0;
    const couponDiscountAmount = cart?.couponDiscountAmount || 0;
    return calculatePriceBreakdown(mealItemsTotal + proteinSubtotal, totalPlanDiscount, deliveryPrice, couponDiscountAmount, 0, 16);
  }, [cart, hasProteinItems, planDiscounts, proteinSubtotal]);

  // --- SUCCESS SCREEN ---
  if (step === 'success') {
    const isApproved = paymentResult?.status === 'approved';
    const isCashPending = !isApproved && (paymentResult?.payment_type_id === 'ticket' || paymentResult?.payment_type_id === 'atm');
    const ticketUrl = paymentResult?.transaction_details?.external_resource_url;
    const cd = confirmationDetails;

    const formatDeliveryDate = (dateString: string | null): string => {
      if (!dateString) return 'Por confirmar';
      const [year, month, day] = dateString.split('-').map(Number);
      const date = new Date(year, month - 1, day);
      return date.toLocaleDateString('es-MX', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    };

    return (
      <div className="min-h-screen bg-gray-50 py-12 px-4">
        <div className="max-w-lg mx-auto">
          {/* Header */}
          <div className="rounded-2xl shadow-lg overflow-hidden bg-white">
            <div className={`px-8 py-10 text-center ${isApproved ? 'bg-gradient-to-br from-green-500 to-emerald-600' : isCashPending ? 'bg-gradient-to-br from-orange-400 to-amber-500' : 'bg-gradient-to-br from-yellow-400 to-amber-500'}`}>
              <div className="w-20 h-20 rounded-full bg-white/20 flex items-center justify-center mx-auto mb-5">
                {isCashPending ? <Store className="w-10 h-10 text-white" /> : <CheckCircle className="w-10 h-10 text-white" />}
              </div>
              <h2 className="text-2xl font-bold text-white mb-1">
                {isApproved ? 'Pedido Confirmado' : isCashPending ? 'Pago Pendiente en Efectivo' : 'Pago en Proceso'}
              </h2>
              <p className="text-white/90 text-sm">
                {isApproved
                  ? 'Tu pago ha sido procesado exitosamente'
                  : isCashPending
                    ? 'Tu pedido esta reservado. Completa el pago en una tienda participante.'
                    : 'Tu pago esta siendo procesado. Te notificaremos cuando se confirme.'}
              </p>
            </div>

            <div className="px-8 py-8 space-y-6">
              {/* Cash payment instructions */}
              {isCashPending && (
                <div className="bg-orange-50 border border-orange-200 rounded-xl p-5 space-y-3">
                  <h3 className="font-semibold text-orange-900 flex items-center gap-2">
                    <Store className="w-5 h-5" /> Instrucciones de pago
                  </h3>
                  <ol className="text-sm text-orange-800 space-y-2 list-decimal list-inside">
                    <li>Abre o descarga tu ticket de pago usando el boton de abajo.</li>
                    <li>Presentalo en OXXO, 7-Eleven u otra tienda participante.</li>
                    <li>Tienes <strong>24 horas</strong> para completar el pago.</li>
                    <li>Una vez pagado, recibiremos la confirmacion automaticamente y te notificaremos por correo.</li>
                  </ol>
                  {ticketUrl && (
                    <a
                      href={ticketUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 w-full flex items-center justify-center gap-2 bg-orange-600 hover:bg-orange-700 text-white py-3 rounded-lg font-semibold transition-colors"
                    >
                      <ExternalLink className="w-4 h-4" /> Ver ticket de pago
                    </a>
                  )}
                </div>
              )}

              {/* Order number */}
              {(cd?.orderNumber || createdOrderNumber) && (
                <div className="bg-gray-50 rounded-xl p-5 text-center border border-gray-100">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Numero de Orden</p>
                  <p className="text-2xl font-bold text-red-600">#{cd?.orderNumber || createdOrderNumber}</p>
                </div>
              )}

              {/* Delivery dates */}
              {cd && cd.deliveryWeeks.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <Calendar className="w-4 h-4" /> Fechas de Entrega
                  </h3>
                  <div className="space-y-2">
                    {cd.deliveryWeeks.map((w, i) => (
                      <div key={i} className="flex items-center justify-between bg-green-50 rounded-lg px-4 py-3 border border-green-100">
                        <span className="text-sm font-medium text-gray-700">{w.weekName}</span>
                        <span className="text-sm font-semibold text-green-700">{formatDeliveryDate(w.deliveryDate)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Delivery address */}
              {cd && cd.deliveryAddress && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-2">
                    <MapPin className="w-4 h-4" /> Direccion de Entrega
                  </h3>
                  <p className="text-sm text-gray-700 bg-gray-50 rounded-lg px-4 py-3 border border-gray-100">
                    {cd.deliveryAddress}
                    {cd.deliveryOptionName && <span className="block text-xs text-gray-500 mt-1">Metodo: {cd.deliveryOptionName}</span>}
                  </p>
                </div>
              )}

              {/* Payment summary */}
              {cd && cd.totals && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Resumen de Pago</h3>
                  <div className="bg-gray-50 rounded-xl border border-gray-100 overflow-hidden">
                    <div className="divide-y divide-gray-100">
                      <div className="flex justify-between px-4 py-3">
                        <span className="text-sm text-gray-600">Subtotal</span>
                        <span className="text-sm font-medium text-gray-900">${Math.round(cd.totals.subtotal).toLocaleString()} MXN</span>
                      </div>
                      {cd.totals.planDiscount > 0 && (
                        <div className="flex justify-between px-4 py-3">
                          <span className="text-sm text-green-600">Descuento por volumen</span>
                          <span className="text-sm font-medium text-green-600">-${Math.round(cd.totals.planDiscount).toLocaleString()} MXN</span>
                        </div>
                      )}
                      {cd.totals.deliveryPrice > 0 && (
                        <div className="flex justify-between px-4 py-3">
                          <span className="text-sm text-gray-600">Envio</span>
                          <span className="text-sm font-medium text-gray-900">${Math.round(cd.totals.deliveryPrice).toLocaleString()} MXN</span>
                        </div>
                      )}
                      {cd.totals.couponDiscount > 0 && (
                        <div className="flex justify-between px-4 py-3">
                          <span className="text-sm text-green-600">Cupon {cd.couponCode}</span>
                          <span className="text-sm font-medium text-green-600">-${Math.round(cd.totals.couponDiscount).toLocaleString()} MXN</span>
                        </div>
                      )}
                      <div className="flex justify-between px-4 py-3">
                        <span className="text-sm text-gray-600">IVA (16%)</span>
                        <span className="text-sm font-medium text-gray-900">${Math.round(cd.totals.taxAmount).toLocaleString()} MXN</span>
                      </div>
                    </div>
                    <div className="bg-gray-900 px-4 py-4 flex justify-between items-center">
                      <span className="text-sm font-bold text-white">{isApproved ? 'Total Pagado' : 'Total a Pagar'}</span>
                      <span className="text-xl font-bold text-white">${Math.round(cd.totals.finalTotal).toLocaleString()} MXN</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Email notification */}
              {cd && cd.emailSent && (
                <div className="flex items-center gap-3 bg-blue-50 rounded-lg px-4 py-3 border border-blue-100">
                  <Mail className="w-5 h-5 text-blue-600 flex-shrink-0" />
                  <p className="text-sm text-blue-800">Te enviamos un correo de confirmacion a tu email registrado.</p>
                </div>
              )}
              {cd && cd.emailError && (
                <div className="flex items-center gap-3 bg-yellow-50 rounded-lg px-4 py-3 border border-yellow-100">
                  <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0" />
                  <p className="text-sm text-yellow-800">{cd.emailError} Puedes ver tu pedido en tu cuenta.</p>
                </div>
              )}

              {/* Actions */}
              <div className="space-y-3 pt-2">
                <Link
                  to="/account"
                  className="block w-full bg-red-600 hover:bg-red-700 text-white py-3.5 rounded-xl font-semibold transition-colors text-center"
                >
                  Ver mis pedidos
                </Link>
                <Link
                  to="/"
                  className="block w-full bg-gray-100 hover:bg-gray-200 text-gray-700 py-3 rounded-xl font-medium transition-colors text-center"
                >
                  Volver al Inicio
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // --- PAYMENT STEP (BRICK) ---
  if (step === 'payment') {
    return (
      <div className="min-h-screen bg-gray-50 py-8 px-4">
        <div className="max-w-3xl mx-auto">
          <button
            onClick={() => {
              if (brickControllerRef.current) {
                try { brickControllerRef.current.unmount(); } catch (_) {}
                brickControllerRef.current = null;
                brickInitializedRef.current = false;
              }
              setSubmitError(null);
              setStep('review');
            }}
            className="flex items-center text-gray-600 hover:text-gray-900 mb-6 transition-colors"
          >
            <ArrowLeft className="h-5 w-5 mr-2" /> Volver a revisar pedido
          </button>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="bg-gradient-to-r from-gray-900 to-gray-800 px-4 sm:px-6 py-5">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex items-center gap-3">
                  <ShieldCheck className="w-6 h-6 text-green-400 shrink-0" />
                  <div>
                    <h2 className="text-lg font-bold text-white">Pago Seguro</h2>
                    <p className="text-gray-400 text-sm">Procesado por Mercado Pago</p>
                  </div>
                </div>
                <div className="sm:text-right">
                  <p className="text-gray-400 text-sm">Total a pagar</p>
                  <p className="text-2xl font-bold text-white">${Math.round(paymentTotalAmount).toLocaleString()} MXN</p>
                </div>
              </div>
            </div>

            {submitError && (
              <div className="mx-6 mt-4 bg-red-50 border border-red-200 rounded-xl p-4 flex items-center space-x-3">
                <XCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
                <span className="text-red-800 text-sm">{submitError}</span>
              </div>
            )}

            <div className="p-6">
              {/* Checkout Pro - Redirect to Mercado Pago */}
              {mpCheckoutProEnabled && mpInitPoint && (
                <div className="mb-6">
                  <button
                    onClick={() => {
                      window.location.href = mpInitPoint!;
                    }}
                    className="w-full flex items-center justify-center gap-3 bg-[#009ee3] hover:bg-[#007eb5] text-white py-4 rounded-xl font-semibold text-base transition-colors shadow-md hover:shadow-lg"
                  >
                    <img
                      src="https://www.mercadopago.com/org-img/MP3/home/logomp3.gif"
                      alt="Mercado Pago"
                      className="h-5 w-auto"
                    />
                    Pagar con Mercado Pago
                  </button>
                  <div className="flex items-center justify-center gap-1.5 mt-2">
                    <svg className="w-3.5 h-3.5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                    </svg>
                    <p className="text-xs text-gray-500">
                      Pago seguro con saldo, tarjetas guardadas o cualquier metodo de tu cuenta
                    </p>
                  </div>

                  <div className="relative my-6">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-gray-200" />
                    </div>
                    <div className="relative flex justify-center text-sm">
                      <span className="bg-white px-4 text-gray-400 font-medium">o paga directamente aqui</span>
                    </div>
                  </div>
                </div>
              )}

              {brickLoading && (
                <div className="flex flex-col items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-blue-500 mb-4" />
                  <p className="text-gray-600">Cargando formulario de pago...</p>
                </div>
              )}
              <div
                id="paymentBrick_container"
                ref={brickContainerRef}
                style={{ minHeight: brickLoading ? 0 : 200 }}
              />

              {/* TEST ONLY - Simulate Payment Block (visible only when test mode is on) */}
              {mpTestMode && (
              <div className="mt-6 border-2 border-dashed border-yellow-400 bg-yellow-50 rounded-xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Zap className="w-5 h-5 text-yellow-600" />
                  <span className="text-sm font-bold text-yellow-800 uppercase tracking-wide">Modo de Prueba - Simular Pago</span>
                </div>
                <p className="text-xs text-yellow-700 mb-4">
                  Estos botones simulan resultados de pago sin procesar una transaccion real. Solo para pruebas.
                </p>
                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={() => handleSimulatePayment('approved')}
                    disabled={submitting}
                    className="flex-1 min-w-[140px] bg-green-600 hover:bg-green-700 text-white px-4 py-2.5 rounded-lg font-semibold text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                    Aprobado
                  </button>
                  <button
                    onClick={() => handleSimulatePayment('pending')}
                    disabled={submitting}
                    className="flex-1 min-w-[140px] bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2.5 rounded-lg font-semibold text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Calendar className="w-4 h-4" />}
                    Pendiente (OXXO)
                  </button>
                  <button
                    onClick={() => handleSimulatePayment('rejected')}
                    disabled={submitting}
                    className="flex-1 min-w-[140px] bg-red-500 hover:bg-red-600 text-white px-4 py-2.5 rounded-lg font-semibold text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                    Rechazado
                  </button>
                </div>
              </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // --- REVIEW STEP ---
  if (!hasItems && !hasProteinItems) return null;

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <Link to="/cart" className="flex items-center text-gray-600 hover:text-gray-900 mb-4 transition-colors">
            <ArrowLeft className="h-5 w-5 mr-2" /> Volver al carrito
          </Link>
          <h1 className="text-3xl font-bold font-antonio text-gray-900">Revisar Pedido</h1>
          <p className="text-gray-600 mt-2">Revisa y confirma tu pedido antes de pagar</p>
        </div>

        {submitError && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-xl p-4 flex items-center space-x-3">
            <XCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
            <span className="text-red-800">{submitError}</span>
          </div>
        )}

        {cart && cart.selectedWeeks && cart.selectedWeeks.length > 0 && (
          <div className="mb-6 bg-gradient-to-r from-green-50 to-green-100 border-2 border-green-300 rounded-xl p-6">
            <div className="flex items-center mb-4">
              <Calendar className="w-6 h-6 text-green-700 mr-3" />
              <h3 className="text-2xl font-bold text-green-900">Fechas de Entrega</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {cart.selectedWeeks.map((week, index) => (
                <div key={`delivery-${week.week.week_id}-${index}`} className="bg-white rounded-lg p-4 shadow-sm border border-green-200">
                  <p className="text-sm text-gray-600 mb-1">Semana {index + 1}</p>
                  <p className="font-bold text-gray-900 mb-2">{week.week.week_name}</p>
                  {week.week.week_date && (
                    <p className="text-lg font-bold text-green-700">{formatDate(week.week.week_date)}</p>
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
                  <MapPin className="w-5 h-5 mr-2 text-green-600" /> Informacion de Entrega
                </h3>
                <div className="space-y-3">
                  <div className="flex items-start">
                    <User className="w-5 h-5 text-gray-500 mr-3 mt-0.5" />
                    <div>
                      <p className="text-sm text-gray-600">Nombre</p>
                      <p className="font-semibold text-gray-900">{customer.customer_name} {customer.customer_lastname}</p>
                    </div>
                  </div>
                  <div className="flex items-start">
                    <MapPin className="w-5 h-5 text-gray-500 mr-3 mt-0.5" />
                    <div>
                      <p className="text-sm text-gray-600">Direccion de Entrega</p>
                      <p className="font-semibold text-gray-900">{formatCustomerAddress() || 'Sin direccion registrada'}</p>
                    </div>
                  </div>
                  <div className="flex items-start">
                    <Phone className="w-5 h-5 text-gray-500 mr-3 mt-0.5" />
                    <div>
                      <p className="text-sm text-gray-600">Telefono</p>
                      <p className="font-semibold text-gray-900">{customer.customer_phone}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {hasProteinItems && (
              <div className="bg-gray-50 rounded-xl p-6">
                <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <Zap className="w-4 h-4 text-red-500" /> Planes de Proteina
                </h3>
                <div className="space-y-2">
                  {proteinCart.map((item) => (
                    <div key={item.proteinPlan.id} className="flex justify-between text-sm">
                      <span className="text-gray-700">{item.proteinPlan.protein_plans_name} ({item.quantity}x)</span>
                      <span className="font-medium text-gray-900">${(item.proteinPlan.protein_plans_price * item.quantity).toFixed(2)}</span>
                    </div>
                  ))}
                  <div className="pt-2 border-t border-gray-200 flex justify-between text-sm font-semibold">
                    <span className="text-gray-700">Subtotal proteinas</span>
                    <span className="text-gray-900">${proteinSubtotal.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            )}

            {cart && cart.orderItems.length > 0 && (
              <>
                <div className="bg-gray-50 rounded-xl p-6">
                  <h3 className="font-bold text-gray-900 mb-4">Detalles del Pedido</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Duracion:</span>
                      <span className="font-medium">{cart.planDuration} {cart.planDuration === 1 ? 'semana' : 'semanas'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Semanas:</span>
                      <span className="font-medium">{cart.selectedWeeks.map((w) => w.week.week_name).join(', ')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Total de comidas:</span>
                      <span className="font-medium">{cart.orderItems.filter((i) => BILLABLE_MEAL_TYPES.includes(i.meal_type as any)).length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Envio:</span>
                      <span className="font-medium">{cart.selectedDeliveryOption?.delivery_options_name}</span>
                    </div>
                    {cart.appliedCoupon && (
                      <div className="flex justify-between text-green-600">
                        <span>Cupon aplicado:</span>
                        <span className="font-medium">{cart.appliedCoupon.code}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="bg-gray-50 rounded-xl p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold text-gray-900">Comidas Seleccionadas</h3>
                    <span className="inline-flex items-center justify-center min-w-[2.5rem] px-3 py-1 rounded-full bg-red-600 text-white text-xl font-bold leading-none">
                      {cart.orderItems.reduce((sum, i) => sum + (BILLABLE_MEAL_TYPES.includes(i.meal_type as any) ? i.quantity : 0), 0)}
                    </span>
                  </div>
                  <div className="space-y-4">
                    {cart.selectedWeeks.map((week) => {
                      const weekItems = cart.orderItems.filter((i) => i.week_name === week.week.week_name);
                      if (weekItems.length === 0) return null;
                      return (
                        <div key={week.tempId} className="border border-gray-200 rounded-lg p-4">
                          <h4 className="font-medium text-gray-900 mb-3">{week.week.week_name}</h4>
                          <div className="space-y-2">
                            {weekItems.map((item) => {
                              const isBillable = BILLABLE_MEAL_TYPES.includes(item.meal_type as any);
                              const itemPrice = isBillable ? item.meal_plan_price * item.quantity : 0;
                              return (
                                <div key={item.tempId} className="flex justify-between text-sm">
                                  <span className="flex flex-col text-gray-700">
                                    <span>{item.day_of_week} - {item.meal_type} ({item.quantity}x)</span>
                                    {item.meal_plan_name && (
                                      <span className="inline-block w-fit mt-1 px-2 py-0.5 rounded-full bg-gray-200 text-gray-700 text-xs font-medium">
                                        {item.meal_plan_name}
                                      </span>
                                    )}
                                  </span>
                                  <span className="font-medium text-gray-900">${itemPrice.toFixed(2)}</span>
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
                    <h3 className="font-bold text-gray-900 mb-2">Notas del Pedido</h3>
                    <p className="text-sm text-gray-700">{cart.orderNotes}</p>
                  </div>
                )}
              </>
            )}
          </div>

          <div className="lg:col-span-1">
            <div className="bg-gray-50 rounded-xl p-6 sticky top-6">
              <h3 className="font-bold text-gray-900 mb-4">Resumen</h3>
              {cartTotals && (
                <div className="space-y-3 text-sm mb-6">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Subtotal:</span>
                    <span className="font-medium">${Math.round(cartTotals.itemsSubtotal).toFixed(0)}</span>
                  </div>
                  {planDiscounts.length > 0 && (
                    <div className="border-t border-gray-200 pt-2">
                      {planDiscounts.map((d, i) => (
                        <div key={i} className="flex justify-between text-green-600">
                          <span>Descuento {d.planName} ({d.percentage}%):</span>
                          <span>-${Math.round(d.amount).toFixed(0)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-gray-600">Envio:</span>
                    <span className="font-medium">${Math.round(cartTotals.deliveryPrice).toFixed(0)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">IVA (16%):</span>
                    <span className="font-medium">${Math.round(cartTotals.taxAmount).toFixed(0)}</span>
                  </div>
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>IVA Envio:</span>
                    <span>${Math.round(cartTotals.deliveryTaxAmount).toFixed(0)}</span>
                  </div>
                  {cart?.appliedCoupon && (cart?.couponDiscountAmount ?? 0) > 0 && (
                    <div className="flex justify-between text-green-600 border-t border-gray-200 pt-2">
                      <span>Cupon {cart.appliedCoupon.code}:</span>
                      <span>-${Math.round(cart.couponDiscountAmount).toFixed(0)}</span>
                    </div>
                  )}
                  <div className="pt-3 border-t border-gray-300 flex justify-between">
                    <span className="font-bold text-gray-900">Total:</span>
                    <span className="font-bold text-xl text-red-600">${cartTotals.finalTotal.toFixed(0)}</span>
                  </div>
                </div>
              )}

              <div className="mb-4 pb-4 border-b border-gray-200">
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">Metodos de pago aceptados</p>
                <div className="flex flex-wrap gap-2">
                  <span className="text-xs bg-blue-50 text-blue-700 px-2.5 py-1 rounded-full font-medium">Tarjeta credito/debito</span>
                  <span className="text-xs bg-orange-50 text-orange-700 px-2.5 py-1 rounded-full font-medium">OXXO</span>
                  <span className="text-xs bg-teal-50 text-teal-700 px-2.5 py-1 rounded-full font-medium">MSI</span>
                  <span className="text-xs bg-sky-50 text-sky-700 px-2.5 py-1 rounded-full font-medium">Mercado Pago</span>
                </div>
              </div>

              <div className="space-y-3">
                <button
                  onClick={handleProceedToPayment}
                  disabled={submitting || loadingDiscounts}
                  className="w-full bg-[#009ee3] hover:bg-[#007eb5] text-white px-6 py-3.5 rounded-xl font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {submitting ? (
                    <><Loader2 className="w-5 h-5 animate-spin" /> Procesando...</>
                  ) : (
                    <><CreditCard className="w-5 h-5" /> Proceder al Pago</>
                  )}
                </button>
                <p className="text-xs text-center text-gray-500">
                  El pago se procesara de forma segura con Mercado Pago
                </p>
                <button
                  onClick={() => { clearCart(); clearProteinCart(); }}
                  disabled={submitting}
                  className="w-full bg-red-50 hover:bg-red-100 text-red-600 px-6 py-3 rounded-xl font-medium transition-colors flex items-center justify-center"
                >
                  <Trash2 className="w-5 h-5 mr-2" /> Cancelar Pedido
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
