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
import Marketing from './pages/Marketing';
import GmailOAuthCallback from './pages/GmailOAuthCallback';

function App() {
  return (
    <Router>
      <Routes>
        {/* Public routes - NO auth provider */}
        <Route path="/politica-de-privacidad" element={<PrivacyPolicy />} />
        <Route path="/terminos-y-condiciones" element={<TermsAndConditions />} />

        {/* Admin auth routes */}
        <Route path="/admin/auth" element={
          <AuthProvider>
            <AuthCallback />
          </AuthProvider>
        } />
        <Route path="/admin/force-password-change" element={
          <AuthProvider>
            <ForcePasswordChange />
          </AuthProvider>
        } />
        <Route path="/admin/forgot-password" element={
          <AuthProvider>
            <ForgotPassword />
          </AuthProvider>
        } />
        <Route path="/admin/reset-password" element={
          <AuthProvider>
            <ResetPassword />
          </AuthProvider>
        } />

        {/* Gmail OAuth callback - runs in popup window */}
        <Route path="/auth/gmail/callback" element={<GmailOAuthCallback />} />

        {/* Admin routes - at /admin */}
        <Route
          path="/admin"
          element={
            <AuthProvider>
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            </AuthProvider>
          }
        >
          <Route index element={<Navigate to="/admin/website" replace />} />
          <Route path="website" element={
            <ProtectedRouteWithPermission permission="website_view">
              <Website />
            </ProtectedRouteWithPermission>
          } />
          <Route path="users" element={
            <ProtectedRouteWithPermission permission="admin_users">
              <Admin />
            </ProtectedRouteWithPermission>
          } />
          <Route path="marketing" element={
            <ProtectedRouteWithPermission permission="coupons_view">
              <Marketing />
            </ProtectedRouteWithPermission>
          } />
        </Route>

        {/* Customer routes - at root */}
        <Route
          path="/*"
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
                  <Route path="/cart" element={<CustomerCartPage />} />
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
      </Routes>
    </Router>
  );
}

export default App;
