interface MailgunConfig {
  apiKey: string;
  domain: string;
  baseUrl: string;
}

export class MailgunConfigManager {
  private static instance: MailgunConfigManager;
  private config: MailgunConfig | null = null;

  private constructor() {}

  static getInstance(): MailgunConfigManager {
    if (!MailgunConfigManager.instance) {
      MailgunConfigManager.instance = new MailgunConfigManager();
    }
    return MailgunConfigManager.instance;
  }

  async loadConfig(): Promise<MailgunConfig> {
    if (this.config) {
      return this.config;
    }

    try {
      // Try to load from environment variables first (most secure)
      const envApiKey = import.meta.env.VITE_MAILGUN_API_KEY;
      const envDomain = import.meta.env.VITE_MAILGUN_DOMAIN;
      const envBaseUrl = import.meta.env.VITE_MAILGUN_BASE_URL;

      if (envApiKey && envDomain) {
        this.config = {
          apiKey: envApiKey,
          domain: envDomain,
          baseUrl: envBaseUrl || 'https://api.mailgun.net/v3'
        };
        return this.config;
      }

      // Fallback to database configuration (for admin editing)
      const { emailConfigService } = await import('../services/emailConfigService');
      const dbConfig = await emailConfigService.getEmailConfigForm();
      
      if (!dbConfig.mailgun_api_key) {
        throw new Error('Mailgun API key not configured. Please set it in the admin settings or environment variables.');
      }

      this.config = {
        apiKey: dbConfig.mailgun_api_key,
        domain: dbConfig.mailgun_domain || 'mg.holadieta.mx',
        baseUrl: dbConfig.mailgun_base_url || 'https://api.mailgun.net/v3'
      };

      return this.config;
    } catch (error) {
      console.error('Error loading Mailgun configuration:', error);
      throw new Error('Failed to load email configuration. Please check your settings.');
    }
  }

  // Clear cached config to force reload (useful after admin updates)
  clearCache(): void {
    this.config = null;
  }

  // Validate configuration
  async validateConfig(): Promise<boolean> {
    try {
      const config = await this.loadConfig();
      return !!(config.apiKey && config.domain && config.baseUrl);
    } catch {
      return false;
    }
  }
}

export const mailgunConfig = MailgunConfigManager.getInstance();