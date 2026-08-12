import React, { useState, useEffect } from 'react';
import { Save, CreditCard as Edit, Key, Eye, EyeOff, Loader as Loader2, CircleCheck as CheckCircle, CircleAlert as AlertCircle, RefreshCw } from 'lucide-react';
import { mercadoPagoConfigService, MercadoPagoConfigForm } from '../../services/mercadoPagoConfigService';

const MercadoPagoSettings: React.FC = () => {
  const [config, setConfig] = useState<MercadoPagoConfigForm>({
    access_token: '',
    public_key: '',
    is_active: false,
  });
  const [isEditing, setIsEditing] = useState(false);
  const [configLoading, setConfigLoading] = useState(true);
  const [saveLoading, setSaveLoading] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [configError, setConfigError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [testResult, setTestResult] = useState<{ user_id: string; first_name: string; last_name: string } | null>(null);
  const [testLoading, setTestLoading] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      setConfigLoading(true);
      setConfigError(null);
      const fullConfig = await mercadoPagoConfigService.getConfig();
      if (fullConfig) {
        setConfig({ access_token: fullConfig.access_token, public_key: fullConfig.public_key || '', is_active: fullConfig.is_active });
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
    setSaveSuccess(false);
    setConfigError(null);
    loadConfig();
  };

  const handleTestConnection = async () => {
    setTestLoading(true);
    setTestResult(null);
    setConfigError(null);
    try {
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/mercado-pago-sync`;
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
      {/* Instructions */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="text-sm font-semibold text-blue-900 mb-2">Como obtener tu Access Token</h4>
        <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
          <li>Ingresa a <span className="font-medium">Mercado Pago Developers</span> (mercadopago.com.mx/developers)</li>
          <li>Ve a <span className="font-medium">Tus integraciones</span> y selecciona tu aplicacion</li>
          <li>En la seccion <span className="font-medium">Credenciales de prueba</span>, copia el Access Token y la Public Key</li>
          <li>Pega ambas credenciales aqui y activa la integracion</li>
        </ol>
      </div>

      {/* Status */}
      {config.is_active && lastSync && (
        <div className="flex items-center gap-2 text-sm text-gray-600 bg-gray-50 px-3 py-2 rounded-lg">
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Ultima sincronizacion: {new Date(lastSync).toLocaleString('es-MX')}</span>
        </div>
      )}

      {/* Form */}
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
          <div className="relative">
            <input
              type={showToken ? 'text' : 'password'}
              value={config.public_key}
              onChange={(e) => setConfig({ ...config, public_key: e.target.value })}
              disabled={!isEditing}
              placeholder="APP_USR-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg text-sm disabled:bg-gray-50 disabled:text-gray-500 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none transition-all"
            />
          </div>
          <p className="mt-1 text-xs text-gray-500">La Public Key se usa para el formulario de pago embebido en el checkout.</p>
        </div>

        <div className="flex items-center gap-3">
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={config.is_active}
              onChange={(e) => setConfig({ ...config, is_active: e.target.checked })}
              disabled={!isEditing}
              className="sr-only peer"
            />
            <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-cyan-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-cyan-600 peer-disabled:opacity-50"></div>
          </label>
          <span className="text-sm text-gray-700">Integracion activa</span>
        </div>
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
              <Edit className="w-4 h-4 mr-2" />
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
