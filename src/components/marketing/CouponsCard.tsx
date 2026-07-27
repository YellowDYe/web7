import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Ticket, ChevronRight } from 'lucide-react';

const CouponsCard: React.FC = () => {
  const navigate = useNavigate();

  return (
    <button
      onClick={() => navigate('/admin/marketing/coupons')}
      className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden text-left group transition-all duration-200 hover:shadow-xl hover:border-primary-200"
    >
      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="bg-primary-100 p-3 rounded-xl">
            <Ticket className="w-7 h-7 text-primary-600" />
          </div>
          <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-primary-500 group-hover:translate-x-1 transition-all" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 font-poppins mb-1">Cupones</h2>
        <p className="text-sm text-gray-500">
          Crea y administra códigos de descuento para tus clientes.
        </p>
      </div>
    </button>
  );
};

export default CouponsCard;
