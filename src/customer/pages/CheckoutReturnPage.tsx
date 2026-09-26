import React, { useEffect, useState, useRef } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { CircleCheck as CheckCircle, Circle as XCircle, Clock, Loader as Loader2, Package, Chrome as Home, Calendar, MapPin, User, Phone, Mail, CircleAlert as AlertCircle, ExternalLink, Store } from 'lucide-react';
import { customerOrderSubmissionService, OrderConfirmationData } from '../services/customerOrderSubmissionService';
import { supabase } from '../../config/supabase';
import { useCart } from '../contexts/CartContext';
import { BILLABLE_MEAL_TYPES } from '../../types/orderMenu';
import { friendlyError } from '../utils/friendlyError';

type PaymentStatus = 'loading' | 'approved' | 'pending' | 'failure';

export const CheckoutReturn: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<PaymentStatus>('loading');
  const [confirmationData, setConfirmationData] = useState<OrderConfirmationData | null>(null);
  const [emailSent, setEmailSent] = useState(false);
  const [emailError, setEmailError] = useState(false);
  const [orderNumber, setOrderNumber] = useState<string | null>(null);
  const [totals, setTotals] = useState<OrderConfirmationData['totals'] | null>(null);
  const [failureDetail, setFailureDetail] = useState('');
  const [ticketUrl, setTicketUrl] = useState<string | null>(null);
  const processedRef = useRef(false);

  const { clearCart, clearProteinCart } = useCart();

  const formatDate = (dateString: string) => {
    const [year, month, day] = dateString.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString('es-MX', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    });
  };

  useEffect(() => {
    if (processedRef.current) return;
    processedRef.current = true;

    const handleReturn = async () => {
      const urlStatus = searchParams.get('status') || searchParams.get('collection_status');
      const paymentId = searchParams.get('payment_id') || searchParams.get('collection_id');

      // Try to recover stored order data (already created before redirect - legacy flow)
      const storedOrder = localStorage.getItem('mp_pending_order');
      let existingOrderData: OrderConfirmationData | null = null;
      if (storedOrder) {
        try { existingOrderData = JSON.parse(storedOrder); } catch (_) {}
      }

      // Try to recover the cart snapshot (Checkout Pro flow - order not yet created)
      const storedCartData = localStorage.getItem('mp_pending_order_data');
      let pendingCartData: any = null;
      if (storedCartData) {
        try { pendingCartData = JSON.parse(storedCartData); } catch (_) {}
      }

      if (urlStatus === 'failure' || urlStatus === 'rejected') {
        setConfirmationData(existingOrderData);
        // Extract status_detail from URL if present for better messaging
        const detail = searchParams.get('status_detail') || '';
        setFailureDetail(detail);
        setStatus('failure');
        return;
      }

      const isPending = urlStatus === 'pending' || urlStatus === 'in_process';
      const isApproved = urlStatus === 'approved' || urlStatus === 'success';

      if (!isApproved && !isPending) {
        setConfirmationData(existingOrderData);
        setStatus('failure');
        return;
      }

      // --- Checkout Pro flow: create order from saved cart data ---
      if (pendingCartData && !existingOrderData) {
        try {
          const { customer, cart, proteinCart, proteinSubtotal, planDiscounts } = pendingCartData;
          const mpPaymentId = paymentId || `MP-redirect-${Date.now()}`;
          const mpStatus = isApproved ? 'approved' : 'pending';

          let createdOrderId = '';
          let createdOrderNumber = '';
          let orderEmailSent = false;
          let orderEmailError = false;
          let orderTotals: OrderConfirmationData['totals'] | null = null;

          const hasProtein = proteinCart && proteinCart.length > 0;

          if (cart && cart.orderItems && cart.orderItems.length > 0) {
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
              console.error('Order creation failed after redirect:', result.message);
              setStatus('failure');
              return;
            }

            createdOrderId = result.orderId;
            createdOrderNumber = result.orderNumber;
            orderTotals = result.totals!;

            if (hasProtein) {
              orderTotals.subtotal += proteinSubtotal;
              orderTotals.finalTotal += proteinSubtotal * 1.16;
              await saveProteinOrders(createdOrderId, customer, proteinCart);
            }

            // Detect cash payment from URL params
            const urlPaymentType = searchParams.get('payment_type') || '';
            const isCashType = urlPaymentType === 'ticket' || urlPaymentType === 'atm';

            // Update order with MP payment info
            await supabase
              .from('orders')
              .update({
                payment_provider: 'mercadopago',
                mp_payment_id: mpPaymentId,
                ...(mpStatus === 'approved' ? {
                  order_status: 'completed',
                  stripe_payment_status: 'succeeded',
                  stripe_paid_at: new Date().toISOString(),
                } : {
                  order_status: isCashType ? 'pending_cash_payment' : 'pending',
                  stripe_payment_status: 'pending',
                }),
              })
              .eq('id', createdOrderId);

            if (mpStatus === 'approved') {
              const confirmData: OrderConfirmationData = {
                orderId: createdOrderId,
                orderNumber: createdOrderNumber,
                customer,
                selectedWeeks: cart.selectedWeeks,
                totals: orderTotals,
                deliveryOptionName: cart.selectedDeliveryOption?.delivery_options_name ?? '',
                couponCode: cart.appliedCoupon?.code,
              };
              try {
                await customerOrderSubmissionService.markOrderAsPaid(confirmData);
                orderEmailSent = true;
              } catch (err) {
                console.warn('Could not send confirmation email:', err);
                orderEmailError = true;
              }
              setConfirmationData(confirmData);
            }
          } else if (hasProtein) {
            const taxAmount = proteinSubtotal * 0.16;
            const finalTotal = proteinSubtotal + taxAmount;
            const totalAmount = Math.round(finalTotal * 100) / 100;

            const { data: orderRow } = await supabase
              .from('orders')
              .insert({
                customer_id: customer.customer_id,
                order_customer_name: `${customer.customer_name} ${customer.customer_lastname}`.trim(),
                order_customer_email: customer.customer_email,
                order_status: mpStatus === 'approved' ? 'completed' : (urlPaymentType === 'ticket' || urlPaymentType === 'atm') ? 'pending_cash_payment' : 'pending',
                order_notes: 'Pedido de proteinas',
                order_total_price: totalAmount,
                order_invoice_number: '',
                stripe_payment_status: mpStatus === 'approved' ? 'succeeded' : 'pending',
                stripe_paid_at: mpStatus === 'approved' ? new Date().toISOString() : null,
                payment_provider: 'mercadopago',
                mp_payment_id: mpPaymentId || null,
              })
              .select('id, order_id')
              .single();

            if (orderRow) {
              createdOrderId = orderRow.id;
              createdOrderNumber = orderRow.order_id;
              await saveProteinOrders(createdOrderId, customer, proteinCart);
            }

            orderTotals = {
              subtotal: proteinSubtotal,
              planDiscount: 0,
              deliveryPrice: 0,
              couponDiscount: 0,
              taxAmount: proteinSubtotal * 0.16,
              finalTotal: proteinSubtotal * 1.16,
            };
          }

          setOrderNumber(createdOrderNumber);
          setTotals(orderTotals);
          setEmailSent(orderEmailSent);
          setEmailError(orderEmailError);

          clearCart();
          clearProteinCart();
          localStorage.removeItem('mp_pending_order_data');
          localStorage.removeItem('mp_pending_quote_id');

          setStatus(isApproved ? 'approved' : 'pending');
          return;
        } catch (err) {
          console.error('Error creating order after redirect:', err);
          setStatus('failure');
          return;
        }
      }

      // --- Legacy flow: order already existed before redirect ---
      if (existingOrderData) {
        if (paymentId && existingOrderData.orderId) {
          try {
            const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token || import.meta.env.VITE_SUPABASE_ANON_KEY;

            const response = await fetch(`${supabaseUrl}/functions/v1/mercado-pago-checkout`, {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                action: 'get-payment-status',
                payment_id: paymentId,
                order_id: existingOrderData.orderId,
              }),
            });

            const result = await response.json();
            if (result.status === 'pending' || result.status === 'in_process') {
              setConfirmationData(existingOrderData);
              setOrderNumber(existingOrderData.orderNumber);
              setTotals(existingOrderData.totals);
              setStatus('pending');
              return;
            }
          } catch (err) {
            console.warn('Could not verify payment server-side:', err);
          }
        }

        if (isApproved) {
          try {
            await customerOrderSubmissionService.markOrderAsPaid(existingOrderData);
            setEmailSent(true);
          } catch (err) {
            console.warn('Could not send confirmation email:', err);
            setEmailError(true);
          }
        }

        setConfirmationData(existingOrderData);
        setOrderNumber(existingOrderData.orderNumber);
        setTotals(existingOrderData.totals);
        setStatus(isApproved ? 'approved' : 'pending');
        localStorage.removeItem('mp_pending_order');
        localStorage.removeItem('mp_pending_order_data');
        return;
      }

      // No stored data at all -- just show status based on URL
      setStatus(isApproved ? 'approved' : isPending ? 'pending' : 'failure');
    };

    handleReturn();
  }, [searchParams]);

  async function saveProteinOrders(orderId: string, customer: any, proteinItems: any[]) {
    try {
      const rows = proteinItems.map((item: any) => ({
        order_id: orderId,
        customer_id: customer.customer_id,
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
  }

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="text-center">
          <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Verificando tu pago...</h2>
          <p className="text-gray-500">Por favor espera un momento</p>
        </div>
      </div>
    );
  }

  const failureMessage = (() => {
    const d = failureDetail;
    if (d.includes('insufficient_amount')) return 'Tu tarjeta no tiene fondos suficientes. Intenta con otra tarjeta o metodo de pago.';
    if (d.includes('bad_filled_card_number')) return 'El numero de tarjeta es incorrecto. Verifica los datos e intenta de nuevo.';
    if (d.includes('bad_filled_date')) return 'La fecha de vencimiento de la tarjeta es incorrecta.';
    if (d.includes('bad_filled_security_code')) return 'El codigo de seguridad (CVV) es incorrecto.';
    if (d.includes('bad_filled_other')) return 'Algunos datos de la tarjeta son incorrectos. Revisalos e intenta de nuevo.';
    if (d.includes('call_for_authorize')) return 'Tu banco necesita que autorices este pago. Llama al numero que aparece detras de tu tarjeta.';
    if (d.includes('card_disabled')) return 'Tu tarjeta esta deshabilitada. Contacta a tu banco o usa otro metodo de pago.';
    if (d.includes('duplicated_payment')) return 'Ya se proceso un pago por este monto. Revisa tus movimientos antes de intentar de nuevo.';
    if (d.includes('high_risk')) return 'El pago fue rechazado por seguridad. Intenta con otro metodo de pago.';
    if (d.includes('max_attempts')) return 'Alcanzaste el limite de intentos con esta tarjeta. Usa otra tarjeta o espera 24 horas.';
    if (d.includes('expired')) return 'El tiempo para completar el pago ha expirado. Vuelve a generar tu pedido.';
    return 'Tu pago no pudo ser procesado. Puedes intentar de nuevo o elegir otro metodo de pago.';
  })();

  if (status === 'failure') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="max-w-md mx-auto text-center">
          <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <XCircle className="w-12 h-12 text-red-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Pago no completado</h2>
          <p className="text-gray-500 mb-8">
            {failureMessage}
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link to="/order" className="bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-xl font-semibold transition-colors text-center">
              Intentar de nuevo
            </Link>
            <Link to="/" className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-6 py-3 rounded-xl font-semibold transition-colors text-center">
              Volver al inicio
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (status === 'pending') {
    const paymentMethod = searchParams.get('payment_type') || '';
    const isCashPayment = paymentMethod === 'ticket' || paymentMethod === 'atm';

    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="max-w-md mx-auto">
          <div className="text-center">
            <div className={`w-20 h-20 ${isCashPayment ? 'bg-orange-100' : 'bg-yellow-100'} rounded-full flex items-center justify-center mx-auto mb-6`}>
              {isCashPayment ? <Store className="w-12 h-12 text-orange-600" /> : <Clock className="w-12 h-12 text-yellow-600" />}
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              {isCashPayment ? 'Pago pendiente en efectivo' : 'Pago en proceso'}
            </h2>
            <p className="text-gray-500 mb-6">
              {isCashPayment
                ? 'Tu pedido esta reservado. Completa el pago en una tienda participante.'
                : 'Tu pago esta siendo procesado por el banco. Te notificaremos cuando se confirme. Esto puede tomar unos minutos.'}
            </p>
          </div>

          {isCashPayment && (
            <div className="bg-orange-50 border border-orange-200 rounded-xl p-5 mb-6 space-y-3">
              <h3 className="font-semibold text-orange-900 flex items-center gap-2">
                <Store className="w-5 h-5" /> Instrucciones de pago
              </h3>
              <ol className="text-sm text-orange-800 space-y-2 list-decimal list-inside">
                <li>Revisa tu correo electronico para obtener el comprobante de pago.</li>
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
                  <ExternalLink className="w-4 h-4" /> Ver comprobante de pago
                </a>
              )}
            </div>
          )}

          {orderNumber && (
            <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6 text-left">
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1">Numero de Orden</p>
              <p className="text-2xl font-bold text-red-600">#{orderNumber}</p>
            </div>
          )}
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link to="/account?tab=orders" className="bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-xl font-semibold transition-colors flex items-center justify-center gap-2">
              <Package className="w-4 h-4" /> Ver mis pedidos
            </Link>
            <Link to="/" className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-6 py-3 rounded-xl font-semibold transition-colors flex items-center justify-center gap-2">
              <Home className="w-4 h-4" /> Volver al inicio
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // status === 'approved'
  const c = confirmationData?.customer;
  const displayTotals = totals || confirmationData?.totals;
  const displayOrderNumber = orderNumber || confirmationData?.orderNumber;
  const address = c ? (() => {
    const parts: string[] = [];
    if (c.customer_street && c.customer_street_number) parts.push(`${c.customer_street} ${c.customer_street_number}`);
    if (c.customer_interior_number) parts.push(`Int. ${c.customer_interior_number}`);
    if (c.customer_colonia) parts.push(c.customer_colonia);
    if (c.customer_delegacion) parts.push(c.customer_delegacion);
    if (c.customer_postal_code) parts.push(`CP ${c.customer_postal_code}`);
    return parts.join(', ');
  })() : '';

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <div className="relative inline-flex items-center justify-center mb-6">
            <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center">
              <CheckCircle className="w-14 h-14 text-green-600" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Pedido Confirmado</h1>
          {emailSent && c && (
            <div className="flex items-center justify-center gap-2 mt-3">
              <Mail className="w-4 h-4 text-blue-600" />
              <p className="text-gray-500 text-base">
                Te hemos enviado una confirmacion a{' '}
                <span className="font-medium text-gray-700">{c.customer_email}</span>
              </p>
            </div>
          )}
          {emailError && (
            <div className="flex items-center justify-center gap-2 mt-3 text-yellow-700">
              <AlertCircle className="w-4 h-4" />
              <p className="text-sm">No pudimos enviar el correo de confirmacion, pero tu pedido esta confirmado.</p>
            </div>
          )}
          {!emailSent && !emailError && c && (
            <p className="text-gray-500 text-sm mt-2">Tu pedido ha sido procesado exitosamente.</p>
          )}
        </div>

        {displayOrderNumber && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 mb-5 text-center">
            <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-1">Numero de Orden</p>
            <p className="text-4xl font-bold text-red-600 tracking-wide">#{displayOrderNumber}</p>
          </div>
        )}

        {confirmationData && confirmationData.selectedWeeks && confirmationData.selectedWeeks.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 mb-5">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400 mb-4 flex items-center gap-2">
              <Calendar className="w-4 h-4" /> Fechas de Entrega
            </h2>
            <div className="space-y-3">
              {confirmationData.selectedWeeks.map((week: any, index: number) => (
                <div key={week.tempId || index} className="flex items-start justify-between py-3 border-b border-gray-100 last:border-0">
                  <div>
                    <p className="text-xs text-gray-400 mb-0.5">Semana {index + 1}</p>
                    <p className="font-semibold text-gray-800">{week.week.week_name}</p>
                  </div>
                  <div className="text-right">
                    {week.week.week_date ? (
                      <p className="text-sm font-bold text-green-700 bg-green-50 px-3 py-1.5 rounded-lg">{formatDate(week.week.week_date)}</p>
                    ) : (
                      <p className="text-sm text-gray-400 italic">Por confirmar</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {c && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 mb-5">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400 mb-4 flex items-center gap-2">
              <MapPin className="w-4 h-4" /> Direccion de Entrega
            </h2>
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <User className="w-4 h-4 text-gray-500" />
              </div>
              <div>
                <p className="font-semibold text-gray-900">{c.customer_name} {c.customer_lastname}</p>
                <p className="text-sm text-gray-500 mt-0.5">{address || 'Direccion registrada en tu cuenta'}</p>
                {c.customer_phone && (
                  <p className="text-sm text-gray-500 mt-1 flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5" /> {c.customer_phone}
                  </p>
                )}
                {confirmationData?.deliveryOptionName && (
                  <p className="text-xs text-gray-400 mt-2 bg-gray-50 inline-block px-2 py-1 rounded">
                    Metodo: {confirmationData.deliveryOptionName}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {displayTotals && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 mb-6">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400 mb-4 flex items-center gap-2">
              <Package className="w-4 h-4" /> Resumen del Pedido
            </h2>
            <div className="space-y-2.5 text-sm">
              <div className="flex justify-between text-gray-600">
                <span>Subtotal</span>
                <span className="font-medium text-gray-800">${Math.round(displayTotals.subtotal).toFixed(0)} MXN</span>
              </div>
              {displayTotals.planDiscount > 0 && (
                <div className="flex justify-between text-green-600">
                  <span>Descuento por volumen</span>
                  <span className="font-medium">-${Math.round(displayTotals.planDiscount).toFixed(0)} MXN</span>
                </div>
              )}
              <div className="flex justify-between text-gray-600">
                <span>Envio{confirmationData?.deliveryOptionName ? ` (${confirmationData.deliveryOptionName})` : ''}</span>
                <span className="font-medium text-gray-800">${Math.round(displayTotals.deliveryPrice).toFixed(0)} MXN</span>
              </div>
              {displayTotals.couponDiscount > 0 && confirmationData?.couponCode && (
                <div className="flex justify-between text-green-600">
                  <span>Cupon {confirmationData.couponCode}</span>
                  <span className="font-medium">-${Math.round(displayTotals.couponDiscount).toFixed(0)} MXN</span>
                </div>
              )}
              <div className="flex justify-between text-gray-600">
                <span>IVA (16%)</span>
                <span className="font-medium text-gray-800">${Math.round(displayTotals.taxAmount).toFixed(0)} MXN</span>
              </div>
              <div className="pt-3 mt-1 border-t border-gray-200 flex justify-between">
                <span className="font-bold text-gray-900 text-base">Total</span>
                <span className="font-bold text-xl text-red-600">${Math.round(displayTotals.finalTotal).toFixed(0)} MXN</span>
              </div>
            </div>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3">
          <Link to="/account?tab=orders" className="flex-1 bg-red-600 hover:bg-red-700 text-white px-6 py-3.5 rounded-xl font-semibold text-sm transition-colors flex items-center justify-center gap-2">
            <Package className="w-4 h-4" /> Ver mis pedidos
          </Link>
          <Link to="/" className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 px-6 py-3.5 rounded-xl font-semibold text-sm transition-colors flex items-center justify-center gap-2">
            <Home className="w-4 h-4" /> Volver al inicio
          </Link>
        </div>
      </div>
    </div>
  );
};
