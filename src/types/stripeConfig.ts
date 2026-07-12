export interface StripeConfig {
  id: string;
  publishable_key: string;
  secret_key: string;
  webhook_secret: string;
  environment: 'test' | 'live';
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface StripePaymentIntent {
  id: string;
  payment_intent_id: string;
  order_id: string | null;
  customer_id: string | null;
  amount: number;
  currency: string;
  status: StripePaymentStatus;
  client_secret: string | null;
  payment_method_types: string[];
  metadata: Record<string, any>;
  last_payment_error: any | null;
  created_at: string;
  updated_at: string;
}

export type StripePaymentStatus =
  | 'requires_payment_method'
  | 'requires_confirmation'
  | 'requires_action'
  | 'processing'
  | 'succeeded'
  | 'canceled'
  | 'failed';

export interface CreatePaymentIntentParams {
  amount: number;
  currency?: string;
  customer_id: string;
  order_id?: string;
  metadata?: Record<string, any>;
}

export interface StripePaymentIntentResponse {
  clientSecret: string;
  paymentIntentId: string;
}
