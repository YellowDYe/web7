import React, { useState, useEffect } from 'react';
import { DollarSign, Save, Edit, Key, Globe, Shield, Eye, EyeOff, Loader2, CheckCircle, AlertCircle, Settings } from 'lucide-react';
import { paypalConfigService } from '../../services/paypalConfigService';
import { PayPalConfigForm } from '../../types/paypalConfig';
import { paypalService } from '../../services/paypalService';

const PayPalSettings: React.FC = () => {
  const [paypalConfig, setPaypalConfig] = useState<PayPalConfigForm>({
    client_id: '',
    client_secret: '',
    environment: 'sandbox'
  });
  const [isEditing, setIsEditing] = useState(false);
  const [configLoading, setConfigLoading] = useState(true);
  const [saveLoading, setSaveLoading] = useState(false);
  const [showClientId, setShowClientId] = useState(false);
  const [showClientSecret, setShowClientSecret] = useState(false);
  const [configError, setConfigError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [testLoading, setTestLoading] = useState(false);
  const [testResult, setTestResult] = useState<{
    type: 'success' | 'error' | null;
    message: string;
  }>({ type: null, message: '' });

  useEffect(() => {
    loadPayPalConfig();
  }, []);

  const loadPayPalConfig = async () => {
    try {
      setConfigLoading(true);
      setConfigError(null);
      const config = await paypalConfigService.getPayPalConfigForm();
      setPaypalConfig(config);
    } catch (err) {
      console.error('Error loading PayPal config:', err);
      setConfigError('Error al cargar la configuración de PayPal');
    } finally {
      setConfigLoading(false);
    }
  };

  const handleConfigChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setPaypalConfig(prev => ({
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

      if (!paypalConfig.client_id || !paypalConfig.client_secret) {
        setConfigError('Por favor complete todos los campos requeridos');
        return;
      }

      await paypalConfigService.updatePayPalConfig(paypalConfig);

      paypalConfigService.clearCache();
      paypalService.clearAuthCache();

      setSaveSuccess(true);
      setIsEditing(false);

      setTimeout(() => {
        setSaveSuccess(false);
      }, 3000);
    } catch (err: any) {
      console.error('Error saving PayPal config:', err);
      setConfigError(err.message || 'Error al guardar la configuración');
    } finally {
      setSaveLoading(false);
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setSaveSuccess(false);
    setShowClientId(false);
    setShowClientSecret(false);
    loadPayPalConfig();
  };

  const handleTestConnection = async () => {
    try {
      setTestLoading(true);
      setTestResult({ type: null, message: '' });

      const config = await paypalConfigService.getPayPalConfig();

      if (!config || !config.client_id || !config.client_secret) {
        setTestResult({
          type: 'error',
          message: 'Configure las credenciales de PayPal antes de probar la conexión'
        });
        return;
      }

      paypalService.clearAuthCache();

      await paypalService.testConnection();

      setTestResult({
        type: 'success',
        message: 'Conexión exitosa con PayPal. Las credenciales son válidas.'
      });
    } catch (error: any) {
      console.error('Error testing PayPal connection:', error);
      setTestResult({
        type: 'error',
        message: error.message || 'Verifique las credenciales y el entorno configurado'
      });
    } finally {
      setTestLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center space-x-3 mb-6">
          <div className="bg-blue-100 p-2 rounded-lg">
            <Settings className="w-5 h-5 text-blue-600" />
          </div>
          <h3 className="text-xl font-semibold text-gray-900 font-poppins">
            Credenciales de API
          </h3>
        </div>

        {/* Security Notice */}
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-xl">
          <div className="flex items-start space-x-2">
            <Shield className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-800">
              <p className="font-medium mb-1">Configuración Segura:</p>
              <ul className="space-y-1 text-blue-700">
                <li>• Las credenciales se almacenan de forma segura en la base de datos</li>
                <li>• Use el entorno Sandbox para pruebas</li>
                <li>• Solo cambie a Production cuando esté listo para procesar pagos reales</li>
                <li>• Obtenga las credenciales desde su Dashboard de PayPal</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Configuration Form */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-lg font-medium text-gray-900">Configuración de PayPal</h4>
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
              {/* Environment */}
              <div>
                <label htmlFor="environment" className="block text-sm font-medium text-gray-700 mb-2">
                  Entorno *
                </label>
                <div className="relative">
                  <Globe className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <select
                    id="environment"
                    name="environment"
                    value={paypalConfig.environment}
                    onChange={handleConfigChange}
                    disabled={!isEditing}
                    className={`w-full pl-10 pr-4 py-3 border rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-all ${
                      isEditing ? 'border-gray-300 bg-white' : 'border-gray-200 bg-gray-50'
                    }`}
                  >
                    <option value="sandbox">Sandbox (Pruebas)</option>
                    <option value="production">Production (En vivo)</option>
                  </select>
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  Seleccione Sandbox para pruebas, Production para pagos reales
                </p>
              </div>

              {/* Client ID */}
              <div>
                <label htmlFor="client_id" className="block text-sm font-medium text-gray-700 mb-2">
                  Client ID *
                </label>
                <div className="relative">
                  <Key className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type={isEditing && showClientId ? "text" : "password"}
                    id="client_id"
                    name="client_id"
                    value={paypalConfig.client_id}
                    onChange={handleConfigChange}
                    readOnly={!isEditing}
                    className={`w-full pl-10 pr-12 py-3 border rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-all ${
                      isEditing ? 'border-gray-300 bg-white' : 'border-gray-200 bg-gray-50'
                    }`}
                    placeholder="AbCdEf123456..."
                  />
                  {isEditing && (
                    <button
                      type="button"
                      onClick={() => setShowClientId(!showClientId)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      {showClientId ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  )}
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  Su Client ID de PayPal del Dashboard de desarrolladores
                </p>
              </div>

              {/* Client Secret */}
              <div>
                <label htmlFor="client_secret" className="block text-sm font-medium text-gray-700 mb-2">
                  Client Secret *
                </label>
                <div className="relative">
                  <Key className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type={isEditing && showClientSecret ? "text" : "password"}
                    id="client_secret"
                    name="client_secret"
                    value={paypalConfig.client_secret}
                    onChange={handleConfigChange}
                    readOnly={!isEditing}
                    className={`w-full pl-10 pr-12 py-3 border rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-all ${
                      isEditing ? 'border-gray-300 bg-white' : 'border-gray-200 bg-gray-50'
                    }`}
                    placeholder="EFghIj789012..."
                  />
                  {isEditing && (
                    <button
                      type="button"
                      onClick={() => setShowClientSecret(!showClientSecret)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      {showClientSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  )}
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  Su Client Secret de PayPal. Se almacena de forma segura.
                </p>
              </div>
            </div>
          )}

          {/* Save Success Message */}
          {saveSuccess && (
            <div className="p-4 bg-success-50 border border-success-200 rounded-xl flex items-center space-x-2 mt-4">
              <CheckCircle className="w-5 h-5 text-success-600" />
              <span className="text-sm text-success-800">Configuración guardada exitosamente</span>
            </div>
          )}
        </div>

        {/* Test Connection Section */}
        <div className="space-y-4 pt-6 border-t border-gray-200">
          <h4 className="text-lg font-medium text-gray-900">Probar Conexión</h4>
          <p className="text-gray-600 text-sm">
            Verifique que las credenciales de PayPal funcionan correctamente.
          </p>

          <button
            onClick={handleTestConnection}
            disabled={testLoading || !paypalConfig.client_id || !paypalConfig.client_secret}
            className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-xl font-medium transition-all duration-200 transform hover:scale-105 flex items-center space-x-2 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
          >
            {testLoading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Probando...</span>
              </>
            ) : (
              <>
                <CheckCircle className="w-5 h-5" />
                <span>Probar Conexión</span>
              </>
            )}
          </button>

          {/* Test Result */}
          {testResult.type && (
            <div className={`p-4 rounded-xl flex items-start space-x-3 ${
              testResult.type === 'success'
                ? 'bg-success-50 border border-success-200'
                : 'bg-red-50 border border-red-200'
            }`}>
              {testResult.type === 'success' ? (
                <CheckCircle className="w-5 h-5 text-success-600 flex-shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              )}
              <div className="flex-1">
                <p className={`text-sm font-medium ${
                  testResult.type === 'success' ? 'text-success-800' : 'text-red-800'
                }`}>
                  {testResult.type === 'success' ? 'Conexión exitosa' : 'Error de conexión'}
                </p>
                <p className={`text-sm mt-1 ${
                  testResult.type === 'success' ? 'text-success-700' : 'text-red-700'
                }`}>
                  {testResult.message}
                </p>
              </div>
            </div>
          )}
        </div>


        {/* Webhook Configuration Section */}
        <div className="space-y-4 pt-6 border-t border-gray-200 mt-6">
          <div className="flex items-center space-x-3">
            <div className="bg-green-100 p-2 rounded-lg">
              <Globe className="w-5 h-5 text-green-600" />
            </div>
            <h4 className="text-lg font-medium text-gray-900">Configuración de Webhook</h4>
          </div>
          
          <p className="text-gray-600 text-sm">
            Configure este webhook en su Dashboard de PayPal para recibir notificaciones de eventos de facturación.
          </p>

          {/* Webhook URL */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              URL del Webhook
            </label>
            <div className="flex items-center space-x-2">
              <div className="flex-1 bg-gray-50 border border-gray-300 rounded-xl px-4 py-3 font-mono text-sm text-gray-800 overflow-x-auto">
                {import.meta.env.VITE_SUPABASE_URL}/functions/v1/paypal-webhook
              </div>
              <button
                onClick={() => {
                  const webhookUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/paypal-webhook`;
                  navigator.clipboard.writeText(webhookUrl);
                  setTestResult({ type: 'success', message: 'URL copiada al portapapeles' });
                  setTimeout(() => setTestResult({ type: null, message: '' }), 2000);
                }}
                className="px-4 py-3 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-xl font-medium transition-colors flex items-center space-x-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                <span>Copiar</span>
              </button>
            </div>
          </div>

          {/* Webhook Events */}
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
            <div className="flex items-start space-x-2">
              <Shield className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-blue-800">
                <p className="font-medium mb-2">Eventos a configurar en PayPal:</p>
                <ul className="space-y-1 text-blue-700">
                  <li>• <strong>INVOICING.INVOICE.CREATED</strong> - Cuando se crea una factura</li>
                  <li>• <strong>INVOICING.INVOICE.PAID</strong> - Cuando se paga una factura</li>
                  <li>• <strong>INVOICING.INVOICE.CANCELLED</strong> - Cuando se cancela una factura</li>
                  <li>• <strong>INVOICING.INVOICE.REFUNDED</strong> - Cuando se reembolsa una factura</li>
                  <li>• <strong>INVOICING.INVOICE.UPDATED</strong> - Cuando se actualiza una factura</li>
                  <li>• <strong>PAYMENT.CAPTURE.COMPLETED</strong> - Cuando se completa un pago</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Webhook Instructions */}
          <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl">
            <div className="flex items-start space-x-2">
              <Shield className="w-4 h-4 text-gray-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-gray-800">
                <p className="font-medium mb-2">Cómo configurar el webhook en PayPal:</p>
                <ol className="space-y-1 text-gray-700 list-decimal list-inside">
                  <li>Inicie sesión en su <a href="https://developer.paypal.com/dashboard/" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Dashboard de PayPal</a></li>
                  <li>Navegue a "Apps & Credentials" y seleccione su aplicación</li>
                  <li>Haga clic en "Add Webhook" en la sección de Webhooks</li>
                  <li>Pegue la URL del webhook que aparece arriba</li>
                  <li>Seleccione los eventos de la lista anterior</li>
                  <li>Guarde la configuración</li>
                </ol>
              </div>
            </div>
          </div>
        </div>

        {/* Instructions */}
        <div className="mt-6 p-4 bg-gray-50 border border-gray-200 rounded-xl">
          <div className="flex items-start space-x-2">
            <Shield className="w-4 h-4 text-gray-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-gray-800">
              <p className="font-medium mb-1">Cómo obtener las credenciales:</p>
              <ol className="space-y-1 text-gray-700 list-decimal list-inside">
                <li>Inicie sesión en su <a href="https://developer.paypal.com/dashboard/" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Dashboard de PayPal</a></li>
                <li>Navegue a "Apps & Credentials"</li>
                <li>Seleccione el entorno (Sandbox o Live)</li>
                <li>Cree una nueva aplicación o seleccione una existente</li>
                <li>Copie el Client ID y Client Secret</li>
              </ol>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PayPalSettings;

