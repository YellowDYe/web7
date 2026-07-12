import React from 'react';
import { useAuth } from '../../hooks/useAuth';

interface PermissionGateProps {
  children: React.ReactNode;
  permission: string | string[];
  requireAll?: boolean;
  fallback?: React.ReactNode;
}

const PermissionGate: React.FC<PermissionGateProps> = ({
  children,
  permission,
  requireAll = false,
  fallback = null
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
    return <>{fallback}</>;
  }

  return <>{children}</>;
};

export default PermissionGate;
