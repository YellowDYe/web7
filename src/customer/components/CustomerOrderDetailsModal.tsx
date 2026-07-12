import React, { useState, useEffect } from 'react';
import { X, Calendar, User, Mail, UtensilsCrossed, Loader2, AlertCircle } from 'lucide-react';
import { OrderWithDetails } from '../../types/order';
import { getOrderDetails } from '../services/customerOrderService';
import { Card } from './ui/card';
import { Button } from './ui/button';

interface CustomerOrderDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderId: string;
}

export function CustomerOrderDetailsModal({
  isOpen,
  onClose,
  orderId
}: CustomerOrderDetailsModalProps) {
  const [orderDetails, setOrderDetails] = useState<OrderWithDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && orderId) {
      loadOrderDetails();
    }
  }, [isOpen, orderId]);

  const loadOrderDetails = async () => {
    try {
      setLoading(true);
      setError(null);
      const details = await getOrderDetails(orderId);
      if (details) {
        setOrderDetails(details);
      }
    } catch (err) {
      console.error('Error loading order details:', err);
      setError('Error al cargar los detalles del pedido');
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
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'processing':
        return 'bg-blue-100 text-blue-800';
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'delivered':
        return 'bg-green-100 text-green-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'pending':
        return 'Pendiente';
      case 'processing':
        return 'Procesando';
      case 'completed':
        return 'Completado';
      case 'delivered':
        return 'Entregado';
      case 'cancelled':
        return 'Cancelado';
      default:
        return status;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="bg-red-100 p-2 rounded-lg">
              <UtensilsCrossed className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                Detalles del Pedido
              </h2>
              {orderDetails && (
                <p className="text-sm text-gray-600">
                  {orderDetails.order_id} • {formatDate(orderDetails.created_at)}
                </p>
              )}
            </div>
          </div>
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
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-red-600" />
              <span className="ml-2 text-gray-600">Cargando detalles...</span>
            </div>
          ) : error ? (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-center space-x-2">
              <AlertCircle className="w-5 h-5" />
              <span>{error}</span>
            </div>
          ) : orderDetails ? (
            <div className="space-y-6">
              {/* Order Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Basic Info */}
                <Card className="p-4">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    Información del Pedido
                  </h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">ID:</span>
                      <span className="font-medium text-gray-900">{orderDetails.order_id}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Fecha:</span>
                      <span className="font-medium text-gray-900">{formatDate(orderDetails.order_date)}</span>
                    </div>
                    {orderDetails.payment_date && orderDetails.order_status === 'completed' && (
                      <div className="flex items-center justify-between">
                        <span className="text-gray-600">Fecha de Pago:</span>
                        <span className="font-medium text-green-600">{formatDate(orderDetails.payment_date)}</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Estado:</span>
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(orderDetails.order_status)}`}>
                        {getStatusLabel(orderDetails.order_status)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Total:</span>
                      <span className="font-semibold text-gray-900 text-lg">
                        {formatCurrency(orderDetails.order_total_price)}
                      </span>
                    </div>
                    {orderDetails.order_invoice_number && (
                      <div className="flex items-center justify-between">
                        <span className="text-gray-600">Factura:</span>
                        <span className="font-medium text-gray-900">{orderDetails.order_invoice_number}</span>
                      </div>
                    )}
                  </div>
                </Card>

                {/* Customer Info */}
                <Card className="p-4">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    Información del Cliente
                  </h3>
                  <div className="space-y-3">
                    <div className="flex items-center space-x-2">
                      <User className="w-4 h-4 text-gray-500" />
                      <span className="font-medium text-gray-900">{orderDetails.order_customer_name}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Mail className="w-4 h-4 text-gray-500" />
                      <span className="text-gray-600">{orderDetails.order_customer_email}</span>
                    </div>
                  </div>
                </Card>
              </div>

              {/* Order Notes */}
              {orderDetails.order_notes && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    Notas del Pedido
                  </h3>
                  <Card className="p-4">
                    <p className="text-gray-900 whitespace-pre-wrap">
                      {orderDetails.order_notes}
                    </p>
                  </Card>
                </div>
              )}

              {/* Weeks */}
              {orderDetails.weeks && orderDetails.weeks.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    Semanas del Pedido ({orderDetails.weeks.length})
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {orderDetails.weeks.map((orderWeek, index) => (
                      <Card key={orderWeek.order_week_id || index} className="p-4">
                        <div className="flex items-center space-x-3 mb-2">
                          <Calendar className="w-4 h-4 text-red-600" />
                          <span className="font-medium text-gray-900">
                            Semana {index + 1}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600">
                          {orderWeek.weeks?.week_name || 'Nombre de semana no disponible'}
                        </p>
                        {orderWeek.delivery_date && (
                          <p className="text-xs text-gray-500 mt-1">
                            Entrega: {formatDate(orderWeek.delivery_date)}
                          </p>
                        )}
                        {orderWeek.meal_plans && (
                          <p className="text-sm text-gray-700 mt-2 font-medium">
                            {orderWeek.meal_plans.meal_plans_name}
                          </p>
                        )}
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              {/* Menu Items */}
              {orderDetails.menuItems && orderDetails.menuItems.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    Elementos del Menú ({orderDetails.menuItems.length})
                  </h3>
                  <div className="space-y-6">
                    {(() => {
                      // Group menu items by week
                      const itemsByWeek = orderDetails.menuItems.reduce((acc, item) => {
                        const weekName = item.week_name || 'Semana desconocida';
                        if (!acc[weekName]) {
                          acc[weekName] = [];
                        }
                        acc[weekName].push(item);
                        return acc;
                      }, {} as Record<string, any[]>);

                      return Object.entries(itemsByWeek).map(([weekName, items]) => (
                        <Card key={weekName} className="p-4">
                          <div className="flex items-center space-x-2 mb-3">
                            <Calendar className="w-4 h-4 text-red-600" />
                            <h4 className="font-semibold text-gray-900">{weekName}</h4>
                            <span className="text-xs text-gray-500">
                              ({items.length} elemento{items.length !== 1 ? 's' : ''})
                            </span>
                          </div>

                          <div className="space-y-2">
                            {items.map((item, idx) => (
                              <div key={idx} className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg">
                                <div className="flex items-center space-x-3 flex-1 min-w-0">
                                  <span className="font-medium text-gray-900 truncate">
                                    {item.meal_plans_name || 'Plan no encontrado'}
                                  </span>
                                  <span className={`truncate ${item.recipe_name ? 'text-gray-600' : 'text-gray-400 italic'}`}>
                                    {item.recipe_name || 'Sin receta'}
                                  </span>
                                  <span className="text-xs text-gray-500 whitespace-nowrap">
                                    {item.meal_type}
                                  </span>
                                  <span className="text-xs text-gray-500 whitespace-nowrap">
                                    {item.day_of_week}
                                  </span>
                                  <span className="text-sm text-gray-700 font-medium whitespace-nowrap">
                                    x{item.quantity}
                                  </span>
                                </div>
                                {item.meal_plan_price && (
                                  <span className="font-semibold text-gray-900 whitespace-nowrap">
                                    {formatCurrency(item.meal_plan_price * item.quantity)}
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        </Card>
                      ));
                    })()}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-600">No se pudieron cargar los detalles del pedido</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
