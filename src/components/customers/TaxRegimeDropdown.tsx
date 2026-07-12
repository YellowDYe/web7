import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown, Search, X, FileText } from 'lucide-react';

interface TaxRegimeOption {
  code: string;
  description: string;
}

interface TaxRegimeDropdownProps {
  selectedRegime: string;
  onRegimeSelect: (regime: string) => void;
  error?: string;
  disabled?: boolean;
  required?: boolean;
}

const TAX_REGIMES: TaxRegimeOption[] = [
  { code: '601', description: 'General de Ley Personas Morales' },
  { code: '603', description: 'Personas Morales con Fines no Lucrativos' },
  { code: '605', description: 'Sueldos y Salarios e Ingresos Asimilados a Salarios' },
  { code: '606', description: 'Arrendamiento' },
  { code: '607', description: 'Régimen de Enajenación o Adquisición de Bienes' },
  { code: '608', description: 'Demás ingresos' },
  { code: '609', description: 'Consolidación' },
  { code: '610', description: 'Residentes en el Extranjero sin Establecimiento Permanente en México' },
  { code: '611', description: 'Ingresos por Dividendos (socios y accionistas)' },
  { code: '612', description: 'Personas Físicas con Actividades Empresariales y Profesionales' },
  { code: '614', description: 'Ingresos por intereses' },
  { code: '615', description: 'Régimen de los ingresos por obtención de premios' },
  { code: '616', description: 'Sin obligaciones fiscales' },
  { code: '620', description: 'Sociedades Cooperativas de Producción que optan por diferir sus ingresos' },
  { code: '621', description: 'Incorporación Fiscal' },
  { code: '622', description: 'Actividades Agrícolas, Ganaderas, Silvícolas y Pesqueras' },
  { code: '623', description: 'Opcional para Grupos de Sociedades' },
  { code: '624', description: 'Coordinados' },
  { code: '625', description: 'Régimen de las Actividades Empresariales con ingresos a través de Plataformas Tecnológicas' },
  { code: '626', description: 'Régimen Simplificado de Confianza' },
  { code: '628', description: 'Hidrocarburos' },
  { code: '629', description: 'De los Regímenes Fiscales Preferentes y de las Empresas Multinacionales' },
  { code: '630', description: 'Enajenación de acciones en bolsa de valores' }
];

const TaxRegimeDropdown: React.FC<TaxRegimeDropdownProps> = ({
  selectedRegime,
  onRegimeSelect,
  error,
  disabled = false,
  required = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredRegimes, setFilteredRegimes] = useState<TaxRegimeOption[]>(TAX_REGIMES);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Handle clicks outside to close dropdown
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

  // Filter regimes based on search term
  useEffect(() => {
    if (!searchTerm.trim()) {
      setFilteredRegimes(TAX_REGIMES);
    } else {
      const filtered = TAX_REGIMES.filter(regime =>
        regime.code.includes(searchTerm) ||
        regime.description.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredRegimes(filtered);
    }
  }, [searchTerm]);

  // Handle input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchTerm(value);
    
    if (!isOpen) {
      setIsOpen(true);
    }
  };

  // Handle dropdown toggle
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

  // Handle regime selection
  const handleRegimeSelect = (regime: TaxRegimeOption) => {
    onRegimeSelect(`${regime.code} ${regime.description}`);
    setIsOpen(false);
    setSearchTerm('');
  };

  // Handle clear selection
  const handleClearSelection = (e: React.MouseEvent) => {
    e.stopPropagation();
    onRegimeSelect('');
    setSearchTerm('');
    setIsOpen(false);
  };

  // Get display value for input
  const getDisplayValue = () => {
    if (selectedRegime && !isOpen) {
      return selectedRegime;
    }
    return searchTerm;
  };

  // Get selected regime for highlighting
  const getSelectedRegimeCode = () => {
    if (!selectedRegime) return '';
    return selectedRegime.split(' ')[0];
  };

  return (
    <div className="relative" ref={containerRef}>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        Régimen Fiscal {required && <span className="text-red-500">*</span>}
      </label>
      
      {/* Main Input Field */}
      <div className="relative">
        <FileText className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5 pointer-events-none z-10" />
        
        <input
          ref={inputRef}
          type="text"
          value={getDisplayValue()}
          onChange={handleInputChange}
          onClick={handleDropdownToggle}
          placeholder={disabled ? 'Selección deshabilitada' : 'Buscar régimen fiscal...'}
          className={`w-full pl-10 pr-20 py-3 border rounded-xl outline-none transition-all ${
            error ? 'border-red-500 focus:ring-2 focus:ring-red-500' : 'border-gray-300 focus:ring-2 focus:ring-primary-500 focus:border-primary-500'
          } ${disabled ? 'bg-gray-100 cursor-not-allowed' : 'bg-white cursor-text'}`}
          disabled={disabled}
          autoComplete="off"
        />
        
        {/* Clear Button */}
        {selectedRegime && !disabled && (
          <button
            type="button"
            onClick={handleClearSelection}
            className="absolute right-10 top-1/2 transform -translate-y-1/2 p-1 hover:bg-gray-100 rounded-full transition-colors z-10"
            title="Limpiar selección"
          >
            <X className="w-4 h-4 text-gray-400" />
          </button>
        )}
        
        {/* Dropdown Arrow */}
        <button
          type="button"
          onClick={handleDropdownToggle}
          className="absolute right-3 top-1/2 transform -translate-y-1/2 p-1 hover:bg-gray-100 rounded transition-colors z-10"
          disabled={disabled}
        >
          <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <p className="mt-1 text-sm text-red-600">{error}</p>
      )}

      {/* Dropdown Menu */}
      {isOpen && !disabled && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-xl shadow-lg max-h-80 overflow-y-auto">
          {filteredRegimes.length === 0 ? (
            <div className="p-4 text-center">
              <p className="text-sm text-gray-600">
                No se encontraron regímenes para "{searchTerm}"
              </p>
            </div>
          ) : (
            <div className="py-2">
              {filteredRegimes.map((regime) => {
                const isSelected = getSelectedRegimeCode() === regime.code;
                return (
                  <button
                    key={regime.code}
                    type="button"
                    onClick={() => handleRegimeSelect(regime)}
                    className={`w-full p-3 text-left hover:bg-gray-50 transition-colors focus:bg-gray-50 focus:outline-none ${
                      isSelected ? 'bg-primary-50 border-l-4 border-primary-500' : ''
                    }`}
                  >
                    <div className="flex items-start space-x-3">
                      <div className="bg-primary-100 p-2 rounded-lg flex-shrink-0">
                        <span className="text-primary-600 font-bold text-xs">
                          {regime.code}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 leading-tight">
                          {regime.description}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          Código: {regime.code}
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

export default TaxRegimeDropdown;