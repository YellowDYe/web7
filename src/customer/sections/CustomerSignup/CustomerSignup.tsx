import { useState, useEffect } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { useCustomerAuth } from '../../contexts/CustomerAuthContext';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { Mail, Lock, User, Phone, MapPin, FileText, Check, Users, CreditCard as Edit, Trash2, Plus, CircleAlert as AlertCircle, MessageCircle } from 'lucide-react';
import { cmsApiDirect } from '../../../shared/cms/cmsApiDirect';
import { deliveryZoneService } from '../../../services/deliveryZoneService';
import { AddressAutocompleteInput } from '../../components/AddressAutocompleteInput';
import type { AddressComponents } from '../../hooks/useGooglePlacesAutocomplete';
import RestrictionSelector from '../../../components/customers/RestrictionSelector';
import PostalCodeSearchDropdown from '../../../components/customers/PostalCodeSearchDropdown';
import TaxRegimeDropdown from '../../../components/customers/TaxRegimeDropdown';
import FamilyMemberForm from '../../../components/customers/FamilyMemberForm';
import DelegacionDropdown from '../../../components/customers/DelegacionDropdown';
import type { Customer } from '../../../types/customer';
import { supabase } from '../../../config/supabase';


const STEPS = [
  { id: 0, title: 'Cuenta', icon: Mail },
  { id: 1, title: 'Info Personal', icon: User },
  { id: 2, title: 'Dirección', icon: MapPin },
  { id: 3, title: 'Restricciones', icon: FileText },
  { id: 4, title: 'Familiares', icon: Users },
  { id: 5, title: 'Facturación', icon: FileText },
];

const COUNTRY_CODES = [
  { code: '+52', label: 'México', flag: '🇲🇽' },
  { code: '+1', label: 'USA', flag: '🇺🇸' },
  { code: '+34', label: 'España', flag: '🇪🇸' },
  { code: '+39', label: 'Italia', flag: '🇮🇹' },
  { code: '+54', label: 'Argentina', flag: '🇦🇷' },
  { code: '+55', label: 'Brasil', flag: '🇧🇷' },
  { code: '+57', label: 'Colombia', flag: '🇨🇴' },
  { code: '+507', label: 'Panamá', flag: '🇵🇦' },
  { code: '+58', label: 'Venezuela', flag: '🇻🇪' },
];

export const CustomerSignup: React.FC = () => {
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [checkingEmail, setCheckingEmail] = useState(false);
  const [error, setError] = useState('');
  const [emailCheckMessage, setEmailCheckMessage] = useState('');
  const [emailStatus, setEmailStatus] = useState<'available' | 'blocked' | 'link_only' | 'incomplete' | 'throttled' | null>(null);
  const [existingCustomerId, setExistingCustomerId] = useState<string | null>(null);
  const { signup, linkExistingCustomer, checkEmailExists, user, customer } = useCustomerAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnTo = searchParams.get('returnTo') || '/account';
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    first_name: '',
    last_name: '',
    country_code: '+52',
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
  const [postalCodeValid, setPostalCodeValid] = useState<boolean | null>(null);
  const [postalCodeChecking, setPostalCodeChecking] = useState(false);
  const [whatsappPhone, setWhatsappPhone] = useState('');
  const [deliveryZoneCodes, setDeliveryZoneCodes] = useState<Set<string>>(new Set());
  const [editingMemberSlot, setEditingMemberSlot] = useState<number | null>(null);
  const [restrictionNames, setRestrictionNames] = useState<Record<string, string>>({});
  const [resetSending, setResetSending] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  const handleSendPasswordReset = async () => {
    if (!formData.email) return;
    setResetSending(true);
    setError('');
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-password-reset`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: formData.email,
            siteUrl: window.location.origin,
            redirectPath: '/reset-password',
          }),
        }
      );
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.success) {
        throw new Error(result?.error || 'No pudimos enviar el correo. Intenta de nuevo.');
      }
      setResetSent(true);
    } catch (err: any) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg || 'No pudimos enviar el correo. Intenta de nuevo.');
    } finally {
      setResetSending(false);
    }
  };

  useEffect(() => {
    if (searchParams.get('incomplete') !== 'true') {
      localStorage.removeItem('customerSignupDraft');
      return;
    }
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

  useEffect(() => {
    const load = async () => {
      try {
        const zones = await deliveryZoneService.getZones();
        setDeliveryZoneCodes(new Set(zones.map(z => z.postal_code)));
      } catch { /* dropdown still works standalone */ }
      try {
        const result = await cmsApiDirect.getSettingByName('whatsapp_settings');
        if (result?.value?.phoneNumber) setWhatsappPhone(result.value.phoneNumber);
      } catch { /* no whatsapp link — that's fine */ }
    };
    load();
  }, []);

  useEffect(() => {
    if (!formData.postal_code) {
      setPostalCodeValid(null);
      return;
    }
    if (deliveryZoneCodes.size === 0) return;
    setPostalCodeValid(deliveryZoneCodes.has(formData.postal_code));
  }, [formData.postal_code, deliveryZoneCodes]);

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

    setCheckingEmail(true);
    setEmailCheckMessage('');
    setError('');
    setEmailStatus(null);
    setExistingCustomerId(null);
    setResetSent(false);

    try {
      const result = await checkEmailExists(formData.email);

      if (result.isThrottled) {
        setEmailStatus('throttled');
        setError('Has verificado este correo demasiadas veces. Espera unos minutos e intenta de nuevo.');
        setEmailCheckMessage('');
      } else if (result.hasAuth && result.hasCustomer) {
        setEmailStatus('blocked');
        setError('Este correo ya está registrado.');
        setEmailCheckMessage('');
      } else if (result.hasCustomer && !result.hasAuth) {
        setEmailStatus('link_only');
        setExistingCustomerId(result.customer?.id || null);
        setEmailCheckMessage('Encontramos tu perfil. Crea una contraseña para activar tu cuenta.');
      } else if (result.hasAuth && !result.hasCustomer) {
        setEmailStatus('incomplete');
        setEmailCheckMessage('Tu registro anterior no se completó. Puedes terminar de crear tu cuenta ahora.');
      } else {
        setEmailStatus('available');
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
    setError('');

    switch (currentStep) {
      case 0:
        if (!formData.email || !formData.password || !formData.confirmPassword) {
          setError('Por favor completa todos los campos requeridos');
          return false;
        }
        if (emailStatus === 'blocked') {
          setError('Este correo ya está registrado.');
          return false;
        }
        if (emailStatus === 'throttled') {
          setError('Has verificado este correo demasiadas veces. Espera unos minutos e intenta de nuevo.');
          return false;
        }
        if (formData.password.length < 8) {
          setError('La contraseña debe tener al menos 8 caracteres');
          return false;
        }
        if (formData.password !== formData.confirmPassword) {
          setError('Las contraseñas no coinciden');
          return false;
        }

        return true;

      case 1:
        if (!formData.first_name || !formData.last_name || !formData.phone) {
          setError('Por favor completa todos los campos requeridos');
          return false;
        }
        if (!/^\d{10}$/.test(formData.phone)) {
          setError('El número de teléfono debe tener exactamente 10 dígitos.');
          return false;
        }
        return true;

      case 2:
        if (!formData.street_address || !formData.address_number || !formData.colonia ||
            !formData.delegacion || !formData.postal_code) {
          setError('Por favor completa todos los campos de dirección requeridos');
          return false;
        }
        if (postalCodeValid === false) {
          setError('No tenemos servicio de entrega en tu código postal.');
          return false;
        }
        return true;

      default:
        return true;
    }
  };

  const handleNext = async () => {
    const isValid = await validateStep();
    if (!isValid) return;

    if (currentStep === 0 && emailStatus === 'link_only' && existingCustomerId) {
      setLoading(true);
      setError('');
      try {
        await linkExistingCustomer(formData.email, formData.password, existingCustomerId);
        localStorage.removeItem('customerSignupDraft');
        navigate(returnTo);
      } catch (err: any) {
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg || 'Error al activar la cuenta');
      } finally {
        setLoading(false);
      }
      return;
    }

    setCurrentStep(prev => Math.min(prev + 1, STEPS.length - 1));
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
        phone: `${formData.country_code || '+52'} ${formData.phone}`,
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
      navigate(returnTo);
    } catch (err: any) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg || 'Error al crear la cuenta');
      setCurrentStep(0);
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
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent text-base"
                  placeholder="tu@correo.com"
                />
              </div>
              {emailCheckMessage && (
                <p className={`mt-2 text-sm ${
                  emailStatus === 'link_only' ? 'text-blue-600' :
                  emailStatus === 'incomplete' ? 'text-amber-600' :
                  emailStatus === 'throttled' ? 'text-red-600' :
                  'text-green-600'
                }`}>
                  {emailCheckMessage}
                </p>
              )}
              {emailStatus === 'incomplete' && (
                <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-4">
                  {resetSent ? (
                    <p className="text-sm text-green-700">
                      Te enviamos un correo para restablecer tu contraseña. Ábrelo, elige una nueva contraseña y luego regresa a iniciar sesión.
                    </p>
                  ) : (
                    <>
                      <p className="text-sm text-amber-800 mb-3">
                        Si recuerdas la contraseña que usaste antes, ingrésala arriba y continúa. Si no la recuerdas, restablécela para terminar de crear tu cuenta.
                      </p>
                      <button
                        type="button"
                        onClick={handleSendPasswordReset}
                        disabled={resetSending}
                        className="inline-flex items-center gap-2 text-sm font-medium text-red-600 hover:text-red-700 disabled:opacity-60"
                      >
                        {resetSending ? 'Enviando...' : 'Restablecer contraseña'}
                      </button>
                    </>
                  )}
                </div>
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
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent text-base"
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
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent text-base"
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
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent text-base"
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
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent text-base"
                  placeholder="Pérez"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Número de Teléfono *
              </label>
              <div className="flex gap-2">
                <select
                  value={formData.country_code || '+52'}
                  onChange={(e) => setFormData({ ...formData, country_code: e.target.value })}
                  className="shrink-0 px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent text-base bg-white"
                  aria-label="Código de país"
                >
                  {COUNTRY_CODES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.flag} {c.code}
                    </option>
                  ))}
                </select>
                <div className="relative flex-1">
                  <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                  <input
                    type="tel"
                    inputMode="numeric"
                    value={formData.phone}
                    onChange={(e) =>
                      setFormData({ ...formData, phone: e.target.value.replace(/\D/g, '').slice(0, 10) })
                    }
                    required
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent text-base"
                    placeholder="1234567890"
                  />
                </div>
              </div>
              <p className="mt-1 text-xs text-gray-500">Ingresa 10 dígitos, sin espacios.</p>
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
                <AddressAutocompleteInput
                  value={formData.street_address}
                  onChange={(val) => setFormData({ ...formData, street_address: val })}
                  onAddressSelect={(components: AddressComponents) => {
                    setFormData((prev) => ({
                      ...prev,
                      street_address: components.street || prev.street_address,
                      address_number: components.streetNumber || prev.address_number,
                      colonia: components.colonia || prev.colonia,
                      postal_code: components.postalCode || prev.postal_code,
                    }));
                  }}
                  placeholder="Buscar dirección..."
                  required
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
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent text-base"
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
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent text-base"
                placeholder="Depto 4B"
              />
            </div>

            <div>
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
              {postalCodeValid === false && formData.postal_code && (
                <div className="mt-3 flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4">
                  <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-amber-800">
                    <p className="font-medium">No tenemos servicio de entrega en el código postal {formData.postal_code}.</p>
                    <p className="mt-1">
                      Para más información, contáctanos
                      {whatsappPhone ? (
                        <a
                          href={`https://wa.me/${whatsappPhone.replace(/\D/g, '')}?text=${encodeURIComponent('Hola, me gustaría saber si tienen servicio en mi código postal: ' + formData.postal_code)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 ml-1 font-semibold text-green-700 hover:text-green-800 underline"
                        >
                          <MessageCircle className="h-4 w-4" />
                          por WhatsApp
                        </a>
                      ) : (
                        <span> por WhatsApp</span>
                      )}
                      .
                    </p>
                  </div>
                </div>
              )}
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
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent text-base"
                  placeholder="Colonia"
                />
              </div>

              <div>
                <DelegacionDropdown
                  selectedDelegacion={formData.delegacion}
                  onDelegacionSelect={(value) => setFormData({ ...formData, delegacion: value })}
                  required
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
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent text-base"
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

            <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
              <div className="flex items-center space-x-2">
                <Users className="w-5 h-5 text-gray-600" />
                <h3 className="text-base sm:text-lg font-semibold text-gray-900">
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
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent text-base"
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
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent text-base"
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
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent text-base"
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
    <div className="container mx-auto px-4 py-8 sm:py-16 max-w-3xl overflow-x-hidden">
      <Card className="p-4 sm:p-8 shadow-lg">
        <div className="text-center mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">Crea Tu Cuenta</h1>
          <p className="text-gray-600">Únete a Hola Dieta hoy</p>
        </div>

        <div className="mb-6 sm:mb-12">
          <div className="flex items-center justify-between">
            {STEPS.map((step, index) => {
              const Icon = step.icon;
              const isCompleted = step.id < currentStep;
              const isCurrent = step.id === currentStep;

              return (
                <div key={step.id} className="flex items-center flex-1">
                  <div className="flex flex-col items-center flex-1">
                    <div
                      className={`w-8 h-8 sm:w-12 sm:h-12 rounded-full flex items-center justify-center border-2 transition-colors ${
                        isCompleted
                          ? 'bg-green-500 border-green-500 text-white'
                          : isCurrent
                          ? 'bg-red-600 border-red-600 text-white'
                          : 'bg-white border-gray-300 text-gray-400'
                      }`}
                    >
                      {isCompleted ? <Check className="h-4 w-4 sm:h-6 sm:w-6" /> : <Icon className="h-4 w-4 sm:h-6 sm:w-6" />}
                    </div>
                    <span
                      className={`mt-1 sm:mt-2 text-[10px] sm:text-xs font-medium text-center leading-tight ${
                        isCurrent ? 'text-red-600' : isCompleted ? 'text-green-600' : 'text-gray-400'
                      }`}
                    >
                      {step.title}
                    </span>
                  </div>
                  {index < STEPS.length - 1 && (
                    <div
                      className={`h-0.5 sm:h-1 flex-1 mx-1 sm:mx-2 transition-colors ${
                        isCompleted ? 'bg-green-500' : 'bg-gray-300'
                      }`}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {searchParams.get('incomplete') === 'true' && !error && (
          <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-sm">
            Tu registro anterior no se completó correctamente. Por favor, llena tus datos nuevamente para terminar de crear tu cuenta.
          </div>
        )}

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
            {error.includes('ya está registrado') && (
              <div className="mt-2 flex gap-2">
                <Link to={`/login${returnTo !== '/account' ? `?returnTo=${encodeURIComponent(returnTo)}` : ''}`} className="text-red-600 hover:text-red-800 font-medium underline">
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
              disabled={loading || checkingEmail || emailStatus === 'blocked' || emailStatus === 'throttled'}
            >
              {checkingEmail ? 'Verificando...' : loading ? (
                  <span className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                    Activando cuenta...
                  </span>
                ) : currentStep === 0 && emailStatus === 'link_only' ? 'Activar Mi Cuenta' : 'Siguiente'}
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
          <Link to={`/login${returnTo !== '/account' ? `?returnTo=${encodeURIComponent(returnTo)}` : ''}`} className="text-red-600 hover:text-red-700 font-medium">
            Iniciar sesión
          </Link>
        </div>
      </Card>
    </div>
  );
};
