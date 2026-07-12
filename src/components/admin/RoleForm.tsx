import React, { useState, useEffect } from 'react';
import { X, Save, Loader2, Shield, Check } from 'lucide-react';
import { UserRoleWithDetails, CreateRoleData, Permission } from '../../types/user';

interface RoleFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CreateRoleData) => Promise<void>;
  editingRole?: UserRoleWithDetails | null;
  permissions: Permission[];
  loading?: boolean;
}

const RoleForm: React.FC<RoleFormProps> = ({
  isOpen,
  onClose,
  onSubmit,
  editingRole,
  permissions,
  loading = false
}) => {
  const [formData, setFormData] = useState<CreateRoleData>({
    role_name: '',
    role_description: '',
    is_active: true,
    permission_ids: []
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (isOpen) {
      if (editingRole) {
        setFormData({
          role_name: editingRole.role_name,
          role_description: editingRole.role_description,
          is_active: editingRole.is_active,
          permission_ids: editingRole.permissions?.map(p => p.permission_id) || []
        });
      } else {
        setFormData({
          role_name: '',
          role_description: '',
          is_active: true,
          permission_ids: []
        });
      }
      setErrors({});
    }
  }, [isOpen, editingRole]);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.role_name.trim()) {
      newErrors.role_name = 'El nombre del rol es requerido';
    }

    if (!formData.role_description.trim()) {
      newErrors.role_description = 'La descripción es requerida';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    try {
      await onSubmit(formData);
      onClose();
    } catch (error) {
      console.error('Error submitting form:', error);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;
    
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
    
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const handlePermissionToggle = (permissionId: string) => {
    setFormData(prev => ({
      ...prev,
      permission_ids: prev.permission_ids?.includes(permissionId)
        ? prev.permission_ids.filter(id => id !== permissionId)
        : [...(prev.permission_ids || []), permissionId]
    }));
  };

  const groupedPermissions = permissions.reduce((acc, permission) => {
    const category = permission.permission_category;
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(permission);
    return acc;
  }, {} as Record<string, Permission[]>);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900 font-poppins">
            {editingRole ? 'Editar Rol' : 'Agregar Rol'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            aria-label="Cerrar modal"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Role Name */}
          <div>
            <label htmlFor="role_name" className="block text-sm font-medium text-gray-700 mb-2">
              Nombre del Rol *
            </label>
            <div className="relative">
              <Shield className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                id="role_name"
                name="role_name"
                value={formData.role_name}
                onChange={handleChange}
                className={`w-full pl-10 pr-4 py-3 border rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-all ${
                  errors.role_name ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="Ej: Supervisor, Coordinador"
                disabled={loading}
              />
            </div>
            {errors.role_name && (
              <p className="mt-1 text-sm text-red-600">{errors.role_name}</p>
            )}
          </div>

          {/* Description */}
          <div>
            <label htmlFor="role_description" className="block text-sm font-medium text-gray-700 mb-2">
              Descripción *
            </label>
            <textarea
              id="role_description"
              name="role_description"
              value={formData.role_description}
              onChange={handleChange}
              rows={3}
              className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-all resize-none ${
                errors.role_description ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="Describe las responsabilidades de este rol"
              disabled={loading}
            />
            {errors.role_description && (
              <p className="mt-1 text-sm text-red-600">{errors.role_description}</p>
            )}
          </div>

          {/* Permissions */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-4">
              Permisos
            </label>
            <div className="space-y-4 max-h-64 overflow-y-auto border border-gray-200 rounded-xl p-4">
              {Object.entries(groupedPermissions).map(([category, categoryPermissions]) => (
                <div key={category} className="space-y-2">
                  <h4 className="text-sm font-medium text-gray-900 capitalize">
                    {category.replace('_', ' ')}
                  </h4>
                  <div className="space-y-2 ml-4">
                    {categoryPermissions.map((permission) => (
                      <label
                        key={permission.id}
                        className="flex items-center space-x-3 cursor-pointer hover:bg-gray-50 p-2 rounded-lg transition-colors"
                      >
                        <div className="relative">
                          <input
                            type="checkbox"
                            checked={formData.permission_ids?.includes(permission.permission_id) || false}
                            onChange={() => handlePermissionToggle(permission.permission_id)}
                            className="sr-only"
                            disabled={loading}
                          />
                          <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                            formData.permission_ids?.includes(permission.permission_id)
                              ? 'bg-primary-500 border-primary-500'
                              : 'border-gray-300 bg-white'
                          }`}>
                            {formData.permission_ids?.includes(permission.permission_id) && (
                              <Check className="w-3 h-3 text-white" />
                            )}
                          </div>
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-900">
                            {permission.permission_name}
                          </p>
                          <p className="text-xs text-gray-600">
                            {permission.permission_description}
                          </p>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Active Status */}
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
            <div>
              <label htmlFor="is_active" className="text-sm font-medium text-gray-700">
                Rol activo
              </label>
              <p className="text-xs text-gray-500 mt-1">
                Los roles inactivos no pueden ser asignados a usuarios
              </p>
            </div>
            <button
              type="button"
              id="is_active"
              onClick={() => setFormData(prev => ({ ...prev, is_active: !prev.is_active }))}
              disabled={loading}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${
                formData.is_active ? 'bg-primary-600' : 'bg-gray-300'
              }`}
              aria-pressed={formData.is_active}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  formData.is_active ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* Form Actions */}
          <div className="flex space-x-4 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors font-medium"
              disabled={loading}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-secondary-500 hover:bg-secondary-600 text-white px-6 py-3 rounded-xl transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Guardando...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  {editingRole ? 'Actualizar' : 'Crear'} Rol
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default RoleForm;