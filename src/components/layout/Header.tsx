import React, { useState } from 'react';
import { Settings, User, LogOut, Menu, X } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../config/supabase';

const Header: React.FC = () => {
  const { user, logout, hasPermission } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleLogout = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    console.log('Logout button clicked!');

    try {
      console.log('Signing out from Supabase...');
      // Sign out with scope: 'local' to only clear this browser
      await supabase.auth.signOut({ scope: 'local' });
      console.log('Sign out successful');
    } catch (error) {
      console.error('Error during sign out:', error);
    }

    // Clear all local storage to ensure no cached session
    localStorage.clear();
    sessionStorage.clear();

    // Force redirect and reload
    window.location.href = '/admin';
  };

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
  };

  // Navigation items for mobile menu (mirrors Sidebar)
  const navigationItems = [
    { label: 'Dashboard', path: '/', permission: 'dashboard_view' },
    { label: 'Pedidos', path: '/pedidos', permission: 'orders_view' },
    { label: 'Clientes', path: '/clientes', permission: 'customers_view' },
    { label: 'Recetas y Menús', path: '/menus', permission: 'menus_view' },
    { label: 'Cocina', path: '/cocina', permission: 'kitchen_view' },
    { label: 'Envíos', path: '/envios', permission: 'delivery_view' },
    { label: 'Semana', path: '/semana', permission: 'weeks_view' },
    { label: 'Productos', path: '/planes', permission: 'products_view' },
    { label: 'Sitio Web', path: '/website', permission: 'website_view' },
    { label: 'WooCommerce', path: '/woocommerce', permission: 'admin_users' },
    { label: 'Contabilidad', path: '/contabilidad', permission: 'accounting_view' },
    { label: 'Nómina', path: '/nomina', permission: 'payroll_manage' },
  ];

  return (
    <>
      {/* Full-width header */}
      <header className="app-header bg-gray-900 text-white shadow-lg w-full no-print">
        <div className="px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <div className="flex items-center space-x-4 flex-shrink-0">
              <img 
                src="/logo-hd-rojo.gif"
                alt="Hola Dieta Logo" 
                className="h-10 w-auto"
                onError={(e) => {
                  console.error('Logo failed to load:', e);
                  e.currentTarget.style.display = 'none';
                }}
              />
              <h1 className="text-xl font-bold font-poppins hidden sm:block">Hola Dieta</h1>
            </div>

            {/* Desktop Right Side - Hidden on mobile */}
            <div className="hidden md:flex items-center space-x-4">
              {/* User Menu */}
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-primary-500 rounded-full flex items-center justify-center">
                  <User className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="font-medium">{user?.name || 'Usuario'}</p>
                  <p className="text-sm text-gray-400">{user?.role || 'admin'}</p>
                </div>
                
                {/* Logout Button */}
                <button
                  onClick={handleLogout}
                  className="p-2 rounded-lg hover:bg-gray-800 transition-colors text-gray-400 hover:text-white"
                  title="Cerrar sesión"
                  aria-label="Cerrar sesión"
                >
                  <LogOut className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Mobile Right Side */}
            <div className="flex md:hidden items-center space-x-2">
              {/* Mobile User Avatar */}
              <div className="w-8 h-8 bg-primary-500 rounded-full flex items-center justify-center">
                <User className="w-4 h-4 text-white" />
              </div>
              
              {/* Mobile Menu Button */}
              <button
                onClick={toggleMobileMenu}
                className="p-2 rounded-lg hover:bg-gray-800 transition-colors text-gray-400 hover:text-white"
                aria-label="Open menu"
              >
                <Menu className="w-6 h-6" />
              </button>
            </div>
          </div>

        </div>
      </header>

      {/* Mobile Navigation Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden"
          onClick={closeMobileMenu}
          aria-hidden="true"
        />
      )}

      {/* Mobile Navigation Menu */}
      <nav
        className={`fixed top-0 right-0 h-full w-80 max-w-sm bg-white shadow-2xl transform transition-transform duration-300 ease-in-out z-50 md:hidden ${
          isMobileMenuOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
        aria-label="Mobile navigation"
      >
        {/* Mobile Menu Header */}
        <div className="bg-gray-900 text-white p-6 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <img 
              src="https://stackblitz.com/storage/blobs/eyJfcmFpbHMiOnsibWVzc2FnZSI6IkJBaHBCSzJ1eHdFPSIsImV4cCI6bnVsbCwicHVyIjoiYmxvYl9pZCJ9fQ==--45387ef54c46c93300de219ea153929b3bdf5c9d//logoholadietagif.gif"
              alt="Hola Dieta Logo" 
              className="h-8 w-auto object-contain"
            />
            <div>
              <h2 className="font-bold font-poppins">Hola Dieta</h2>
              <p className="text-sm text-gray-300">{user?.name || 'Usuario'}</p>
            </div>
          </div>
          <button
            onClick={closeMobileMenu}
            className="p-2 rounded-lg hover:bg-gray-800 transition-colors"
            aria-label="Close menu"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Mobile Menu Items */}
        <div className="py-6 px-4 space-y-2 max-h-full overflow-y-auto">
          {navigationItems
            .filter((item) => !item.permission || hasPermission(item.permission))
            .map((item, index) => (
            <NavLink
              key={index}
              to={item.path}
              onClick={closeMobileMenu}
              className={({ isActive }) =>
                `block px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? 'bg-primary-500 text-white shadow-lg'
                    : 'text-gray-700 hover:bg-gray-100 hover:text-primary-600'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}

          {/* Mobile Menu Footer Actions */}
          <div className="pt-6 mt-6 border-t border-gray-200 space-y-2">
            <button
              className="w-full flex items-center px-4 py-3 text-gray-700 hover:bg-gray-100 rounded-xl transition-colors"
              aria-label="Settings"
            >
              <Settings className="w-5 h-5 mr-3" />
              Configuración
            </button>
            <button
              onClick={async (e) => {
                e.preventDefault();
                e.stopPropagation();
                closeMobileMenu();
                await handleLogout(e);
              }}
              className="w-full flex items-center px-4 py-3 text-red-600 hover:bg-red-50 rounded-xl transition-colors"
              aria-label="Cerrar sesión"
            >
              <LogOut className="w-5 h-5 mr-3" />
              Cerrar Sesión
            </button>
          </div>
        </div>
      </nav>
    </>
  );
};

export default Header;