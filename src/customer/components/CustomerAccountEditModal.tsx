import { useState } from 'react';
import { X, Save } from 'lucide-react';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { useCustomerAuth } from '../contexts/CustomerAuthContext';
import RestrictionSelector from '../../components/customers/RestrictionSelector';
import PostalCodeSearchDropdown from '../../components/customers/PostalCodeSearchDropdown';
import TaxRegimeDropdown from '../../components/customers/TaxRegimeDropdown';
import FamilyMembersList from '../../components/customers/FamilyMembersList';
import type { Customer } from '../../types/customer';

interface CustomerAccountEditModalProps {
  customer: Customer;
  onClose: () => void;
  onSave: () => void;
}

export function CustomerAccountEditModal({ customer, onClose, onSave }: CustomerAccountEditModalProps) {
  const { updateCustomerProfile } = useCustomerAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [formData, setFormData] = useState({
    first_name: customer.customer_name || '',
    last_name: customer.customer_lastname || '',
    phone: customer.customer_phone || '',
    street_address: customer.customer_street || '',
    address_number: customer.customer_street_number || '',
    interior_number: customer.customer_interior_number || '',
    colonia: customer.customer_colonia || '',
    delegacion: customer.customer_delegacion || '',
    postal_code: customer.customer_postal_code || '',
    delivery_instructions: customer.customer_delivery_instructions || '',
    restrictions: customer.customer_restrictions || [],
    rfc: customer.rfc || '',
    invoice_name: customer.billing_name || '',
    tax_regime: customer.tax_regime || '',
    billing_street: customer.billing_street || '',
    billing_exterior_number: customer.billing_exterior_number || '',
    billing_interior_number: customer.billing_interior_number || '',
    billing_postal_code: customer.billing_postal_code || '',
    billing_neighborhood: customer.billing_neighborhood || '',
    billing_municipality: customer.billing_municipality || '',
    billing_state: customer.billing_state || '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      // Map the simplified form field names to database column names
      const mappedData: Partial<Customer> = {
        customer_name: formData.first_name,
        customer_lastname: formData.last_name,
        customer_phone: formData.phone,
        customer_street: formData.street_address,
        customer_street_number: formData.address_number,
        customer_interior_number: formData.interior_number,
        customer_colonia: formData.colonia,
        customer_delegacion: formData.delegacion,
        customer_postal_code: formData.postal_code,
        customer_delivery_instructions: formData.delivery_instructions,
        customer_restrictions: formData.restrictions,
        rfc: formData.rfc || undefined,
        billing_name: formData.invoice_name || undefined,
        tax_regime: formData.tax_regime || undefined,
        billing_street: formData.billing_street || undefined,
        billing_exterior_number: formData.billing_exterior_number || undefined,
        billing_interior_number: formData.billing_interior_number || undefined,
        billing_postal_code: formData.billing_postal_code || undefined,
        billing_neighborhood: formData.billing_neighborhood || undefined,
        billing_municipality: formData.billing_municipality || undefined,
        billing_state: formData.billing_state || undefined,
      };

      await updateCustomerProfile(mappedData);
      setSuccess('Profile updated successfully!');
      setTimeout(() => {
        onSave();
      }, 1500);
    } catch (err: any) {
      setError(err.message || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <Card className="w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b p-6 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900">Edit Profile</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm">
              {error}
            </div>
          )}

          {success && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-green-700 text-sm">
              {success}
            </div>
          )}

          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Personal Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  First Name *
                </label>
                <input
                  type="text"
                  value={formData.first_name}
                  onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Last Name *
                </label>
                <input
                  type="text"
                  value={formData.last_name}
                  onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Phone *
                </label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Delivery Address</h3>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Street Address *
                  </label>
                  <input
                    type="text"
                    value={formData.street_address}
                    onChange={(e) => setFormData({ ...formData, street_address: e.target.value })}
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Number *
                  </label>
                  <input
                    type="text"
                    value={formData.address_number}
                    onChange={(e) => setFormData({ ...formData, address_number: e.target.value })}
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Interior Number
                </label>
                <input
                  type="text"
                  value={formData.interior_number}
                  onChange={(e) => setFormData({ ...formData, interior_number: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                />
              </div>

              <div>
                <PostalCodeSearchDropdown
                  selectedPostalCode={formData.postal_code}
                  onPostalCodeSelect={(code, neighborhood) => {
                    setFormData({
                      ...formData,
                      postal_code: code,
                      colonia: neighborhood || formData.colonia,
                    });
                  }}
                  required
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
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
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
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Delivery Instructions
                </label>
                <textarea
                  value={formData.delivery_instructions}
                  onChange={(e) => setFormData({ ...formData, delivery_instructions: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Dietary Restrictions</h3>
            <RestrictionSelector
              selectedRestrictions={formData.restrictions}
              onRestrictionsChange={(restrictions) => setFormData({ ...formData, restrictions })}
            />
          </div>

          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Family Members</h3>
            <FamilyMembersList customerId={customer.id} />
          </div>

          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Billing Information</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">RFC</label>
                <input
                  type="text"
                  value={formData.rfc}
                  onChange={(e) => setFormData({ ...formData, rfc: e.target.value.toUpperCase() })}
                  maxLength={13}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Billing Name
                </label>
                <input
                  type="text"
                  value={formData.invoice_name}
                  onChange={(e) => setFormData({ ...formData, invoice_name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                />
              </div>

              <div>
                <TaxRegimeDropdown
                  selectedRegime={formData.tax_regime}
                  onRegimeSelect={(value) => setFormData({ ...formData, tax_regime: value })}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Billing Street
                  </label>
                  <input
                    type="text"
                    value={formData.billing_street}
                    onChange={(e) => setFormData({ ...formData, billing_street: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Exterior Number
                  </label>
                  <input
                    type="text"
                    value={formData.billing_exterior_number}
                    onChange={(e) => setFormData({ ...formData, billing_exterior_number: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Interior Number
                </label>
                <input
                  type="text"
                  value={formData.billing_interior_number}
                  onChange={(e) => setFormData({ ...formData, billing_interior_number: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                />
              </div>

              <div>
                <PostalCodeSearchDropdown
                  selectedPostalCode={formData.billing_postal_code}
                  onPostalCodeSelect={(code, neighborhood) => {
                    setFormData({
                      ...formData,
                      billing_postal_code: code,
                      billing_neighborhood: neighborhood || formData.billing_neighborhood,
                    });
                  }}
                  required={false}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Neighborhood (Colonia)
                  </label>
                  <input
                    type="text"
                    value={formData.billing_neighborhood}
                    onChange={(e) => setFormData({ ...formData, billing_neighborhood: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Municipality (Delegación)
                  </label>
                  <input
                    type="text"
                    value={formData.billing_municipality}
                    onChange={(e) => setFormData({ ...formData, billing_municipality: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  State
                </label>
                <input
                  type="text"
                  value={formData.billing_state}
                  onChange={(e) => setFormData({ ...formData, billing_state: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>

          <div className="flex gap-4 pt-6 border-t">
            <Button
              type="button"
              onClick={onClose}
              variant="outline"
              className="flex-1"
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="flex-1 bg-red-600 hover:bg-red-700 text-white"
              disabled={loading}
            >
              {loading ? (
                <span className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                  Saving...
                </span>
              ) : (
                <span className="flex items-center justify-center">
                  <Save className="h-5 w-5 mr-2" />
                  Save Changes
                </span>
              )}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
