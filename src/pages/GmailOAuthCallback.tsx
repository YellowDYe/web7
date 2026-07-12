import React, { useEffect, useState } from 'react';

const GmailOAuthCallback: React.FC = () => {
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const error = params.get('error');

    if (error) {
      setStatus('error');
      setErrorMessage(error === 'access_denied' ? 'Acceso denegado por el usuario' : error);
      return;
    }

    if (!code) {
      setStatus('error');
      setErrorMessage('No se recibio codigo de autorizacion');
      return;
    }

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    fetch(`${supabaseUrl}/functions/v1/gmail-oauth-callback`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${anonKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ code, redirect_uri: `${window.location.origin}/auth/gmail/callback` }),
    })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setStatus('success');
          if (window.opener) {
            window.opener.postMessage({ type: 'gmail-oauth-success' }, window.location.origin);
            setTimeout(() => window.close(), 1500);
          }
        } else {
          setStatus('error');
          setErrorMessage(data.error || 'Error al procesar la autorizacion');
        }
      })
      .catch(() => {
        setStatus('error');
        setErrorMessage('Error de conexion con el servidor');
      });
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-sm text-center">
        {status === 'processing' && (
          <>
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-red-600 mx-auto mb-4"></div>
            <p className="text-gray-700 font-medium">Conectando con Gmail...</p>
          </>
        )}
        {status === 'success' && (
          <>
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-gray-900 font-semibold">Conexion exitosa</p>
            <p className="text-gray-500 text-sm mt-1">Esta ventana se cerrara automaticamente</p>
          </>
        )}
        {status === 'error' && (
          <>
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <p className="text-gray-900 font-semibold">Error de conexion</p>
            <p className="text-red-600 text-sm mt-1">{errorMessage}</p>
            <button
              onClick={() => window.close()}
              className="mt-4 px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200"
            >
              Cerrar ventana
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default GmailOAuthCallback;
