import { supabase } from '../config/supabase';
import { Ingredient, CreateIngredientData, UpdateIngredientData, IngredientWithDetails } from '../types/ingredient';

export class IngredientService {
  // Generate next ingredient ID (IG1, IG2, IG3...)
  private async generateNextIngredientId(): Promise<string> {
    const { data, error } = await supabase
      .from('ingredients')
      .select('ingredient_id');

    if (error) {
      console.error('Error fetching last ingredient ID:', error);
      return `IG${Math.floor(Math.random() * 100000000)}`;
    }

    if (!data || data.length === 0) {
      return 'IG1';
    }

    // Parse all numeric parts and find the maximum
    const numericParts = data
      .map(item => parseInt(item.ingredient_id.replace('IG', '')))
      .filter(num => !isNaN(num));
    
    const maxNumber = numericParts.length > 0 ? Math.max(...numericParts) : 0;
    return `IG${maxNumber + 1}`;
  }

  // Create new ingredient
  async createIngredient(ingredientData: CreateIngredientData): Promise<Ingredient> {
    const ingredient_id = await this.generateNextIngredientId();

    const { data, error } = await supabase
      .from('ingredients')
      .insert([
        {
          ingredient_id,
          ...ingredientData
        }
      ])
      .select()
      .single();

    if (error) {
      throw new Error(`Error creating ingredient: ${error.message}`);
    }

    return data;
  }

  // Get all ingredients with category and supplier details
  async getIngredients(): Promise<IngredientWithDetails[]> {
    const { data, error } = await supabase
      .from('ingredients')
      .select(`
        *,
        ingredient_categories!inner(ingredient_category),
        suppliers!inner(supplier_name)
      `)
      .order('created_at', { ascending: true });

    if (error) {
      throw new Error(`Error fetching ingredients: ${error.message}`);
    }

    // Transform the data to include category and supplier names
    return (data || []).map(item => ({
      ...item,
      category_name: item.ingredient_categories?.ingredient_category,
      supplier_name: item.suppliers?.supplier_name
    }));
  }

  // Get single ingredient by ID
  async getIngredientById(id: string): Promise<Ingredient | null> {
    const { data, error } = await supabase
      .from('ingredients')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Not found
      }
      throw new Error(`Error fetching ingredient: ${error.message}`);
    }

    return data;
  }

  // Update ingredient
  async updateIngredient(id: string, updateData: UpdateIngredientData): Promise<Ingredient> {
    const { data, error } = await supabase
      .from('ingredients')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Error updating ingredient: ${error.message}`);
    }

    return data;
  }

  // Check if supplier has linked ingredients
  async hasIngredientsBySupplierId(supplierId: string): Promise<boolean> {
    const { data, error } = await supabase
      .from('ingredients')
      .select('id')
      .eq('supplier_id', supplierId)
      .limit(1);

    if (error) {
      throw new Error(`Error checking supplier ingredients: ${error.message}`);
    }

    return (data && data.length > 0);
  }

  // Check if ingredient has linked recipes
  async hasRecipesByIngredientId(ingredientId: string): Promise<boolean> {
    const { data, error } = await supabase
      .from('recipe_ingredients')
      .select('id')
      .eq('ingredient_id', ingredientId)
      .limit(1);

    if (error) {
      throw new Error(`Error checking ingredient recipes: ${error.message}`);
    }

    return (data && data.length > 0);
  }

  // Delete ingredient
  async deleteIngredient(id: string): Promise<void> {
    const { error } = await supabase
      .from('ingredients')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`Error deleting ingredient: ${error.message}`);
    }
  }

  async getIngredientNamesByIds(ingredientIds: string[]): Promise<Map<string, string>> {
    if (!ingredientIds || ingredientIds.length === 0) {
      return new Map();
    }

    const { data, error } = await supabase
      .from('ingredients')
      .select('ingredient_id, ingredient_name')
      .in('ingredient_id', ingredientIds);

    if (error) {
      console.error('Error fetching ingredient names:', error);
      throw new Error(`Error fetching ingredient names: ${error.message}`);
    }

    const nameMap = new Map<string, string>();
    (data || []).forEach(ingredient => {
      nameMap.set(ingredient.ingredient_id, ingredient.ingredient_name);
    });

    return nameMap;
  }
}

export const ingredientService = new IngredientService();