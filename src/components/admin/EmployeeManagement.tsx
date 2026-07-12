import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Loader2,
  AlertCircle,
  Users
} from 'lucide-react';
import { Employee, CreateEmployeeData } from '../../types/employee';
import { employeeService } from '../../services/employeeService';
import EmployeeForm from '../employees/EmployeeForm';
import EmployeeList from '../employees/EmployeeList';
import DeleteConfirmDialog from '../employees/DeleteConfirmDialog';
import Pagination from '../ingredientCategories/Pagination';
import SearchFilter from '../ingredientCategories/SearchFilter';

type SortField = 'employee_id' | 'nombre' | 'puesto' | 'numero_empleado' | 'sueldo_neto' | 'created_at' | 'is_active';
type SortDirection = 'asc' | 'desc' | null;

const EmployeeManagement: React.FC = () => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [filteredEmployees, setFilteredEmployees] = useState<Employee[]>([]);
  const [sortedEmployees, setSortedEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [employeeToDelete, setEmployeeToDelete] = useState<Employee | null>(null);
  const [operationLoading, setOperationLoading] = useState(false);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  
  // Search state
  const [searchTerm, setSearchTerm] = useState('');

  // Sort state
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);

  useEffect(() => {
    loadEmployees();
  }, []);

  useEffect(() => {
    let filtered: Employee[];
    
    if (!searchTerm.trim()) {
      filtered = employees;
    } else {
      filtered = employees.filter(employee =>
        employee.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
        employee.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        employee.employee_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        employee.puesto.toLowerCase().includes(searchTerm.toLowerCase()) ||
        employee.numero_empleado.toString().includes(searchTerm)
      );
    }
    
    setFilteredEmployees(filtered);
    
    let sorted = [...filtered];
    if (sortField && sortDirection) {
      sorted = sortEmployees(sorted, sortField, sortDirection);
    }
    
    setSortedEmployees(sorted);
    setCurrentPage(1);
  }, [employees, searchTerm, sortField, sortDirection]);

  const sortEmployees = (
    employeesToSort: Employee[], 
    field: SortField, 
    direction: SortDirection
  ): Employee[] => {
    if (!direction) return employeesToSort;

    return [...employeesToSort].sort((a, b) => {
      let aValue: any = a[field];
      let bValue: any = b[field];

      switch (field) {
        case 'created_at':
          aValue = new Date(aValue).getTime();
          bValue = new Date(bValue).getTime();
          break;
        case 'employee_id':
          const aNum = parseInt(aValue.replace('EMP', '')) || 0;
          const bNum = parseInt(bValue.replace('EMP', '')) || 0;
          aValue = aNum;
          bValue = bNum;
          break;
        case 'numero_empleado':
        case 'sueldo_neto':
          aValue = parseFloat(aValue) || 0;
          bValue = parseFloat(bValue) || 0;
          break;
        case 'is_active':
          aValue = aValue ? 1 : 0;
          bValue = bValue ? 1 : 0;
          break;
        default:
          aValue = (aValue || '').toLowerCase();
          bValue = (bValue || '').toLowerCase();
          break;
      }

      let comparison = 0;
      if (aValue > bValue) {
        comparison = 1;
      } else if (aValue < bValue) {
        comparison = -1;
      }

      return direction === 'desc' ? comparison * -1 : comparison;
    });
  };

  const loadEmployees = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await employeeService.getEmployees();
      setEmployees(data);
    } catch (err) {
      setError('Error al cargar los empleados');
      console.error('Error loading employees:', err);
    } finally {
      setLoading(false);
    }
  };

  const totalItems = sortedEmployees.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentEmployees = sortedEmployees.slice(startIndex, endIndex);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handleItemsPerPageChange = (newItemsPerPage: number) => {
    setItemsPerPage(newItemsPerPage);
    setCurrentPage(1);
  };

  const handleSearchChange = (term: string) => {
    setSearchTerm(term);
  };

  const handleSort = (field: SortField, direction: SortDirection) => {
    setSortField(field);
    setSortDirection(direction);
    setCurrentPage(1);
  };

  const handleAddEmployee = () => {
    setEditingEmployee(null);
    setIsFormOpen(true);
  };

  const handleEditEmployee = (employee: Employee) => {
    setEditingEmployee(employee);
    setIsFormOpen(true);
  };

  const handleDeleteEmployee = (employee: Employee) => {
    setEmployeeToDelete(employee);
    setIsDeleteDialogOpen(true);
  };

  const handleFormSubmit = async (formData: CreateEmployeeData) => {
    try {
      setOperationLoading(true);
      
      if (editingEmployee) {
        await employeeService.updateEmployee(editingEmployee.id, formData);
      } else {
        await employeeService.createEmployee(formData);
      }
      
      await loadEmployees();
      setIsFormOpen(false);
      setEditingEmployee(null);
    } catch (err) {
      console.error('Error saving employee:', err);
      setError('Error al guardar el empleado');
    } finally {
      setOperationLoading(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!employeeToDelete) return;

    try {
      setOperationLoading(true);
      await employeeService.deleteEmployee(employeeToDelete.id);
      await loadEmployees();
      setIsDeleteDialogOpen(false);
      setEmployeeToDelete(null);
    } catch (err) {
      console.error('Error deleting employee:', err);
      setError('Error al eliminar el empleado');
    } finally {
      setOperationLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="bg-accent-100 p-2 rounded-lg">
            <Users className="w-6 h-6 text-accent-600" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900 font-poppins">
              Gestión de Empleados
            </h2>
            <p className="text-gray-600">
              Administra empleados, nómina y información laboral
            </p>
          </div>
        </div>
      </div>

      {/* Controls Section */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0 sm:space-x-4">
          <button
            onClick={handleAddEmployee}
            className="bg-accent-500 hover:bg-accent-600 text-white px-6 py-3 rounded-xl font-medium transition-all duration-200 transform hover:scale-105 flex items-center space-x-2 shadow-lg"
          >
            <Plus className="w-5 h-5" />
            <span>Agregar Empleado</span>
          </button>
          
          <div className="w-full sm:w-80">
            <SearchFilter
              searchTerm={searchTerm}
              onSearchChange={handleSearchChange}
              placeholder="Buscar por nombre, email, puesto..."
              loading={loading}
            />
          </div>
        </div>
        
        {!loading && (
          <div className="text-sm text-gray-600">
            {searchTerm ? (
              <>
                Mostrando {totalItems} resultado{totalItems !== 1 ? 's' : ''} 
                {totalItems !== employees.length && ` de ${employees.length} empleados`}
                {searchTerm && (
                  <span className="ml-1">
                    para "<span className="font-medium">{searchTerm}</span>"
                  </span>
                )}
              </>
            ) : (
              `Total: ${totalItems} empleado${totalItems !== 1 ? 's' : ''}`
            )}
          </div>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-center space-x-2">
          <AlertCircle className="w-5 h-5" />
          <span>{error}</span>
        </div>
      )}

      {/* Loading State */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-accent-500" />
          <span className="ml-2 text-gray-600">Cargando empleados...</span>
        </div>
      ) : (
        <>
          <EmployeeList
            employees={currentEmployees}
            onEdit={handleEditEmployee}
            onDelete={handleDeleteEmployee}
            loading={loading}
            onSort={handleSort}
            sortField={sortField}
            sortDirection={sortDirection}
          />

          {employees.length === 0 && !searchTerm && (
            <div className="bg-white rounded-2xl shadow-lg p-12 text-center">
              <button
                onClick={handleAddEmployee}
                className="bg-accent-500 hover:bg-accent-600 text-white px-6 py-3 rounded-xl font-medium transition-all duration-200 transform hover:scale-105 flex items-center space-x-2 mx-auto"
              >
                <Plus className="w-5 h-5" />
                <span>Agregar Primer Empleado</span>
              </button>
            </div>
          )}

          {totalPages > 1 && (
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={totalItems}
              itemsPerPage={itemsPerPage}
              onPageChange={handlePageChange}
              onItemsPerPageChange={handleItemsPerPageChange}
              loading={loading}
            />
          )}
        </>
      )}

      {/* Employee Form Modal */}
      <EmployeeForm
        isOpen={isFormOpen}
        onClose={() => {
          setIsFormOpen(false);
          setEditingEmployee(null);
        }}
        onSubmit={handleFormSubmit}
        editingEmployee={editingEmployee}
        loading={operationLoading}
      />

      {/* Delete Confirmation Dialog */}
      <DeleteConfirmDialog
        isOpen={isDeleteDialogOpen}
        onClose={() => {
          setIsDeleteDialogOpen(false);
          setEmployeeToDelete(null);
        }}
        onConfirm={handleConfirmDelete}
        employee={employeeToDelete}
        loading={operationLoading}
      />
    </div>
  );
};

export default EmployeeManagement;