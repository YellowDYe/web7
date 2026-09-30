import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Eye, EyeOff, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { supabase } from '../../../config/supabase';

export const CustomerResetPassword: React.FC = () => {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [hasValidSession, setHasValidSession] = useState(false);

  useEffect(() => {
    const handleRecovery = async () => {
      try {
        // New branded flow: the email link carries ?token_hash=...&type=recovery,
        // which we exchange for a session with verifyOtp. Kept alongside the
        // legacy hash-fragment and PKCE flows for older links still in inboxes.
        const urlParams = new URLSearchParams(window.location.search);
        const tokenHash = urlParams.get('token_hash');
        const queryType = urlParams.get('type');
        const code = urlParams.get('code');

        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const accessToken = hashParams.get('access_token');
        const type = hashParams.get('type');

        if (tokenHash && queryType === 'recovery') {
          const { data, error: verifyError } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: 'recovery',
          });
          if (!verifyError && data.session) {
            setHasValidSession(true);
            setLoading(false);
            return;
          }
          setError('El enlace de recuperación no es válido o ha expirado.');
          setLoading(false);
          return;
        }

        if (type === 'recovery' && accessToken) {
          const { data } = await supabase.auth.getSession();
          if (data.session) {
            setHasValidSession(true);
            setLoading(false);
            return;
          }
        }

        if (code) {
          const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (!exchangeError && data.session) {
            setHasValidSession(true);
            setLoading(false);
            return;
          }
        }

        // Fallback: check if onAuthStateChange already established a session
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
          if ((event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') && session) {
            setHasValidSession(true);
            setLoading(false);
            subscription.unsubscribe();
          }
        });

        // The recovery session is stored asynchronously right after load, so
        // give it a few short tries before deciding the link is invalid.
        let established = false;
        for (let attempt = 0; attempt < 6; attempt++) {
          await new Promise(r => setTimeout(r, 500));
          const { data: sessionData } = await supabase.auth.getSession();
          if (sessionData.session) {
            established = true;
            break;
          }
        }

        if (established) {
          setHasValidSession(true);
        } else {
          setError('El enlace de recuperación no es válido o ha expirado.');
        }
        setLoading(false);
        subscription.unsubscribe();
      } catch {
        setError('Error al procesar el enlace de recuperación.');
        setLoading(false);
      }
    };

    handleRecovery();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden.');
      return;
    }

    setSubmitting(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) {
        const msg = updateError.message.toLowerCase();
        if (msg.includes('same')) {
          throw new Error('La nueva contraseña debe ser diferente a la anterior.');
        }
        if (msg.includes('weak') || msg.includes('short')) {
          throw new Error('La contraseña es demasiado débil. Usa al menos 8 caracteres.');
        }
        throw updateError;
      }
      setSuccess(true);
      setTimeout(() => navigate('/login', { replace: true }), 2500);
    } catch (err: any) {
      setError(err.message || 'Error al actualizar la contraseña.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-16 max-w-md text-center">
        <Loader2 className="h-12 w-12 text-red-600 animate-spin mx-auto mb-4" />
        <p className="text-gray-600">Verificando enlace de recuperación...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-16 max-w-md">
      <Card className="p-8 shadow-lg">
        {success ? (
          <div className="text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Contraseña Actualizada
            </h1>
            <p className="text-gray-600 mb-4">
              Tu contraseña ha sido actualizada exitosamente. Redirigiendo al inicio de sesión...
            </p>
            <Loader2 className="h-5 w-5 text-red-600 animate-spin mx-auto" />
          </div>
        ) : !hasValidSession ? (
          <div className="text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="h-8 w-8 text-red-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Enlace Inválido o Expirado
            </h1>
            <p className="text-gray-600 mb-6">
              {error || 'No se encontró un enlace de recuperación válido.'}
            </p>
            <div className="space-y-3">
              <Button
                onClick={() => navigate('/forgot-password', { replace: true })}
                className="w-full bg-red-600 hover:bg-red-700 text-white py-3"
              >
                Solicitar Nuevo Enlace
              </Button>
              <Button
                variant="outline"
                onClick={() => navigate('/login', { replace: true })}
                className="w-full py-3"
              >
                Volver al Inicio de Sesión
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Lock className="h-8 w-8 text-blue-600" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                Restablecer Contraseña
              </h1>
              <p className="text-gray-600">
                Ingresa tu nueva contraseña. Debe tener al menos 8 caracteres.
              </p>
            </div>

            {error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-start gap-2">
                <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nueva Contraseña
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setError(''); }}
                    required
                    disabled={submitting}
                    className="w-full pl-10 pr-12 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent disabled:bg-gray-100"
                    placeholder="Mínimo 8 caracteres"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Confirmar Contraseña
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => { setConfirmPassword(e.target.value); setError(''); }}
                    required
                    disabled={submitting}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent disabled:bg-gray-100"
                    placeholder="Repetir contraseña"
                  />
                </div>
              </div>

              <Button
                type="submit"
                disabled={submitting}
                className="w-full bg-red-600 hover:bg-red-700 text-white py-3 font-medium"
              >
                {submitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Actualizando...
                  </span>
                ) : (
                  'Actualizar Contraseña'
                )}
              </Button>
            </form>
          </>
        )}
      </Card>
    </div>
  );
};
