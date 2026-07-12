import React, { useState, useEffect } from 'react';
import { Save, ExternalLink, RefreshCw, Unlink, CircleCheck as CheckCircle, CircleAlert as AlertCircle, Info } from 'lucide-react';
import { gmailConfigService } from '../../services/gmailConfigService';
import { GmailConfig, GmailConfigForm } from '../../types/gmailConfig';

const GmailSettings: React.FC = () => {
  const [form, setForm] = useState<GmailConfigForm>({
    client_id: '',
    client_secret: '',
    sync_label: 'INBOX',
  });
  const [config, setConfig] = useState<GmailConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    loadConfig();
  }, []);

  // Listen for OAuth callback
  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      if (event.data?.type === 'gmail-oauth-callback' && event.data?.code) {
        setConnecting(true);
        setMessage(null);
        try {
          const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
          const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
          const redirectUri = `${window.location.origin}/auth/gmail/callback`;

          const response = await fetch(`${supabaseUrl}/functions/v1/gmail-oauth-callback`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${anonKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ code: event.data.code, redirect_uri: redirectUri }),
          });

          const result = await response.json();
          if (response.ok && result.success) {
            setMessage({ type: 'success', text: `Cuenta conectada: ${result.connected_email}` });
            gmailConfigService.clearCache();
            await loadConfig();
          } else {
            setMessage({ type: 'error', text: result.error || 'Error al conectar la cuenta' });
          }
        } catch (err) {
          setMessage({ type: 'error', text: 'Error de conexion con el servidor' });
        } finally {
          setConnecting(false);
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const loadConfig = async () => {
    try {
      setLoading(true);
      const configData = await gmailConfigService.getConfig();
      setConfig(configData);
      if (configData) {
        setForm({
          client_id: configData.client_id || '',
          client_secret: configData.client_secret || '',
          sync_label: configData.sync_label || 'INBOX',
        });
      }
    } catch {
      setMessage({ type: 'error', text: 'Error al cargar la configuracion' });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!form.client_id || !form.client_secret) {
      setMessage({ type: 'error', text: 'Client ID y Client Secret son requeridos' });
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      await gmailConfigService.updateConfig(form);
      setMessage({ type: 'success', text: 'Credenciales guardadas correctamente' });
      await loadConfig();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Error al guardar' });
    } finally {
      setSaving(false);
    }
  };

  const handleConnect = () => {
    if (!form.client_id) {
      setMessage({ type: 'error', text: 'Guarda las credenciales primero' });
      return;
    }
    const redirectUri = `${window.location.origin}/auth/gmail/callback`;
    const oauthUrl = gmailConfigService.getOAuthUrl(form.client_id, redirectUri);

    const popup = window.open(oauthUrl, 'gmail-oauth', 'width=600,height=700,scrollbars=yes');
    if (!popup) {
      setMessage({ type: 'error', text: 'El navegador bloqueo la ventana emergente. Permite popups para este sitio.' });
    }
  };

  const handleDisconnect = async () => {
    try {
      await gmailConfigService.disconnect();
      setMessage({ type: 'success', text: 'Cuenta desconectada' });
      gmailConfigService.clearCache();
      await loadConfig();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Error al desconectar' });
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    setMessage(null);
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

      const response = await fetch(`${supabaseUrl}/functions/v1/gmail-sync`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${anonKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });

      const result = await response.json();
      if (response.ok) {
        setMessage({ type: 'success', text: `Sincronizacion completada. ${result.processed} emails procesados.` });
        gmailConfigService.clearCache();
        await loadConfig();
      } else {
        setMessage({ type: 'error', text: result.error || 'Error en la sincronizacion' });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: 'Error de conexion con el servidor' });
    } finally {
      setSyncing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <RefreshCw className="w-5 h-5 animate-spin text-gray-400" />
      </div>
    );
  }

  const isConnected = config?.is_active && config?.connected_email;

  return (
    <div className="space-y-6">
      {/* Setup Instructions */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-800 space-y-2">
            <p className="font-semibold">Instrucciones de configuracion:</p>
            <ol className="list-decimal list-inside space-y-1 text-blue-700">
              <li>Ve a <a href="https://console.cloud.google.com/" target="_blank" rel="noopener noreferrer" className="underline font-medium">Google Cloud Console</a></li>
              <li>Crea un proyecto nuevo o selecciona uno existente</li>
              <li>Habilita la <strong>Gmail API</strong> en "APIs & Services" &gt; "Library"</li>
              <li>Ve a "APIs & Services" &gt; "Credentials" &gt; "Create Credentials" &gt; "OAuth Client ID"</li>
              <li>Selecciona "Web application" como tipo de aplicacion</li>
              <li>Agrega <code className="bg-blue-100 px-1 rounded">{window.location.origin}/auth/gmail/callback</code> como "Authorized redirect URI"</li>
              <li>Copia el Client ID y Client Secret generados abajo</li>
              <li>En "OAuth consent screen", agrega el scope: <code className="bg-blue-100 px-1 rounded">gmail.readonly</code></li>
            </ol>
          </div>
        </div>
      </div>

      {/* Connection Status */}
      {isConnected && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-green-600" />
            <div>
              <p className="text-sm font-medium text-green-900">Cuenta conectada</p>
              <p className="text-sm text-green-700">{config.connected_email}</p>
              {config.last_sync_at && (
                <p className="text-xs text-green-600 mt-0.5">
                  Ultima sincronizacion: {new Date(config.last_sync_at).toLocaleString('es-MX')}
                </p>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleSync}
              disabled={syncing}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-green-700 bg-green-100 rounded-lg hover:bg-green-200 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Sincronizando...' : 'Sincronizar'}
            </button>
            <button
              onClick={handleDisconnect}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-red-700 bg-red-100 rounded-lg hover:bg-red-200 transition-colors"
            >
              <Unlink className="w-3.5 h-3.5" />
              Desconectar
            </button>
          </div>
        </div>
      )}

      {/* Credentials Form */}
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Client ID
          </label>
          <input
            type="text"
            value={form.client_id}
            onChange={(e) => setForm({ ...form, client_id: e.target.value })}
            placeholder="xxxxxxxxxxxx.apps.googleusercontent.com"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Client Secret
          </label>
          <input
            type="password"
            value={form.client_secret}
            onChange={(e) => setForm({ ...form, client_secret: e.target.value })}
            placeholder="GOCSPX-xxxxxxxxxxxx"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Etiqueta Gmail a escanear
          </label>
          <input
            type="text"
            value={form.sync_label}
            onChange={(e) => setForm({ ...form, sync_label: e.target.value })}
            placeholder="INBOX"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500"
          />
          <p className="text-xs text-gray-500 mt-1">
            Usa INBOX para la bandeja de entrada, o crea una etiqueta personalizada como "Facturas" en Gmail.
          </p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-3 pt-2">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          {saving ? 'Guardando...' : 'Guardar Credenciales'}
        </button>

        {!isConnected && form.client_id && (
          <button
            onClick={handleConnect}
            disabled={connecting}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            <ExternalLink className="w-4 h-4" />
            {connecting ? 'Conectando...' : 'Conectar Cuenta Gmail'}
          </button>
        )}
      </div>

      {/* Message */}
      {message && (
        <div className={`flex items-center gap-2 p-3 rounded-lg text-sm ${
          message.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
        }`}>
          {message.type === 'success' ? (
            <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
          )}
          {message.text}
        </div>
      )}
    </div>
  );
};

export default GmailSettings;
