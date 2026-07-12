import React from 'react';
import { Calendar, Check } from 'lucide-react';

interface PlanDurationSelectorProps {
  selectedDuration: 1 | 2 | 4 | null;
  onDurationSelect: (duration: 1 | 2 | 4) => void;
  disabled?: boolean;
}

const PlanDurationSelector: React.FC<PlanDurationSelectorProps> = ({
  selectedDuration,
  onDurationSelect,
  disabled = false
}) => {
  const durations = [
    {
      value: 1 as const,
      label: '1 Semana',
      description: 'Plan semanal'
    },
    {
      value: 2 as const,
      label: '2 Semanas',
      description: 'Plan quincenal'
    },
    {
      value: 4 as const,
      label: '4 Semanas',
      description: 'Plan mensual'
    }
  ];

  return (
    <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
      <div className="flex items-center space-x-3 mb-6">
        <div className="bg-blue-100 p-2 rounded-lg">
          <Calendar className="w-5 h-5 text-blue-600" />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Duración del Plan</h2>
          <p className="text-sm text-gray-600">Selecciona cuántas semanas deseas ordenar</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {durations.map((duration) => (
          <button
            key={duration.value}
            onClick={() => !disabled && onDurationSelect(duration.value)}
            disabled={disabled}
            className={`relative p-6 rounded-xl border-2 transition-all duration-200 ${
              selectedDuration === duration.value
                ? 'border-red-500 bg-red-50'
                : 'border-gray-200 hover:border-red-300 bg-white'
            } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
          >
            {/* Check Icon */}
            {selectedDuration === duration.value && (
              <div className="absolute top-3 right-3 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center">
                <Check className="w-4 h-4 text-white" />
              </div>
            )}

            <div className="text-center mt-2">
              <h3 className="text-2xl font-bold text-gray-900 mb-2">
                {duration.label}
              </h3>
              <p className="text-sm text-gray-600">{duration.description}</p>
            </div>
          </button>
        ))}
      </div>

      {selectedDuration && (
        <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-xl">
          <p className="text-sm text-blue-800">
            Has seleccionado un plan de <strong>{selectedDuration} {selectedDuration === 1 ? 'semana' : 'semanas'}</strong>.
            Las semanas disponibles se seleccionarán automáticamente.
          </p>
        </div>
      )}
    </div>
  );
};

export default PlanDurationSelector;
