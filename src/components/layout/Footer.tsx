import React from 'react';
import { Link } from 'react-router-dom';

const Footer: React.FC = () => {
  return (
    <footer className="bg-white border-t border-gray-200 py-4 px-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-wrap items-center justify-center gap-2 text-sm text-gray-600">
          <Link
            to="/politica-de-privacidad"
            className="hover:text-gray-900 transition-colors"
          >
            Política de Privacidad
          </Link>
          <span className="text-gray-400">•</span>
          <Link
            to="/terminos-y-condiciones"
            className="hover:text-gray-900 transition-colors"
          >
            Términos y Condiciones
          </Link>
          <span className="text-gray-400">•</span>
          <span className="text-gray-500">
            Copyright © {new Date().getFullYear()} YellowDyeMx
          </span>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
