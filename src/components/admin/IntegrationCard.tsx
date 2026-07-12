import React from 'react';
import { CheckCircle, Circle } from 'lucide-react';

interface IntegrationCardProps {
  logo: React.ReactNode;
  name: string;
  description: string;
  configured: boolean | null;
  onClick: () => void;
  accentColor?: string;
}

const IntegrationCard: React.FC<IntegrationCardProps> = ({
  logo,
  name,
  description,
  configured,
  onClick,
  accentColor = 'bg-gray-50',
}) => {
  return (
    <button
      onClick={onClick}
      className="group relative bg-white rounded-2xl shadow-sm border border-gray-100 p-6 text-left hover:shadow-md hover:border-gray-200 transition-all duration-200 hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:ring-offset-2 w-full"
    >
      <div className="flex items-start justify-between mb-4">
        <div className={`${accentColor} rounded-xl p-3 flex items-center justify-center`}>
          {logo}
        </div>
        <div className="flex items-center gap-1.5">
          {configured === null ? (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-400 bg-gray-100 rounded-full px-2.5 py-1">
              <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-pulse" />
              Cargando
            </span>
          ) : configured ? (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 rounded-full px-2.5 py-1">
              <CheckCircle className="w-3 h-3" />
              Configurado
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-500 bg-gray-100 rounded-full px-2.5 py-1">
              <Circle className="w-3 h-3" />
              Sin configurar
            </span>
          )}
        </div>
      </div>

      <h3 className="text-sm font-semibold text-gray-900 mb-1 group-hover:text-primary-600 transition-colors">
        {name}
      </h3>
      <p className="text-xs text-gray-500 leading-relaxed">{description}</p>

      <div className="absolute inset-0 rounded-2xl ring-0 group-hover:ring-1 group-hover:ring-gray-200 transition-all pointer-events-none" />
    </button>
  );
};

export default IntegrationCard;
