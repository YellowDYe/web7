export interface DeliveryTrackingConfig {
  id: string;
  app_url: string;
  api_key: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface DeliveryTrackingConfigForm {
  app_url: string;
  api_key: string;
}
