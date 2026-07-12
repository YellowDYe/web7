import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './hooks/useAuth';
import { CustomerAuthProvider } from './customer/contexts/CustomerAuthContext';
import { CartProvider } from './customer/contexts/CartContext';
import ProtectedRoute from './components/ProtectedRoute';
import ProtectedRouteWithPermission from './components/ProtectedRouteWithPermission';
import { ProtectedCustomerRoute } from './customer/components/ProtectedCustomerRoute';
import Layout from './components/layout/Layout';
import { CustomerHomePage } from './customer/pages/CustomerHomePage';
import CustomerLoginPage from './customer/pages/CustomerLoginPage';
import CustomerSignupPage from './customer/pages/CustomerSignupPage';
import CustomerAccountPage from './customer/pages/CustomerAccountPage';
import CustomerCheckoutPage from './customer/pages/CustomerCheckoutPage';
import CustomerForgotPasswordPage from './customer/pages/CustomerForgotPasswordPage';
import CustomerOrderPage from './customer/pages/CustomerOrderPage';
import CustomerCartPage from './customer/pages/CustomerCartPage';
import CustomerBlogPostPage from './customer/pages/CustomerBlogPostPage';
import Admin from './pages/Admin';
import ForcePasswordChange from './pages/ForcePasswordChange';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import AuthCallback from './pages/AuthCallback';
import PrivacyPolicy from './pages/PrivacyPolicy';
import TermsAndConditions from './pages/TermsAndConditions';
import Website from './pages/Website';
import GmailOAuthCallback from './pages/GmailOAuthCallback';

function App() {
  return (
    <Router>
      <Routes>
        {/* Public routes - NO auth provider */}
        <Route path="/politica-de-privacidad" element={<PrivacyPolicy />} />
        <Route path="/terminos-y-condiciones" element={<TermsAndConditions />} />

        {/* Admin auth routes - ONLY admin auth provider */}
        <Route path="/auth" element={
          <AuthProvider>
            <AuthCallback />
          </AuthProvider>
        } />
        <Route path="/force-password-change" element={
          <AuthProvider>
            <ForcePasswordChange />
          </AuthProvider>
        } />
        <Route path="/forgot-password" element={
          <AuthProvider>
            <ForgotPassword />
          </AuthProvider>
        } />
        <Route path="/reset-password" element={
          <AuthProvider>
            <ResetPassword />
          </AuthProvider>
        } />

        {/* Gmail OAuth callback - runs in popup window */}
        <Route path="/auth/gmail/callback" element={<GmailOAuthCallback />} />

        {/* Customer shop routes - ONLY customer auth provider */}
        <Route
          path="/shop/*"
          element={
            <CustomerAuthProvider>
              <CartProvider>
                <Routes>
                  <Route path="/" element={<CustomerHomePage />} />
                  <Route path="/login" element={<CustomerLoginPage />} />
                  <Route path="/signup" element={<CustomerSignupPage />} />
                  <Route path="/forgot-password" element={<CustomerForgotPasswordPage />} />
                  <Route
                    path="/account"
                    element={
                      <ProtectedCustomerRoute>
                        <CustomerAccountPage />
                      </ProtectedCustomerRoute>
                    }
                  />
                  <Route
                    path="/order"
                    element={
                      <ProtectedCustomerRoute>
                        <CustomerOrderPage />
                      </ProtectedCustomerRoute>
                    }
                  />
                  <Route
                    path="/cart"
                    element={<CustomerCartPage />}
                  />
                  <Route path="/blog/:slug" element={<CustomerBlogPostPage />} />
                  <Route
                    path="/checkout"
                    element={
                      <ProtectedCustomerRoute>
                        <CustomerCheckoutPage />
                      </ProtectedCustomerRoute>
                    }
                  />
                  <Route path="*" element={<CustomerHomePage />} />
                </Routes>
              </CartProvider>
            </CustomerAuthProvider>
          }
        />

        {/* Admin routes - with admin auth provider */}
        <Route
          path="/"
          element={
            <AuthProvider>
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            </AuthProvider>
          }
        >
          <Route index element={<Navigate to="/website" replace />} />
          <Route path="website" element={
            <ProtectedRouteWithPermission permission="website_view">
              <Website />
            </ProtectedRouteWithPermission>
          } />
          <Route path="admin" element={
            <ProtectedRouteWithPermission permission="admin_users">
              <Admin />
            </ProtectedRouteWithPermission>
          } />
        </Route>

        {/* Catch-all route for 404s */}
        <Route
          path="*"
          element={
            <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
              <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md text-center">
                <h2 className="text-xl font-semibold text-gray-900 mb-2">
                  Página no encontrada
                </h2>
                <p className="text-gray-600 mb-6">
                  La página que buscas no existe o ha sido movida.
                </p>
                <button
                  onClick={() => (window.location.href = '/')}
                  className="bg-primary-500 hover:bg-primary-600 text-white px-6 py-3 rounded-xl font-medium transition-colors"
                >
                  Ir al inicio
                </button>
              </div>
            </div>
          }
        />
      </Routes>
    </Router>
  );
}

export default App;
