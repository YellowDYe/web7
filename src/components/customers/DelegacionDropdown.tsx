import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown, MapPin, X } from 'lucide-react';

interface DelegacionDropdownProps {
  selectedDelegacion: string;
  onDelegacionSelect: (delegacion: string) => void;
  error?: string;
  disabled?: boolean;
  required?: boolean;
}

const DELEGACIONES = [
  'Álvaro Obregón',
  'Azcapotzalco',
  'Benito Juárez',
  'Coyoacán',
  'Cuajimalpa de Morelos',
  'Cuauhtémoc',
  'Gustavo A. Madero',
  'Iztapalapa',
  'La Magdalena Contreras',
  'Miguel Hidalgo',
  'Naucalpan de Juárez',
  'Tlalpan',
  'Venustiano Carranza'
];

const DelegacionDropdown: React.FC<DelegacionDropdownProps> = ({
  selectedDelegacion,
  onDelegacionSelect,
  error,
  disabled = false,
  required = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredDelegaciones, setFilteredDelegaciones] = useState<string[]>(DELEGACIONES);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchTerm('');
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!searchTerm.trim()) {
      setFilteredDelegaciones(DELEGACIONES);
    } else {
      const filtered = DELEGACIONES.filter(delegacion =>
        delegacion.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredDelegaciones(filtered);
    }
  }, [searchTerm]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchTerm(value);

    if (!isOpen) {
      setIsOpen(true);
    }
  };

  const handleDropdownToggle = () => {
    if (disabled) return;

    if (!isOpen) {
      setIsOpen(true);
      if (inputRef.current) {
        inputRef.current.focus();
      }
    } else {
      setIsOpen(false);
      setSearchTerm('');
    }
  };

  const handleDelegacionSelect = (delegacion: string) => {
    onDelegacionSelect(delegacion);
    setIsOpen(false);
    setSearchTerm('');
  };

  const handleClearSelection = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelegacionSelect('');
    setSearchTerm('');
    setIsOpen(false);
  };

  const getDisplayValue = () => {
    if (selectedDelegacion && !isOpen) {
      return selectedDelegacion;
    }
    return searchTerm;
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
      setSearchTerm('');
    }
  };

  return (
    <div className="relative" ref={containerRef}>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        Delegación {required && <span className="text-red-500">*</span>}
      </label>

      <div className="relative">
        <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5 pointer-events-none z-10" />

        <input
          ref={inputRef}
          type="text"
          value={getDisplayValue()}
          onChange={handleInputChange}
          onClick={handleDropdownToggle}
          onKeyDown={handleKeyDown}
          placeholder={disabled ? 'Selección deshabilitada' : 'Buscar delegación...'}
          className={`w-full pl-10 pr-20 py-3 border rounded-xl outline-none transition-all ${
            error ? 'border-red-500 focus:ring-2 focus:ring-red-500' : 'border-gray-300 focus:ring-2 focus:ring-primary-500 focus:border-primary-500'
          } ${disabled ? 'bg-gray-100 cursor-not-allowed' : 'bg-white cursor-text'}`}
          disabled={disabled}
          autoComplete="off"
        />

        {selectedDelegacion && !disabled && (
          <button
            type="button"
            onClick={handleClearSelection}
            className="absolute right-10 top-1/2 transform -translate-y-1/2 p-1 hover:bg-gray-100 rounded-full transition-colors z-10"
            title="Limpiar selección"
          >
            <X className="w-4 h-4 text-gray-400" />
          </button>
        )}

        <button
          type="button"
          onClick={handleDropdownToggle}
          className="absolute right-3 top-1/2 transform -translate-y-1/2 p-1 hover:bg-gray-100 rounded transition-colors z-10"
          disabled={disabled}
        >
          <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {error && (
        <p className="mt-1 text-sm text-red-600">{error}</p>
      )}

      {isOpen && !disabled && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-xl shadow-lg max-h-80 overflow-y-auto">
          {filteredDelegaciones.length === 0 ? (
            <div className="p-4 text-center">
              <p className="text-sm text-gray-600">
                No se encontraron delegaciones para "{searchTerm}"
              </p>
            </div>
          ) : (
            <div className="py-2">
              {filteredDelegaciones.map((delegacion) => {
                const isSelected = selectedDelegacion === delegacion;
                return (
                  <button
                    key={delegacion}
                    type="button"
                    onClick={() => handleDelegacionSelect(delegacion)}
                    className={`w-full p-3 text-left hover:bg-gray-50 transition-colors focus:bg-gray-50 focus:outline-none ${
                      isSelected ? 'bg-primary-50 border-l-4 border-primary-500' : ''
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <div className="bg-primary-100 p-2 rounded-lg flex-shrink-0">
                        <MapPin className="w-4 h-4 text-primary-600" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900">
                          {delegacion}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default DelegacionDropdown;
