import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import LoadingSpinner from './common/LoadingSpinner';
import Auth from '../pages/Auth';
import { Lock, AlertCircle } from 'lucide-react';

interface ProtectedRouteWithPermissionProps {
  children: React.ReactNode;
  permission?: string | string[];
  requireAll?: boolean;
}

const ProtectedRouteWithPermission: React.FC<ProtectedRouteWithPermissionProps> = ({
  children,
  permission,
  requireAll = false
}) => {
  const { user, loading, hasPermission, hasAnyPermission, hasAllPermissions } = useAuth();

  if (loading) {
    return <LoadingSpinner />;
  }

  if (!user) {
    return <Auth />;
  }

  if (permission) {
    const hasAccess = Array.isArray(permission)
      ? requireAll
        ? hasAllPermissions(permission)
        : hasAnyPermission(permission)
      : hasPermission(permission);

    if (!hasAccess) {
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
          <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md text-center">
            <div className="flex justify-center mb-4">
              <div className="bg-red-100 p-4 rounded-full">
                <Lock className="w-8 h-8 text-red-600" />
              </div>
            </div>
            <h2 className="text-2xl font-semibold text-gray-900 mb-2">
              Acceso Denegado
            </h2>
            <p className="text-gray-600 mb-6">
              No tienes los permisos necesarios para acceder a esta página.
            </p>
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mb-6">
              <div className="flex items-start space-x-3">
                <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" />
                <div className="text-left">
                  <p className="text-sm text-yellow-800 font-medium mb-1">
                    Contacta al administrador
                  </p>
                  <p className="text-sm text-yellow-700">
                    Si crees que deberías tener acceso a esta función, contacta al administrador del sistema.
                  </p>
                </div>
              </div>
            </div>
            <button
              onClick={() => window.history.back()}
              className="bg-primary-500 hover:bg-primary-600 text-white px-6 py-3 rounded-xl font-medium transition-colors w-full"
            >
              Volver
            </button>
          </div>
        </div>
      );
    }
  }

  return <>{children}</>;
};

export default ProtectedRouteWithPermission;
