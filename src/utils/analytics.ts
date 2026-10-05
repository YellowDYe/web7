declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
    gtag?: (...args: unknown[]) => void;
    ttq?: { track: (event: string, params?: Record<string, unknown>) => void; page: () => void };
    dataLayer?: unknown[];
    _fbq?: unknown;
  }
}

export type AnalyticsEvent =
  | 'AddToCart'
  | 'InitiateCheckout'
  | 'Purchase'
  | 'Login'
  | 'CompleteRegistration'
  | 'Lead';

const GA4_EVENT_MAP: Record<AnalyticsEvent, string> = {
  AddToCart: 'add_to_cart',
  InitiateCheckout: 'begin_checkout',
  Purchase: 'purchase',
  Login: 'login',
  CompleteRegistration: 'sign_up',
  Lead: 'generate_lead',
};

function hashEmail(email: string): string {
  let hash = 0;
  for (let i = 0; i < email.length; i++) {
    const chr = email.charCodeAt(i);
    hash = (hash << 5) - hash + chr;
    hash |= 0;
  }
  return Math.abs(hash).toString(16);
}

export interface TrackEventParams {
  value?: number;
  currency?: string;
  orderId?: string;
  email?: string;
  items?: Array<{ id: string; name: string; quantity: number; price: number }>;
}

export function trackEvent(event: AnalyticsEvent, params: TrackEventParams = {}): void {
  try {
    const value = params.value ?? 0;
    const currency = params.currency ?? 'MXN';

    if (typeof window.fbq === 'function') {
      const fbParams: Record<string, unknown> = { value, currency };
      if (params.orderId) fbParams.content_ids = [params.orderId];
      if (params.items?.length) {
        fbParams.contents = params.items.map(i => ({ id: i.id, quantity: i.quantity }));
        fbParams.content_type = 'product';
      }
      window.fbq('track', event, fbParams);
    }

    if (typeof window.gtag === 'function') {
      const gaParams: Record<string, unknown> = { value, currency };
      if (params.orderId) gaParams.transaction_id = params.orderId;
      if (params.items?.length) {
        gaParams.items = params.items.map(i => ({
          item_id: i.id,
          item_name: i.name,
          quantity: i.quantity,
          price: i.price,
        }));
      }
      window.gtag('event', GA4_EVENT_MAP[event], gaParams);
    }

    if (window.ttq && typeof window.ttq.track === 'function') {
      window.ttq.track(event, { value, currency, content_id: params.orderId });
    }

    if (event === 'CompleteRegistration' && params.email) {
      try {
        const mc = (window as unknown as Record<string, unknown>).mailchimp;
        if (mc && typeof mc === 'object') {
          // Mailchimp connected-site picks up identify events automatically
        }
      } catch { /* mailchimp not loaded */ }
    }
  } catch (err) {
    console.warn('[analytics] trackEvent failed:', err);
  }
}

export function trackAddToCart(value: number, items: Array<{ id: string; name: string; quantity: number; price: number }>): void {
  trackEvent('AddToCart', { value, items });
}

export function trackInitiateCheckout(value: number, items?: Array<{ id: string; name: string; quantity: number; price: number }>): void {
  trackEvent('InitiateCheckout', { value, items });
}

export function trackPurchase(orderId: string, value: number, items?: Array<{ id: string; name: string; quantity: number; price: number }>): void {
  trackEvent('Purchase', { orderId, value, items });
}

export function trackLogin(): void {
  trackEvent('Login', {});
}

export function trackSignup(email: string): void {
  trackEvent('CompleteRegistration', { email, value: 0 });
}

export { hashEmail };
