import React, { useState, useEffect } from 'react';
import { Save, CreditCard as Edit, Key, Shield, Eye, EyeOff, Loader as Loader2, CircleCheck as CheckCircle, CircleAlert as AlertCircle, Settings, RefreshCw } from 'lucide-react';
import { banxicoConfigService, BanxicoConfigForm } from '../../services/banxicoConfigService';

const BanxicoSettings: React.FC = () => {
  const [config, setConfig] = useState<BanxicoConfigForm>({
    api_token: '',
    is_active: false,
  });
  const [isEditing, setIsEditing] = useState(false);
  const [configLoading, setConfigLoading] = useState(true);
  const [saveLoading, setSaveLoading] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [configError, setConfigError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [testResult, setTestResult] = useState<{ rate: number; source: string; date: string } | null>(null);
  const [testLoading, setTestLoading] = useState(false);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      setConfigLoading(true);
      setConfigError(null);
      const data = await banxicoConfigService.getConfigForm();
      setConfig(data);
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

      if (config.is_active && !config.api_token) {
        setConfigError('Ingresa el token de API de Banxico para activar la integracion');
        return;
      }

      await banxicoConfigService.updateConfig(config);
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
    setSaveSuccess(false);
    setConfigError(null);
    loadConfig();
  };

  const handleTestConnection = async () => {
    setTestLoading(true);
    setTestResult(null);
    try {
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/exchange-rate`;
      const response = await fetch(apiUrl, {
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
      });
      if (response.ok) {
        const data = await response.json();
        setTestResult(data);
      } else {
        setConfigError('Error al obtener tipo de cambio. Verifica tu token.');
      }
    } catch (err) {
      setConfigError('No se pudo conectar con el servicio de tipo de cambio');
    } finally {
      setTestLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center space-x-3 mb-6">
          <div className="bg-teal-100 p-2 rounded-lg">
            <Settings className="w-5 h-5 text-teal-600" />
          </div>
          <h3 className="text-xl font-semibold text-gray-900 font-poppins">
            Configuracion de Banxico API
          </h3>
        </div>

        <div className="mb-6 p-4 bg-teal-50 border border-teal-200 rounded-xl">
          <div className="flex items-start space-x-2">
            <Shield className="w-4 h-4 text-teal-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-teal-800">
              <p className="font-medium mb-1">Tipo de Cambio Automatico</p>
              <p className="text-teal-700">
                Conecta con el API del Sistema de Informacion Economica (SIE) de Banxico para obtener el tipo de cambio FIX USD/MXN oficial de forma automatica al revisar facturas en dolares.
              </p>
              <p className="text-teal-600 mt-1.5 text-xs">
                Si no se configura, se usara Frankfurter (datos del BCE) como fuente alternativa.
              </p>
            </div>
          </div>
        </div>

        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-lg font-medium text-gray-900">Token de API</h4>
            {!isEditing ? (
              <button
                onClick={() => setIsEditing(true)}
                className="bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center space-x-2"
              >
                <Edit className="w-4 h-4" />
                <span>Editar</span>
              </button>
            ) : (
              <div className="flex space-x-2">
                <button
                  onClick={handleCancel}
                  disabled={saveLoading}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSave}
                  disabled={saveLoading}
                  className="bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center space-x-2 disabled:opacity-50"
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
                <Loader2 className="w-4 h-4 animate-spin text-teal-500" />
                <span className="text-sm text-gray-600">Cargando configuracion...</span>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label htmlFor="api_token" className="block text-sm font-medium text-gray-700 mb-2">
                  Bmx-Token *
                </label>
                <div className="relative">
                  <Key className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type={isEditing && showToken ? 'text' : 'password'}
                    id="api_token"
                    value={config.api_token}
                    onChange={e => setConfig({ ...config, api_token: e.target.value })}
                    readOnly={!isEditing}
                    className={`w-full pl-10 pr-12 py-3 border rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition-all ${
                      isEditing ? 'border-gray-300 bg-white' : 'border-gray-200 bg-gray-50'
                    }`}
                    placeholder="Token de 64 caracteres..."
                  />
                  {isEditing && (
                    <button
                      type="button"
                      onClick={() => setShowToken(!showToken)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  )}
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  Token de consulta del SIE API de Banxico (64 caracteres)
                </p>
              </div>

              <div className="flex items-center gap-3">
                <label className="text-sm font-medium text-gray-700">Integracion activa</label>
                <button
                  type="button"
                  onClick={() => isEditing && setConfig({ ...config, is_active: !config.is_active })}
                  disabled={!isEditing}
                  className="relative"
                >
                  <div className={`w-10 h-5 rounded-full transition-colors ${config.is_active ? 'bg-teal-500' : 'bg-gray-300'} ${!isEditing ? 'opacity-60' : ''}`}>
                    <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${config.is_active ? 'translate-x-5' : 'translate-x-0.5'}`} />
                  </div>
                </button>
                <span className={`text-xs ${config.is_active ? 'text-teal-700 font-medium' : 'text-gray-500'}`}>
                  {config.is_active ? 'Activa' : 'Inactiva'}
                </span>
              </div>
            </div>
          )}

          {configError && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-center space-x-2 mt-4">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
              <span className="text-sm text-red-800">{configError}</span>
            </div>
          )}

          {saveSuccess && (
            <div className="p-4 bg-green-50 border border-green-200 rounded-xl flex items-center space-x-2 mt-4">
              <CheckCircle className="w-5 h-5 text-green-600" />
              <span className="text-sm text-green-800">Configuracion guardada exitosamente</span>
            </div>
          )}
        </div>

        {/* Test Connection */}
        <div className="space-y-4 pt-6 border-t border-gray-200">
          <div className="flex items-center justify-between">
            <h4 className="text-lg font-medium text-gray-900">Probar Conexion</h4>
            <button
              onClick={handleTestConnection}
              disabled={testLoading}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-teal-700 bg-teal-50 border border-teal-200 rounded-lg hover:bg-teal-100 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${testLoading ? 'animate-spin' : ''}`} />
              {testLoading ? 'Consultando...' : 'Obtener tipo de cambio'}
            </button>
          </div>

          {testResult && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="w-4 h-4 text-green-600" />
                <span className="text-sm font-medium text-green-800">Conexion exitosa</span>
              </div>
              <dl className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <dt className="text-green-600 text-xs">Tipo de cambio</dt>
                  <dd className="text-green-900 font-bold text-lg">${testResult.rate.toFixed(4)}</dd>
                </div>
                <div>
                  <dt className="text-green-600 text-xs">Fuente</dt>
                  <dd className="text-green-900 font-medium capitalize">{testResult.source}</dd>
                </div>
                <div>
                  <dt className="text-green-600 text-xs">Fecha</dt>
                  <dd className="text-green-900 font-medium">{testResult.date}</dd>
                </div>
              </dl>
            </div>
          )}
        </div>

        {/* Instructions */}
        <div className="mt-6 p-4 bg-gray-50 border border-gray-200 rounded-xl">
          <div className="flex items-start space-x-2">
            <Shield className="w-4 h-4 text-gray-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-gray-800">
              <p className="font-medium mb-2">Como obtener el token:</p>
              <ol className="space-y-1 text-gray-700 list-decimal list-inside">
                <li>Accede al <a href="https://www.banxico.org.mx/SieAPIRest/service/v1/token" target="_blank" rel="noopener noreferrer" className="text-teal-600 hover:underline">portal de tokens del SIE API</a></li>
                <li>Acepta los terminos de uso</li>
                <li>Se generara un token de 64 caracteres</li>
                <li>Copia y pega el token aqui</li>
              </ol>
              <p className="mt-2 text-xs text-gray-500">
                Serie utilizada: SF43718 (Tipo de cambio FIX USD/MXN publicado por Banxico)
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BanxicoSettings;
