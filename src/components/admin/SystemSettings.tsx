import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users } from 'lucide-react';
import EmailSettings from './EmailSettings';
import PayPalSettings from './PayPalSettings';
import StripeSettings from './StripeSettings';
import ShipdaySettings from './ShipdaySettings';
import FacturamaSettings from './FacturamaSettings';
import GmailSettings from './GmailSettings';
import BanxicoSettings from './BanxicoSettings';
import SatSettings from './SatSettings';
import MercadoPagoSettings from './MercadoPagoSettings';
import ManychatSettings from './ManychatSettings';
import DeliveryTrackingSettings from './DeliveryTrackingSettings';
import OrphanedUserFixer from './OrphanedUserFixer';
import IntegrationCard from './IntegrationCard';
import IntegrationModal from './IntegrationModal';
import { emailConfigService } from '../../services/emailConfigService';
import { paypalConfigService } from '../../services/paypalConfigService';
import { stripeConfigService } from '../../services/stripeConfigService';
import { facturamaConfigService } from '../../services/facturamaConfigService';
import { shipdayService } from '../../services/shipdayService';
import { woocommerceConfigService } from '../../services/woocommerceConfigService';
import { gmailConfigService } from '../../services/gmailConfigService';
import { banxicoConfigService } from '../../services/banxicoConfigService';
import { mercadoPagoConfigService } from '../../services/mercadoPagoConfigService';
import { satDescargaService } from '../../services/satDescargaService';
import { manychatConfigService } from '../../services/manychatConfigService';
import { deliveryTrackingConfigService } from '../../services/deliveryTrackingConfigService';
import { GmailConfig } from '../../types/gmailConfig';

const MailgunLogo = () => (
  <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-8 h-8">
    <rect width="48" height="48" rx="10" fill="#F06B26" />
    <path d="M24 12C17.373 12 12 17.373 12 24C12 30.627 17.373 36 24 36C27.09 36 29.91 34.893 32.085 33.045L30.0 30.6C28.455 31.905 26.325 32.727 24 32.727C19.173 32.727 15.273 28.827 15.273 24C15.273 19.173 19.173 15.273 24 15.273C28.827 15.273 32.727 19.173 32.727 24V25.636C32.727 26.518 32.01 27.273 31.091 27.273C30.172 27.273 29.454 26.518 29.454 25.636V24C29.454 20.982 27.018 18.546 24 18.546C20.982 18.546 18.546 20.982 18.546 24C18.546 27.018 20.982 29.454 24 29.454C25.618 29.454 27.073 28.786 28.109 27.709C28.854 28.731 30.0 29.454 31.364 29.454C33.818 29.454 36 27.454 36 25.091V24C36 17.373 30.627 12 24 12ZM24 26.182C22.8 26.182 21.818 25.2 21.818 24C21.818 22.8 22.8 21.818 24 21.818C25.2 21.818 26.182 22.8 26.182 24C26.182 25.2 25.2 26.182 24 26.182Z" fill="white" />
  </svg>
);

const PayPalLogo = () => (
  <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-8 h-8">
    <rect width="48" height="48" rx="10" fill="#003087" />
    <path d="M32.2 14.5C31.4 13.6 29.9 13 28.1 13H20.2C19.7 13 19.3 13.4 19.2 13.9L16 33.2C16 33.6 16.3 33.9 16.7 33.9H21.1L22.2 27.1L22.2 27.3C22.3 26.8 22.7 26.4 23.2 26.4H25.4C29.8 26.4 33.2 24.5 34.2 19.3C34.2 19.1 34.3 18.9 34.3 18.7C34.0 18.5 34.0 18.5 34.3 18.7C34.5 16.9 34.3 15.7 32.2 14.5Z" fill="#009CDE" />
    <path d="M34.2 18.7C34.2 18.9 34.1 19.1 34.1 19.3C33.1 24.5 29.7 26.4 25.3 26.4H23.1C22.6 26.4 22.2 26.8 22.1 27.3L20.6 36.3C20.6 36.7 20.8 37 21.2 37H25.0C25.5 37 25.9 36.6 26.0 36.2V36.0L26.8 31.1V30.9C26.9 30.4 27.3 30.0 27.8 30.0H28.4C32.2 30.0 35.2 28.4 36.0 23.9C36.4 21.9 36.2 20.3 34.2 18.7Z" fill="#012169" />
    <path d="M22.2 18.3C22.3 18.0 22.5 17.8 22.7 17.6C22.9 17.5 23.1 17.4 23.4 17.4H29.8C30.5 17.4 31.2 17.5 31.8 17.6C31.9 17.6 32.1 17.7 32.2 17.7C32.4 17.8 32.6 17.9 32.7 18.0C32.8 18.0 32.9 18.1 33.0 18.1C33.3 18.3 33.5 18.5 33.7 18.7C34.0 16.7 33.7 15.4 32.4 14.0C31.0 12.5 28.5 12 25.4 12H17.5C17.0 12 16.5 12.4 16.5 12.9L13 33.3C13 33.7 13.3 34 13.7 34H18.5L20.5 21.8L22.2 18.3Z" fill="#003087" />
  </svg>
);

const StripeLogo = () => (
  <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-8 h-8">
    <rect width="48" height="48" rx="10" fill="#635BFF" />
    <path fillRule="evenodd" clipRule="evenodd" d="M22.3 19.1C22.3 17.9 23.3 17.4 24.9 17.4C27.2 17.4 30.1 18.1 32.4 19.3V13.8C29.9 12.8 27.5 12.4 24.9 12.4C18.9 12.4 14.9 15.5 14.9 20.0C14.9 27.1 24.6 26.0 24.6 29.1C24.6 30.5 23.4 31.0 21.7 31.0C19.2 31.0 16.0 30.0 13.4 28.6V34.1C16.3 35.3 19.2 35.8 21.7 35.8C27.9 35.8 32.1 32.8 32.1 28.2C32.1 20.6 22.3 21.9 22.3 19.1Z" fill="white" />
  </svg>
);

const ShipdayLogo = () => (
  <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-8 h-8">
    <rect width="48" height="48" rx="10" fill="#1E3A5F" />
    <path d="M10 28L14 18H28L36 28H10Z" fill="#4A90D9" />
    <path d="M10 28H36V32H10V28Z" fill="#2B6CB0" />
    <circle cx="16" cy="33" r="3" fill="#E2E8F0" stroke="#1E3A5F" strokeWidth="1.5" />
    <circle cx="30" cy="33" r="3" fill="#E2E8F0" stroke="#1E3A5F" strokeWidth="1.5" />
    <path d="M28 18L32 24" stroke="#4A90D9" strokeWidth="1.5" strokeLinecap="round" />
    <rect x="20" y="13" width="8" height="6" rx="1" fill="#63B3ED" />
  </svg>
);

const FacturamaLogo = () => (
  <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-8 h-8">
    <rect width="48" height="48" rx="10" fill="#16A34A" />
    <path d="M14 12H30L36 18V38H14V12Z" fill="white" opacity="0.15" />
    <path d="M14 12H30L36 18V38H14V12Z" stroke="white" strokeWidth="1.5" strokeLinejoin="round" />
    <path d="M29 12V19H36" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M19 24H31" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
    <path d="M19 28H31" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
    <path d="M19 32H25" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
    <circle cx="22" cy="19" r="3" fill="white" opacity="0.9" />
    <path d="M21 19L22 20L24 18" stroke="#16A34A" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const WooCommerceLogo = () => (
  <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-8 h-8">
    <rect width="48" height="48" rx="10" fill="#7F54B3" />
    <path d="M6 14C6 12.3431 7.34315 11 9 11H39C40.6569 11 42 12.3431 42 14V30C42 31.6569 40.6569 33 39 33H30L24 39L18 33H9C7.34315 33 6 31.6569 6 30V14Z" fill="white" opacity="0.15" />
    <path d="M6 14C6 12.3431 7.34315 11 9 11H39C40.6569 11 42 12.3431 42 14V30C42 31.6569 40.6569 33 39 33H30L24 39L18 33H9C7.34315 33 6 31.6569 6 30V14Z" stroke="white" strokeWidth="1.5" strokeLinejoin="round" />
    <path d="M10 18L14 27L17.5 20L21 27L25 18" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M28 18V27M28 18H33C34.1046 18 35 18.8954 35 20V20C35 21.1046 34.1046 22 33 22H28M28 22H33C34.1046 22 35 22.8954 35 24V24C35 25.1046 34.1046 26 33 26H28" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const SatLogo = () => (
  <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-8 h-8">
    <rect width="48" height="48" rx="10" fill="#065F46" />
    <path d="M14 12H30L36 18V38H14V12Z" fill="white" opacity="0.15" />
    <path d="M14 12H30L36 18V38H14V12Z" stroke="white" strokeWidth="1.5" strokeLinejoin="round" />
    <path d="M29 12V19H36" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M20 24L24 28L29 22" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M19 32H31" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
    <path d="M19 35H27" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

const MercadoPagoLogo = () => (
  <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-8 h-8">
    <rect width="48" height="48" rx="10" fill="#009EE3" />
    <path d="M24 12C17.4 12 12 17.4 12 24C12 30.6 17.4 36 24 36C30.6 36 36 30.6 36 24C36 17.4 30.6 12 24 12Z" fill="white" opacity="0.2" />
    <path d="M19 20C19 20 20.5 17 24 17C27.5 17 29 20 29 20" stroke="white" strokeWidth="2" strokeLinecap="round" />
    <path d="M15 24C15 24 17 20 20 20C23 20 24 24 24 24C24 24 25 20 28 20C31 20 33 24 33 24" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M15 24C15 24 15 31 20 31C23 31 24 28 24 28C24 28 25 31 28 31C33 31 33 24 33 24" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const ManychatLogo = () => (
  <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-8 h-8">
    <rect width="48" height="48" rx="10" fill="#0084FF" />
    <path d="M24 10C16.268 10 10 15.82 10 23C10 27.16 12.16 30.86 15.5 33.2V38L19.68 35.68C21.06 36.04 22.5 36.24 24 36.24C31.732 36.24 38 30.42 38 23.24C38 16.06 31.732 10 24 10Z" fill="white" />
    <path d="M20 26L15 20.5L20.5 23L24 19L28.5 23L25 20.5L29 26" stroke="#0084FF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const OrphanedUsersLogo = () => (
  <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center">
    <Users className="w-5 h-5 text-white" />
  </div>
);


const GmailLogo = () => (
  <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-8 h-8">
    <rect width="48" height="48" rx="10" fill="#EA4335" />
    <path d="M12 16L24 25L36 16V34H12V16Z" fill="white" opacity="0.3" />
    <path d="M12 14L24 24L36 14" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <rect x="11" y="14" width="26" height="20" rx="2" stroke="white" strokeWidth="2" />
  </svg>
);

const BanxicoLogo = () => (
  <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-8 h-8">
    <rect width="48" height="48" rx="10" fill="#0D7377" />
    <text x="24" y="30" textAnchor="middle" fill="white" fontSize="18" fontWeight="bold" fontFamily="sans-serif">$</text>
    <path d="M14 38H34" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
    <path d="M16 10H32L34 14H14L16 10Z" fill="white" opacity="0.3" />
  </svg>
);

const DeliveryTrackingLogo = () => (
  <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-8 h-8">
    <rect width="48" height="48" rx="10" fill="#D97706" />
    <path d="M12 28H14L16 20H30L32 28H34" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M14 28H34V32C34 33.1 33.1 34 32 34H16C14.9 34 14 33.1 14 32V28Z" stroke="white" strokeWidth="2" />
    <circle cx="19" cy="34" r="2.5" fill="white" />
    <circle cx="29" cy="34" r="2.5" fill="white" />
    <path d="M20 16L24 12L28 16" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M24 12V20" stroke="white" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

type IntegrationKey = 'mailgun' | 'paypal' | 'stripe' | 'shipday' | 'facturama' | 'gmail' | 'banxico' | 'sat' | 'mercadopago' | 'manychat' | 'delivery_tracking' | 'orphaned' | 'woocommerce';

const SystemSettings: React.FC = () => {
  const navigate = useNavigate();
  const [openModal, setOpenModal] = useState<IntegrationKey | null>(null);
  const [configuredStatus, setConfiguredStatus] = useState<Record<IntegrationKey, boolean | null>>({
    mailgun: null,
    paypal: null,
    stripe: null,
    shipday: null,
    facturama: null,
    gmail: null,
    banxico: null,
    sat: null,
    mercadopago: null,
    manychat: null,
    delivery_tracking: null,
    orphaned: true,
    woocommerce: null,
  });

  useEffect(() => {
    checkAllStatuses();
  }, []);

  const checkAllStatuses = async () => {
    const results = await Promise.allSettled([
      emailConfigService.getEmailConfigForm(),
      paypalConfigService.getPayPalConfig(),
      stripeConfigService.getStripeConfig(),
      facturamaConfigService.getFacturamaConfig(),
      shipdayService.getConfig(),
      woocommerceConfigService.getConfig(),
      gmailConfigService.getConfig(),
      banxicoConfigService.getConfig(),
      satDescargaService.getConfigStatus(),
      mercadoPagoConfigService.getConfig(),
      manychatConfigService.getConfig(),
      deliveryTrackingConfigService.getConfig(),
    ]);

    const [mailgunResult, paypalResult, stripeResult, facturamaResult, shipdayResult, woocommerceResult, gmailResult, banxicoResult, satResult, mercadoPagoResult, manychatResult, deliveryTrackingResult] = results;

    setConfiguredStatus({
      mailgun: mailgunResult.status === 'fulfilled' && !!mailgunResult.value?.mailgun_api_key,
      paypal: paypalResult.status === 'fulfilled' && !!paypalResult.value?.client_id,
      stripe: stripeResult.status === 'fulfilled' && !!stripeResult.value?.publishable_key,
      facturama: facturamaResult.status === 'fulfilled' && !!facturamaResult.value?.username,
      shipday: shipdayResult.status === 'fulfilled' && !!shipdayResult.value?.api_key,
      gmail: gmailResult.status === 'fulfilled' && !!(gmailResult.value as GmailConfig | null)?.is_active,
      banxico: banxicoResult.status === 'fulfilled' && !!(banxicoResult.value as any)?.is_active,
      sat: satResult.status === 'fulfilled' && !!(satResult.value as any)?.configured,
      mercadopago: mercadoPagoResult.status === 'fulfilled' && !!(mercadoPagoResult.value as any)?.is_active,
      manychat: manychatResult.status === 'fulfilled' && !!(manychatResult.value as any)?.api_token,
      delivery_tracking: deliveryTrackingResult.status === 'fulfilled' && !!(deliveryTrackingResult.value as any)?.api_key,
      orphaned: true,
      woocommerce: woocommerceResult.status === 'fulfilled' && !!woocommerceResult.value?.store_url,
    });
  };

  const integrations: {
    key: IntegrationKey;
    logo: React.ReactNode;
    name: string;
    description: string;
    accentColor: string;
    modalLogo: React.ReactNode;
    component: React.ReactNode;
  }[] = [
    {
      key: 'mailgun',
      logo: <MailgunLogo />,
      name: 'Mailgun',
      description: 'Envío de emails transaccionales, notificaciones y correos de prueba.',
      accentColor: 'bg-orange-50',
      modalLogo: <MailgunLogo />,
      component: <EmailSettings />,
    },
    {
      key: 'paypal',
      logo: <PayPalLogo />,
      name: 'PayPal',
      description: 'Facturación y cobro de pedidos mediante integración con PayPal.',
      accentColor: 'bg-blue-50',
      modalLogo: <PayPalLogo />,
      component: <PayPalSettings />,
    },
    {
      key: 'stripe',
      logo: <StripeLogo />,
      name: 'Stripe',
      description: 'Procesamiento de pagos con tarjeta de crédito y débito.',
      accentColor: 'bg-violet-50',
      modalLogo: <StripeLogo />,
      component: <StripeSettings />,
    },
    {
      key: 'shipday',
      logo: <ShipdayLogo />,
      name: 'Shipday',
      description: 'Gestión de rutas y entregas con seguimiento en tiempo real.',
      accentColor: 'bg-slate-50',
      modalLogo: <ShipdayLogo />,
      component: <ShipdaySettings />,
    },
    {
      key: 'facturama',
      logo: <FacturamaLogo />,
      name: 'Facturama',
      description: 'Generación de facturas electrónicas CFDI 4.0 para el SAT.',
      accentColor: 'bg-green-50',
      modalLogo: <FacturamaLogo />,
      component: <FacturamaSettings />,
    },
    {
      key: 'gmail',
      logo: <GmailLogo />,
      name: 'Gmail Facturas',
      description: 'Escanea emails de Gmail para detectar y extraer datos de facturas automaticamente.',
      accentColor: 'bg-red-50',
      modalLogo: <GmailLogo />,
      component: <GmailSettings />,
    },
    {
      key: 'banxico',
      logo: <BanxicoLogo />,
      name: 'Banxico Tipo de Cambio',
      description: 'Obtiene el tipo de cambio FIX USD/MXN oficial de Banxico para convertir facturas en dolares.',
      accentColor: 'bg-teal-50',
      modalLogo: <BanxicoLogo />,
      component: <BanxicoSettings />,
    },
    {
      key: 'sat',
      logo: <SatLogo />,
      name: 'SAT e.firma',
      description: 'Configura tu e.firma (FIEL) para la descarga masiva de CFDI del SAT.',
      accentColor: 'bg-emerald-50',
      modalLogo: <SatLogo />,
      component: <SatSettings />,
    },
    {
      key: 'mercadopago',
      logo: <MercadoPagoLogo />,
      name: 'Mercado Pago',
      description: 'Importa retiros, transferencias y comisiones de Mercado Pago como gastos.',
      accentColor: 'bg-cyan-50',
      modalLogo: <MercadoPagoLogo />,
      component: <MercadoPagoSettings />,
    },
    {
      key: 'manychat',
      logo: <ManychatLogo />,
      name: 'Manychat',
      description: 'Busca suscriptores, consulta y actualiza custom fields en Manychat.',
      accentColor: 'bg-blue-50',
      modalLogo: <ManychatLogo />,
      component: <ManychatSettings />,
    },
    {
      key: 'delivery_tracking',
      logo: <DeliveryTrackingLogo />,
      name: 'Delivery Tracking',
      description: 'Rastreo y gestión de entregas en tiempo real desde una app externa.',
      accentColor: 'bg-amber-50',
      modalLogo: <DeliveryTrackingLogo />,
      component: <DeliveryTrackingSettings />,
    },
    {
      key: 'orphaned',
      logo: <OrphanedUsersLogo />,
      name: 'Usuarios Huérfanos',
      description: 'Detecta y repara usuarios de autenticación sin perfil asociado.',
      accentColor: 'bg-orange-50',
      modalLogo: <OrphanedUsersLogo />,
      component: <OrphanedUserFixer />,
    },
  ];

  const activeIntegration = integrations.find(i => i.key === openModal);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Integraciones</h2>
        <p className="text-gray-500 text-sm mt-1">
          Configura los servicios externos conectados a tu sistema.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {integrations.map(integration => (
          <IntegrationCard
            key={integration.key}
            logo={integration.logo}
            name={integration.name}
            description={integration.description}
            configured={configuredStatus[integration.key]}
            accentColor={integration.accentColor}
            onClick={() => setOpenModal(integration.key)}
          />
        ))}
        <IntegrationCard
          logo={<WooCommerceLogo />}
          name="WooCommerce"
          description="Importa pedidos desde tu tienda WooCommerce y crea clientes automáticamente."
          configured={configuredStatus.woocommerce}
          accentColor="bg-violet-50"
          onClick={() => navigate('/woocommerce')}
        />
      </div>

      {activeIntegration && (
        <IntegrationModal
          open={openModal !== null}
          onClose={() => setOpenModal(null)}
          title={activeIntegration.name}
          logo={activeIntegration.modalLogo}
        >
          {activeIntegration.component}
        </IntegrationModal>
      )}
    </div>
  );
};

export default SystemSettings;
