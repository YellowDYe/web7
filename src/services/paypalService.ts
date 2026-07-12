import { paypalConfigService } from './paypalConfigService';
import {
  PayPalAuthResponse,
  PayPalInvoiceRequest,
  PayPalInvoiceResponse,
  PayPalSendInvoiceRequest,
  PayPalErrorResponse,
  PayPalInvoiceItem,
  PayPalBillingInfo
} from '../types/paypalConfig';
import { Invoice } from '../types/invoice';
import { OrderWithDetails } from '../types/order';
import { getCurrentMexicoDateString, getMexicoDateStringWithOffset } from '../utils/timezone';

class PayPalService {
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;

  private async getAccessToken(): Promise<string> {
    const now = Date.now();

    if (this.accessToken && now < this.tokenExpiry) {
      console.log('[PayPal Auth] Using cached access token');
      return this.accessToken;
    }

    console.log('[PayPal Auth] Requesting new access token...');

    try {
      const config = await paypalConfigService.getPayPalConfig();

      if (!config) {
        console.error('[PayPal Auth] No PayPal configuration found in database');
        throw new Error('Configuración de PayPal no encontrada. Configure las credenciales en Admin > Configuración.');
      }

      if (!config.client_id || config.client_id.trim() === '') {
        console.error('[PayPal Auth] Client ID is missing or empty');
        throw new Error('Client ID de PayPal no configurado. Configure las credenciales en Admin > Configuración.');
      }

      if (!config.client_secret || config.client_secret.trim() === '') {
        console.error('[PayPal Auth] Client Secret is missing or empty');
        throw new Error('Client Secret de PayPal no configurado. Configure las credenciales en Admin > Configuración.');
      }

      console.log('[PayPal Auth] Using environment:', config.environment);

      const baseUrl = paypalConfigService.getBaseUrl(config.environment);
      const credentials = btoa(`${config.client_id}:${config.client_secret}`);

      const response = await fetch(`${baseUrl}/v1/oauth2/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${credentials}`
        },
        body: 'grant_type=client_credentials'
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('[PayPal Auth] Authentication failed with status:', response.status);
        console.error('[PayPal Auth] Error data:', errorData);

        if (response.status === 401) {
          throw new Error('Error de autenticación con PayPal. Las credenciales son inválidas. Verifique su Client ID y Client Secret en Admin > Configuración.');
        } else if (response.status === 403) {
          throw new Error('Acceso denegado por PayPal. Verifique que su cuenta de PayPal tenga permisos para crear facturas.');
        } else {
          throw new Error(`Error de autenticación con PayPal (${response.status}). Verifique las credenciales.`);
        }
      }

      console.log('[PayPal Auth] Authentication successful');

      const data: PayPalAuthResponse = await response.json();

      this.accessToken = data.access_token;
      this.tokenExpiry = now + (data.expires_in * 1000) - 60000;

      console.log('[PayPal Auth] Access token cached, expires in', data.expires_in, 'seconds');

      return this.accessToken;
    } catch (error: any) {
      console.error('[PayPal Auth] Error getting access token:', error);

      if (error.message && error.message.includes('Configuración de PayPal')) {
        throw error;
      }

      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new Error('Error de conexión con PayPal. Verifique su conexión a internet.');
      }

      throw new Error(`Error al obtener token de acceso de PayPal: ${error.message || 'Error desconocido'}`);
    }
  }

  private async makePayPalRequest<T>(
    endpoint: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
    body?: any
  ): Promise<T> {
    const config = await paypalConfigService.getPayPalConfig();

    if (!config) {
      throw new Error('Configuración de PayPal no encontrada');
    }

    const baseUrl = paypalConfigService.getBaseUrl(config.environment);
    const accessToken = await this.getAccessToken();

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
      'Prefer': 'return=representation'
    };

    const requestOptions: RequestInit = {
      method,
      headers
    };

    if (body && (method === 'POST' || method === 'PUT')) {
      requestOptions.body = JSON.stringify(body);
    }

    try {
      console.log(`[PayPal Request] ${method} ${baseUrl}${endpoint}`);
      if (body) {
        console.log('[PayPal Request Body]', JSON.stringify(body, null, 2));
      }

      const response = await fetch(`${baseUrl}${endpoint}`, requestOptions);

      console.log(`[PayPal Response] HTTP Status: ${response.status} ${response.statusText}`);
      console.log(`[PayPal Response] Content-Type:`, response.headers.get('Content-Type'));

      if (!response.ok) {
        const errorData: PayPalErrorResponse = await response.json().catch(() => ({
          name: 'Error',
          message: 'Error desconocido de PayPal'
        }));

        console.error('[PayPal API Error Response]', JSON.stringify(errorData, null, 2));

        if (response.status === 404) {
          console.error('[PayPal API] Resource not found (404)');
          throw new Error('El recurso especificado no existe en PayPal. La factura puede haber sido eliminada o el ID es inválido.');
        }

        const errorMessage = errorData.details && errorData.details.length > 0
          ? errorData.details.map(d => d.description).join(', ')
          : errorData.message;

        throw new Error(errorMessage);
      }

      if (method === 'DELETE' || response.status === 204) {
        console.log('[PayPal Response] No content (204)');
        return {} as T;
      }

      // Handle 201 Created responses - PayPal may return incomplete data
      if (response.status === 201 && method === 'POST') {
        console.log('[PayPal Response] 201 Created - checking response completeness');
        
        const responseData = await response.json();
        console.log('[PayPal Response Body]', JSON.stringify(responseData, null, 2));

        // Check if we got a link object instead of full invoice
        if (responseData.href && responseData.rel && !responseData.id) {
          console.warn('[PayPal Response] Received link object instead of full invoice');
          
          // Try to extract invoice ID from href or Location header
          const locationHeader = response.headers.get('Location');
          console.log('[PayPal Response] Location header:', locationHeader);
          
          let invoiceId: string | null = null;
          
          if (locationHeader) {
            // Extract ID from Location header (e.g., .../invoices/INV2-XXXX-XXXX-XXXX-XXXX)
            const match = locationHeader.match(/\/invoices\/(INV2-[A-Z0-9-]+)/);
            if (match) {
              invoiceId = match[1];
              console.log('[PayPal Response] Extracted invoice ID from Location:', invoiceId);
            }
          }
          
          if (!invoiceId && responseData.href) {
            // Extract ID from href
            const match = responseData.href.match(/\/invoices\/(INV2-[A-Z0-9-]+)/);
            if (match) {
              invoiceId = match[1];
              console.log('[PayPal Response] Extracted invoice ID from href:', invoiceId);
            }
          }

          if (invoiceId) {
            console.log('[PayPal Response] Fetching full invoice details for:', invoiceId);
            // Make a follow-up GET request to retrieve the full invoice
            return await this.makePayPalRequest<T>(`/v2/invoicing/invoices/${invoiceId}`, 'GET');
          } else {
            console.error('[PayPal Response] Could not extract invoice ID from response');
            throw new Error('PayPal devolvió una respuesta incompleta sin ID de factura');
          }
        }

        // Check if response has required fields for invoice
        if (endpoint.includes('/invoicing/invoices') && !responseData.id) {
          console.warn('[PayPal Response] Invoice response missing ID field');
          throw new Error('La respuesta de PayPal no contiene el ID de la factura');
        }

        return responseData;
      }

      const responseData = await response.json();
      console.log('[PayPal Response Body]', JSON.stringify(responseData, null, 2));
      return responseData;
    } catch (error: any) {
      console.error('[PayPal Request] Error occurred:', error);

      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new Error('Error de conexión con PayPal. Verifique su conexión a internet e intente nuevamente.');
      }

      if (error.message && (error.message.includes('timeout') || error.message.includes('ETIMEDOUT'))) {
        throw new Error('Tiempo de espera agotado al conectar con PayPal. Intente nuevamente.');
      }

      throw error;
    }
  }

  async createDraftInvoice(
    invoice: Invoice,
    order: OrderWithDetails,
    orderItems: any[]
  ): Promise<PayPalInvoiceResponse> {
    let invoiceRequest: PayPalInvoiceRequest | null = null;
    try {
      console.log('[PayPal Service] ===== CREATING PAYPAL INVOICE =====');
      console.log('[PayPal Service] Using invoice data:', {
        invoice_number: invoice.invoice_number,
        subtotal: invoice.subtotal,
        plan_discount: invoice.plan_discount_amount || 0,
        tax_amount: invoice.tax_amount,
        delivery_price: invoice.delivery_option_price,
        delivery_tax: invoice.delivery_tax_amount || 0,
        custom_discount: invoice.custom_discount_amount || 0,
        total: invoice.total_amount
      });

      // Build customer billing info
      const nameParts = invoice.customer_name.split(' ');
      const given_name = nameParts[0] || '';
      const surname = nameParts.slice(1).join(' ') || '';

      const billingInfo: PayPalBillingInfo = {
        email_address: invoice.customer_email,
        name: { given_name, surname }
      };

      if (order.customers) {
        const customer = order.customers;
        if (customer.customer_street && customer.customer_delegacion) {
          billingInfo.address = {
            address_line_1: `${customer.customer_street} ${customer.customer_street_number || ''}`.trim(),
            address_line_2: customer.customer_interior_number || undefined,
            admin_area_2: customer.customer_colonia || undefined,
            admin_area_1: customer.customer_delegacion || undefined,
            postal_code: customer.customer_postal_code || undefined,
            country_code: 'MX'
          };
        }
        if (customer.customer_phone) {
          billingInfo.phones = [{
            country_code: '52',
            national_number: customer.customer_phone,
            phone_type: 'MOBILE'
          }];
        }
      }

      // Calculate dates in Mexico City timezone
      // This ensures invoices created at 11 PM Mexico City time show the correct date,
      // not tomorrow's date (which would happen if we used UTC)
      const invoiceDateString = getCurrentMexicoDateString();
      const dueDateString = getMexicoDateStringWithOffset(10); // 10 days from today

      console.log('[PayPal Service] Invoice date (Mexico City):', invoiceDateString);
      console.log('[PayPal Service] Due date (Mexico City):', dueDateString);

      // Calculate tax percentage - invoice.subtotal is now BEFORE plan discounts
      // Tax was calculated on (subtotal - plan_discount), so we need to back-calculate the rate
      const subtotalAfterDiscount = invoice.subtotal - (invoice.plan_discount_amount || 0);
      const taxPercent = invoice.tax_amount > 0 && subtotalAfterDiscount > 0
        ? ((invoice.tax_amount / subtotalAfterDiscount) * 100).toFixed(2)
        : '16.00';

      console.log('[PayPal Service] Tax percentage:', taxPercent + '%');
      console.log('[PayPal Service] Subtotal (before discount):', Math.round(invoice.subtotal).toFixed(0));
      console.log('[PayPal Service] Plan discount:', Math.round(invoice.plan_discount_amount || 0).toFixed(0));
      console.log('[PayPal Service] Subtotal (after discount):', Math.round(subtotalAfterDiscount).toFixed(0));

      // Create single item with subtotal from invoice
      const items: PayPalInvoiceItem[] = [{
        name: 'Pedido de Comidas',
        description: invoice.invoice_summary || `Pedido #${order.order_id}`,
        quantity: '1',
        unit_amount: {
          currency_code: 'MXN',
          value: Math.round(invoice.subtotal).toFixed(0)
        },
        tax: {
          name: 'IVA',
          percent: taxPercent
        },
        unit_of_measure: 'QUANTITY'
      }];

      // Add plan discount to the item if present
      if (invoice.plan_discount_amount && invoice.plan_discount_amount > 0) {
        items[0].discount = {
          amount: {
            currency_code: 'MXN',
            value: Math.round(invoice.plan_discount_amount).toFixed(0)
          }
        };
        console.log('[PayPal Service] Plan discount added to item:', Math.round(invoice.plan_discount_amount).toFixed(0));
      }

      // Add custom discount as a separate line item (applied after taxes)
      if (invoice.custom_discount_amount && invoice.custom_discount_amount > 0) {
        items.push({
          name: 'Descuento Personalizado',
          description: 'Descuento aplicado al total',
          quantity: '1',
          unit_amount: {
            currency_code: 'MXN',
            value: (-Math.round(invoice.custom_discount_amount)).toFixed(0)
          },
          unit_of_measure: 'QUANTITY'
        });
        console.log('[PayPal Service] Custom discount added as line item:', Math.round(invoice.custom_discount_amount).toFixed(0));
      }

      // Build invoice request following PayPal's structure
      invoiceRequest = {
        detail: {
          invoice_number: invoice.invoice_number,
          reference: `Order: ${order.order_id}`,
          invoice_date: invoiceDateString,
          currency_code: 'MXN',
          note: 'Gracias por su pedido de Hola Dieta',
          term: 'No hay reembolsos después de 30 días.',
          memo: `Pedido #${order.order_id}`,
          payment_term: {
            term_type: 'NET_10',
            due_date: dueDateString
          }
        },
        invoicer: {
          name: {
            given_name: 'Hola',
            surname: 'Dieta'
          },
          email_address: 'yellowdyemx@gmail.com',
          address: {
            address_line_1: 'Dirección de Negocio',
            admin_area_2: 'Ciudad de México',
            admin_area_1: 'CDMX',
            postal_code: '01000',
            country_code: 'MX'
          },
          phones: [{
            country_code: '52',
            national_number: '5579381735',
            phone_type: 'MOBILE'
          }],
          website: 'www.holadieta.com',
          additional_notes: 'Servicio de comidas saludables'
        },
        primary_recipients: [{
          billing_info: billingInfo,
          shipping_info: order.customers ? {
            name: { given_name, surname },
            address: billingInfo.address
          } : undefined
        }],
        items: items,
        configuration: {
          partial_payment: {
            allow_partial_payment: false
          },
          allow_tip: false,
          tax_calculated_after_discount: true,
          tax_inclusive: false
        }
      };

      // Add amount breakdown
      invoiceRequest.amount = {
        breakdown: {}
      };

      // Add shipping (delivery) to breakdown
      if (invoice.delivery_option_price > 0) {
        const deliveryTaxAmount = invoice.delivery_tax_amount || 0;
        const deliveryTaxPercent = deliveryTaxAmount > 0 && invoice.delivery_option_price > 0
          ? ((deliveryTaxAmount / invoice.delivery_option_price) * 100).toFixed(2)
          : taxPercent;

        invoiceRequest.amount.breakdown.shipping = {
          amount: {
            currency_code: 'MXN',
            value: Math.round(invoice.delivery_option_price).toFixed(0)
          },
          tax: {
            name: 'IVA',
            percent: deliveryTaxPercent,
            amount: {
              currency_code: 'MXN',
              value: Math.round(deliveryTaxAmount).toFixed(0)
            }
          }
        };
        console.log('[PayPal Service] Delivery added:', Math.round(invoice.delivery_option_price).toFixed(0), 'Tax:', Math.round(deliveryTaxAmount).toFixed(0));
      }

      console.log('[PayPal Service] Invoice request:', JSON.stringify(invoiceRequest, null, 2));

      const response = await this.makePayPalRequest<PayPalInvoiceResponse>(
        '/v2/invoicing/invoices',
        'POST',
        invoiceRequest
      );

      console.log('[PayPal Service] ===== INVOICE CREATED =====');
      console.log('[PayPal Service] Invoice ID:', response.id);
      console.log('[PayPal Service] Status:', response.status);

      if (!response.id) {
        throw new Error('La respuesta de PayPal no contiene el ID de la factura');
      }

      if (!response.detail) {
        console.warn('[PayPal Service] Response missing detail, fetching full details...');
        return await this.getInvoiceDetails(response.id);
      }

      // Validate total
      if (response.amount && response.amount.value) {
        const paypalTotal = parseFloat(response.amount.value);
        const localTotal = invoice.total_amount;
        const difference = Math.abs(paypalTotal - localTotal);

        console.log('[PayPal Service] Total validation - Local:', Math.round(localTotal).toFixed(0), 'PayPal:', paypalTotal.toFixed(0), 'Diff:', difference.toFixed(0));

        if (difference > 1) {
          console.warn('[PayPal Service] ⚠ Total mismatch exceeds $1!');
        }
      }

      console.log('[PayPal Service] ✓ Invoice created successfully');
      return response;
    } catch (error: any) {
      console.error('[PayPal Service] Error creating invoice:', error.message);

      if (error.message && error.message.toLowerCase().includes('duplicate')) {
        console.log('[PayPal Service] Duplicate invoice detected, attempting recovery...');

        // Try to find existing invoice in PayPal
        const existingInvoice = await this.searchInvoiceByNumber(invoice.invoice_number);
        if (existingInvoice) {
          console.log('[PayPal Service] Found existing invoice, returning it:', existingInvoice.id);
          return existingInvoice;
        }

        // Search failed or returned nothing - retry with a suffixed invoice number
        if (invoiceRequest) {
          const suffix = `-R${Date.now().toString(36).slice(-4)}`;
          const retryInvoiceNumber = `${invoice.invoice_number}${suffix}`;
          console.log('[PayPal Service] Retrying with modified invoice number:', retryInvoiceNumber);

          invoiceRequest.detail.invoice_number = retryInvoiceNumber;

          const retryResponse = await this.makePayPalRequest<PayPalInvoiceResponse>(
            '/v2/invoicing/invoices',
            'POST',
            invoiceRequest
          );

          if (retryResponse && retryResponse.id) {
            console.log('[PayPal Service] Retry successful, invoice created:', retryResponse.id);
            return retryResponse;
          }
        }
      }

      throw new Error(`Error al crear factura de PayPal: ${error.message || 'Error desconocido'}`);
    }
  }

  async getInvoiceDetails(paypalInvoiceId: string): Promise<PayPalInvoiceResponse> {
    try {
      if (!paypalInvoiceId || paypalInvoiceId.trim() === '') {
        throw new Error('ID de factura de PayPal inválido o vacío');
      }

      console.log('[PayPal Service] Fetching invoice details for:', paypalInvoiceId);

      const response = await this.makePayPalRequest<PayPalInvoiceResponse>(
        `/v2/invoicing/invoices/${paypalInvoiceId}`
      );

      if (!response || !response.id) {
        throw new Error('PayPal devolvió una respuesta inválida sin ID de factura');
      }

      console.log('[PayPal Service] Successfully retrieved invoice details');
      return response;
    } catch (error: any) {
      console.error('[PayPal Service] Error getting PayPal invoice details:', error);

      if (error.message && error.message.includes('no existe en PayPal')) {
        throw error;
      }

      if (error.message && (error.message.includes('404') || error.message.includes('not found'))) {
        throw new Error('El recurso especificado no existe en PayPal. La factura puede haber sido eliminada.');
      }

      throw error;
    }
  }

  async sendInvoice(
    paypalInvoiceId: string,
    subject?: string,
    note?: string
  ): Promise<void> {
    try {
      const sendRequest: PayPalSendInvoiceRequest = {
        send_to_recipient: true,
        send_to_invoicer: false,
        subject: subject || 'Factura de Hola Dieta',
        note: note || 'Gracias por su pedido. Por favor revise su factura adjunta.'
      };

      await this.makePayPalRequest(
        `/v2/invoicing/invoices/${paypalInvoiceId}/send`,
        'POST',
        sendRequest
      );
    } catch (error) {
      console.error('Error sending PayPal invoice:', error);
      throw error;
    }
  }

  async cancelInvoice(
    paypalInvoiceId: string,
    subject?: string,
    note?: string
  ): Promise<void> {
    try {
      const cancelRequest = {
        subject: subject || 'Factura cancelada',
        note: note || 'Esta factura ha sido cancelada.',
        send_to_invoicer: false,
        send_to_recipient: true
      };

      await this.makePayPalRequest(
        `/v2/invoicing/invoices/${paypalInvoiceId}/cancel`,
        'POST',
        cancelRequest
      );
    } catch (error) {
      console.error('Error cancelling PayPal invoice:', error);
      throw error;
    }
  }

  async deleteInvoice(paypalInvoiceId: string): Promise<void> {
    try {
      await this.makePayPalRequest(
        `/v2/invoicing/invoices/${paypalInvoiceId}`,
        'DELETE'
      );
    } catch (error) {
      console.error('Error deleting PayPal invoice:', error);
      throw error;
    }
  }

  async sendReminder(
    paypalInvoiceId: string,
    subject?: string,
    note?: string
  ): Promise<void> {
    try {
      const reminderRequest = {
        subject: subject || 'Recordatorio de pago - Hola Dieta',
        note: note || 'Este es un recordatorio amigable sobre su factura pendiente. Por favor, revise y procese el pago cuando sea conveniente.',
        send_to_recipient: true,
        send_to_invoicer: false
      };

      await this.makePayPalRequest(
        `/v2/invoicing/invoices/${paypalInvoiceId}/remind`,
        'POST',
        reminderRequest
      );
    } catch (error) {
      console.error('Error sending PayPal invoice reminder:', error);
      throw error;
    }
  }

  async searchInvoiceByNumber(invoiceNumber: string): Promise<PayPalInvoiceResponse | null> {
    try {
      console.log('[PayPal Service] Searching for existing invoice with number:', invoiceNumber);

      const searchRequest = {
        invoice_number: invoiceNumber
      };

      const response = await this.makePayPalRequest<{ total_items?: number; items?: PayPalInvoiceResponse[] }>(
        '/v2/invoicing/search-invoices',
        'POST',
        searchRequest
      );

      if (response.total_items && response.total_items > 0 && response.items && response.items.length > 0) {
        console.log('[PayPal Service] Found existing invoice:', response.items[0].id);
        return response.items[0];
      }

      console.log('[PayPal Service] No existing invoice found with number:', invoiceNumber);
      return null;
    } catch (error: any) {
      console.error('[PayPal Service] Error searching for invoice:', error.message);
      return null;
    }
  }

  clearAuthCache(): void {
    this.accessToken = null;
    this.tokenExpiry = 0;
  }

  async testConnection(): Promise<void> {
    try {
      await this.getAccessToken();
    } catch (error) {
      console.error('PayPal connection test failed:', error);
      throw error;
    }
  }
}

export const paypalService = new PayPalService();
