import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Loader2,
  AlertCircle,
  Users,
  Shield,
  Mail
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { AppUserWithDetails, CreateUserData, UserRole } from '../../types/user';
import { userManagementService } from '../../services/userManagementService';
import { emailService } from '../../services/emailService';
import UserForm from './UserForm';
import UserList from './UserList';
import InviteUserForm from './InviteUserForm';
import DeleteConfirmDialog from './DeleteConfirmDialog';
import Pagination from '../ingredientCategories/Pagination';
import SearchFilter from '../ingredientCategories/SearchFilter';

type SortField = 'user_id' | 'full_name' | 'email' | 'role_name' | 'created_at' | 'is_active';
type SortDirection = 'asc' | 'desc' | null;

const UserManagement: React.FC = () => {
  const { user } = useAuth();
  const [users, setUsers] = useState<AppUserWithDetails[]>([]);
  const [roles, setRoles] = useState<UserRole[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<AppUserWithDetails[]>([]);
  const [sortedUsers, setSortedUsers] = useState<AppUserWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isUserFormOpen, setIsUserFormOpen] = useState(false);
  const [isInviteFormOpen, setIsInviteFormOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<AppUserWithDetails | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<AppUserWithDetails | null>(null);
  const [operationLoading, setOperationLoading] = useState(false);
  const [showInvitationSuccess, setShowInvitationSuccess] = useState(false);
  const [invitationEmail, setInvitationEmail] = useState('');
  const [invitationToken, setInvitationToken] = useState('');
  const [invitationCreatedSuccessfully, setInvitationCreatedSuccessfully] = useState(false);
  const [resendingUserId, setResendingUserId] = useState<string | null>(null);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  
  // Search state
  const [searchTerm, setSearchTerm] = useState('');

  // Sort state
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);

  // Load initial data
  useEffect(() => {
    loadInitialData();
  }, []);

  // Filter and sort users
  useEffect(() => {
    let filtered: AppUserWithDetails[];
    
    if (!searchTerm.trim()) {
      filtered = users;
    } else {
      filtered = users.filter(user =>
        user.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.user_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (user.role_name && user.role_name.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }
    
    setFilteredUsers(filtered);
    
    let sorted = [...filtered];
    if (sortField && sortDirection) {
      sorted = sortUsers(sorted, sortField, sortDirection);
    }
    
    setSortedUsers(sorted);
    setCurrentPage(1);
  }, [users, searchTerm, sortField, sortDirection]);

  const sortUsers = (
    usersToSort: AppUserWithDetails[], 
    field: SortField, 
    direction: SortDirection
  ): AppUserWithDetails[] => {
    if (!direction) return usersToSort;

    return [...usersToSort].sort((a, b) => {
      let aValue: any = a[field];
      let bValue: any = b[field];

      switch (field) {
        case 'created_at':
          aValue = new Date(aValue).getTime();
          bValue = new Date(bValue).getTime();
          break;
        case 'user_id':
          const aNum = parseInt(aValue.replace('USR', '')) || 0;
          const bNum = parseInt(bValue.replace('USR', '')) || 0;
          aValue = aNum;
          bValue = bNum;
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
      const [usersData, rolesData] = await Promise.all([
        userManagementService.getUsers(),
        userManagementService.getRoles()
      ]);
      setUsers(usersData);
      setRoles(rolesData);
    } catch (err) {
      setError('Error al cargar los datos');
      console.error('Error loading initial data:', err);
    } finally {
      setLoading(false);
    }
  };

  // Calculate pagination
  const totalItems = sortedUsers.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentUsers = sortedUsers.slice(startIndex, endIndex);

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

  const handleAddUser = () => {
    setEditingUser(null);
    setIsUserFormOpen(true);
  };

  const handleInviteUser = () => {
    setIsInviteFormOpen(true);
  };

  const handleEditUser = (user: AppUserWithDetails) => {
    setEditingUser(user);
    setIsUserFormOpen(true);
  };

  const handleDeleteUser = (user: AppUserWithDetails) => {
    setUserToDelete(user);
    setIsDeleteDialogOpen(true);
  };

  const handleUserFormSubmit = async (formData: CreateUserData) => {
    try {
      setOperationLoading(true);
      
      if (editingUser) {
        await userManagementService.updateUser(editingUser.id, formData);
      } else {
        await userManagementService.createUser(formData);
      }
      
      await loadInitialData();
      setIsUserFormOpen(false);
      setEditingUser(null);
    } catch (err) {
      console.error('Error saving user:', err);
      setError('Error al guardar el usuario');
    } finally {
      setOperationLoading(false);
    }
  };

  const handleInviteSubmit = async (invitationData: { email: string; role_id: string }) => {
    try {
      setOperationLoading(true);
      setError(null);

      if (!user?.id) {
        setError('No se pudo identificar el usuario actual');
        return;
      }

      console.log('Creating invitation for:', invitationData.email);

      // Ensure the current Firebase user exists in app_users table
      const appUserId = await userManagementService.ensureAppUserExists({
        uid: user.id,
        email: user.email || '',
        displayName: user.name
      });

      console.log('App user ID:', appUserId);

      // Create invitation
      const invitation = await userManagementService.createInvitation(
        invitationData,
        appUserId
      );

      console.log('Invitation created:', invitation.invitation_id);
      console.log('User created with temporary password');

      // Store invitation data for display
      setInvitationEmail(invitationData.email);
      setInvitationToken(invitation.temp_password);
      setInvitationCreatedSuccessfully(true);

      // Try to send email (optional if Mailgun not configured)
      let emailSent = false;
      try {
        const role = roles.find(r => r.role_id === invitationData.role_id);
        await emailService.sendCredentialsEmail(
          invitationData.email,
          user.name || 'Admin',
          role?.role_name || 'Usuario',
          invitation.temp_password
        );

        console.log('Invitation email sent successfully');
        emailSent = true;

        // Clear email service cache to ensure fresh config on next send
        emailService.clearConfigCache();
      } catch (emailError) {
        console.error('Email sending failed:', emailError);
        // Show warning but don't fail the invitation creation
        const errorMsg = emailError instanceof Error ? emailError.message : 'Error desconocido';
        console.warn('Email could not be sent:', errorMsg);
        // Don't set error here, we'll show it in the success message
      }

      // Keep the form open to show the invitation link
      // Don't close it automatically
      setShowInvitationSuccess(true);

    } catch (err) {
      console.error('Error creating invitation:', err);
      const errorMessage = err instanceof Error ? err.message : 'Error desconocido';
      setError(`Error al crear la invitación: ${errorMessage}`);
      setInvitationCreatedSuccessfully(false);
    } finally {
      setOperationLoading(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!userToDelete) return;

    try {
      setOperationLoading(true);
      await userManagementService.deleteUser(userToDelete.id);
      await loadInitialData();
      setIsDeleteDialogOpen(false);
      setUserToDelete(null);
    } catch (err) {
      console.error('Error deleting user:', err);
      setError('Error al eliminar el usuario');
    } finally {
      setOperationLoading(false);
    }
  };

  const handleResendCredentials = async (targetUser: AppUserWithDetails) => {
    try {
      setResendingUserId(targetUser.id);
      setError(null);

      console.log('Resending credentials for user:', targetUser.email);

      // Reset password and get new temp password
      const result = await userManagementService.resendCredentials(targetUser.id);

      if (!result.success) {
        throw new Error('Error al generar nuevas credenciales');
      }

      console.log('New temporary password generated');

      // Try to send email
      try {
        await emailService.sendCredentialsEmail(
          result.email,
          user?.name || 'Admin',
          targetUser.role_name || 'Usuario',
          result.tempPassword
        );

        console.log('Credentials email sent successfully');

        // Show success message
        alert(`Credenciales reenviadas exitosamente a ${result.email}\n\nSi el email no llega, la contraseña temporal es:\n${result.tempPassword}`);
      } catch (emailError) {
        console.error('Email sending failed:', emailError);
        // Show the temp password if email fails
        alert(`Usuario actualizado pero el email no pudo enviarse.\n\nPor favor, comparte esta contraseña temporal con el usuario:\n${result.tempPassword}\n\nEmail: ${result.email}`);
      }

    } catch (err) {
      console.error('Error resending credentials:', err);
      const errorMessage = err instanceof Error ? err.message : 'Error desconocido';
      setError(`Error al reenviar credenciales: ${errorMessage}`);
    } finally {
      setResendingUserId(null);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="bg-primary-100 p-2 rounded-lg">
            <Users className="w-6 h-6 text-primary-600" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900 font-poppins">
              Gestión de Usuarios
            </h2>
            <p className="text-gray-600">
              Administra usuarios, roles y permisos del sistema
            </p>
          </div>
        </div>
      </div>

      {/* Controls Section */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0 sm:space-x-4">
          <div className="flex space-x-3">
            <button
              onClick={handleAddUser}
              className="bg-primary-500 hover:bg-primary-600 text-white px-6 py-3 rounded-xl font-medium transition-all duration-200 transform hover:scale-105 flex items-center space-x-2 shadow-lg"
            >
              <Plus className="w-5 h-5" />
              <span>Agregar Usuario</span>
            </button>
            
            <button
              onClick={handleInviteUser}
              className="bg-secondary-500 hover:bg-secondary-600 text-white px-6 py-3 rounded-xl font-medium transition-all duration-200 transform hover:scale-105 flex items-center space-x-2 shadow-lg"
            >
              <Mail className="w-5 h-5" />
              <span>Invitar Usuario</span>
            </button>
          </div>
          
          <div className="w-full sm:w-80">
            <SearchFilter
              searchTerm={searchTerm}
              onSearchChange={handleSearchChange}
              placeholder="Buscar por nombre, email, ID..."
              loading={loading}
            />
          </div>
        </div>
        
        {!loading && (
          <div className="text-sm text-gray-600">
            {searchTerm ? (
              <>
                Mostrando {totalItems} resultado{totalItems !== 1 ? 's' : ''} 
                {totalItems !== users.length && ` de ${users.length} usuarios`}
                {searchTerm && (
                  <span className="ml-1">
                    para "<span className="font-medium">{searchTerm}</span>"
                  </span>
                )}
              </>
            ) : (
              `Total: ${totalItems} usuario${totalItems !== 1 ? 's' : ''}`
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
          <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
          <span className="ml-2 text-gray-600">Cargando usuarios...</span>
        </div>
      ) : (
        <>
          {/* User List */}
          <UserList
            users={currentUsers}
            onEdit={handleEditUser}
            onDelete={handleDeleteUser}
            onResendCredentials={handleResendCredentials}
            loading={loading}
            onSort={handleSort}
            sortField={sortField}
            sortDirection={sortDirection}
            resendingUserId={resendingUserId}
          />

          {/* No Results State */}
          {users.length === 0 && !searchTerm && (
            <div className="bg-white rounded-2xl shadow-lg p-12 text-center">
              <div className="flex space-x-4 justify-center">
                <button
                  onClick={handleAddUser}
                  className="bg-primary-500 hover:bg-primary-600 text-white px-6 py-3 rounded-xl font-medium transition-all duration-200 transform hover:scale-105 flex items-center space-x-2"
                >
                  <Plus className="w-5 h-5" />
                  <span>Agregar Primer Usuario</span>
                </button>
                <button
                  onClick={handleInviteUser}
                  className="bg-secondary-500 hover:bg-secondary-600 text-white px-6 py-3 rounded-xl font-medium transition-all duration-200 transform hover:scale-105 flex items-center space-x-2"
                >
                  <Mail className="w-5 h-5" />
                  <span>Invitar Usuario</span>
                </button>
              </div>
            </div>
          )}

          {/* Pagination */}
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

      {/* User Form Modal */}
      <UserForm
        isOpen={isUserFormOpen}
        onClose={() => {
          setIsUserFormOpen(false);
          setEditingUser(null);
        }}
        onSubmit={handleUserFormSubmit}
        editingUser={editingUser}
        roles={roles}
        loading={operationLoading}
      />

      {/* Invite User Modal */}
      <InviteUserForm
        isOpen={isInviteFormOpen}
        onClose={() => {
          setIsInviteFormOpen(false);
          setInvitationCreatedSuccessfully(false);
          setInvitationToken('');
          setShowInvitationSuccess(false);
        }}
        onSubmit={handleInviteSubmit}
        roles={roles}
        loading={operationLoading}
        invitationToken={invitationToken}
        showSuccessMessage={invitationCreatedSuccessfully}
      />

      {/* Delete Confirmation Dialog */}
      <DeleteConfirmDialog
        isOpen={isDeleteDialogOpen}
        onClose={() => {
          setIsDeleteDialogOpen(false);
          setUserToDelete(null);
        }}
        onConfirm={handleConfirmDelete}
        user={userToDelete}
        loading={operationLoading}
      />

      {/* Invitation Success Popup */}
      {showInvitationSuccess && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="p-6">
              <div className="text-center">
                <div className="bg-success-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Mail className="w-8 h-8 text-success-600" />
                </div>
                <h2 className="text-xl font-semibold text-gray-900 mb-2">
                  ¡Usuario Creado Exitosamente!
                </h2>
                <p className="text-gray-600 mb-4">
                  Se ha creado la cuenta y enviado las credenciales a:
                </p>
                <p className="font-medium text-gray-900 mb-6">
                  {invitationEmail}
                </p>

                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4 text-left">
                  <p className="text-amber-800 text-sm font-semibold mb-2">
                    🔑 Contraseña Temporal
                  </p>
                  <div className="bg-white border border-amber-300 rounded-lg p-3">
                    <code className="text-red-600 font-mono text-base font-bold break-all">
                      {invitationToken}
                    </code>
                  </div>
                  <p className="text-amber-700 text-xs mt-2">
                    Esta contraseña fue enviada por email al usuario.
                  </p>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6 text-left">
                  <p className="text-blue-800 text-sm">
                    <strong>Próximos pasos:</strong>
                  </p>
                  <ul className="text-blue-700 text-sm mt-2 space-y-1">
                    <li>• El usuario recibirá un email con sus credenciales</li>
                    <li>• Debe iniciar sesión con su correo y la contraseña temporal</li>
                    <li>• El sistema le pedirá cambiar su contraseña al primer login</li>
                    <li>• También puede usar Google para iniciar sesión</li>
                  </ul>
                </div>
                <button
                  onClick={() => setShowInvitationSuccess(false)}
                  className="bg-primary-500 hover:bg-primary-600 text-white px-6 py-3 rounded-xl font-medium transition-colors"
                >
                  Entendido
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagement;