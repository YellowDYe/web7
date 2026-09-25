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
  onToggleMondayDelivery: (weekTempId: string) => void;
  deliveryOption: DeliveryOption | null;
  orderItems?: PendingOrderItem[];
}

const CustomerWeekSelector: React.FC<CustomerWeekSelectorProps> = ({
  selectedWeeks,
  activeWeek,
  onWeekSelect,
  onToggleMondayDelivery,
  deliveryOption,
  orderItems = []
}) => {
  const formatDate = (dateString: string) => {
    const [year, month, day] = dateString.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString('es-MX', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getDisplayDate = (week: SelectedWeek): string | null => {
    const baseDate = week.original_week_date ?? week.week.week_date;
    if (!baseDate) return null;

    if (week.monday_delivery) {
      const [year, month, day] = baseDate.split('-').map(Number);
      const date = new Date(year, month - 1, day);
      date.setDate(date.getDate() + 1);
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, '0');
      const d = String(date.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }

    return baseDate;
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
          <div className="flex items-center space-x-2 px-4 py-2 bg-emerald-50 border border-emerald-200 rounded-lg">
            <Truck className="w-4 h-4 text-emerald-600" />
            <span className="text-sm font-medium text-emerald-700">
              {deliveryOption.delivery_options_name}
            </span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {selectedWeeks.map((week, index) => {
          const totalCount = getTotalMealCountForWeek(orderItems, week.week.week_name);
          const hasDishes = totalCount > 0;
          const isActive = activeWeek?.tempId === week.tempId;
          const displayDate = getDisplayDate(week);
          const isMonday = !!week.monday_delivery;

          return (
            <button
              key={week.tempId}
              onClick={() => onWeekSelect(week)}
              className={`rounded-xl border-2 transition-all duration-200 text-left p-4 ${
                isActive
                  ? 'border-red-500 bg-red-50'
                  : hasDishes
                  ? 'border-green-500 bg-green-50'
                  : 'border-gray-200 bg-white hover:border-red-300'
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-gray-500">
                  Semana {index + 1}
                </span>
                <div className="flex items-center space-x-2">
                  {hasDishes && (
                    <div className="w-7 h-7 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="text-xs font-bold text-white">{totalCount}</span>
                    </div>
                  )}
                  {isActive && (
                    <div className="w-6 h-6 bg-red-500 rounded-full flex items-center justify-center flex-shrink-0">
                      <Check className="w-4 h-4 text-white" />
                    </div>
                  )}
                </div>
              </div>

              {displayDate ? (
                <div>
                  <div className="flex items-center space-x-2 mb-1">
                    <Truck className={`w-4 h-4 ${isMonday ? 'text-blue-600' : 'text-green-600'}`} />
                    <span className={`text-xs font-medium ${isMonday ? 'text-blue-600' : 'text-green-600'}`}>
                      Fecha de entrega
                    </span>
                  </div>
                  <p className={`text-base font-semibold capitalize ${isMonday ? 'text-blue-900' : 'text-gray-900'}`}>
                    {formatDate(displayDate)}
                  </p>
                  <p className={`text-xs mt-1 ${isMonday ? 'text-blue-600' : 'text-gray-500'}`}>
                    {isMonday
                      ? 'Entregas en lunes a partir de las 10:00 AM'
                      : 'Entregas de 6:30 a 9:30 PM del domingo'}
                  </p>

                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleMondayDelivery(week.tempId);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        e.stopPropagation();
                        onToggleMondayDelivery(week.tempId);
                      }
                    }}
                    className="inline-block mt-2 text-xs text-gray-400 hover:text-gray-600 underline underline-offset-2 cursor-pointer transition-colors"
                  >
                    {isMonday
                      ? 'Cambiar a entrega en domingo'
                      : 'Solicitar entrega en lunes'}
                  </span>
                </div>
              ) : (
                <p className="text-sm text-gray-400">Sin fecha de entrega</p>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default CustomerWeekSelector;
