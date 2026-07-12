import { mailgunService } from './mailgunService';
import { mailgunConfig } from '../config/mailgun';

export class EmailService {
  private static instance: EmailService;

  private constructor() {}

  static getInstance(): EmailService {
    if (!EmailService.instance) {
      EmailService.instance = new EmailService();
    }
    return EmailService.instance;
  }

  /**
   * Send test email to verify Mailgun configuration
   */
  async sendTestEmail(recipientEmail: string): Promise<void> {
    try {
      const result = await mailgunService.sendTestEmail(recipientEmail);
      console.log('Test email sent successfully:', result);
    } catch (error) {
      console.error('Error sending test email via EmailService:', error);
      throw error;
    }
  }

  /**
   * Send credentials email with temporary password to a new user
   */
  async sendCredentialsEmail(
    email: string,
    inviterName: string,
    roleName: string,
    tempPassword: string
  ): Promise<void> {
    try {
      const result = await mailgunService.sendCredentialsEmail(email, inviterName, roleName, tempPassword);
      console.log('Credentials email sent successfully:', result);
    } catch (error) {
      console.error('Error sending credentials email via EmailService:', error);
      throw error;
    }
  }



  /**
   * Validate current email configuration
   */
  async validateConfiguration(): Promise<{ valid: boolean; error?: string }> {
    try {
      return await mailgunService.validateConfiguration();
    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : 'Configuration validation failed'
      };
    }
  }

  /**
   * Clear configuration cache to force reload from database
   */
  clearConfigCache(): void {
    mailgunService.clearConfigCache();
  }
}

export const emailService = EmailService.getInstance();