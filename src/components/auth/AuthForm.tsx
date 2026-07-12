import React, { useState } from 'react';
import { Eye, EyeOff, Mail, Lock, Chrome } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

interface AuthFormProps {
  isLogin: boolean;
  onToggle: () => void;
}

const AuthForm: React.FC<AuthFormProps> = ({ isLogin, onToggle }) => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState('');

  const { login, loginWithGoogle } = useAuth();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    setError('');

    // Validate inputs
    if (!formData.email.trim() || !formData.password.trim()) {
      setError('Por favor, completa todos los campos');
      setFormLoading(false);
      return;
    }

    if (!isLogin && !formData.name.trim()) {
      setError('Por favor, ingresa tu nombre completo');
      setFormLoading(false);
      return;
    }

    try {
      await login(formData.email, formData.password);
    } catch (error: any) {
      console.error('Authentication error:', error);

      let errorMessage = 'Ocurrió un error. Inténtalo de nuevo.';

      if (error.message) {
        const msg = error.message.toLowerCase();

        if (msg.includes('invalid login credentials') || msg.includes('invalid credentials')) {
          errorMessage = 'Correo electrónico o contraseña incorrectos';
        } else if (msg.includes('email not confirmed')) {
          errorMessage = 'Por favor, confirma tu correo electrónico';
        } else if (msg.includes('user not found')) {
          errorMessage = 'No se encontró una cuenta con este correo electrónico';
        } else if (msg.includes('user already registered') || msg.includes('already registered') || msg.includes('already been registered')) {
          errorMessage = 'Ya existe una cuenta con este correo electrónico. Por favor, inicia sesión en su lugar.';
        } else if (msg.includes('password') && msg.includes('short')) {
          errorMessage = 'La contraseña debe tener al menos 6 caracteres';
        } else if (msg.includes('invalid email')) {
          errorMessage = 'El correo electrónico no es válido';
        } else if (msg.includes('network') || msg.includes('fetch')) {
          errorMessage = 'Error de conexión. Verifica tu conexión a internet';
        } else if (msg.includes('rate limit')) {
          errorMessage = 'Demasiados intentos fallidos. Inténtalo más tarde';
        } else {
          errorMessage = error.message;
        }
      }

      setError(errorMessage);
    } finally {
      setFormLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    setError('');

    try {
      await loginWithGoogle();
    } catch (error: any) {
      console.error('Google login error:', error);

      let errorMessage = 'Error al iniciar sesión con Google. Inténtalo de nuevo.';

      if (error.message) {
        const msg = error.message.toLowerCase();

        if (msg.includes('popup') && msg.includes('block')) {
          errorMessage = 'Las ventanas emergentes están bloqueadas. Por favor, habilita las ventanas emergentes para este sitio en la configuración de tu navegador e inténtalo de nuevo.';
        } else if (msg.includes('cancel')) {
          errorMessage = 'Inicio de sesión cancelado';
        } else if (msg.includes('network') || msg.includes('fetch')) {
          errorMessage = 'Error de conexión. Verifica tu conexión a internet';
        } else {
          errorMessage = error.message;
        }
      }

      setError(errorMessage);
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-500 via-primary-600 to-primary-700 flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="bg-secondary-400 w-16 h-16 rounded-xl mx-auto flex items-center justify-center mb-4">
            <span className="text-gray-900 font-bold text-2xl">HD</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 font-poppins">Hola Dieta</h1>
          <p className="text-gray-600 mt-2">
            {isLogin ? 'Inicia sesión en tu cuenta' : 'Crea tu cuenta'}
          </p>
        </div>

        {/* Form */}
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
                name="email"
                value={formData.email}
                onChange={handleChange}
                required
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-all"
                placeholder="tu@email.com"
              />
            </div>
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
              Contraseña
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type={showPassword ? 'text' : 'password'}
                id="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                required
                className="w-full pl-10 pr-12 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-all"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
            <div className="flex items-center justify-between mt-2">
              <Link
                to="/forgot-password"
                className="text-sm text-primary-600 hover:text-primary-700 font-medium"
              >
                ¿Olvidaste tu contraseña?
              </Link>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
              {error}
            </div>
          )}

          {/* Google Sign In Button - Show on both login and registration */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-gray-500">o continúa con</span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={googleLoading || formLoading}
            className="w-full bg-white hover:bg-gray-50 text-gray-700 font-medium py-3 px-4 rounded-xl border border-gray-300 transition-all duration-200 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center space-x-2"
          >
            <Chrome className="w-5 h-5 text-blue-500" />
            <span>{googleLoading ? 'Conectando...' : (isLogin ? 'Continuar con Google' : 'Registrarse con Google')}</span>
          </button>

          <button
            type="submit"
            disabled={formLoading || googleLoading}
            className="w-full bg-primary-500 hover:bg-primary-600 text-white font-medium py-3 px-4 rounded-xl transition-all duration-200 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
          >
            {formLoading ? 'Cargando...' : 'Iniciar sesión'}
          </button>
        </form>

        {/* Information Note */}
        <div className="mt-6 text-center">
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <p className="text-sm text-blue-800">
              <strong>¿No tienes cuenta?</strong> Las cuentas son creadas únicamente mediante invitación.
              Contacta al administrador del sistema para solicitar acceso.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthForm;