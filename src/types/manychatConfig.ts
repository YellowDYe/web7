export interface ManychatConfig {
  id: string;
  api_token: string;
  environment: 'sandbox' | 'production';
  default_phone_field: string;
  default_email_field: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ManychatConfigForm {
  api_token: string;
  environment: 'sandbox' | 'production';
  default_phone_field: string;
  default_email_field: string;
}
