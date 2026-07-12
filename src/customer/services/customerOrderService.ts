import { supabase } from '../../config/supabase';
import { OrderWithDetails } from '../../types/order';
import { Invoice } from '../../types/invoice';

export interface CustomerOrder {
  id: string;
  order_id: string;
  customer_id: string;
  order_date: string;
  order_status: string;
  order_total_price: number;
  order_invoice_number: string;
  week_count: number;
  week_names: string[];
  delivery_dates: string[];
  invoice_total_amount: number | null;
  payment_date: string | null;
  created_at: string;
}

export interface OrderDetails extends CustomerOrder {
  weeks: Array<{
    id: string;
    week_id: string;
    week_name: string;
    week_start: string;
    week_end: string;
    recipes: Array<{
      meal_type: string;
      recipe_id: string;
      recipe_name: string;
    }>;
  }>;
}

export async function getCustomerOrders(customerId: string): Promise<CustomerOrder[]> {
  try {
    console.log('[CustomerOrders] Fetching orders for customer UUID:', customerId);

    // First, get the customer's text customer_id from their UUID
    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .select('customer_id')
      .eq('id', customerId)
      .maybeSingle();

    if (customerError) {
      console.error('[CustomerOrders] Error fetching customer:', customerError);
      throw customerError;
    }

    if (!customer) {
      console.warn('[CustomerOrders] Customer not found for UUID:', customerId);
      return [];
    }

    console.log('[CustomerOrders] Customer ID:', customer.customer_id);

    // Get orders for this customer using their text customer_id
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select('*')
      .eq('customer_id', customer.customer_id)
      .order('created_at', { ascending: false });

    if (ordersError) {
      console.error('[CustomerOrders] Error fetching orders:', ordersError);
      throw ordersError;
    }

    console.log('[CustomerOrders] Found orders:', orders?.length || 0);
    if (!orders) return [];

    // Fetch order weeks for all orders
    const orderIds = orders.map(order => order.order_id);
    console.log('[CustomerOrders] Fetching weeks for order IDs:', orderIds);

    const { data: allOrderWeeks, error: weeksError } = await supabase
      .from('order_weeks')
      .select(`
        *,
        weeks(
          week_name
        ),
        meal_plans(
          meal_plans_id,
          meal_plans_name,
          meal_plans_price
        )
      `)
      .in('order_id', orderIds);

    if (weeksError) {
      console.error('[CustomerOrders] Error fetching weeks:', weeksError);
      throw weeksError;
    }
    console.log('[CustomerOrders] Found order weeks:', allOrderWeeks?.length || 0);

    // Fetch invoices for all orders
    const { data: allInvoices, error: invoicesError } = await supabase
      .from('invoices')
      .select('order_id, total_amount, payment_date')
      .in('order_id', orderIds);

    if (invoicesError) {
      console.warn('[CustomerOrders] Error fetching invoices:', invoicesError);
    }
    console.log('[CustomerOrders] Found invoices:', allInvoices?.length || 0);

    // Group weeks by order_id
    const weeksByOrder = (allOrderWeeks || []).reduce((acc, week) => {
      if (!acc[week.order_id]) acc[week.order_id] = [];
      acc[week.order_id].push(week);
      return acc;
    }, {} as Record<string, any[]>);

    // Group invoices by order_id
    const invoicesByOrder = (allInvoices || []).reduce((acc, invoice) => {
      acc[invoice.order_id] = {
        total_amount: invoice.total_amount,
        payment_date: invoice.payment_date
      };
      return acc;
    }, {} as Record<string, { total_amount: number; payment_date: string | null }>);

    // Add weeks data and invoice total to each order
    const result = orders.map(order => ({
      id: order.id,
      order_id: order.order_id,
      customer_id: order.customer_id,
      order_date: order.order_date,
      order_status: order.order_status,
      order_total_price: order.order_total_price,
      order_invoice_number: order.order_invoice_number,
      weeks_count: weeksByOrder[order.order_id]?.length || 0,
      week_count: weeksByOrder[order.order_id]?.length || 0,
      week_names: weeksByOrder[order.order_id]?.map(w => w.weeks.week_name) || [],
      delivery_dates: weeksByOrder[order.order_id]?.map(w => w.delivery_date).filter(Boolean) || [],
      invoice_total_amount: invoicesByOrder[order.order_id]?.total_amount || null,
      payment_date: invoicesByOrder[order.order_id]?.payment_date || null,
      created_at: order.created_at
    }));

    console.log('[CustomerOrders] Returning', result.length, 'processed orders');
    return result;
  } catch (error) {
    console.error('[CustomerOrders] Error fetching customer orders:', error);
    throw error;
  }
}

// Get order details with full information
export async function getOrderDetails(orderId: string): Promise<OrderWithDetails | null> {
  try {
    // Use the admin order service to get full order details
    const { orderService } = await import('../../services/orderService');
    const orderDetails = await orderService.getOrderWithDetails(orderId);
    return orderDetails;
  } catch (error) {
    console.error('Error fetching order details:', error);
    throw error;
  }
}

// Check if a customer has placed any orders (first-order detection)
export async function isCustomerFirstOrder(customerId: string): Promise<boolean> {
  try {
    const { data: customer } = await supabase
      .from('customers')
      .select('customer_id')
      .eq('id', customerId)
      .maybeSingle();

    if (!customer) return true;

    const { count, error } = await supabase
      .from('orders')
      .select('order_id', { count: 'exact', head: true })
      .eq('customer_id', customer.customer_id);

    if (error) return false;

    return (count ?? 0) === 0;
  } catch {
    return false;
  }
}

// Get invoice for an order
export async function getInvoiceByOrderId(orderId: string): Promise<Invoice | null> {
  try {
    const { data: invoice, error } = await supabase
      .from('invoices')
      .select('*')
      .eq('order_id', orderId)
      .maybeSingle();

    if (error) throw error;
    return invoice;
  } catch (error) {
    console.error('Error fetching invoice:', error);
    throw error;
  }
}
