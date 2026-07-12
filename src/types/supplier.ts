export type SupplierCategory = 
  | 'Alimentos'
  | 'Empaques' 
  | 'Servicios'
  | 'Bancarios'
  | 'Renta'
  | 'Gobierno'
  | 'Consumibles'
  | 'Activos'
  | 'Otros';

export const SUPPLIER_CATEGORIES: SupplierCategory[] = [
  'Alimentos',
  'Empaques',
  'Servicios', 
  'Bancarios',
  'Renta',
  'Gobierno',
  'Consumibles',
  'Activos',
  'Otros'
];

export interface Supplier {
  id: string;
  supplier_id: string;
  supplier_name: string;
  supplier_category: SupplierCategory;
  contact_person: string;
  email: string;
  phone: string;
  address: string;
  description: string;
  rfc: string;
  postal_code: string;
  tax_regime: string;
  neighborhood: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateSupplierData {
  supplier_name: string;
  supplier_category: SupplierCategory;
  country_code?: string;
  contact_person?: string;
  email?: string;
  phone?: string;
  address?: string;
  description?: string;
  rfc?: string;
  postal_code?: string;
  tax_regime?: string;
  neighborhood?: string;
  is_active?: boolean;
}

export interface UpdateSupplierData {
  supplier_name?: string;
  supplier_category?: SupplierCategory;
  contact_person?: string;
  email?: string;
  phone?: string;
  address?: string;
  description?: string;
  rfc?: string;
  postal_code?: string;
  tax_regime?: string;
  neighborhood?: string;
  is_active?: boolean;
}