// User Types
export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  permissions?: string[];
  avatar?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type UserRole = 'ADMIN' | 'AGENTE' | 'DELIVERY' | string;

// Order Types
export interface Order {
  id: string;
  customerId: string;
  items: OrderItem[];
  status: OrderStatus;
  totalAmount: number;
  deliveryDate: Date;
  deliveryAddress: Address;
  createdAt: Date;
  updatedAt: Date;
}

export interface OrderItem {
  id: string;
  menuId: string;
  quantity: number;
  price: number;
  customizations?: string[];
}

export enum OrderStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  PREPARING = 'preparing',
  READY = 'ready',
  OUT_FOR_DELIVERY = 'out_for_delivery',
  DELIVERED = 'delivered',
  CANCELLED = 'cancelled'
}

// Customer Types
export interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: Address;
  dietaryRestrictions?: string[];
  subscriptionPlan?: string;
  totalOrders: number;
  totalSpent: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface Address {
  street: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  coordinates?: {
    lat: number;
    lng: number;
  };
}

// Menu Types
export interface Menu {
  id: string;
  name: string;
  description: string;
  price: number;
  category: MenuCategory;
  ingredients: string[];
  nutritionInfo: NutritionInfo;
  allergens: string[];
  isActive: boolean;
  imageUrl?: string;
  preparationTime: number;
  createdAt: Date;
  updatedAt: Date;
}

export enum MenuCategory {
  BREAKFAST = 'breakfast',
  LUNCH = 'lunch',
  DINNER = 'dinner',
  SNACK = 'snack',
  BEVERAGE = 'beverage'
}

export interface NutritionInfo {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  sugar: number;
}

// Plan Types
export interface Plan {
  id: string;
  name: string;
  description: string;
  price: number;
  duration: number; // in days
  mealsPerDay: number;
  features: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Analytics Types
export interface Analytics {
  totalRevenue: number;
  totalOrders: number;
  averageOrderValue: number;
  newCustomers: number;
  period: {
    start: Date;
    end: Date;
  };
}

// Navigation Types
export interface NavigationItem {
  id: string;
  label: string;
  path: string;
  icon: string;
  requiredPermission?: string;
}

// Export coupon types
export type { Coupon, CreateCouponData, UpdateCouponData, CouponUsage, ValidateCouponResult, CouponWithUsage } from './coupon';

// Export Stripe types
export type {
  StripeConfig,
  StripePaymentIntent,
  StripePaymentStatus,
  CreatePaymentIntentParams,
  StripePaymentIntentResponse
} from './stripeConfig';