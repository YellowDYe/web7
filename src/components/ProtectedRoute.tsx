import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import LoadingSpinner from './common/LoadingSpinner';
import Auth from '../pages/Auth';
import { ShieldOff, LogOut, ExternalLink } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { user, loading, passwordChangeRequired, checkPasswordChangeRequired, noAdminAccess, noAdminAccessEmail, logout } = useAuth();
  const location = useLocation();

  React.useEffect(() => {
    if (user) {
      checkPasswordChangeRequired();
    }
  }, [user, checkPasswordChangeRequired]);

  if (loading) {
    return <LoadingSpinner />;
  }

  if (noAdminAccess) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md text-center">
          <div className="flex justify-center mb-4">
            <div className="bg-red-100 p-4 rounded-full">
              <ShieldOff className="w-8 h-8 text-red-600" />
            </div>
          </div>
          <h2 className="text-2xl font-semibold text-gray-900 mb-2">
            Sin acceso de administrador
          </h2>
          <p className="text-gray-600 mb-2">
            La cuenta <span className="font-medium text-gray-800">{noAdminAccessEmail}</span> no tiene permisos para acceder al panel de administración.
          </p>
          <p className="text-gray-500 text-sm mb-6">
            Si crees que deberías tener acceso, contacta al administrador del sistema para que te envíe una invitación.
          </p>
          <div className="space-y-3">
            <button
              onClick={async () => {
                await logout();
              }}
              className="w-full bg-primary-500 hover:bg-primary-600 text-white px-6 py-3 rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
            >
              <LogOut className="w-4 h-4" />
              Cerrar sesión
            </button>
            <a
              href="/"
              className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 px-6 py-3 rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
            >
              <ExternalLink className="w-4 h-4" />
              Ir al sitio principal
            </a>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Auth />;
  }

  if (passwordChangeRequired && location.pathname !== '/admin/force-password-change') {
    return <Navigate to="/admin/force-password-change" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
