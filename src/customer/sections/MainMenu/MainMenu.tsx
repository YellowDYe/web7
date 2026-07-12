import React, { useState, useMemo } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Button } from '../../components/ui/button';
import { NavigationItem } from '../../types';
import { Menu, X, User, LogOut, CircleUser as UserCircle2, ShoppingCart } from 'lucide-react';
import { useSiteBranding } from '../../hooks/useSiteBranding';
import { useCustomerAuth } from '../../contexts/CustomerAuthContext';
import { useCart } from '../../contexts/CartContext';

interface MainMenuProps {
  navigationItems?: NavigationItem[];
  logo?: string;
  logoAlt?: string;
  backgroundColor?: string;
  basePath?: string;
}

export const MainMenu: React.FC<MainMenuProps> = ({
  navigationItems = [],
  logo = "/logo-h-rojo.png",
  logoAlt = "Hola Dieta Logo",
  backgroundColor = "bg-[#e9ff93]",
  basePath = ""
}) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [imageError, setImageError] = useState(false);
  const { logoUrl, logoAlt: brandingLogoAlt, siteName } = useSiteBranding();
  const { customer, user, logout } = useCustomerAuth();
  const { itemCount, proteinItemCount } = useCart();
  const totalCartCount = itemCount + proteinItemCount;
  const navigate = useNavigate();
  const location = useLocation();

  const isCheckoutPage = location.pathname.includes('/checkout');

  const enhancedNavigationItems = useMemo(() => {
    const currentPath = location.pathname;
    const isHomePage = currentPath === '/' || currentPath === '';
    const isAuthPage = currentPath.includes('/login') || currentPath.includes('/signup');
    const isCheckout = currentPath.includes('/checkout');

    const inicioItem: NavigationItem = {
      label: 'Inicio',
      href: basePath || '/',
      active: false
    };

    if (isCheckout) {
      return [inicioItem];
    }

    const shouldShowInicio = !isHomePage && !isAuthPage;

    if (shouldShowInicio) {
      return [inicioItem, ...navigationItems];
    }

    return navigationItems;
  }, [location.pathname, navigationItems, basePath]);

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
  };

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/');
      setIsUserMenuOpen(false);
      closeMobileMenu();
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  return (
    <div className="relative">
      <header className={`flex flex-wrap w-full h-[90px] md:h-[104px] items-center gap-[0px_24px] py-4 md:py-8 px-4 md:px-8 ${backgroundColor} rounded-[0px_0px_45px_45px] border-b border-[#d9d9d9]`}>
        {/* Logo */}
        <div className="inline-flex items-center gap-6 relative flex-[0_0_auto]">
          <Link to={basePath || "/"} onClick={closeMobileMenu}>
            <div className="flex items-center justify-center h-12 md:h-16 px-3 md:px-4">
              {!imageError && logoUrl && logoUrl.trim() ? (
                <img
                  className="h-10 md:h-12 w-auto object-contain"
                  alt={brandingLogoAlt || siteName || logoAlt}
                  src={logoUrl}
                  onError={() => setImageError(true)}
                />
              ) : (
                <h1 className="text-2xl md:text-3xl font-bold text-gray-800">
                  {siteName || "Hola Dieta"}
                </h1>
              )}
            </div>
          </Link>
        </div>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex flex-wrap items-start justify-end gap-[8px_8px] relative flex-1 grow">
          {enhancedNavigationItems.map((item, index) => (
            <Button
              key={index}
              variant="ghost"
              asChild
              className={`h-auto inline-flex items-center justify-center gap-2 px-4 py-2 relative flex-[0_0_auto] rounded-[100px] transition-all duration-200 [font-family:'Chivo',Helvetica] font-normal text-black text-base tracking-[0] leading-4 ${
                item.active
                  ? "bg-[#ffb3e3]"
                  : (item.label === "Planes" || item.label === "Proteinas")
                    ? "bg-transparent hover:bg-[#ffb3e3]/30"
                    : "bg-transparent hover:bg-[#ffb3e3]/30"
              }`}
            >
              <Link to={item.href}>
                {item.label}
              </Link>
            </Button>
          ))}
        </nav>

        {/* Desktop Cart and Auth Buttons */}
        <div className={`hidden md:flex items-center relative gap-2 ${isCheckoutPage ? 'invisible' : ''}`}>
          {/* Cart Icon with Badge */}
          <Link to="/cart" className="relative p-2 hover:bg-gray-100 rounded-full transition-colors">
            <ShoppingCart className="h-6 w-6 text-gray-700" />
            {totalCartCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
                {totalCartCount}
              </span>
            )}
          </Link>

          {user && customer ? (
            <div className="relative">
              <Button
                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                className="h-auto inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white hover:bg-gray-100 text-black border border-gray-300 transition-all"
              >
                <UserCircle2 className="h-5 w-5" />
                <span className="font-medium">{customer.customer_name}</span>
              </Button>

              {isUserMenuOpen && (
                <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50">
                  <div className="px-4 py-3 border-b border-gray-100">
                    <p className="text-sm font-medium text-gray-900">
                      {customer.customer_name} {customer.customer_lastname}
                    </p>
                    <p className="text-xs text-gray-500 truncate">{customer.customer_email}</p>
                  </div>
                  <Link
                    to="/account"
                    onClick={() => setIsUserMenuOpen(false)}
                    className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                  >
                    <User className="h-4 w-4" />
                    Mi Cuenta
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                  >
                    <LogOut className="h-4 w-4" />
                    Cerrar Sesión
                  </button>
                </div>
              )}
            </div>
          ) : (
            <Button
              asChild
              className="h-auto px-4 py-2 rounded-full bg-[#ff4d8b] hover:bg-[#ff3377] text-white transition-all"
            >
              <Link to="/login">Iniciar Sesión</Link>
            </Button>
          )}
        </div>

        {/* Mobile Hamburger Button */}
        <div className="md:hidden ml-auto">
          <Button
            variant="ghost"
            onClick={toggleMobileMenu} 
            className="h-auto p-2 rounded-[100px] bg-transparent hover:bg-[#ffb3e3]/80 transition-all duration-200"
            aria-label={isMobileMenuOpen ? "Cerrar menú" : "Abrir menú"}
            aria-expanded={isMobileMenuOpen}
            aria-controls="mobile-navigation"
          >
            {isMobileMenuOpen ? (
              <X className="w-6 h-6 text-[#1e1e1e]" />
            ) : (
              <Menu className="w-6 h-6 text-[#1e1e1e]" />
            )}
          </Button>
        </div>
      </header>

      {/* Mobile Navigation Menu - Outside header */}
      {isMobileMenuOpen && (
        <div className="md:hidden absolute top-full left-0 right-0 z-50">
          <div className="bg-[#e9ff93] mx-4 mt-2 rounded-3xl shadow-lg border border-gray-100">
            <nav className="py-2">
              {enhancedNavigationItems.map((item, index) => (
                <Link key={index} to={item.href} onClick={closeMobileMenu}>
                  <div className={`block px-4 py-3 text-black border-b border-gray-100 last:border-b-0 transition-colors rounded-[100px] ${
                    item.active
                      ? "bg-[#ffb3e3]"
                      : "bg-transparent hover:bg-[#ffb3e3]/30"
                  }`}>
                    {item.label}
                  </div>
                </Link>
              ))}
              {/* Mobile Cart Link */}
              {!isCheckoutPage && (
                <Link to="/cart" onClick={closeMobileMenu}>
                  <div className="flex items-center justify-between px-4 py-3 text-black border-b border-gray-100 hover:bg-[#ffb3e3]/30 transition-colors">
                    <div className="flex items-center gap-2">
                      <ShoppingCart className="h-4 w-4" />
                      <span>Carrito</span>
                    </div>
                    {totalCartCount > 0 && (
                      <span className="bg-red-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
                        {totalCartCount}
                      </span>
                    )}
                  </div>
                </Link>
              )}
              {!isCheckoutPage && <div className="px-4 py-3 border-t border-gray-100">
                {user && customer ? (
                  <div className="space-y-2">
                    <div className="pb-2 border-b border-gray-200">
                      <p className="text-sm font-medium text-gray-900">
                        {customer.customer_name} {customer.customer_lastname}
                      </p>
                      <p className="text-xs text-gray-500">{customer.customer_email}</p>
                    </div>
                    <Link
                      to="/account"
                      onClick={closeMobileMenu}
                      className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-[#ffb3e3]/30 rounded-lg transition-colors"
                    >
                      <User className="h-4 w-4" />
                      Mi Cuenta
                    </Link>
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <LogOut className="h-4 w-4" />
                      Cerrar Sesión
                    </button>
                  </div>
                ) : (
                  <Link
                    to="/login"
                    onClick={closeMobileMenu}
                    className="block text-center px-4 py-2 rounded-full bg-[#ff4d8b] hover:bg-[#ff3377] text-white transition-colors"
                  >
                    Iniciar Sesión
                  </Link>
                )}
              </div>}
            </nav>
          </div>
        </div>
      )}
    </div>
  );
};