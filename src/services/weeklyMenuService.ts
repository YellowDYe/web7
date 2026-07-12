import { supabase } from '../config/supabase';
import { 
  WeeklyMenu, 
  CreateWeeklyMenuData, 
  UpdateWeeklyMenuData,
  WeeklyMenuWithPlans,
  WeeklyMenuPlan,
  MealPlanSummary,
  MenuPlanFormData,
  Recipe,
  DAYS_OF_WEEK,
  MEAL_TYPES,
  DayOfWeek,
  MealTypeKey,
  MealTypeLabel
} from '../types/weeklyMenu';

export class WeeklyMenuService {
  // Generate next menu ID
  private async generateNextMenuId(): Promise<string> {
    const { data, error } = await supabase
      .from('weekly_menus')
      .select('menu_id');

    if (error) {
      throw new Error(`Error generating menu ID: ${error.message}`);
    }

    if (!data || data.length === 0) {
      return 'M1';
    }

    // Parse all numeric parts and find the maximum
    const numericParts = data
      .map(item => parseInt(item.menu_id.replace('M', '')))
      .filter(num => !isNaN(num));
    
    const maxNumber = numericParts.length > 0 ? Math.max(...numericParts) : 0;
    return `M${maxNumber + 1}`;
  }

  // Get all weekly menus
  async getWeeklyMenus(): Promise<WeeklyMenu[]> {
    const { data, error } = await supabase
      .from('weekly_menus')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Error fetching weekly menus: ${error.message}`);
    }

    return data || [];
  }

  // Get single weekly menu by UUID
  async getMenuById(id: string): Promise<WeeklyMenu | null> {
    const { data, error } = await supabase
      .from('weekly_menus')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Not found
      }
      throw new Error(`Error fetching weekly menu: ${error.message}`);
    }

    return data;
  }

  // Create new weekly menu
  async createMenu(menuData: CreateWeeklyMenuData): Promise<WeeklyMenu> {
    const menuId = await this.generateNextMenuId();
    
    const { data, error } = await supabase
      .from('weekly_menus')
      .insert({
        menu_id: menuId,
        menu_name: menuData.menu_name
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Error creating weekly menu: ${error.message}`);
    }

    return data;
  }

  // Update weekly menu
  async updateMenu(id: string, menuData: UpdateWeeklyMenuData): Promise<WeeklyMenu> {
    const { data, error } = await supabase
      .from('weekly_menus')
      .update({
        menu_name: menuData.menu_name,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Error updating weekly menu: ${error.message}`);
    }

    return data;
  }

  // Delete weekly menu
  async deleteMenu(id: string): Promise<void> {
    const { error } = await supabase
      .from('weekly_menus')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`Error deleting weekly menu: ${error.message}`);
    }
  }

  // Get menu with plans
  async getMenuWithPlans(menuId: string): Promise<WeeklyMenuWithPlans | null> {
    console.log('getMenuWithPlans called with:', menuId);

    // Check if menuId is a UUID (editing case) or menu_id (direct case)
    let actualMenuId = menuId;

    // If it looks like a UUID, get the menu first to get the menu_id
    if (menuId.includes('-')) {
      console.log('Detected UUID, fetching menu_id...');
      const { data: menuData, error: menuError } = await supabase
        .from('weekly_menus')
        .select('menu_id')
        .eq('id', menuId)
        .maybeSingle();

      if (menuError) {
        console.error('Error fetching menu by UUID:', menuError);
        throw new Error(`Error fetching menu: ${menuError.message}`);
      }

      if (!menuData) {
        return null;
      }

      console.log('Found menu_id:', menuData.menu_id);
      actualMenuId = menuData.menu_id;
    }

    // Get the menu by menu_id
    console.log('Fetching menu with menu_id:', actualMenuId);
    const { data: menu, error: menuError } = await supabase
      .from('weekly_menus')
      .select('*')
      .eq('menu_id', actualMenuId)
      .maybeSingle();

    if (menuError) {
      console.error('Error fetching menu by menu_id:', menuError);
      throw new Error(`Error fetching menu: ${menuError.message}`);
    }

    if (!menu) {
      return null;
    }

    console.log('Found menu:', menu);

    // Get the menu recipes (migrated from weekly_menu_plans)
    console.log('Fetching menu recipes for menu_id:', actualMenuId);
    const { data: menuRecipes, error: recipesError } = await supabase
      .from('menu_recipes')
      .select('*')
      .eq('menu_id', actualMenuId);

    if (recipesError) {
      console.error('Error fetching menu recipes:', recipesError);

      // Provide helpful error message for common issues
      if (recipesError.message?.includes('weekly_menu_plans') || recipesError.code === '42P01') {
        throw new Error(
          'Error de base de datos: La tabla de menús semanales necesita ser actualizada. ' +
          'Por favor contacte al administrador del sistema para ejecutar las migraciones pendientes.'
        );
      }

      throw new Error(`Error al cargar las recetas del menú: ${recipesError.message}`);
    }

    console.log('Found menu recipes:', menuRecipes?.length || 0, 'records');

    // Transform menu_recipes wide format into normalized format for backward compatibility
    // Each menu_recipes row represents one meal plan with all its recipe assignments
    const transformedPlans: WeeklyMenuPlan[] = [];

    if (menuRecipes && menuRecipes.length > 0) {
      menuRecipes.forEach((menuRecipe: any) => {
        // Extract recipes for each day and meal type
        DAYS_OF_WEEK.forEach((day) => {
          MEAL_TYPES.forEach((mealType) => {
            const dayPrefix = this.dayToColumnPrefix(day);
            const columnName = `${dayPrefix}_${mealType.key}_recipe_id`;
            const recipeId = menuRecipe[columnName];

            // Only add entries where a recipe is assigned
            if (recipeId) {
              transformedPlans.push({
                id: menuRecipe.id,
                menu_id: menuRecipe.menu_id,
                meal_plan_id: menuRecipe.meal_plan_id,
                day_of_week: day,
                meal_type: mealType.label,
                recipe_id: recipeId,
                created_at: menuRecipe.created_at,
                updated_at: menuRecipe.updated_at
              });
            }
          });
        });
      });
    }

    return {
      ...menu,
      plans: transformedPlans
    };
  }

  // Get recipes
  async getRecipes(): Promise<Recipe[]> {
    const { data, error } = await supabase
      .from('recipes')
      .select('recipe_id, recipe_name, recipe_plan, recipe_total_cost, recipe_total_calories')
      .order('recipe_name');

    if (error) {
      throw new Error(`Error fetching recipes: ${error.message}`);
    }

    return data || [];
  }

  // Get menu plans summary
  async getMenuPlansSummary(menuId: string): Promise<MealPlanSummary[]> {
    // Check if menuId is a UUID or menu_id
    let actualMenuId = menuId;
    if (menuId.includes('-')) {
      const { data: menuData } = await supabase
        .from('weekly_menus')
        .select('menu_id')
        .eq('id', menuId)
        .maybeSingle();

      if (menuData) {
        actualMenuId = menuData.menu_id;
      }
    }

    // Get menu recipes for this menu
    const { data: menuRecipes, error: recipesError } = await supabase
      .from('menu_recipes')
      .select('meal_plan_id')
      .eq('menu_id', actualMenuId);

    if (recipesError) {
      throw new Error(`Error fetching menu recipes: ${recipesError.message}`);
    }

    if (!menuRecipes || menuRecipes.length === 0) {
      return [];
    }

    // Get unique meal plan IDs from menu recipes
    const mealPlanIds = [...new Set(menuRecipes.map(r => r.meal_plan_id))];

    // Fetch meal plan details
    const { data: mealPlans, error: plansError } = await supabase
      .from('meal_plans')
      .select('meal_plans_id, meal_plans_name, meal_plans_price')
      .in('meal_plans_id', mealPlanIds)
      .order('meal_plans_name');

    if (plansError) {
      throw new Error(`Error fetching meal plans: ${plansError.message}`);
    }

    // Calculate totals for each meal plan
    const summaries: MealPlanSummary[] = [];

    for (const plan of mealPlans || []) {
      // Get all recipes for this meal plan in this menu
      const { data: menuRecipe } = await supabase
        .from('menu_recipes')
        .select('*')
        .eq('menu_id', actualMenuId)
        .eq('meal_plan_id', plan.meal_plans_id)
        .maybeSingle();

      if (!menuRecipe) {
        summaries.push({
          meal_plan_id: plan.meal_plans_id,
          meal_plan_name: plan.meal_plans_name,
          total_cost: plan.meal_plans_price || 0,
          total_calories: 0
        });
        continue;
      }

      // Extract all recipe IDs from the wide format
      const recipeIds: string[] = [];
      DAYS_OF_WEEK.forEach((day) => {
        MEAL_TYPES.forEach((mealType) => {
          const dayPrefix = this.dayToColumnPrefix(day);
          const columnName = `${dayPrefix}_${mealType.key}_recipe_id`;
          const recipeId = menuRecipe[columnName];
          if (recipeId) {
            recipeIds.push(recipeId);
          }
        });
      });

      // Fetch recipe details to calculate totals
      let totalCost = 0;
      let totalCalories = 0;

      if (recipeIds.length > 0) {
        const { data: recipes } = await supabase
          .from('recipes')
          .select('recipe_total_cost, recipe_total_calories')
          .in('recipe_id', recipeIds);

        if (recipes) {
          totalCost = recipes.reduce((sum, r) => sum + (r.recipe_total_cost || 0), 0);
          totalCalories = recipes.reduce((sum, r) => sum + (r.recipe_total_calories || 0), 0);
        }
      }

      summaries.push({
        meal_plan_id: plan.meal_plans_id,
        meal_plan_name: plan.meal_plans_name,
        total_cost: totalCost,
        total_calories: totalCalories
      });
    }

    return summaries;
  }

  // Save menu plans (bulk operation)
  async saveMenuPlans(menuId: string, menuPlans: MenuPlanFormData): Promise<void> {
    // Convert form data to menu_recipes wide format
    const menuRecipesByMealPlan = this.convertFormDataToMenuRecipes(menuId, menuPlans);

    // Upsert each meal plan's menu recipes (one record per meal plan)
    for (const menuRecipe of menuRecipesByMealPlan) {
      const { error } = await supabase
        .from('menu_recipes')
        .upsert(
          menuRecipe,
          {
            onConflict: 'menu_id,meal_plan_id',
            ignoreDuplicates: false
          }
        );

      if (error) {
        console.error('Error saving menu recipes:', error);

        // Provide helpful error message for common issues
        if (error.message?.includes('weekly_menu_plans') || error.code === '42P01') {
          throw new Error(
            'Error de base de datos: La tabla de menús semanales necesita ser actualizada. ' +
            'Por favor contacte al administrador del sistema para ejecutar las migraciones pendientes.'
          );
        }

        throw new Error(`Error al guardar las recetas del menú: ${error.message}`);
      }
    }
  }

  // Convert form data structure to menu_recipes wide format
  private convertFormDataToMenuRecipes(menuId: string, menuPlans: MenuPlanFormData): any[] {
    // Group by meal plan ID
    const mealPlanGroups = new Map<string, any>();

    // Process each entry in menuPlans
    Object.entries(menuPlans).forEach(([key, mealTypeRecipes]) => {
      // Key format: "${mealPlanId}_${day}"
      // Find the last underscore to split meal plan ID from day
      const lastUnderscoreIndex = key.lastIndexOf('_');
      if (lastUnderscoreIndex === -1) return;

      const mealPlanId = key.substring(0, lastUnderscoreIndex);
      const day = key.substring(lastUnderscoreIndex + 1);

      if (!mealPlanId || !day) return;

      // Initialize meal plan record if not exists
      if (!mealPlanGroups.has(mealPlanId)) {
        mealPlanGroups.set(mealPlanId, {
          menu_id: menuId,
          meal_plan_id: mealPlanId
        });
      }

      const record = mealPlanGroups.get(mealPlanId);

      // Convert day to lowercase for column prefix
      const dayPrefix = this.dayToColumnPrefix(day as DayOfWeek);

      // Add recipe IDs for each meal type
      MEAL_TYPES.forEach(mealType => {
        const recipeId = mealTypeRecipes[mealType.key] || null;
        const columnName = `${dayPrefix}_${mealType.key}_recipe_id`;
        record[columnName] = recipeId;
      });
    });

    return Array.from(mealPlanGroups.values());
  }

  // Helper to convert day name to column prefix
  private dayToColumnPrefix(day: DayOfWeek): string {
    const dayMap: Record<DayOfWeek, string> = {
      'Lunes': 'lunes',
      'Martes': 'martes',
      'Miércoles': 'miercoles',
      'Jueves': 'jueves',
      'Viernes': 'viernes'
    };
    return dayMap[day] || day.toLowerCase();
  }

  // Convert menu_recipes wide format to form data structure
  convertPlansToFormData(plans: any[]): MenuPlanFormData {
    const formData: MenuPlanFormData = {};

    // Handle both old format (array of WeeklyMenuPlan) and new format (array of menu_recipes)
    if (!plans || plans.length === 0) {
      return formData;
    }

    // Check if this is the old format (has day_of_week property)
    const isOldFormat = plans[0] && 'day_of_week' in plans[0] && 'meal_type' in plans[0];

    if (isOldFormat) {
      // Legacy format support (for backward compatibility)
      plans.forEach(plan => {
        const key = `${plan.meal_plan_id}_${plan.day_of_week}`;

        if (!formData[key]) {
          formData[key] = {};
        }

        // Convert meal type label to key
        const mealType = MEAL_TYPES.find(mt => mt.label === plan.meal_type);
        if (mealType) {
          formData[key][mealType.key] = plan.recipe_id;
        }
      });
    } else {
      // New menu_recipes wide format
      plans.forEach(menuRecipe => {
        const mealPlanId = menuRecipe.meal_plan_id;

        // Process each day
        DAYS_OF_WEEK.forEach(day => {
          const dayPrefix = this.dayToColumnPrefix(day);
          const key = `${mealPlanId}_${day}`;

          if (!formData[key]) {
            formData[key] = {};
          }

          // Process each meal type
          MEAL_TYPES.forEach(mealType => {
            const columnName = `${dayPrefix}_${mealType.key}_recipe_id`;
            const recipeId = menuRecipe[columnName] || null;
            formData[key][mealType.key] = recipeId;
          });
        });
      });
    }

    return formData;
  }
}

export const weeklyMenuService = new WeeklyMenuService();