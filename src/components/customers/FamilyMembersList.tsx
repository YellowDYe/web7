import React, { useState, useEffect } from 'react';
import { Users, Plus, Edit, Trash2, AlertCircle, Loader2 } from 'lucide-react';
import { FamilyMember } from '../../types/familyMember';
import { familyMemberService } from '../../services/familyMemberService';
import { supabase } from '../../config/supabase';
import FamilyMemberForm from './FamilyMemberForm';

interface FamilyMembersListProps {
  customerId: string;
  onMembersChange?: () => void;
}

const FamilyMembersList: React.FC<FamilyMembersListProps> = ({ customerId, onMembersChange }) => {
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<FamilyMember | null>(null);
  const [deletingMemberId, setDeletingMemberId] = useState<string | null>(null);
  const [restrictionNames, setRestrictionNames] = useState<Record<string, string>>({});

  useEffect(() => {
    loadFamilyMembers();
  }, [customerId]);

  const loadFamilyMembers = async () => {
    try {
      setLoading(true);
      setError(null);
      const members = await familyMemberService.getFamilyMembersByCustomerId(customerId);
      setFamilyMembers(members);

      const allRestrictionIds = new Set<string>();
      members.forEach(member => {
        member.family_member_restrictions.forEach(id => allRestrictionIds.add(id));
      });

      if (allRestrictionIds.size > 0) {
        await loadRestrictionNames(Array.from(allRestrictionIds));
      }
    } catch (err: any) {
      setError(err.message || 'Error al cargar miembros familiares');
    } finally {
      setLoading(false);
    }
  };

  const loadRestrictionNames = async (restrictionIds: string[]) => {
    try {
      const { data: ingredients, error: ingredientsError } = await supabase
        .from('ingredients')
        .select('ingredient_id, ingredient_name')
        .in('ingredient_id', restrictionIds);

      if (ingredientsError) {
        console.error('Error loading ingredient names:', ingredientsError);
        return;
      }

      const foundIngredientIds = (ingredients || []).map(ing => ing.ingredient_id);
      const remainingIds = restrictionIds.filter(id => !foundIngredientIds.includes(id));

      let categories: any[] = [];
      if (remainingIds.length > 0) {
        const { data: categoriesData, error: categoriesError } = await supabase
          .from('ingredient_categories')
          .select('ingredient_category_id, ingredient_category')
          .in('ingredient_category_id', remainingIds);

        if (!categoriesError) {
          categories = categoriesData || [];
        }
      }

      const newNames: Record<string, string> = {};
      (ingredients || []).forEach(ingredient => {
        newNames[ingredient.ingredient_id] = ingredient.ingredient_name;
      });
      categories.forEach(category => {
        newNames[category.ingredient_category_id] = category.ingredient_category;
      });

      setRestrictionNames(newNames);
    } catch (error) {
      console.error('Error loading restriction names:', error);
    }
  };

  const handleAddMember = () => {
    setEditingMember(null);
    setIsFormOpen(true);
  };

  const handleEditMember = (member: FamilyMember) => {
    setEditingMember(member);
    setIsFormOpen(true);
  };

  const handleDeleteMember = async (memberId: string) => {
    if (!confirm('¿Estás seguro de que deseas eliminar este miembro familiar?')) {
      return;
    }

    try {
      setDeletingMemberId(memberId);
      await familyMemberService.deleteFamilyMember(memberId);
      await loadFamilyMembers();
      if (onMembersChange) {
        onMembersChange();
      }
    } catch (err: any) {
      alert(err.message || 'Error al eliminar miembro familiar');
    } finally {
      setDeletingMemberId(null);
    }
  };

  const handleSubmitForm = async (data: any) => {
    try {
      if (editingMember) {
        await familyMemberService.updateFamilyMember(editingMember.id, data);
      } else {
        await familyMemberService.createFamilyMember(data);
      }
      await loadFamilyMembers();
      if (onMembersChange) {
        onMembersChange();
      }
      setIsFormOpen(false);
    } catch (err: any) {
      throw err;
    }
  };

  const canAddMore = familyMembers.length < 5;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-primary-600" />
        <span className="ml-2 text-gray-600">Cargando miembros familiares...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Users className="w-5 h-5 text-gray-600" />
          <h3 className="text-lg font-semibold text-gray-900">
            Miembros Familiares ({familyMembers.length} de 5)
          </h3>
        </div>
        <button
          type="button"
          onClick={handleAddMember}
          disabled={!canAddMore}
          className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
            canAddMore
              ? 'bg-primary-600 text-white hover:bg-primary-700'
              : 'bg-gray-200 text-gray-400 cursor-not-allowed'
          }`}
        >
          <Plus className="w-4 h-4" />
          <span>Agregar Miembro</span>
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm flex items-center space-x-2">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {!canAddMore && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-amber-700 text-sm flex items-center space-x-2">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>Has alcanzado el límite máximo de 5 miembros familiares</span>
        </div>
      )}

      {familyMembers.length === 0 ? (
        <div className="text-center py-8 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
          <Users className="w-12 h-12 text-gray-400 mx-auto mb-2" />
          <p className="text-gray-600">No hay miembros familiares agregados</p>
          <p className="text-sm text-gray-500 mt-1">Haz clic en "Agregar Miembro" para comenzar</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {familyMembers.map((member) => (
            <div
              key={member.id}
              className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center space-x-2">
                  <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center">
                    <Users className="w-5 h-5 text-primary-600" />
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-900">{member.family_member_name}</h4>
                  </div>
                </div>
                <div className="flex space-x-1">
                  <button
                    type="button"
                    onClick={() => handleEditMember(member)}
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    title="Editar"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteMember(member.id)}
                    disabled={deletingMemberId === member.id}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                    title="Eliminar"
                  >
                    {deletingMemberId === member.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              {member.family_member_restrictions.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-gray-700 mb-2">Restricciones:</p>
                  <div className="flex flex-wrap gap-1">
                    {member.family_member_restrictions.map((restrictionId, index) => (
                      <span
                        key={index}
                        className="px-2 py-1 bg-orange-50 text-orange-700 rounded-full text-xs border border-orange-200"
                      >
                        {restrictionNames[restrictionId] || restrictionId}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {member.family_member_restrictions.length === 0 && (
                <p className="text-xs text-gray-500 italic">Sin restricciones alimenticias</p>
              )}
            </div>
          ))}
        </div>
      )}

      <FamilyMemberForm
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        onSubmit={handleSubmitForm}
        editingMember={editingMember}
        customerId={customerId}
      />
    </div>
  );
};

export default FamilyMembersList;
