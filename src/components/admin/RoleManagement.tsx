import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Loader2,
  AlertCircle,
  Shield
} from 'lucide-react';
import { UserRoleWithDetails, CreateRoleData, Permission } from '../../types/user';
import { userManagementService } from '../../services/userManagementService';
import RoleForm from './RoleForm';
import RoleList from './RoleList';
import DeleteRoleConfirmDialog from './DeleteRoleConfirmDialog';
import Pagination from '../ingredientCategories/Pagination';
import SearchFilter from '../ingredientCategories/SearchFilter';

type SortField = 'role_id' | 'role_name' | 'created_at' | 'is_active';
type SortDirection = 'asc' | 'desc' | null;

const RoleManagement: React.FC = () => {
  const [roles, setRoles] = useState<UserRoleWithDetails[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [filteredRoles, setFilteredRoles] = useState<UserRoleWithDetails[]>([]);
  const [sortedRoles, setSortedRoles] = useState<UserRoleWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<UserRoleWithDetails | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [roleToDelete, setRoleToDelete] = useState<UserRoleWithDetails | null>(null);
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
    loadInitialData();
  }, []);

  useEffect(() => {
    let filtered: UserRoleWithDetails[];
    
    if (!searchTerm.trim()) {
      filtered = roles;
    } else {
      filtered = roles.filter(role =>
        role.role_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        role.role_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        role.role_description.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    setFilteredRoles(filtered);
    
    let sorted = [...filtered];
    if (sortField && sortDirection) {
      sorted = sortRoles(sorted, sortField, sortDirection);
    }
    
    setSortedRoles(sorted);
    setCurrentPage(1);
  }, [roles, searchTerm, sortField, sortDirection]);

  const sortRoles = (
    rolesToSort: UserRoleWithDetails[], 
    field: SortField, 
    direction: SortDirection
  ): UserRoleWithDetails[] => {
    if (!direction) return rolesToSort;

    return [...rolesToSort].sort((a, b) => {
      let aValue: any = a[field];
      let bValue: any = b[field];

      switch (field) {
        case 'created_at':
          aValue = new Date(aValue).getTime();
          bValue = new Date(bValue).getTime();
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

  const loadInitialData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [rolesData, permissionsData] = await Promise.all([
        userManagementService.getRoles(),
        userManagementService.getPermissions()
      ]);
      setRoles(rolesData);
      setPermissions(permissionsData);
    } catch (err) {
      setError('Error al cargar los datos');
      console.error('Error loading initial data:', err);
    } finally {
      setLoading(false);
    }
  };

  const totalItems = sortedRoles.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentRoles = sortedRoles.slice(startIndex, endIndex);

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

  const handleAddRole = () => {
    setEditingRole(null);
    setIsFormOpen(true);
  };

  const handleEditRole = (role: UserRoleWithDetails) => {
    setEditingRole(role);
    setIsFormOpen(true);
  };

  const handleDeleteRole = (role: UserRoleWithDetails) => {
    setRoleToDelete(role);
    setIsDeleteDialogOpen(true);
  };

  const handleFormSubmit = async (formData: CreateRoleData) => {
    try {
      setOperationLoading(true);
      
      if (editingRole) {
        await userManagementService.updateRole(editingRole.id, formData);
      } else {
        await userManagementService.createRole(formData);
      }
      
      await loadInitialData();
      setIsFormOpen(false);
      setEditingRole(null);
    } catch (err) {
      console.error('Error saving role:', err);
      setError('Error al guardar el rol');
    } finally {
      setOperationLoading(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!roleToDelete) return;

    try {
      setOperationLoading(true);
      await userManagementService.deleteRole(roleToDelete.id);
      await loadInitialData();
      setIsDeleteDialogOpen(false);
      setRoleToDelete(null);
    } catch (err) {
      console.error('Error deleting role:', err);
      setError('Error al eliminar el rol');
    } finally {
      setOperationLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="bg-secondary-100 p-2 rounded-lg">
            <Shield className="w-6 h-6 text-secondary-600" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900 font-poppins">
              Gestión de Roles
            </h2>
            <p className="text-gray-600">
              Administra roles y permisos del sistema
            </p>
          </div>
        </div>
      </div>

      {/* Controls Section */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0 sm:space-x-4">
          <button
            onClick={handleAddRole}
            className="bg-secondary-500 hover:bg-secondary-600 text-white px-6 py-3 rounded-xl font-medium transition-all duration-200 transform hover:scale-105 flex items-center space-x-2 shadow-lg"
          >
            <Plus className="w-5 h-5" />
            <span>Agregar Rol</span>
          </button>
          
          <div className="w-full sm:w-80">
            <SearchFilter
              searchTerm={searchTerm}
              onSearchChange={handleSearchChange}
              placeholder="Buscar roles..."
              loading={loading}
            />
          </div>
        </div>
        
        {!loading && (
          <div className="text-sm text-gray-600">
            Total: {totalItems} rol{totalItems !== 1 ? 'es' : ''}
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
          <Loader2 className="w-8 h-8 animate-spin text-secondary-500" />
          <span className="ml-2 text-gray-600">Cargando roles...</span>
        </div>
      ) : (
        <>
          <RoleList
            roles={currentRoles}
            onEdit={handleEditRole}
            onDelete={handleDeleteRole}
            loading={loading}
            onSort={handleSort}
            sortField={sortField}
            sortDirection={sortDirection}
          />

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

      {/* Role Form Modal */}
      <RoleForm
        isOpen={isFormOpen}
        onClose={() => {
          setIsFormOpen(false);
          setEditingRole(null);
        }}
        onSubmit={handleFormSubmit}
        editingRole={editingRole}
        permissions={permissions}
        loading={operationLoading}
      />

      {/* Delete Confirmation Dialog */}
      <DeleteRoleConfirmDialog
        isOpen={isDeleteDialogOpen}
        onClose={() => {
          setIsDeleteDialogOpen(false);
          setRoleToDelete(null);
        }}
        onConfirm={handleConfirmDelete}
        role={roleToDelete}
        loading={operationLoading}
      />
    </div>
  );
};

export default RoleManagement;