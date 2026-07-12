import { supabase } from '../../config/supabase';
import { orderService } from '../../services/orderService';
import { invoiceService } from '../../services/invoiceService';
import { PendingOrderItem, BILLABLE_MEAL_TYPES } from '../../types/orderMenu';
import { SelectedWeek } from '../../types/week';
import { DeliveryOption } from '../../types/deliveryOption';
import { Coupon } from '../../types/coupon';
import { buildQuantityUpdates } from '../../utils/orderWeeksTransformer';
import { Customer } from '../../types/customer';
import { mailgunService } from '../../services/mailgunService';

interface OrderSubmissionData {
  customer: Customer;
  planDuration: 1 | 2 | 4;
  selectedWeeks: SelectedWeek[];
  orderItems: PendingOrderItem[];
  orderNotes: string;
  selectedDeliveryOption: DeliveryOption;
  appliedCoupon: Coupon | null;
  couponDiscountAmount: number;
}

interface OrderSubmissionResult {
  success: boolean;
  orderId?: string;
  orderNumber?: string;
  message: string;
  error?: string;
  totals?: {
    subtotal: number;
    planDiscount: number;
    deliveryPrice: number;
    couponDiscount: number;
    taxAmount: number;
    finalTotal: number;
  };
}

export interface OrderConfirmationData {
  orderId: string;
  orderNumber: string;
  customer: Customer;
  selectedWeeks: SelectedWeek[];
  totals: {
    subtotal: number;
    planDiscount: number;
    deliveryPrice: number;
    couponDiscount: number;
    taxAmount: number;
    finalTotal: number;
  };
  deliveryOptionName: string;
  couponCode?: string;
}

class CustomerOrderSubmissionService {
  async submitOrder(data: OrderSubmissionData): Promise<OrderSubmissionResult> {
    try {
      const {
        customer,
        planDuration,
        selectedWeeks,
        orderItems,
        orderNotes,
        selectedDeliveryOption,
        appliedCoupon,
        couponDiscountAmount
      } = data;

      if (orderItems.length < 3) {
        return {
          success: false,
          message: 'Debes seleccionar al menos 3 comidas',
          error: 'MINIMUM_ITEMS_NOT_MET'
        };
      }

      const itemsTotal = orderItems.reduce((total, item) => {
        if (BILLABLE_MEAL_TYPES.includes(item.meal_type as any)) {
          return total + (item.meal_plan_price * item.quantity);
        }
        return total;
      }, 0);

      const planDiscounts = await this.calculatePlanDiscounts(orderItems);
      const totalPlanDiscount = planDiscounts.reduce((sum, d) => sum + d.amount, 0);

      const deliveryPrice = selectedDeliveryOption.delivery_options_price;
      const subtotalAfterPlanDiscount = itemsTotal - totalPlanDiscount;
      const subtotalWithDelivery = subtotalAfterPlanDiscount + deliveryPrice;
      const couponDiscount = Math.min(couponDiscountAmount, subtotalWithDelivery);
      const subtotalAfterCoupon = subtotalWithDelivery - couponDiscount;
      const taxRate = 16;
      const taxAmount = subtotalAfterCoupon * (taxRate / 100);
      const finalTotal = subtotalAfterCoupon + taxAmount;

      // Create the order using the same flow as admin orders
      const newOrder = await orderService.createOrder({
        customer_id: customer.customer_id,
        order_customer_name: `${customer.customer_name} ${customer.customer_lastname}`.trim(),
        order_customer_email: customer.customer_email,
        order_status: 'pending',
        order_notes: orderNotes || null,
        order_total_price: Math.round(finalTotal),
        order_invoice_number: ''
      } as any);

      // Create order weeks with quantities embedded (same as admin flow)
      const createdOrderWeekIds: string[] = [];

      try {
        for (const selectedWeek of selectedWeeks) {
          const weekItems = orderItems.filter(item =>
            item.week_id === selectedWeek.week.week_id ||
            item.week_name === selectedWeek.week.week_name
          );

          if (weekItems.length === 0) continue;

          // Group by meal plan per family member
          const planFamilyGroups: Record<string, PendingOrderItem[]> = {};
          for (const item of weekItems) {
            const groupKey = `${item.meal_plans_id}__${item.family_member_id || 'main'}`;
            if (!planFamilyGroups[groupKey]) {
              planFamilyGroups[groupKey] = [];
            }
            planFamilyGroups[groupKey].push(item);
          }

          for (const [groupKey, items] of Object.entries(planFamilyGroups)) {
            const [mealPlanId, familyMemberKey] = groupKey.split('__');
            const familyMemberId = familyMemberKey === 'main' ? null : familyMemberKey;
            const quantities = buildQuantityUpdates(items);

            const orderWeek = await orderService.createOrderWeek({
              order_id: newOrder.order_id,
              week_id: selectedWeek.week.week_id,
              meal_plan_id: mealPlanId,
              delivery_date: selectedWeek.week.week_date || null,
              family_member_id: familyMemberId,
              quantities
            });

            createdOrderWeekIds.push(orderWeek.order_week_id);
          }
        }
      } catch (weekError) {
        // Rollback order on week creation failure
        try {
          await orderService.deleteOrder(newOrder.id);
        } catch (_) {}

        console.error('Error creating order weeks:', weekError);
        return {
          success: false,
          message: 'Error al crear el pedido',
          error: weekError instanceof Error ? weekError.message : 'Error creating weeks'
        };
      }

      // Build invoice summary
      const planGroups: Record<string, { week_name: string; plan_name: string; total_dishes: number }> = {};
      for (const item of orderItems) {
        if (!BILLABLE_MEAL_TYPES.includes(item.meal_type as any)) continue;
        const key = `${item.week_name}-${item.meal_plans_id}`;
        if (!planGroups[key]) {
          planGroups[key] = { week_name: item.week_name, plan_name: item.meal_plan_name, total_dishes: 0 };
        }
        planGroups[key].total_dishes += item.quantity;
      }
      const mealsSummary = Object.values(planGroups)
        .map(g => `${g.week_name}, ${g.plan_name}, ${g.total_dishes} platillo${g.total_dishes !== 1 ? 's' : ''}`)
        .join(' / ');
      const invoiceSummary = mealsSummary + ` / Envío: ${selectedDeliveryOption.delivery_options_name}`;

      // Create invoice in 'draft' status (order not yet paid)
      try {
        const invoice = await invoiceService.createInvoiceFromOrder(
          newOrder,
          {
            customer_name: `${customer.customer_name} ${customer.customer_lastname}`.trim(),
            customer_email: customer.customer_email,
            invoice_summary: invoiceSummary
          },
          orderItems,
          selectedDeliveryOption,
          totalPlanDiscount,
          couponDiscount,
          0,
          'pending'
        );

        await orderService.updateOrderWithoutInvoiceSync(newOrder.id, {
          order_invoice_number: invoice.invoice_number
        } as any);
      } catch (invoiceError) {
        console.warn('Could not create invoice for order, continuing:', invoiceError);
      }

      // Track coupon usage
      if (appliedCoupon && couponDiscount > 0) {
        try {
          await supabase
            .from('coupon_usage')
            .insert({
              coupon_id: appliedCoupon.coupon_id,
              customer_id: customer.id,
              order_id: newOrder.id,
              discount_applied: couponDiscount,
              used_at: new Date().toISOString()
            });

          await supabase.rpc('increment_coupon_usage', {
            coupon_id: appliedCoupon.coupon_id
          });
        } catch (couponError) {
          console.warn('Could not record coupon usage, continuing:', couponError);
        }
      }

      return {
        success: true,
        orderId: newOrder.id,
        orderNumber: newOrder.order_id,
        message: `¡Pedido creado exitosamente! Número de orden: ${newOrder.order_id}`,
        totals: {
          subtotal: itemsTotal,
          planDiscount: totalPlanDiscount,
          deliveryPrice,
          couponDiscount: couponDiscount,
          taxAmount,
          finalTotal
        }
      };

    } catch (error) {
      console.error('Error submitting order:', error);
      return {
        success: false,
        message: 'Error al crear el pedido',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async markOrderAsPaid(data: OrderConfirmationData): Promise<void> {
    const { orderId, orderNumber, customer, selectedWeeks, totals, deliveryOptionName, couponCode } = data;

    try {
      await supabase
        .from('orders')
        .update({
          order_status: 'completed',
          stripe_payment_status: 'succeeded',
          stripe_paid_at: new Date().toISOString()
        })
        .eq('id', orderId);
    } catch (err) {
      console.warn('Could not mark order as paid in DB:', err);
    }

    try {
      const { data: invoiceRows } = await supabase
        .from('invoices')
        .select('id')
        .eq('order_id', orderId)
        .maybeSingle();

      if (invoiceRows?.id) {
        await supabase
          .from('invoices')
          .update({
            invoice_status: 'paid',
            payment_date: new Date().toISOString()
          })
          .eq('id', invoiceRows.id);
      }
    } catch (err) {
      console.warn('Could not update invoice status:', err);
    }

    try {
      const formatAddress = (): string => {
        const parts: string[] = [];
        if (customer.customer_street && customer.customer_street_number) {
          parts.push(`${customer.customer_street} ${customer.customer_street_number}`);
        }
        if (customer.customer_interior_number) {
          parts.push(`Int. ${customer.customer_interior_number}`);
        }
        if (customer.customer_colonia) parts.push(customer.customer_colonia);
        if (customer.customer_delegacion) parts.push(customer.customer_delegacion);
        if (customer.customer_postal_code) parts.push(`CP ${customer.customer_postal_code}`);
        return parts.join(', ');
      };

      const shopUrl = `${window.location.origin}/shop`;

      await mailgunService.sendOrderConfirmationEmail({
        customerName: `${customer.customer_name} ${customer.customer_lastname}`.trim(),
        customerEmail: customer.customer_email,
        orderNumber,
        deliveryAddress: formatAddress(),
        deliveryWeeks: selectedWeeks.map(sw => ({
          weekName: sw.week.week_name,
          deliveryDate: sw.week.week_date
        })),
        totals,
        deliveryOptionName,
        couponCode,
        shopUrl
      });
    } catch (err) {
      console.warn('Could not send order confirmation email:', err);
    }
  }

  private async calculatePlanDiscounts(orderItems: PendingOrderItem[]): Promise<{ planId: string; amount: number }[]> {
    const planCounts: Record<string, { count: number; price: number }> = {};

    orderItems.forEach(item => {
      if (BILLABLE_MEAL_TYPES.includes(item.meal_type as any)) {
        const planId = item.meal_plans_id;
        if (!planCounts[planId]) {
          planCounts[planId] = { count: 0, price: item.meal_plan_price };
        }
        planCounts[planId].count += item.quantity;
      }
    });

    const discounts: { planId: string; amount: number }[] = [];

    for (const [planId, { count }] of Object.entries(planCounts)) {
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
        const planTotal = orderItems
          .filter(item => item.meal_plans_id === planId && BILLABLE_MEAL_TYPES.includes(item.meal_type as any))
          .reduce((sum, item) => sum + (item.meal_plan_price * item.quantity), 0);

        discounts.push({ planId, amount: planTotal * (data.discount_percentage / 100) });
      }
    }

    return discounts;
  }
}

export const customerOrderSubmissionService = new CustomerOrderSubmissionService();
