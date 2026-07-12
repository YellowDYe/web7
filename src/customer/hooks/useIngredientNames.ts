import { useState, useEffect } from 'react';
import { supabase } from '../../config/supabase';

export function useIngredientNames() {
  const [ingredientMap, setIngredientMap] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchIngredients();
  }, []);

  const fetchIngredients = async () => {
    try {
      setLoading(true);
      setError(null);

      const [ingredientsResult, categoriesResult] = await Promise.all([
        supabase.from('ingredients').select('ingredient_id, ingredient_name'),
        supabase.from('ingredient_categories').select('ingredient_category_id, ingredient_category'),
      ]);

      if (ingredientsResult.error) throw ingredientsResult.error;
      if (categoriesResult.error) throw categoriesResult.error;

      const map = new Map<string, string>();
      (ingredientsResult.data || []).forEach(ingredient => {
        map.set(ingredient.ingredient_id, ingredient.ingredient_name);
      });
      (categoriesResult.data || []).forEach(category => {
        map.set(category.ingredient_category_id, category.ingredient_category);
      });

      setIngredientMap(map);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load ingredients';
      setError(errorMessage);
      console.error('Error fetching ingredient names:', err);
    } finally {
      setLoading(false);
    }
  };

  const getIngredientName = (ingredientId: string): string => {
    return ingredientMap.get(ingredientId) || ingredientId;
  };

  return {
    ingredientMap,
    getIngredientName,
    loading,
    error
  };
}
