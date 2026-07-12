import { OrderWeek, OrderWeekWithDetails, PendingOrderItem, SelectedWeek } from './orderWeek';
import { Customer } from './customer';

export interface Order {
  id: string;
  order_id: string;
  order_date: string;
  customer_id: string;
  order_customer_name: string;
  order_customer_email: string;
  order_total_price: number;
  order_invoice_number: string;
  order_status: 'pending' | 'processing' | 'completed' | 'cancelled' | 'delivered';
  order_notes: string | null;
  invoice_group_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrderWithDetails extends Order {
  customer_name?: string;
  customer_email?: string;
  customers?: Customer;
  weeks_count?: number;
  total_weeks?: number;
  week_names?: string[];
  delivery_dates?: string[];
  weeks?: OrderWeekWithDetails[];
  menuItems?: PendingOrderItem[];
  invoice_total_amount?: number | null;
  payment_date?: string | null;
}

export interface CreateOrderData {
  customer_id: string;
  order_customer_name: string;
  order_customer_email: string;
  order_total_price: number;
  order_invoice_number: string;
  order_status?: 'pending' | 'processing' | 'completed' | 'cancelled' | 'delivered';
  order_notes?: string | null;
  invoice_group_id?: string | null;
}

export interface UpdateOrderData {
  customer_id?: string;
  order_customer_name?: string;
  order_customer_email?: string;
  order_total_price?: number;
  order_invoice_number?: string;
  order_status?: 'pending' | 'processing' | 'completed' | 'cancelled' | 'delivered';
  order_notes?: string | null;
}

// Re-export types for convenience
export type { OrderWeek, OrderWeekWithDetails, PendingOrderItem, SelectedWeek };