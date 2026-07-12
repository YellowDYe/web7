import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown, X, Tag, Package, Plus } from 'lucide-react';
import { SearchableRestrictionItem, SearchableIngredient, SearchableCategory } from '../../types/customer';
import { customerService } from '../../services/customerService';
import { supabase } from '../../config/supabase';

interface RestrictionSelectorProps {
  selectedRestrictions: string[];
  onRestrictionsChange: (restrictions: string[]) => void;
  disabled?: boolean;
}

const RestrictionSelector: React.FC<RestrictionSelectorProps> = ({
  selectedRestrictions,
  onRestrictionsChange,
  disabled = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [availableItems, setAvailableItems] = useState<SearchableRestrictionItem[]>([]);
  const [restrictionNames, setRestrictionNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [hasInitialLoad, setHasInitialLoad] = useState(false);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout>();

  // Load restriction names for selected restrictions
  useEffect(() => {
    if (selectedRestrictions.length > 0) {
      loadRestrictionNames();
    }
  }, [selectedRestrictions]);

  const loadRestrictionNames = async () => {
    try {
      // Get names for all selected restrictions that we don't already have
      const missingNames = selectedRestrictions.filter(id => !restrictionNames[id]);
      
      if (missingNames.length === 0) return;

      // Try to get ingredient names first
      const { data: ingredients, error: ingredientsError } = await supabase
        .from('ingredients')
        .select('ingredient_id, ingredient_name')
        .in('ingredient_id', missingNames);

      if (ingredientsError) {
        console.error('Error loading ingredient names:', ingredientsError);
        return;
      }

      // Try to get category names for any remaining IDs
      const foundIngredientIds = (ingredients || []).map(ing => ing.ingredient_id);
      const remainingIds = missingNames.filter(id => !foundIngredientIds.includes(id));
      
      let categories: any[] = [];
      if (remainingIds.length > 0) {
        const { data: categoriesData, error: categoriesError } = await supabase
          .from('ingredient_categories')
          .select('ingredient_category_id, ingredient_category')
          .in('ingredient_category_id', remainingIds);

        if (!categoriesError) {
          categories = categoriesData || [];
        }
      }

      // Update restriction names map
      const newNames: Record<string, string> = { ...restrictionNames };
      
      (ingredients || []).forEach(ingredient => {
        newNames[ingredient.ingredient_id] = ingredient.ingredient_name;
      });
      
      categories.forEach(category => {
        newNames[category.ingredient_category_id] = category.ingredient_category;
      });
      
      setRestrictionNames(newNames);
    } catch (error) {
      console.error('Error loading restriction names:', error);
    }
  };

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

  // Load items based on search term
  const loadItems = async (term: string = '') => {
    if (loading) return;

    try {
      setLoading(true);
      const results = await customerService.searchRestrictionItems(term);
      setAvailableItems(results);
      setHasInitialLoad(true);
    } catch (error) {
      console.error('Error loading restriction items:', error);
      setAvailableItems([]);
    } finally {
      setLoading(false);
    }
  };

  // Handle input changes with debouncing
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchTerm(value);

    // Clear previous timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    // Set new timeout for debounced search
    searchTimeoutRef.current = setTimeout(() => {
      loadItems(value);
    }, 300);
  };

  // Handle dropdown toggle (for both field click and arrow click)
  const handleDropdownToggle = () => {
    if (disabled) return;

    if (!isOpen) {
      setIsOpen(true);
      // Load initial content if not already loaded
      if (!hasInitialLoad) {
        loadItems('');
      }
    } else {
      setIsOpen(false);
      setSearchTerm('');
    }
  };

  // Handle restriction field click
  const handleRestrictionFieldClick = () => {
    if (disabled) return;
    
    if (!isOpen) {
      setIsOpen(true);
      // Load initial content immediately
      loadItems('');
    }
  };

  // Handle item selection
  const handleItemSelect = (item: SearchableRestrictionItem) => {
    if (item.type === 'category') {
      // Add all ingredients from this category
      handleCategorySelect(item as SearchableCategory);
    } else {
      // Add single ingredient
      const ingredient = item as SearchableIngredient;
      if (!selectedRestrictions.includes(ingredient.ingredient_id)) {
        onRestrictionsChange([...selectedRestrictions, ingredient.ingredient_id]);
      }
    }
    
    // Close dropdown after selection
    setIsOpen(false);
    setSearchTerm('');
  };

  // Handle category selection (add all ingredients from category)
  const handleCategorySelect = async (category: SearchableCategory) => {
    try {
      const categoryIngredients = await customerService.getIngredientsByCategory(category.ingredient_category_id);
      const newRestrictions = categoryIngredients
        .map(ing => ing.ingredient_id)
        .filter(id => !selectedRestrictions.includes(id));
      
      if (newRestrictions.length > 0) {
        onRestrictionsChange([...selectedRestrictions, ...newRestrictions]);
      }
    } catch (error) {
      console.error('Error adding category ingredients:', error);
    }
  };

  // Handle restriction removal
  const handleRemoveRestriction = (restrictionId: string) => {
    onRestrictionsChange(selectedRestrictions.filter(id => id !== restrictionId));
  };

  // Get restriction name for display
  const getRestrictionName = (restrictionId: string): string => {
    // First check our restriction names cache
    if (restrictionNames[restrictionId]) {
      return restrictionNames[restrictionId];
    }
    
    // Then check available items from search
    const item = availableItems.find(item => 
      (item.type === 'ingredient' && item.ingredient_id === restrictionId) ||
      (item.type === 'category' && item.ingredient_category_id === restrictionId)
    );
    
    if (item) {
      return item.type === 'ingredient' ? item.ingredient_name : item.ingredient_category;
    }
    
    // Fallback to ID if name not found
    return restrictionId;
  };

  return (
    <div className="space-y-4">
      <div className="relative" ref={containerRef}>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Restricciones Dietéticas
        </label>
        
        {/* Input Field */}
        <div className="relative">
          <input
            type="text"
            value={searchTerm}
            onChange={handleInputChange}
            onClick={handleRestrictionFieldClick}
            placeholder="Buscar y agregar restricciones"
            className="w-full px-4 py-3 pr-10 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-all"
            disabled={disabled}
            autoComplete="off"
          />
          
          {/* Dropdown Arrow */}
          <button
            type="button"
            onClick={handleDropdownToggle}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 p-1 hover:bg-gray-100 rounded transition-colors"
            disabled={disabled}
          >
            <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {/* Dropdown Menu */}
        {isOpen && !disabled && (
          <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-xl shadow-lg max-h-80 overflow-y-auto">
            {loading ? (
              <div className="p-4 text-center">
                <div className="inline-flex items-center space-x-2">
                  <div className="w-4 h-4 border-2 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
                  <span className="text-sm text-gray-600">Cargando opciones...</span>
                </div>
              </div>
            ) : availableItems.length === 0 ? (
              <div className="p-4 text-center">
                <div className="text-gray-600">
                  <p className="font-medium mb-1">Buscar ingredientes y categorías</p>
                  <p className="text-sm">Escribe para ver opciones disponibles</p>
                </div>
              </div>
            ) : (
              <div className="py-2">
                {availableItems.map((item) => (
                  <button
                    key={`${item.type}-${item.id}`}
                    type="button"
                    onClick={() => handleItemSelect(item)}
                    className="w-full p-3 text-left hover:bg-gray-50 transition-colors focus:bg-gray-50 focus:outline-none"
                  >
                    <div className="flex items-start space-x-3">
                      <div className={`p-2 rounded-lg flex-shrink-0 ${
                        item.type === 'category' 
                          ? 'bg-secondary-100' 
                          : 'bg-primary-100'
                      }`}>
                        {item.type === 'category' ? (
                          <Tag className={`w-4 h-4 ${
                            item.type === 'category' 
                              ? 'text-secondary-600' 
                              : 'text-primary-600'
                          }`} />
                        ) : (
                          <Package className={`w-4 h-4 ${
                            item.type === 'category' 
                              ? 'text-secondary-600' 
                              : 'text-primary-600'
                          }`} />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2 mb-1">
                          <h4 className="font-medium text-gray-900 truncate">
                            {item.type === 'category' 
                              ? item.ingredient_category 
                              : item.ingredient_name}
                          </h4>
                          <span className={`text-xs font-medium px-2 py-1 rounded-full flex-shrink-0 ${
                            item.type === 'category'
                              ? 'bg-secondary-100 text-secondary-800'
                              : 'bg-primary-100 text-primary-800'
                          }`}>
                            {item.type === 'category' ? 'Categoría' : 'Ingrediente'}
                          </span>
                        </div>
                        {item.type === 'category' ? (
                          <p className="text-sm text-gray-600 truncate">
                            {item.description}
                          </p>
                        ) : (
                          <p className="text-sm text-gray-600 truncate">
                            {item.category_name}
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

      {/* Selected Restrictions */}
      {selectedRestrictions.length > 0 && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Restricciones Seleccionadas ({selectedRestrictions.length})
          </label>
          <div className="flex flex-wrap gap-2">
            {selectedRestrictions.map((restrictionId) => (
              <div
                key={restrictionId}
                className="inline-flex items-center bg-primary-100 text-primary-800 px-3 py-1 rounded-full text-sm"
              >
                <span className="mr-2">{getRestrictionName(restrictionId)}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveRestriction(restrictionId)}
                  className="text-primary-600 hover:text-primary-800 transition-colors"
                  disabled={disabled}
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default RestrictionSelector;