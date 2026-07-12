import { useEffect, useState } from 'react';
import { Package, Calendar, DollarSign, Eye, FileText, AlertCircle } from 'lucide-react';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { getCustomerOrders, type CustomerOrder } from '../services/customerOrderService';
import { CustomerOrderDetailsModal } from './CustomerOrderDetailsModal';
import { CustomerInvoiceDetailsModal } from './CustomerInvoiceDetailsModal';

interface OrderHistoryProps {
  customerId: string;
}

export function OrderHistory({ customerId }: OrderHistoryProps) {
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [showOrderDetailsModal, setShowOrderDetailsModal] = useState(false);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);

  useEffect(() => {
    loadOrders();
  }, [customerId]);

  const loadOrders = async () => {
    try {
      setLoading(true);
      setError('');
      console.log('[OrderHistory] Loading orders for customer ID:', customerId);
      const data = await getCustomerOrders(customerId);
      console.log('[OrderHistory] Loaded orders:', data.length);
      setOrders(data);
    } catch (err) {
      console.error('[OrderHistory] Error loading orders:', err);
      setError('Error al cargar el historial de pedidos. Por favor, intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'completed':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'delivered':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'processing':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'cancelled':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status.toLowerCase()) {
      case 'completed':
        return 'Completado';
      case 'delivered':
        return 'Entregado';
      case 'pending':
        return 'Pendiente';
      case 'processing':
        return 'Procesando';
      case 'cancelled':
        return 'Cancelado';
      default:
        return status;
    }
  };

  const formatDate = (dateString: string) => {
    const [year, month, day] = dateString.split('T')[0].split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    return date.toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(Math.round(amount));
  };

  const handleViewOrderDetails = (orderId: string) => {
    setSelectedOrderId(orderId);
    setShowOrderDetailsModal(true);
  };

  const handleViewInvoice = (orderId: string) => {
    setSelectedOrderId(orderId);
    setShowInvoiceModal(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <div className="flex items-center gap-3 mb-4">
          <AlertCircle className="h-6 w-6 text-red-600" />
          <div>
            <h3 className="text-lg font-semibold text-red-900">Error al cargar pedidos</h3>
            <p className="text-red-700 text-sm">{error}</p>
          </div>
        </div>
        <Button
          onClick={loadOrders}
          variant="outline"
          className="border-red-300 text-red-700 hover:bg-red-100"
        >
          Reintentar
        </Button>
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <Card className="p-8 text-center">
        <Package className="h-16 w-16 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">Aún no tienes pedidos</h3>
        <p className="text-gray-600">
          Tu historial de pedidos aparecerá aquí una vez que realices tu primera orden.
        </p>
      </Card>
    );
  }

  return (
    <>
      <div className="space-y-4">
        {orders.map((order) => (
          <Card key={order.id} className="p-6 hover:shadow-lg transition-shadow">
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="text-lg font-semibold text-gray-900">
                    Pedido {order.order_id}
                  </h3>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(
                      order.order_status
                    )}`}
                  >
                    {getStatusLabel(order.order_status)}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-sm text-gray-600">
                  <div className="flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    <span>{formatDate(order.order_date)}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Package className="h-4 w-4" />
                    <span>{order.week_count} semana{order.week_count !== 1 ? 's' : ''}</span>
                  </div>
                </div>
                {order.week_names && order.week_names.length > 0 && (
                  <div className="mt-2">
                    <p className="text-xs text-gray-500">
                      {order.week_names.join(', ')}
                    </p>
                  </div>
                )}
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-gray-900">
                  {formatCurrency(order.invoice_total_amount || order.order_total_price)}
                </div>
                {order.payment_date && order.order_status === 'completed' && (
                  <p className="text-xs text-green-600 mt-1">
                    Pagado: {formatDate(order.payment_date)}
                  </p>
                )}
              </div>
            </div>

            <div className="mt-4 pt-4 border-t flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleViewOrderDetails(order.id)}
                className="flex-1 sm:flex-none"
              >
                <Eye className="h-4 w-4 mr-2" />
                Ver Detalles
              </Button>
              {order.order_invoice_number && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleViewInvoice(order.order_id)}
                  className="flex-1 sm:flex-none"
                >
                  <FileText className="h-4 w-4 mr-2" />
                  Ver Factura
                </Button>
              )}
            </div>
          </Card>
        ))}
      </div>

      {/* Order Details Modal */}
      {selectedOrderId && (
        <CustomerOrderDetailsModal
          isOpen={showOrderDetailsModal}
          onClose={() => {
            setShowOrderDetailsModal(false);
            setSelectedOrderId(null);
          }}
          orderId={selectedOrderId}
        />
      )}

      {/* Invoice Modal */}
      {selectedOrderId && (
        <CustomerInvoiceDetailsModal
          isOpen={showInvoiceModal}
          onClose={() => {
            setShowInvoiceModal(false);
            setSelectedOrderId(null);
          }}
          orderId={selectedOrderId}
        />
      )}
    </>
  );
}
