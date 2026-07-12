import React, { useState, useEffect } from 'react';
import { Save, CreditCard as Edit, Key, Eye, EyeOff, Loader as Loader2, CircleCheck as CheckCircle, CircleAlert as AlertCircle, TestTube, Globe, Mail, Phone, Search, User } from 'lucide-react';
import { manychatConfigService } from '../../services/manychatConfigService';
import { manychatService, ManychatSubscriber } from '../../services/manychatService';
import { ManychatConfigForm } from '../../types/manychatConfig';

const ManychatSettings: React.FC = () => {
  const [config, setConfig] = useState<ManychatConfigForm>({
    api_token: '',
    environment: 'production',
    default_phone_field: 'phone',
    default_email_field: 'email',
  });
  const [isEditing, setIsEditing] = useState(false);
  const [configLoading, setConfigLoading] = useState(true);
  const [saveLoading, setSaveLoading] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [configError, setConfigError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [testLoading, setTestLoading] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; fields?: { id: number; expected_name: string; found: boolean; actual_name: string | null; type: string | null }[] } | null>(null);

  const [findValue, setFindValue] = useState('');
  const [findLoading, setFindLoading] = useState(false);
  const [findResult, setFindResult] = useState<{ found: boolean; subscriber?: ManychatSubscriber; error?: string } | null>(null);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      setConfigLoading(true);
      setConfigError(null);
      const form = await manychatConfigService.getConfigForm();
      setConfig(form);
    } catch (err: any) {
      console.error('Error loading Manychat config:', err);
      setConfigError('Error al cargar la configuración de Manychat');
    } finally {
      setConfigLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setConfig(prev => ({ ...prev, [name]: value }));
    if (saveSuccess) setSaveSuccess(false);
  };

  const handleSave = async () => {
    try {
      setSaveLoading(true);
      setConfigError(null);

      if (!config.api_token.trim()) {
        setConfigError('El API Token es requerido');
        return;
      }

      await manychatConfigService.saveConfig(config);
      setSaveSuccess(true);
      setIsEditing(false);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      console.error('Error saving Manychat config:', err);
      setConfigError(err.message || 'Error al guardar la configuración');
    } finally {
      setSaveLoading(false);
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setSaveSuccess(false);
    setShowToken(false);
    setTestResult(null);
    loadConfig();
  };

  const handleTestConnection = async () => {
    try {
      setTestLoading(true);
      setTestResult(null);
      setConfigError(null);

      if (!config.api_token.trim()) {
        setTestResult({ success: false, message: 'Ingrese el API Token antes de probar la conexión' });
        return;
      }

      // Save first so the service uses the current token
      await manychatConfigService.saveConfig(config);
      manychatConfigService.clearCache();

      const result = await manychatService.testConnection();
      setTestResult(result);
    } catch (err: any) {
      setTestResult({ success: false, message: err.message || 'Error al probar la conexión' });
    } finally {
      setTestLoading(false);
    }
  };

  const handleFindByField = async () => {
    if (!findValue.trim()) return;
    try {
      setFindLoading(true);
      setFindResult(null);
      const subscriber = await manychatService.findSubscriberByCustomField(13626542, findValue.trim());
      if (subscriber) {
        setFindResult({ found: true, subscriber });
      } else {
        setFindResult({ found: false });
      }
    } catch (err: any) {
      setFindResult({ found: false, error: err.message || 'Error al buscar suscriptor' });
    } finally {
      setFindLoading(false);
    }
  };

  if (configLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
        <span className="ml-2 text-gray-600">Cargando configuración...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Status bar */}
      {configError && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
          <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
          <span className="text-sm text-red-700">{configError}</span>
        </div>
      )}
      {saveSuccess && (
        <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
          <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
          <span className="text-sm text-green-700">Configuración guardada exitosamente</span>
        </div>
      )}
      {testResult && (
        <div className={`p-3 rounded-lg border ${testResult.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
          <div className="flex items-center gap-2">
            {testResult.success ? (
              <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
            )}
            <span className={`text-sm font-medium ${testResult.success ? 'text-green-700' : 'text-red-700'}`}>
              {testResult.message}
            </span>
          </div>
          {testResult.fields && testResult.fields.length > 0 && (
            <div className="mt-2 ml-6 space-y-1">
              {testResult.fields.map((field) => (
                <div key={field.id} className="flex items-center gap-2 text-xs">
                  {field.found ? (
                    <CheckCircle className="w-3.5 h-3.5 text-green-500" />
                  ) : (
                    <AlertCircle className="w-3.5 h-3.5 text-red-500" />
                  )}
                  <span className={field.found ? 'text-green-700' : 'text-red-700'}>
                    {field.expected_name} (ID: {field.id})
                    {field.found ? ` — ${field.type}` : ' — No encontrado'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Form */}
      <div className="space-y-4">
        {/* API Token */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            <Key className="w-3.5 h-3.5 inline mr-1" />
            API Token
          </label>
          <div className="relative">
            <input
              type={showToken ? 'text' : 'password'}
              name="api_token"
              value={config.api_token}
              onChange={handleChange}
              disabled={!isEditing}
              placeholder="Tu Manychat API Token"
              className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50 disabled:text-gray-500"
            />
            <button
              type="button"
              onClick={() => setShowToken(!showToken)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <p className="mt-1 text-xs text-gray-500">
            Encuéntralo en Manychat &gt; Settings &gt; API &gt; Get API Key
          </p>
        </div>

        {/* Environment */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            <Globe className="w-3.5 h-3.5 inline mr-1" />
            Entorno
          </label>
          <select
            name="environment"
            value={config.environment}
            onChange={handleChange}
            disabled={!isEditing}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50 disabled:text-gray-500"
          >
            <option value="production">Producción</option>
            <option value="sandbox">Sandbox</option>
          </select>
        </div>

        {/* Default Phone Field */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            <Phone className="w-3.5 h-3.5 inline mr-1" />
            Campo de teléfono por defecto
          </label>
          <input
            type="text"
            name="default_phone_field"
            value={config.default_phone_field}
            onChange={handleChange}
            disabled={!isEditing}
            placeholder="phone"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50 disabled:text-gray-500"
          />
          <p className="mt-1 text-xs text-gray-500">
            Nombre del system field para buscar suscriptores por teléfono
          </p>
        </div>

        {/* Default Email Field */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            <Mail className="w-3.5 h-3.5 inline mr-1" />
            Campo de email por defecto
          </label>
          <input
            type="text"
            name="default_email_field"
            value={config.default_email_field}
            onChange={handleChange}
            disabled={!isEditing}
            placeholder="email"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50 disabled:text-gray-500"
          />
          <p className="mt-1 text-xs text-gray-500">
            Nombre del system field para buscar suscriptores por email
          </p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3 pt-4 border-t border-gray-200">
        {!isEditing ? (
          <>
            <button
              onClick={() => setIsEditing(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Edit className="w-4 h-4" />
              Editar
            </button>
            <button
              onClick={handleTestConnection}
              disabled={testLoading || !config.api_token}
              className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {testLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <TestTube className="w-4 h-4" />}
              Probar Conexión
            </button>
          </>
        ) : (
          <>
            <button
              onClick={handleSave}
              disabled={saveLoading}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {saveLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Guardar
            </button>
            <button
              onClick={handleCancel}
              className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleTestConnection}
              disabled={testLoading || !config.api_token}
              className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {testLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <TestTube className="w-4 h-4" />}
              Probar Conexión
            </button>
          </>
        )}
      </div>

      {/* Find by Custom Field Test */}
      {config.api_token && (
        <div className="pt-4 border-t border-gray-200 space-y-3">
          <h4 className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
            <Search className="w-3.5 h-3.5" />
            Buscar suscriptor por campo Waphone
          </h4>
          <div className="flex gap-2">
            <input
              type="text"
              value={findValue}
              onChange={(e) => setFindValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleFindByField()}
              placeholder="Ej: 5215545722320"
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <button
              onClick={handleFindByField}
              disabled={findLoading || !findValue.trim()}
              className="inline-flex items-center gap-2 px-4 py-2 bg-teal-600 text-white text-sm font-medium rounded-lg hover:bg-teal-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {findLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              Buscar
            </button>
          </div>
          <p className="text-xs text-gray-500">
            Busca en el campo personalizado "Waphone" (ID: 13626542) para verificar que la integración funciona correctamente.
          </p>

          {findResult && (
            <div className={`p-3 rounded-lg border ${findResult.found ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'}`}>
              {findResult.error ? (
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                  <span className="text-sm text-red-700">{findResult.error}</span>
                </div>
              ) : findResult.found && findResult.subscriber ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                    <span className="text-sm font-medium text-green-700">Suscriptor encontrado</span>
                  </div>
                  <div className="ml-6 space-y-1 text-xs">
                    <div className="flex items-center gap-2 text-gray-700">
                      <User className="w-3.5 h-3.5 text-gray-400" />
                      <span className="font-medium">{findResult.subscriber.name}</span>
                      <span className="text-gray-400">ID: {findResult.subscriber.id}</span>
                    </div>
                    {findResult.subscriber.custom_fields && (
                      <div className="mt-1.5 grid grid-cols-2 gap-x-4 gap-y-0.5">
                        {findResult.subscriber.custom_fields
                          .filter(f => ['Delivery', 'Horario Entrega', 'Waphone'].includes(f.name))
                          .map(f => (
                            <div key={f.id} className="text-gray-600">
                              <span className="text-gray-400">{f.name}:</span> {f.value ?? '—'}
                            </div>
                          ))
                        }
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0" />
                  <span className="text-sm text-amber-700">
                    No se encontró suscriptor con valor "{findValue}" en Waphone
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ManychatSettings;
