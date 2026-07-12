import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Eye, EyeOff, Chrome, CircleAlert as AlertCircle, CircleCheck as CheckCircle, LogOut } from 'lucide-react';
import { supabase } from '../config/supabase';
import { userManagementService } from '../services/userManagementService';

const ForcePasswordChange: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.log('No authenticated user, redirecting to login');
        navigate('/', { replace: true });
      }
    };
    checkAuth();
  }, [navigate]);

  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
    setError(null);
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();

    if (formData.newPassword.length < 8) {
      setError('La nueva contraseña debe tener al menos 8 caracteres');
      return;
    }

    if (formData.newPassword !== formData.confirmPassword) {
      setError('Las contraseñas no coinciden');
      return;
    }

    const hasUpperCase = /[A-Z]/.test(formData.newPassword);
    const hasLowerCase = /[a-z]/.test(formData.newPassword);
    const hasNumber = /[0-9]/.test(formData.newPassword);

    if (!hasUpperCase || !hasLowerCase || !hasNumber) {
      setError('La contraseña debe contener al menos una mayúscula, una minúscula y un número');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('No hay usuario autenticado');
      }

      const { error: updateError } = await supabase.auth.updateUser({
        password: formData.newPassword
      });

      if (updateError) {
        throw updateError;
      }

      await userManagementService.markPasswordChanged(user.id);

      setSuccess(true);

      // Wait a moment for the database to update
      await new Promise(resolve => setTimeout(resolve, 500));

      // Refresh the session to get updated user state
      await supabase.auth.refreshSession();

      // Navigate to home page after showing success message
      setTimeout(() => {
        window.location.href = '/';
      }, 1500);

    } catch (err: any) {
      console.error('Error changing password:', err);
      setError(err.message || 'Error al cambiar la contraseña');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    try {
      setLoading(true);
      setError(null);

      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/`
        }
      });

      if (oauthError) {
        throw oauthError;
      }

    } catch (err: any) {
      console.error('Google auth error:', err);
      setError(err.message || 'Error al conectar con Google');
      setLoading(false);
    }
  };

  const handleBackToLogin = async () => {
    try {
      await supabase.auth.signOut();
      navigate('/', { replace: true });
    } catch {
      navigate('/', { replace: true });
    }
  };

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
              Contraseña Actualizada
            </h2>
            <p className="text-green-700">
              Tu contraseña ha sido cambiada exitosamente. Redirigiendo...
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-500 via-red-600 to-red-700 flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
        <div className="text-center mb-6">
          <div className="bg-yellow-400 w-16 h-16 rounded-xl mx-auto flex items-center justify-center mb-4">
            <span className="text-gray-900 font-bold text-2xl">HD</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Hola Dieta</h1>
          <p className="text-gray-600 mt-2">Cambiar Contraseña Temporal</p>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
          <p className="text-sm text-blue-800">
            <strong>Acción requerida:</strong> Por seguridad, debes cambiar tu contraseña temporal antes de continuar.
          </p>
        </div>

        <form onSubmit={handlePasswordChange} className="space-y-4">
          <div>
            <label htmlFor="currentPassword" className="block text-sm font-medium text-gray-700 mb-2">
              Contraseña Temporal
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type={showPassword ? 'text' : 'password'}
                id="currentPassword"
                name="currentPassword"
                value={formData.currentPassword}
                onChange={handleFormChange}
                required
                disabled={loading}
                className="w-full pl-10 pr-12 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none transition-all disabled:bg-gray-100"
                placeholder="Tu contraseña temporal"
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
          </div>

          <div>
            <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700 mb-2">
              Nueva Contraseña (mínimo 8 caracteres)
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type={showPassword ? 'text' : 'password'}
                id="newPassword"
                name="newPassword"
                value={formData.newPassword}
                onChange={handleFormChange}
                required
                disabled={loading}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none transition-all disabled:bg-gray-100"
                placeholder="Tu nueva contraseña"
              />
            </div>
          </div>

          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-2">
              Confirmar Nueva Contraseña
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type={showPassword ? 'text' : 'password'}
                id="confirmPassword"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleFormChange}
                required
                disabled={loading}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none transition-all disabled:bg-gray-100"
                placeholder="Confirma tu contraseña"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-red-500 hover:bg-red-600 text-white font-medium py-3 px-4 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
          >
            {loading ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Cambiando...</span>
              </>
            ) : (
              <span>Cambiar Contraseña</span>
            )}
          </button>
        </form>

        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-300" />
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-white text-gray-500">o</span>
          </div>
        </div>

        <button
          onClick={handleGoogleAuth}
          disabled={loading}
          className="w-full bg-white hover:bg-gray-50 text-gray-700 font-medium py-3 px-4 rounded-xl border-2 border-gray-300 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
        >
          <Chrome className="w-5 h-5 text-blue-500" />
          <span>Continuar con Google</span>
        </button>

        {error && (
          <div className="mt-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm flex items-start space-x-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <div className="mt-6 text-center">
          <button
            onClick={handleBackToLogin}
            disabled={loading}
            className="inline-flex items-center space-x-1 text-sm text-gray-600 hover:text-red-600 transition-colors disabled:opacity-50"
          >
            <LogOut className="w-4 h-4" />
            <span>Cerrar sesion y volver al inicio</span>
          </button>
          <p className="text-xs text-gray-500 mt-3">
            ¿Problemas? Contacta al administrador del sistema.
          </p>
        </div>
      </div>
    </div>
  );
};

export default ForcePasswordChange;
