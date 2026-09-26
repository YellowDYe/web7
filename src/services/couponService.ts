import { supabase } from '../config/supabase';
import { Coupon, CreateCouponData, UpdateCouponData, ValidateCouponResult, CouponUsage } from '../types/coupon';

export class CouponService {
  async createCoupon(couponData: CreateCouponData): Promise<Coupon> {
    const { data, error } = await supabase
      .from('coupons')
      .insert([couponData])
      .select()
      .single();

    if (error) {
      throw new Error(`Error creating coupon: ${error.message}`);
    }

    return data;
  }

  async getAllCoupons(): Promise<Coupon[]> {
    const { data, error } = await supabase
      .from('coupons')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Error fetching coupons: ${error.message}`);
    }

    return data || [];
  }

  async getActiveCoupons(): Promise<Coupon[]> {
    const now = new Date().toISOString();

    const { data, error } = await supabase
      .from('coupons')
      .select('*')
      .eq('is_active', true)
      .lte('valid_from', now)
      .or(`valid_until.is.null,valid_until.gte.${now}`)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Error fetching active coupons: ${error.message}`);
    }

    return data || [];
  }

  async getCouponById(id: number): Promise<Coupon | null> {
    const { data, error } = await supabase
      .from('coupons')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      throw new Error(`Error fetching coupon: ${error.message}`);
    }

    return data;
  }

  async getCouponByCode(code: string): Promise<Coupon | null> {
    const { data, error } = await supabase
      .from('coupons')
      .select('*')
      .eq('code', code.toUpperCase())
      .maybeSingle();

    if (error) {
      throw new Error(`Error fetching coupon by code: ${error.message}`);
    }

    return data;
  }

  async updateCoupon(id: number, updates: UpdateCouponData): Promise<Coupon> {
    const { data, error } = await supabase
      .from('coupons')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Error updating coupon: ${error.message}`);
    }

    return data;
  }

  async deleteCoupon(id: number): Promise<void> {
    const { error } = await supabase
      .from('coupons')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`Error deleting coupon: ${error.message}`);
    }
  }

  /**
   * Validation happens entirely on the server: the coupon catalogue is not
   * readable by shoppers, and the discount is computed there so it cannot be
   * decided in the browser.
   */
  async validateCoupon(
    code: string,
    _customerId: string | null,
    orderAmount: number
  ): Promise<ValidateCouponResult> {
    const { data, error } = await supabase.rpc('validate_coupon_for_customer', {
      p_code: code,
      p_order_amount: orderAmount,
    });

    if (error) {
      console.error('Error validating coupon:', error);
      return { valid: false, message: 'No se pudo validar el cupón. Intenta de nuevo.' };
    }

    const result = data as any;

    if (!result || !result.valid) {
      return { valid: false, message: result?.message || 'Cupón no válido' };
    }

    return {
      valid: true,
      discount_amount: Number(result.discount_amount) || 0,
      coupon: {
        id: result.coupon_id,
        code: result.code,
        description: result.description,
        discount_type: result.discount_type,
        discount_value: Number(result.discount_value) || 0,
        max_discount_amount: result.max_discount_amount ?? null,
        min_purchase_amount: result.min_purchase_amount ?? null,
      } as Coupon,
    };
  }

  calculateDiscount(coupon: Coupon, orderAmount: number): number {
    let discount = 0;

    if (coupon.discount_type === 'percentage') {
      discount = (orderAmount * coupon.discount_value) / 100;

      if (coupon.max_discount_amount && discount > coupon.max_discount_amount) {
        discount = coupon.max_discount_amount;
      }
    } else {
      discount = coupon.discount_value;
    }

    return Math.min(discount, orderAmount);
  }

  async recordCouponUsage(
    couponId: number,
    customerId: string,
    orderId: string,
    discountApplied: number
  ): Promise<CouponUsage> {
    const { data, error } = await supabase
      .from('coupon_usage')
      .insert([{
        coupon_id: couponId,
        customer_id: customerId,
        order_id: orderId,
        discount_applied: discountApplied
      }])
      .select()
      .single();

    if (error) {
      throw new Error(`Error recording coupon usage: ${error.message}`);
    }

    return data;
  }

  async getCouponTotalUsage(couponId: number): Promise<number> {
    const { count, error } = await supabase
      .from('coupon_usage')
      .select('*', { count: 'exact', head: true })
      .eq('coupon_id', couponId);

    if (error) {
      throw new Error(`Error fetching coupon usage: ${error.message}`);
    }

    return count || 0;
  }

  async getCouponCustomerUsage(couponId: number, customerId: string): Promise<number> {
    const { count, error } = await supabase
      .from('coupon_usage')
      .select('*', { count: 'exact', head: true })
      .eq('coupon_id', couponId)
      .eq('customer_id', customerId);

    if (error) {
      throw new Error(`Error fetching customer coupon usage: ${error.message}`);
    }

    return count || 0;
  }

  async getCouponUsageHistory(couponId: number): Promise<CouponUsage[]> {
    const { data, error } = await supabase
      .from('coupon_usage')
      .select('*')
      .eq('coupon_id', couponId)
      .order('used_at', { ascending: false });

    if (error) {
      throw new Error(`Error fetching coupon usage history: ${error.message}`);
    }

    return data || [];
  }
}

export const couponService = new CouponService();
