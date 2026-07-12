import React, { useState, useEffect } from 'react';
import { X, FileText, Calendar, User, Mail, Calculator, Loader2, AlertCircle, UtensilsCrossed } from 'lucide-react';
import { Invoice } from '../../types/invoice';
import { OrderWithDetails } from '../../types/order';
import { getInvoiceByOrderId, getOrderDetails } from '../services/customerOrderService';
import { Card } from './ui/card';
import { Button } from './ui/button';

interface CustomerInvoiceDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderId: string;
}

const BILLABLE_MEAL_TYPES = ['Desayuno', 'Comida', 'Cena'] as const;

export function CustomerInvoiceDetailsModal({
  isOpen,
  onClose,
  orderId
}: CustomerInvoiceDetailsModalProps) {
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [order, setOrder] = useState<OrderWithDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && orderId) {
      loadInvoiceAndOrder();
    }
  }, [isOpen, orderId]);

  const loadInvoiceAndOrder = async () => {
    try {
      setLoading(true);
      setError(null);

      const [invoiceData, orderData] = await Promise.all([
        getInvoiceByOrderId(orderId),
        getOrderDetails(orderId)
      ]);

      setInvoice(invoiceData);
      setOrder(orderData);
    } catch (err) {
      console.error('Error loading invoice and order:', err);
      setError('Error al cargar la factura');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(Math.round(amount));
  };

  const formatDate = (dateString: string) => {
    const [year, month, day] = dateString.split('T')[0].split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    return date.toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft':
        return 'bg-gray-100 text-gray-800';
      case 'paid':
        return 'bg-green-100 text-green-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'draft':
        return 'Borrador';
      case 'paid':
        return 'Pagada';
      case 'cancelled':
        return 'Cancelada';
      default:
        return status;
    }
  };

  const generateLineItemsFromOrder = () => {
    if (!order || !order.menuItems || order.menuItems.length === 0) return [];

    const weekNameMap: Record<string, string> = {};
    if (order.weeks) {
      order.weeks.forEach((orderWeek: any) => {
        if (orderWeek.order_week_id && orderWeek.weeks && orderWeek.weeks.week_name) {
          weekNameMap[orderWeek.order_week_id] = orderWeek.weeks.week_name;
        }
      });
    }

    const grouped = order.menuItems
      .filter(item => BILLABLE_MEAL_TYPES.includes(item.meal_type as any))
      .reduce((groups, item) => {
        const weekName = item.week_name || weekNameMap[item.order_week_id] || 'Semana desconocida';
        const key = `${weekName}_${item.meal_plans_id}`;
        if (!groups[key]) {
          groups[key] = {
            week_name: weekName,
            plan_name: item.meal_plans_name,
            total_dishes: 0,
            subtotal: 0
          };
        }
        groups[key].total_dishes += item.quantity;
        groups[key].subtotal += (item.meal_plan_price || 0) * item.quantity;
        return groups;
      }, {} as Record<string, any>);

    return Object.values(grouped);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900">
            Ticket de Venta
          </h2>
          <Button
            onClick={onClose}
            variant="ghost"
            size="sm"
            className="p-2 hover:bg-gray-100 rounded-full"
            aria-label="Cerrar modal"
          >
            <X className="w-5 h-5 text-gray-500" />
          </Button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Company Header */}
          <div className="flex items-center space-x-3 mb-8 pb-6 border-b border-gray-200">
            <img
              src="/logo-hd-rojo.gif"
              alt="Hola Dieta Logo"
              className="h-12 w-auto"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
                const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                if (fallback) fallback.style.display = 'flex';
              }}
            />
            <div className="w-12 h-12 bg-red-600 rounded-lg items-center justify-center hidden">
              <span className="text-white font-bold text-xl">HD</span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900">
              Hola Dieta
            </h1>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-red-600" />
              <span className="ml-2 text-gray-600">Cargando factura...</span>
            </div>
          ) : error ? (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-center space-x-2">
              <AlertCircle className="w-5 h-5" />
              <span>{error}</span>
            </div>
          ) : !invoice ? (
            <div className="text-center py-12">
              <div className="bg-gray-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <FileText className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                No se encontró factura
              </h3>
              <p className="text-gray-600">
                No hay una factura generada para este pedido
              </p>
            </div>
          ) : (
            <div>
              {/* Invoice Header */}
              <div className="mb-8">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
                  <div>
                    <h3 className="text-2xl font-bold text-gray-900 mb-2">
                      TICKET DE VENTA
                    </h3>
                    <div className="space-y-1">
                      <p className="text-lg font-bold text-gray-900">
                        Número: {invoice.invoice_number}
                      </p>
                      <p className="text-lg font-bold text-gray-900">
                        Fecha: {formatDate(invoice.invoice_date)}
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <Card className="bg-red-100 p-4">
                      <p className="text-sm text-red-600 font-medium mb-1">Total</p>
                      <p className="text-3xl font-bold text-red-900">
                        {formatCurrency(invoice.total_amount)}
                      </p>
                    </Card>
                  </div>
                </div>
              </div>

              {/* Customer Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <Card className="p-4">
                  <h4 className="text-lg font-semibold text-gray-900 mb-4">
                    Información del Cliente
                  </h4>
                  <div className="space-y-3">
                    <div className="flex items-center space-x-2">
                      <User className="w-4 h-4 text-gray-500" />
                      <span className="font-medium text-gray-900">{invoice.customer_name}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Mail className="w-4 h-4 text-gray-500" />
                      <span className="text-gray-600">{invoice.customer_email}</span>
                    </div>
                  </div>
                </Card>

                {order && (
                  <Card className="p-4">
                    <h4 className="text-lg font-semibold text-gray-900 mb-4">
                      Información del Pedido
                    </h4>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-gray-600">ID del Pedido:</span>
                        <span className="font-medium text-gray-900">{order.order_id}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-600">Fecha del Pedido:</span>
                        <span className="font-medium text-gray-900">{formatDate(order.order_date)}</span>
                      </div>
                    </div>
                  </Card>
                )}
              </div>

              {/* Detailed Line Items */}
              <Card className="p-6 mb-6">
                <h4 className="text-lg font-semibold text-gray-900 mb-4">
                  Resumen de Platillos por Semana y Plan
                </h4>

                <div className="space-y-3">
                  {generateLineItemsFromOrder().map((item, index) => (
                    <div key={index} className="flex items-center justify-between py-2 border-b border-gray-200">
                      <div className="flex items-center space-x-3">
                        <div className="bg-red-100 p-2 rounded-lg flex-shrink-0">
                          <UtensilsCrossed className="w-4 h-4 text-red-600" />
                        </div>
                        <span className="text-gray-900 font-medium">
                          {item.week_name}, {item.plan_name}, {item.total_dishes} platillo{item.total_dishes !== 1 ? 's' : ''}
                        </span>
                      </div>
                      <span className="font-medium text-gray-900">
                        {formatCurrency(item.subtotal)}
                      </span>
                    </div>
                  ))}

                  {/* Subtotal before discounts */}
                  <div className="flex items-center justify-between py-2 font-semibold border-t border-gray-300 mt-2">
                    <span className="text-gray-900">Subtotal (Comidas):</span>
                    <span className="text-gray-900">
                      {formatCurrency(generateLineItemsFromOrder().reduce((total, item) => total + item.subtotal, 0))}
                    </span>
                  </div>

                  {/* Show plan discount if present */}
                  {invoice.plan_discount_amount > 0 && (
                    <div className="flex items-center justify-between py-2 text-sm">
                      <div className="flex items-center space-x-2">
                        <div className="bg-green-100 p-1 rounded-lg flex-shrink-0">
                          <span className="text-green-600 text-xs">%</span>
                        </div>
                        <span className="text-green-800">
                          Descuento del Plan
                        </span>
                      </div>
                      <span className="font-medium text-green-900">
                        -{formatCurrency(invoice.plan_discount_amount)}
                      </span>
                    </div>
                  )}

                  {/* Show custom discount if present */}
                  {invoice.custom_discount_amount > 0 && (
                    <div className="flex items-center justify-between py-2 text-sm">
                      <div className="flex items-center space-x-2">
                        <div className="bg-yellow-100 p-1 rounded-lg flex-shrink-0">
                          <span className="text-yellow-600 text-xs">$</span>
                        </div>
                        <span className="text-yellow-800">
                          Descuento Personalizado
                        </span>
                      </div>
                      <span className="font-medium text-yellow-900">
                        -{formatCurrency(invoice.custom_discount_amount)}
                      </span>
                    </div>
                  )}

                  {/* Subtotal after discounts */}
                  {(invoice.plan_discount_amount > 0 || invoice.custom_discount_amount > 0) && (
                    <div className="flex items-center justify-between py-2 font-semibold border-t border-gray-300 mt-2">
                      <span className="text-gray-900">Subtotal después de descuentos:</span>
                      <span className="text-gray-900">
                        {formatCurrency(invoice.subtotal)}
                      </span>
                    </div>
                  )}
                </div>
              </Card>

              {/* Financial Breakdown */}
              <Card className="p-6 mb-6">
                <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <Calculator className="w-5 h-5 mr-2" />
                  Detalle Financiero
                </h4>

                <div className="space-y-3">
                  {/* Subtotal */}
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Subtotal Comidas (después de descuentos):</span>
                    <span className="font-medium text-gray-900">
                      {formatCurrency(invoice.subtotal)}
                    </span>
                  </div>

                  {/* Tax Items */}
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">IVA Platillos (16%):</span>
                    <span className="font-medium text-gray-900">
                      {formatCurrency(invoice.tax_amount)}
                    </span>
                  </div>

                  {/* Delivery Fee */}
                  {invoice.delivery_option_price > 0 && (
                    <>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-600">Envío:</span>
                        <span className="font-medium text-gray-900">
                          {formatCurrency(invoice.delivery_option_price)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-600">IVA envío (16%):</span>
                        <span className="font-medium text-gray-900">
                          {formatCurrency(invoice.delivery_tax_amount || 0)}
                        </span>
                      </div>
                    </>
                  )}

                  {/* Total Line */}
                  <div className="pt-3 border-t border-gray-300">
                    <div className="flex items-center justify-between">
                      <span className="text-xl font-semibold text-gray-900">
                        Total:
                      </span>
                      <span className="text-xl font-bold text-gray-900">
                        {formatCurrency(invoice.total_amount)}
                      </span>
                    </div>
                  </div>
                </div>
              </Card>

              {/* Footer */}
              <div className="text-center text-xs text-gray-500 pt-4 border-t border-gray-200">
                <p>Ticket generado automáticamente por el sistema Hola Dieta</p>
                <p>Fecha de generación: {formatDate(invoice.created_at)}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
