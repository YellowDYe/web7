import React, { useState, useEffect } from 'react';
import { Eye, EyeOff, Globe, Key, Loader as Loader2, CircleCheck as CheckCircle, CircleAlert as AlertCircle, Pencil, X } from 'lucide-react';
import { deliveryTrackingConfigService } from '../../services/deliveryTrackingConfigService';
import type { DeliveryTrackingConfigForm } from '../../types/deliveryTrackingConfig';

const DeliveryTrackingSettings: React.FC = () => {
  const [config, setConfig] = useState<DeliveryTrackingConfigForm>({
    app_url: 'https://delivery-tracking-ro-ej1k.bolt.host',
    api_key: '',
  });
  const [isEditing, setIsEditing] = useState(false);
  const [configLoading, setConfigLoading] = useState(true);
  const [saveLoading, setSaveLoading] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [configError, setConfigError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [testLoading, setTestLoading] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      setConfigLoading(true);
      setConfigError(null);
      const form = await deliveryTrackingConfigService.getConfigForm();
      setConfig(form);
    } catch (err: any) {
      console.error('Error loading delivery tracking config:', err);
      setConfigError('Error al cargar la configuración');
    } finally {
      setConfigLoading(false);
    }
  };

  const handleSaveConfig = async () => {
    try {
      setSaveLoading(true);
      setConfigError(null);

      if (!config.app_url.trim()) {
        setConfigError('La URL de la aplicación es requerida');
        return;
      }

      if (!config.api_key.trim()) {
        setConfigError('El API Key es requerido');
        return;
      }

      try {
        new URL(config.app_url.trim());
      } catch {
        setConfigError('La URL ingresada no es válida');
        return;
      }

      await deliveryTrackingConfigService.saveConfig(config);
      setSaveSuccess(true);
      setIsEditing(false);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      setConfigError(err.message || 'Error al guardar la configuración');
    } finally {
      setSaveLoading(false);
    }
  };

  const handleTestConnection = async () => {
    try {
      setTestLoading(true);
      setTestResult(null);
      setConfigError(null);
      const result = await deliveryTrackingConfigService.testConnection();
      setTestResult(result);
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.message || 'Error al probar la conexión',
      });
    } finally {
      setTestLoading(false);
    }
  };

  if (configLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        <span className="ml-2 text-sm text-gray-500">Cargando configuración...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <p className="text-sm text-blue-800">
          <strong>Delivery Tracking</strong> permite rastrear y gestionar las entregas de pedidos en tiempo real desde una aplicación externa.
        </p>
      </div>

      {saveSuccess && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-2">
          <CheckCircle className="w-5 h-5 text-green-600" />
          <span className="text-sm text-green-800">Configuración guardada exitosamente</span>
        </div>
      )}

      {configError && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-2">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <span className="text-sm text-red-800">{configError}</span>
        </div>
      )}

      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-700">Configuración de API</h3>
        {!isEditing ? (
          <button
            onClick={() => setIsEditing(true)}
            className="inline-flex items-center gap-1.5 text-sm text-primary-600 hover:text-primary-700 font-medium"
          >
            <Pencil className="w-4 h-4" />
            Editar
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setIsEditing(false);
                setConfigError(null);
                loadConfig();
              }}
              disabled={saveLoading}
              className="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-700 font-medium disabled:opacity-50"
            >
              <X className="w-4 h-4" />
              Cancelar
            </button>
            <button
              onClick={handleSaveConfig}
              disabled={saveLoading}
              className="inline-flex items-center gap-1.5 text-sm bg-primary-600 hover:bg-primary-700 text-white font-medium px-3 py-1.5 rounded-lg disabled:opacity-50"
            >
              {saveLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Guardando...
                </>
              ) : (
                'Guardar'
              )}
            </button>
          </div>
        )}
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            URL de la Aplicación
          </label>
          <div className="relative">
            <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="url"
              value={config.app_url}
              onChange={(e) => setConfig({ ...config, app_url: e.target.value })}
              readOnly={!isEditing}
              className={`w-full pl-10 pr-4 py-2.5 border rounded-xl text-sm transition-colors ${
                isEditing
                  ? 'bg-white border-gray-300 focus:ring-2 focus:ring-primary-500 focus:border-primary-500'
                  : 'bg-gray-50 border-gray-200'
              }`}
              placeholder="https://delivery-tracking-ro-ej1k.bolt.host"
            />
          </div>
          <p className="mt-1 text-xs text-gray-500">
            URL completa de la aplicación de Delivery Tracking
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            API Key
          </label>
          <div className="relative">
            <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type={showApiKey ? 'text' : 'password'}
              value={config.api_key}
              onChange={(e) => setConfig({ ...config, api_key: e.target.value })}
              readOnly={!isEditing}
              className={`w-full pl-10 pr-12 py-2.5 border rounded-xl text-sm transition-colors ${
                isEditing
                  ? 'bg-white border-gray-300 focus:ring-2 focus:ring-primary-500 focus:border-primary-500'
                  : 'bg-gray-50 border-gray-200'
              }`}
              placeholder="Tu API Key de Delivery Tracking"
            />
            <button
              type="button"
              onClick={() => setShowApiKey(!showApiKey)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <p className="mt-1 text-xs text-gray-500">
            Token de autenticación para conectar con la API de Delivery Tracking
          </p>
        </div>
      </div>

      {!isEditing && config.api_key && (
        <div className="pt-2">
          <button
            onClick={handleTestConnection}
            disabled={testLoading}
            className="inline-flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-gray-900 border border-gray-300 hover:border-gray-400 rounded-xl px-4 py-2.5 transition-colors disabled:opacity-50"
          >
            {testLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Probando...
              </>
            ) : (
              <>
                <Globe className="w-4 h-4" />
                Probar Conexión
              </>
            )}
          </button>

          {testResult && (
            <div className={`mt-3 rounded-xl p-4 border ${
              testResult.success
                ? 'bg-green-50 border-green-200'
                : 'bg-red-50 border-red-200'
            }`}>
              <div className="flex items-center gap-2">
                {testResult.success ? (
                  <CheckCircle className="w-5 h-5 text-green-600" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-red-600" />
                )}
                <span className={`text-sm font-medium ${
                  testResult.success ? 'text-green-800' : 'text-red-800'
                }`}>
                  {testResult.message}
                </span>
              </div>
              {!testResult.success && (
                <ul className="mt-2 text-xs text-red-700 space-y-1 ml-7">
                  <li>Verifica que la URL sea correcta</li>
                  <li>Verifica que la aplicación esté en línea</li>
                  <li>Verifica que el API Key sea válido</li>
                </ul>
              )}
            </div>
          )}
        </div>
      )}

      <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
        <h4 className="text-sm font-medium text-gray-700 mb-2">Instrucciones</h4>
        <ol className="text-xs text-gray-600 space-y-1.5 list-decimal list-inside">
          <li>Ingresa la URL de tu aplicación de Delivery Tracking</li>
          <li>Obtén el API Key desde la configuración de la app</li>
          <li>Pega el API Key en el campo correspondiente</li>
          <li>Guarda y prueba la conexión</li>
        </ol>
      </div>
    </div>
  );
};

export default DeliveryTrackingSettings;
