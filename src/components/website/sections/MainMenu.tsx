import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import type { NavigationItem } from '../../../types/website';
import { resolveImageUrl } from '../../../utils/imageHelper';

interface MainMenuProps {
  navigationItems?: NavigationItem[];
  logo?: string;
  logoAlt?: string;
  backgroundColor?: string;
}

const isValidCssColor = (value: string): boolean => {
  return /^#[0-9A-Fa-f]{3,8}$/.test(value) ||
    /^rgba?\(/.test(value) ||
    /^hsla?\(/.test(value) ||
    /^[a-zA-Z]+$/.test(value);
};

export const MainMenu: React.FC<MainMenuProps> = ({
  navigationItems = [
    { label: "Inicio", href: "/preview", active: true },
    { label: "Proteinas", href: "/preview/proteinas", active: false },
    { label: "Nosotros", href: "/preview/about", active: false },
    { label: "FAQ", href: "/preview/faq", active: false },
    { label: "Contacto", href: "/preview/contact", active: false },
  ],
  logo,
  logoAlt,
  backgroundColor = "#e9ff93"
}) => {
  const safeBgColor = backgroundColor && isValidCssColor(backgroundColor) ? backgroundColor : "#e9ff93";
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [imageError, setImageError] = useState(false);

  const logoUrl = logo ? resolveImageUrl(logo) : null;

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
  };

  return (
    <div className="relative">
      <header className="flex flex-wrap w-full h-[90px] md:h-[104px] items-center gap-[0px_24px] py-4 md:py-8 px-4 md:px-8 rounded-[0px_0px_45px_45px] border-b border-[#d9d9d9]" style={{ backgroundColor: safeBgColor }}>
        <div className="inline-flex items-center gap-6 relative flex-[0_0_auto]">
          <Link to="/preview" onClick={closeMobileMenu}>
            <div className="flex items-center justify-center h-12 md:h-16 px-3 md:px-4">
              {!imageError && logoUrl ? (
                <img
                  className="h-10 md:h-12 w-auto object-contain"
                  alt={logoAlt}
                  src={logoUrl}
                  crossOrigin="anonymous"
                  onError={() => setImageError(true)}
                />
              ) : (
                <div className="h-10 md:h-12 flex items-center justify-center px-4 bg-white/50 rounded">
                  <span className="font-bold text-lg text-[#1e1e1e]">HOLA DIETA</span>
                </div>
              )}
            </div>
          </Link>
        </div>

        <nav className="hidden lg:flex flex-wrap items-start justify-end gap-[8px_8px] relative flex-1 grow">
          {navigationItems.map((item, index) => (
            <Link key={index} to={item.href}>
              <button
                className={`h-auto inline-flex items-center justify-center gap-2 px-4 py-2 relative flex-[0_0_auto] rounded-[100px] transition-all duration-200 font-normal text-black text-base ${
                  item.active
                    ? "bg-[#ffb3e3]"
                    : "bg-transparent hover:bg-[#ffb3e3]/30"
                }`}
              >
                {item.label}
              </button>
            </Link>
          ))}
        </nav>

        <div className="hidden lg:flex items-center relative">
          <button
            onClick={() => alert('Esta es una vista previa. En el sitio real, este botón llevará a los clientes a iniciar sesión.')}
            className="h-auto flex items-center justify-center gap-2 p-2 relative bg-[#bfd730] rounded-[1000px] overflow-hidden border border-solid border-[#767676] font-normal text-[#1e1e1e] text-base hover:bg-[#bfd730]/80 transition-all duration-200 cursor-pointer"
          >
            Iniciar sesión
          </button>
        </div>

        <div className="lg:hidden ml-auto">
          <button
            onClick={toggleMobileMenu}
            className="h-auto p-2 rounded-[100px] bg-transparent hover:bg-[#ffb3e3]/80 transition-all duration-200"
            aria-label={isMobileMenuOpen ? "Cerrar menú" : "Abrir menú"}
          >
            {isMobileMenuOpen ? (
              <X className="w-6 h-6 text-[#1e1e1e]" />
            ) : (
              <Menu className="w-6 h-6 text-[#1e1e1e]" />
            )}
          </button>
        </div>
      </header>

      {isMobileMenuOpen && (
        <div className="lg:hidden absolute top-full left-0 right-0 z-50">
          <div className="mx-4 mt-2 rounded-3xl shadow-lg border border-gray-100" style={{ backgroundColor: safeBgColor }}>
            <nav className="py-2">
              {navigationItems.map((item, index) => (
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
              <div className="px-4 py-3 border-t border-gray-100">
                <button
                  onClick={() => {
                    closeMobileMenu();
                    alert('Esta es una vista previa. En el sitio real, este botón llevará a los clientes a iniciar sesión.');
                  }}
                  className="w-full py-2 px-4 bg-[#bfd730] text-black rounded hover:bg-[#bfd730]/80 font-medium text-center cursor-pointer"
                >
                  Iniciar sesión
                </button>
              </div>
            </nav>
          </div>
        </div>
      )}
    </div>
  );
};
