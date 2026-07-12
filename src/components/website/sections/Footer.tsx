import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Facebook, Instagram, Twitter, Mail, Phone, MapPin } from 'lucide-react';
import type { NavigationItem, ContactInfo } from '../../../types/website';
import { resolveImageUrl } from '../../../utils/imageHelper';

interface FooterProps {
  navigationItems?: NavigationItem[];
  contactInfo?: ContactInfo;
  socialLinks?: {
    facebook?: string;
    instagram?: string;
    twitter?: string;
  };
  logo?: string;
  logoAlt?: string;
  backgroundColor?: string;
}

export const Footer: React.FC<FooterProps> = ({
  navigationItems = [
    { label: "Planes", href: "/preview", active: false },
    { label: "Nosotros", href: "/preview/about", active: false },
    { label: "FAQ", href: "/preview/faq", active: false },
    { label: "Contacto", href: "/preview/contact", active: false },
  ],
  contactInfo = {
    phone: "52 1 5545559432",
    email: "contacto@holadieta.com",
    address: "Ciudad de México, México"
  },
  socialLinks = {
    facebook: "https://facebook.com/holadieta",
    instagram: "https://instagram.com/holadieta",
    twitter: "https://twitter.com/holadieta"
  },
  logo,
  logoAlt,
  backgroundColor = "#f4ffeb"
}) => {
  const [imageError, setImageError] = useState(false);
  const logoUrl = logo ? resolveImageUrl(logo) : null;

  return (
    <footer className="w-full rounded-t-[45px] py-12 px-8 mt-8" style={{ backgroundColor }}>
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-8">

          <div className="lg:col-span-1">
            <Link to="/preview" className="inline-block mb-4">
              {!imageError && logoUrl ? (
                <img
                  className="h-12 w-auto object-contain"
                  alt={logoAlt}
                  src={logoUrl}
                  crossOrigin="anonymous"
                  onError={() => setImageError(true)}
                />
              ) : (
                <div className="h-12 flex items-center">
                  <span className="font-bold text-lg text-[#1e1e1e]">HOLA DIETA</span>
                </div>
              )}
            </Link>
            <p className="font-normal text-[#1d1c21] text-base leading-6 mb-6">
              Come sano, ahorra tiempo y alcanza tus metas sin cocinar. La mejor opción para una alimentación saludable.
            </p>

            <div className="flex space-x-4">
              {socialLinks.facebook && (
                <a
                  href={socialLinks.facebook}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-10 h-10 bg-[#bfd730] rounded-full flex items-center justify-center hover:bg-[#bfd730]/80 transition-colors"
                >
                  <Facebook className="w-5 h-5 text-black" />
                </a>
              )}
              {socialLinks.instagram && (
                <a
                  href={socialLinks.instagram}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-10 h-10 bg-[#bfd730] rounded-full flex items-center justify-center hover:bg-[#bfd730]/80 transition-colors"
                >
                  <Instagram className="w-5 h-5 text-black" />
                </a>
              )}
              {socialLinks.twitter && (
                <a
                  href={socialLinks.twitter}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-10 h-10 bg-[#bfd730] rounded-full flex items-center justify-center hover:bg-[#bfd730]/80 transition-colors"
                >
                  <Twitter className="w-5 h-5 text-black" />
                </a>
              )}
            </div>
          </div>

          <div className="lg:col-span-1">
            <h3 className="font-bold text-black text-lg mb-4">
              Navegación
            </h3>
            <nav className="space-y-2">
              {navigationItems.map((item, index) => (
                <Link
                  key={index}
                  to={item.href}
                  className="block font-normal text-[#1d1c21] text-base hover:text-black transition-colors"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>

          <div className="lg:col-span-1">
            <h3 className="font-bold text-black text-lg mb-4">
              Contacto
            </h3>
            <div className="space-y-3">
              {contactInfo.phone && (
                <div className="flex items-center space-x-3">
                  <Phone className="w-5 h-5 text-[#bfd730]" />
                  <span className="font-normal text-[#1d1c21] text-base">
                    {contactInfo.phone}
                  </span>
                </div>
              )}
              {contactInfo.email && (
                <div className="flex items-center space-x-3">
                  <Mail className="w-5 h-5 text-[#bfd730]" />
                  <span className="font-normal text-[#1d1c21] text-base">
                    {contactInfo.email}
                  </span>
                </div>
              )}
              {contactInfo.address && (
                <div className="flex items-center space-x-3">
                  <MapPin className="w-5 h-5 text-[#bfd730]" />
                  <span className="font-normal text-[#1d1c21] text-base">
                    {contactInfo.address}
                  </span>
                </div>
              )}
            </div>
          </div>

        </div>

        <div className="border-t border-gray-200 pt-6">
          <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
            <p className="font-normal text-[#1d1c21] text-sm">
              © 2025 Hola Dieta. Todos los derechos reservados.
            </p>
            <div className="flex space-x-6">
              <Link
                to="/preview/privacy"
                className="font-normal text-[#1d1c21] text-sm hover:text-black transition-colors"
              >
                Política de Privacidad
              </Link>
              <Link
                to="/preview/terms"
                className="font-normal text-[#1d1c21] text-sm hover:text-black transition-colors"
              >
                Términos y Condiciones
              </Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};
