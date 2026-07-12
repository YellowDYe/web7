import React from 'react';
import { Edit, Trash2, Package, Calendar, ChevronUp, ChevronDown, ChevronsUpDown, AlertTriangle, CheckCircle } from 'lucide-react';
import { IngredientWithDetails } from '../../types/ingredient';

type SortField = 'ingredient_id' | 'ingredient_name' | 'category_name' | 'ingredient_cost' | 'created_at';
type SortDirection = 'asc' | 'desc' | null;

interface IngredientListProps {
  ingredients: IngredientWithDetails[];
  onEdit: (ingredient: IngredientWithDetails) => void;
  onDelete: (ingredient: IngredientWithDetails) => void;
  loading?: boolean;
  onSort?: (field: SortField, direction: SortDirection) => void;
  sortField?: SortField | null;
  sortDirection?: SortDirection;
}

interface SortableHeaderProps {
  field: SortField;
  label: string;
  currentSortField?: SortField | null;
  currentSortDirection?: SortDirection;
  onSort: (field: SortField, direction: SortDirection) => void;
  className?: string;
}

const SortableHeader: React.FC<SortableHeaderProps> = ({
  field,
  label,
  currentSortField,
  currentSortDirection,
  onSort,
  className = ''
}) => {
  const isActive = currentSortField === field;
  
  const handleClick = () => {
    if (isActive) {
      const newDirection = currentSortDirection === 'asc' ? 'desc' : 'asc';
      onSort(field, newDirection);
    } else {
      onSort(field, 'asc');
    }
  };

  const getSortIcon = () => {
    if (!isActive) {
      return <ChevronsUpDown className="w-4 h-4 text-gray-400 group-hover:text-gray-600" />;
    }
    
    return currentSortDirection === 'asc' 
      ? <ChevronUp className="w-4 h-4 text-primary-600" />
      : <ChevronDown className="w-4 h-4 text-primary-600" />;
  };

  return (
    <button
      onClick={handleClick}
      className={`group flex items-center space-x-2 text-left font-medium text-gray-700 hover:text-gray-900 transition-colors ${className}`}
      title={`Sort by ${label}`}
      aria-label={`Sort by ${label} ${isActive ? (currentSortDirection === 'asc' ? 'descending' : 'ascending') : 'ascending'}`}
    >
      <span>{label}</span>
      {getSortIcon()}
    </button>
  );
};

const IngredientList: React.FC<IngredientListProps> = ({
  ingredients,
  onEdit,
  onDelete,
  loading = false,
  onSort,
  sortField,
  sortDirection
}) => {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'MXN'
    }).format(amount);
  };

  const handleSort = (field: SortField, direction: SortDirection) => {
    if (onSort) {
      onSort(field, direction);
    }
  };

  const showSortableHeaders = !!onSort;

  if (loading) {
    return (
      <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
        <div className="animate-pulse">
          {[...Array(5)].map((_, index) => (
            <div key={index} className="border-b border-gray-100 p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4 flex-1">
                  <div className="w-10 h-10 bg-gray-200 rounded-lg"></div>
                  <div className="flex-1">
                    <div className="h-4 bg-gray-200 rounded w-1/4 mb-2"></div>
                    <div className="h-5 bg-gray-200 rounded w-1/3 mb-2"></div>
                    <div className="h-3 bg-gray-200 rounded w-3/4"></div>
                  </div>
                </div>
                <div className="flex space-x-2">
                  <div className="w-8 h-8 bg-gray-200 rounded"></div>
                  <div className="w-8 h-8 bg-gray-200 rounded"></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (ingredients.length === 0) {
    return (
      <div className="bg-white rounded-2xl shadow-lg p-12 text-center">
        <div className="bg-gray-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
          <Package className="w-8 h-8 text-gray-400" />
        </div>
        <h3 className="text-xl font-semibold text-gray-900 mb-2">
          No se encontraron ingredientes
        </h3>
        <p className="text-gray-600">
          No hay ingredientes que coincidan con los criterios de búsqueda
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
      {/* Desktop Header - Hidden on mobile */}
      <div className="hidden lg:block bg-gray-50 border-b border-gray-200">
        <div className="px-6 py-4">
          <div className="grid grid-cols-11 gap-4 text-sm font-medium text-gray-700">
            <div className="col-span-1">
              {showSortableHeaders ? (
                <SortableHeader
                  field="ingredient_id"
                  label="ID"
                  currentSortField={sortField}
                  currentSortDirection={sortDirection}
                  onSort={handleSort}
                />
              ) : (
                'ID'
              )}
            </div>
            <div className="col-span-3">
              {showSortableHeaders ? (
                <SortableHeader
                  field="ingredient_name"
                  label="Ingrediente"
                  currentSortField={sortField}
                  currentSortDirection={sortDirection}
                  onSort={handleSort}
                />
              ) : (
                'Ingrediente'
              )}
            </div>
            <div className="col-span-2">
              {showSortableHeaders ? (
                <SortableHeader
                  field="category_name"
                  label="Categoría"
                  currentSortField={sortField}
                  currentSortDirection={sortDirection}
                  onSort={handleSort}
                />
              ) : (
                'Categoría'
              )}
            </div>
            <div className="col-span-2">
              <span>Proveedor</span>
            </div>
            <div className="col-span-2">
              {showSortableHeaders ? (
                <SortableHeader
                  field="ingredient_cost"
                  label="Costo"
                  currentSortField={sortField}
                  currentSortDirection={sortDirection}
                  onSort={handleSort}
                />
              ) : (
                'Costo'
              )}
            </div>
            <div className="col-span-1 text-right">Acciones</div>
          </div>
        </div>
      </div>

      {/* Ingredient List */}
      <div className="divide-y divide-gray-100">
        {ingredients.map((ingredient) => (
          <div
            key={ingredient.id}
            className="p-6 hover:bg-gray-50 transition-colors duration-200"
          >
            {/* Mobile Layout */}
            <div className="md:hidden">
              <div className="flex items-start justify-between">
                <div className="flex items-start space-x-2 flex-1 min-w-0">
                  <div className="bg-primary-100 p-1.5 rounded-lg flex-shrink-0">
                    <Package className="w-4 h-4 text-primary-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-base font-semibold text-gray-900 mb-1 truncate">
                      {ingredient.ingredient_name}
                    </h3>
                    <p className="text-xs text-gray-600 mb-1.5">
                      Categoría: {ingredient.category_name || 'Sin categoría'}
                    </p>
                    <p className="text-xs text-gray-600 mb-1">
                      Proveedor: {ingredient.supplier_name || 'Sin proveedor'}
                    </p>
                    <p className="text-xs font-medium text-gray-900 mb-2">
                      Costo: {formatCurrency(ingredient.ingredient_cost)}/kg
                    </p>
                    
                    {/* Restrictions */}
                    <div className="flex flex-wrap items-center gap-1.5 mb-2">
                      {ingredient.ingredient_restriction && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-800">
                          <AlertTriangle className="w-2.5 h-2.5 mr-1" />
                          Restricción
                        </span>
                      )}
                      {ingredient.ingredient_spicy && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                          🌶️ Picante
                        </span>
                      )}
                      {!ingredient.ingredient_restriction && !ingredient.ingredient_spicy && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-success-100 text-success-800">
                          <CheckCircle className="w-2.5 h-2.5 mr-1" />
                          Sin restricciones
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex space-x-1 flex-shrink-0 ml-2">
                  <button
                    onClick={() => onEdit(ingredient)}
                    className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-md transition-colors"
                    title="Editar ingrediente"
                    aria-label={`Editar ingrediente ${ingredient.ingredient_name}`}
                  >
                    <Edit className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => onDelete(ingredient)}
                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                    title="Eliminar ingrediente"
                    aria-label={`Eliminar ingrediente ${ingredient.ingredient_name}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Tablet Layout */}
            <div className="hidden md:block lg:hidden">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="bg-primary-100 p-2 rounded-lg flex-shrink-0">
                      <Package className="w-5 h-5 text-primary-600" />
                    </div>
                    <div>
                      <div className="flex items-center space-x-2 mb-1">
                        <span className="text-xs font-medium text-primary-600 bg-primary-50 px-2 py-1 rounded-full">
                          {ingredient.ingredient_id}
                        </span>
                        {ingredient.ingredient_restriction && (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                            Restricción
                          </span>
                        )}
                        {ingredient.ingredient_spicy && (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                            🌶️ Picante
                          </span>
                        )}
                      </div>
                      <h3 className="text-lg font-semibold text-gray-900">
                        {ingredient.ingredient_name}
                      </h3>
                      <p className="text-sm text-gray-600">
                        {ingredient.category_name || 'Sin categoría'}
                      </p>
                      <p className="text-sm text-gray-600">
                        {ingredient.supplier_name || 'Sin proveedor'} • {formatCurrency(ingredient.ingredient_cost)}/kg
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex space-x-2">
                    <button
                      onClick={() => onEdit(ingredient)}
                      className="p-2 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                      title="Editar ingrediente"
                      aria-label={`Editar ingrediente ${ingredient.ingredient_name}`}
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => onDelete(ingredient)}
                      className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Eliminar ingrediente"
                      aria-label={`Eliminar ingrediente ${ingredient.ingredient_name}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="hidden lg:block">
              <div className="grid grid-cols-11 gap-4 items-center">
                {/* ID Column */}
                <div className="col-span-1">
                  <span className="text-xs font-medium text-primary-600 bg-primary-50 px-2 py-1 rounded-full">
                    {ingredient.ingredient_id}
                  </span>
                </div>

                {/* Ingredient Name Column */}
                <div className="col-span-3">
                  <div className="flex items-center space-x-3">
                    <div className="bg-primary-100 p-2 rounded-lg flex-shrink-0">
                      <Package className="w-4 h-4 text-primary-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">
                        {ingredient.ingredient_name}
                      </h3>
                    </div>
                  </div>
                </div>

                {/* Category Column */}
                <div className="col-span-2">
                  <p className="text-gray-600 text-sm">
                    {ingredient.category_name || 'Sin categoría'}
                  </p>
                </div>

                {/* Supplier Column */}
                <div className="col-span-2">
                  <p className="text-gray-600 text-sm">
                    {ingredient.supplier_name || 'Sin proveedor'}
                  </p>
                </div>

                {/* Cost Column */}
                <div className="col-span-2">
                  <p className="font-medium text-gray-900">
                    {formatCurrency(ingredient.ingredient_cost)}/kg
                  </p>
                </div>

                {/* Actions Column */}
                <div className="col-span-1">
                  <div className="flex justify-end space-x-2">
                    <button
                      onClick={() => onEdit(ingredient)}
                      className="p-2 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                      title="Editar ingrediente"
                      aria-label={`Editar ingrediente ${ingredient.ingredient_name}`}
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => onDelete(ingredient)}
                      className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Eliminar ingrediente"
                      aria-label={`Eliminar ingrediente ${ingredient.ingredient_name}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default IngredientList;