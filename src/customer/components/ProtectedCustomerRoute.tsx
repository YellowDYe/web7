import { Navigate, useLocation } from 'react-router-dom';
import { useCustomerAuth } from '../contexts/CustomerAuthContext';
import { ReactNode, useEffect, useState } from 'react';

export function ProtectedCustomerRoute({ children }: { children: ReactNode }) {
  const { user, customer, loading, refreshCustomer } = useCustomerAuth();
  const location = useLocation();
  const [recheck, setRecheck] = useState<'idle' | 'checking' | 'done'>('idle');

  // A profile created moments ago (right after signup) can take a beat to
  // become visible. Before deciding this person has no account, re-check a few
  // times so a brand-new customer is never bounced back to the signup screen.
  useEffect(() => {
    if (loading || !user || customer) return;
    if (recheck !== 'idle') return;

    let cancelled = false;
    setRecheck('checking');
    (async () => {
      for (let i = 0; i < 5; i++) {
        const found = await refreshCustomer();
        if (cancelled) return;
        if (found) break;
        await new Promise((r) => setTimeout(r, 400));
      }
      if (!cancelled) setRecheck('done');
    })();

    return () => {
      cancelled = true;
    };
  }, [loading, user, customer, recheck, refreshCustomer]);

  if (loading || (user && !customer && recheck !== 'done')) {
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
    const returnTo = location.pathname + location.search;
    return <Navigate to={`/login?returnTo=${encodeURIComponent(returnTo)}`} replace />;
  }

  if (!customer) {
    const returnTo = location.pathname + location.search;
    return <Navigate to={`/signup?incomplete=true&returnTo=${encodeURIComponent(returnTo)}`} replace />;
  }

  return <>{children}</>;
}
