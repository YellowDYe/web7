import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, ArrowLeft, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { supabase } from '../config/supabase';

const ForgotPassword: React.FC = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email.trim()) {
      setError('Por favor ingresa tu correo electrónico');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`
      });

      if (resetError) {
        throw resetError;
      }

      setSuccess(true);
    } catch (err: any) {
      console.error('Password reset error:', err);

      let errorMessage = 'Error al enviar el correo de recuperación. Por favor intenta de nuevo.';

      if (err.message) {
        const msg = err.message.toLowerCase();
        if (msg.includes('not found') || msg.includes('no existe')) {
          errorMessage = 'No se encontró una cuenta con este correo electrónico.';
        } else if (msg.includes('rate limit')) {
          errorMessage = 'Demasiados intentos. Por favor espera unos minutos e intenta de nuevo.';
        } else {
          errorMessage = err.message;
        }
      }

      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-500 via-red-600 to-red-700 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
          <div className="bg-yellow-400 w-16 h-16 rounded-xl mx-auto flex items-center justify-center mb-4">
            <span className="text-gray-900 font-bold text-2xl">HD</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 text-center mb-6">Hola Dieta</h1>

          <div className="bg-green-50 border border-green-200 rounded-xl p-6 mb-6">
            <CheckCircle className="w-12 h-12 text-green-600 mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-green-900 mb-2 text-center">
              ¡Correo Enviado!
            </h2>
            <p className="text-green-700 text-sm text-center">
              Hemos enviado un enlace de recuperación de contraseña a <strong>{email}</strong>.
            </p>
            <p className="text-green-700 text-sm text-center mt-2">
              Por favor revisa tu bandeja de entrada y sigue las instrucciones.
            </p>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
            <p className="text-blue-800 text-xs text-center">
              Si no recibes el correo en unos minutos, revisa tu carpeta de spam o correo no deseado.
            </p>
          </div>

          <Link
            to="/"
            className="block w-full bg-red-500 hover:bg-red-600 text-white px-6 py-3 rounded-xl font-medium transition-colors text-center"
          >
            Volver al inicio de sesión
          </Link>
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
        <p className="text-gray-600 text-center mb-8">Recuperar Contraseña</p>

        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
          <p className="text-blue-800 text-sm">
            Ingresa tu correo electrónico y te enviaremos un enlace para restablecer tu contraseña.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
              Correo electrónico
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setError(null);
                }}
                required
                disabled={loading}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none transition-all disabled:bg-gray-100"
                placeholder="tu@email.com"
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
                <span>Enviando...</span>
              </>
            ) : (
              <span>Enviar enlace de recuperación</span>
            )}
          </button>
        </form>

        <div className="mt-6">
          <Link
            to="/"
            className="flex items-center justify-center text-gray-600 hover:text-gray-900 text-sm transition-colors"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Volver al inicio de sesión
          </Link>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;
