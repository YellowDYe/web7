import React, { useState } from 'react';
import { Mail, Send, Loader2, CheckCircle, AlertCircle, Settings, Save, Edit, Key, Globe, Shield, Eye, EyeOff } from 'lucide-react';
import { emailService } from '../../services/emailService';
import { emailConfigService } from '../../services/emailConfigService';
import { mailgunConfig } from '../../config/mailgun';
import { EmailConfigForm } from '../../types/emailConfig';

const EmailSettings: React.FC = () => {
  const [emailConfig, setEmailConfig] = useState<EmailConfigForm>({
    mailgun_api_key: '',
    mailgun_domain: '',
    mailgun_base_url: ''
  });
  const [isEditing, setIsEditing] = useState(false);
  const [configLoading, setConfigLoading] = useState(true);
  const [saveLoading, setSaveLoading] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [configError, setConfigError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [configValidation, setConfigValidation] = useState<{
    valid: boolean;
    error?: string;
  } | null>(null);
  const [testEmailLoading, setTestEmailLoading] = useState(false);
  const [testEmailResult, setTestEmailResult] = useState<{
    type: 'success' | 'error' | null;
    message: string;
  }>({ type: null, message: '' });
  const [testEmailAddress, setTestEmailAddress] = useState('yellowdyemx@gmail.com');

  // Load email configuration on component mount
  React.useEffect(() => {
    loadEmailConfig();
  }, []);

  const loadEmailConfig = async () => {
    try {
      setConfigLoading(true);
      setConfigError(null);
      const config = await emailConfigService.getEmailConfigForm();
      setEmailConfig(config);
    } catch (err) {
      console.error('Error loading email config:', err);
      setConfigError('Error al cargar la configuración de email');
    } finally {
      setConfigLoading(false);
    }
  };

  const handleConfigChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setEmailConfig(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Clear save success when making changes
    if (saveSuccess) {
      setSaveSuccess(false);
    }
  };

  const handleSaveConfig = async () => {
    try {
      setSaveLoading(true);
      setConfigError(null);
      setConfigValidation(null);
      
      await emailConfigService.updateEmailConfig(emailConfig);
      
      // Clear the mailgun config cache to force reload
      mailgunConfig.clearCache();
      emailService.clearConfigCache();
      
      // Validate the new configuration
      const validation = await emailService.validateConfiguration();
      setConfigValidation(validation);
      
      setSaveSuccess(true);
      setIsEditing(false);
      
      // Clear success message after 3 seconds
      setTimeout(() => {
        setSaveSuccess(false);
      }, 3000);
    } catch (err) {
      console.error('Error saving email config:', err);
      setConfigError('Error al guardar la configuración');
    } finally {
      setSaveLoading(false);
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setSaveSuccess(false);
    setConfigValidation(null);
    setShowApiKey(false);
    // Reload original config
    loadEmailConfig();
  };

  const handleSendTestEmail = async () => {
    try {
      setTestEmailLoading(true);
      setTestEmailResult({ type: null, message: '' });
      
      await emailService.sendTestEmail(testEmailAddress);
      
      setTestEmailResult({
        type: 'success',
        message: `Email de prueba enviado exitosamente a ${testEmailAddress}. Revisa tu bandeja de entrada y carpeta de spam.`
      });
    } catch (error: any) {
      console.error('Error sending test email:', error);
      setTestEmailResult({
        type: 'error',
        message: `Error al enviar el email de prueba: ${error.message || 'Error desconocido'}`
      });
    } finally {
      setTestEmailLoading(false);
    }
  };

  const handleTestEmailAddressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTestEmailAddress(e.target.value);
    // Clear previous results when changing email
    if (testEmailResult.type) {
      setTestEmailResult({ type: null, message: '' });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center space-x-3 mb-6">
          <div className="bg-blue-100 p-2 rounded-lg">
            <Mail className="w-5 h-5 text-blue-600" />
          </div>
          <h3 className="text-xl font-semibold text-gray-900 font-poppins">
            Configuración de Email
          </h3>
        </div>

        {/* Security Notice */}
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-xl">
          <div className="flex items-start space-x-2">
            <Shield className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-800">
              <p className="font-medium mb-1">Configuración Segura:</p>
              <ul className="space-y-1 text-blue-700">
                <li>• Las claves API se almacenan de forma segura en la base de datos</li>
                <li>• Se recomienda usar variables de entorno para mayor seguridad</li>
                <li>• La configuración se valida automáticamente al guardar</li>
                <li>• Los emails se envían usando autenticación HTTP Basic Auth</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Mailgun Status */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-lg font-medium text-gray-900">Configuración de Mailgun</h4>
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
              {/* API Key */}
              <div>
                <label htmlFor="mailgun_api_key" className="block text-sm font-medium text-gray-700 mb-2">
                  API Key de Mailgun *
                </label>
                <div className="relative">
                  <Key className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type={isEditing && showApiKey ? "text" : "password"}
                    id="mailgun_api_key"
                    name="mailgun_api_key"
                    value={emailConfig.mailgun_api_key}
                    onChange={handleConfigChange}
                    readOnly={!isEditing}
                    className={`w-full pl-10 pr-12 py-3 border rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-all ${
                      isEditing ? 'border-gray-300 bg-white' : 'border-gray-200 bg-gray-50'
                    }`}
                    placeholder="key-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                  />
                  {isEditing && (
                    <button
                      type="button"
                      onClick={() => setShowApiKey(!showApiKey)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  )}
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  Tu API key privada de Mailgun. Se almacena de forma segura en la base de datos.
                </p>
              </div>

              {/* Domain */}
              <div>
                <label htmlFor="mailgun_domain" className="block text-sm font-medium text-gray-700 mb-2">
                  Dominio de Mailgun *
                </label>
                <div className="relative">
                  <Globe className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="text"
                    id="mailgun_domain"
                    name="mailgun_domain"
                    value={emailConfig.mailgun_domain}
                    onChange={handleConfigChange}
                    readOnly={!isEditing}
                    className={`w-full pl-10 pr-4 py-3 border rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-all ${
                      isEditing ? 'border-gray-300 bg-white' : 'border-gray-200 bg-gray-50'
                    }`}
                    placeholder="mg.tudominio.com"
                  />
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  El dominio configurado en tu cuenta de Mailgun
                </p>
              </div>

              {/* Base URL */}
              <div>
                <label htmlFor="mailgun_base_url" className="block text-sm font-medium text-gray-700 mb-2">
                  URL Base de Mailgun
                </label>
                <div className="relative">
                  <Globe className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="text"
                    id="mailgun_base_url"
                    name="mailgun_base_url"
                    value={emailConfig.mailgun_base_url}
                    onChange={handleConfigChange}
                    readOnly={!isEditing}
                    className={`w-full pl-10 pr-4 py-3 border rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-all ${
                      isEditing ? 'border-gray-300 bg-white' : 'border-gray-200 bg-gray-50'
                    }`}
                    placeholder="https://api.mailgun.net/v3"
                  />
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  URL base de la API de Mailgun (generalmente no necesita cambios)
                </p>
              </div>
            </div>
          )}

          {/* Save Success Message */}
          {saveSuccess && (
            <div className="p-4 bg-success-50 border border-success-200 rounded-xl flex items-center space-x-2">
              <CheckCircle className="w-5 h-5 text-success-600" />
              <span className="text-sm text-success-800">Configuración guardada exitosamente</span>
            </div>
          )}

          {/* Configuration Validation Result */}
          {configValidation && (
            <div className={`p-4 rounded-xl flex items-center space-x-2 ${
              configValidation.valid 
                ? 'bg-success-50 border border-success-200' 
                : 'bg-red-50 border border-red-200'
            }`}>
              {configValidation.valid ? (
                <>
                  <CheckCircle className="w-5 h-5 text-success-600" />
                  <span className="text-sm text-success-800">Configuración validada correctamente</span>
                </>
              ) : (
                <>
                  <AlertCircle className="w-5 h-5 text-red-600" />
                  <span className="text-sm text-red-600">
                    Error de validación: {configValidation.error}
                  </span>
                </>
              )}
            </div>
          )}
        </div>

        {/* Test Email Section */}
        <div className="space-y-4">
          <h4 className="text-lg font-medium text-gray-900">Probar Envío de Email</h4>
          <p className="text-gray-600 text-sm">
            Envía un email de prueba para verificar que la configuración de Mailgun funciona correctamente.
          </p>

          {/* Test Email Address Input */}
          <div>
            <label htmlFor="test_email" className="block text-sm font-medium text-gray-700 mb-2">
              Email de destino para prueba
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="email"
                id="test_email"
                value={testEmailAddress}
                onChange={handleTestEmailAddressChange}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-all"
                placeholder="email@ejemplo.com"
                disabled={testEmailLoading}
              />
            </div>
          </div>

          {/* Test Button */}
          <button
            onClick={handleSendTestEmail}
            disabled={testEmailLoading || !testEmailAddress.trim()}
            className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-xl font-medium transition-all duration-200 transform hover:scale-105 flex items-center space-x-2 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
          >
            {testEmailLoading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Enviando...</span>
              </>
            ) : (
              <>
                <Send className="w-5 h-5" />
                <span>Enviar Email de Prueba</span>
              </>
            )}
          </button>

          {/* Test Result */}
          {testEmailResult.type && (
            <div className={`p-4 rounded-xl flex items-start space-x-3 ${
              testEmailResult.type === 'success' 
                ? 'bg-success-50 border border-success-200' 
                : 'bg-red-50 border border-red-200'
            }`}>
              {testEmailResult.type === 'success' ? (
                <CheckCircle className="w-5 h-5 text-success-600 flex-shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              )}
              <div className="flex-1">
                <p className={`text-sm font-medium ${
                  testEmailResult.type === 'success' ? 'text-success-800' : 'text-red-800'
                }`}>
                  {testEmailResult.type === 'success' ? 'Email enviado exitosamente' : 'Error al enviar email'}
                </p>
                <p className={`text-sm mt-1 ${
                  testEmailResult.type === 'success' ? 'text-success-700' : 'text-red-700'
                }`}>
                  {testEmailResult.message}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Security and Usage Instructions */}
        <div className="mt-6 p-4 bg-gray-50 border border-gray-200 rounded-xl">
          <div className="flex items-start space-x-2">
            <Shield className="w-4 h-4 text-gray-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-gray-800">
              <p className="font-medium mb-1">Seguridad y Mejores Prácticas:</p>
              <ul className="space-y-1 text-gray-700">
                <li>• <strong>Variables de entorno:</strong> Para mayor seguridad, configura VITE_MAILGUN_API_KEY en tu archivo .env</li>
                <li>• <strong>Restricciones de dominio:</strong> Configura restricciones en tu panel de Mailgun</li>
                <li>• <strong>Monitoreo:</strong> Revisa los logs de Mailgun regularmente</li>
                <li>• <strong>Rotación de claves:</strong> Cambia tu API key periódicamente</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmailSettings;