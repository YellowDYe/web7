import { supabase } from '../config/supabase';
import { Invoice, CreateInvoiceData, UpdateInvoiceData } from '../types/invoice';
import { BILLABLE_MEAL_TYPES } from '../types/orderMenu';
import { paypalService } from './paypalService';
import { OrderWithDetails } from '../types/order';
import { calculatePriceBreakdown, formatPriceBreakdown, validatePriceBreakdown } from '../utils/priceCalculations';
import { getCurrentMexicoTimestamp, getCurrentMexicoDate } from '../utils/timezone';

export class InvoiceService {
  private async generateNextInvoiceId(): Promise<string> {
    const timestamp = Date.now();
    const randomComponent = Math.floor(Math.random() * 1000);
    return `INV-${timestamp}-${randomComponent}`;
  }

  private async generateNextInvoiceNumber(): Promise<string> {
    const { data, error } = await supabase.rpc('generate_next_invoice_number');

    if (error) {
      console.error('Error generating invoice number via DB function:', error);
      const currentYear = new Date().getFullYear();
      return `${currentYear}-001`;
    }

    return data as string;
  }

  async createInvoice(
    invoiceData: CreateInvoiceData,
    orderItems: any[],
    selectedDeliveryOption: any,
    planDiscountAmount: number,
    couponDiscountAmount: number,
    customDiscountAmount: number,
    initialInvoiceStatus?: 'draft' | 'paid' | 'cancelled'
  ): Promise<Invoice> {
    const invoice_id = await this.generateNextInvoiceId();
    const invoice_number = await this.generateNextInvoiceNumber();

    console.log('[Invoice Service] Creating invoice with new pricing logic');
    console.log('[Invoice Service] Order items count:', orderItems.length);
    console.log('[Invoice Service] Plan discount amount:', planDiscountAmount);
    console.log('[Invoice Service] Coupon discount amount:', couponDiscountAmount);
    console.log('[Invoice Service] Custom discount amount:', customDiscountAmount);

    let subtotal: number;
    let deliverySubtotal: number;
    let taxAmount: number;
    let deliveryTaxAmount: number;
    let totalAmount: number;

    if (invoiceData.subtotal !== undefined && invoiceData.tax_amount !== undefined && invoiceData.total_amount !== undefined) {
      subtotal = Number(invoiceData.subtotal);
      deliverySubtotal = Number(invoiceData.delivery_option_price || 0);
      taxAmount = Number(invoiceData.tax_amount);
      deliveryTaxAmount = Number(invoiceData.delivery_tax_amount || 0);
      totalAmount = Number(invoiceData.total_amount);

      console.log('[Invoice Service] Using provided financial values');
    } else {
      let ivaRate = 16;
      try {
        const { taxService } = await import('./taxService');
        const ivaData = await taxService.getDefaultIVA();
        ivaRate = Number(ivaData ? ivaData.tax_percentage : 16);
      } catch (error) {
        console.warn('Error loading tax service, using default IVA rate:', error);
      }

      console.log('[Invoice Service] Tax rate:', ivaRate + '%');

      const itemsSubtotal = orderItems
        .filter(item => BILLABLE_MEAL_TYPES.includes(item.meal_type))
        .reduce((total, item) => total + (Number(item.meal_plan_price) * Number(item.quantity)), 0);

      console.log('[Invoice Service] Items subtotal (base prices):', itemsSubtotal);

      const deliveryPrice = selectedDeliveryOption ? Number(selectedDeliveryOption.delivery_options_price) : 0;

      console.log('[Invoice Service] Delivery price (base):', deliveryPrice);

      const breakdown = calculatePriceBreakdown(
        itemsSubtotal,
        planDiscountAmount,
        deliveryPrice,
        couponDiscountAmount,
        customDiscountAmount,
        ivaRate
      );

      console.log('[Invoice Service] Price breakdown calculated:');
      console.log(formatPriceBreakdown(breakdown));

      const validation = validatePriceBreakdown(breakdown);
      if (!validation.valid) {
        console.error('[Invoice Service] Price breakdown validation failed:', validation.errors);
        throw new Error('Price calculation validation failed: ' + validation.errors.join(', '));
      }

      subtotal = breakdown.itemsSubtotal;
      deliverySubtotal = breakdown.deliveryPrice;
      taxAmount = breakdown.taxAmount;
      deliveryTaxAmount = breakdown.deliveryTaxAmount;
      totalAmount = breakdown.finalTotal;

      console.log('[Invoice Service] Final invoice values:');
      console.log('  Subtotal (BEFORE plan discounts):', subtotal);
      console.log('  Delivery:', deliverySubtotal);
      console.log('  Tax (Items):', taxAmount);
      console.log('  Tax (Delivery):', deliveryTaxAmount);
      console.log('  Total:', totalAmount);
    }

    console.log('[Invoice Service] Creating invoice with all values including delivery tax');
    console.log('[Invoice Service] delivery_tax_amount to be saved:', deliveryTaxAmount);

    // Validation: Ensure delivery tax is not missing when delivery exists
    if (deliverySubtotal > 0 && deliveryTaxAmount === 0) {
      console.warn('[Invoice Service] WARNING: Delivery price exists but delivery tax is zero!');
      console.warn('[Invoice Service] Delivery price:', deliverySubtotal);
      console.warn('[Invoice Service] This may indicate a calculation error');
    }

    const { data, error } = await supabase
      .from('invoices')
      .insert([
        {
          ...invoiceData,
          invoice_id,
          invoice_number,
          subtotal: Math.round(subtotal),
          delivery_option_price: Math.round(deliverySubtotal),
          tax_amount: Math.round(taxAmount),
          delivery_tax_amount: Math.round(deliveryTaxAmount),
          total_amount: Math.round(totalAmount),
          bank_account_id: invoiceData.bank_account_id || null,
          invoice_status: initialInvoiceStatus || invoiceData.invoice_status || 'draft',
          plan_discount_amount: Math.round(planDiscountAmount),
          coupon_discount_amount: Math.round(couponDiscountAmount),
          custom_discount_amount: Math.round(customDiscountAmount)
        }
      ])
      .select()
      .single();

    if (error) {
      throw new Error(`Error creating invoice: ${error.message}`);
    }

    return data;
  }

  async getInvoices(): Promise<Invoice[]> {
    const { data, error } = await supabase
      .from('invoices')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Error fetching invoices: ${error.message}`);
    }

    return data || [];
  }

  async getInvoiceByOrderId(orderId: string): Promise<Invoice | null> {
    const { data, error } = await supabase
      .from('invoices')
      .select('*')
      .eq('order_id', orderId)
      .maybeSingle();

    if (error) {
      throw new Error(`Error fetching invoice: ${error.message}`);
    }

    return data;
  }

  async getInvoiceById(id: string): Promise<Invoice | null> {
    const { data, error } = await supabase
      .from('invoices')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new Error(`Error fetching invoice: ${error.message}`);
    }

    return data;
  }

  async updateInvoice(id: string, updateData: UpdateInvoiceData): Promise<Invoice> {
    try {
      const originalInvoice = await this.getInvoiceById(id);
      if (!originalInvoice) {
        throw new Error('Invoice not found');
      }

      const { data, error } = await supabase
        .from('invoices')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        throw new Error(`Error updating invoice: ${error.message}`);
      }

      const updatedInvoice = data;

      await this.handleBankAccountAdjustments(originalInvoice, updatedInvoice, updateData);
      await this.synchronizeOrderStatus(updatedInvoice);

      return updatedInvoice;
    } catch (error) {
      console.error('Error updating invoice:', error);
      throw error;
    }
  }

  private async handleBankAccountAdjustments(
    originalInvoice: Invoice,
    updatedInvoice: Invoice,
    updateData: UpdateInvoiceData
  ): Promise<void> {
    console.log('Invoice updated - movements will be dynamically calculated from invoice data');
  }

  private async synchronizeOrderStatus(invoice: Invoice): Promise<void> {
    try {
      if (invoice.order_id.startsWith('MANUAL-')) {
        return;
      }

      let orderStatus: string;
      switch (invoice.invoice_status) {
        case 'paid':
          orderStatus = 'completed';
          break;
        case 'cancelled':
          orderStatus = 'cancelled';
          break;
        case 'draft':
        default:
          orderStatus = 'pending';
          break;
      }

      const { data: order, error: orderError } = await supabase
        .from('orders')
        .select('id, order_status')
        .eq('order_id', invoice.order_id)
        .single();

      if (!orderError && order && order.order_status !== orderStatus) {
        const { orderService } = await import('./orderService');
        await orderService.updateOrderWithoutInvoiceSync(order.id, { order_status: orderStatus });
        console.log(`Synchronized order ${invoice.order_id} status to ${orderStatus}`);
      }
    } catch (error) {
      console.error('Error synchronizing order status:', error);
    }
  }

  async updateInvoiceOriginal(id: string, updateData: UpdateInvoiceData): Promise<Invoice> {
    const { data, error } = await supabase
      .from('invoices')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Error updating invoice: ${error.message}`);
    }

    return data;
  }

  async deleteInvoice(id: string): Promise<void> {
    try {
      const invoice = await this.getInvoiceById(id);
      
      if (invoice && invoice.order_id && !invoice.order_id.startsWith('MANUAL-')) {
        try {
          const { data: order, error: orderFindError } = await supabase
            .from('orders')
            .select('id')
            .eq('order_id', invoice.order_id)
            .single();
          
          if (!orderFindError && order) {
            const { orderService } = await import('./orderService');
            await orderService.updateOrderWithoutInvoiceSync(order.id, {
              order_invoice_number: ''
            });
          }
        } catch (orderUpdateError) {
          console.error('Error clearing order invoice number:', orderUpdateError);
        }
      }

      const { error } = await supabase
        .from('invoices')
        .delete()
        .eq('id', id);

      if (error) {
        throw new Error(`Error deleting invoice: ${error.message}`);
      }
      
      console.log('Invoice deleted - movements will be automatically excluded from calculations');
    } catch (error) {
      console.error('Error deleting invoice:', error);
      throw error;
    }
  }

  async createInvoiceFromOrder(
    order: any,
    basicData: { customer_name: string; customer_email: string; invoice_summary: string; bank_account_id?: string; payment_date?: string; invoice_group_id?: string },
    orderItems: any[],
    selectedDeliveryOption: any,
    planDiscountAmount: number,
    couponDiscountAmount: number,
    customDiscountAmount: number,
    orderStatus: string
  ): Promise<Invoice> {
    let invoiceStatus: 'draft' | 'paid' | 'cancelled';
    switch (orderStatus) {
      case 'completed':
      case 'delivered':
        invoiceStatus = 'paid';
        break;
      case 'cancelled':
        invoiceStatus = 'cancelled';
        break;
      default:
        invoiceStatus = 'draft';
        break;
    }

    const invoiceData: any = {
      order_id: order.order_id,
      customer_name: basicData.customer_name,
      customer_email: basicData.customer_email,
      invoice_summary: basicData.invoice_summary,
      bank_account_id: basicData.bank_account_id,
      invoice_status: invoiceStatus,
      payment_date: basicData.payment_date
    };

    if (basicData.invoice_group_id) {
      invoiceData.invoice_group_id = basicData.invoice_group_id;
    }

    return this.createInvoice(
      invoiceData,
      orderItems,
      selectedDeliveryOption,
      planDiscountAmount,
      couponDiscountAmount,
      customDiscountAmount,
      invoiceStatus
    );
  }

  async updateInvoiceFromOrder(
    invoiceId: string,
    basicData: { customer_name: string; customer_email: string; invoice_summary: string; bank_account_id?: string },
    orderItems: any[],
    selectedDeliveryOption: any,
    planDiscountAmount: number,
    couponDiscountAmount: number,
    customDiscountAmount: number,
    orderStatus: string
  ): Promise<Invoice> {
    let invoiceStatus: 'draft' | 'paid' | 'cancelled';
    switch (orderStatus) {
      case 'completed':
      case 'delivered':
        invoiceStatus = 'paid';
        break;
      case 'cancelled':
        invoiceStatus = 'cancelled';
        break;
      default:
        invoiceStatus = 'draft';
        break;
    }

    console.log('[Invoice Update] Starting with new pricing logic');
    console.log('[Invoice Update] Plan discount amount:', planDiscountAmount);
    console.log('[Invoice Update] Coupon discount amount:', couponDiscountAmount);
    console.log('[Invoice Update] Custom discount:', customDiscountAmount);

    let ivaRate = 16;
    try {
      const { taxService } = await import('./taxService');
      const ivaData = await taxService.getDefaultIVA();
      ivaRate = Number(ivaData ? ivaData.tax_percentage : 16);
    } catch (error) {
      console.warn('Error loading tax service, using default IVA rate:', error);
    }

    const BILLABLE_MEAL_TYPES = ['Desayuno', 'Comida', 'Cena'];
    const itemsSubtotal = orderItems
      .filter(item => BILLABLE_MEAL_TYPES.includes(item.meal_type))
      .reduce((total, item) => total + (Number(item.meal_plan_price) * Number(item.quantity)), 0);

    console.log('[Invoice Update] Items subtotal (base prices):', itemsSubtotal);

    const deliveryPrice = selectedDeliveryOption ? Number(selectedDeliveryOption.delivery_options_price) : 0;

    const breakdown = calculatePriceBreakdown(
      itemsSubtotal,
      planDiscountAmount,
      deliveryPrice,
      couponDiscountAmount,
      customDiscountAmount,
      ivaRate
    );

    console.log('[Invoice Update] Price breakdown:');
    console.log(formatPriceBreakdown(breakdown));

    const validation = validatePriceBreakdown(breakdown);
    if (!validation.valid) {
      console.error('[Invoice Update] Price breakdown validation failed:', validation.errors);
    }

    // Validation: Ensure delivery tax is not missing when delivery exists
    if (breakdown.deliveryPrice > 0 && breakdown.deliveryTaxAmount === 0) {
      console.warn('[Invoice Update] WARNING: Delivery price exists but delivery tax is zero!');
      console.warn('[Invoice Update] Delivery price:', breakdown.deliveryPrice);
    }

    const updateDataWithCalculations: UpdateInvoiceData = {
      customer_name: basicData.customer_name,
      customer_email: basicData.customer_email,
      invoice_summary: basicData.invoice_summary,
      subtotal: breakdown.itemsSubtotal,
      delivery_option_price: breakdown.deliveryPrice,
      tax_amount: breakdown.taxAmount,
      delivery_tax_amount: breakdown.deliveryTaxAmount,
      total_amount: breakdown.finalTotal,
      bank_account_id: basicData.bank_account_id,
      plan_discount_amount: planDiscountAmount,
      coupon_discount_amount: couponDiscountAmount,
      custom_discount_amount: customDiscountAmount,
      invoice_status: invoiceStatus
    };

    return this.updateInvoice(invoiceId, updateDataWithCalculations);
  }

  async updateInvoiceStatus(id: string, status: Invoice['invoice_status'], payment_date?: string | null): Promise<Invoice> {
    const updateData: UpdateInvoiceData = { invoice_status: status };

    // Explicitly set payment_date based on status if not provided
    if (payment_date !== undefined) {
      updateData.payment_date = payment_date;
    } else {
      // Auto-set payment_date to current timestamp when marking as paid
      if (status === 'paid') {
        updateData.payment_date = getCurrentMexicoTimestamp();
        console.log('[Invoice Status Update] Auto-setting payment_date to current timestamp (Mexico City) for paid invoice');
      } else if (status === 'draft' || status === 'cancelled') {
        // Clear payment_date when status changes away from paid
        updateData.payment_date = null;
        console.log('[Invoice Status Update] Clearing payment_date for non-paid status');
      }
    }

    return this.updateInvoice(id, updateData);
  }

  async createPayPalInvoice(
    invoice: Invoice,
    order: OrderWithDetails,
    orderItems: any[]
  ): Promise<Invoice> {
    try {
      console.log(`[PayPal Invoice] Starting creation for order: ${order.order_id}, invoice: ${invoice.invoice_number}`);
      console.log(`[PayPal Invoice] Order items count: ${orderItems.length}`);

      const validationError = this.validateInvoiceDataBeforePayPal(invoice, order, orderItems);
      if (validationError) {
        console.error('[PayPal Invoice] Pre-validation failed:', validationError);
        throw new Error(validationError);
      }

      const paypalInvoiceResponse = await paypalService.createDraftInvoice(
        invoice,
        order,
        orderItems
      );

      console.log('[PayPal Invoice] Received response from PayPal service');

      if (!paypalInvoiceResponse) {
        console.error('[PayPal Invoice] Response is null or undefined');
        throw new Error('PayPal no devolvió ninguna respuesta');
      }

      const validationResult = this.validatePayPalInvoiceResponse(paypalInvoiceResponse);

      if (!validationResult.isValid) {
        console.error('[PayPal Invoice] Invalid PayPal response structure');
        console.error('[PayPal Invoice] Missing critical fields:', validationResult.missingFields);

        if (paypalInvoiceResponse.id) {
          console.log('[PayPal Invoice] Attempting to save partial data and sync...');

          try {
            const partialInvoice = await this.savePayPalInvoiceData(invoice, paypalInvoiceResponse);
            console.log('[PayPal Invoice] Partial data saved, retrieving full details...');

            try {
              const fullInvoice = await paypalService.getInvoiceDetails(paypalInvoiceResponse.id);
              return this.savePayPalInvoiceData(invoice, fullInvoice);
            } catch (retrieveError) {
              console.error('[PayPal Invoice] Failed to retrieve full invoice:', retrieveError);
              return partialInvoice;
            }
          } catch (saveError) {
            console.error('[PayPal Invoice] Failed to save partial data:', saveError);
            throw new Error(`La factura se creó en PayPal pero no se pudo guardar. ID: ${paypalInvoiceResponse.id}`);
          }
        }

        throw new Error(`La respuesta de PayPal está incompleta. Campos faltantes: ${validationResult.missingFields.join(', ')}`);
      }

      console.log('[PayPal Invoice] Validation passed, saving invoice data...');
      return await this.savePayPalInvoiceData(invoice, paypalInvoiceResponse);
    } catch (error) {
      console.error('[PayPal Invoice] Error creating PayPal invoice:', error);
      throw error;
    }
  }

  private validateInvoiceDataBeforePayPal(
    invoice: Invoice,
    order: OrderWithDetails,
    orderItems: any[]
  ): string | null {
    console.log('[Invoice Validation] Validating invoice data');

    if (!invoice.customer_email || invoice.customer_email.trim() === '') {
      return 'El correo electrónico del cliente es requerido';
    }

    if (!invoice.customer_email.includes('@')) {
      return `El correo electrónico del cliente no es válido: ${invoice.customer_email}`;
    }

    if (!invoice.customer_name || invoice.customer_name.trim().length === 0) {
      return 'El nombre del cliente es requerido';
    }

    if (invoice.total_amount <= 0) {
      return `El monto total debe ser mayor a cero. Total actual: ${invoice.total_amount}`;
    }

    if (!orderItems || orderItems.length === 0) {
      return 'No hay artículos en el pedido para facturar';
    }

    const hasValidItems = orderItems.some(item =>
      item.meal_plans_id &&
      item.meal_plan_price &&
      parseFloat(item.meal_plan_price) > 0 &&
      item.quantity > 0
    );

    if (!hasValidItems) {
      return 'No hay artículos válidos con precio y cantidad en el pedido';
    }

    // Validate plan discount doesn't exceed subtotal
    if (invoice.plan_discount_amount && invoice.plan_discount_amount > 0) {
      if (invoice.plan_discount_amount > invoice.subtotal) {
        return `El descuento del plan ($${invoice.plan_discount_amount.toFixed(2)}) no puede exceder el subtotal de artículos (antes de descuento) ($${invoice.subtotal.toFixed(2)})`;
      }
      if (invoice.plan_discount_amount < 0.01) {
        return `El descuento del plan debe ser al menos $0.01 o dejarse en cero`;
      }
    }

    // Validate custom discount doesn't exceed total
    if (invoice.custom_discount_amount && invoice.custom_discount_amount > 0) {
      const totalBeforeCustomDiscount = invoice.total_amount + invoice.custom_discount_amount;
      if (invoice.custom_discount_amount > totalBeforeCustomDiscount) {
        return `El descuento personalizado ($${invoice.custom_discount_amount.toFixed(2)}) no puede exceder el total antes del descuento ($${totalBeforeCustomDiscount.toFixed(2)})`;
      }
      if (invoice.custom_discount_amount < 0.01) {
        return `El descuento personalizado debe ser al menos $0.01 o dejarse en cero`;
      }
    }

    console.log('[Invoice Validation] All validations passed including discount checks');
    return null;
  }

  private async savePayPalInvoiceData(invoice: Invoice, paypalInvoiceResponse: any): Promise<Invoice> {
    try {
      if (!paypalInvoiceResponse.id) {
        throw new Error('PayPal no devolvió un ID de factura válido');
      }

      const recipientViewUrl = paypalInvoiceResponse.detail?.metadata?.recipient_view_url || null;

      const updateData: UpdateInvoiceData = {
        paypal_invoice_id: paypalInvoiceResponse.id,
        paypal_invoice_status: paypalInvoiceResponse.status?.toLowerCase() || 'draft',
        paypal_invoice_number: paypalInvoiceResponse.detail?.invoice_number || invoice.invoice_number,
        recipient_view_url: recipientViewUrl
      };

      const updatedInvoice = await this.updateInvoice(invoice.id, updateData);

      if (!updatedInvoice.paypal_invoice_id) {
        throw new Error('La factura de PayPal no se guardó correctamente');
      }

      return updatedInvoice;
    } catch (error) {
      console.error('[PayPal Invoice] Error saving to database:', error);
      throw error;
    }
  }

  private validatePayPalInvoiceResponse(response: any): {
    isValid: boolean;
    missingFields: string[];
    responseKeys: string[];
  } {
    const result = {
      isValid: true,
      missingFields: [] as string[],
      responseKeys: [] as string[]
    };

    if (!response) {
      result.isValid = false;
      result.missingFields.push('entire_response');
      return result;
    }

    result.responseKeys = Object.keys(response);

    if (!response.id) {
      result.missingFields.push('id');
      result.isValid = false;
    }

    if (!response.status) {
      result.missingFields.push('status');
      result.isValid = false;
    }

    return result;
  }

  async sendPayPalInvoice(invoice: Invoice): Promise<Invoice> {
    try {
      if (!invoice.paypal_invoice_id) {
        throw new Error('No se ha creado una factura de PayPal para este pedido');
      }

      await paypalService.sendInvoice(
        invoice.paypal_invoice_id,
        `Factura de Hola Dieta - ${invoice.invoice_number}`,
        'Gracias por su pedido. Por favor revise su factura adjunta.'
      );

      const paypalInvoice = await paypalService.getInvoiceDetails(invoice.paypal_invoice_id);

      const recipientViewUrl = paypalInvoice.detail?.metadata?.recipient_view_url || invoice.recipient_view_url;

      const updateData: UpdateInvoiceData = {
        paypal_invoice_status: 'sent',
        paypal_sent_at: getCurrentMexicoDate().toISOString(),
        recipient_view_url: recipientViewUrl
      };

      const updatedInvoice = await this.updateInvoice(invoice.id, updateData);
      return updatedInvoice;
    } catch (error) {
      console.error('Error sending PayPal invoice:', error);
      throw error;
    }
  }

  async syncPayPalInvoiceStatus(invoice: Invoice): Promise<Invoice> {
    try {
      if (!invoice.paypal_invoice_id) {
        throw new Error('No hay una factura de PayPal asociada');
      }

      const paypalInvoice = await paypalService.getInvoiceDetails(invoice.paypal_invoice_id);

      if (!paypalInvoice.status) {
        throw new Error('La respuesta de PayPal no contiene el estado de la factura');
      }

      const recipientViewUrl = paypalInvoice.detail?.metadata?.recipient_view_url || invoice.recipient_view_url;

      const updateData: UpdateInvoiceData = {
        paypal_invoice_status: paypalInvoice.status.toLowerCase(),
        paypal_invoice_number: paypalInvoice.detail?.invoice_number || invoice.invoice_number,
        recipient_view_url: recipientViewUrl
      };

      if (paypalInvoice.status === 'PAID' || paypalInvoice.status === 'MARKED_AS_PAID') {
        updateData.invoice_status = 'paid';
      }

      const updatedInvoice = await this.updateInvoice(invoice.id, updateData);
      return updatedInvoice;
    } catch (error) {
      console.error('[PayPal Sync] Error syncing PayPal invoice status:', error);
      throw error;
    }
  }

  async cancelPayPalInvoice(invoice: Invoice): Promise<Invoice> {
    try {
      if (!invoice.paypal_invoice_id) {
        throw new Error('No hay una factura de PayPal para cancelar');
      }

      await paypalService.cancelInvoice(
        invoice.paypal_invoice_id,
        'Factura cancelada',
        'Esta factura ha sido cancelada.'
      );

      const updateData: UpdateInvoiceData = {
        paypal_invoice_status: 'cancelled'
      };

      const updatedInvoice = await this.updateInvoice(invoice.id, updateData);
      return updatedInvoice;
    } catch (error) {
      console.error('Error cancelling PayPal invoice:', error);
      throw error;
    }
  }

  async deletePayPalInvoice(invoice: Invoice): Promise<Invoice> {
    try {
      if (!invoice.paypal_invoice_id) {
        throw new Error('No hay una factura de PayPal para eliminar');
      }

      await paypalService.deleteInvoice(invoice.paypal_invoice_id);

      const updateData: UpdateInvoiceData = {
        paypal_invoice_id: null,
        paypal_invoice_status: null,
        paypal_sent_at: null,
        paypal_invoice_number: null,
        recipient_view_url: null
      };

      const updatedInvoice = await this.updateInvoice(invoice.id, updateData);
      return updatedInvoice;
    } catch (error) {
      console.error('Error deleting PayPal invoice:', error);
      throw error;
    }
  }

  async sendPayPalReminder(invoice: Invoice): Promise<Invoice> {
    try {
      if (!invoice.paypal_invoice_id) {
        throw new Error('No hay una factura de PayPal para enviar recordatorio');
      }

      await paypalService.sendReminder(
        invoice.paypal_invoice_id,
        `Recordatorio: Factura ${invoice.invoice_number} - Hola Dieta`,
        'Este es un recordatorio amigable sobre su factura pendiente.'
      );

      return invoice;
    } catch (error) {
      console.error('Error sending PayPal reminder:', error);
      throw error;
    }
  }
}

export const invoiceService = new InvoiceService();
