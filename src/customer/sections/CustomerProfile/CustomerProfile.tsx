import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useCustomerAuth } from '../../contexts/CustomerAuthContext';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { OrderHistory } from '../../components/OrderHistory';
import { CustomerAccountEditModal } from '../../components/CustomerAccountEditModal';
import { useIngredientNames } from '../../hooks/useIngredientNames';
import { familyMemberService } from '../../../services/familyMemberService';
import { FamilyMember } from '../../../types/familyMember';
import {
  User,
  Mail,
  Phone,
  MapPin,
  FileText,
  AlertCircle,
  Edit,
  Package,
  IdCard,
  Users,
} from 'lucide-react';

export const CustomerProfile: React.FC = () => {
  const { customer, user, loading, logout } = useCustomerAuth();
  const { getIngredientName, loading: ingredientsLoading } = useIngredientNames();
  const [searchParams] = useSearchParams();
  const [showEditModal, setShowEditModal] = useState(false);
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
                window.location.href = '/shop/login';
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
    window.location.href = '/shop/login';
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

      {customer.customer_restrictions && customer.customer_restrictions.length > 0 && (
        <Card className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center">
              <AlertCircle className="h-6 w-6 text-orange-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Restricciones Alimenticias</h2>
              <p className="text-sm text-gray-600">Tus preferencias alimenticias</p>
            </div>
          </div>
          {ingredientsLoading ? (
            <div className="flex items-center gap-2 text-gray-600">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-orange-600"></div>
              <span className="text-sm">Cargando restricciones...</span>
            </div>
          ) : (
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
          )}
        </Card>
      )}

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
    </div>
  );
};
