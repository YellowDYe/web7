import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useCustomerAuth } from '../contexts/CustomerAuthContext';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { Mail, Lock, User, Phone, MapPin, FileText, Check, Users, CreditCard as Edit, Trash2, Plus, CircleAlert as AlertCircle } from 'lucide-react';
import CustomerSiteHeader from '../components/CustomerSiteHeader';
import RestrictionSelector from '../../components/customers/RestrictionSelector';
import PostalCodeSearchDropdown from '../../components/customers/PostalCodeSearchDropdown';
import TaxRegimeDropdown from '../../components/customers/TaxRegimeDropdown';
import FamilyMemberForm from '../../components/customers/FamilyMemberForm';
import { Footer } from '../sections/Footer/Footer';
import type { Customer } from '../../types/customer';
import { supabase } from '../../config/supabase';

const STEPS = [
  { id: 0, title: 'Cuenta', icon: Mail },
  { id: 1, title: 'Info Personal', icon: User },
  { id: 2, title: 'Dirección', icon: MapPin },
  { id: 3, title: 'Restricciones', icon: FileText },
  { id: 4, title: 'Familiares', icon: Users },
  { id: 5, title: 'Facturación', icon: FileText },
];

export default function CustomerSignupPage() {
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [checkingEmail, setCheckingEmail] = useState(false);
  const [error, setError] = useState('');
  const [emailCheckMessage, setEmailCheckMessage] = useState('');
  const { signup, checkEmailExists } = useCustomerAuth();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    first_name: '',
    last_name: '',
    phone: '',
    street_address: '',
    address_number: '',
    interior_number: '',
    colonia: '',
    delegacion: '',
    postal_code: '',
    delivery_instructions: '',
    restrictions: [] as string[],
    family_member_1_name: null as string | null,
    family_member_1_restrictions: [] as string[],
    family_member_2_name: null as string | null,
    family_member_2_restrictions: [] as string[],
    family_member_3_name: null as string | null,
    family_member_3_restrictions: [] as string[],
    family_member_4_name: null as string | null,
    family_member_4_restrictions: [] as string[],
    family_member_5_name: null as string | null,
    family_member_5_restrictions: [] as string[],
    rfc: '',
    invoice_name: '',
    tax_regime: '',
    invoice_address: '',
  });

  const [isFamilyMemberFormOpen, setIsFamilyMemberFormOpen] = useState(false);
  const [editingMemberSlot, setEditingMemberSlot] = useState<number | null>(null);
  const [restrictionNames, setRestrictionNames] = useState<Record<string, string>>({});

  useEffect(() => {
    const saved = localStorage.getItem('customerSignupDraft');
    if (saved) {
      try {
        setFormData(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to parse saved draft');
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('customerSignupDraft', JSON.stringify(formData));
  }, [formData]);

  useEffect(() => {
    const members = getFamilyMembers();
    const allRestrictionIds = new Set<string>();
    members.forEach(member => {
      member.restrictions.forEach(id => allRestrictionIds.add(id));
    });
    if (allRestrictionIds.size > 0) {
      loadRestrictionNames(Array.from(allRestrictionIds));
    }
  }, [formData.family_member_1_name, formData.family_member_1_restrictions,
      formData.family_member_2_name, formData.family_member_2_restrictions,
      formData.family_member_3_name, formData.family_member_3_restrictions,
      formData.family_member_4_name, formData.family_member_4_restrictions,
      formData.family_member_5_name, formData.family_member_5_restrictions]);

  const getFamilyMembers = () => {
    const members: Array<{ slot: number; name: string; restrictions: string[] }> = [];
    for (let i = 1; i <= 5; i++) {
      const name = (formData as any)[`family_member_${i}_name`];
      if (name) {
        members.push({
          slot: i,
          name: name,
          restrictions: (formData as any)[`family_member_${i}_restrictions`] || []
        });
      }
    }
    return members;
  };

  const getFirstAvailableSlot = (): number | null => {
    for (let i = 1; i <= 5; i++) {
      if (!(formData as any)[`family_member_${i}_name`]) {
        return i;
      }
    }
    return null;
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

      setRestrictionNames(prev => ({ ...prev, ...newNames }));
    } catch (error) {
      console.error('Error loading restriction names:', error);
    }
  };

  const handleAddFamilyMember = () => {
    const slot = getFirstAvailableSlot();
    if (!slot) {
      alert('Ya has agregado el máximo de 5 miembros familiares');
      return;
    }
    setEditingMemberSlot(null);
    setIsFamilyMemberFormOpen(true);
  };

  const handleEditFamilyMember = (slot: number) => {
    setEditingMemberSlot(slot);
    setIsFamilyMemberFormOpen(true);
  };

  const handleDeleteFamilyMember = (slot: number) => {
    if (!confirm('¿Estás seguro de que deseas eliminar este miembro familiar?')) {
      return;
    }
    setFormData(prev => ({
      ...prev,
      [`family_member_${slot}_name`]: null,
      [`family_member_${slot}_restrictions`]: []
    }));
  };

  const handleFamilyMemberSubmit = async (data: any) => {
    try {
      const slot = editingMemberSlot || getFirstAvailableSlot();
      if (!slot) {
        throw new Error('No hay espacios disponibles');
      }

      setFormData(prev => ({
        ...prev,
        [`family_member_${slot}_name`]: data.family_member_name,
        [`family_member_${slot}_restrictions`]: data.family_member_restrictions || []
      }));

      setIsFamilyMemberFormOpen(false);
      setEditingMemberSlot(null);
    } catch (err: any) {
      throw err;
    }
  };

  const handleEmailBlur = async () => {
    if (!formData.email) return;

    console.log('[SIGNUP] Checking email:', formData.email);
    setCheckingEmail(true);
    setEmailCheckMessage('');
    setError('');

    try {
      const result = await checkEmailExists(formData.email);
      console.log('[SIGNUP] Email check result:', result);

      if (result.exists && result.hasAuth) {
        console.log('[SIGNUP] Email already registered with auth');
        setError('Este correo ya está registrado.');
        setEmailCheckMessage('');
      } else {
        console.log('[SIGNUP] Email available');
        setEmailCheckMessage('¡Correo disponible!');
      }
    } catch (err: any) {
      console.error('[SIGNUP] Error checking email:', err);
      setError('No pudimos verificar el correo. Por favor intenta de nuevo.');
    } finally {
      setCheckingEmail(false);
    }
  };

  const validateStep = async () => {
    console.log('[SIGNUP] Validating step:', currentStep);
    setError('');

    switch (currentStep) {
      case 0:
        console.log('[SIGNUP] Validating step 0 - email and password');
        if (!formData.email || !formData.password || !formData.confirmPassword) {
          console.log('[SIGNUP] Missing required fields');
          setError('Por favor completa todos los campos requeridos');
          return false;
        }
        if (formData.password.length < 8) {
          console.log('[SIGNUP] Password too short');
          setError('La contraseña debe tener al menos 8 caracteres');
          return false;
        }
        if (formData.password !== formData.confirmPassword) {
          console.log('[SIGNUP] Passwords do not match');
          setError('Las contraseñas no coinciden');
          return false;
        }

        // Validate email availability before allowing to proceed
        console.log('[SIGNUP] Checking email availability before proceeding');
        try {
          const result = await checkEmailExists(formData.email);
          console.log('[SIGNUP] Email availability check result:', result);
          if (result.exists && result.hasAuth) {
            console.log('[SIGNUP] Email already has auth account');
            setError('Este correo ya está registrado.');
            return false;
          }
        } catch (err: any) {
          console.error('[SIGNUP] Error checking email:', err);
          setError(err.message || 'Error al verificar el correo. Por favor intenta de nuevo.');
          return false;
        }

        console.log('[SIGNUP] Step 0 validation passed');
        return true;

      case 1:
        if (!formData.first_name || !formData.last_name || !formData.phone) {
          setError('Por favor completa todos los campos requeridos');
          return false;
        }
        return true;

      case 2:
        if (!formData.street_address || !formData.address_number || !formData.colonia ||
            !formData.delegacion || !formData.postal_code) {
          setError('Por favor completa todos los campos de dirección requeridos');
          return false;
        }
        return true;

      case 3:
        return true;

      case 4:
        return true;

      case 5:
        return true;

      default:
        return true;
    }
  };

  const handleNext = async () => {
    console.log('[SIGNUP] Next button clicked, current step:', currentStep);
    const isValid = await validateStep();
    console.log('[SIGNUP] Validation result:', isValid);
    if (isValid) {
      setCurrentStep(prev => Math.min(prev + 1, STEPS.length - 1));
    }
  };

  const handleBack = () => {
    setCurrentStep(prev => Math.max(prev - 1, 0));
  };

  const handleSubmit = async () => {
    if (!(await validateStep())) return;

    setLoading(true);
    setError('');

    try {
      const customerData: Partial<Customer> = {
        first_name: formData.first_name,
        last_name: formData.last_name,
        phone: formData.phone,
        street_address: formData.street_address,
        address_number: formData.address_number,
        interior_number: formData.interior_number,
        colonia: formData.colonia,
        delegacion: formData.delegacion,
        postal_code: formData.postal_code,
        delivery_instructions: formData.delivery_instructions,
        restrictions: formData.restrictions,
        family_member_1_name: formData.family_member_1_name,
        family_member_1_restrictions: formData.family_member_1_restrictions,
        family_member_2_name: formData.family_member_2_name,
        family_member_2_restrictions: formData.family_member_2_restrictions,
        family_member_3_name: formData.family_member_3_name,
        family_member_3_restrictions: formData.family_member_3_restrictions,
        family_member_4_name: formData.family_member_4_name,
        family_member_4_restrictions: formData.family_member_4_restrictions,
        family_member_5_name: formData.family_member_5_name,
        family_member_5_restrictions: formData.family_member_5_restrictions,
        rfc: formData.rfc || undefined,
        invoice_name: formData.invoice_name || undefined,
        tax_regime: formData.tax_regime || undefined,
        invoice_address: formData.invoice_address || undefined,
      };

      await signup(formData.email, formData.password, customerData);
      localStorage.removeItem('customerSignupDraft');
      navigate('/account');
    } catch (err: any) {
      setError(err.message || 'Error al crear la cuenta');
    } finally {
      setLoading(false);
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 0:
        return (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Correo Electrónico *
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  onBlur={handleEmailBlur}
                  required
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  placeholder="tu@correo.com"
                />
              </div>
              {emailCheckMessage && (
                <p className={`mt-2 text-sm ${emailCheckMessage.includes('Encontramos') ? 'text-blue-600' : 'text-green-600'}`}>
                  {emailCheckMessage}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Contraseña *
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  required
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  placeholder="Mínimo 8 caracteres"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Confirmar Contraseña *
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                <input
                  type="password"
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                  required
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  placeholder="Confirma tu contraseña"
                />
              </div>
            </div>
          </div>
        );

      case 1:
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nombre *
                </label>
                <input
                  type="text"
                  value={formData.first_name}
                  onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  placeholder="Juan"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Apellido *
                </label>
                <input
                  type="text"
                  value={formData.last_name}
                  onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  placeholder="Pérez"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Número de Teléfono *
              </label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  required
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  placeholder="+52 123 456 7890"
                />
              </div>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Calle *
                </label>
                <input
                  type="text"
                  value={formData.street_address}
                  onChange={(e) => setFormData({ ...formData, street_address: e.target.value })}
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  placeholder="Calle Principal"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Número *
                </label>
                <input
                  type="text"
                  value={formData.address_number}
                  onChange={(e) => setFormData({ ...formData, address_number: e.target.value })}
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  placeholder="123"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Número Interior (Opcional)
              </label>
              <input
                type="text"
                value={formData.interior_number}
                onChange={(e) => setFormData({ ...formData, interior_number: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                placeholder="Depto 4B"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Código Postal *
              </label>
              <PostalCodeSearchDropdown
                selectedPostalCode={formData.postal_code}
                onPostalCodeSelect={(postalCode, neighborhood) => {
                  setFormData({
                    ...formData,
                    postal_code: postalCode,
                    colonia: neighborhood || formData.colonia,
                  });
                }}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Colonia *
                </label>
                <input
                  type="text"
                  value={formData.colonia}
                  onChange={(e) => setFormData({ ...formData, colonia: e.target.value })}
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  placeholder="Colonia"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Delegación *
                </label>
                <input
                  type="text"
                  value={formData.delegacion}
                  onChange={(e) => setFormData({ ...formData, delegacion: e.target.value })}
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  placeholder="Delegación"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Instrucciones de Entrega (Opcional)
              </label>
              <textarea
                value={formData.delivery_instructions}
                onChange={(e) => setFormData({ ...formData, delivery_instructions: e.target.value })}
                rows={3}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                placeholder="Instrucciones especiales para la entrega..."
              />
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Restricciones Alimenticias (Opcional)
              </label>
              <p className="text-sm text-gray-600 mb-4">
                Selecciona cualquier restricción alimenticia o alergia que tengas. Esto nos ayuda a personalizar tus planes de comida.
              </p>
              <RestrictionSelector
                selectedRestrictions={formData.restrictions}
                onRestrictionsChange={(restrictions) => setFormData({ ...formData, restrictions })}
              />
            </div>
          </div>
        );

      case 4:
        return (
          <div className="space-y-6">
            <div>
              <p className="text-sm text-gray-600 mb-4">
                Agrega hasta 5 miembros de tu familia. Cada uno puede tener sus propias restricciones alimenticias.
              </p>
              <p className="text-sm text-blue-600 mb-6">
                Este paso es opcional. Puedes agregar miembros familiares ahora o más tarde desde tu cuenta.
              </p>
            </div>

            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2">
                <Users className="w-5 h-5 text-gray-600" />
                <h3 className="text-lg font-semibold text-gray-900">
                  Miembros Familiares ({getFamilyMembers().length} de 5)
                </h3>
              </div>
              <button
                type="button"
                onClick={handleAddFamilyMember}
                disabled={getFamilyMembers().length >= 5}
                className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
                  getFamilyMembers().length < 5
                    ? 'bg-red-600 text-white hover:bg-red-700'
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                }`}
              >
                <Plus className="w-4 h-4" />
                <span>Agregar</span>
              </button>
            </div>

            {getFamilyMembers().length >= 5 && (
              <div className="mb-4 bg-amber-50 border border-amber-200 rounded-lg p-4 text-amber-700 text-sm flex items-center space-x-2">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <span>Has alcanzado el límite máximo de 5 miembros familiares</span>
              </div>
            )}

            {getFamilyMembers().length === 0 ? (
              <div className="text-center py-8 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                <Users className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                <p className="text-gray-600">No hay miembros familiares agregados</p>
                <p className="text-sm text-gray-500 mt-1">Haz clic en "Agregar" para comenzar</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {getFamilyMembers().map((member) => (
                  <div
                    key={member.slot}
                    className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center space-x-2">
                        <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                          <Users className="w-5 h-5 text-red-600" />
                        </div>
                        <div>
                          <h4 className="font-medium text-gray-900">{member.name}</h4>
                        </div>
                      </div>
                      <div className="flex space-x-1">
                        <button
                          type="button"
                          onClick={() => handleEditFamilyMember(member.slot)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Editar"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteFamilyMember(member.slot)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Eliminar"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {member.restrictions.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-gray-700 mb-2">Restricciones:</p>
                        <div className="flex flex-wrap gap-1">
                          {member.restrictions.map((restrictionId, index) => (
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

                    {member.restrictions.length === 0 && (
                      <p className="text-xs text-gray-500 italic">Sin restricciones alimenticias</p>
                    )}
                  </div>
                ))}
              </div>
            )}

            <FamilyMemberForm
              isOpen={isFamilyMemberFormOpen}
              onClose={() => {
                setIsFamilyMemberFormOpen(false);
                setEditingMemberSlot(null);
              }}
              onSubmit={handleFamilyMemberSubmit}
              editingMember={editingMemberSlot ? {
                id: `temp-${editingMemberSlot}`,
                slot: editingMemberSlot as any,
                customer_id: 'temp',
                family_member_name: (formData as any)[`family_member_${editingMemberSlot}_name`],
                family_member_restrictions: (formData as any)[`family_member_${editingMemberSlot}_restrictions`] || []
              } : null}
              customerId="temp"
            />
          </div>
        );

      case 5:
        return (
          <div className="space-y-6">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <p className="text-sm text-blue-800">
                La información de facturación es opcional. Puedes omitir este paso y agregarla más tarde desde tu cuenta.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                RFC (Opcional)
              </label>
              <input
                type="text"
                value={formData.rfc}
                onChange={(e) => setFormData({ ...formData, rfc: e.target.value.toUpperCase() })}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                placeholder="XAXX010101000"
                maxLength={13}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Nombre de Facturación (Opcional)
              </label>
              <input
                type="text"
                value={formData.invoice_name}
                onChange={(e) => setFormData({ ...formData, invoice_name: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                placeholder="Empresa o Nombre Completo"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Régimen Fiscal (Opcional)
              </label>
              <TaxRegimeDropdown
                selectedRegime={formData.tax_regime}
                onRegimeSelect={(regime) => setFormData({ ...formData, tax_regime: regime })}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Dirección de Facturación (Opcional)
              </label>
              <textarea
                value={formData.invoice_address}
                onChange={(e) => setFormData({ ...formData, invoice_address: e.target.value })}
                rows={3}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                placeholder="Dirección completa de facturación (si es diferente a la dirección de entrega)"
              />
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <CustomerSiteHeader />

      <div className="container mx-auto px-4 py-16 max-w-3xl">
        <Card className="p-8 shadow-lg">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Crea Tu Cuenta</h1>
            <p className="text-gray-600">Únete a Hola Dieta hoy</p>
          </div>

          <div className="mb-12">
            <div className="flex items-center justify-between">
              {STEPS.map((step, index) => {
                const Icon = step.icon;
                const isCompleted = index < currentStep;
                const isCurrent = index === currentStep;

                return (
                  <div key={step.id} className="flex items-center flex-1">
                    <div className="flex flex-col items-center flex-1">
                      <div
                        className={`w-12 h-12 rounded-full flex items-center justify-center border-2 transition-colors ${
                          isCompleted
                            ? 'bg-green-500 border-green-500 text-white'
                            : isCurrent
                            ? 'bg-red-600 border-red-600 text-white'
                            : 'bg-white border-gray-300 text-gray-400'
                        }`}
                      >
                        {isCompleted ? <Check className="h-6 w-6" /> : <Icon className="h-6 w-6" />}
                      </div>
                      <span
                        className={`mt-2 text-xs font-medium ${
                          isCurrent ? 'text-red-600' : isCompleted ? 'text-green-600' : 'text-gray-400'
                        }`}
                      >
                        {step.title}
                      </span>
                    </div>
                    {index < STEPS.length - 1 && (
                      <div
                        className={`h-1 flex-1 mx-2 transition-colors ${
                          isCompleted ? 'bg-green-500' : 'bg-gray-300'
                        }`}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
              {error.includes('ya está registrado') && (
                <div className="mt-2 flex gap-2">
                  <Link to="/login" className="text-red-600 hover:text-red-800 font-medium underline">
                    Iniciar Sesión
                  </Link>
                  <span>•</span>
                  <Link to="/forgot-password" className="text-red-600 hover:text-red-800 font-medium underline">
                    ¿Olvidaste tu contraseña?
                  </Link>
                </div>
              )}
            </div>
          )}

          <div className="mb-8">{renderStep()}</div>

          <div className="flex justify-between gap-4">
            {currentStep > 0 && (
              <Button
                onClick={handleBack}
                variant="outline"
                className="flex-1"
                disabled={loading || checkingEmail}
              >
                Atrás
              </Button>
            )}
            {currentStep < STEPS.length - 1 ? (
              <Button
                onClick={handleNext}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                disabled={loading || checkingEmail}
              >
                {checkingEmail ? 'Verificando...' : 'Siguiente'}
              </Button>
            ) : (
              <Button
                onClick={handleSubmit}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                disabled={loading}
              >
                {loading ? (
                  <span className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                    Creando Cuenta...
                  </span>
                ) : (
                  'Crear Cuenta'
                )}
              </Button>
            )}
          </div>

          <div className="mt-8 text-center text-sm">
            <span className="text-gray-600">¿Ya tienes cuenta? </span>
            <Link to="/login" className="text-red-600 hover:text-red-700 font-medium">
              Iniciar sesión
            </Link>
          </div>
        </Card>
      </div>

      <Footer />
    </div>
  );
}
