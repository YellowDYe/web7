import React, { useState, useEffect } from 'react';
import { X, Send, Loader2, Mail, Shield, Copy, Check } from 'lucide-react';
import { UserRole } from '../../types/user';

interface InviteUserFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { email: string; role_id: string }) => Promise<void>;
  roles: UserRole[];
  loading?: boolean;
  invitationToken?: string;
  showSuccessMessage?: boolean;
}

const InviteUserForm: React.FC<InviteUserFormProps> = ({
  isOpen,
  onClose,
  onSubmit,
  roles,
  loading = false,
  invitationToken,
  showSuccessMessage = false
}) => {
  const [formData, setFormData] = useState({
    email: '',
    role_id: ''
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setFormData({
        email: '',
        role_id: ''
      });
      setErrors({});
      setCopied(false);
    }
  }, [isOpen]);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.email.trim()) {
      newErrors.email = 'El email es requerido';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'El formato del email no es válido';
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
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
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
            Invitar Usuario
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
          {/* Email */}
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
              Email del Usuario *
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
              Rol a Asignar *
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

          {/* Info Box */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <div className="flex items-start space-x-2">
              <Mail className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-blue-800">
                <p className="font-medium mb-1">¿Cómo funciona el proceso de invitación?</p>
                <ul className="space-y-1 text-blue-700">
                  <li>• Se creará una cuenta con una contraseña temporal</li>
                  <li>• Se enviará un email con las credenciales al usuario</li>
                  <li>• El usuario debe cambiar su contraseña en el primer inicio de sesión</li>
                  <li>• Se le asignará automáticamente el rol seleccionado</li>
                  <li>• También puede iniciar sesión con Google</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Success Message with Temporary Password */}
          {showSuccessMessage && invitationToken && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4">
              <div className="flex items-start space-x-2 mb-3">
                <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-medium text-green-900 mb-1">
                    ¡Usuario creado exitosamente!
                  </p>
                  <p className="text-sm text-green-700">
                    Se ha enviado un email con las credenciales a {formData.email}
                  </p>
                </div>
              </div>

              <div className="mt-3">
                <label className="block text-xs font-medium text-green-800 mb-2">
                  Contraseña temporal (compártela si el email no llegó):
                </label>
                <div className="flex items-center space-x-2">
                  <input
                    type="text"
                    readOnly
                    value={invitationToken}
                    className="flex-1 px-3 py-2 bg-white border border-green-300 rounded-lg text-sm font-mono text-gray-700 font-medium"
                    onClick={(e) => e.currentTarget.select()}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(invitationToken);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    }}
                    className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors flex items-center space-x-2"
                  >
                    {copied ? (
                      <>
                        <Check className="w-4 h-4" />
                        <span className="text-xs font-medium">Copiado</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        <span className="text-xs font-medium">Copiar</span>
                      </>
                    )}
                  </button>
                </div>
                <p className="text-xs text-green-700 mt-2">
                  El usuario debe cambiar esta contraseña en su primer inicio de sesión.
                </p>
              </div>
            </div>
          )}

          {/* Form Actions */}
          <div className="flex space-x-4 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors font-medium"
              disabled={loading}
            >
              {showSuccessMessage ? 'Cerrar' : 'Cancelar'}
            </button>
            {!showSuccessMessage && (
              <button
                type="submit"
                disabled={loading}
                className="flex-1 bg-secondary-500 hover:bg-secondary-600 text-white px-6 py-3 rounded-xl transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-2" />
                    Enviar Invitación
                  </>
                )}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};

export default InviteUserForm;