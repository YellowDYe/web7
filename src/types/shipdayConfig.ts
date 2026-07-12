export interface ShipdayConfig {
  id: string;
  api_key: string;
  restaurant_name: string;
  restaurant_address: string;
  restaurant_phone: string;
  default_pickup_time: string;
  default_delivery_time: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ShipdayConfigForm {
  api_key: string;
  restaurant_name: string;
  restaurant_address: string;
  restaurant_phone: string;
  default_pickup_time: string;
  default_delivery_time: string;
}

export interface CreateShipdayConfigData {
  api_key: string;
  restaurant_name: string;
  restaurant_address: string;
  restaurant_phone: string;
  default_pickup_time?: string;
  default_delivery_time?: string;
  is_active?: boolean;
}

export interface UpdateShipdayConfigData {
  api_key?: string;
  restaurant_name?: string;
  restaurant_address?: string;
  restaurant_phone?: string;
  default_pickup_time?: string;
  default_delivery_time?: string;
  is_active?: boolean;
}
