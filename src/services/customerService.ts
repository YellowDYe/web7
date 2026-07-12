import { supabase } from '../config/supabase';
import { Customer, CreateCustomerData, UpdateCustomerData, SearchableRestrictionItem, SearchableIngredient, SearchableCategory } from '../types/customer';

export class CustomerService {
  // Generate next customer ID
  async generateNextCustomerId(): Promise<string> {
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('customer_id');

      if (error) throw error;

      if (!data || data.length === 0) {
        return 'CUST-0001';
      }

      // Parse all numeric parts and find the maximum
      const numericParts = data
        .map(item => parseInt(item.customer_id.replace('CUST-', '')))
        .filter(num => !isNaN(num));
      
      const maxNumber = numericParts.length > 0 ? Math.max(...numericParts) : 0;
      const nextNumber = maxNumber + 1;
      return `CUST-${nextNumber.toString().padStart(4, '0')}`;
    } catch (error) {
      console.error('Error generating customer ID:', error);
      throw error;
    }
  }

  // Create a new customer
  async createCustomer(customerData: CreateCustomerData): Promise<Customer> {
    try {
      // Check if email already exists
      if (customerData.customer_email) {
        const { data: existingCustomers } = await supabase
          .from('customers')
          .select('id, customer_email')
          .eq('customer_email', customerData.customer_email)
          .limit(1);

        if (existingCustomers && existingCustomers.length > 0) {
          throw new Error('Ya existe un cliente con este correo electrónico');
        }
      }

      const customerId = await this.generateNextCustomerId();

      const { data, error } = await supabase
        .from('customers')
        .insert({
          customer_id: customerId,
          customer_name: customerData.customer_name,
          customer_lastname: customerData.customer_lastname,
          customer_email: customerData.customer_email,
          customer_phone: customerData.customer_phone,
          customer_street: customerData.customer_street,
          customer_street_number: customerData.customer_street_number,
          customer_interior_number: customerData.customer_interior_number || '',
          customer_colonia: customerData.customer_colonia,
          customer_delegacion: customerData.customer_delegacion,
          customer_postal_code: customerData.customer_postal_code,
          customer_delivery_instructions: customerData.customer_delivery_instructions || '',
          customer_restrictions: customerData.customer_restrictions || [],
          customer_notes: customerData.customer_notes || '',
          special_instructions: customerData.special_instructions || null,
          country_code: customerData.country_code || '+52',
          billing_name: customerData.billing_name || '',
          rfc: customerData.rfc || '',
          billing_postal_code: customerData.billing_postal_code || '',
          billing_neighborhood: customerData.billing_neighborhood || '',
          billing_street: customerData.billing_street || '',
          billing_exterior_number: customerData.billing_exterior_number || '',
          billing_interior_number: customerData.billing_interior_number || '',
          billing_state: customerData.billing_state || '',
          billing_municipality: customerData.billing_municipality || '',
          tax_regime: customerData.tax_regime || '',
          family_member_1_name: customerData.family_member_1_name || null,
          family_member_1_restrictions: customerData.family_member_1_restrictions || [],
          family_member_1_special_instructions: customerData.family_member_1_special_instructions || null,
          family_member_2_name: customerData.family_member_2_name || null,
          family_member_2_restrictions: customerData.family_member_2_restrictions || [],
          family_member_2_special_instructions: customerData.family_member_2_special_instructions || null,
          family_member_3_name: customerData.family_member_3_name || null,
          family_member_3_restrictions: customerData.family_member_3_restrictions || [],
          family_member_3_special_instructions: customerData.family_member_3_special_instructions || null,
          family_member_4_name: customerData.family_member_4_name || null,
          family_member_4_restrictions: customerData.family_member_4_restrictions || [],
          family_member_4_special_instructions: customerData.family_member_4_special_instructions || null,
          family_member_5_name: customerData.family_member_5_name || null,
          family_member_5_restrictions: customerData.family_member_5_restrictions || [],
          family_member_5_special_instructions: customerData.family_member_5_special_instructions || null
        })
        .select()
        .single();

      if (error) {
        // Handle unique constraint violation
        if (error.code === '23505' && error.message.includes('customers_email_unique')) {
          throw new Error('Ya existe un cliente con este correo electrónico');
        }
        throw error;
      }
      return data;
    } catch (error: any) {
      console.error('Error creating customer:', error);
      // Provide user-friendly error messages
      if (error.message === 'Ya existe un cliente con este correo electrónico') {
        throw error;
      }
      throw error;
    }
  }

  // Get all customers
  async getCustomers(): Promise<Customer[]> {
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching customers:', error);
      throw error;
    }
  }

  // Get customer by ID
  async getCustomerById(customerId: string): Promise<Customer | null> {
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('id', customerId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null; // Customer not found
        }
        throw error;
      }
      return data;
    } catch (error) {
      console.error('Error fetching customer:', error);
      throw error;
    }
  }

  // Get customer by human-readable customer_id (e.g., "CUST-0019")
  async getCustomerByHumanReadableId(customerId: string): Promise<Customer | null> {
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('customer_id', customerId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null; // Customer not found
        }
        throw error;
      }
      return data;
    } catch (error) {
      console.error('Error fetching customer by human-readable ID:', error);
      throw error;
    }
  }

  // Update customer
  async updateCustomer(customerId: string, customerData: UpdateCustomerData): Promise<Customer> {
    try {
      // Check if email is being updated and if it already exists
      if (customerData.customer_email !== undefined) {
        const { data: existingCustomers } = await supabase
          .from('customers')
          .select('id, customer_email')
          .eq('customer_email', customerData.customer_email)
          .neq('id', customerId)
          .limit(1);

        if (existingCustomers && existingCustomers.length > 0) {
          throw new Error('Ya existe un cliente con este correo electrónico');
        }
      }

      const updatePayload: any = {
        updated_at: new Date().toISOString()
      };

      if (customerData.customer_name !== undefined) updatePayload.customer_name = customerData.customer_name;
      if (customerData.customer_lastname !== undefined) updatePayload.customer_lastname = customerData.customer_lastname;
      if (customerData.customer_email !== undefined) updatePayload.customer_email = customerData.customer_email;
      if (customerData.customer_phone !== undefined) updatePayload.customer_phone = customerData.customer_phone;
      if (customerData.customer_street !== undefined) updatePayload.customer_street = customerData.customer_street;
      if (customerData.customer_street_number !== undefined) updatePayload.customer_street_number = customerData.customer_street_number;
      if (customerData.customer_interior_number !== undefined) updatePayload.customer_interior_number = customerData.customer_interior_number;
      if (customerData.customer_colonia !== undefined) updatePayload.customer_colonia = customerData.customer_colonia;
      if (customerData.customer_delegacion !== undefined) updatePayload.customer_delegacion = customerData.customer_delegacion;
      if (customerData.customer_postal_code !== undefined) updatePayload.customer_postal_code = customerData.customer_postal_code;
      if (customerData.customer_delivery_instructions !== undefined) updatePayload.customer_delivery_instructions = customerData.customer_delivery_instructions;
      if (customerData.customer_restrictions !== undefined) updatePayload.customer_restrictions = customerData.customer_restrictions;
      if (customerData.customer_notes !== undefined) updatePayload.customer_notes = customerData.customer_notes;
      if (customerData.special_instructions !== undefined) updatePayload.special_instructions = customerData.special_instructions;
      if (customerData.country_code !== undefined) updatePayload.country_code = customerData.country_code;
      if (customerData.billing_name !== undefined) updatePayload.billing_name = customerData.billing_name;
      if (customerData.rfc !== undefined) updatePayload.rfc = customerData.rfc;
      if (customerData.billing_postal_code !== undefined) updatePayload.billing_postal_code = customerData.billing_postal_code;
      if (customerData.billing_neighborhood !== undefined) updatePayload.billing_neighborhood = customerData.billing_neighborhood;
      if (customerData.billing_street !== undefined) updatePayload.billing_street = customerData.billing_street;
      if (customerData.billing_exterior_number !== undefined) updatePayload.billing_exterior_number = customerData.billing_exterior_number;
      if (customerData.billing_interior_number !== undefined) updatePayload.billing_interior_number = customerData.billing_interior_number;
      if (customerData.billing_state !== undefined) updatePayload.billing_state = customerData.billing_state;
      if (customerData.billing_municipality !== undefined) updatePayload.billing_municipality = customerData.billing_municipality;
      if (customerData.tax_regime !== undefined) updatePayload.tax_regime = customerData.tax_regime;

      if (customerData.family_member_1_name !== undefined) updatePayload.family_member_1_name = customerData.family_member_1_name;
      if (customerData.family_member_1_restrictions !== undefined) updatePayload.family_member_1_restrictions = customerData.family_member_1_restrictions;
      if (customerData.family_member_1_special_instructions !== undefined) updatePayload.family_member_1_special_instructions = customerData.family_member_1_special_instructions;
      if (customerData.family_member_2_name !== undefined) updatePayload.family_member_2_name = customerData.family_member_2_name;
      if (customerData.family_member_2_restrictions !== undefined) updatePayload.family_member_2_restrictions = customerData.family_member_2_restrictions;
      if (customerData.family_member_2_special_instructions !== undefined) updatePayload.family_member_2_special_instructions = customerData.family_member_2_special_instructions;
      if (customerData.family_member_3_name !== undefined) updatePayload.family_member_3_name = customerData.family_member_3_name;
      if (customerData.family_member_3_restrictions !== undefined) updatePayload.family_member_3_restrictions = customerData.family_member_3_restrictions;
      if (customerData.family_member_3_special_instructions !== undefined) updatePayload.family_member_3_special_instructions = customerData.family_member_3_special_instructions;
      if (customerData.family_member_4_name !== undefined) updatePayload.family_member_4_name = customerData.family_member_4_name;
      if (customerData.family_member_4_restrictions !== undefined) updatePayload.family_member_4_restrictions = customerData.family_member_4_restrictions;
      if (customerData.family_member_4_special_instructions !== undefined) updatePayload.family_member_4_special_instructions = customerData.family_member_4_special_instructions;
      if (customerData.family_member_5_name !== undefined) updatePayload.family_member_5_name = customerData.family_member_5_name;
      if (customerData.family_member_5_restrictions !== undefined) updatePayload.family_member_5_restrictions = customerData.family_member_5_restrictions;
      if (customerData.family_member_5_special_instructions !== undefined) updatePayload.family_member_5_special_instructions = customerData.family_member_5_special_instructions;

      const { data, error } = await supabase
        .from('customers')
        .update(updatePayload)
        .eq('id', customerId)
        .select()
        .single();

      if (error) {
        // Handle unique constraint violation
        if (error.code === '23505' && error.message.includes('customers_email_unique')) {
          throw new Error('Ya existe un cliente con este correo electrónico');
        }
        throw error;
      }
      return data;
    } catch (error: any) {
      console.error('Error updating customer:', error);
      // Provide user-friendly error messages
      if (error.message === 'Ya existe un cliente con este correo electrónico') {
        throw error;
      }
      throw error;
    }
  }

  // Delete customer
  async deleteCustomer(customerId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('customers')
        .delete()
        .eq('id', customerId);

      if (error) throw error;
    } catch (error) {
      console.error('Error deleting customer:', error);
      throw error;
    }
  }

  // Search customers by email or name
  async searchCustomers(query: string): Promise<Customer[]> {
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .or(`customer_email.ilike.%${query}%,customer_name.ilike.%${query}%,customer_lastname.ilike.%${query}%`)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error searching customers:', error);
      throw error;
    }
  }

  // Get restriction ingredients for customer restrictions
  async getRestrictionIngredients(): Promise<any[]> {
    try {
      const { data, error } = await supabase
        .from('customer_restriction_ingredients')
        .select('*')
        .order('ingredient_name');

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching restriction ingredients:', error);
      throw error;
    }
  }

  // Search for both ingredients and categories for restrictions
  async searchRestrictionItems(query: string): Promise<SearchableRestrictionItem[]> {
    try {
      if (!query.trim()) {
        return this.getAllSearchableRestrictionItems();
      }

      const searchTerm = query.toLowerCase();
      
      // Search ingredients
      const { data: ingredients, error: ingredientsError } = await supabase
        .from('ingredients')
        .select(`
          id,
          ingredient_id,
          ingredient_name,
          ingredient_categories!inner(ingredient_category)
        `)
        .or(`ingredient_name.ilike.%${query}%,ingredient_id.ilike.%${query}%`)
        .limit(10);

      if (ingredientsError) {
        console.error('Error searching ingredients:', ingredientsError);
      }

      // Search categories
      const { data: categories, error: categoriesError } = await supabase
        .from('ingredient_categories')
        .select('*')
        .or(`ingredient_category.ilike.%${query}%,ingredient_category_id.ilike.%${query}%`)
        .limit(5);

      if (categoriesError) {
        console.error('Error searching categories:', categoriesError);
      }

      const results: SearchableRestrictionItem[] = [];

      // Add categories to results first (they appear at the top)
      if (categories) {
        categories.forEach(category => {
          results.push({
            type: 'category',
            id: category.id,
            ingredient_category_id: category.ingredient_category_id,
            ingredient_category: category.ingredient_category,
            description: category.description
          } as SearchableCategory);
        });
      }
      // Add ingredients to results
      if (ingredients) {
        ingredients.forEach(ingredient => {
          results.push({
            type: 'ingredient',
            id: ingredient.id,
            ingredient_id: ingredient.ingredient_id,
            ingredient_name: ingredient.ingredient_name,
            category_name: ingredient.ingredient_categories?.ingredient_category
          } as SearchableIngredient);
        });
      }


      return results;
    } catch (error) {
      console.error('Error searching restriction items:', error);
      throw error;
    }
  }

  // Get all searchable restriction items (categories and ingredients)
  async getAllSearchableRestrictionItems(): Promise<SearchableRestrictionItem[]> {
    try {
      // Get all categories
      const { data: categories, error: categoriesError } = await supabase
        .from('ingredient_categories')
        .select('*')
        .order('ingredient_category', { ascending: true });

      if (categoriesError) {
        console.error('Error fetching all categories:', categoriesError);
      }

      // Get all ingredients with restrictions or spicy flag
      const { data: ingredients, error: ingredientsError } = await supabase
        .from('ingredients')
        .select(`
          id,
          ingredient_id,
          ingredient_name,
          ingredient_categories!inner(ingredient_category)
        `)
        .or('ingredient_restriction.eq.true,ingredient_spicy.eq.true')
        .order('ingredient_name', { ascending: true });

      if (ingredientsError) {
        console.error('Error fetching all ingredients:', ingredientsError);
      }

      const results: SearchableRestrictionItem[] = [];

      // Add categories to results first (they appear at the top)
      if (categories) {
        categories.forEach(category => {
          results.push({
            type: 'category',
            id: category.id,
            ingredient_category_id: category.ingredient_category_id,
            ingredient_category: category.ingredient_category,
            description: category.description
          } as SearchableCategory);
        });
      }

      // Add ingredients to results
      if (ingredients) {
        ingredients.forEach(ingredient => {
          results.push({
            type: 'ingredient',
            id: ingredient.id,
            ingredient_id: ingredient.ingredient_id,
            ingredient_name: ingredient.ingredient_name,
            category_name: ingredient.ingredient_categories?.ingredient_category
          } as SearchableIngredient);
        });
      }

      return results;
    } catch (error) {
      console.error('Error fetching all restriction items:', error);
      throw error;
    }
  }

  // Get all ingredients within a specific category
  async getIngredientsByCategory(categoryId: string): Promise<SearchableIngredient[]> {
    try {
      const { data, error } = await supabase
        .from('ingredients')
        .select(`
          id,
          ingredient_id,
          ingredient_name,
          ingredient_categories!inner(ingredient_category)
        `)
        .eq('ingredient_category_id', categoryId);

      if (error) throw error;

      return (data || []).map(ingredient => ({
        type: 'ingredient',
        id: ingredient.id,
        ingredient_id: ingredient.ingredient_id,
        ingredient_name: ingredient.ingredient_name,
        category_name: ingredient.ingredient_categories?.ingredient_category
      } as SearchableIngredient));
    } catch (error) {
      console.error('Error fetching ingredients by category:', error);
      throw error;
    }
  }
}

export const customerService = new CustomerService();