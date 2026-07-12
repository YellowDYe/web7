export interface Customer {
  id: string;
  customer_id: string;
  customer_name: string;
  customer_lastname: string;
  customer_email: string | null;
  customer_phone: string;
  customer_street: string;
  customer_street_number: string;
  customer_interior_number: string;
  customer_colonia: string;
  customer_delegacion: string;
  customer_postal_code: string;
  customer_delivery_instructions: string;
  customer_restrictions: string[]; // Array of ingredient IDs
  customer_notes: string;
  special_instructions: string | null;
  country_code: string;
  billing_name: string;
  rfc: string;
  billing_postal_code: string;
  billing_neighborhood: string;
  billing_street: string;
  billing_exterior_number: string;
  billing_interior_number: string;
  billing_state: string;
  billing_municipality: string;
  tax_regime: string;
  cfdi_use: string;
  family_member_1_name: string | null;
  family_member_1_restrictions: string[];
  family_member_1_special_instructions: string | null;
  family_member_2_name: string | null;
  family_member_2_restrictions: string[];
  family_member_2_special_instructions: string | null;
  family_member_3_name: string | null;
  family_member_3_restrictions: string[];
  family_member_3_special_instructions: string | null;
  family_member_4_name: string | null;
  family_member_4_restrictions: string[];
  family_member_4_special_instructions: string | null;
  family_member_5_name: string | null;
  family_member_5_restrictions: string[];
  family_member_5_special_instructions: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateCustomerData {
  customer_name: string;
  customer_lastname: string;
  customer_email?: string | null;
  customer_phone: string;
  customer_street: string;
  customer_street_number: string;
  customer_interior_number?: string;
  customer_colonia: string;
  customer_delegacion: string;
  customer_postal_code: string;
  customer_delivery_instructions?: string;
  customer_restrictions?: string[];
  customer_notes?: string;
  special_instructions?: string | null;
  country_code?: string;
  billing_name?: string;
  rfc?: string;
  billing_postal_code?: string;
  billing_neighborhood?: string;
  billing_street?: string;
  billing_exterior_number?: string;
  billing_interior_number?: string;
  billing_state?: string;
  billing_municipality?: string;
  tax_regime?: string;
  cfdi_use?: string;
  family_member_1_name?: string | null;
  family_member_1_restrictions?: string[];
  family_member_1_special_instructions?: string | null;
  family_member_2_name?: string | null;
  family_member_2_restrictions?: string[];
  family_member_2_special_instructions?: string | null;
  family_member_3_name?: string | null;
  family_member_3_restrictions?: string[];
  family_member_3_special_instructions?: string | null;
  family_member_4_name?: string | null;
  family_member_4_restrictions?: string[];
  family_member_4_special_instructions?: string | null;
  family_member_5_name?: string | null;
  family_member_5_restrictions?: string[];
  family_member_5_special_instructions?: string | null;
}

export interface UpdateCustomerData {
  customer_name?: string;
  customer_lastname?: string;
  customer_email?: string;
  customer_phone?: string;
  customer_street?: string;
  customer_street_number?: string;
  customer_interior_number?: string;
  customer_colonia?: string;
  customer_delegacion?: string;
  customer_postal_code?: string;
  customer_delivery_instructions?: string;
  customer_restrictions?: string[];
  customer_notes?: string;
  special_instructions?: string | null;
  country_code?: string;
  billing_name?: string;
  rfc?: string;
  billing_postal_code?: string;
  billing_neighborhood?: string;
  billing_street?: string;
  billing_exterior_number?: string;
  billing_interior_number?: string;
  billing_state?: string;
  billing_municipality?: string;
  tax_regime?: string;
  cfdi_use?: string;
  family_member_1_name?: string | null;
  family_member_1_restrictions?: string[];
  family_member_1_special_instructions?: string | null;
  family_member_2_name?: string | null;
  family_member_2_restrictions?: string[];
  family_member_2_special_instructions?: string | null;
  family_member_3_name?: string | null;
  family_member_3_restrictions?: string[];
  family_member_3_special_instructions?: string | null;
  family_member_4_name?: string | null;
  family_member_4_restrictions?: string[];
  family_member_4_special_instructions?: string | null;
  family_member_5_name?: string | null;
  family_member_5_restrictions?: string[];
  family_member_5_special_instructions?: string | null;
}

// Extended interface for display purposes with all computed fields
export interface CustomerWithDetails extends Customer {
  restriction_names?: string[];
  full_name?: string;
  full_address?: string;
}

// Customer association (family member linking)
export interface CustomerAssociation {
  id: string;
  primary_customer_id: string;
  associated_customer_id: string;
  relationship: string;
  created_at: string;
  // Joined data
  associated_customer?: Customer;
  primary_customer?: Customer;
}

export interface AssociatedCustomer {
  association_id: string;
  customer: Customer;
  relationship: string;
}

export interface RestrictionIngredient {
  id: string;
  ingredient_id: string;
  ingredient_name: string;
  ingredient_restriction: boolean;
  ingredient_spicy: boolean;
  category_name?: string;
}
// New interfaces for searchable restriction items
export interface SearchableIngredient {
  type: 'ingredient';
  id: string;
  ingredient_id: string;
  ingredient_name: string;
  category_name?: string;
}

export interface SearchableCategory {
  type: 'category';
  id: string;
  ingredient_category_id: string;
  ingredient_category: string;
  description: string;
}

export type SearchableRestrictionItem = SearchableIngredient | SearchableCategory;