// Shipday API Types
// Based on Shipday API documentation: https://api-docs.shipday.com

export interface ShipdayOrderItem {
  name: string;
  quantity: number;
  unitPrice: number;
  addOns?: string[];
  detail?: string;
}

export interface ShipdayOrderRequest {
  orderNumber: string;
  customerName: string;
  customerAddress: string;
  customerEmail?: string;
  customerPhoneNumber: string;
  restaurantName: string;
  restaurantAddress: string;
  restaurantPhoneNumber?: string;
  expectedDeliveryDate: string;
  expectedDeliveryTime: string;
  expectedPickupTime?: string;
  orderItem: ShipdayOrderItem[];
  tips?: number;
  tax?: number;
  discountAmount?: number;
  deliveryFee?: number;
  totalOrderCost: number;
  pickupInstruction?: string;
  deliveryInstruction?: string;
  orderSource?: string;
  additionalId?: string;
}

export interface ShipdayOrderResponse {
  orderId?: number | null;
  orderNumber?: string;
  trackingLink?: string;
  message?: string;
  success?: boolean;
  response?: string;
}

export interface ShipdayErrorResponse {
  error: string;
  message: string;
  statusCode?: number;
}

export interface ShipdaySubmission {
  id: string;
  order_id: string;
  delivery_date: string;
  shipday_order_number?: string;
  shipday_order_id?: number | null;
  submission_status: 'pending' | 'success' | 'failed';
  api_response?: any;
  error_message?: string;
  submitted_at: string;
  created_at: string;
  updated_at: string;
}

export interface ShipdayConfig {
  api_key: string;
  base_url: string;
  restaurant_name: string;
  restaurant_address: string;
  restaurant_phone: string;
}

export interface ShipdaySubmissionResult {
  success: boolean;
  order_id: string;
  shipday_order_number?: string;
  shipday_order_id?: number | null;
  error_message?: string;
}

export interface ShipdayBatchSubmissionResult {
  total_orders: number;
  successful_submissions: number;
  failed_submissions: number;
  results: ShipdaySubmissionResult[];
}

export interface ShipdayCarrier {
  id: number;
  personalId: string;
  name: string;
  codeName: string;
  phoneNumber: string;
  companyId: number;
  areaId: number;
  isOnShift: boolean;
  email: string;
  carrierPhoto: string;
  isActive: boolean;
  carrrierLocationLat?: number;
  carrrierLocationLng?: number;
}

export interface CreateShipdayCarrierRequest {
  name: string;
  email: string;
  phoneNumber: string;
}

export interface CreateShipdayCarrierResponse {
  carrierId?: number;
  success?: boolean;
  message?: string;
  response?: string;
}

export interface ShipdayCarrierSyncResult {
  success: boolean;
  carrierId?: number;
  errorMessage?: string;
}

export interface ShipdayOrderStatus {
  is_submitted: boolean;
  carrier_assigned: boolean;
  shipday_carrier_id?: number | null;
}

export interface ShipdaySyncResult {
  synced: number;
  failed: number;
  skipped: number;
  errors: string[];
}
