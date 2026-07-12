import React, { useState, useEffect } from 'react';
import { X, Save, User, ClipboardList } from 'lucide-react';
import { FamilyMember, CreateFamilyMemberData, UpdateFamilyMemberData } from '../../types/familyMember';
import RestrictionSelector from './RestrictionSelector';

interface FamilyMemberFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CreateFamilyMemberData | UpdateFamilyMemberData) => Promise<void>;
  editingMember?: FamilyMember | null;
  customerId?: string;
}

const FamilyMemberForm: React.FC<FamilyMemberFormProps> = ({
  isOpen,
  onClose,
  onSubmit,
  editingMember,
  customerId
}) => {
  const [formData, setFormData] = useState({
    family_member_name: '',
    family_member_restrictions: [] as string[],
    family_member_special_instructions: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      if (editingMember) {
        setFormData({
          family_member_name: editingMember.family_member_name,
          family_member_restrictions: editingMember.family_member_restrictions || [],
          family_member_special_instructions: editingMember.family_member_special_instructions || ''
        });
      } else {
        setFormData({
          family_member_name: '',
          family_member_restrictions: [],
          family_member_special_instructions: ''
        });
      }
      setError(null);
    }
  }, [isOpen, editingMember]);

  const handleSubmit = async () => {
    if (!formData.family_member_name.trim()) {
      setError('El nombre es requerido');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      if (editingMember) {
        await onSubmit({
          family_member_name: formData.family_member_name,
          family_member_restrictions: formData.family_member_restrictions,
          family_member_special_instructions: formData.family_member_special_instructions || null
        });
      } else {
        if (!customerId) {
          throw new Error('Customer ID is required');
        }
        await onSubmit({
          customer_id: customerId,
          family_member_name: formData.family_member_name,
          family_member_restrictions: formData.family_member_restrictions,
          family_member_special_instructions: formData.family_member_special_instructions || null
        });
      }
      onClose();
    } catch (err: any) {
      setError(err.message || 'Error al guardar el miembro familiar');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 rounded-t-2xl">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">
              {editingMember ? 'Editar Miembro Familiar' : 'Agregar Miembro Familiar'}
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
              disabled={loading}
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="family_member_name" className="block text-sm font-medium text-gray-700 mb-2">
              Nombre del Miembro Familiar *
            </label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                id="family_member_name"
                value={formData.family_member_name}
                onChange={(e) => setFormData({ ...formData, family_member_name: e.target.value })}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-all"
                placeholder="Ejemplo: Juan Pérez"
                disabled={loading}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !loading) {
                    e.preventDefault();
                    handleSubmit();
                  }
                }}
              />
            </div>
          </div>

          <RestrictionSelector
            selectedRestrictions={formData.family_member_restrictions}
            onRestrictionsChange={(restrictions) =>
              setFormData({ ...formData, family_member_restrictions: restrictions })
            }
            disabled={loading}
          />

          {/* Special Instructions for Family Member */}
          <div>
            <label htmlFor="family_member_special_instructions" className="block text-sm font-medium text-gray-700 mb-2">
              Instrucciones Especiales (Cocina)
            </label>
            <p className="text-xs text-amber-600 mb-2">
              Aparece en la vista de alergias para todos los platillos de este miembro.
            </p>
            <div className="relative">
              <ClipboardList className="absolute left-3 top-3 text-amber-500 w-5 h-5" />
              <textarea
                id="family_member_special_instructions"
                value={formData.family_member_special_instructions}
                onChange={(e) => setFormData({ ...formData, family_member_special_instructions: e.target.value })}
                rows={3}
                className="w-full pl-10 pr-4 py-3 border border-amber-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none transition-all resize-none bg-amber-50/50"
                placeholder="Ej: Sin sal extra, cortar en trozos pequeños..."
                disabled={loading}
              />
            </div>
          </div>

          <div className="flex justify-end space-x-4 pt-6 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors"
              disabled={loading}
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={loading}
              className="px-6 py-3 bg-primary-600 text-white rounded-xl hover:bg-primary-700 transition-colors flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Guardando...</span>
                </>
              ) : (
                <>
                  <Save className="w-5 h-5" />
                  <span>{editingMember ? 'Actualizar' : 'Agregar'}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FamilyMemberForm;
