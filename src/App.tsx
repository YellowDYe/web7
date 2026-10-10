import React, { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './hooks/useAuth';
import { CustomerAuthProvider } from './customer/contexts/CustomerAuthContext';
import { CartProvider } from './customer/contexts/CartContext';
import ProtectedRoute from './components/ProtectedRoute';
import ProtectedRouteWithPermission from './components/ProtectedRouteWithPermission';
import { ProtectedCustomerRoute } from './customer/components/ProtectedCustomerRoute';
import LoadingSpinner from './components/common/LoadingSpinner';
import { CustomerHomePage } from './customer/pages/CustomerHomePage';
import CustomerLoginPage from './customer/pages/CustomerLoginPage';
import CustomerGoogleCallbackPage from './customer/pages/CustomerGoogleCallbackPage';
import CustomerAccountPage from './customer/pages/CustomerAccountPage';
import CustomerCheckoutPage from './customer/pages/CustomerCheckoutPage';
import { CheckoutReturn } from './customer/pages/CheckoutReturnPage';
import CustomerForgotPasswordPage from './customer/pages/CustomerForgotPasswordPage';
import CustomerResetPasswordPage from './customer/pages/CustomerResetPasswordPage';
import CustomerOrderPage from './customer/pages/CustomerOrderPage';
import CustomerCartPage from './customer/pages/CustomerCartPage';
import CustomerBlogPostPage from './customer/pages/CustomerBlogPostPage';
import PrivacyPolicy from './pages/PrivacyPolicy';
import TermsAndConditions from './pages/TermsAndConditions';
import SitemapPage from './pages/SitemapPage';

// Admin screens are downloaded only when someone opens the admin area.
const Layout = lazy(() => import('./components/layout/Layout'));
const Admin = lazy(() => import('./pages/Admin'));
const ForcePasswordChange = lazy(() => import('./pages/ForcePasswordChange'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));
const AuthCallback = lazy(() => import('./pages/AuthCallback'));
const Website = lazy(() => import('./pages/Website'));
const Marketing = lazy(() => import('./pages/Marketing'));
const CouponsPage = lazy(() => import('./pages/CouponsPage'));
const GmailOAuthCallback = lazy(() => import('./pages/GmailOAuthCallback'));

function App() {
  return (
    <Router>
      <Suspense fallback={<LoadingSpinner />}>
      <Routes>
        {/* Public routes - NO auth provider */}
        <Route path="/politica-de-privacidad" element={<PrivacyPolicy />} />
        <Route path="/terminos-y-condiciones" element={<TermsAndConditions />} />
        <Route path="/sitemap" element={<SitemapPage />} />

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
          <Route path="marketing/coupons" element={
            <ProtectedRouteWithPermission permission="coupons_view">
              <CouponsPage />
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
                  <Route path="/auth/google" element={<CustomerGoogleCallbackPage />} />
                  <Route path="/forgot-password" element={<CustomerForgotPasswordPage />} />
                  <Route path="/reset-password" element={<CustomerResetPasswordPage />} />
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
                  <Route path="/checkout/return" element={<CheckoutReturn />} />
                  <Route path="*" element={<CustomerHomePage />} />
                </Routes>
              </CartProvider>
            </CustomerAuthProvider>
          }
        />
      </Routes>
      </Suspense>
    </Router>
  );
}

export default App;
