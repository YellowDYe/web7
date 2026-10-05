import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { CircleAlert as AlertCircle } from 'lucide-react';
import { useCustomerAuth } from '../contexts/CustomerAuthContext';
import { Card } from '../components/ui/card';

const safeReturnTo = (value: string | null) =>
  value && value.startsWith('/') && !value.startsWith('//') ? value : '/account';

const readOAuthError = () => {
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const query = new URLSearchParams(window.location.search);
  return hash.get('error_description') || query.get('error_description') || hash.get('error') || query.get('error');
};

export default function CustomerGoogleCallbackPage() {
  const { user, customer, loading, linkGoogleToExistingCustomer } = useCustomerAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnTo = safeReturnTo(searchParams.get('returnTo'));
  const [error, setError] = useState<string | null>(() => (readOAuthError() ? 'No se completó el inicio de sesión con Google.' : null));
  const handledRef = useRef(false);

  useEffect(() => {
    if (error || loading || handledRef.current) return;

    if (!user) {
      setError('No pudimos confirmar tu sesión de Google. El enlace pudo haber expirado.');
      return;
    }

    handledRef.current = true;
    (async () => {
      if (customer || (await linkGoogleToExistingCustomer())) {
        navigate(returnTo, { replace: true });
        return;
      }
      navigate(`/signup?google=true&returnTo=${encodeURIComponent(returnTo)}`, { replace: true });
    })();
  }, [error, loading, user, customer, returnTo, navigate, linkGoogleToExistingCustomer]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <Card className="w-full max-w-md p-8 shadow-lg text-center">
        {error ? (
          <>
            <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="h-7 w-7 text-red-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Algo salió mal</h1>
            <p className="text-gray-600 mb-6">{error}</p>
            <div className="flex flex-col gap-3">
              <Link
                to={`/login${returnTo !== '/account' ? `?returnTo=${encodeURIComponent(returnTo)}` : ''}`}
                className="w-full bg-red-600 hover:bg-red-700 text-white py-3 rounded-lg font-medium transition-colors"
              >
                Intentar de nuevo
              </Link>
              <Link to="/" className="text-sm text-gray-600 hover:text-gray-900">
                Volver al inicio
              </Link>
            </div>
          </>
        ) : (
          <>
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-red-100 border-t-red-600 mx-auto mb-6" />
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Conectando con Google...</h1>
            <p className="text-gray-600">Estamos preparando tu cuenta, un momento por favor.</p>
          </>
        )}
      </Card>
    </div>
  );
}
