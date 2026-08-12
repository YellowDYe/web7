import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CircleCheck as CheckCircle, Circle as XCircle, Clock, Loader as Loader2, Package, Chrome as Home, Calendar, MapPin, User, Phone } from 'lucide-react';
import { customerOrderSubmissionService, OrderConfirmationData } from '../services/customerOrderSubmissionService';
import { supabase } from '../../config/supabase';

type PaymentStatus = 'loading' | 'approved' | 'pending' | 'failure';

export const CheckoutReturn: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<PaymentStatus>('loading');
  const [confirmationData, setConfirmationData] = useState<OrderConfirmationData | null>(null);

  const formatDate = (dateString: string) => {
    const [year, month, day] = dateString.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString('es-MX', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    });
  };

  useEffect(() => {
    const handleReturn = async () => {
      const urlStatus = searchParams.get('status') || searchParams.get('collection_status');
      const paymentId = searchParams.get('payment_id') || searchParams.get('collection_id');
      const orderId = searchParams.get('order_id') || searchParams.get('external_reference');

      const stored = localStorage.getItem('mp_pending_order');
      let orderData: OrderConfirmationData | null = null;
      if (stored) {
        try { orderData = JSON.parse(stored); } catch (_) {}
      }

      if (urlStatus === 'approved' || urlStatus === 'success') {
        if (orderData) {
          try {
            await customerOrderSubmissionService.markOrderAsPaid(orderData);
          } catch (err) {
            console.warn('Could not mark order as paid via service:', err);
          }
        }

        if (orderId) {
          await supabase
            .from('orders')
            .update({
              stripe_payment_status: 'succeeded',
              stripe_paid_at: new Date().toISOString(),
              order_status: 'completed',
              mp_payment_id: paymentId || null,
            })
            .eq('id', orderId);
        }

        setConfirmationData(orderData);
        setStatus('approved');
        localStorage.removeItem('mp_pending_order');
      } else if (urlStatus === 'pending' || urlStatus === 'in_process') {
        setConfirmationData(orderData);
        setStatus('pending');
      } else {
        setConfirmationData(orderData);
        setStatus('failure');
      }
    };

    handleReturn();
  }, [searchParams]);

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

  if (status === 'failure') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="max-w-md mx-auto text-center">
          <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <XCircle className="w-12 h-12 text-red-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Pago no completado</h2>
          <p className="text-gray-500 mb-8">
            Tu pago no pudo ser procesado. Puedes intentar de nuevo o elegir otro metodo de pago.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button onClick={() => navigate('/order')} className="bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-xl font-semibold transition-colors">
              Intentar de nuevo
            </button>
            <button onClick={() => navigate('/')} className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-6 py-3 rounded-xl font-semibold transition-colors">
              Volver al inicio
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (status === 'pending') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="max-w-md mx-auto text-center">
          <div className="w-20 h-20 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <Clock className="w-12 h-12 text-yellow-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Pago en proceso</h2>
          <p className="text-gray-500 mb-8">
            Tu pago esta siendo procesado. Te notificaremos cuando se confirme. Si pagaste con OXXO, recuerda completar el pago en la tienda.
          </p>
          {confirmationData && (
            <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6 text-left">
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1">Numero de Orden</p>
              <p className="text-2xl font-bold text-red-600">#{confirmationData.orderNumber}</p>
            </div>
          )}
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button onClick={() => navigate('/account?tab=orders')} className="bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-xl font-semibold transition-colors flex items-center justify-center gap-2">
              <Package className="w-4 h-4" /> Ver mis pedidos
            </button>
            <button onClick={() => navigate('/')} className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-6 py-3 rounded-xl font-semibold transition-colors flex items-center justify-center gap-2">
              <Home className="w-4 h-4" /> Volver al inicio
            </button>
          </div>
        </div>
      </div>
    );
  }

  // status === 'approved'
  const c = confirmationData?.customer;
  const totals = confirmationData?.totals;
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
          <h1 className="text-3xl font-bold text-gray-900 mb-2">!Pedido Confirmado!</h1>
          {c && (
            <p className="text-gray-500 text-base">
              Te hemos enviado una confirmacion a{' '}
              <span className="font-medium text-gray-700">{c.customer_email}</span>
            </p>
          )}
        </div>

        {confirmationData && (
          <>
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 mb-5 text-center">
              <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-1">Numero de Orden</p>
              <p className="text-4xl font-bold text-red-600 tracking-wide">#{confirmationData.orderNumber}</p>
            </div>

            {confirmationData.selectedWeeks.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 mb-5">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400 mb-4 flex items-center gap-2">
                  <Calendar className="w-4 h-4" /> Fechas de Entrega
                </h2>
                <div className="space-y-3">
                  {confirmationData.selectedWeeks.map((week, index) => (
                    <div key={week.tempId} className="flex items-start justify-between py-3 border-b border-gray-100 last:border-0">
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
                    <p className="text-xs text-gray-400 mt-2 bg-gray-50 inline-block px-2 py-1 rounded">
                      Metodo: {confirmationData.deliveryOptionName}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {totals && (
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 mb-6">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400 mb-4 flex items-center gap-2">
                  <Package className="w-4 h-4" /> Resumen del Pedido
                </h2>
                <div className="space-y-2.5 text-sm">
                  <div className="flex justify-between text-gray-600">
                    <span>Subtotal</span>
                    <span className="font-medium text-gray-800">${Math.round(totals.subtotal).toFixed(0)} MXN</span>
                  </div>
                  {totals.planDiscount > 0 && (
                    <div className="flex justify-between text-green-600">
                      <span>Descuento por volumen</span>
                      <span className="font-medium">-${Math.round(totals.planDiscount).toFixed(0)} MXN</span>
                    </div>
                  )}
                  <div className="flex justify-between text-gray-600">
                    <span>Envio ({confirmationData.deliveryOptionName})</span>
                    <span className="font-medium text-gray-800">${Math.round(totals.deliveryPrice).toFixed(0)} MXN</span>
                  </div>
                  {totals.couponDiscount > 0 && confirmationData.couponCode && (
                    <div className="flex justify-between text-green-600">
                      <span>Cupon {confirmationData.couponCode}</span>
                      <span className="font-medium">-${Math.round(totals.couponDiscount).toFixed(0)} MXN</span>
                    </div>
                  )}
                  <div className="flex justify-between text-gray-600">
                    <span>IVA (16%)</span>
                    <span className="font-medium text-gray-800">${Math.round(totals.taxAmount).toFixed(0)} MXN</span>
                  </div>
                  <div className="pt-3 mt-1 border-t border-gray-200 flex justify-between">
                    <span className="font-bold text-gray-900 text-base">Total</span>
                    <span className="font-bold text-xl text-red-600">${Math.round(totals.finalTotal).toFixed(0)} MXN</span>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        <div className="flex flex-col sm:flex-row gap-3">
          <button onClick={() => navigate('/account?tab=orders')} className="flex-1 bg-red-600 hover:bg-red-700 text-white px-6 py-3.5 rounded-xl font-semibold text-sm transition-colors flex items-center justify-center gap-2">
            <Package className="w-4 h-4" /> Ver mis pedidos
          </button>
          <button onClick={() => navigate('/')} className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 px-6 py-3.5 rounded-xl font-semibold text-sm transition-colors flex items-center justify-center gap-2">
            <Home className="w-4 h-4" /> Volver al inicio
          </button>
        </div>
      </div>
    </div>
  );
};
