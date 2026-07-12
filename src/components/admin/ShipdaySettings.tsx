import React, { useState, useEffect } from 'react';
import { Truck, Save, Edit, Key, MapPin, Phone, Building, Eye, EyeOff, Loader2, CheckCircle, AlertCircle, Settings, TestTube, Clock } from 'lucide-react';
import { shipdayService } from '../../services/shipdayService';
import { ShipdayConfigForm } from '../../types/shipdayConfig';

const ShipdaySettings: React.FC = () => {
  const [shipdayConfig, setShipdayConfig] = useState<ShipdayConfigForm>({
    api_key: '',
    restaurant_name: '',
    restaurant_address: '',
    restaurant_phone: '',
    default_pickup_time: '19:00:00',
    default_delivery_time: '20:30:00'
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
    loadShipdayConfig();
  }, []);

  const loadShipdayConfig = async () => {
    try {
      setConfigLoading(true);
      setConfigError(null);
      const config = await shipdayService.getConfigForm();
      setShipdayConfig(config);
    } catch (err) {
      console.error('Error loading Shipday config:', err);
      setConfigError('Error al cargar la configuración de Shipday');
    } finally {
      setConfigLoading(false);
    }
  };

  const handleConfigChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setShipdayConfig(prev => ({
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

      if (!shipdayConfig.api_key || !shipdayConfig.restaurant_name || !shipdayConfig.restaurant_address || !shipdayConfig.restaurant_phone || !shipdayConfig.default_pickup_time || !shipdayConfig.default_delivery_time) {
        setConfigError('Por favor complete todos los campos requeridos');
        return;
      }

      const timeRegex = /^([0-1][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$/;
      if (!timeRegex.test(shipdayConfig.default_pickup_time) || !timeRegex.test(shipdayConfig.default_delivery_time)) {
        setConfigError('Los horarios deben estar en formato HH:mm:ss (24 horas)');
        return;
      }

      await shipdayService.saveConfig(shipdayConfig);

      setSaveSuccess(true);
      setIsEditing(false);

      setTimeout(() => {
        setSaveSuccess(false);
      }, 3000);
    } catch (err: any) {
      console.error('Error saving Shipday config:', err);
      setConfigError(err.message || 'Error al guardar la configuración');
    } finally {
      setSaveLoading(false);
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setSaveSuccess(false);
    setShowApiKey(false);
    setTestResult(null);
    loadShipdayConfig();
  };

  const handleTestConnection = async () => {
    try {
      setTestLoading(true);
      setTestResult(null);
      setConfigError(null);

      console.log('Starting Shipday API connection test...');
      const result = await shipdayService.testConnection();

      console.log('Test result:', result);
      setTestResult(result);

      if (result.success) {
        console.log('Connection test successful!');
        console.log('Response data:', result.data);
      } else {
        console.error('Connection test failed:', result.message);
      }
    } catch (err: any) {
      console.error('Error testing connection:', err);
      setTestResult({
        success: false,
        message: err.message || 'Error al probar la conexión'
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

        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-xl">
          <div className="flex items-start space-x-2">
            <AlertCircle className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-800">
              <p className="font-medium mb-1">Acerca de Shipday:</p>
              <ul className="space-y-1 text-blue-700">
                <li>• Shipday es una plataforma de gestión de entregas</li>
                <li>• Permite crear y rastrear órdenes de entrega en tiempo real</li>
                <li>• Configure sus credenciales para enviar pedidos automáticamente desde la Lista de Entregas</li>
                <li>• Obtenga su API key desde el Dashboard de Shipday</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-lg font-medium text-gray-900">Configuración de Shipday</h4>
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
                <label htmlFor="api_key" className="block text-sm font-medium text-gray-700 mb-2">
                  API Key *
                </label>
                <div className="relative">
                  <Key className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type={isEditing && showApiKey ? "text" : "password"}
                    id="api_key"
                    name="api_key"
                    value={shipdayConfig.api_key}
                    onChange={handleConfigChange}
                    readOnly={!isEditing}
                    className={`w-full pl-10 pr-12 py-3 border rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-all ${
                      isEditing ? 'border-gray-300 bg-white' : 'border-gray-200 bg-gray-50'
                    }`}
                    placeholder="Su API Key de Shipday"
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
                  Su API Key de Shipday. Se almacena de forma segura.
                </p>
              </div>

              <div>
                <label htmlFor="restaurant_name" className="block text-sm font-medium text-gray-700 mb-2">
                  Nombre del Restaurante/Negocio *
                </label>
                <div className="relative">
                  <Building className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="text"
                    id="restaurant_name"
                    name="restaurant_name"
                    value={shipdayConfig.restaurant_name}
                    onChange={handleConfigChange}
                    readOnly={!isEditing}
                    className={`w-full pl-10 pr-4 py-3 border rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-all ${
                      isEditing ? 'border-gray-300 bg-white' : 'border-gray-200 bg-gray-50'
                    }`}
                    placeholder="Nombre de su negocio"
                  />
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  Este nombre aparecerá como el punto de origen en Shipday
                </p>
              </div>

              <div>
                <label htmlFor="restaurant_address" className="block text-sm font-medium text-gray-700 mb-2">
                  Dirección del Restaurante/Negocio *
                </label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-3 text-gray-400 w-5 h-5" />
                  <textarea
                    id="restaurant_address"
                    name="restaurant_address"
                    value={shipdayConfig.restaurant_address}
                    onChange={handleConfigChange}
                    readOnly={!isEditing}
                    rows={3}
                    className={`w-full pl-10 pr-4 py-3 border rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-all ${
                      isEditing ? 'border-gray-300 bg-white' : 'border-gray-200 bg-gray-50'
                    }`}
                    placeholder="Dirección completa de su negocio"
                  />
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  Esta será la dirección de recogida para las entregas en Shipday
                </p>
              </div>

              <div>
                <label htmlFor="restaurant_phone" className="block text-sm font-medium text-gray-700 mb-2">
                  Teléfono del Restaurante/Negocio *
                </label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="text"
                    id="restaurant_phone"
                    name="restaurant_phone"
                    value={shipdayConfig.restaurant_phone}
                    onChange={handleConfigChange}
                    readOnly={!isEditing}
                    className={`w-full pl-10 pr-4 py-3 border rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-all ${
                      isEditing ? 'border-gray-300 bg-white' : 'border-gray-200 bg-gray-50'
                    }`}
                    placeholder="+52 123 456 7890"
                  />
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  Número de contacto para el punto de recogida
                </p>
              </div>

              <div className="border-t border-gray-200 pt-4 mt-4">
                <h4 className="text-md font-medium text-gray-900 mb-4">Horarios de Entrega</h4>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="default_pickup_time" className="block text-sm font-medium text-gray-700 mb-2">
                      Hora de Recogida Predeterminada *
                    </label>
                    <div className="relative">
                      <Clock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                      <input
                        type="text"
                        id="default_pickup_time"
                        name="default_pickup_time"
                        value={shipdayConfig.default_pickup_time}
                        onChange={handleConfigChange}
                        readOnly={!isEditing}
                        className={`w-full pl-10 pr-4 py-3 border rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-all ${
                          isEditing ? 'border-gray-300 bg-white' : 'border-gray-200 bg-gray-50'
                        }`}
                        placeholder="19:00:00"
                      />
                    </div>
                    <p className="mt-1 text-xs text-gray-500">
                      Formato: HH:mm:ss (24 horas). Ejemplo: 19:00:00 para 7:00 PM
                    </p>
                  </div>

                  <div>
                    <label htmlFor="default_delivery_time" className="block text-sm font-medium text-gray-700 mb-2">
                      Hora de Entrega Predeterminada *
                    </label>
                    <div className="relative">
                      <Clock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                      <input
                        type="text"
                        id="default_delivery_time"
                        name="default_delivery_time"
                        value={shipdayConfig.default_delivery_time}
                        onChange={handleConfigChange}
                        readOnly={!isEditing}
                        className={`w-full pl-10 pr-4 py-3 border rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-all ${
                          isEditing ? 'border-gray-300 bg-white' : 'border-gray-200 bg-gray-50'
                        }`}
                        placeholder="20:30:00"
                      />
                    </div>
                    <p className="mt-1 text-xs text-gray-500">
                      Formato: HH:mm:ss (24 horas). Ejemplo: 20:30:00 para 8:30 PM
                    </p>
                  </div>
                </div>

                <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-xl">
                  <div className="flex items-start space-x-2">
                    <AlertCircle className="w-4 h-4 text-yellow-600 flex-shrink-0 mt-0.5" />
                    <div className="text-sm text-yellow-800">
                      <p className="font-medium mb-1">Formato de Hora Requerido:</p>
                      <ul className="space-y-1 text-yellow-700">
                        <li>• Los horarios deben estar en formato de 24 horas con segundos (HH:mm:ss)</li>
                        <li>• Ejemplo: 19:00:00 para las 7:00 PM, 20:30:00 para las 8:30 PM</li>
                        <li>• Este formato es requerido por la API de Shipday</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {saveSuccess && (
            <div className="p-4 bg-success-50 border border-success-200 rounded-xl flex items-center space-x-2 mt-4">
              <CheckCircle className="w-5 h-5 text-success-600" />
              <span className="text-sm text-success-800">Configuración guardada exitosamente</span>
            </div>
          )}

          {!isEditing && shipdayConfig.api_key && (
            <div className="mt-6 space-y-4">
              <div className="border-t border-gray-200 pt-6">
                <h4 className="text-lg font-medium text-gray-900 mb-4">Probar Conexión</h4>
                <p className="text-sm text-gray-600 mb-4">
                  Verifique que su API Key funcione correctamente probando la conexión con Shipday
                </p>
                <button
                  onClick={handleTestConnection}
                  disabled={testLoading}
                  className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-xl font-medium transition-colors flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {testLoading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>Probando conexión...</span>
                    </>
                  ) : (
                    <>
                      <TestTube className="w-5 h-5" />
                      <span>Probar Conexión a Shipday</span>
                    </>
                  )}
                </button>

                {testResult && (
                  <div className={`mt-4 p-4 rounded-xl border ${
                    testResult.success
                      ? 'bg-success-50 border-success-200'
                      : 'bg-red-50 border-red-200'
                  }`}>
                    <div className="flex items-start space-x-2">
                      {testResult.success ? (
                        <CheckCircle className="w-5 h-5 text-success-600 flex-shrink-0 mt-0.5" />
                      ) : (
                        <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                      )}
                      <div className="flex-1">
                        <p className={`text-sm font-medium ${
                          testResult.success ? 'text-success-800' : 'text-red-800'
                        }`}>
                          {testResult.message}
                        </p>
                        {testResult.success && (
                          <p className="text-xs text-success-700 mt-2">
                            ✓ Su API Key es válida y la conexión funciona correctamente
                          </p>
                        )}
                        {!testResult.success && (
                          <div className="text-xs text-red-700 mt-2">
                            <p className="font-medium">Posibles causas:</p>
                            <ul className="list-disc list-inside mt-1 space-y-1">
                              <li>API Key incorrecta o inválida</li>
                              <li>API Key contiene espacios adicionales</li>
                              <li>Problemas de conexión con Shipday</li>
                            </ul>
                            <p className="mt-2">
                              Revise la consola del navegador (F12) para más detalles
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="mt-6 p-4 bg-gray-50 border border-gray-200 rounded-xl">
          <div className="flex items-start space-x-2">
            <AlertCircle className="w-4 h-4 text-gray-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-gray-800">
              <p className="font-medium mb-1">Cómo obtener su API Key:</p>
              <ol className="space-y-1 text-gray-700 list-decimal list-inside">
                <li>Inicie sesión en su <a href="https://app.shipday.com/" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Dashboard de Shipday</a></li>
                <li>Navegue a "Settings" → "API"</li>
                <li>Copie su API Key</li>
                <li>Péguelo en el campo API Key arriba</li>
              </ol>
            </div>
          </div>
        </div>

        <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-xl">
          <div className="flex items-start space-x-2">
            <Truck className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-800">
              <p className="font-medium mb-1">Cómo usar Shipday en el sistema:</p>
              <ol className="space-y-1 text-blue-700 list-decimal list-inside">
                <li>Configure su API Key y detalles del negocio aquí</li>
                <li>Vaya a "Envíos" → "Lista de Entregas"</li>
                <li>Seleccione una fecha específica de entrega</li>
                <li>Haga clic en el botón "Enviar a Shipday"</li>
                <li>Los pedidos se crearán automáticamente en Shipday</li>
              </ol>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ShipdaySettings;
