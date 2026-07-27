import React from 'react';
import { Megaphone } from 'lucide-react';
import CouponsCard from '../components/marketing/CouponsCard';

const Marketing: React.FC = () => {
  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center space-x-3 mb-4">
          <div className="bg-primary-100 p-2 rounded-lg">
            <Megaphone className="w-8 h-8 text-primary-600" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900 font-poppins">Marketing</h1>
            <p className="text-gray-600 mt-1">
              Gestiona promociones, cupones y campañas de descuento.
            </p>
          </div>
        </div>
      </div>

      {/* Card Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        <CouponsCard />
      </div>
    </div>
  );
};

export default Marketing;
