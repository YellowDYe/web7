import { Navigate } from 'react-router-dom';
import { useCustomerAuth } from '../contexts/CustomerAuthContext';
import { ReactNode } from 'react';

export function ProtectedCustomerRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useCustomerAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/shop/login" replace />;
  }

  return <>{children}</>;
}
