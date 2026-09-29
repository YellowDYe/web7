import { useState } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { useCustomerAuth } from '../../contexts/CustomerAuthContext';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { Mail, Lock, LogIn, UserPlus } from 'lucide-react';
import { friendlyError } from '../../utils/friendlyError';

export const CustomerLogin: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { login } = useCustomerAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnTo = searchParams.get('returnTo') || '/account';

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(email, password);
      navigate(returnTo);
    } catch (err: any) {
      setError(friendlyError(err, 'Correo electrónico o contraseña inválidos'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-16 max-w-md">
      <Card className="p-8 shadow-lg">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Bienvenido de Nuevo</h1>
          <p className="text-gray-600">Inicia sesión en tu cuenta</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleEmailLogin} className="space-y-6">
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

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Contraseña
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                placeholder="••••••••"
              />
            </div>
          </div>

          <div className="flex items-center justify-between text-sm">
            <Link
              to="/forgot-password"
              className="text-red-600 hover:text-red-700 font-medium"
            >
              ¿Olvidaste tu contraseña?
            </Link>
          </div>

          <Button
            type="submit"
            disabled={loading}
            className="w-full bg-red-600 hover:bg-red-700 text-white py-3 rounded-lg font-medium transition-colors"
          >
            {loading ? (
              <span className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                Iniciando sesión...
              </span>
            ) : (
              <span className="flex items-center justify-center">
                <LogIn className="h-5 w-5 mr-2" />
                Iniciar Sesión
              </span>
            )}
          </Button>
        </form>
      </Card>

      <Card className="mt-6 p-6 shadow-lg bg-gradient-to-br from-red-50 to-orange-50 border-2 border-red-200">
        <div className="text-center">
          <UserPlus className="h-12 w-12 text-red-600 mx-auto mb-3" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">¿No tienes cuenta?</h2>
          <p className="text-gray-600 mb-4">Únete a Hola Dieta y comienza tu viaje hacia una alimentación saludable</p>
          <Link to={`/signup${returnTo !== '/account' ? `?returnTo=${encodeURIComponent(returnTo)}` : ''}`}>
            <Button className="w-full bg-red-600 hover:bg-red-700 text-white py-3 rounded-lg font-medium transition-colors">
              Crear Cuenta Nueva
            </Button>
          </Link>
        </div>
      </Card>
    </div>
  );
};
