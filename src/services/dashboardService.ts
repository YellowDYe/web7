import { supabase } from '../config/supabase';

export type DashboardRange = 'today' | '7d' | '30d';

export interface DashboardMetrics {
  newCustomers: number;
  activeCustomers: number;
  newOrders: number;
  abandonedCarts: number;
}

export interface RecentSignup {
  id: string;
  name: string;
  email: string;
  createdAt: string;
}

export interface RecentOrder {
  orderId: string;
  customerId: string | null;
  status: string | null;
  createdAt: string;
}

export interface DashboardData {
  metrics: DashboardMetrics;
  recentSignups: RecentSignup[];
  recentOrders: RecentOrder[];
}

const ABANDONED_AFTER_HOURS = 6;

function rangeStartIso(range: DashboardRange): string {
  const now = new Date();
  if (range === 'today') {
    now.setHours(0, 0, 0, 0);
    return now.toISOString();
  }
  const days = range === '7d' ? 7 : 30;
  now.setDate(now.getDate() - days);
  return now.toISOString();
}

class DashboardService {
  async getDashboardData(range: DashboardRange): Promise<DashboardData> {
    const fromIso = rangeStartIso(range);
    const abandonedBefore = new Date(Date.now() - ABANDONED_AFTER_HOURS * 60 * 60 * 1000).toISOString();

    const [
      newCustomersRes,
      newOrdersRes,
      activeOrdersRes,
      abandonedRes,
      recentSignupsRes,
      recentOrdersRes,
    ] = await Promise.all([
      supabase
        .from('customers')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', fromIso),
      supabase
        .from('orders')
        .select('order_id', { count: 'exact', head: true })
        .gte('created_at', fromIso),
      supabase
        .from('orders')
        .select('customer_id')
        .gte('created_at', fromIso),
      supabase
        .from('customer_carts')
        .select('auth_user_id', { count: 'exact', head: true })
        .gt('item_count', 0)
        .lt('updated_at', abandonedBefore),
      supabase
        .from('customers')
        .select('id, customer_name, customer_email, created_at')
        .order('created_at', { ascending: false })
        .limit(5),
      supabase
        .from('orders')
        .select('order_id, customer_id, order_status, created_at')
        .order('created_at', { ascending: false })
        .limit(5),
    ]);

    const activeCustomers = new Set(
      (activeOrdersRes.data ?? [])
        .map((r: { customer_id: string | null }) => r.customer_id)
        .filter((id): id is string => !!id)
    ).size;

    const recentSignups: RecentSignup[] = (recentSignupsRes.data ?? []).map((c: any) => ({
      id: c.id,
      name: [c.customer_name].filter(Boolean).join(' ').trim() || 'Sin nombre',
      email: c.customer_email || '',
      createdAt: c.created_at,
    }));

    const recentOrders: RecentOrder[] = (recentOrdersRes.data ?? []).map((o: any) => ({
      orderId: o.order_id,
      customerId: o.customer_id ?? null,
      status: o.order_status ?? null,
      createdAt: o.created_at,
    }));

    return {
      metrics: {
        newCustomers: newCustomersRes.count ?? 0,
        activeCustomers,
        newOrders: newOrdersRes.count ?? 0,
        abandonedCarts: abandonedRes.count ?? 0,
      },
      recentSignups,
      recentOrders,
    };
  }
}

export const dashboardService = new DashboardService();
