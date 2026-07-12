import React, { useState, useEffect } from 'react';
import { X, Save, Loader2, User, Mail, Shield } from 'lucide-react';
import { AppUserWithDetails, CreateUserData, UserRole } from '../../types/user';

interface UserFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CreateUserData) => Promise<void>;
  editingUser?: AppUserWithDetails | null;
  roles: UserRole[];
  loading?: boolean;
}

const UserForm: React.FC<UserFormProps> = ({
  isOpen,
  onClose,
  onSubmit,
  editingUser,
  roles,
  loading = false
}) => {
  const [formData, setFormData] = useState<CreateUserData>({
    email: '',
    full_name: '',
    role_id: '',
    is_active: true
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (isOpen) {
      if (editingUser) {
        setFormData({
          email: editingUser.email,
          full_name: editingUser.full_name,
          role_id: editingUser.role_id,
          is_active: editingUser.is_active
        });
      } else {
        setFormData({
          email: '',
          full_name: '',
          role_id: '',
          is_active: true
        });
      }
      setErrors({});
    }
  }, [isOpen, editingUser]);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.email.trim()) {
      newErrors.email = 'El email es requerido';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'El formato del email no es válido';
    }

    if (!formData.full_name.trim()) {
      newErrors.full_name = 'El nombre completo es requerido';
    }

    if (!formData.role_id) {
      newErrors.role_id = 'El rol es requerido';
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

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900 font-poppins">
            {editingUser ? 'Editar Usuario' : 'Agregar Usuario'}
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
          {/* Full Name */}
          <div>
            <label htmlFor="full_name" className="block text-sm font-medium text-gray-700 mb-2">
              Nombre Completo *
            </label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                id="full_name"
                name="full_name"
                value={formData.full_name}
                onChange={handleChange}
                className={`w-full pl-10 pr-4 py-3 border rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-all ${
                  errors.full_name ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="Nombre completo del usuario"
                disabled={loading}
              />
            </div>
            {errors.full_name && (
              <p className="mt-1 text-sm text-red-600">{errors.full_name}</p>
            )}
          </div>

          {/* Email */}
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
              Email *
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                className={`w-full pl-10 pr-4 py-3 border rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-all ${
                  errors.email ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="usuario@email.com"
                disabled={loading}
              />
            </div>
            {errors.email && (
              <p className="mt-1 text-sm text-red-600">{errors.email}</p>
            )}
          </div>

          {/* Role */}
          <div>
            <label htmlFor="role_id" className="block text-sm font-medium text-gray-700 mb-2">
              Rol *
            </label>
            <div className="relative">
              <Shield className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <select
                id="role_id"
                name="role_id"
                value={formData.role_id}
                onChange={handleChange}
                className={`w-full pl-10 pr-4 py-3 border rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-all ${
                  errors.role_id ? 'border-red-500' : 'border-gray-300'
                }`}
                disabled={loading}
              >
                <option value="">Seleccionar rol</option>
                {roles.filter(role => role.is_active).map((role) => (
                  <option key={role.id} value={role.role_id}>
                    {role.role_name} - {role.role_description}
                  </option>
                ))}
              </select>
            </div>
            {errors.role_id && (
              <p className="mt-1 text-sm text-red-600">{errors.role_id}</p>
            )}
          </div>

          {/* Active Status */}
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
            <div>
              <label htmlFor="is_active" className="text-sm font-medium text-gray-700">
                Usuario activo
              </label>
              <p className="text-xs text-gray-500 mt-1">
                Los usuarios inactivos no pueden acceder al sistema
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
              className="flex-1 bg-primary-500 hover:bg-primary-600 text-white px-6 py-3 rounded-xl transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Guardando...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  {editingUser ? 'Actualizar' : 'Crear'} Usuario
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default UserForm;