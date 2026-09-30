import { useState, useRef, useEffect } from 'react';
import { MapPin, Loader2 } from 'lucide-react';
import { useGooglePlacesAutocomplete, type AddressComponents, type PlaceSuggestion } from '../hooks/useGooglePlacesAutocomplete';

interface AddressAutocompleteInputProps {
  value: string;
  onChange: (value: string) => void;
  onAddressSelect: (components: AddressComponents) => void;
  placeholder?: string;
  required?: boolean;
  className?: string;
}

export function AddressAutocompleteInput({
  value,
  onChange,
  onAddressSelect,
  placeholder = 'Buscar dirección...',
  required = false,
  className = '',
}: AddressAutocompleteInputProps) {
  const { isReady, isLoading, suggestions, fetchSuggestions, selectSuggestion, clearSuggestions } =
    useGooglePlacesAutocomplete();
  const [showDropdown, setShowDropdown] = useState(false);
  const [selecting, setSelecting] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
        clearSuggestions();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [clearSuggestions]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    onChange(val);
    if (isReady) {
      fetchSuggestions(val);
      setShowDropdown(val.length >= 3);
    }
  };

  const handleSelect = async (suggestion: PlaceSuggestion) => {
    setSelecting(true);
    setShowDropdown(false);
    try {
      const components = await selectSuggestion(suggestion.placeId);
      onChange(components.street || value);
      onAddressSelect(components);
    } catch {
      // Silently fail — user can still type manually
    } finally {
      setSelecting(false);
    }
  };

  const hasSuggestions = showDropdown && suggestions.length > 0;

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        {isLoading ? (
          <Loader2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 animate-spin" />
        ) : isReady ? (
          <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-green-500" />
        ) : (
          <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        )}
        <input
          type="text"
          value={value}
          onChange={handleInputChange}
          onFocus={() => {
            if (isReady && value.length >= 3) {
              fetchSuggestions(value);
              setShowDropdown(true);
            }
          }}
          required={required}
          disabled={selecting}
          placeholder={placeholder}
          className={`w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent text-base ${className}`}
          autoComplete="off"
        />
      </div>

      {hasSuggestions && (
        <ul className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {suggestions.map((s) => (
            <li key={s.placeId}>
              <button
                type="button"
                onClick={() => handleSelect(s)}
                className="w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-red-50 hover:text-red-700 transition-colors flex items-start gap-2"
              >
                <MapPin className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
                <span>{s.description}</span>
              </button>
            </li>
          ))}
          <li className="px-4 py-2 text-[10px] text-gray-400 text-right border-t">
            Powered by Google
          </li>
        </ul>
      )}
    </div>
  );
}
