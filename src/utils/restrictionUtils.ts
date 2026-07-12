import { RawRestrictionData, CustomerRestrictionWarning, RestrictionConflict, CustomerGroupedRestriction, IngredientRestriction } from '../types/kitchenOrder';

export class RestrictionUtils {
  // Process raw data to identify restriction conflicts
  static processRawRestrictionData(rawData: RawRestrictionData): CustomerRestrictionWarning[] {
    const { orders, orderMenuItems, menuPlans, recipeIngredients, ingredients } = rawData;
    
    // Create lookup maps for efficient data access
    const recipeMap = new Map<string, any>();
    menuPlans.forEach(menuPlan => {
      const key = `${menuPlan.day_of_week}-${menuPlan.meal_plan_id}-${menuPlan.meal_type}`;
      recipeMap.set(key, {
        recipe_id: menuPlan.recipe_id,
        recipe_name: menuPlan.recipes?.recipe_name || ''
      });
    });

    const ingredientMap = new Map<string, any>();
    ingredients.forEach(ingredient => {
      ingredientMap.set(ingredient.ingredient_id, ingredient);
    });

    // Group recipe ingredients by recipe_id
    const recipeIngredientsMap = new Map<string, any[]>();
    recipeIngredients.forEach(recipeIngredient => {
      const recipeId = recipeIngredient.recipe_id;
      if (!recipeIngredientsMap.has(recipeId)) {
        recipeIngredientsMap.set(recipeId, []);
      }
      recipeIngredientsMap.get(recipeId)!.push(recipeIngredient);
    });

    // Process each order to find restriction conflicts
    const warnings: CustomerRestrictionWarning[] = [];

    orders.forEach(orderWeek => {
      const order = orderWeek.orders;
      const customer = order?.customers;
      
      if (!customer || !order) return;

      // Get customer restrictions (handle both array and string formats)
      let customerRestrictions: string[] = [];
      if (customer.customer_restrictions) {
        if (Array.isArray(customer.customer_restrictions)) {
          customerRestrictions = customer.customer_restrictions;
        } else if (typeof customer.customer_restrictions === 'string') {
          try {
            customerRestrictions = JSON.parse(customer.customer_restrictions);
          } catch {
            // If parsing fails, treat as empty array since we expect ingredient IDs
            customerRestrictions = [];
          }
        }
      }

      // Find order menu items for this order
      const orderMenus = orderMenuItems.filter(item => 
        item.order_weeks?.order_id === order.order_id
      );

      const conflictingIngredients: any[] = [];

      // Check each order menu item for conflicts
      orderMenus.forEach(orderMenu => {
        const lookupKey = `${orderMenu.day_of_week}-${orderMenu.meal_plans_id}-${orderMenu.meal_type}`;
        const recipeInfo = recipeMap.get(lookupKey);
        
        if (recipeInfo && recipeInfo.recipe_id) {
          const recipeIngredientsForRecipe = recipeIngredientsMap.get(recipeInfo.recipe_id) || [];

          // Check each ingredient in the recipe
          recipeIngredientsForRecipe.forEach(recipeIngredient => {
            const ingredient = recipeIngredient.main_ingredient;

            if (ingredient) {
              // Check for restriction conflicts by comparing ingredient IDs directly
              const hasRestrictionConflict = customerRestrictions.includes(ingredient.ingredient_id);

              if (hasRestrictionConflict) {
                conflictingIngredients.push({
                  day: orderMenu.day_of_week,
                  meal_type: orderMenu.meal_type,
                  meal_plan: orderMenu.meal_plans?.meal_plans_name || '',
                  recipe_name: recipeInfo.recipe_name,
                  ingredient_name: ingredient.ingredient_name,
                  recipe_ingredient_restriction_management: recipeIngredient.recipe_ingredient_restriction_management || '',
                  recipe_substitute_ingredient_id: recipeIngredient.recipe_substitute_ingredient_id || '',
                  restricted_ingredients: [ingredient.ingredient_name]
                });
              }
            }
          });

          // Inject special instructions as a synthetic conflict for every dish
          const specialInstructions = customer.special_instructions;
          if (specialInstructions && specialInstructions.trim() &&
              orderMenu.meal_type !== 'Colación AM' && orderMenu.meal_type !== 'Colación PM') {
            conflictingIngredients.push({
              day: orderMenu.day_of_week,
              meal_type: orderMenu.meal_type,
              meal_plan: orderMenu.meal_plans?.meal_plans_name || '',
              recipe_name: recipeInfo.recipe_name,
              ingredient_name: specialInstructions.trim(),
              recipe_ingredient_restriction_management: 'instruction',
              recipe_substitute_ingredient_id: '',
              restricted_ingredients: [specialInstructions.trim()]
            });
          }
        }
      });

      // Create warning entry for this customer/order
      const warning: CustomerRestrictionWarning = {
        order_id: order.order_id,
        customer_name: order.order_customer_name || `${customer.customer_name} ${customer.customer_lastname}`,
        customer_email: order.order_customer_email || customer.customer_email,
        customer_restrictions: customerRestrictions,
        conflicting_ingredients: conflictingIngredients,
        total_conflicts: conflictingIngredients.length
      };

      warnings.push(warning);
    });

    // Sort warnings by number of conflicts (highest first)
    return warnings.sort((a, b) => b.total_conflicts - a.total_conflicts);
  }

  // Get detailed restriction conflicts for export or detailed view
  static getDetailedConflicts(rawData: RawRestrictionData): RestrictionConflict[] {
    const warnings = this.processRawRestrictionData(rawData);
    const conflicts: RestrictionConflict[] = [];

    // Create ingredient lookup map for substitute ingredient names
    const ingredientMap = new Map<string, any>();
    rawData.ingredients.forEach(ingredient => {
      ingredientMap.set(ingredient.ingredient_id, ingredient);
    });

    // Create a map to lookup quantities from orderMenuItems
    // Use meal plan name for the key since that's what we have in conflicts
    const quantityMap = new Map<string, number>();
    rawData.orderMenuItems.forEach(item => {
      const mealPlanName = item.meal_plans?.meal_plans_name || '';
      const key = `${item.order_weeks?.order_id}-${item.day_of_week}-${item.meal_type}-${mealPlanName}`;
      quantityMap.set(key, item.quantity || 1);
    });

    warnings.forEach(warning => {
      warning.conflicting_ingredients.forEach(conflict => {
        conflict.restricted_ingredients.forEach(ingredientName => {
          // Get substitute ingredient name if available
          const substituteIngredientName = conflict.recipe_substitute_ingredient_id
            ? ingredientMap.get(conflict.recipe_substitute_ingredient_id)?.ingredient_name || ''
            : '';

          // Find quantity for this specific dish order
          const quantityKey = `${warning.order_id}-${conflict.day}-${conflict.meal_type}-${conflict.meal_plan}`;
          const quantity = quantityMap.get(quantityKey) || 1;

          conflicts.push({
            order_id: warning.order_id,
            customer_name: warning.customer_name,
            customer_email: warning.customer_email,
            customer_restrictions: warning.customer_restrictions,
            day_of_week: conflict.day,
            meal_type: conflict.meal_type,
            meal_plan_name: conflict.meal_plan,
            recipe_name: conflict.recipe_name,
            ingredient_name: ingredientName,
            recipe_ingredient_restriction_management: conflict.recipe_ingredient_restriction_management || '',
            recipe_substitute_ingredient_id: conflict.recipe_substitute_ingredient_id || '',
            recipe_substitute_ingredient_name: substituteIngredientName,
            quantity: quantity
          });
        });
      });
    });

    return conflicts;
  }

  // Filter conflicts to only include actionable restrictions (Remove, Substitute, Block)
  // Excludes: Ignore, unspecified, and empty values
  static filterActionableConflicts(conflicts: RestrictionConflict[]): RestrictionConflict[] {
    return conflicts.filter(conflict => {
      const management = conflict.recipe_ingredient_restriction_management?.toLowerCase() || '';
      return management === 'remove' || management === 'substitute' || management === 'block' || management === 'instruction';
    });
  }

  // Group conflicts by customer for better kitchen workflow
  static groupConflictsByCustomer(conflicts: RestrictionConflict[]): Map<string, Map<string, Map<string, CustomerGroupedRestriction[]>>> {
    // Structure: Map<mealPlan, Map<mealType, Map<day, CustomerGroupedRestriction[]>>>
    const grouped = new Map<string, Map<string, Map<string, CustomerGroupedRestriction[]>>>();

    conflicts.forEach(conflict => {
      const { meal_plan_name, meal_type, day_of_week, customer_name, order_id, quantity } = conflict;

      // Initialize nested maps if they don't exist
      if (!grouped.has(meal_plan_name)) {
        grouped.set(meal_plan_name, new Map());
      }
      const mealPlanMap = grouped.get(meal_plan_name)!;

      if (!mealPlanMap.has(meal_type)) {
        mealPlanMap.set(meal_type, new Map());
      }
      const mealTypeMap = mealPlanMap.get(meal_type)!;

      if (!mealTypeMap.has(day_of_week)) {
        mealTypeMap.set(day_of_week, []);
      }
      const dayArray = mealTypeMap.get(day_of_week)!;

      // Find or create customer group entry
      let customerGroup = dayArray.find(cg => cg.customer_name === customer_name && cg.order_id === order_id);

      if (!customerGroup) {
        customerGroup = {
          order_id,
          customer_name,
          customer_email: conflict.customer_email,
          quantity,
          restrictions: []
        };
        dayArray.push(customerGroup);
      }

      // Add restriction to customer's list
      customerGroup.restrictions.push({
        ingredient_name: conflict.ingredient_name,
        restriction_management: conflict.recipe_ingredient_restriction_management,
        substitute_ingredient_name: conflict.recipe_substitute_ingredient_name
      });
    });

    // Sort customer arrays alphabetically by customer name
    grouped.forEach(mealPlanMap => {
      mealPlanMap.forEach(mealTypeMap => {
        mealTypeMap.forEach((customerArray, day) => {
          customerArray.sort((a, b) => a.customer_name.localeCompare(b.customer_name));
        });
      });
    });

    return grouped;
  }

  // Calculate summary statistics for restrictions
  static calculateRestrictionSummary(warnings: CustomerRestrictionWarning[]) {
    const totalOrders = warnings.length;
    const ordersWithConflicts = warnings.filter(w => w.total_conflicts > 0).length;
    const totalConflicts = warnings.reduce((sum, w) => sum + w.total_conflicts, 0);

    // Get unique restrictions that have conflicts
    const conflictingRestrictions = new Set<string>();
    warnings.forEach(warning => {
      if (warning.total_conflicts > 0) {
        warning.customer_restrictions.forEach(restriction => {
          conflictingRestrictions.add(restriction);
        });
      }
    });

    return {
      totalOrders,
      ordersWithConflicts,
      totalConflicts,
      conflictingRestrictions: Array.from(conflictingRestrictions),
      conflictRate: totalOrders > 0 ? (ordersWithConflicts / totalOrders) * 100 : 0
    };
  }
}