import { supabase } from '../config/supabase';
import { Customer, CustomerAssociation, AssociatedCustomer } from '../types/customer';

class CustomerAssociationService {
  async getAssociatedCustomers(customerId: string): Promise<AssociatedCustomer[]> {
    const { data, error } = await supabase
      .from('customer_associations')
      .select(`
        id,
        primary_customer_id,
        associated_customer_id,
        relationship,
        created_at,
        associated_customer:customers!customer_associations_associated_customer_id_fkey(*)
      `)
      .eq('primary_customer_id', customerId);

    if (error) throw new Error(`Error al cargar miembros familiares: ${error.message}`);

    return (data || []).map((assoc: any) => ({
      association_id: assoc.id,
      customer: assoc.associated_customer as Customer,
      relationship: assoc.relationship,
    }));
  }

  async getPrimaryCustomer(associatedCustomerId: string): Promise<AssociatedCustomer | null> {
    const { data, error } = await supabase
      .from('customer_associations')
      .select(`
        id,
        primary_customer_id,
        associated_customer_id,
        relationship,
        created_at,
        primary_customer:customers!customer_associations_primary_customer_id_fkey(*)
      `)
      .eq('associated_customer_id', associatedCustomerId)
      .maybeSingle();

    if (error) throw new Error(`Error al cargar cliente principal: ${error.message}`);
    if (!data) return null;

    return {
      association_id: data.id,
      customer: (data as any).primary_customer as Customer,
      relationship: data.relationship,
    };
  }

  async createAssociation(primaryCustomerId: string, associatedCustomerId: string, relationship = 'family'): Promise<CustomerAssociation> {
    const { data, error } = await supabase
      .from('customer_associations')
      .insert({
        primary_customer_id: primaryCustomerId,
        associated_customer_id: associatedCustomerId,
        relationship,
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        throw new Error('Este cliente ya está asociado como miembro familiar.');
      }
      throw new Error(`Error al crear asociación: ${error.message}`);
    }

    return data;
  }

  async removeAssociation(associationId: string): Promise<void> {
    const { error } = await supabase
      .from('customer_associations')
      .delete()
      .eq('id', associationId);

    if (error) throw new Error(`Error al eliminar asociación: ${error.message}`);
  }

  async searchCustomersForAssociation(query: string, excludeIds: string[]): Promise<Customer[]> {
    let queryBuilder = supabase
      .from('customers')
      .select('*')
      .or(`customer_name.ilike.%${query}%,customer_lastname.ilike.%${query}%,customer_email.ilike.%${query}%,customer_phone.ilike.%${query}%`)
      .limit(10);

    if (excludeIds.length > 0) {
      queryBuilder = queryBuilder.not('id', 'in', `(${excludeIds.join(',')})`);
    }

    const { data, error } = await queryBuilder;

    if (error) throw new Error(`Error al buscar clientes: ${error.message}`);
    return data || [];
  }
}

export const customerAssociationService = new CustomerAssociationService();
