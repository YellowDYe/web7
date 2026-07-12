import React, { useState, useEffect } from 'react';
import { Users, AlertCircle, Loader2, User } from 'lucide-react';
import { FamilyMember } from '../../../types/familyMember';
import { familyMemberService } from '../../../services/familyMemberService';
import { supabase } from '../../../config/supabase';

interface CustomerFamilyMemberSelectorProps {
  customerId: string;
  customerName: string;
  selectedFamilyMemberId: string | null;
  onFamilyMemberSelect: (familyMemberId: string | null, member: FamilyMember | null) => void;
  disabled?: boolean;
}

const CustomerFamilyMemberSelector: React.FC<CustomerFamilyMemberSelectorProps> = ({
  customerId,
  customerName,
  selectedFamilyMemberId,
  onFamilyMemberSelect,
  disabled = false
}) => {
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [restrictionNames, setRestrictionNames] = useState<Record<string, string>>({});

  useEffect(() => {
    if (customerId) {
      loadFamilyMembers();
    }
  }, [customerId]);

  const loadFamilyMembers = async () => {
    if (!customerId) return;

    try {
      setLoading(true);
      setError(null);
      const members = await familyMemberService.getFamilyMembersByCustomerId(customerId);
      setFamilyMembers(members);

      const allRestrictionIds = new Set<string>();
      members.forEach(member => {
        if (Array.isArray(member.family_member_restrictions)) {
          member.family_member_restrictions.forEach(id => allRestrictionIds.add(id));
        }
      });

      if (allRestrictionIds.size > 0) {
        await loadRestrictionNames(Array.from(allRestrictionIds));
      }
    } catch (err: any) {
      console.error('Error loading family members:', err);
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

      if (ingredientsError) throw ingredientsError;

      const names: Record<string, string> = {};
      ingredients?.forEach(ing => {
        names[ing.ingredient_id] = ing.ingredient_name;
      });
      setRestrictionNames(names);
    } catch (err) {
      console.error('Error loading restriction names:', err);
    }
  };

  const handleSelectChange = (value: string) => {
    if (value === '') {
      onFamilyMemberSelect(null, null);
    } else {
      const member = familyMembers.find(m => m.id === value);
      onFamilyMemberSelect(value, member || null);
    }
  };

  const selectedMember = selectedFamilyMemberId
    ? familyMembers.find(m => m.id === selectedFamilyMemberId)
    : null;

  const selectedName = selectedMember
    ? selectedMember.family_member_name
    : customerName;

  const selectedRestrictions = selectedMember
    ? selectedMember.family_member_restrictions
        .map(id => restrictionNames[id])
        .filter(Boolean)
    : [];

  if (!loading && familyMembers.length === 0) {
    return null;
  }

  return (
    <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
      <div className="flex items-center space-x-3 mb-4">
        <div className="bg-purple-100 p-2 rounded-lg">
          <Users className="w-5 h-5 text-purple-600" />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-gray-900">¿Para quién es este pedido?</h2>
          <p className="text-sm text-gray-600">Selecciona el miembro de la familia</p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center space-x-2 text-gray-600">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span>Cargando miembros familiares...</span>
        </div>
      ) : error ? (
        <div className="flex items-center space-x-2 text-red-600 bg-red-50 p-4 rounded-lg">
          <AlertCircle className="w-5 h-5" />
          <span>{error}</span>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
            <button
              type="button"
              onClick={() => handleSelectChange('')}
              disabled={disabled}
              className={`p-4 rounded-xl border-2 transition-all text-left ${
                selectedFamilyMemberId === null
                  ? 'border-red-500 bg-red-50 shadow-md'
                  : 'border-gray-200 hover:border-red-300 hover:bg-gray-50'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              <div className="flex items-center space-x-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  selectedFamilyMemberId === null ? 'bg-red-100' : 'bg-gray-100'
                }`}>
                  <User className={`w-5 h-5 ${
                    selectedFamilyMemberId === null ? 'text-red-600' : 'text-gray-600'
                  }`} />
                </div>
                <div className="flex-1">
                  <div className={`font-medium ${
                    selectedFamilyMemberId === null ? 'text-red-900' : 'text-gray-900'
                  }`}>
                    {customerName}
                  </div>
                  <div className="text-xs text-gray-500">Cliente Principal</div>
                </div>
                {selectedFamilyMemberId === null && (
                  <div className="w-5 h-5 bg-red-500 rounded-full flex items-center justify-center">
                    <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                )}
              </div>
            </button>

            {familyMembers.map(member => {
              const memberRestrictions = member.family_member_restrictions
                .map(id => restrictionNames[id])
                .filter(Boolean);
              const isSelected = selectedFamilyMemberId === member.id;

              return (
                <button
                  key={member.id}
                  type="button"
                  onClick={() => handleSelectChange(member.id)}
                  disabled={disabled}
                  className={`p-4 rounded-xl border-2 transition-all text-left ${
                    isSelected
                      ? 'border-red-500 bg-red-50 shadow-md'
                      : 'border-gray-200 hover:border-red-300 hover:bg-gray-50'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  <div className="flex items-center space-x-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      isSelected ? 'bg-purple-100' : 'bg-gray-100'
                    }`}>
                      <Users className={`w-5 h-5 ${
                        isSelected ? 'text-purple-600' : 'text-gray-600'
                      }`} />
                    </div>
                    <div className="flex-1">
                      <div className={`font-medium ${
                        isSelected ? 'text-red-900' : 'text-gray-900'
                      }`}>
                        {member.family_member_name}
                      </div>
                      {memberRestrictions.length > 0 && (
                        <div className="text-xs text-orange-600 mt-1">
                          {memberRestrictions.length} restricción{memberRestrictions.length !== 1 ? 'es' : ''}
                        </div>
                      )}
                    </div>
                    {isSelected && (
                      <div className="w-5 h-5 bg-red-500 rounded-full flex items-center justify-center">
                        <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {selectedRestrictions.length > 0 && (
            <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
              <div className="flex items-start space-x-2">
                <AlertCircle className="w-5 h-5 text-orange-600 mt-0.5 flex-shrink-0" />
                <div>
                  <h3 className="text-sm font-semibold text-orange-900 mb-2">
                    Restricciones Alimenticias de {selectedName}
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {selectedRestrictions.map((restriction, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-sm font-medium border border-orange-300"
                      >
                        {restriction}
                      </span>
                    ))}
                  </div>
                  <p className="text-xs text-orange-700 mt-2">
                    El menú se filtrará automáticamente según estas restricciones
                  </p>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default CustomerFamilyMemberSelector;
