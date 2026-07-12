import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown, MapPin, X } from 'lucide-react';
import { DeliveryZone } from '../../types/deliveryZone';
import { deliveryZoneService } from '../../services/deliveryZoneService';

interface PostalCodeSearchDropdownProps {
  selectedPostalCode: string;
  onPostalCodeSelect: (postalCode: string, neighborhood?: string) => void;
  error?: string;
  disabled?: boolean;
  required?: boolean;
}

const PostalCodeSearchDropdown: React.FC<PostalCodeSearchDropdownProps> = ({
  selectedPostalCode,
  onPostalCodeSelect,
  error,
  disabled = false,
  required = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [deliveryZones, setDeliveryZones] = useState<DeliveryZone[]>([]);
  const [allDeliveryZones, setAllDeliveryZones] = useState<DeliveryZone[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout>();

  // Handle clicks outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchTerm('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Load all delivery zones once
  const loadAllDeliveryZones = async () => {
    if (loading || hasLoaded) return;

    try {
      setLoading(true);
      setSearchError(null);
      const results = await deliveryZoneService.getZones();
      setAllDeliveryZones(results);
      setDeliveryZones(results);
      setHasLoaded(true);
    } catch (err) {
      console.error('Error loading delivery zones:', err);
      setSearchError('Error al cargar códigos postales');
      setAllDeliveryZones([]);
      setDeliveryZones([]);
    } finally {
      setLoading(false);
    }
  };

  // Filter delivery zones based on search term
  const filterDeliveryZones = (term: string) => {
    if (!term.trim()) {
      setDeliveryZones(allDeliveryZones);
      return;
    }

    const filtered = allDeliveryZones.filter(zone =>
      zone.postal_code.toLowerCase().includes(term.toLowerCase()) ||
      (zone.neighborhood && zone.neighborhood.toLowerCase().includes(term.toLowerCase()))
    );
    setDeliveryZones(filtered);
  };

  // Handle input changes with debouncing
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchTerm(value);
    
    // Open dropdown if not already open
    if (!isOpen) {
      setIsOpen(true);
      loadAllDeliveryZones();
    }

    // Clear previous timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    // Set new timeout for debounced filtering
    searchTimeoutRef.current = setTimeout(() => {
      filterDeliveryZones(value);
    }, 200);
  };

  // Handle dropdown toggle
  const handleDropdownClick = () => {
    if (disabled) return;
    
    if (!isOpen) {
      setIsOpen(true);
      loadAllDeliveryZones();
    }
  };

  // Handle postal code selection
  const handlePostalCodeSelect = (zone: DeliveryZone) => {
    onPostalCodeSelect(zone.postal_code, zone.neighborhood || undefined);
    setIsOpen(false);
    setSearchTerm('');
  };

  // Handle clear selection
  const handleClearSelection = (e: React.MouseEvent) => {
    e.stopPropagation();
    onPostalCodeSelect('');
    setSearchTerm('');
    setIsOpen(false);
  };

  // Get display value for input
  const getDisplayValue = () => {
    if (selectedPostalCode && !isOpen) {
      return selectedPostalCode;
    }
    return searchTerm;
  };

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
      setSearchTerm('');
    }
  };

  return (
    <div className="relative" ref={containerRef}>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        Código Postal
      </label>
      
      {/* Input Field */}
      <div className="relative">
        <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5 pointer-events-none z-10" />
        
        <input
          type="text"
          value={getDisplayValue()}
          onChange={handleInputChange}
          onClick={handleDropdownClick}
          onKeyDown={handleKeyDown}
          placeholder={disabled ? 'Selección deshabilitada' : 'Buscar código postal...'}
          className={`w-full pl-10 pr-20 py-3 border rounded-xl outline-none transition-all ${
            error ? 'border-red-500 focus:ring-2 focus:ring-red-500' : 'border-gray-300 focus:ring-2 focus:ring-primary-500 focus:border-primary-500'
          } ${disabled ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'}`}
          disabled={disabled}
          autoComplete="off"
          maxLength={5}
        />
        
        {/* Clear Button */}
        {selectedPostalCode && !disabled && (
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
          onClick={handleDropdownClick}
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
          {loading ? (
            <div className="p-4 text-center">
              <div className="inline-flex items-center space-x-2">
                <div className="w-4 h-4 border-2 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
                <span className="text-sm text-gray-600">Cargando códigos postales...</span>
              </div>
            </div>
          ) : searchError ? (
            <div className="p-4 text-center">
              <p className="text-sm text-red-600">{searchError}</p>
            </div>
          ) : deliveryZones.length === 0 ? (
            <div className="p-4 text-center">
              <p className="text-sm text-gray-600">
                {searchTerm ? 'No se encontraron códigos postales' : 'No hay códigos postales disponibles'}
              </p>
              {searchTerm && (
                <p className="text-xs text-gray-500 mt-1">
                  Intenta con un código postal diferente
                </p>
              )}
            </div>
          ) : (
            <div className="py-2">
              {deliveryZones.map((zone) => (
                <button
                  key={zone.id}
                  type="button"
                  onClick={() => handlePostalCodeSelect(zone)}
                  className="w-full p-3 text-left hover:bg-gray-50 transition-colors focus:bg-gray-50 focus:outline-none"
                >
                  <div className="flex items-start space-x-3">
                    <div className="bg-primary-100 p-2 rounded-lg flex-shrink-0">
                      <MapPin className="w-4 h-4 text-primary-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2 mb-1">
                        <h4 className="font-medium text-gray-900">
                          {zone.postal_code}
                        </h4>
                        <span className="text-xs font-medium text-primary-600 bg-primary-50 px-2 py-1 rounded-full flex-shrink-0">
                          {zone.delivery_zone_id}
                        </span>
                      </div>
                      {zone.neighborhood && (
                        <p className="text-sm text-gray-600 truncate">
                          {zone.neighborhood}
                        </p>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default PostalCodeSearchDropdown;