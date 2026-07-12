import React from 'react';
import { Calendar, Truck, Check } from 'lucide-react';
import { SelectedWeek } from '../../../types/week';
import { DeliveryOption } from '../../../types/deliveryOption';
import { PendingOrderItem } from '../../../types/orderMenu';
import { getTotalMealCountForWeek } from '../../../utils/orderValidation';

interface CustomerWeekSelectorProps {
  selectedWeeks: SelectedWeek[];
  activeWeek: SelectedWeek | null;
  onWeekSelect: (week: SelectedWeek) => void;
  deliveryOption: DeliveryOption | null;
  orderItems?: PendingOrderItem[];
}

const CustomerWeekSelector: React.FC<CustomerWeekSelectorProps> = ({
  selectedWeeks,
  activeWeek,
  onWeekSelect,
  deliveryOption,
  orderItems = []
}) => {
  const formatDate = (dateString: string) => {
    // Parse date string manually to avoid timezone issues
    const [year, month, day] = dateString.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString('es-MX', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  return (
    <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <div className="bg-green-100 p-2 rounded-lg">
            <Calendar className="w-5 h-5 text-green-600" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Semanas Seleccionadas</h2>
            <p className="text-sm text-gray-600">Haz clic en una semana para ver el menú</p>
          </div>
        </div>

        {deliveryOption && (
          <div className="flex items-center space-x-2 px-4 py-2 bg-purple-50 border border-purple-200 rounded-lg">
            <Truck className="w-4 h-4 text-purple-600" />
            <span className="text-sm font-medium text-purple-700">
              {deliveryOption.delivery_options_name}
            </span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {selectedWeeks.map((week) => {
          const totalCount = getTotalMealCountForWeek(orderItems, week.week.week_name);
          const hasDishes = totalCount > 0;

          return (
            <button
              key={week.tempId}
              onClick={() => onWeekSelect(week)}
              className={`p-4 rounded-xl border-2 transition-all duration-200 text-left ${
                activeWeek?.tempId === week.tempId
                  ? 'border-red-500 bg-red-50'
                  : hasDishes
                  ? 'border-green-500 bg-green-50'
                  : 'border-gray-200 hover:border-red-300 bg-white'
              }`}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 text-lg">
                    {week.week.week_name}
                  </h3>
                  <p className="text-sm text-gray-600 mt-1">
                    {week.week.menu_name || 'Sin menú'}
                  </p>
                </div>
                <div className="flex items-center space-x-2 ml-2">
                  {hasDishes && (
                    <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="text-sm font-bold text-white">{totalCount}</span>
                    </div>
                  )}
                  {activeWeek?.tempId === week.tempId && (
                    <div className="w-6 h-6 bg-red-500 rounded-full flex items-center justify-center flex-shrink-0">
                      <Check className="w-4 h-4 text-white" />
                    </div>
                  )}
                </div>
              </div>

              {week.week.week_date && (
                <div className="mt-3 pt-3 border-t border-gray-200">
                  <div className="flex items-center space-x-2">
                    <Truck className="w-4 h-4 text-gray-500" />
                    <span className="text-xs text-gray-600">Entrega:</span>
                  </div>
                  <p className="text-sm font-medium text-gray-900 mt-1">
                    {formatDate(week.week.week_date)}
                  </p>
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default CustomerWeekSelector;
