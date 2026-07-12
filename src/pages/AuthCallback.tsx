import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2, CheckCircle } from 'lucide-react';
import { supabase } from '../config/supabase';

const AuthCallback: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [message, setMessage] = useState<string>('Procesando autenticación...');

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const type = hashParams.get('type') || searchParams.get('type');
        const accessToken = hashParams.get('access_token');
        const errorParam = hashParams.get('error');
        const errorDescription = hashParams.get('error_description');

        if (errorParam) {
          console.error('Auth callback error:', errorParam, errorDescription);
          setError(errorDescription || errorParam);
          setTimeout(() => {
            navigate('/', { replace: true });
          }, 3000);
          return;
        }

        if (type === 'recovery' && accessToken) {
          console.log('Password recovery detected, redirecting to reset password page');
          navigate('/reset-password', { replace: true });
          return;
        }

        // Customer signup is handled synchronously in CustomerAuthContext
        // No email verification callback needed since confirm_email is disabled

        if (type === 'signup' || type === 'invite') {
          console.log('Signup/invite detected, redirecting to home');
          navigate('/', { replace: true });
          return;
        }

        console.log('Unknown auth callback type, redirecting to home');
        navigate('/', { replace: true });
      } catch (err: any) {
        console.error('Error processing auth callback:', err);
        setError(err.message || 'Error al procesar la autenticación');
        setTimeout(() => {
          navigate('/', { replace: true });
        }, 3000);
      }
    };

    handleAuthCallback();
  }, [navigate, searchParams]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-500 via-red-600 to-red-700 flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md text-center">
        <div className="bg-yellow-400 w-16 h-16 rounded-xl mx-auto flex items-center justify-center mb-4">
          <span className="text-gray-900 font-bold text-2xl">HD</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Hola Dieta</h1>

        {error ? (
          <div className="bg-red-50 border border-red-200 rounded-xl p-6">
            <p className="text-red-800 font-medium mb-2">Error de Autenticación</p>
            <p className="text-red-600 text-sm">{error}</p>
            <p className="text-gray-600 text-sm mt-4">Redirigiendo al inicio de sesión...</p>
          </div>
        ) : success ? (
          <div className="bg-green-50 border border-green-200 rounded-xl p-6">
            <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
            <p className="text-green-800 font-medium mb-2">{message}</p>
            <p className="text-gray-600 text-sm mt-4">Redirigiendo...</p>
          </div>
        ) : (
          <div className="space-y-4">
            <Loader2 className="w-12 h-12 text-red-500 animate-spin mx-auto" />
            <p className="text-gray-600">{message}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default AuthCallback;
