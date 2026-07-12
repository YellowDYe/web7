import React from 'react';
import { Edit, Trash2, User, Mail, Building, ChevronUp, ChevronDown, ChevronsUpDown, DollarSign } from 'lucide-react';
import { Employee } from '../../types/employee';

type SortField = 'employee_id' | 'nombre' | 'puesto' | 'numero_empleado' | 'sueldo_neto' | 'created_at' | 'is_active';
type SortDirection = 'asc' | 'desc' | null;

interface EmployeeListProps {
  employees: Employee[];
  onEdit: (employee: Employee) => void;
  onDelete: (employee: Employee) => void;
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
      ? <ChevronUp className="w-4 h-4 text-accent-600" />
      : <ChevronDown className="w-4 h-4 text-accent-600" />;
  };

  return (
    <button
      onClick={handleClick}
      className={`group flex items-center space-x-2 text-left font-medium text-gray-700 hover:text-gray-900 transition-colors ${className}`}
      title={`Sort by ${label}`}
    >
      <span>{label}</span>
      {getSortIcon()}
    </button>
  );
};

const EmployeeList: React.FC<EmployeeListProps> = ({
  employees,
  onEdit,
  onDelete,
  loading = false,
  onSort,
  sortField,
  sortDirection
}) => {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN'
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
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

  if (employees.length === 0) {
    return (
      <div className="bg-white rounded-2xl shadow-lg p-12 text-center">
        <div className="bg-gray-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
          <User className="w-8 h-8 text-gray-400" />
        </div>
        <h3 className="text-xl font-semibold text-gray-900 mb-2">
          No se encontraron empleados
        </h3>
        <p className="text-gray-600">
          No hay empleados que coincidan con los criterios de búsqueda
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
      {/* Desktop Header */}
      <div className="hidden lg:block bg-gray-50 border-b border-gray-200">
        <div className="px-6 py-4">
          <div className="grid grid-cols-12 gap-4 text-sm font-medium text-gray-700">
            <div className="col-span-1">
              {showSortableHeaders ? (
                <SortableHeader
                  field="employee_id"
                  label="ID"
                  currentSortField={sortField}
                  currentSortDirection={sortDirection}
                  onSort={handleSort}
                />
              ) : (
                'ID'
              )}
            </div>
            <div className="col-span-1">
              {showSortableHeaders ? (
                <SortableHeader
                  field="numero_empleado"
                  label="No."
                  currentSortField={sortField}
                  currentSortDirection={sortDirection}
                  onSort={handleSort}
                />
              ) : (
                'No.'
              )}
            </div>
            <div className="col-span-3">
              {showSortableHeaders ? (
                <SortableHeader
                  field="nombre"
                  label="Empleado"
                  currentSortField={sortField}
                  currentSortDirection={sortDirection}
                  onSort={handleSort}
                />
              ) : (
                'Empleado'
              )}
            </div>
            <div className="col-span-2">
              {showSortableHeaders ? (
                <SortableHeader
                  field="puesto"
                  label="Puesto"
                  currentSortField={sortField}
                  currentSortDirection={sortDirection}
                  onSort={handleSort}
                />
              ) : (
                'Puesto'
              )}
            </div>
            <div className="col-span-2">
              {showSortableHeaders ? (
                <SortableHeader
                  field="sueldo_neto"
                  label="Sueldo Neto"
                  currentSortField={sortField}
                  currentSortDirection={sortDirection}
                  onSort={handleSort}
                />
              ) : (
                'Sueldo Neto'
              )}
            </div>
            <div className="col-span-1">
              {showSortableHeaders ? (
                <SortableHeader
                  field="is_active"
                  label="Estado"
                  currentSortField={sortField}
                  currentSortDirection={sortDirection}
                  onSort={handleSort}
                />
              ) : (
                'Estado'
              )}
            </div>
            <div className="col-span-2 text-right">Acciones</div>
          </div>
        </div>
      </div>

      {/* Employee List */}
      <div className="divide-y divide-gray-100">
        {employees.map((employee) => (
          <div
            key={employee.id}
            className="p-6 hover:bg-gray-50 transition-colors duration-200"
          >
            {/* Mobile Layout */}
            <div className="lg:hidden">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <div className="bg-accent-100 p-2 rounded-lg flex-shrink-0">
                    <User className="w-4 h-4 text-accent-600" />
                  </div>
                  <div>
                    <span className="text-xs font-medium text-accent-600 bg-accent-50 px-2 py-1 rounded-full">
                      {employee.employee_id}
                    </span>
                    <div className="flex items-center mt-1 space-x-2">
                      <span className="text-xs font-medium text-gray-600 bg-gray-100 px-2 py-1 rounded-full">
                        #{employee.numero_empleado}
                      </span>
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                        employee.is_active 
                          ? 'bg-success-100 text-success-800' 
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {employee.is_active ? 'Activo' : 'Inactivo'}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => onEdit(employee)}
                    className="p-2 text-gray-400 hover:text-accent-600 hover:bg-accent-50 rounded-lg transition-colors"
                    title="Editar empleado"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => onDelete(employee)}
                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Eliminar empleado"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              
              <div className="mb-3">
                <h3 className="text-lg font-semibold text-gray-900 mb-1">
                  {employee.nombre}
                </h3>
                <div className="flex items-center text-sm text-gray-600 mb-1">
                  <Building className="w-3 h-3 mr-1" />
                  <span>{employee.puesto}</span>
                </div>
                <div className="flex items-center text-sm text-gray-600 mb-2">
                  <Mail className="w-3 h-3 mr-1" />
                  <span>{employee.email}</span>
                </div>
                <div className="flex items-center text-sm text-gray-900">
                  <DollarSign className="w-3 h-3 mr-1" />
                  <span className="font-medium">{formatCurrency(employee.sueldo_neto)}</span>
                </div>
              </div>
            </div>

            {/* Desktop Layout */}
            <div className="hidden lg:block">
              <div className="grid grid-cols-12 gap-4 items-center">
                <div className="col-span-1">
                  <span className="text-xs font-medium text-accent-600 bg-accent-50 px-2 py-1 rounded-full">
                    {employee.employee_id}
                  </span>
                </div>

                <div className="col-span-1">
                  <span className="text-sm font-medium text-gray-900">
                    #{employee.numero_empleado}
                  </span>
                </div>

                <div className="col-span-3">
                  <div className="flex items-center space-x-3">
                    <div className="bg-accent-100 p-2 rounded-lg flex-shrink-0">
                      <User className="w-4 h-4 text-accent-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">
                        {employee.nombre}
                      </h3>
                      <div className="flex items-center text-sm text-gray-600">
                        <Mail className="w-3 h-3 mr-1" />
                        <span>{employee.email}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="col-span-2">
                  <div className="flex items-center text-sm text-gray-600">
                    <Building className="w-4 h-4 mr-2" />
                    <span>{employee.puesto}</span>
                  </div>
                </div>

                <div className="col-span-2">
                  <div className="flex items-center text-sm text-gray-900">
                    <DollarSign className="w-4 h-4 mr-1 text-success-600" />
                    <span className="font-semibold">{formatCurrency(employee.sueldo_neto)}</span>
                  </div>
                </div>

                <div className="col-span-1">
                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                    employee.is_active 
                      ? 'bg-success-100 text-success-800' 
                      : 'bg-gray-100 text-gray-800'
                  }`}>
                    {employee.is_active ? 'Activo' : 'Inactivo'}
                  </span>
                </div>

                <div className="col-span-2">
                  <div className="flex justify-end space-x-2">
                    <button
                      onClick={() => onEdit(employee)}
                      className="p-2 text-gray-400 hover:text-accent-600 hover:bg-accent-50 rounded-lg transition-colors"
                      title="Editar empleado"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => onDelete(employee)}
                      className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Eliminar empleado"
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

export default EmployeeList;