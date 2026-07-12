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

  async validateCoupon(
    code: string,
    customerId: string | null,
    orderAmount: number
  ): Promise<ValidateCouponResult> {
    const coupon = await this.getCouponByCode(code);

    if (!coupon) {
      return {
        valid: false,
        message: 'Cupón no encontrado'
      };
    }

    if (!coupon.is_active) {
      return {
        valid: false,
        message: 'Este cupón no está activo'
      };
    }

    const now = new Date();
    const validFrom = new Date(coupon.valid_from);
    const validUntil = coupon.valid_until ? new Date(coupon.valid_until) : null;

    if (now < validFrom) {
      return {
        valid: false,
        message: 'Este cupón aún no es válido'
      };
    }

    if (validUntil && now > validUntil) {
      return {
        valid: false,
        message: 'Este cupón ha expirado'
      };
    }

    if (coupon.min_purchase_amount && orderAmount < coupon.min_purchase_amount) {
      return {
        valid: false,
        message: `Monto mínimo de compra requerido: $${coupon.min_purchase_amount}`
      };
    }

    if (coupon.usage_limit) {
      const totalUsage = await this.getCouponTotalUsage(coupon.id);
      if (totalUsage >= coupon.usage_limit) {
        return {
          valid: false,
          message: 'Este cupón ha alcanzado su límite de uso'
        };
      }
    }

    if (coupon.usage_limit_per_customer && customerId) {
      const customerUsage = await this.getCouponCustomerUsage(coupon.id, customerId);
      if (customerUsage >= coupon.usage_limit_per_customer) {
        return {
          valid: false,
          message: 'Has alcanzado el límite de uso de este cupón'
        };
      }
    }

    const discountAmount = this.calculateDiscount(coupon, orderAmount);

    return {
      valid: true,
      discount_amount: discountAmount,
      coupon: coupon
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
