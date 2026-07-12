import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import LoadingSpinner from './common/LoadingSpinner';
import Auth from '../pages/Auth';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { user, loading, passwordChangeRequired, checkPasswordChangeRequired } = useAuth();
  const location = useLocation();

  React.useEffect(() => {
    if (user) {
      checkPasswordChangeRequired();
    }
  }, [user, checkPasswordChangeRequired]);

  if (loading) {
    return <LoadingSpinner />;
  }

  if (!user) {
    return <Auth />;
  }

  if (passwordChangeRequired && location.pathname !== '/admin/force-password-change') {
    console.log('Password change required, redirecting to force-password-change');
    return <Navigate to="/admin/force-password-change" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;