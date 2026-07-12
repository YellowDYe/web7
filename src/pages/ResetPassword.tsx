import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Eye, EyeOff, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { supabase } from '../config/supabase';

const ResetPassword: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [hasValidSession, setHasValidSession] = useState(false);

  useEffect(() => {
    const handlePasswordRecovery = async () => {
      try {
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const accessToken = hashParams.get('access_token');
        const type = hashParams.get('type');

        if (type === 'recovery' && accessToken) {
          console.log('Password recovery token detected');
          const { data, error: sessionError } = await supabase.auth.getSession();

          if (sessionError) {
            console.error('Session error:', sessionError);
            setError('El enlace de recuperación no es válido o ha expirado. Por favor solicita uno nuevo.');
            setLoading(false);
            return;
          }

          if (data.session) {
            console.log('Valid recovery session established');
            setHasValidSession(true);
            setLoading(false);
          } else {
            setError('El enlace de recuperación no es válido o ha expirado. Por favor solicita uno nuevo.');
            setLoading(false);
          }
        } else {
          const { data } = await supabase.auth.getSession();
          if (data.session) {
            setHasValidSession(true);
          } else {
            setError('No se encontró un enlace de recuperación válido. Por favor verifica el enlace en tu correo.');
          }
          setLoading(false);
        }
      } catch (err) {
        console.error('Error handling recovery:', err);
        setError('Error al procesar el enlace de recuperación.');
        setLoading(false);
      }
    };

    handlePasswordRecovery();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres');
      return;
    }

    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const { error: updateError } = await supabase.auth.updateUser({
        password: password
      });

      if (updateError) {
        throw updateError;
      }

      setSuccess(true);

      // Redirect to login after 2 seconds
      setTimeout(() => {
        navigate('/', { replace: true });
      }, 2000);

    } catch (err: any) {
      console.error('Password update error:', err);

      let errorMessage = 'Error al actualizar la contraseña. Por favor intenta de nuevo.';

      if (err.message) {
        const msg = err.message.toLowerCase();
        if (msg.includes('same')) {
          errorMessage = 'La nueva contraseña debe ser diferente a la anterior.';
        } else if (msg.includes('weak') || msg.includes('short')) {
          errorMessage = 'La contraseña es demasiado débil. Usa al menos 8 caracteres.';
        } else {
          errorMessage = err.message;
        }
      }

      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-500 via-red-600 to-red-700 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md text-center">
          <div className="bg-yellow-400 w-16 h-16 rounded-xl mx-auto flex items-center justify-center mb-4">
            <span className="text-gray-900 font-bold text-2xl">HD</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-6">Hola Dieta</h1>
          <Loader2 className="w-12 h-12 text-red-500 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Verificando enlace de recuperación...</p>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-500 via-red-600 to-red-700 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md text-center">
          <div className="bg-yellow-400 w-16 h-16 rounded-xl mx-auto flex items-center justify-center mb-4">
            <span className="text-gray-900 font-bold text-2xl">HD</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-6">Hola Dieta</h1>

          <div className="bg-green-50 border border-green-200 rounded-xl p-6 mb-6">
            <CheckCircle className="w-16 h-16 text-green-600 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-green-900 mb-2">
              ¡Contraseña Actualizada!
            </h2>
            <p className="text-green-700">
              Tu contraseña ha sido actualizada exitosamente. Redirigiendo al inicio de sesión...
            </p>
          </div>

          <div className="flex items-center justify-center space-x-2 text-gray-600">
            <Loader2 className="w-4 h-4 animate-spin text-red-500" />
            <span className="text-sm">Redirigiendo...</span>
          </div>
        </div>
      </div>
    );
  }

  if (!hasValidSession) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-500 via-red-600 to-red-700 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md text-center">
          <div className="bg-yellow-400 w-16 h-16 rounded-xl mx-auto flex items-center justify-center mb-4">
            <span className="text-gray-900 font-bold text-2xl">HD</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-6">Hola Dieta</h1>

          <div className="bg-red-50 border border-red-200 rounded-xl p-6 mb-6">
            <AlertCircle className="w-12 h-12 text-red-600 mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-red-900 mb-2">
              Enlace Inválido o Expirado
            </h2>
            <p className="text-red-700 text-sm">
              {error || 'El enlace de recuperación no es válido o ha expirado.'}
            </p>
          </div>

          <button
            onClick={() => navigate('/forgot-password', { replace: true })}
            className="w-full bg-red-500 hover:bg-red-600 text-white font-medium py-3 px-4 rounded-xl transition-colors mb-3"
          >
            Solicitar Nuevo Enlace
          </button>

          <button
            onClick={() => navigate('/', { replace: true })}
            className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-3 px-4 rounded-xl transition-colors"
          >
            Volver al Inicio de Sesión
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-500 via-red-600 to-red-700 flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
        <div className="bg-yellow-400 w-16 h-16 rounded-xl mx-auto flex items-center justify-center mb-4">
          <span className="text-gray-900 font-bold text-2xl">HD</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 text-center mb-2">Hola Dieta</h1>
        <p className="text-gray-600 text-center mb-8">Restablecer Contraseña</p>

        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
          <p className="text-blue-800 text-sm">
            Ingresa tu nueva contraseña. Debe tener al menos 8 caracteres.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
              Nueva Contraseña *
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type={showPassword ? 'text' : 'password'}
                id="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError(null);
                }}
                required
                disabled={loading}
                className="w-full pl-10 pr-12 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none transition-all disabled:bg-gray-100"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                disabled={loading}
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
            <p className="mt-1 text-xs text-gray-500">Mínimo 8 caracteres</p>
          </div>

          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-2">
              Confirmar Contraseña *
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type={showPassword ? 'text' : 'password'}
                id="confirmPassword"
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  setError(null);
                }}
                required
                disabled={loading}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none transition-all disabled:bg-gray-100"
                placeholder="••••••••"
              />
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm flex items-start space-x-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-red-500 hover:bg-red-600 text-white font-medium py-3 px-4 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Actualizando...</span>
              </>
            ) : (
              <span>Actualizar Contraseña</span>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

export default ResetPassword;
