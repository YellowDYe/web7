import { supabase } from '../config/supabase';
import { Recipe, CreateRecipeData, UpdateRecipeData, RecipeWithDetails } from '../types/recipe';

export class RecipeService {
  // Generate next recipe ID (RC1, RC2, RC3...)
  private async generateNextRecipeId(): Promise<string> {
    const { data, error } = await supabase
      .from('recipes')
      .select('recipe_id');

    if (error) {
      console.error('Error fetching last recipe ID:', error);
      return `RC${Math.floor(Math.random() * 100000000)}`;
    }

    if (!data || data.length === 0) {
      return 'RC1';
    }

    // Parse all numeric parts and find the maximum
    const numericParts = data
      .map(item => parseInt(item.recipe_id.replace('RC', '')))
      .filter(num => !isNaN(num));
    
    const maxNumber = numericParts.length > 0 ? Math.max(...numericParts) : 0;
    return `RC${maxNumber + 1}`;
  }

  // Create new recipe with ingredients and steps
  async createRecipe(recipeData: CreateRecipeData): Promise<Recipe> {
    const recipe_id = await this.generateNextRecipeId();

    // Calculate totals from ingredients
    const ingredientTotals = await this.calculateRecipeTotals(recipeData.recipe_ingredients);
    
    // Get container cost
    let containerCost = 0;
    if (recipeData.recipe_container) {
      const { data: containerData, error: containerError } = await supabase
        .from('food_containers')
        .select('food_containers_cost')
        .eq('food_containers_id', recipeData.recipe_container)
        .single();
      
      if (!containerError && containerData) {
        containerCost = containerData.food_containers_cost || 0;
      }
    }
    
    // Calculate total cost including container
    const totalCost = ingredientTotals.cost + containerCost;

    const { data: recipe, error: recipeError } = await supabase
      .from('recipes')
      .insert([
        {
          recipe_id,
          recipe_name: recipeData.recipe_name,
          recipe_image: recipeData.recipe_image,
          image: recipeData.image,
          recipe_plan: recipeData.recipe_plan,
          recipe_container: recipeData.recipe_container,
          recipe_total_cost: totalCost,
          recipe_total_calories: ingredientTotals.calories,
          recipe_total_carbohydrates: ingredientTotals.carbs,
          recipe_total_proteins: ingredientTotals.proteins,
          recipe_total_fats: ingredientTotals.fats
        }
      ])
      .select()
      .single();

    if (recipeError) {
      throw new Error(`Error creating recipe: ${recipeError.message}`);
    }

    // Create recipe ingredients
    if (recipeData.recipe_ingredients.length > 0) {
      await this.createRecipeIngredients(recipe_id, recipeData.recipe_ingredients);
    }

    // Create recipe steps
    if (recipeData.recipe_cooking_steps.length > 0) {
      await this.createRecipeSteps(recipe_id, recipeData.recipe_cooking_steps);
    }

    return recipe as Recipe;
  }

  // Create recipe ingredients
  private async createRecipeIngredients(recipeId: string, ingredients: any[]): Promise<void> {
    const ingredientsToInsert = ingredients.map((ingredient, index) => ({
      recipe_ingredient_id: `${recipeId}_ING_${index + 1}`,
      recipe_id: recipeId,
      ingredient_id: ingredient.ingredient_id,
      recipe_ingredient_quantity: ingredient.recipe_ingredient_quantity,
      recipe_ingredient_unit: ingredient.recipe_ingredient_unit,
      recipe_ingredient_restriction_management: ingredient.recipe_ingredient_restriction_management,
      recipe_substitute_ingredient_id: ingredient.recipe_substitute_ingredient_id
    }));

    const { error } = await supabase
      .from('recipe_ingredients')
      .insert(ingredientsToInsert);

    if (error) {
      throw new Error(`Error creating recipe ingredients: ${error.message}`);
    }
  }

  // Create recipe steps
  private async createRecipeSteps(recipeId: string, steps: any[]): Promise<void> {
    const stepsToInsert = steps.map((step, index) => ({
      recipe_step_id: `${recipeId}_STEP_${index + 1}`,
      recipe_id: recipeId,
      ingredient_id: step.ingredient_id,
      cooking_step_id: step.cooking_step_id,
      ingredient_quantity: step.ingredient_quantity
    }));

    const { error } = await supabase
      .from('recipe_steps')
      .insert(stepsToInsert);

    if (error) {
      throw new Error(`Error creating recipe steps: ${error.message}`);
    }
  }

  // Calculate recipe totals from ingredients
  private async calculateRecipeTotals(ingredients: any[]): Promise<{
    cost: number;
    calories: number;
    carbs: number;
    proteins: number;
    fats: number;
  }> {
    if (ingredients.length === 0) {
      return { cost: 0, calories: 0, carbs: 0, proteins: 0, fats: 0 };
    }

    const ingredientIds = ingredients.map(ing => ing.ingredient_id);
    
    const { data: ingredientData, error } = await supabase
      .from('ingredients')
      .select('ingredient_id, ingredient_cost, ingredient_calories, ingredient_carbs, ingredient_protein, ingredient_fats')
      .in('ingredient_id', ingredientIds);

    if (error) {
      console.error('Error fetching ingredient data for totals:', error);
      return { cost: 0, calories: 0, carbs: 0, proteins: 0, fats: 0 };
    }

    let totalCost = 0;
    let totalCalories = 0;
    let totalCarbs = 0;
    let totalProteins = 0;
    let totalFats = 0;

    for (const recipeIngredient of ingredients) {
      const ingredient = ingredientData?.find(ing => ing.ingredient_id === recipeIngredient.ingredient_id);
      if (ingredient) {
        const quantity = recipeIngredient.recipe_ingredient_quantity || 0;
        // Convert grams to kilograms for cost calculation (ingredient cost is per kg)
        const quantityInKg = quantity / 1000;
        totalCost += (ingredient.ingredient_cost || 0) * quantityInKg;
        
        // Nutritional values are per 100g, so adjust proportionally
        const factor = quantity / 100;
        totalCalories += (ingredient.ingredient_calories || 0) * factor;
        totalCarbs += (ingredient.ingredient_carbs || 0) * factor;
        totalProteins += (ingredient.ingredient_protein || 0) * factor;
        totalFats += (ingredient.ingredient_fats || 0) * factor;
      }
    }

    return {
      cost: totalCost,
      calories: totalCalories,
      carbs: totalCarbs,
      proteins: totalProteins,
      fats: totalFats
    };
  }

  // Get recipe with full details including ingredients and steps
  async getRecipeWithDetails(id: string): Promise<RecipeWithDetails | null> {
    // First get the recipe with plan and container names
    const { data: recipe, error: recipeError } = await supabase
      .from('recipes')
      .select(`
        *,
        meal_plans!inner(meal_plans_name),
        food_containers!inner(food_containers_name)
      `)
      .eq('id', id)
      .single();

    if (recipeError) {
      if (recipeError.code === 'PGRST116') {
        return null; // Not found
      }
      throw new Error(`Error fetching recipe: ${recipeError.message}`);
    }

    // Get recipe ingredients with ingredient details
    const { data: ingredients, error: ingredientsError } = await supabase
      .from('recipe_ingredients')
      .select(`
        *,
        main_ingredient:ingredients!recipe_ingredients_ingredient_id_fkey!inner(
          ingredient_name,
          ingredient_cost,
          ingredient_calories,
          ingredient_carbs,
          ingredient_protein,
          ingredient_fats
        )
      `)
      .eq('recipe_id', recipe.recipe_id);

    if (ingredientsError) {
      console.error('Error fetching recipe ingredients:', ingredientsError);
    }

    // Get recipe steps with cooking step and ingredient details
    const { data: steps, error: stepsError } = await supabase
      .from('recipe_steps')
      .select(`
        *,
        cooking_steps!inner(
          cooking_steps_name,
          cooking_steps_description
        ),
        ingredients!inner(
          ingredient_name
        )
      `)
      .eq('recipe_id', recipe.recipe_id);

    if (stepsError) {
      console.error('Error fetching recipe steps:', stepsError);
    }

    // Get substitute ingredient names for ingredients that have substitutes
    const substituteIds = (ingredients || [])
      .map(ing => ing.recipe_substitute_ingredient_id)
      .filter(id => id);

    let substituteIngredients: any[] = [];
    if (substituteIds.length > 0) {
      const { data: substitutes } = await supabase
        .from('ingredients')
        .select('ingredient_id, ingredient_name')
        .in('ingredient_id', substituteIds);
      
      substituteIngredients = substitutes || [];
    }

    // Format the response
    const recipeWithDetails: RecipeWithDetails = {
      ...recipe,
      plan_name: (recipe.meal_plans as any)?.meal_plans_name,
      container_name: (recipe.food_containers as any)?.food_containers_name,
      ingredients: (ingredients || []).map(ing => ({
        ingredient_id: ing.ingredient_id,
        ingredient_name: (ing.main_ingredient as any)?.ingredient_name,
        recipe_ingredient_quantity: ing.recipe_ingredient_quantity,
        recipe_ingredient_unit: ing.recipe_ingredient_unit,
        recipe_ingredient_restriction_management: ing.recipe_ingredient_restriction_management,
        recipe_substitute_ingredient_id: ing.recipe_substitute_ingredient_id,
        substitute_ingredient_name: substituteIngredients.find(sub => 
          sub.ingredient_id === ing.recipe_substitute_ingredient_id
        )?.ingredient_name
      })),
      steps: (steps || []).map(step => ({
        ingredient_id: step.ingredient_id,
        ingredient_name: (step.ingredients as any)?.ingredient_name,
        cooking_step_id: step.cooking_step_id,
        cooking_step_name: (step.cooking_steps as any)?.cooking_steps_name,
        cooking_step_description: (step.cooking_steps as any)?.cooking_steps_description,
        ingredient_quantity: step.ingredient_quantity
      }))
    };

    return recipeWithDetails;
  }

  // Update recipe with ingredients and steps
  async updateRecipeWithDetails(id: string, recipeData: CreateRecipeData): Promise<Recipe> {
    // Get the recipe to get its recipe_id
    const existingRecipe = await this.getRecipeById(id);
    if (!existingRecipe) {
      throw new Error('Recipe not found');
    }

    // Calculate totals from ingredients
    const ingredientTotals = await this.calculateRecipeTotals(recipeData.recipe_ingredients);
    
    // Get container cost
    let containerCost = 0;
    if (recipeData.recipe_container) {
      const { data: containerData, error: containerError } = await supabase
        .from('food_containers')
        .select('food_containers_cost')
        .eq('food_containers_id', recipeData.recipe_container)
        .single();
      
      if (!containerError && containerData) {
        containerCost = containerData.food_containers_cost || 0;
      }
    }
    
    // Calculate total cost including container
    const totalCost = ingredientTotals.cost + containerCost;

    // Update the recipe
    const { data: recipe, error: recipeError } = await supabase
      .from('recipes')
      .update({
        recipe_name: recipeData.recipe_name,
        recipe_image: recipeData.recipe_image,
        image: recipeData.image,
        recipe_plan: recipeData.recipe_plan,
        recipe_container: recipeData.recipe_container,
        recipe_total_cost: totalCost,
        recipe_total_calories: ingredientTotals.calories,
        recipe_total_carbohydrates: ingredientTotals.carbs,
        recipe_total_proteins: ingredientTotals.proteins,
        recipe_total_fats: ingredientTotals.fats
      })
      .eq('id', id)
      .select()
      .single();

    if (recipeError) {
      throw new Error(`Error updating recipe: ${recipeError.message}`);
    }

    // Delete existing ingredients and steps
    await supabase
      .from('recipe_ingredients')
      .delete()
      .eq('recipe_id', existingRecipe.recipe_id);

    await supabase
      .from('recipe_steps')
      .delete()
      .eq('recipe_id', existingRecipe.recipe_id);

    // Create new ingredients and steps
    if (recipeData.recipe_ingredients.length > 0) {
      await this.createRecipeIngredients(existingRecipe.recipe_id, recipeData.recipe_ingredients);
    }

    if (recipeData.recipe_cooking_steps.length > 0) {
      await this.createRecipeSteps(existingRecipe.recipe_id, recipeData.recipe_cooking_steps);
    }

    return recipe as Recipe;
  }

  // Duplicate recipe with new ID
  async duplicateRecipe(id: string): Promise<Recipe> {
    // Get the original recipe with all details
    const originalRecipe = await this.getRecipeWithDetails(id);
    if (!originalRecipe) {
      throw new Error('Recipe not found');
    }

    // Prepare data for new recipe
    const duplicateData: CreateRecipeData = {
      recipe_name: `${originalRecipe.recipe_name} (Copia)`,
      recipe_image: originalRecipe.recipe_image,
      image: originalRecipe.image,
      recipe_plan: originalRecipe.recipe_plan,
      recipe_container: originalRecipe.recipe_container,
      recipe_ingredients: (originalRecipe.ingredients || []).map(ing => ({
        ingredient_id: ing.ingredient_id,
        recipe_ingredient_quantity: ing.recipe_ingredient_quantity,
        recipe_ingredient_unit: ing.recipe_ingredient_unit,
        recipe_ingredient_restriction_management: ing.recipe_ingredient_restriction_management,
        recipe_substitute_ingredient_id: ing.recipe_substitute_ingredient_id
      })),
      recipe_cooking_steps: (originalRecipe.steps || []).map(step => ({
        ingredient_id: step.ingredient_id,
        cooking_step_id: step.cooking_step_id,
        ingredient_quantity: step.ingredient_quantity
      }))
    };

    // Create the duplicate recipe
    return this.createRecipe(duplicateData);
  }

  // Get all recipes
  async getRecipes(): Promise<Recipe[]> {
    const { data, error } = await supabase
      .from('recipes')
      .select(`
        *,
        meal_plans!recipes_recipe_plan_fkey(meal_plans_name),
        food_containers!recipes_recipe_container_fkey(food_containers_name, food_containers_cost)
      `)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Error fetching recipes: ${error.message}`);
    }

    // Transform the data to include plan names
    return (data || []).map(recipe => ({
      ...recipe,
      plan_name: recipe.meal_plans?.meal_plans_name || null,
      container_name: recipe.food_containers?.food_containers_name || null,
      container_cost: recipe.food_containers?.food_containers_cost || 0
    })) as Recipe[];
  }

  // Get single recipe by ID
  async getRecipeById(id: string): Promise<Recipe | null> {
    const { data, error } = await supabase
      .from('recipes')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if ((error as any).code === 'PGRST116') {
        return null; // Not found
      }
      throw new Error(`Error fetching recipe: ${error.message}`);
    }

    return data as Recipe;
  }

  // Get recipe by recipe_id
  async getRecipeByRecipeId(recipeId: string): Promise<Recipe | null> {
    const { data, error } = await supabase
      .from('recipes')
      .select('*')
      .eq('recipe_id', recipeId)
      .single();

    if (error) {
      if ((error as any).code === 'PGRST116') {
        return null; // Not found
      }
      throw new Error(`Error fetching recipe: ${error.message}`);
    }

    return data as Recipe;
  }

  // Update recipe
  async updateRecipe(id: string, updateData: UpdateRecipeData): Promise<Recipe> {
    const { data, error } = await supabase
      .from('recipes')
      .update(updateData as any)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Error updating recipe: ${error.message}`);
    }

    return data as Recipe;
  }

  // Recalculate and update all existing recipe costs
  async recalculateAllRecipeCosts(): Promise<void> {
    try {
      // Get all recipes
      const { data: recipes, error: recipesError } = await supabase
        .from('recipes')
        .select('id, recipe_id');

      if (recipesError) {
        throw new Error(`Error fetching recipes: ${recipesError.message}`);
      }

      if (!recipes || recipes.length === 0) {
        return;
      }

      // Update each recipe's cost
      for (const recipe of recipes) {
        try {
          // Get recipe ingredients
          const { data: ingredients, error: ingredientsError } = await supabase
            .from('recipe_ingredients')
            .select('ingredient_id, recipe_ingredient_quantity')
            .eq('recipe_id', recipe.recipe_id);

          if (ingredientsError) {
            console.error(`Error fetching ingredients for recipe ${recipe.recipe_id}:`, ingredientsError);
            continue;
          }

          // Get recipe container
          const { data: recipeData, error: recipeError } = await supabase
            .from('recipes')
            .select('recipe_container')
            .eq('id', recipe.id)
            .single();

          if (recipeError) {
            console.error(`Error fetching recipe data for ${recipe.recipe_id}:`, recipeError);
            continue;
          }

          // Calculate totals
          const ingredientTotals = await this.calculateRecipeTotals(ingredients || []);
          
          // Get container cost
          let containerCost = 0;
          if (recipeData.recipe_container) {
            const { data: containerData, error: containerError } = await supabase
              .from('food_containers')
              .select('food_containers_cost')
              .eq('food_containers_id', recipeData.recipe_container)
              .single();
            
            if (!containerError && containerData) {
              containerCost = containerData.food_containers_cost || 0;
            }
          }
          
          // Calculate total cost including container
          const totalCost = ingredientTotals.cost + containerCost;

          // Update recipe with correct costs
          const { error: updateError } = await supabase
            .from('recipes')
            .update({
              recipe_total_cost: totalCost,
              recipe_total_calories: ingredientTotals.calories,
              recipe_total_carbohydrates: ingredientTotals.carbs,
              recipe_total_proteins: ingredientTotals.proteins,
              recipe_total_fats: ingredientTotals.fats
            })
            .eq('id', recipe.id);

          if (updateError) {
            console.error(`Error updating recipe ${recipe.recipe_id}:`, updateError);
          }
        } catch (error) {
          console.error(`Error processing recipe ${recipe.recipe_id}:`, error);
        }
      }

      console.log('Recipe cost recalculation completed');
    } catch (error) {
      console.error('Error recalculating recipe costs:', error);
      throw error;
    }
  }

  // Delete recipe
  async deleteRecipe(id: string): Promise<void> {
    const { error } = await supabase
      .from('recipes')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`Error deleting recipe: ${error.message}`);
    }
  }
}

export const recipeService = new RecipeService();