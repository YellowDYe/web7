import React from 'react';
import { useAuth } from '../../hooks/useAuth';
import { AlertCircle, Lock } from 'lucide-react';

interface RequirePermissionProps {
  children: React.ReactNode;
  permission: string | string[];
  requireAll?: boolean;
  fallback?: React.ReactNode;
  showMessage?: boolean;
}

const RequirePermission: React.FC<RequirePermissionProps> = ({
  children,
  permission,
  requireAll = false,
  fallback,
  showMessage = true
}) => {
  const { hasPermission, hasAnyPermission, hasAllPermissions } = useAuth();

  const hasAccess = () => {
    if (Array.isArray(permission)) {
      return requireAll
        ? hasAllPermissions(permission)
        : hasAnyPermission(permission);
    }
    return hasPermission(permission);
  };

  if (!hasAccess()) {
    if (fallback !== undefined) {
      return <>{fallback}</>;
    }

    if (!showMessage) {
      return null;
    }

    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6 text-center">
        <div className="flex justify-center mb-3">
          <div className="bg-yellow-100 p-3 rounded-full">
            <Lock className="w-6 h-6 text-yellow-600" />
          </div>
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          Acceso Restringido
        </h3>
        <p className="text-gray-600">
          No tienes los permisos necesarios para acceder a esta función.
        </p>
        <p className="text-sm text-gray-500 mt-2">
          Contacta al administrador si necesitas acceso.
        </p>
      </div>
    );
  }

  return <>{children}</>;
};

export default RequirePermission;
