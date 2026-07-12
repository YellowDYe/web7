export interface DeliveryOption {
  id: string;
  delivery_options_id: string;
  delivery_options_name: string;
  delivery_options_description: string;
  delivery_options_price: number;
  created_at: string;
  updated_at: string;
}

export interface CreateDeliveryOptionData {
  delivery_options_name: string;
  delivery_options_description: string;
  delivery_options_price: number;
}

export interface UpdateDeliveryOptionData {
  delivery_options_name?: string;
  delivery_options_description?: string;
  delivery_options_price?: number;
}