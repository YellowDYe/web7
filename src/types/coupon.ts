export interface Coupon {
  id: number;
  code: string;
  description: string | null;
  discount_type: 'percentage' | 'fixed';
  discount_value: number;
  min_purchase_amount: number | null;
  max_discount_amount: number | null;
  usage_limit: number | null;
  usage_limit_per_customer: number | null;
  valid_from: string;
  valid_until: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateCouponData {
  code: string;
  description?: string;
  discount_type: 'percentage' | 'fixed';
  discount_value: number;
  min_purchase_amount?: number;
  max_discount_amount?: number;
  usage_limit?: number;
  usage_limit_per_customer?: number;
  valid_from?: string;
  valid_until?: string;
  is_active?: boolean;
}

export interface UpdateCouponData {
  code?: string;
  description?: string;
  discount_type?: 'percentage' | 'fixed';
  discount_value?: number;
  min_purchase_amount?: number;
  max_discount_amount?: number;
  usage_limit?: number;
  usage_limit_per_customer?: number;
  valid_from?: string;
  valid_until?: string;
  is_active?: boolean;
}

export interface CouponUsage {
  id: number;
  coupon_id: number;
  customer_id: string;
  order_id: string | null;
  discount_applied: number;
  used_at: string;
}

export interface ValidateCouponResult {
  valid: boolean;
  message?: string;
  discount_amount?: number;
  coupon?: Coupon;
}

export interface CouponWithUsage extends Coupon {
  usage_count?: number;
  customer_usage_count?: number;
}
