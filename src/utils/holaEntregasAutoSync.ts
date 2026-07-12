import { supabase } from '../config/supabase';
import { deliveryTrackingService, SubmissionResult } from '../services/deliveryTrackingService';
import { DeliveryOrder } from '../types/delivery';

export interface SyncDateResult {
  date: string;
  orderId: string;
  weekId: string;
  familyMemberId?: string | null;
  success: boolean;
  error?: string;
  action?: 'created' | 'updated' | 'deleted';
}

export interface AutoSyncResult {
  skipped: boolean;
  results: SyncDateResult[];
}

interface DeliveryInstance {
  date: string;
  weekId: string;
  familyMemberId: string | null;
}

async function fetchDeliveryOrder(orderId: string): Promise<DeliveryOrder | null> {
  const { data, error } = await supabase
    .from('orders')
    .select(`
      order_id,
      order_customer_name,
      order_customer_email,
      customers (
        customer_phone,
        country_code,
        customer_street,
        customer_street_number,
        customer_interior_number,
        customer_colonia,
        customer_delegacion,
        customer_postal_code,
        customer_delivery_instructions
      )
    `)
    .eq('order_id', orderId)
    .maybeSingle();

  if (error || !data) return null;

  const customer = data.customers as any;

  const countryCode = (customer?.country_code || '52').replace('+', '');
  const rawPhone = customer?.customer_phone || '';
  const formattedPhone = rawPhone ? `${countryCode}${rawPhone.replace(/\D/g, '')}` : '';

  return {
    id: orderId,
    order_id: data.order_id,
    order_date: '',
    customer_id: '',
    order_customer_name: data.order_customer_name,
    order_customer_email: data.order_customer_email || '',
    customer_phone: formattedPhone,
    customer_street: customer?.customer_street || '',
    customer_street_number: customer?.customer_street_number || '',
    customer_interior_number: customer?.customer_interior_number || '',
    customer_colonia: customer?.customer_colonia || '',
    customer_delegacion: customer?.customer_delegacion || '',
    customer_postal_code: customer?.customer_postal_code || '',
    customer_delivery_instructions: customer?.customer_delivery_instructions || '',
    order_total_price: 0,
    order_status: 'pending' as const,
    weeks_count: 0,
    delivery_date: null,
    driver_id: null,
    driver_name: null,
    created_at: '',
    route_sequence: null,
  };
}

async function getDeliveryInstances(orderId: string, weekDeliveryDates: Record<string, string>): Promise<DeliveryInstance[]> {
  const { data: orderWeeks } = await supabase
    .from('order_weeks')
    .select('week_id, family_member_id')
    .eq('order_id', orderId);

  const instances: DeliveryInstance[] = [];
  const seen = new Set<string>();

  if (!orderWeeks || orderWeeks.length === 0) {
    return instances;
  }

  for (const ow of orderWeeks) {
    const date = weekDeliveryDates[ow.week_id];
    if (!date) continue;

    const key = `${ow.week_id}_${ow.family_member_id || ''}`;
    if (seen.has(key)) continue;
    seen.add(key);

    instances.push({
      date,
      weekId: ow.week_id,
      familyMemberId: ow.family_member_id || null,
    });
  }

  return instances;
}

async function getExistingSubmissions(orderId: string): Promise<{ delivery_order_id: string; tracking_order_id: string | null }[]> {
  const { data } = await supabase
    .from('delivery_tracking_submissions')
    .select('delivery_order_id, tracking_order_id')
    .eq('order_id', orderId)
    .eq('submission_status', 'success')
    .not('delivery_order_id', 'is', null);

  return data || [];
}

export async function syncOrderToHolaEntregas(
  orderId: string,
  weekDeliveryDates: Record<string, string>,
  force = false
): Promise<AutoSyncResult> {
  const configured = await deliveryTrackingService.isConfigured();
  if (!configured) {
    return { skipped: true, results: [] };
  }

  const deliveryOrder = await fetchDeliveryOrder(orderId);
  if (!deliveryOrder) {
    return {
      skipped: false,
      results: [{
        date: '',
        orderId,
        weekId: '',
        success: false,
        error: 'No se pudo obtener la información del pedido',
      }],
    };
  }

  const instances = await getDeliveryInstances(orderId, weekDeliveryDates);
  const existingSubmissions = await getExistingSubmissions(orderId);

  const newDeliveryOrderIds = new Set(
    instances.map(inst =>
      deliveryTrackingService.generateDeliveryOrderId(orderId, inst.weekId, inst.familyMemberId)
    )
  );

  const results: SyncDateResult[] = [];

  // Delete submissions that no longer have a matching week
  for (const sub of existingSubmissions) {
    if (!sub.delivery_order_id) continue;
    if (!newDeliveryOrderIds.has(sub.delivery_order_id)) {
      const deleteResult = await deliveryTrackingService.deleteOrderFromTracking(sub.delivery_order_id);
      results.push({
        date: '',
        orderId,
        weekId: '',
        success: deleteResult.success,
        error: deleteResult.error,
        action: 'deleted',
      });
      await new Promise(resolve => setTimeout(resolve, 300));
    }
  }

  // Submit or update each current instance
  for (const instance of instances) {
    const deliveryOrderId = deliveryTrackingService.generateDeliveryOrderId(
      orderId,
      instance.weekId,
      instance.familyMemberId
    );

    const result: SubmissionResult = await deliveryTrackingService.submitOrder(
      deliveryOrder,
      instance.date,
      deliveryOrderId
    );

    results.push({
      date: instance.date,
      orderId,
      weekId: instance.weekId,
      familyMemberId: instance.familyMemberId,
      success: result.success,
      error: result.error_message,
      action: 'created',
    });
    await new Promise(resolve => setTimeout(resolve, 300));
  }

  return { skipped: false, results };
}
