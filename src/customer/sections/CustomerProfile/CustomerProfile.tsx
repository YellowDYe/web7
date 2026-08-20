import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '../../../config/supabase';
import { useCustomerAuth } from '../../contexts/CustomerAuthContext';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { OrderHistory } from '../../components/OrderHistory';
import { CustomerAccountEditModal } from '../../components/CustomerAccountEditModal';
import { useIngredientNames } from '../../hooks/useIngredientNames';
import { familyMemberService } from '../../../services/familyMemberService';
import RestrictionSelector from '../../../components/customers/RestrictionSelector';
import { FamilyMember } from '../../../types/familyMember';
import { User, Mail, Phone, MapPin, FileText, CircleAlert as AlertCircle, CreditCard as Edit, Package, IdCard, Users, X, Save, Trash2 } from 'lucide-react';

export const CustomerProfile: React.FC = () => {
  const { customer, user, loading, logout } = useCustomerAuth();
  const { getIngredientName, loading: ingredientsLoading } = useIngredientNames();
  const [searchParams] = useSearchParams();
  const [showEditModal, setShowEditModal] = useState(false);
  const [showRestrictionsModal, setShowRestrictionsModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'profile' | 'orders'>(
    searchParams.get('tab') === 'orders' ? 'orders' : 'profile'
  );
  const [showError, setShowError] = useState(false);
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([]);
  const [familyMembersLoading, setFamilyMembersLoading] = useState(false);

  useEffect(() => {
    if (user && !customer && !loading) {
      const timer = setTimeout(() => {
        setShowError(true);
      }, 3000);
      return () => clearTimeout(timer);
    } else {
      setShowError(false);
    }
  }, [user, customer, loading]);

  useEffect(() => {
    if (customer?.id) {
      loadFamilyMembers();
    }
  }, [customer?.id]);

  const loadFamilyMembers = async () => {
    if (!customer?.id) return;

    try {
      setFamilyMembersLoading(true);
      const members = await familyMemberService.getFamilyMembersByCustomerId(customer.id);
      setFamilyMembers(members);
    } catch (error) {
      console.error('Error loading family members:', error);
    } finally {
      setFamilyMembersLoading(false);
    }
  };

  if (loading || (user && !customer && !showError)) {
    return (
      <div className="container mx-auto px-4 py-16">
        <Card className="p-8 text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-red-600 mx-auto mb-4"></div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Cargando Cuenta...</h2>
          <p className="text-gray-600">Por favor espera mientras cargamos tu información.</p>
        </Card>
      </div>
    );
  }

  if (user && !customer && showError) {
    return (
      <div className="container mx-auto px-4 py-16">
        <Card className="p-8 text-center max-w-2xl mx-auto">
          <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            No se pudo cargar tu perfil
          </h2>
          <p className="text-gray-600 mb-6">
            Tu sesión está activa, pero no pudimos cargar tu información de cliente.
          </p>
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 mb-6 text-left">
            <h3 className="font-semibold text-gray-900 mb-3">Pasos para resolver:</h3>
            <ol className="space-y-2 text-gray-700 list-decimal list-inside">
              <li>Cierra sesión e inicia sesión nuevamente</li>
              <li>Si el error persiste, contacta a soporte</li>
            </ol>
            {user?.email && (
              <div className="mt-4 pt-4 border-t border-yellow-300">
                <p className="text-sm text-gray-600">
                  <span className="font-medium">Correo registrado:</span> {user.email}
                </p>
              </div>
            )}
          </div>
          <Button
            onClick={async () => {
              try {
                await logout();
                window.location.href = '/login';
              } catch (error) {
                console.error('Logout error:', error);
              }
            }}
            className="bg-red-600 hover:bg-red-700 text-white"
          >
            Cerrar Sesión
          </Button>
        </Card>
      </div>
    );
  }

  if (!user) {
    window.location.href = '/login';
    return null;
  }

  if (!customer) {
    return null;
  }

  const renderProfileTab = () => (
    <div className="space-y-6">
      <Card className="p-6">
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
              <User className="h-6 w-6 text-red-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Información Personal</h2>
              <p className="text-sm text-gray-600">Detalles de tu cuenta</p>
            </div>
          </div>
          <Button
            onClick={() => setShowEditModal(true)}
            variant="outline"
            size="sm"
            className="flex items-center gap-2"
          >
            <Edit className="h-4 w-4" />
            Editar
          </Button>
        </div>

        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <label className="text-sm font-medium text-red-700 flex items-center gap-2 mb-2">
            <IdCard className="h-4 w-4" />
            ID de Cliente
          </label>
          <p className="text-2xl font-bold text-red-900 font-mono tracking-wide">
            {customer.customer_id}
          </p>
          <p className="text-xs text-red-600 mt-1">
            Usa este ID al contactar con soporte
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="text-sm font-medium text-gray-500">Nombre</label>
            <p className="text-gray-900 mt-1">{customer.customer_name}</p>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-500">Apellido</label>
            <p className="text-gray-900 mt-1">{customer.customer_lastname}</p>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-500 flex items-center gap-1">
              <Mail className="h-4 w-4" />
              Correo Electrónico
            </label>
            <p className="text-gray-900 mt-1">{customer.customer_email}</p>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-500 flex items-center gap-1">
              <Phone className="h-4 w-4" />
              Teléfono
            </label>
            <p className="text-gray-900 mt-1">{customer.customer_phone}</p>
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
              <MapPin className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Dirección de Entrega</h2>
              <p className="text-sm text-gray-600">Donde enviaremos tus comidas</p>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-500">Dirección</label>
            <p className="text-gray-900 mt-1">
              {customer.customer_street} {customer.customer_street_number}
              {customer.customer_interior_number && `, Int. ${customer.customer_interior_number}`}
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-500">Colonia</label>
              <p className="text-gray-900 mt-1">{customer.customer_colonia}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">Delegación</label>
              <p className="text-gray-900 mt-1">{customer.customer_delegacion}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">Código Postal</label>
              <p className="text-gray-900 mt-1">{customer.customer_postal_code}</p>
            </div>
          </div>
          {customer.customer_delivery_instructions && (
            <div>
              <label className="text-sm font-medium text-gray-500">Instrucciones de Entrega</label>
              <p className="text-gray-900 mt-1">{customer.customer_delivery_instructions}</p>
            </div>
          )}
        </div>
      </Card>

      <Card className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center">
              <AlertCircle className="h-6 w-6 text-orange-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Restricciones Alimenticias</h2>
              <p className="text-sm text-gray-600">Tus preferencias alimenticias</p>
            </div>
          </div>
          <Button
            onClick={() => setShowRestrictionsModal(true)}
            variant="outline"
            size="sm"
            className="flex items-center gap-2"
          >
            <Edit className="h-4 w-4" />
            Editar
          </Button>
        </div>
        {ingredientsLoading ? (
          <div className="flex items-center gap-2 text-gray-600">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-orange-600"></div>
            <span className="text-sm">Cargando restricciones...</span>
          </div>
        ) : customer.customer_restrictions && customer.customer_restrictions.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {customer.customer_restrictions.map((restrictionId, index) => (
              <span
                key={index}
                className="px-3 py-1 bg-orange-50 text-orange-700 rounded-full text-sm font-medium border border-orange-200"
              >
                {getIngredientName(restrictionId)}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-gray-500 text-sm">
            No tienes restricciones alimenticias registradas. Haz clic en "Editar" para agregar.
          </p>
        )}
      </Card>

      <Card className="p-6">
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
              <Users className="h-6 w-6 text-purple-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Miembros Familiares</h2>
              <p className="text-sm text-gray-600">
                {familyMembers.length > 0
                  ? `${familyMembers.length} de 5 miembros`
                  : 'Agrega miembros familiares'}
              </p>
            </div>
          </div>
          <Button
            onClick={() => setShowEditModal(true)}
            variant="outline"
            size="sm"
            className="flex items-center gap-2"
          >
            <Edit className="h-4 w-4" />
            Editar
          </Button>
        </div>

        {familyMembersLoading ? (
          <div className="flex items-center gap-2 text-gray-600">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-purple-600"></div>
            <span className="text-sm">Cargando miembros...</span>
          </div>
        ) : familyMembers.length === 0 ? (
          <p className="text-gray-600 text-sm">
            No has agregado miembros familiares. Haz clic en "Editar" para agregar.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {familyMembers.map((member) => (
              <div key={member.id} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                    <Users className="h-4 w-4 text-purple-600" />
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-900">{member.family_member_name}</h4>
                    <p className="text-xs text-gray-500">{member.family_member_id}</p>
                  </div>
                </div>
                {member.family_member_restrictions.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-gray-700 mb-1">Restricciones:</p>
                    <div className="flex flex-wrap gap-1">
                      {member.family_member_restrictions.map((restrictionId, index) => (
                        <span
                          key={index}
                          className="px-2 py-0.5 bg-orange-50 text-orange-700 rounded-full text-xs border border-orange-200"
                        >
                          {getIngredientName(restrictionId)}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {member.family_member_restrictions.length === 0 && (
                  <p className="text-xs text-gray-500 italic">Sin restricciones</p>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      {(customer.rfc || customer.billing_name) && (
        <Card className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
              <FileText className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Información de Facturación</h2>
              <p className="text-sm text-gray-600">Para facturas</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {customer.rfc && (
              <div>
                <label className="text-sm font-medium text-gray-500">RFC</label>
                <p className="text-gray-900 mt-1 font-mono">{customer.rfc}</p>
              </div>
            )}
            {customer.billing_name && (
              <div>
                <label className="text-sm font-medium text-gray-500">Nombre de Facturación</label>
                <p className="text-gray-900 mt-1">{customer.billing_name}</p>
              </div>
            )}
            {customer.tax_regime && (
              <div>
                <label className="text-sm font-medium text-gray-500">Régimen Fiscal</label>
                <p className="text-gray-900 mt-1">{customer.tax_regime}</p>
              </div>
            )}
            {customer.billing_street && (
              <div className="md:col-span-2">
                <label className="text-sm font-medium text-gray-500">Dirección de Facturación</label>
                <p className="text-gray-900 mt-1">{customer.billing_street}</p>
              </div>
            )}
          </div>
        </Card>
      )}

      <Card className="p-6 border-red-200 bg-red-50/30">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
              <Trash2 className="h-6 w-6 text-red-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Eliminar Cuenta</h2>
              <p className="text-sm text-gray-600">Eliminar permanentemente tu cuenta y datos personales</p>
            </div>
          </div>
          <Button
            onClick={() => setShowDeleteModal(true)}
            variant="outline"
            size="sm"
            className="border-red-300 text-red-700 hover:bg-red-100 hover:border-red-400"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Eliminar
          </Button>
        </div>
        <p className="mt-3 text-sm text-gray-600 ml-15">
          Esta acción es irreversible. Se eliminará tu acceso y datos personales. Tu historial de pedidos se conservará de forma anónima.
        </p>
      </Card>
    </div>
  );

  const renderOrdersTab = () => (
    <div>
      <Card className="p-6 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
            <Package className="h-6 w-6 text-green-600" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Historial de Pedidos</h2>
            <p className="text-sm text-gray-600">Ver todos tus pedidos anteriores</p>
          </div>
        </div>
      </Card>
      <OrderHistory customerId={customer.id} />
    </div>
  );

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Mi Cuenta</h1>
        <p className="text-gray-600">
          Bienvenido, {customer.customer_name} {customer.customer_lastname}
        </p>
      </div>

      <div className="flex gap-4 mb-6 border-b border-gray-200">
        <button
          onClick={() => setActiveTab('profile')}
          className={`pb-4 px-4 font-medium transition-colors border-b-2 ${
            activeTab === 'profile'
              ? 'border-red-600 text-red-600'
              : 'border-transparent text-gray-600 hover:text-gray-900'
          }`}
        >
          <div className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Perfil
          </div>
        </button>
        <button
          onClick={() => setActiveTab('orders')}
          className={`pb-4 px-4 font-medium transition-colors border-b-2 ${
            activeTab === 'orders'
              ? 'border-red-600 text-red-600'
              : 'border-transparent text-gray-600 hover:text-gray-900'
          }`}
        >
          <div className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Pedidos
          </div>
        </button>
      </div>

      {activeTab === 'profile' ? renderProfileTab() : renderOrdersTab()}

      {showEditModal && (
        <CustomerAccountEditModal
          customer={customer}
          onClose={() => setShowEditModal(false)}
          onSave={() => {
            setShowEditModal(false);
            loadFamilyMembers();
          }}
        />
      )}

      {showRestrictionsModal && (
        <RestrictionsEditModal
          currentRestrictions={customer.customer_restrictions || []}
          onClose={() => setShowRestrictionsModal(false)}
          onSave={() => setShowRestrictionsModal(false)}
        />
      )}

      {showDeleteModal && (
        <DeleteAccountModal
          customerEmail={customer.customer_email}
          onClose={() => setShowDeleteModal(false)}
          onDeleted={async () => {
            await logout();
            window.location.href = '/';
          }}
        />
      )}
    </div>
  );
};

function RestrictionsEditModal({
  currentRestrictions,
  onClose,
  onSave,
}: {
  currentRestrictions: string[];
  onClose: () => void;
  onSave: () => void;
}) {
  const { updateCustomerProfile } = useCustomerAuth();
  const [restrictions, setRestrictions] = useState<string[]>(currentRestrictions);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      await updateCustomerProfile({ customer_restrictions: restrictions });
      onSave();
    } catch (err: any) {
      setError(err.message || 'No se pudo guardar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <Card className="w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b p-6 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">Editar Restricciones Alimenticias</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">
              {error}
            </div>
          )}

          <p className="text-sm text-gray-600">
            Selecciona los ingredientes a los que eres alérgico o que deseas evitar.
          </p>

          <RestrictionSelector
            selectedRestrictions={restrictions}
            onRestrictionsChange={setRestrictions}
          />

          <div className="flex gap-3 pt-4 border-t">
            <Button
              onClick={onClose}
              variant="outline"
              className="flex-1"
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSave}
              className="flex-1 bg-red-600 hover:bg-red-700 text-white"
              disabled={saving}
            >
              {saving ? (
                <span className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                  Guardando...
                </span>
              ) : (
                <span className="flex items-center justify-center">
                  <Save className="h-5 w-5 mr-2" />
                  Guardar
                </span>
              )}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

function DeleteAccountModal({
  customerEmail,
  onClose,
  onDeleted,
}: {
  customerEmail: string;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [confirmEmail, setConfirmEmail] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  const isConfirmed = confirmEmail.toLowerCase() === customerEmail.toLowerCase();

  const handleDelete = async () => {
    if (!isConfirmed) return;

    setDeleting(true);
    setError('');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('No hay sesión activa');
      }

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const res = await fetch(`${supabaseUrl}/functions/v1/delete-own-account`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
          apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Error al eliminar la cuenta');
      }

      onDeleted();
    } catch (err: any) {
      setError(err.message || 'No se pudo eliminar la cuenta');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <Card className="w-full max-w-md">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
              <Trash2 className="h-6 w-6 text-red-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Eliminar Cuenta</h2>
              <p className="text-sm text-gray-600">Esta acción no se puede deshacer</p>
            </div>
          </div>

          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-sm text-red-800">
              Al eliminar tu cuenta se borrará tu acceso y datos personales de forma permanente.
              Tu historial de pedidos se conservará de forma anónima.
            </p>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Escribe tu correo electrónico para confirmar:
            </label>
            <p className="text-xs text-gray-500 mb-2 font-mono">{customerEmail}</p>
            <input
              type="email"
              value={confirmEmail}
              onChange={(e) => setConfirmEmail(e.target.value)}
              placeholder="tu@correo.com"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
              autoComplete="off"
            />
          </div>

          <div className="flex gap-3">
            <Button
              onClick={onClose}
              variant="outline"
              className="flex-1"
              disabled={deleting}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleDelete}
              disabled={!isConfirmed || deleting}
              className="flex-1 bg-red-600 hover:bg-red-700 text-white disabled:opacity-50"
            >
              {deleting ? (
                <span className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Eliminando...
                </span>
              ) : (
                'Eliminar mi cuenta'
              )}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
