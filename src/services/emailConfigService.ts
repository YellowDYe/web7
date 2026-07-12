import { supabase } from '../config/supabase';
import { EmailConfiguration, CreateEmailConfigData, UpdateEmailConfigData, EmailConfigForm } from '../types/emailConfig';

export class EmailConfigService {
  // Get all email configurations
  async getConfigurations(): Promise<EmailConfiguration[]> {
    const { data, error } = await supabase
      .from('email_configuration')
      .select('*')
      .order('config_key', { ascending: true });

    if (error) {
      throw new Error(`Error fetching email configurations: ${error.message}`);
    }

    return data || [];
  }

  // Get configuration by key
  async getConfigurationByKey(key: string): Promise<EmailConfiguration | null> {
    const { data, error } = await supabase
      .from('email_configuration')
      .select('*')
      .eq('config_key', key);

    if (error) {
      throw new Error(`Error fetching configuration: ${error.message}`);
    }

    return data && data.length > 0 ? data[0] : null;
  }

  // Get email configuration as form data
  async getEmailConfigForm(): Promise<EmailConfigForm> {
    const configurations = await this.getConfigurations();
    
    const configMap = configurations.reduce((acc, config) => {
      acc[config.config_key] = config.config_value;
      return acc;
    }, {} as Record<string, string>);

    return {
      mailgun_api_key: configMap.mailgun_api_key || '',
      mailgun_domain: configMap.mailgun_domain || 'mg.holadieta.mx',
      mailgun_base_url: configMap.mailgun_base_url || 'https://api.mailgun.net/v3'
    };
  }

  // Update configuration by key
  async updateConfiguration(key: string, updateData: UpdateEmailConfigData): Promise<EmailConfiguration> {
    // Use upsert to handle both insert and update in a single operation
    const upsertData = {
      config_key: key,
      config_value: updateData.config_value,
      config_description: updateData.config_description || this.getDefaultDescription(key),
      is_encrypted: updateData.is_encrypted !== undefined ? updateData.is_encrypted : this.getDefaultEncryption(key),
      updated_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('email_configuration')
      .upsert([upsertData], { onConflict: 'config_key' })
      .select()
      .single();

    if (error) {
      throw new Error(`Error updating configuration: ${error.message}`);
    }

    return data;
  }

  // Helper method to get default descriptions
  private getDefaultDescription(key: string): string {
    const descriptions: Record<string, string> = {
      'mailgun_api_key': 'Mailgun API key for sending emails',
      'mailgun_domain': 'Mailgun domain for sending emails',
      'mailgun_base_url': 'Mailgun API base URL'
    };
    return descriptions[key] || '';
  }

  // Helper method to get default encryption settings
  private getDefaultEncryption(key: string): boolean {
    const encryptedKeys = ['mailgun_api_key'];
    return encryptedKeys.includes(key);
  }

  // Update multiple configurations at once
  async updateEmailConfig(configForm: EmailConfigForm): Promise<void> {
    const updates = [
      { 
        key: 'mailgun_api_key', 
        value: configForm.mailgun_api_key,
        description: 'Mailgun API key for sending emails',
        is_encrypted: true
      },
      { 
        key: 'mailgun_domain', 
        value: configForm.mailgun_domain,
        description: 'Mailgun domain for sending emails',
        is_encrypted: false
      },
      { 
        key: 'mailgun_base_url', 
        value: configForm.mailgun_base_url,
        description: 'Mailgun API base URL',
        is_encrypted: false
      }
    ];

    for (const update of updates) {
      await this.updateConfiguration(update.key, { 
        config_value: update.value,
        config_description: update.description,
        is_encrypted: update.is_encrypted
      });
    }
  }

  // Legacy update method - keeping for backward compatibility
  async updateEmailConfigLegacy(configForm: EmailConfigForm): Promise<void> {
    const upsertData = [
      {
        config_key: 'mailgun_api_key',
        config_value: configForm.mailgun_api_key,
        config_description: 'Mailgun API key for sending emails',
        is_encrypted: true
      },
      {
        config_key: 'mailgun_domain',
        config_value: configForm.mailgun_domain,
        config_description: 'Mailgun domain for sending emails',
        is_encrypted: false
      },
      {
      config_key: key,
        config_value: configForm.mailgun_base_url,
        config_description: 'Mailgun API base URL',
        is_encrypted: false
      }
    ];

    const { error } = await supabase
      .from('email_configuration')
      .upsert(upsertData, { onConflict: 'config_key' });

    if (error) {
      throw new Error(`Error updating email configuration: ${error.message}`);
    }
  }

  // Create new configuration
  async createConfiguration(configData: CreateEmailConfigData): Promise<EmailConfiguration> {
    const { data, error } = await supabase
      .from('email_configuration')
      .insert([configData])
      .select()
      .single();

    if (error) {
      throw new Error(`Error creating configuration: ${error.message}`);
    }

    return data;
  }

  // Delete configuration
  async deleteConfiguration(id: string): Promise<void> {
    const { error } = await supabase
      .from('email_configuration')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`Error deleting configuration: ${error.message}`);
    }
  }
}

export const emailConfigService = new EmailConfigService();