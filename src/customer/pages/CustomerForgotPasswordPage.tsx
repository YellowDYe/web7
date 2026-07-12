import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, ArrowLeft, CheckCircle } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import CustomerSiteHeader from '../components/CustomerSiteHeader';
import { Footer } from '../sections/Footer/Footer';
import { supabase } from '../../config/supabase';

export default function CustomerForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) throw error;

      setSuccess(true);
    } catch (err: any) {
      setError(err.message || 'Error al enviar el correo de restablecimiento');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <CustomerSiteHeader />

      <div className="container mx-auto px-4 py-16 max-w-md">
        <Card className="p-8 shadow-lg">
          {!success ? (
            <>
              <div className="text-center mb-8">
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Mail className="h-8 w-8 text-red-600" />
                </div>
                <h1 className="text-3xl font-bold text-gray-900 mb-2">¿Olvidaste tu Contraseña?</h1>
                <p className="text-gray-600">
                  ¡No te preocupes! Ingresa tu correo y te enviaremos instrucciones para restablecerla.
                </p>
              </div>

              {error && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Correo Electrónico
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                      placeholder="tu@correo.com"
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-red-600 hover:bg-red-700 text-white py-3 rounded-lg font-medium transition-colors"
                >
                  {loading ? (
                    <span className="flex items-center justify-center">
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                      Enviando...
                    </span>
                  ) : (
                    'Enviar Instrucciones'
                  )}
                </Button>
              </form>

              <div className="mt-8 text-center">
                <Link
                  to="/login"
                  className="inline-flex items-center gap-2 text-red-600 hover:text-red-700 font-medium"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Volver al Inicio de Sesión
                </Link>
              </div>
            </>
          ) : (
            <>
              <div className="text-center">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="h-8 w-8 text-green-600" />
                </div>
                <h1 className="text-3xl font-bold text-gray-900 mb-2">Revisa tu Correo</h1>
                <p className="text-gray-600 mb-6">
                  Hemos enviado las instrucciones para restablecer tu contraseña a <strong>{email}</strong>
                </p>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 text-sm text-blue-800">
                  <p className="font-medium mb-2">¿No recibiste el correo?</p>
                  <ul className="list-disc list-inside space-y-1 text-left">
                    <li>Revisa tu carpeta de spam</li>
                    <li>Asegúrate de haber ingresado el correo correcto</li>
                    <li>Espera unos minutos e intenta de nuevo</li>
                  </ul>
                </div>
                <Link
                  to="/login"
                  className="inline-flex items-center gap-2 text-red-600 hover:text-red-700 font-medium"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Volver al Inicio de Sesión
                </Link>
              </div>
            </>
          )}
        </Card>
      </div>

      <Footer />
    </div>
  );
}
