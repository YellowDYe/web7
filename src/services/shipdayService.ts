import { supabase } from '../config/supabase';
import {
  ShipdayOrderRequest,
  ShipdayOrderResponse,
  ShipdayErrorResponse,
  ShipdaySubmission,
  ShipdaySubmissionResult,
  ShipdayBatchSubmissionResult,
  ShipdayConfig,
  ShipdayOrderItem,
  ShipdayCarrier,
  CreateShipdayCarrierRequest,
  CreateShipdayCarrierResponse,
  ShipdayCarrierSyncResult,
  ShipdayOrderStatus,
  ShipdaySyncResult
} from '../types/shipday';
import {
  ShipdayConfig as ShipdayDBConfig,
  ShipdayConfigForm,
  CreateShipdayConfigData,
  UpdateShipdayConfigData
} from '../types/shipdayConfig';
import { DeliveryOrder } from '../types/delivery';
import { getCurrentMexicoTimestamp } from '../utils/timezone';

export class ShipdayService {
  private configCache: ShipdayDBConfig | null = null;
  private cacheTimestamp: number = 0;
  private readonly CACHE_DURATION = 5 * 60 * 1000;
  private baseUrl = 'https://api.shipday.com';

  /**
   * Normalize a date string to YYYY-MM-DD format for PostgreSQL date comparison
   */
  private normalizeDateString(dateString: string): string {
    // Remove any time or timezone information, keep only YYYY-MM-DD
    return dateString.split('T')[0];
  }

  private async loadConfig(): Promise<ShipdayDBConfig | null> {
    const now = Date.now();
    if (this.configCache && (now - this.cacheTimestamp) < this.CACHE_DURATION) {
      return this.configCache;
    }

    try {
      const { data, error } = await supabase
        .from('shipday_config')
        .select('*')
        .eq('is_active', true)
        .maybeSingle();

      if (error) {
        console.error('Error loading Shipday config:', error);
        return null;
      }

      this.configCache = data;
      this.cacheTimestamp = now;

      return data;
    } catch (error) {
      console.error('Error loading Shipday configuration:', error);
      return null;
    }
  }

  async getConfig(): Promise<ShipdayConfig | null> {
    const dbConfig = await this.loadConfig();
    if (!dbConfig) {
      return null;
    }
    return {
      api_key: dbConfig.api_key,
      base_url: this.baseUrl,
      restaurant_name: dbConfig.restaurant_name,
      restaurant_address: dbConfig.restaurant_address,
      restaurant_phone: dbConfig.restaurant_phone
    };
  }

  async getConfigForm(): Promise<ShipdayConfigForm> {
    const dbConfig = await this.loadConfig();
    if (!dbConfig) {
      return {
        api_key: '',
        restaurant_name: '',
        restaurant_address: '',
        restaurant_phone: '',
        default_pickup_time: '19:00:00',
        default_delivery_time: '20:30:00'
      };
    }
    return {
      api_key: dbConfig.api_key,
      restaurant_name: dbConfig.restaurant_name,
      restaurant_address: dbConfig.restaurant_address,
      restaurant_phone: dbConfig.restaurant_phone,
      default_pickup_time: dbConfig.default_pickup_time,
      default_delivery_time: dbConfig.default_delivery_time
    };
  }

  async isConfigured(): Promise<boolean> {
    const config = await this.loadConfig();
    return config !== null;
  }

  async createConfig(configData: CreateShipdayConfigData): Promise<ShipdayDBConfig> {
    const { data, error } = await supabase
      .from('shipday_config')
      .insert({
        api_key: configData.api_key,
        restaurant_name: configData.restaurant_name,
        restaurant_address: configData.restaurant_address,
        restaurant_phone: configData.restaurant_phone,
        is_active: configData.is_active ?? true
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Error creating Shipday config: ${error.message}`);
    }

    this.configCache = null;
    return data;
  }

  async updateConfig(configData: UpdateShipdayConfigData): Promise<ShipdayDBConfig> {
    const existingConfig = await this.loadConfig();
    if (!existingConfig) {
      throw new Error('No Shipday configuration found. Please create one first.');
    }

    const { data, error } = await supabase
      .from('shipday_config')
      .update({
        ...(configData.api_key !== undefined && { api_key: configData.api_key }),
        ...(configData.restaurant_name !== undefined && { restaurant_name: configData.restaurant_name }),
        ...(configData.restaurant_address !== undefined && { restaurant_address: configData.restaurant_address }),
        ...(configData.restaurant_phone !== undefined && { restaurant_phone: configData.restaurant_phone }),
        ...(configData.default_pickup_time !== undefined && { default_pickup_time: configData.default_pickup_time }),
        ...(configData.default_delivery_time !== undefined && { default_delivery_time: configData.default_delivery_time }),
        ...(configData.is_active !== undefined && { is_active: configData.is_active })
      })
      .eq('id', existingConfig.id)
      .select()
      .single();

    if (error) {
      throw new Error(`Error updating Shipday config: ${error.message}`);
    }

    this.configCache = null;
    return data;
  }

  async saveConfig(configData: ShipdayConfigForm): Promise<void> {
    const isConfigured = await this.isConfigured();

    if (isConfigured) {
      await this.updateConfig(configData);
    } else {
      await this.createConfig(configData);
    }
  }

  private async transformOrderToShipday(order: DeliveryOrder, deliveryDate: string): Promise<ShipdayOrderRequest> {
    const config = await this.loadConfig();
    if (!config) {
      throw new Error('Restaurant configuration not loaded');
    }

    // Extract numeric-only order number from order_id
    const orderNumber = order.order_id.replace(/\D/g, '');
    if (!orderNumber) {
      throw new Error('Unable to extract numeric order number from order ID');
    }

    // Build complete customer address (street + street_number + colonia + postal_code + Mexico)
    // Note: Interior number and delegacion are excluded from address, interior goes in deliveryInstruction
    const addressParts = [
      order.customer_street,
      order.customer_street_number,
      order.customer_colonia,
      order.customer_postal_code,
      'Mexico'
    ].filter(Boolean);

    const completeAddress = addressParts.join(', ');

    // Shipday expects separate date and time fields in HH:mm:ss format
    const expectedDeliveryTime = config.default_delivery_time || '20:30:00';
    const expectedPickupTime = config.default_pickup_time || '19:00:00';

    // Create order items from the order
    const orderItems: ShipdayOrderItem[] = [
      {
        name: `Order ${order.order_id}`,
        quantity: 1,
        unitPrice: order.order_total_price
      }
    ];

    // Format delivery instruction with interior number
    const deliveryInstruction = order.customer_interior_number
      ? `Int. ${order.customer_interior_number}`
      : undefined;

    // Build Shipday order request with separate date and time fields
    const shipdayOrder: ShipdayOrderRequest = {
      orderNumber: orderNumber,
      customerName: order.order_customer_name,
      customerAddress: completeAddress,
      customerPhoneNumber: order.customer_phone || '',
      customerEmail: order.order_customer_email || undefined,
      restaurantName: config.restaurant_name,
      restaurantAddress: config.restaurant_address,
      restaurantPhoneNumber: config.restaurant_phone,
      expectedDeliveryDate: deliveryDate,
      expectedDeliveryTime: expectedDeliveryTime,
      expectedPickupTime: expectedPickupTime,
      orderItem: orderItems,
      totalOrderCost: order.order_total_price,
      deliveryFee: 0,
      tips: 0,
      discountAmount: 0,
      tax: 0,
      deliveryInstruction: deliveryInstruction,
      orderSource: 'Web Application'
    };

    return shipdayOrder;
  }

  private async makeApiRequest(
    endpoint: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    body?: any
  ): Promise<any> {
    const config = await this.loadConfig();
    if (!config) {
      throw new Error('Shipday API key not configured');
    }

    const url = `${this.baseUrl}${endpoint}`;

    // Clean the API key (remove any extra spaces)
    const cleanApiKey = config.api_key.trim();

    const headers = {
      'Authorization': `Basic ${cleanApiKey}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined
      });

      // Try to parse response as JSON
      let data;
      const responseText = await response.text();

      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        console.error('Failed to parse response as JSON:', parseError);
        data = { raw: responseText };
      }

      if (!response.ok) {
        const errorData = data as ShipdayErrorResponse;
        const errorMessage = `Shipday API Error (${response.status}): ${errorData.message || errorData.error || response.statusText || responseText}`;
        throw new Error(errorMessage);
      }

      return data;
    } catch (error) {
      console.error('Shipday API Error:', error);
      throw error;
    }
  }

  async submitOrder(order: DeliveryOrder, deliveryDate: string): Promise<ShipdaySubmissionResult> {
    try {
      // Validate order data
      if (!order.customer_phone) {
        throw new Error('Customer phone number is required');
      }

      if (!order.customer_street || !order.customer_colonia) {
        throw new Error('Complete customer address is required');
      }

      // Transform order to Shipday format
      const shipdayOrder = await this.transformOrderToShipday(order, deliveryDate);

      // Submit to Shipday API
      const response = await this.makeApiRequest('/orders', 'POST', shipdayOrder) as ShipdayOrderResponse;

      // Validate Shipday API response
      if (!response.orderId || response.success === false) {
        const errorMessage = response.response || response.message || 'Order submission failed - no order ID returned';
        console.error(`Shipday validation failed for order ${order.order_id}:`, errorMessage);

        // Record failed validation in database
        await supabase
          .from('shipday_submissions')
          .insert({
            order_id: order.order_id,
            delivery_date: deliveryDate,
            submission_status: 'failed',
            api_response: response,
            error_message: errorMessage,
            submitted_at: getCurrentMexicoTimestamp()
          });

        throw new Error(errorMessage);
      }

      // The order number we sent to Shipday is the numeric part of the local order_id
      const shipdayOrderNumber = order.order_id.replace(/\D/g, '');
      // The internal Shipday order ID (required for carrier assignment endpoint)
      const shipdayOrderId = response.orderId ?? null;

      // Record successful submission in database
      const { error: dbError } = await supabase
        .from('shipday_submissions')
        .insert({
          order_id: order.order_id,
          delivery_date: deliveryDate,
          shipday_order_number: shipdayOrderNumber,
          shipday_order_id: shipdayOrderId,
          submission_status: 'success',
          api_response: response,
          submitted_at: getCurrentMexicoTimestamp()
        });

      if (dbError) {
        console.error('Error recording Shipday submission:', dbError);
      }

      return {
        success: true,
        order_id: order.order_id,
        shipday_order_number: shipdayOrderNumber,
        shipday_order_id: shipdayOrderId
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`Failed to submit order ${order.order_id} to Shipday:`, errorMessage);

      // Record failed submission in database
      await supabase
        .from('shipday_submissions')
        .insert({
          order_id: order.order_id,
          delivery_date: deliveryDate,
          submission_status: 'failed',
          error_message: errorMessage,
          submitted_at: getCurrentMexicoTimestamp()
        });

      return {
        success: false,
        order_id: order.order_id,
        error_message: errorMessage
      };
    }
  }

  private getActualDeliveryDate(order: DeliveryOrder, selectedDate: string): string {
    // If order has multiple delivery dates (week_delivery_dates array)
    if (order.week_delivery_dates && order.week_delivery_dates.length > 0) {
      // Check if the selected date is one of the delivery dates
      const normalizedSelectedDate = selectedDate.split('T')[0];
      const matchingDate = order.week_delivery_dates.find(date => {
        const normalizedDate = date.split('T')[0];
        return normalizedDate === normalizedSelectedDate;
      });

      if (matchingDate) {
        return matchingDate.split('T')[0];
      }

      // If selected date not found, use the first delivery date
      return order.week_delivery_dates[0].split('T')[0];
    }

    // If order has single delivery_date
    if (order.delivery_date) {
      return order.delivery_date.split('T')[0];
    }

    // Fallback to order_date
    return order.order_date.split('T')[0];
  }

  async submitOrdersForDate(
    orders: DeliveryOrder[],
    selectedDate: string,
    options: { force?: boolean } = {}
  ): Promise<ShipdayBatchSubmissionResult> {
    const results: ShipdaySubmissionResult[] = [];
    const { force = false } = options;

    // Process orders sequentially to avoid overwhelming the API
    for (const order of orders) {
      try {
        // Get the actual delivery date for this order
        const actualDeliveryDate = this.getActualDeliveryDate(order, selectedDate);

        // Check if already submitted for this specific date (unless force mode)
        if (!force) {
          const alreadySubmitted = await this.checkOrderAlreadySubmitted(order.order_id, actualDeliveryDate);

          if (alreadySubmitted) {
            results.push({
              success: false,
              order_id: order.order_id,
              error_message: `Order already submitted to Shipday for delivery date ${actualDeliveryDate}`
            });
            continue;
          }
        }

        // Submit the order with the actual delivery date
        const result = await this.submitOrder(order, actualDeliveryDate);
        results.push(result);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        results.push({
          success: false,
          order_id: order.order_id,
          error_message: errorMessage
        });
      }

      // Add small delay between requests to respect rate limits
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    const successfulSubmissions = results.filter(r => r.success).length;
    const failedSubmissions = results.filter(r => !r.success).length;

    return {
      total_orders: orders.length,
      successful_submissions: successfulSubmissions,
      failed_submissions: failedSubmissions,
      results
    };
  }

  async getSubmissionsForDate(deliveryDate: string): Promise<ShipdaySubmission[]> {
    // Normalize the date to YYYY-MM-DD format for proper comparison
    const normalizedDate = this.normalizeDateString(deliveryDate);

    const { data, error } = await supabase
      .from('shipday_submissions')
      .select('*')
      .eq('delivery_date', normalizedDate)
      .order('submitted_at', { ascending: false });

    if (error) {
      throw new Error(`Error fetching Shipday submissions: ${error.message}`);
    }

    return data || [];
  }

  async getSubmissionForOrder(orderId: string, deliveryDate: string): Promise<ShipdaySubmission | null> {
    // Normalize the date to YYYY-MM-DD format for proper comparison
    const normalizedDate = this.normalizeDateString(deliveryDate);

    const { data, error } = await supabase
      .from('shipday_submissions')
      .select('*')
      .eq('order_id', orderId)
      .eq('delivery_date', normalizedDate)
      .order('submitted_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('Error fetching Shipday submission:', error);
      return null;
    }

    return data;
  }

  async checkOrderAlreadySubmitted(orderId: string, deliveryDate: string): Promise<boolean> {
    const submission = await this.getSubmissionForOrder(orderId, deliveryDate);
    return submission !== null && submission.submission_status === 'success' && submission.shipday_order_number != null;
  }

  async testConnection(): Promise<{ success: boolean; message: string; data?: any }> {
    try {
      console.log('Testing Shipday API connection...');

      const config = await this.loadConfig();
      if (!config) {
        return {
          success: false,
          message: 'Shipday configuration not found'
        };
      }

      // Test the API by fetching orders
      const response = await this.makeApiRequest('/orders', 'GET');

      return {
        success: true,
        message: 'Connection successful! API key is valid.',
        data: response
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        success: false,
        message: `Connection failed: ${errorMessage}`
      };
    }
  }

  async deleteSubmissionRecordsForDate(deliveryDate: string): Promise<number> {
    // Normalize the date to YYYY-MM-DD format for proper comparison
    const normalizedDate = this.normalizeDateString(deliveryDate);

    const { data, error } = await supabase
      .from('shipday_submissions')
      .delete()
      .eq('delivery_date', normalizedDate)
      .select();

    if (error) {
      throw new Error(`Error deleting Shipday submissions: ${error.message}`);
    }

    return data?.length || 0;
  }

  async deleteSubmissionRecords(orderIds: string[], deliveryDate: string): Promise<number> {
    // Normalize the date to YYYY-MM-DD format for proper comparison
    const normalizedDate = this.normalizeDateString(deliveryDate);

    const { data, error } = await supabase
      .from('shipday_submissions')
      .delete()
      .in('order_id', orderIds)
      .eq('delivery_date', normalizedDate)
      .select();

    if (error) {
      console.error('Error deleting Shipday submissions:', error);
      throw new Error(`Error deleting Shipday submissions: ${error.message}`);
    }

    return data?.length || 0;
  }

  async getOrdersFromShipday(deliveryDate: string): Promise<any[]> {
    try {
      // Normalize the date to YYYY-MM-DD format for proper comparison
      const normalizedDate = this.normalizeDateString(deliveryDate);

      const response = await this.makeApiRequest('/orders', 'GET');

      if (!response || !Array.isArray(response)) {
        return [];
      }

      // Filter orders by delivery date - try multiple field names
      const ordersForDate = response.filter((order: any) => {
        // Try deliveryTime field first (new format)
        if (order.deliveryTime) {
          const orderDate = order.deliveryTime.split('T')[0];
          if (orderDate === normalizedDate) {
            return true;
          }
        }

        // Fallback to expectedDeliveryDate field (old format)
        if (order.expectedDeliveryDate) {
          const orderDate = order.expectedDeliveryDate.split('T')[0];
          if (orderDate === normalizedDate) {
            return true;
          }
        }

        return false;
      });

      return ordersForDate;
    } catch (error) {
      console.error('Error fetching orders from Shipday:', error);
      throw error;
    }
  }

  async getShipdayOrderUrl(shipdayOrderNumber: string): Promise<string> {
    return `https://app.shipday.com/orders/${shipdayOrderNumber}`;
  }

  async resubmitOrders(orderIds: string[], orders: DeliveryOrder[], deliveryDate: string): Promise<ShipdayBatchSubmissionResult> {
    // First, delete existing submission records
    await this.deleteSubmissionRecords(orderIds, deliveryDate);

    // Filter orders to only the ones being resubmitted
    const ordersToSubmit = orders.filter(o => orderIds.includes(o.order_id));

    // Submit orders with force mode to bypass the already-submitted check
    return await this.submitOrdersForDate(ordersToSubmit, deliveryDate, { force: true });
  }

  async cleanupFailedSubmissions(deliveryDate: string): Promise<number> {
    // Normalize the date to YYYY-MM-DD format for proper comparison
    const normalizedDate = this.normalizeDateString(deliveryDate);

    const { data, error } = await supabase
      .from('shipday_submissions')
      .delete()
      .eq('delivery_date', normalizedDate)
      .eq('submission_status', 'failed')
      .select();

    if (error) {
      console.error('Error cleaning up failed submissions:', error);
      throw new Error(`Error cleaning up failed submissions: ${error.message}`);
    }

    return data?.length || 0;
  }

  async forceDeleteAllRecords(orderIds: string[], deliveryDate: string): Promise<number> {
    // This method forcefully deletes ALL records for the given orders and date
    // regardless of status, to help users recover from stuck states
    const normalizedDate = this.normalizeDateString(deliveryDate);

    // Delete all records (success, failed, any status)
    const { data, error } = await supabase
      .from('shipday_submissions')
      .delete()
      .in('order_id', orderIds)
      .eq('delivery_date', normalizedDate)
      .select();

    if (error) {
      console.error('Error force deleting records:', error);
      throw new Error(`Error force deleting records: ${error.message}`);
    }

    return data?.length || 0;
  }

  // ─── Carrier (Repartidor) Management ───────────────────────────────────────

  async getCarriers(): Promise<ShipdayCarrier[]> {
    const data = await this.makeApiRequest('/carriers', 'GET');
    return Array.isArray(data) ? data : [];
  }

  async createCarrier(carrierData: CreateShipdayCarrierRequest): Promise<ShipdayCarrierSyncResult> {
    try {
      const response = await this.makeApiRequest('/carriers', 'POST', carrierData) as CreateShipdayCarrierResponse;

      const carrierId = response.carrierId;

      if (!carrierId) {
        return {
          success: false,
          errorMessage: response.message || response.response || 'No carrier ID returned from Shipday'
        };
      }

      return { success: true, carrierId };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error creating carrier';
      return { success: false, errorMessage: message };
    }
  }

  async deleteCarrier(carrierId: number): Promise<{ success: boolean; errorMessage?: string }> {
    try {
      await this.makeApiRequest(`/carriers/${carrierId}`, 'DELETE');
      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error deleting carrier';
      return { success: false, errorMessage: message };
    }
  }

  // ─── Carrier Assignment Sync ─────────────────────────────────────────────────

  async syncCarrierAssignment(
    orderId: string,
    deliveryDate: string,
    shipdayCarrierId: number | null
  ): Promise<{ success: boolean; errorMessage?: string }> {
    try {
      const submission = await this.getSubmissionForOrder(orderId, deliveryDate);
      if (!submission || submission.submission_status !== 'success' || !submission.shipday_order_number) {
        return { success: false, errorMessage: 'Order not submitted to Shipday' };
      }

      const shipdayInternalId = submission.shipday_order_id;
      if (!shipdayInternalId) {
        return { success: false, errorMessage: 'Shipday internal order ID not available. Re-submit the order to Shipday first.' };
      }

      if (shipdayCarrierId !== null) {
        // PUT /orders/assign/{shipdayOrderId}/{carrierId} — uses Shipday internal order ID
        await this.makeApiRequest(`/orders/assign/${shipdayInternalId}/${shipdayCarrierId}`, 'PUT');
      }
      // No standard unassign endpoint in Shipday API — skip silently when unassigning

      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error syncing carrier';
      return { success: false, errorMessage: message };
    }
  }

  async syncAllCarrierAssignmentsForDate(
    orderDriverMap: Array<{ orderId: string; shipdayCarrierId: number | null }>,
    deliveryDate: string
  ): Promise<ShipdaySyncResult> {
    const result: ShipdaySyncResult = { synced: 0, failed: 0, skipped: 0, errors: [] };

    const submissions = await this.getSubmissionsForDate(deliveryDate);
    const submissionMap = new Map<string, typeof submissions[0]>();
    submissions
      .filter(s => s.submission_status === 'success' && s.shipday_order_number)
      .forEach(s => submissionMap.set(s.order_id, s));

    for (const { orderId, shipdayCarrierId } of orderDriverMap) {
      const submission = submissionMap.get(orderId);
      if (!submission || !submission.shipday_order_number) {
        result.skipped++;
        continue;
      }

      if (!submission.shipday_order_id) {
        result.skipped++;
        result.errors.push(`Order ${orderId}: Shipday internal order ID not available. Re-submit the order to Shipday first.`);
        continue;
      }

      if (shipdayCarrierId === null) {
        // No unassign endpoint — count as skipped
        result.skipped++;
        continue;
      }

      try {
        // PUT /orders/assign/{shipdayOrderId}/{carrierId} — uses Shipday internal order ID
        await this.makeApiRequest(
          `/orders/assign/${submission.shipday_order_id}/${shipdayCarrierId}`,
          'PUT'
        );
        result.synced++;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        result.failed++;
        result.errors.push(`Order ${orderId}: ${message}`);
      }

      await new Promise(resolve => setTimeout(resolve, 200));
    }

    return result;
  }

  async getAllOrdersFromShipday(): Promise<any[]> {
    try {
      const response = await this.makeApiRequest('/orders', 'GET');
      if (!response || !Array.isArray(response)) {
        return [];
      }
      return response;
    } catch (error) {
      console.error('Error fetching all orders from Shipday:', error);
      return [];
    }
  }

  async getShipdayOrderStatusMap(deliveryDate: string): Promise<Map<string, ShipdayOrderStatus>> {
    const statusMap = new Map<string, ShipdayOrderStatus>();

    try {
      const submissions = await this.getSubmissionsForDate(deliveryDate);
      const successfulSubmissions = submissions.filter(
        s => s.submission_status === 'success' && s.shipday_order_number
      );

      if (successfulSubmissions.length === 0) {
        return statusMap;
      }

      let shipdayOrders: any[] = [];
      let allShipdayOrders: any[] | null = null;
      try {
        shipdayOrders = await this.getOrdersFromShipday(deliveryDate);
      } catch {
        // If Shipday API fails, still return submitted status without carrier info
      }

      const shipdayOrderMap = new Map<string, any>();
      shipdayOrders.forEach(order => {
        const orderNumber = order.orderNumber != null ? String(order.orderNumber) : null;
        if (orderNumber) {
          shipdayOrderMap.set(orderNumber, order);
        }
      });

      for (const submission of successfulSubmissions) {
        const localOrderNumber = submission.order_id.replace(/\D/g, '');
        let shipdayOrder = shipdayOrderMap.get(localOrderNumber);

        // Fallback: if the order wasn't found in the date-filtered set (e.g. UTC/timezone
        // mismatch causes Shipday to store a different date), fetch the full order list once
        // and search by order number across all dates.
        if (!shipdayOrder) {
          if (allShipdayOrders === null) {
            allShipdayOrders = await this.getAllOrdersFromShipday();
          }
          shipdayOrder = allShipdayOrders.find(
            (o: any) => o.orderNumber != null && String(o.orderNumber) === localOrderNumber
          ) ?? undefined;
        }

        // Shipday returns assignedCarrierId (-1 = unassigned) and assignedCarrier (null = unassigned)
        const assignedCarrierId: number | null =
          shipdayOrder?.assignedCarrierId != null && shipdayOrder.assignedCarrierId !== -1
            ? shipdayOrder.assignedCarrierId
            : shipdayOrder?.assignedCarrier?.id ?? null;

        const isAssigned = assignedCarrierId !== null && assignedCarrierId !== -1;

        statusMap.set(submission.order_id, {
          is_submitted: true,
          carrier_assigned: isAssigned,
          shipday_carrier_id: isAssigned ? assignedCarrierId : null
        });
      }
    } catch (error) {
      console.error('Error building Shipday status map:', error);
    }

    return statusMap;
  }
}

export const shipdayService = new ShipdayService();
