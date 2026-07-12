import React, { useState, useEffect } from 'react';
import { CreditCard, Save, Edit, Key, Globe, Shield, Eye, EyeOff, Loader2, CheckCircle, AlertCircle, Settings } from 'lucide-react';
import { stripeConfigService, StripeConfigForm } from '../../services/stripeConfigService';

const StripeSettings: React.FC = () => {
  const [stripeConfig, setStripeConfig] = useState<StripeConfigForm>({
    publishable_key: '',
    secret_key: '',
    webhook_secret: '',
    environment: 'test'
  });
  const [isEditing, setIsEditing] = useState(false);
  const [configLoading, setConfigLoading] = useState(true);
  const [saveLoading, setSaveLoading] = useState(false);
  const [showPublishableKey, setShowPublishableKey] = useState(false);
  const [showSecretKey, setShowSecretKey] = useState(false);
  const [showWebhookSecret, setShowWebhookSecret] = useState(false);
  const [configError, setConfigError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    loadStripeConfig();
  }, []);

  const loadStripeConfig = async () => {
    try {
      setConfigLoading(true);
      setConfigError(null);
      const config = await stripeConfigService.getStripeConfigForm();
      setStripeConfig(config);
    } catch (err) {
      console.error('Error loading Stripe config:', err);
      setConfigError('Error al cargar la configuración de Stripe');
    } finally {
      setConfigLoading(false);
    }
  };

  const handleConfigChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setStripeConfig(prev => ({
      ...prev,
      [name]: value
    }));

    if (saveSuccess) {
      setSaveSuccess(false);
    }
  };

  const handleSaveConfig = async () => {
    try {
      setSaveLoading(true);
      setConfigError(null);

      if (!stripeConfig.publishable_key || !stripeConfig.secret_key) {
        setConfigError('Por favor complete todos los campos requeridos');
        return;
      }

      await stripeConfigService.updateStripeConfig(stripeConfig);
      stripeConfigService.clearCache();

      setSaveSuccess(true);
      setIsEditing(false);

      setTimeout(() => {
        setSaveSuccess(false);
      }, 3000);
    } catch (err: any) {
      console.error('Error saving Stripe config:', err);
      setConfigError(err.message || 'Error al guardar la configuración');
    } finally {
      setSaveLoading(false);
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setSaveSuccess(false);
    setShowPublishableKey(false);
    setShowSecretKey(false);
    setShowWebhookSecret(false);
    loadStripeConfig();
  };

  const copyWebhookUrl = () => {
    const webhookUrl = stripeConfigService.getWebhookUrl();
    navigator.clipboard.writeText(webhookUrl);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2000);
  };

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center space-x-3 mb-6">
          <div className="bg-indigo-100 p-2 rounded-lg">
            <Settings className="w-5 h-5 text-indigo-600" />
          </div>
          <h3 className="text-xl font-semibold text-gray-900 font-poppins">
            Credenciales de API
          </h3>
        </div>

        <div className="mb-6 p-4 bg-indigo-50 border border-indigo-200 rounded-xl">
          <div className="flex items-start space-x-2">
            <Shield className="w-4 h-4 text-indigo-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-indigo-800">
              <p className="font-medium mb-1">Configuración Segura:</p>
              <ul className="space-y-1 text-indigo-700">
                <li>• Las credenciales se almacenan de forma segura en la base de datos</li>
                <li>• Use el modo Test para pruebas con tarjetas de prueba</li>
                <li>• Solo cambie a Live cuando esté listo para procesar pagos reales</li>
                <li>• Obtenga las credenciales desde su Dashboard de Stripe</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-lg font-medium text-gray-900">Configuración de Stripe</h4>
            {!isEditing ? (
              <button
                onClick={() => setIsEditing(true)}
                className="bg-primary-500 hover:bg-primary-600 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center space-x-2"
              >
                <Edit className="w-4 h-4" />
                <span>Editar</span>
              </button>
            ) : (
              <div className="flex space-x-2">
                <button
                  onClick={handleCancelEdit}
                  disabled={saveLoading}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSaveConfig}
                  disabled={saveLoading}
                  className="bg-success-500 hover:bg-success-600 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saveLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Guardando...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      <span>Guardar</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>

          {configLoading ? (
            <div className="p-4 bg-gray-50 rounded-xl">
              <div className="flex items-center space-x-2">
                <Loader2 className="w-4 h-4 animate-spin text-primary-500" />
                <span className="text-sm text-gray-600">Cargando configuración...</span>
              </div>
            </div>
          ) : configError ? (
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
              <div className="flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 text-red-600" />
                <span className="text-sm text-red-600">{configError}</span>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label htmlFor="environment" className="block text-sm font-medium text-gray-700 mb-2">
                  Entorno *
                </label>
                <div className="relative">
                  <Globe className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <select
                    id="environment"
                    name="environment"
                    value={stripeConfig.environment}
                    onChange={handleConfigChange}
                    disabled={!isEditing}
                    className={`w-full pl-10 pr-4 py-3 border rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-all ${
                      isEditing ? 'border-gray-300 bg-white' : 'border-gray-200 bg-gray-50'
                    }`}
                  >
                    <option value="test">Test (Pruebas)</option>
                    <option value="live">Live (En vivo)</option>
                  </select>
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  Seleccione Test para pruebas, Live para pagos reales
                </p>
              </div>

              <div>
                <label htmlFor="publishable_key" className="block text-sm font-medium text-gray-700 mb-2">
                  Publishable Key *
                </label>
                <div className="relative">
                  <Key className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type={isEditing && showPublishableKey ? "text" : "password"}
                    id="publishable_key"
                    name="publishable_key"
                    value={stripeConfig.publishable_key}
                    onChange={handleConfigChange}
                    readOnly={!isEditing}
                    className={`w-full pl-10 pr-12 py-3 border rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-all ${
                      isEditing ? 'border-gray-300 bg-white' : 'border-gray-200 bg-gray-50'
                    }`}
                    placeholder="pk_test_..."
                  />
                  {isEditing && (
                    <button
                      type="button"
                      onClick={() => setShowPublishableKey(!showPublishableKey)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      {showPublishableKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  )}
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  Su Publishable Key de Stripe (seguro para el frontend)
                </p>
              </div>

              <div>
                <label htmlFor="secret_key" className="block text-sm font-medium text-gray-700 mb-2">
                  Secret Key *
                </label>
                <div className="relative">
                  <Key className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type={isEditing && showSecretKey ? "text" : "password"}
                    id="secret_key"
                    name="secret_key"
                    value={stripeConfig.secret_key}
                    onChange={handleConfigChange}
                    readOnly={!isEditing}
                    className={`w-full pl-10 pr-12 py-3 border rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-all ${
                      isEditing ? 'border-gray-300 bg-white' : 'border-gray-200 bg-gray-50'
                    }`}
                    placeholder="sk_test_..."
                  />
                  {isEditing && (
                    <button
                      type="button"
                      onClick={() => setShowSecretKey(!showSecretKey)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      {showSecretKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  )}
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  Su Secret Key de Stripe. Se almacena de forma segura.
                </p>
              </div>

              <div>
                <label htmlFor="webhook_secret" className="block text-sm font-medium text-gray-700 mb-2">
                  Webhook Secret
                </label>
                <div className="relative">
                  <Key className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type={isEditing && showWebhookSecret ? "text" : "password"}
                    id="webhook_secret"
                    name="webhook_secret"
                    value={stripeConfig.webhook_secret}
                    onChange={handleConfigChange}
                    readOnly={!isEditing}
                    className={`w-full pl-10 pr-12 py-3 border rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-all ${
                      isEditing ? 'border-gray-300 bg-white' : 'border-gray-200 bg-gray-50'
                    }`}
                    placeholder="whsec_..."
                  />
                  {isEditing && (
                    <button
                      type="button"
                      onClick={() => setShowWebhookSecret(!showWebhookSecret)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      {showWebhookSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  )}
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  Webhook Signing Secret para verificar eventos de Stripe
                </p>
              </div>
            </div>
          )}

          {saveSuccess && (
            <div className="p-4 bg-success-50 border border-success-200 rounded-xl flex items-center space-x-2 mt-4">
              <CheckCircle className="w-5 h-5 text-success-600" />
              <span className="text-sm text-success-800">Configuración guardada exitosamente</span>
            </div>
          )}
        </div>

        <div className="space-y-4 pt-6 border-t border-gray-200 mt-6">
          <div className="flex items-center space-x-3">
            <div className="bg-green-100 p-2 rounded-lg">
              <Globe className="w-5 h-5 text-green-600" />
            </div>
            <h4 className="text-lg font-medium text-gray-900">Configuración de Webhook</h4>
          </div>

          <p className="text-gray-600 text-sm">
            Configure este webhook en su Dashboard de Stripe para recibir notificaciones de eventos de pago.
          </p>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              URL del Webhook
            </label>
            <div className="flex items-center space-x-2">
              <div className="flex-1 bg-gray-50 border border-gray-300 rounded-xl px-4 py-3 font-mono text-sm text-gray-800 overflow-x-auto">
                {stripeConfigService.getWebhookUrl()}
              </div>
              <button
                onClick={copyWebhookUrl}
                className="px-4 py-3 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-xl font-medium transition-colors flex items-center space-x-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                <span>Copiar</span>
              </button>
            </div>
          </div>

          <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-xl">
            <div className="flex items-start space-x-2">
              <Shield className="w-4 h-4 text-indigo-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-indigo-800">
                <p className="font-medium mb-2">Eventos a configurar en Stripe:</p>
                <ul className="space-y-1 text-indigo-700">
                  <li>• <strong>payment_intent.succeeded</strong> - Cuando un pago es exitoso</li>
                  <li>• <strong>payment_intent.payment_failed</strong> - Cuando un pago falla</li>
                  <li>• <strong>payment_intent.canceled</strong> - Cuando se cancela un intento de pago</li>
                  <li>• <strong>charge.refunded</strong> - Cuando se reembolsa un cargo</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl">
            <div className="flex items-start space-x-2">
              <Shield className="w-4 h-4 text-gray-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-gray-800">
                <p className="font-medium mb-2">Cómo configurar el webhook en Stripe:</p>
                <ol className="space-y-1 text-gray-700 list-decimal list-inside">
                  <li>Inicie sesión en su <a href="https://dashboard.stripe.com/webhooks" target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline">Dashboard de Stripe</a></li>
                  <li>Navegue a "Developers" → "Webhooks"</li>
                  <li>Haga clic en "Add endpoint"</li>
                  <li>Pegue la URL del webhook que aparece arriba</li>
                  <li>Seleccione los eventos de la lista anterior</li>
                  <li>Copie el Webhook Signing Secret y péguelo arriba</li>
                  <li>Guarde la configuración</li>
                </ol>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 p-4 bg-gray-50 border border-gray-200 rounded-xl">
          <div className="flex items-start space-x-2">
            <Shield className="w-4 h-4 text-gray-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-gray-800">
              <p className="font-medium mb-1">Cómo obtener las credenciales:</p>
              <ol className="space-y-1 text-gray-700 list-decimal list-inside">
                <li>Inicie sesión en su <a href="https://dashboard.stripe.com/apikeys" target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline">Dashboard de Stripe</a></li>
                <li>Navegue a "Developers" → "API keys"</li>
                <li>Seleccione el modo (Test o Live) usando el toggle</li>
                <li>Copie la Publishable key y Secret key</li>
                <li>Para el Webhook Secret, siga las instrucciones de webhooks arriba</li>
              </ol>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StripeSettings;
