import { supabase } from '../config/supabase';
import {
  StripePaymentIntent,
  CreatePaymentIntentParams,
  StripePaymentIntentResponse
} from '../types/stripeConfig';
import { stripeConfigService } from './stripeConfigService';

class StripeService {
  async createPaymentIntent(params: CreatePaymentIntentParams): Promise<StripePaymentIntentResponse> {
    try {
      const config = await stripeConfigService.getStripeConfig();

      if (!config || !config.publishable_key || !config.secret_key) {
        throw new Error('Stripe no está configurado. Por favor configura tus credenciales de Stripe.');
      }

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-payment-intent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify({
          amount: Math.round(params.amount * 100),
          currency: params.currency || 'mxn',
          customer_id: params.customer_id,
          order_id: params.order_id,
          metadata: params.metadata || {}
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || 'Error al crear el intento de pago');
      }

      const data = await response.json();

      await this.savePaymentIntent({
        payment_intent_id: data.paymentIntentId,
        order_id: params.order_id || null,
        customer_id: params.customer_id,
        amount: params.amount,
        currency: params.currency || 'mxn',
        status: 'requires_payment_method',
        client_secret: data.clientSecret,
        payment_method_types: ['card'],
        metadata: params.metadata || {}
      });

      return {
        clientSecret: data.clientSecret,
        paymentIntentId: data.paymentIntentId
      };
    } catch (error: any) {
      console.error('Error creating payment intent:', error);
      throw new Error(error.message || 'Error al crear el intento de pago');
    }
  }

  private async savePaymentIntent(intent: Omit<StripePaymentIntent, 'id' | 'created_at' | 'updated_at' | 'last_payment_error'>): Promise<void> {
    try {
      const { error } = await supabase
        .from('stripe_payment_intents')
        .insert([intent]);

      if (error) {
        console.error('Error saving payment intent to database:', error);
      }
    } catch (error) {
      console.error('Error in savePaymentIntent:', error);
    }
  }

  async updatePaymentIntentStatus(
    paymentIntentId: string,
    status: string,
    error?: any
  ): Promise<void> {
    try {
      const updateData: any = { status };

      if (error) {
        updateData.last_payment_error = error;
      }

      const { error: dbError } = await supabase
        .from('stripe_payment_intents')
        .update(updateData)
        .eq('payment_intent_id', paymentIntentId);

      if (dbError) {
        console.error('Error updating payment intent status:', dbError);
        throw dbError;
      }
    } catch (error: any) {
      console.error('Error in updatePaymentIntentStatus:', error);
      throw new Error('Error al actualizar el estado del pago');
    }
  }

  async getPaymentIntent(paymentIntentId: string): Promise<StripePaymentIntent | null> {
    try {
      const { data, error } = await supabase
        .from('stripe_payment_intents')
        .select('*')
        .eq('payment_intent_id', paymentIntentId)
        .maybeSingle();

      if (error) {
        console.error('Error fetching payment intent:', error);
        throw error;
      }

      return data;
    } catch (error: any) {
      console.error('Error in getPaymentIntent:', error);
      throw new Error('Error al obtener el intento de pago');
    }
  }

  async getCustomerPaymentIntents(customerId: string): Promise<StripePaymentIntent[]> {
    try {
      const { data, error } = await supabase
        .from('stripe_payment_intents')
        .select('*')
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching customer payment intents:', error);
        throw error;
      }

      return data || [];
    } catch (error: any) {
      console.error('Error in getCustomerPaymentIntents:', error);
      throw new Error('Error al obtener los intentos de pago del cliente');
    }
  }

  async getOrderPaymentIntent(orderId: string): Promise<StripePaymentIntent | null> {
    try {
      const { data, error } = await supabase
        .from('stripe_payment_intents')
        .select('*')
        .eq('order_id', orderId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error('Error fetching order payment intent:', error);
        throw error;
      }

      return data;
    } catch (error: any) {
      console.error('Error in getOrderPaymentIntent:', error);
      throw new Error('Error al obtener el intento de pago del pedido');
    }
  }

  getPublishableKey(): string {
    return stripeConfigService.getStripeConfig().then(config => {
      if (!config || !config.publishable_key) {
        throw new Error('Stripe publishable key not configured');
      }
      return config.publishable_key;
    }).catch(() => {
      throw new Error('Unable to get Stripe publishable key');
    }) as any;
  }

  async getPublishableKeyAsync(): Promise<string> {
    const config = await stripeConfigService.getStripeConfig();
    if (!config || !config.publishable_key) {
      throw new Error('Stripe no está configurado');
    }
    return config.publishable_key;
  }

  async isTestMode(): Promise<boolean> {
    const config = await stripeConfigService.getStripeConfig();
    return config?.environment === 'test';
  }
}

export const stripeService = new StripeService();
