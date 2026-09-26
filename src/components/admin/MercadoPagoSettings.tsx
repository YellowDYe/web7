import React, { useState, useEffect } from 'react';
import {
  Save, CreditCard as EditIcon, Key, Eye, EyeOff, Loader as Loader2,
  CircleCheck as CheckCircle, CircleAlert as AlertCircle, RefreshCw,
  CreditCard, Banknote, Wallet, Store, Shield, Globe, TestTube, Zap,
  ChevronDown, ChevronUp, Copy, CheckCheck,
} from 'lucide-react';
import { mercadoPagoConfigService, MercadoPagoConfigForm } from '../../services/mercadoPagoConfigService';

const MercadoPagoSettings: React.FC = () => {
  const [config, setConfig] = useState<MercadoPagoConfigForm>({
    access_token: '',
    public_key: '',
    is_active: false,
    test_mode: true,
    enable_credit_card: true,
    enable_debit_card: true,
    enable_ticket: true,
    enable_bank_transfer: true,
    enable_mercado_pago_wallet: true,
    enable_checkout_pro: true,
    max_installments: 12,
    statement_descriptor: '',
    webhook_secret: '',
  });
  const [isEditing, setIsEditing] = useState(false);
  const [configLoading, setConfigLoading] = useState(true);
  const [saveLoading, setSaveLoading] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [showWebhookSecret, setShowWebhookSecret] = useState(false);
  const [configError, setConfigError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [testResult, setTestResult] = useState<{ user_id: string; first_name: string; last_name: string } | null>(null);
  const [testLoading, setTestLoading] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [showPaymentMethods, setShowPaymentMethods] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [copiedWebhook, setCopiedWebhook] = useState(false);

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const webhookUrl = `${supabaseUrl}/functions/v1/mercado-pago-webhook`;

  const isTestToken = config.access_token.startsWith('TEST-') || config.access_token.startsWith('APP_USR-') === false;
  const isProdToken = config.access_token.startsWith('APP_USR-');
  const envLabel = !config.access_token ? null : isProdToken ? 'Produccion' : 'Pruebas';
  const envColor = isProdToken ? 'bg-green-100 text-green-800 border-green-200' : 'bg-yellow-100 text-yellow-800 border-yellow-200';

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      setConfigLoading(true);
      setConfigError(null);
      const fullConfig = await mercadoPagoConfigService.getConfig();
      if (fullConfig) {
        setConfig({
          access_token: fullConfig.access_token,
          public_key: fullConfig.public_key || '',
          is_active: fullConfig.is_active,
          test_mode: fullConfig.test_mode,
          enable_credit_card: fullConfig.enable_credit_card,
          enable_debit_card: fullConfig.enable_debit_card,
          enable_ticket: fullConfig.enable_ticket,
          enable_bank_transfer: fullConfig.enable_bank_transfer,
          enable_mercado_pago_wallet: fullConfig.enable_mercado_pago_wallet,
          enable_checkout_pro: fullConfig.enable_checkout_pro,
          max_installments: fullConfig.max_installments,
          statement_descriptor: fullConfig.statement_descriptor || '',
          webhook_secret: fullConfig.webhook_secret || '',
        });
        setLastSync(fullConfig.last_sync_at);
      }
    } catch (err: any) {
      setConfigError(err.message || 'Error al cargar la configuracion');
    } finally {
      setConfigLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaveLoading(true);
      setConfigError(null);

      if (config.is_active && !config.access_token) {
        setConfigError('Ingresa el Access Token de Mercado Pago para activar la integracion');
        return;
      }
      if (config.is_active && !config.public_key) {
        setConfigError('Ingresa la Public Key de Mercado Pago para activar la integracion');
        return;
      }

      await mercadoPagoConfigService.updateConfig(config);
      setSaveSuccess(true);
      setIsEditing(false);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      setConfigError(err.message || 'Error al guardar');
    } finally {
      setSaveLoading(false);
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setShowToken(false);
    setShowWebhookSecret(false);
    setSaveSuccess(false);
    setConfigError(null);
    loadConfig();
  };

  const handleTestConnection = async () => {
    setTestLoading(true);
    setTestResult(null);
    setConfigError(null);
    try {
      const apiUrl = `${supabaseUrl}/functions/v1/mercado-pago-sync`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'test-connection' }),
      });

      const data = await response.json();
      if (response.ok && data.success) {
        setTestResult(data);
      } else {
        setConfigError(data.error || 'Error al conectar con Mercado Pago. Verifica tu Access Token.');
      }
    } catch {
      setConfigError('Error de conexion al probar Mercado Pago.');
    } finally {
      setTestLoading(false);
    }
  };

  const handleCopyWebhookUrl = async () => {
    try {
      await navigator.clipboard.writeText(webhookUrl);
      setCopiedWebhook(true);
      setTimeout(() => setCopiedWebhook(false), 2000);
    } catch {
      // fallback
    }
  };

  const paymentMethods = [
    { key: 'enable_credit_card' as const, label: 'Tarjeta de Credito', icon: CreditCard, desc: 'Visa, Mastercard, AMEX' },
    { key: 'enable_debit_card' as const, label: 'Tarjeta de Debito', icon: CreditCard, desc: 'Visa Debito, Mastercard Debito' },
    { key: 'enable_ticket' as const, label: 'Efectivo (OXXO)', icon: Store, desc: 'Pago en tiendas de conveniencia' },
    { key: 'enable_bank_transfer' as const, label: 'Transferencia Bancaria', icon: Banknote, desc: 'SPEI / Transferencia' },
    { key: 'enable_mercado_pago_wallet' as const, label: 'Mercado Pago Wallet', icon: Wallet, desc: 'Saldo de Mercado Pago (dentro del formulario)' },
    { key: 'enable_checkout_pro' as const, label: 'Checkout Pro (Redireccionar a MP)', icon: Globe, desc: 'Redirige al cliente a Mercado Pago para pagar con saldo, tarjetas guardadas y mas' },
  ];

  if (configLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-cyan-600" />
        <span className="ml-2 text-gray-600">Cargando configuracion...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Environment Badge */}
      {envLabel && (
        <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold border ${envColor}`}>
          {isProdToken ? <Globe className="w-3.5 h-3.5" /> : <TestTube className="w-3.5 h-3.5" />}
          Entorno: {envLabel}
        </div>
      )}

      {/* Instructions */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="text-sm font-semibold text-blue-900 mb-2">Como obtener tus credenciales</h4>
        <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
          <li>Ingresa a <span className="font-medium">Mercado Pago Developers</span> (mercadopago.com.mx/developers)</li>
          <li>Ve a <span className="font-medium">Tus integraciones</span> y selecciona tu aplicacion</li>
          <li>Copia el <span className="font-medium">Access Token</span> y la <span className="font-medium">Public Key</span></li>
          <li>Para produccion, usa las credenciales de <span className="font-medium">Credenciales de produccion</span></li>
        </ol>
      </div>

      {/* Status */}
      {config.is_active && lastSync && (
        <div className="flex items-center gap-2 text-sm text-gray-600 bg-gray-50 px-3 py-2 rounded-lg">
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Ultima sincronizacion: {new Date(lastSync).toLocaleString('es-MX')}</span>
        </div>
      )}

      {/* === CREDENTIALS SECTION === */}
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            <Key className="w-3.5 h-3.5 inline-block mr-1" />
            Access Token
          </label>
          <div className="relative">
            <input
              type={showToken ? 'text' : 'password'}
              value={config.access_token}
              onChange={(e) => setConfig({ ...config, access_token: e.target.value })}
              disabled={!isEditing}
              placeholder="APP_USR-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg text-sm disabled:bg-gray-50 disabled:text-gray-500 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none transition-all"
            />
            <button
              type="button"
              onClick={() => setShowToken(!showToken)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            <Key className="w-3.5 h-3.5 inline-block mr-1" />
            Public Key
          </label>
          <input
            type={showToken ? 'text' : 'password'}
            value={config.public_key}
            onChange={(e) => setConfig({ ...config, public_key: e.target.value })}
            disabled={!isEditing}
            placeholder="APP_USR-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm disabled:bg-gray-50 disabled:text-gray-500 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none transition-all"
          />
          <p className="mt-1 text-xs text-gray-500">Se usa para el formulario de pago en el checkout.</p>
        </div>

        {/* Active + Test Mode toggles */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <label className="flex items-center gap-3 cursor-pointer">
            <div className="relative inline-flex items-center">
              <input
                type="checkbox"
                checked={config.is_active}
                onChange={(e) => setConfig({ ...config, is_active: e.target.checked })}
                disabled={!isEditing}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-cyan-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-cyan-600 peer-disabled:opacity-50"></div>
            </div>
            <span className="text-sm text-gray-700">Integracion activa</span>
          </label>

          <label className="flex items-center gap-3 cursor-pointer">
            <div className="relative inline-flex items-center">
              <input
                type="checkbox"
                checked={config.test_mode}
                onChange={(e) => setConfig({ ...config, test_mode: e.target.checked })}
                disabled={!isEditing}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-yellow-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-yellow-500 peer-disabled:opacity-50"></div>
            </div>
            <div className="flex items-center gap-1.5">
              <TestTube className="w-3.5 h-3.5 text-yellow-600" />
              <span className="text-sm text-gray-700">Modo de prueba</span>
            </div>
          </label>
        </div>
        {config.test_mode && (
          <p className="text-xs text-yellow-700 bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2">
            Con el modo de prueba activo, los administradores podran simular pagos en el checkout sin procesar transacciones reales.
          </p>
        )}
      </div>

      {/* === PAYMENT METHODS SECTION === */}
      <div className="border border-gray-200 rounded-xl overflow-hidden">
        <button
          type="button"
          onClick={() => setShowPaymentMethods(!showPaymentMethods)}
          className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
        >
          <div className="flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-gray-600" />
            <span className="text-sm font-semibold text-gray-800">Metodos de Pago</span>
            <span className="text-xs text-gray-500 bg-gray-200 px-2 py-0.5 rounded-full">
              {paymentMethods.filter(pm => config[pm.key]).length}/{paymentMethods.length} activos
            </span>
          </div>
          {showPaymentMethods ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </button>

        {showPaymentMethods && (
          <div className="divide-y divide-gray-100">
            {paymentMethods.map(pm => {
              const Icon = pm.icon;
              return (
                <div key={pm.key} className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${config[pm.key] ? 'bg-cyan-50 text-cyan-600' : 'bg-gray-100 text-gray-400'}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-800">{pm.label}</p>
                      <p className="text-xs text-gray-500">{pm.desc}</p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={config[pm.key]}
                      onChange={(e) => setConfig({ ...config, [pm.key]: e.target.checked })}
                      disabled={!isEditing}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-cyan-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-cyan-600 peer-disabled:opacity-50"></div>
                  </label>
                </div>
              );
            })}

            {/* Max installments */}
            <div className="px-4 py-3">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Meses sin intereses (maximo)</label>
              <select
                value={config.max_installments}
                onChange={(e) => setConfig({ ...config, max_installments: Number(e.target.value) })}
                disabled={!isEditing}
                className="w-full sm:w-48 px-3 py-2 border border-gray-300 rounded-lg text-sm disabled:bg-gray-50 disabled:text-gray-500 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none"
              >
                {[1, 3, 6, 9, 12].map(n => (
                  <option key={n} value={n}>{n === 1 ? 'Sin meses (pago unico)' : `Hasta ${n} meses`}</option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>

      {/* === ADVANCED SECTION === */}
      <div className="border border-gray-200 rounded-xl overflow-hidden">
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
        >
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-gray-600" />
            <span className="text-sm font-semibold text-gray-800">Configuracion Avanzada</span>
          </div>
          {showAdvanced ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </button>

        {showAdvanced && (
          <div className="px-4 py-4 space-y-4">
            {/* Webhook URL */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                <Zap className="w-3.5 h-3.5 inline-block mr-1" />
                URL del Webhook (Notificaciones IPN)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={webhookUrl}
                  readOnly
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm bg-gray-50 text-gray-600 font-mono text-xs"
                />
                <button
                  type="button"
                  onClick={handleCopyWebhookUrl}
                  className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  title="Copiar URL"
                >
                  {copiedWebhook ? <CheckCheck className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4 text-gray-500" />}
                </button>
              </div>
              <p className="mt-1.5 text-xs text-gray-500">
                Configura esta URL en tu aplicacion de Mercado Pago &rarr; Webhooks &rarr; URL de notificacion. Esto permite recibir confirmaciones automaticas para pagos con OXXO y transferencias bancarias.
              </p>
            </div>

            {/* Webhook Secret */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                <Key className="w-3.5 h-3.5 inline-block mr-1" />
                Webhook Secret (opcional)
              </label>
              <div className="relative">
                <input
                  type={showWebhookSecret ? 'text' : 'password'}
                  value={config.webhook_secret}
                  onChange={(e) => setConfig({ ...config, webhook_secret: e.target.value })}
                  disabled={!isEditing}
                  placeholder="Clave secreta para validar notificaciones"
                  className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg text-sm disabled:bg-gray-50 disabled:text-gray-500 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowWebhookSecret(!showWebhookSecret)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showWebhookSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="mt-1 text-xs text-gray-500">
                Encuentra esta clave en Mercado Pago Developers &rarr; Webhooks &rarr; Firma secreta.
              </p>
            </div>

            {/* Statement Descriptor */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Descripcion en estado de cuenta</label>
              <input
                type="text"
                value={config.statement_descriptor}
                onChange={(e) => setConfig({ ...config, statement_descriptor: e.target.value.slice(0, 22) })}
                disabled={!isEditing}
                placeholder="Ej: Mi Tienda"
                maxLength={22}
                className="w-full sm:w-72 px-3 py-2 border border-gray-300 rounded-lg text-sm disabled:bg-gray-50 disabled:text-gray-500 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none transition-all"
              />
              <p className="mt-1 text-xs text-gray-500">Texto que aparece en el estado de cuenta del comprador (max 22 caracteres).</p>
            </div>
          </div>
        )}
      </div>

      {/* Messages */}
      {configError && (
        <div className="flex items-center gap-2 text-red-700 bg-red-50 px-3 py-2 rounded-lg border border-red-200">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span className="text-sm">{configError}</span>
        </div>
      )}

      {saveSuccess && (
        <div className="flex items-center gap-2 text-emerald-700 bg-emerald-50 px-3 py-2 rounded-lg border border-emerald-200">
          <CheckCircle className="w-4 h-4" />
          <span className="text-sm font-medium">Configuracion guardada correctamente</span>
        </div>
      )}

      {testResult && (
        <div className="flex items-center gap-2 text-emerald-700 bg-emerald-50 px-3 py-2 rounded-lg border border-emerald-200">
          <CheckCircle className="w-4 h-4" />
          <span className="text-sm">
            Conexion exitosa. Usuario: <span className="font-semibold">{testResult.first_name} {testResult.last_name}</span> (ID: {testResult.user_id})
            {envLabel && <span className="ml-2 text-xs font-bold uppercase">({envLabel})</span>}
          </span>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-3 pt-2">
        {isEditing ? (
          <>
            <button
              onClick={handleSave}
              disabled={saveLoading}
              className="inline-flex items-center px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white font-medium rounded-lg transition-colors text-sm disabled:opacity-50"
            >
              {saveLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Guardar
            </button>
            <button
              onClick={handleCancel}
              className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm font-medium transition-colors"
            >
              Cancelar
            </button>
          </>
        ) : (
          <>
            <button
              onClick={() => setIsEditing(true)}
              className="inline-flex items-center px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white font-medium rounded-lg transition-colors text-sm"
            >
              <EditIcon className="w-4 h-4 mr-2" />
              Editar
            </button>
            {config.access_token && (
              <button
                onClick={handleTestConnection}
                disabled={testLoading}
                className="inline-flex items-center px-4 py-2 border border-cyan-600 text-cyan-700 rounded-lg hover:bg-cyan-50 text-sm font-medium transition-colors disabled:opacity-50"
              >
                {testLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                Probar Conexion
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default MercadoPagoSettings;
