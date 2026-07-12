import { mailgunConfig } from '../config/mailgun';

interface EmailData {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  from?: string;
  cc?: string | string[];
  bcc?: string | string[];
  attachments?: Array<{
    filename: string;
    data: string | Buffer | Blob | ArrayBuffer;
    contentType?: string;
  }>;
}

interface MailgunResponse {
  id: string;
  message: string;
}

export class MailgunService {
  private static instance: MailgunService;

  private constructor() {}

  static getInstance(): MailgunService {
    if (!MailgunService.instance) {
      MailgunService.instance = new MailgunService();
    }
    return MailgunService.instance;
  }

  /**
   * Send email using Mailgun REST API with HTTP Basic Auth
   */
  async sendEmail(emailData: EmailData): Promise<MailgunResponse> {
    try {
      const config = await mailgunConfig.loadConfig();
      
      // Validate required fields
      if (!emailData.to || !emailData.subject) {
        throw new Error('Email recipient and subject are required');
      }

      if (!emailData.html && !emailData.text) {
        throw new Error('Email must have either HTML or text content');
      }

      // Prepare form data for Mailgun API
      const formData = new FormData();
      
      // Set sender
      formData.append('from', emailData.from || `Hola Dieta <noreply@${config.domain}>`);
      
      // Set recipients
      if (Array.isArray(emailData.to)) {
        emailData.to.forEach(recipient => formData.append('to', recipient));
      } else {
        formData.append('to', emailData.to);
      }

      // Set CC recipients if provided
      if (emailData.cc) {
        if (Array.isArray(emailData.cc)) {
          emailData.cc.forEach(recipient => formData.append('cc', recipient));
        } else {
          formData.append('cc', emailData.cc);
        }
      }

      // Set BCC recipients if provided
      if (emailData.bcc) {
        if (Array.isArray(emailData.bcc)) {
          emailData.bcc.forEach(recipient => formData.append('bcc', recipient));
        } else {
          formData.append('bcc', emailData.bcc);
        }
      }

      // Set subject and content
      formData.append('subject', emailData.subject);
      
      if (emailData.html) {
        formData.append('html', emailData.html);
      }
      
      if (emailData.text) {
        formData.append('text', emailData.text);
      }

      // Add attachments if provided
      if (emailData.attachments) {
        emailData.attachments.forEach((attachment) => {
          const blob = attachment.data instanceof Blob
            ? attachment.data
            : new Blob([attachment.data], { type: attachment.contentType || 'application/octet-stream' });
          formData.append('attachment', blob, attachment.filename);
        });
      }

      // Create authorization header using HTTP Basic Auth
      const credentials = btoa(`api:${config.apiKey}`);
      
      // Send request to Mailgun API
      const response = await fetch(`${config.baseUrl}/${config.domain}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${credentials}`
        },
        body: formData
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = `Mailgun API error: ${response.status}`;
        
        try {
          const errorJson = JSON.parse(errorText);
          errorMessage = errorJson.message || errorMessage;
        } catch {
          errorMessage = errorText || errorMessage;
        }
        
        throw new Error(errorMessage);
      }

      const result = await response.json();
      return result as MailgunResponse;
    } catch (error) {
      console.error('Error sending email via Mailgun:', error);
      
      if (error instanceof Error) {
        throw error;
      } else {
        throw new Error('Unknown error occurred while sending email');
      }
    }
  }

  /**
   * Send test email to verify configuration
   */
  async sendTestEmail(recipientEmail: string): Promise<MailgunResponse> {
    const testEmailData: EmailData = {
      to: recipientEmail,
      subject: 'Test Email from Hola Dieta System',
      html: this.generateTestEmailTemplate(),
      text: 'This is a test email from the Hola Dieta system. If you received this, email configuration is working correctly!'
    };

    return this.sendEmail(testEmailData);
  }

  /**
   * Send credentials email with temporary password
   */
  async sendCredentialsEmail(
    email: string,
    inviterName: string,
    roleName: string,
    tempPassword: string
  ): Promise<MailgunResponse> {
    const loginUrl = `${window.location.origin}/auth`;

    const credentialsEmailData: EmailData = {
      to: email,
      subject: 'Cuenta Creada - Credenciales de Acceso a Hola Dieta',
      html: this.generateCredentialsEmailTemplate(inviterName, roleName, email, tempPassword, loginUrl),
      text: `${inviterName} te ha creado una cuenta en Hola Dieta con el rol de ${roleName}.\n\nTus credenciales de acceso:\nCorreo: ${email}\nContraseña Temporal: ${tempPassword}\n\nInicia sesión en: ${loginUrl}\n\nDEBES cambiar tu contraseña en el primer inicio de sesión.`
    };

    return this.sendEmail(credentialsEmailData);
  }


  /**
   * Validate current configuration by sending a test request
   */
  async validateConfiguration(): Promise<{ valid: boolean; error?: string }> {
    try {
      const config = await mailgunConfig.loadConfig();
      
      // Test the configuration by making a simple API call to validate domain
      const credentials = btoa(`api:${config.apiKey}`);
      
      const response = await fetch(`${config.baseUrl}/${config.domain}`, {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${credentials}`
        }
      });

      if (response.ok) {
        return { valid: true };
      } else {
        const errorText = await response.text();
        return { 
          valid: false, 
          error: `Invalid configuration: ${response.status} - ${errorText}` 
        };
      }
    } catch (error) {
      return { 
        valid: false, 
        error: error instanceof Error ? error.message : 'Configuration validation failed' 
      };
    }
  }

  /**
   * Generate test email HTML template
   */
  private generateTestEmailTemplate(): string {
    return `
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Test Email - Hola Dieta</title>
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f8f9fa; }
          .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); }
          .header { background: linear-gradient(135deg, #ee434d, #db2536); color: white; padding: 40px 30px; text-align: center; }
          .logo { font-size: 32px; font-weight: bold; margin-bottom: 10px; }
          .content { padding: 40px 30px; }
          .success-box { background-color: #d4edda; border: 1px solid #c3e6cb; border-radius: 8px; padding: 20px; margin: 20px 0; }
          .footer { background-color: #f8f9fa; padding: 20px 30px; text-align: center; font-size: 14px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">🥗 Hola Dieta</div>
            <h1>Email Configuration Test</h1>
            <p>Sistema de Gestión Empresarial</p>
          </div>
          
          <div class="content">
            <div class="success-box">
              <h2 style="color: #155724; margin-top: 0;">✅ ¡Configuración Exitosa!</h2>
              <p style="color: #155724; margin-bottom: 0;">
                Si recibes este email, significa que la configuración de Mailgun está funcionando correctamente.
              </p>
            </div>
            
            <h3>Detalles del Test:</h3>
            <ul>
              <li><strong>Fecha y hora:</strong> ${new Date().toLocaleString('es-ES')}</li>
              <li><strong>Sistema:</strong> Hola Dieta Management System</li>
              <li><strong>Estado:</strong> Configuración verificada</li>
            </ul>
            
            <p>Ahora puedes usar el sistema de invitaciones y otras funcionalidades de email con confianza.</p>
          </div>
          
          <div class="footer">
            <p>© 2025 Hola Dieta. Todos los derechos reservados.</p>
            <p>Este es un email automático de prueba del sistema.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Generate credentials email HTML template with temporary password
   */
  private generateCredentialsEmailTemplate(
    inviterName: string,
    roleName: string,
    email: string,
    tempPassword: string,
    loginUrl: string
  ): string {
    return `
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Cuenta Creada - Credenciales de Acceso</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #1f2937;
            background-color: #f3f4f6;
            padding: 20px;
          }
          .email-wrapper {
            max-width: 600px;
            margin: 0 auto;
            background-color: #ffffff;
            border-radius: 16px;
            overflow: hidden;
            box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
          }
          .header {
            background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
            color: white;
            padding: 48px 32px;
            text-align: center;
          }
          .logo-container {
            background-color: rgba(255, 255, 255, 0.2);
            width: 80px;
            height: 80px;
            border-radius: 50%;
            margin: 0 auto 20px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 40px;
          }
          .header h1 {
            font-size: 28px;
            font-weight: 700;
            margin-bottom: 8px;
            letter-spacing: -0.5px;
          }
          .header p {
            font-size: 16px;
            opacity: 0.95;
            font-weight: 400;
          }
          .content {
            padding: 48px 32px;
          }
          .greeting {
            font-size: 18px;
            color: #374151;
            margin-bottom: 24px;
            line-height: 1.6;
          }
          .credentials-card {
            background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%);
            border-radius: 12px;
            padding: 24px;
            margin: 32px 0;
            border: 2px solid #3b82f6;
          }
          .credentials-card h3 {
            color: #1e40af;
            font-size: 16px;
            font-weight: 600;
            margin-bottom: 20px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            display: flex;
            align-items: center;
            gap: 8px;
          }
          .credential-item {
            background-color: #ffffff;
            border-radius: 8px;
            padding: 16px;
            margin: 12px 0;
            border: 1px solid #93c5fd;
          }
          .credential-label {
            color: #1e40af;
            font-size: 12px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 6px;
          }
          .credential-value {
            color: #1e3a8a;
            font-size: 16px;
            font-weight: 600;
            font-family: 'Courier New', monospace;
            word-break: break-all;
          }
          .password-value {
            font-size: 18px;
            letter-spacing: 1px;
            color: #dc2626;
          }
          .role-badge {
            display: inline-block;
            background-color: #ef4444;
            color: white;
            padding: 6px 16px;
            border-radius: 20px;
            font-size: 14px;
            font-weight: 600;
            letter-spacing: 0.3px;
          }
          .cta-section {
            text-align: center;
            margin: 40px 0;
          }
          .cta-button {
            display: inline-block;
            background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
            color: white;
            padding: 18px 48px;
            text-decoration: none;
            border-radius: 12px;
            font-weight: 600;
            font-size: 16px;
            box-shadow: 0 4px 12px rgba(239, 68, 68, 0.4);
            transition: transform 0.2s, box-shadow 0.2s;
          }
          .cta-button:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 16px rgba(239, 68, 68, 0.5);
          }
          .warning-box {
            background-color: #fef3c7;
            border-left: 4px solid #f59e0b;
            padding: 20px;
            margin: 24px 0;
            border-radius: 8px;
          }
          .warning-box h4 {
            color: #92400e;
            font-size: 14px;
            font-weight: 600;
            margin-bottom: 12px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          .warning-box p {
            color: #78350f;
            font-size: 14px;
            margin: 8px 0;
          }
          .instructions {
            background-color: #eff6ff;
            border-left: 4px solid #3b82f6;
            padding: 24px;
            margin: 32px 0;
            border-radius: 8px;
          }
          .instructions h4 {
            color: #1e40af;
            font-size: 16px;
            font-weight: 600;
            margin-bottom: 16px;
            display: flex;
            align-items: center;
            gap: 8px;
          }
          .instructions ol {
            margin-left: 20px;
            color: #1e3a8a;
          }
          .instructions li {
            margin: 8px 0;
            font-size: 14px;
            line-height: 1.6;
          }
          .security-note {
            background-color: #fef2f2;
            border: 1px solid #fecaca;
            border-radius: 8px;
            padding: 20px;
            margin: 32px 0;
          }
          .security-note h4 {
            color: #991b1b;
            font-size: 14px;
            font-weight: 600;
            margin-bottom: 12px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          .security-note ul {
            list-style: none;
            color: #7f1d1d;
          }
          .security-note li {
            padding: 6px 0;
            font-size: 13px;
            display: flex;
            align-items: flex-start;
          }
          .security-note li:before {
            content: '⚠';
            color: #dc2626;
            font-weight: bold;
            margin-right: 8px;
            flex-shrink: 0;
          }
          .footer {
            background-color: #f9fafb;
            padding: 32px;
            text-align: center;
            border-top: 1px solid #e5e7eb;
          }
          .footer p {
            color: #6b7280;
            font-size: 13px;
            margin: 8px 0;
          }
          .footer-divider {
            margin: 16px 0;
            height: 1px;
            background-color: #e5e7eb;
          }
          @media only screen and (max-width: 600px) {
            .content { padding: 32px 24px; }
            .header { padding: 32px 24px; }
            .cta-button { padding: 16px 32px; font-size: 15px; }
          }
        </style>
      </head>
      <body>
        <div class="email-wrapper">
          <div class="header">
            <div class="logo-container">🥗</div>
            <h1>¡Tu cuenta ha sido creada!</h1>
            <p>Credenciales de acceso al Sistema Hola Dieta</p>
          </div>

          <div class="content">
            <div class="greeting">
              <p>Hola,</p>
              <p><strong>${inviterName}</strong> te ha creado una cuenta en el sistema de gestión Hola Dieta con el rol de <span class="role-badge">${roleName}</span>.</p>
            </div>

            <div class="credentials-card">
              <h3>🔑 Tus Credenciales de Acceso</h3>

              <div class="credential-item">
                <div class="credential-label">Correo Electrónico</div>
                <div class="credential-value">${email}</div>
              </div>

              <div class="credential-item">
                <div class="credential-label">Contraseña Temporal</div>
                <div class="credential-value password-value">${tempPassword}</div>
              </div>
            </div>

            <div class="warning-box">
              <h4>⚠️ IMPORTANTE - Contraseña Temporal</h4>
              <p><strong>Esta es una contraseña temporal.</strong> Por razones de seguridad, DEBES cambiar tu contraseña inmediatamente después de iniciar sesión por primera vez.</p>
              <p>El sistema te solicitará automáticamente que establezcas una nueva contraseña segura.</p>
            </div>

            <div class="cta-section">
              <a href="${loginUrl}" class="cta-button">
                🚀 Iniciar Sesión Ahora
              </a>
            </div>

            <div class="instructions">
              <h4>📝 Cómo acceder al sistema</h4>
              <ol>
                <li>Haz clic en el botón "Iniciar Sesión" arriba</li>
                <li>Ingresa tu correo electrónico: <strong>${email}</strong></li>
                <li>Ingresa la contraseña temporal que se muestra arriba</li>
                <li>El sistema te pedirá que cambies tu contraseña</li>
                <li>Crea una contraseña segura (mínimo 8 caracteres)</li>
                <li>¡Listo! Ahora puedes usar el sistema</li>
              </ol>
            </div>

            <div class="security-note">
              <h4>🔒 Recomendaciones de Seguridad</h4>
              <ul>
                <li>No compartas tu contraseña con nadie</li>
                <li>Usa una contraseña única que no uses en otros sitios</li>
                <li>Incluye mayúsculas, minúsculas, números y símbolos</li>
                <li>Cambia tu contraseña regularmente</li>
                <li>No uses información personal obvia (nombres, fechas de nacimiento, etc.)</li>
                <li>Si sospechas que alguien tiene acceso a tu cuenta, cámbiala inmediatamente</li>
              </ul>
            </div>

            <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 20px; margin: 24px 0;">
              <h4 style="color: #15803d; font-size: 14px; font-weight: 600; margin-bottom: 12px;">✨ ¿Prefieres usar Google?</h4>
              <p style="color: #166534; font-size: 14px; margin: 0;">
                También puedes iniciar sesión usando tu cuenta de Google. Esta opción estará disponible en la pantalla de inicio de sesión.
              </p>
            </div>
          </div>

          <div class="footer">
            <p><strong>Hola Dieta</strong> - Sistema de Gestión Empresarial</p>
            <div class="footer-divider"></div>
            <p>© ${new Date().getFullYear()} Hola Dieta. Todos los derechos reservados.</p>
            <p>Este correo contiene información confidencial. Si lo recibiste por error, por favor elimínalo.</p>
            <p style="margin-top: 16px; font-size: 11px;">Si necesitas ayuda, contacta a ${inviterName} o al administrador del sistema.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }


  /**
   * Send order confirmation email after successful payment
   */
  async sendOrderConfirmationEmail(params: {
    customerName: string;
    customerEmail: string;
    orderNumber: string;
    deliveryAddress: string;
    deliveryWeeks: Array<{ weekName: string; deliveryDate: string | null }>;
    totals: {
      subtotal: number;
      planDiscount: number;
      deliveryPrice: number;
      couponDiscount: number;
      taxAmount: number;
      finalTotal: number;
    };
    deliveryOptionName: string;
    couponCode?: string;
    shopUrl: string;
  }): Promise<MailgunResponse> {
    const emailData: EmailData = {
      to: params.customerEmail,
      subject: `Confirmación de Pedido #${params.orderNumber} - Hola Dieta`,
      html: this.generateOrderConfirmationTemplate(params),
      text: `¡Gracias por tu pedido, ${params.customerName}! Tu número de orden es ${params.orderNumber}. Total: $${params.totals.finalTotal.toFixed(0)} MXN.`
    };

    return this.sendEmail(emailData);
  }

  /**
   * Generate order confirmation HTML email template
   */
  private generateOrderConfirmationTemplate(params: {
    customerName: string;
    customerEmail: string;
    orderNumber: string;
    deliveryAddress: string;
    deliveryWeeks: Array<{ weekName: string; deliveryDate: string | null }>;
    totals: {
      subtotal: number;
      planDiscount: number;
      deliveryPrice: number;
      couponDiscount: number;
      taxAmount: number;
      finalTotal: number;
    };
    deliveryOptionName: string;
    couponCode?: string;
    shopUrl: string;
  }): string {
    const firstName = params.customerName.split(' ')[0];

    const formatDate = (dateString: string | null): string => {
      if (!dateString) return 'Por confirmar';
      const [year, month, day] = dateString.split('-').map(Number);
      const date = new Date(year, month - 1, day);
      return date.toLocaleDateString('es-MX', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    };

    const weeksRows = params.deliveryWeeks.map((w, i) => `
      <tr style="border-bottom: 1px solid #f3f4f6;">
        <td style="padding: 14px 16px; color: #374151; font-size: 14px;">
          <span style="font-weight: 600; color: #111827;">Semana ${i + 1}</span><br>
          <span style="color: #6b7280;">${w.weekName}</span>
        </td>
        <td style="padding: 14px 16px; color: #059669; font-size: 14px; font-weight: 600; text-align: right;">
          ${formatDate(w.deliveryDate)}
        </td>
      </tr>
    `).join('');

    const showPlanDiscount = params.totals.planDiscount > 0;
    const showCoupon = params.totals.couponDiscount > 0 && params.couponCode;

    return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Confirmación de Pedido - Hola Dieta</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6; color: #1f2937;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6; padding: 32px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.08);">

          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); padding: 48px 32px; text-align: center;">
              <div style="width: 72px; height: 72px; background-color: rgba(255,255,255,0.2); border-radius: 50%; margin: 0 auto 20px; display: flex; align-items: center; justify-content: center; font-size: 36px; line-height: 72px; text-align: center;">
                &#10003;
              </div>
              <h1 style="margin: 0 0 8px; font-size: 28px; font-weight: 700; color: #ffffff; letter-spacing: -0.5px;">&#161;Pedido Confirmado!</h1>
              <p style="margin: 0; font-size: 16px; color: rgba(255,255,255,0.9);">Hola Dieta &mdash; Tu comida est&aacute; en camino</p>
            </td>
          </tr>

          <!-- Greeting -->
          <tr>
            <td style="padding: 40px 32px 0;">
              <p style="margin: 0 0 8px; font-size: 18px; color: #374151;">Hola, <strong style="color: #111827;">${firstName}</strong></p>
              <p style="margin: 0; font-size: 15px; color: #6b7280; line-height: 1.6;">Gracias por tu pedido. Hemos recibido tu orden y estamos preparando todo para las fechas de entrega indicadas.</p>
            </td>
          </tr>

          <!-- Order number badge -->
          <tr>
            <td style="padding: 24px 32px;">
              <div style="background-color: #fef2f2; border: 2px solid #fca5a5; border-radius: 12px; padding: 20px; text-align: center;">
                <p style="margin: 0 0 4px; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; color: #9ca3af;">N&uacute;mero de Orden</p>
                <p style="margin: 0; font-size: 28px; font-weight: 700; color: #dc2626; letter-spacing: 1px;">#${params.orderNumber}</p>
              </div>
            </td>
          </tr>

          <!-- Delivery dates -->
          <tr>
            <td style="padding: 0 32px 24px;">
              <h3 style="margin: 0 0 16px; font-size: 16px; font-weight: 700; color: #111827; display: flex; align-items: center; gap: 8px;">
                &#128197; Fechas de Entrega
              </h3>
              <table width="100%" cellpadding="0" cellspacing="0" style="border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden;">
                <thead>
                  <tr style="background-color: #f9fafb;">
                    <th style="padding: 12px 16px; text-align: left; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: #6b7280;">Semana</th>
                    <th style="padding: 12px 16px; text-align: right; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: #6b7280;">Fecha de Entrega</th>
                  </tr>
                </thead>
                <tbody>
                  ${weeksRows}
                </tbody>
              </table>
            </td>
          </tr>

          <!-- Delivery address -->
          <tr>
            <td style="padding: 0 32px 24px;">
              <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px; padding: 20px;">
                <p style="margin: 0 0 8px; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: #6b7280;">&#128205; Direcci&oacute;n de Entrega</p>
                <p style="margin: 0 0 4px; font-size: 15px; font-weight: 600; color: #111827;">${params.customerName}</p>
                <p style="margin: 0 0 4px; font-size: 14px; color: #374151;">${params.deliveryAddress || 'Direcci&oacute;n registrada en tu cuenta'}</p>
                <p style="margin: 8px 0 0; font-size: 13px; color: #6b7280;">M&eacute;todo de env&iacute;o: <strong>${params.deliveryOptionName}</strong></p>
              </div>
            </td>
          </tr>

          <!-- Price breakdown -->
          <tr>
            <td style="padding: 0 32px 32px;">
              <h3 style="margin: 0 0 16px; font-size: 16px; font-weight: 700; color: #111827;">Resumen del Pedido</h3>
              <table width="100%" cellpadding="0" cellspacing="0" style="border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden;">
                <tbody>
                  <tr>
                    <td style="padding: 12px 16px; font-size: 14px; color: #6b7280; border-bottom: 1px solid #f3f4f6;">Subtotal</td>
                    <td style="padding: 12px 16px; font-size: 14px; color: #111827; font-weight: 500; text-align: right; border-bottom: 1px solid #f3f4f6;">$${Math.round(params.totals.subtotal).toFixed(0)} MXN</td>
                  </tr>
                  ${showPlanDiscount ? `
                  <tr>
                    <td style="padding: 12px 16px; font-size: 14px; color: #059669; border-bottom: 1px solid #f3f4f6;">Descuento por volumen</td>
                    <td style="padding: 12px 16px; font-size: 14px; color: #059669; font-weight: 500; text-align: right; border-bottom: 1px solid #f3f4f6;">-$${Math.round(params.totals.planDiscount).toFixed(0)} MXN</td>
                  </tr>` : ''}
                  <tr>
                    <td style="padding: 12px 16px; font-size: 14px; color: #6b7280; border-bottom: 1px solid #f3f4f6;">Env&iacute;o (${params.deliveryOptionName})</td>
                    <td style="padding: 12px 16px; font-size: 14px; color: #111827; font-weight: 500; text-align: right; border-bottom: 1px solid #f3f4f6;">$${Math.round(params.totals.deliveryPrice).toFixed(0)} MXN</td>
                  </tr>
                  ${showCoupon ? `
                  <tr>
                    <td style="padding: 12px 16px; font-size: 14px; color: #059669; border-bottom: 1px solid #f3f4f6;">Cup&oacute;n ${params.couponCode}</td>
                    <td style="padding: 12px 16px; font-size: 14px; color: #059669; font-weight: 500; text-align: right; border-bottom: 1px solid #f3f4f6;">-$${Math.round(params.totals.couponDiscount).toFixed(0)} MXN</td>
                  </tr>` : ''}
                  <tr>
                    <td style="padding: 12px 16px; font-size: 14px; color: #6b7280; border-bottom: 1px solid #e5e7eb;">IVA (16%)</td>
                    <td style="padding: 12px 16px; font-size: 14px; color: #111827; font-weight: 500; text-align: right; border-bottom: 1px solid #e5e7eb;">$${Math.round(params.totals.taxAmount).toFixed(0)} MXN</td>
                  </tr>
                  <tr style="background-color: #f9fafb;">
                    <td style="padding: 16px; font-size: 16px; font-weight: 700; color: #111827;">Total</td>
                    <td style="padding: 16px; font-size: 20px; font-weight: 700; color: #dc2626; text-align: right;">$${Math.round(params.totals.finalTotal).toFixed(0)} MXN</td>
                  </tr>
                </tbody>
              </table>
            </td>
          </tr>

          <!-- CTA -->
          <tr>
            <td style="padding: 0 32px 40px; text-align: center;">
              <a href="${params.shopUrl}/account" style="display: inline-block; background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); color: #ffffff; padding: 16px 40px; text-decoration: none; border-radius: 12px; font-weight: 600; font-size: 15px; box-shadow: 0 4px 12px rgba(239,68,68,0.35);">
                Ver mis pedidos
              </a>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 28px 32px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0 0 8px; font-size: 15px; font-weight: 700; color: #111827;">Hola Dieta</p>
              <p style="margin: 0 0 4px; font-size: 13px; color: #9ca3af;">&copy; ${new Date().getFullYear()} Hola Dieta. Todos los derechos reservados.</p>
              <p style="margin: 0; font-size: 12px; color: #d1d5db;">Este correo es una confirmaci&oacute;n autom&aacute;tica. Por favor no respondas a este mensaje.</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
  }

  /**
   * Clear configuration cache (useful after admin updates)
   */
  clearConfigCache(): void {
    mailgunConfig.clearCache();
  }
}

export const mailgunService = MailgunService.getInstance();