import React, { useState, useEffect } from 'react';
import { Users, Plus, Search, Trash2, UserPlus, Link2, X, Loader as Loader2, CircleAlert as AlertCircle } from 'lucide-react';
import { Customer, AssociatedCustomer } from '../../types/customer';
import { customerAssociationService } from '../../services/customerAssociationService';

interface FamilyMembersAssociationProps {
  customerId: string;
  customerAddress?: {
    customer_street: string;
    customer_street_number: string;
    customer_interior_number: string;
    customer_colonia: string;
    customer_delegacion: string;
    customer_postal_code: string;
    customer_delivery_instructions: string;
    customer_phone: string;
    country_code: string;
  };
  onCreateNewMember?: (prefillData: Partial<Customer>) => void;
}

const FamilyMembersAssociation: React.FC<FamilyMembersAssociationProps> = ({
  customerId,
  customerAddress,
  onCreateNewMember,
}) => {
  const [associations, setAssociations] = useState<AssociatedCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showSearchPanel, setShowSearchPanel] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Customer[]>([]);
  const [searching, setSearching] = useState(false);
  const [linking, setLinking] = useState(false);

  useEffect(() => {
    loadAssociations();
  }, [customerId]);

  const loadAssociations = async () => {
    try {
      setLoading(true);
      const data = await customerAssociationService.getAssociatedCustomers(customerId);
      setAssociations(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }

    try {
      setSearching(true);
      const excludeIds = [customerId, ...associations.map(a => a.customer.id)];
      const results = await customerAssociationService.searchCustomersForAssociation(query, excludeIds);
      setSearchResults(results);
    } catch (err: any) {
      console.error('Search error:', err);
    } finally {
      setSearching(false);
    }
  };

  const handleLinkCustomer = async (associatedCustomerId: string) => {
    try {
      setLinking(true);
      await customerAssociationService.createAssociation(customerId, associatedCustomerId);
      await loadAssociations();
      setSearchResults(prev => prev.filter(c => c.id !== associatedCustomerId));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLinking(false);
    }
  };

  const handleRemoveAssociation = async (associationId: string) => {
    if (!confirm('Eliminar la asociacion familiar? (El cliente no sera eliminado)')) return;
    try {
      await customerAssociationService.removeAssociation(associationId);
      setAssociations(prev => prev.filter(a => a.association_id !== associationId));
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleCreateNew = () => {
    if (onCreateNewMember && customerAddress) {
      onCreateNewMember({
        customer_street: customerAddress.customer_street,
        customer_street_number: customerAddress.customer_street_number,
        customer_interior_number: customerAddress.customer_interior_number,
        customer_colonia: customerAddress.customer_colonia,
        customer_delegacion: customerAddress.customer_delegacion,
        customer_postal_code: customerAddress.customer_postal_code,
        customer_delivery_instructions: customerAddress.customer_delivery_instructions,
        customer_phone: customerAddress.customer_phone,
        country_code: customerAddress.country_code,
      } as any);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-2">
          <Users className="w-5 h-5 text-gray-600" />
          <h2 className="text-xl font-semibold text-gray-900">
            Miembros Familiares ({associations.length})
          </h2>
        </div>
        <div className="flex space-x-2">
          <button
            type="button"
            onClick={() => setShowSearchPanel(!showSearchPanel)}
            className="flex items-center space-x-2 px-3 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <Link2 className="w-4 h-4" />
            <span className="hidden sm:inline">Vincular Existente</span>
          </button>
          {onCreateNewMember && (
            <button
              type="button"
              onClick={handleCreateNew}
              className="flex items-center space-x-2 px-3 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
            >
              <UserPlus className="w-4 h-4" />
              <span className="hidden sm:inline">Crear Nuevo</span>
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
          <button onClick={() => setError(null)} className="ml-auto"><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Search Panel */}
      {showSearchPanel && (
        <div className="mb-6 p-4 bg-gray-50 border border-gray-200 rounded-xl">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-gray-700">Buscar cliente existente para vincular</h3>
            <button onClick={() => { setShowSearchPanel(false); setSearchResults([]); setSearchQuery(''); }}>
              <X className="w-4 h-4 text-gray-400 hover:text-gray-600" />
            </button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por nombre, email o telefono..."
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
            />
            {searching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-gray-400" />}
          </div>
          {searchResults.length > 0 && (
            <div className="mt-3 max-h-60 overflow-y-auto border border-gray-200 rounded-lg bg-white divide-y divide-gray-100">
              {searchResults.map((customer) => (
                <div key={customer.id} className="flex items-center justify-between p-3 hover:bg-gray-50">
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {customer.customer_name} {customer.customer_lastname}
                    </p>
                    <p className="text-xs text-gray-500">
                      {customer.customer_email || customer.customer_phone || 'Sin contacto'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleLinkCustomer(customer.id)}
                    disabled={linking}
                    className="flex items-center space-x-1 px-3 py-1.5 bg-primary-50 text-primary-700 rounded-lg hover:bg-primary-100 transition-colors text-sm"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Vincular</span>
                  </button>
                </div>
              ))}
            </div>
          )}
          {searchQuery.length >= 2 && searchResults.length === 0 && !searching && (
            <p className="mt-3 text-sm text-gray-500 text-center py-2">No se encontraron clientes</p>
          )}
        </div>
      )}

      {/* Associations List */}
      {associations.length === 0 ? (
        <div className="text-center py-8 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
          <Users className="w-12 h-12 text-gray-400 mx-auto mb-2" />
          <p className="text-gray-600">No hay miembros familiares asociados</p>
          <p className="text-sm text-gray-500 mt-1">
            Vincula un cliente existente o crea uno nuevo como miembro familiar
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {associations.map((assoc) => (
            <div
              key={assoc.association_id}
              className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                    <Users className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-900">
                      {assoc.customer.customer_name} {assoc.customer.customer_lastname}
                    </h4>
                    <p className="text-xs text-gray-500">
                      {assoc.customer.customer_email || assoc.customer.customer_phone || 'Sin contacto'}
                    </p>
                    {assoc.customer.customer_restrictions && assoc.customer.customer_restrictions.length > 0 && (
                      <p className="text-xs text-orange-600 mt-1">
                        {assoc.customer.customer_restrictions.length} restriccion(es)
                      </p>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemoveAssociation(assoc.association_id)}
                  className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                  title="Desvincular miembro"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default FamilyMembersAssociation;
