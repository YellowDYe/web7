export interface EmailConfiguration {
  id: string;
  config_key: string;
  config_value: string;
  config_description: string;
  is_encrypted: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateEmailConfigData {
  config_key: string;
  config_value: string;
  config_description: string;
  is_encrypted?: boolean;
}

export interface UpdateEmailConfigData {
  config_value?: string;
  config_description?: string;
  is_encrypted?: boolean;
}

export interface EmailConfigForm {
  mailgun_api_key: string;
  mailgun_domain: string;
  mailgun_base_url: string;
}