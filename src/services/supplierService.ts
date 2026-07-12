import { supabase } from '../config/supabase';
import { Supplier, CreateSupplierData, UpdateSupplierData, SupplierCategory } from '../types/supplier';

export class SupplierService {
  // Generate next supplier ID (PV1, PV2, PV3...)
  private async generateNextSupplierId(): Promise<string> {
    const { data, error } = await supabase
      .from('suppliers')
      .select('supplier_id');

    if (error) {
      console.error('Error fetching last supplier ID:', error);
      return `PV${Math.floor(Math.random() * 100000000)}`;
    }

    if (!data || data.length === 0) {
      return 'PV1';
    }

    // Parse all numeric parts and find the maximum
    const numericParts = data
      .map(item => parseInt(item.supplier_id.replace('PV', '')))
      .filter(num => !isNaN(num));
    
    const maxNumber = numericParts.length > 0 ? Math.max(...numericParts) : 0;
    return `PV${maxNumber + 1}`;
  }

  // Create new supplier
  async createSupplier(supplierData: CreateSupplierData): Promise<Supplier> {
    const supplier_id = await this.generateNextSupplierId();

    const { data, error } = await supabase
      .from('suppliers')
      .insert([
        {
          supplier_id,
          supplier_name: supplierData.supplier_name,
          supplier_category: supplierData.supplier_category,
          contact_person: supplierData.contact_person || '',
          email: supplierData.email || '',
          phone: supplierData.phone || '',
          address: supplierData.address || '',
          description: supplierData.description || '',
          rfc: supplierData.rfc || '',
          postal_code: supplierData.postal_code || '',
          tax_regime: supplierData.tax_regime || '',
          neighborhood: supplierData.neighborhood || '',
          is_active: supplierData.is_active ?? true
        }
      ])
      .select()
      .single();

    if (error) {
      throw new Error(`Error creating supplier: ${error.message}`);
    }

    return data;
  }

  // Get all suppliers
  async getSuppliers(): Promise<Supplier[]> {
    const { data, error } = await supabase
      .from('suppliers')
      .select('*')
      .order('created_at', { ascending: true });

    if (error) {
      throw new Error(`Error fetching suppliers: ${error.message}`);
    }

    return data || [];
  }

  // Get single supplier by ID
  async getSupplierById(id: string): Promise<Supplier | null> {
    const { data, error } = await supabase
      .from('suppliers')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Not found
      }
      throw new Error(`Error fetching supplier: ${error.message}`);
    }

    return data;
  }

  // Update supplier
  async updateSupplier(id: string, updateData: UpdateSupplierData): Promise<Supplier> {
    const { data, error } = await supabase
      .from('suppliers')
      .update({
        supplier_name: updateData.supplier_name,
        supplier_category: updateData.supplier_category,
        contact_person: updateData.contact_person,
        email: updateData.email,
        phone: updateData.phone,
        address: updateData.address,
        description: updateData.description,
        rfc: updateData.rfc,
        postal_code: updateData.postal_code,
        tax_regime: updateData.tax_regime,
        neighborhood: updateData.neighborhood,
        is_active: updateData.is_active
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Error updating supplier: ${error.message}`);
    }

    return data;
  }

  // Check if supplier can be deleted (no linked ingredients)
  async canDeleteSupplier(supplierId: string): Promise<{ canDelete: boolean; linkedIngredientsCount: number }> {
    const { data, error } = await supabase
      .from('ingredients')
      .select('id')
      .eq('supplier_id', supplierId);

    if (error) {
      throw new Error(`Error checking supplier dependencies: ${error.message}`);
    }

    const linkedIngredientsCount = data ? data.length : 0;
    return {
      canDelete: linkedIngredientsCount === 0,
      linkedIngredientsCount
    };
  }

  // Delete supplier
  async deleteSupplier(id: string): Promise<void> {
    const { error } = await supabase
      .from('suppliers')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`Error deleting supplier: ${error.message}`);
    }
  }

  // Toggle supplier active status
  async toggleSupplierStatus(id: string, isActive: boolean): Promise<Supplier> {
    return this.updateSupplier(id, { is_active: isActive });
  }
}

export const supplierService = new SupplierService();