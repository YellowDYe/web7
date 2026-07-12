export interface Discount {
  id: string;
  discount_id: string;
  discount_name: string;
  discount_percentage: number;
  meal_plans_id: string;
  threshold: number;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateDiscountData {
  discount_name: string;
  discount_percentage: number;
  meal_plans_id: string;
  threshold: number;
  expires_at?: string | null;
}

export interface UpdateDiscountData {
  discount_name?: string;
  discount_percentage?: number;
  meal_plans_id?: string;
  threshold?: number;
  expires_at?: string | null;
}