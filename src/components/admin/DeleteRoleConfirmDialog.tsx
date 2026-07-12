import React from 'react';
import { AlertTriangle, Trash2, X } from 'lucide-react';
import { UserRoleWithDetails } from '../../types/user';

interface DeleteRoleConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  role: UserRoleWithDetails | null;
  loading?: boolean;
}

const DeleteRoleConfirmDialog: React.FC<DeleteRoleConfirmDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  role,
  loading = false
}) => {
  if (!isOpen || !role) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="bg-red-100 p-2 rounded-full">
              <AlertTriangle className="w-5 h-5 text-red-600" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900 font-poppins">
              Confirmar Eliminación
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            aria-label="Cerrar modal"
            disabled={loading}
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="p-6">
          <p className="text-gray-600 mb-4">
            ¿Estás seguro de que deseas eliminar este rol?
          </p>
          
          <div className="bg-gray-50 rounded-xl p-4 mb-6">
            <div className="flex items-start space-x-3">
              <div className="bg-secondary-100 p-2 rounded-lg flex-shrink-0">
                <span className="text-secondary-600 font-semibold text-sm">
                  {role.role_id}
                </span>
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900 mb-1">
                  {role.role_name}
                </h3>
                <p className="text-sm text-gray-600 mb-2">
                  {role.role_description}
                </p>
                <p className="text-sm text-gray-600">
                  Permisos: {role.permissions?.length || 0}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
            <p className="text-red-800 text-sm">
              <strong>Advertencia:</strong> Esta acción no se puede deshacer. 
              El rol será eliminado permanentemente y todos los usuarios con este rol perderán sus permisos.
            </p>
          </div>

          <div className="flex space-x-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors font-medium"
              disabled={loading}
            >
              Cancelar
            </button>
            <button
              onClick={onConfirm}
              disabled={loading}
              className="flex-1 bg-red-500 hover:bg-red-600 text-white px-6 py-3 rounded-xl transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 mr-2 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Eliminando...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Eliminar Rol
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DeleteRoleConfirmDialog;