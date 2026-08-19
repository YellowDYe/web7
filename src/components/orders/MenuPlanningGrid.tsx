import React, { useState, useEffect } from 'react';
import { Plus, Minus, ShoppingCart, TriangleAlert as AlertTriangle, Ban, Calendar, Check, X } from 'lucide-react';
import { SelectedWeek } from '../../types/week';
import { MealPlan } from '../../types/mealPlan';
import { PendingOrderItem, BILLABLE_MEAL_TYPES } from '../../types/orderMenu';
import { MEAL_TYPES, DAYS_OF_WEEK, DayOfWeek, MealTypeLabel } from '../../types/weeklyMenu';
import { buildRecipeColumn } from '../../types/mealTypes';
import { CustomerWithDetails } from '../../types/customer';
import { supabase } from '../../config/supabase';

interface MenuPlanningGridProps {
  activeWeek: SelectedWeek | null;
  selectedPlan: MealPlan | null;
  selectedCustomer: CustomerWithDetails | null;
  selectedFamilyMemberId?: string | null;
  onAddToOrder: (item: PendingOrderItem) => void;
  onRemoveFromOrder: (itemToRemove: PendingOrderItem | string) => void;
  orderItems: PendingOrderItem[];
  disabled?: boolean;
}

interface GridCellProps {
  mealType: MealTypeLabel;
  dayOfWeek: DayOfWeek;
  activeWeek: SelectedWeek;
  selectedPlan: MealPlan;
  selectedCustomer: CustomerWithDetails | null;
  selectedFamilyMemberId?: string | null;
  familyMemberData?: { name: string; restrictions: string[] } | null;
  onAddToOrder: (item: PendingOrderItem) => void;
  onRemoveFromOrder: (itemToRemove: PendingOrderItem | string) => void;
  orderItems: PendingOrderItem[];
  disabled?: boolean;
  recipeName?: string;
  recipeId?: string;
  ingredientNameMap: Map<string, string>;
}

const GridCell: React.FC<GridCellProps> = ({
  mealType,
  dayOfWeek,
  activeWeek,
  selectedPlan,
  selectedCustomer,
  selectedFamilyMemberId,
  familyMemberData,
  onAddToOrder,
  onRemoveFromOrder,
  orderItems,
  disabled = false,
  recipeName,
  recipeId,
  ingredientNameMap
}) => {
  const [recipeIngredients, setRecipeIngredients] = useState<any[]>([]);
  const [loadingIngredients, setLoadingIngredients] = useState(false);

  // Load recipe ingredients data when recipeId changes
  React.useEffect(() => {
    const loadRecipeIngredients = async () => {
      if (!recipeId) {
        setRecipeIngredients([]);
        return;
      }

      try {
        setLoadingIngredients(true);
        const { data, error } = await supabase
          .from('recipe_ingredients')
          .select('ingredient_id, recipe_ingredient_restriction_management')
          .eq('recipe_id', recipeId);

        if (error) {
          console.error('Error loading recipe ingredients:', error);
          setRecipeIngredients([]);
        } else {
          setRecipeIngredients(data || []);
        }
      } catch (error) {
        console.error('Error loading recipe ingredients:', error);
        setRecipeIngredients([]);
      } finally {
        setLoadingIngredients(false);
      }
    };

    loadRecipeIngredients();
  }, [recipeId]);
  
  // Get recipe ingredients with their restriction management from database
  const getRecipeIngredientsWithRestrictions = (): Array<{
    ingredient_id: string;
    restriction_management: string;
  }> => {
    return recipeIngredients.map(ingredient => ({
      ingredient_id: ingredient.ingredient_id,
      restriction_management: ingredient.recipe_ingredient_restriction_management || 'None'
    }));
  };

  // Get restriction IDs (family member or customer)
  const getCustomerRestrictionIds = (): string[] => {
    // Use family member restrictions if a family member is selected
    if (selectedFamilyMemberId && familyMemberData?.restrictions) {
      console.log(`[GridCell ${mealType}-${dayOfWeek}] Using family member restrictions:`, {
        familyMemberId: selectedFamilyMemberId,
        familyMemberName: familyMemberData.name,
        restrictionsCount: familyMemberData.restrictions.length,
        restrictions: familyMemberData.restrictions
      });
      return familyMemberData.restrictions;
    }

    // Otherwise use customer restrictions
    if (!selectedCustomer || !selectedCustomer.customer_restrictions || !Array.isArray(selectedCustomer.customer_restrictions)) {
      console.log(`[GridCell ${mealType}-${dayOfWeek}] No restrictions found`);
      return [];
    }
    console.log(`[GridCell ${mealType}-${dayOfWeek}] Using customer restrictions:`, {
      customerName: selectedCustomer.customer_name,
      restrictionsCount: selectedCustomer.customer_restrictions.length
    });
    return selectedCustomer.customer_restrictions;
  };

  // Check for conflicts and categorize them by restriction type
  const checkForConflictsWithTypes = () => {
    const recipeIngredientsWithRestrictions = getRecipeIngredientsWithRestrictions();
    const recipeIngredientIds = recipeIngredients.map(ing => ing.ingredient_id);
    const customerRestrictionIds = getCustomerRestrictionIds();
    
    if (recipeIngredientIds.length === 0 || customerRestrictionIds.length === 0) {
      return { 
        hasConflicts: false, 
        blockedIngredients: [], 
        restrictedIngredients: [],
        allConflictingIds: []
      };
    }
    
    const allConflictingIds = recipeIngredientIds.filter(ingredientId => 
      customerRestrictionIds.includes(ingredientId)
    );

    // Categorize conflicts by restriction management from recipe
    const blockedIngredients: string[] = [];
    const restrictedIngredients: string[] = [];
    
    allConflictingIds.forEach(ingredientId => {
      const recipeIngredient = recipeIngredientsWithRestrictions.find(ing => ing.ingredient_id === ingredientId);
      if (recipeIngredient && recipeIngredient.restriction_management === 'Block') {
        // This is a blocked ingredient (marked as Block in recipe)
        blockedIngredients.push(ingredientId);
      } else {
        // This is a general restriction
        restrictedIngredients.push(ingredientId);
      }
    });

    if (allConflictingIds.length > 0) {
      console.log(`[GridCell ${mealType}-${dayOfWeek}] Conflicts detected:`, {
        totalConflicts: allConflictingIds.length,
        blockedCount: blockedIngredients.length,
        restrictedCount: restrictedIngredients.length,
        conflictingIds: allConflictingIds
      });
    }

    return {
      hasConflicts: allConflictingIds.length > 0,
      blockedIngredients,
      restrictedIngredients,
      allConflictingIds
    };
  };

  const recipeIngredientsWithRestrictions = getRecipeIngredientsWithRestrictions();
  const recipeIngredientIds = recipeIngredients.map(ing => ing.ingredient_id);
  const customerRestrictionIds = getCustomerRestrictionIds();
  const { hasConflicts, blockedIngredients, restrictedIngredients, allConflictingIds } = checkForConflictsWithTypes();

  // Get current quantity from order items (scoped to current family member)
  const getCurrentQuantity = () => {
    const currentMemberId = selectedFamilyMemberId || null;
    return orderItems
      .filter(item =>
        item.meal_type === mealType &&
        item.day_of_week === dayOfWeek &&
        item.meal_plans_id === selectedPlan.meal_plans_id &&
        item.week_name === activeWeek.week.week_name &&
        (item.family_member_id || null) === currentMemberId
      )
      .reduce((total, item) => total + item.quantity, 0);
  };

  const currentQuantity = getCurrentQuantity();

  const handleAddOne = () => {
    if (!disabled) {
      const item: PendingOrderItem = {
        tempId: `temp_${Date.now()}_${Math.random()}`,
        order_week_id: '', // Will be set when order is created
        meal_plans_id: selectedPlan.meal_plans_id,
        meal_type: mealType,
        day_of_week: dayOfWeek,
        quantity: 1,
        meal_plan_name: selectedPlan.meal_plans_name,
        meal_plan_price: selectedPlan.meal_plans_price,
        recipe_name: recipeName,
        week_name: activeWeek.week.week_name,
        week_id: activeWeek.week.week_id,
        family_member_id: selectedFamilyMemberId || null,
        family_member_name: familyMemberData?.name || undefined
      };

      console.log('[GridCell] Adding item to order:', {
        mealType,
        dayOfWeek,
        recipeName,
        recipeId,
        familyMemberId: selectedFamilyMemberId,
        familyMemberName: familyMemberData?.name,
        item
      });

      onAddToOrder(item);
    }
  };

  const handleRemoveOne = () => {
    if (!disabled && currentQuantity > 0) {
      const currentMemberId = selectedFamilyMemberId || null;
      const itemsToRemove = orderItems.filter(item =>
        item.meal_type === mealType &&
        item.day_of_week === dayOfWeek &&
        item.meal_plans_id === selectedPlan.meal_plans_id &&
        item.week_name === activeWeek.week.week_name &&
        (item.family_member_id || null) === currentMemberId
      );

      if (itemsToRemove.length > 0) {
        const itemToRemove = itemsToRemove[itemsToRemove.length - 1];
        onRemoveFromOrder(itemToRemove.tempId);
      }
    }
  };

  const getCellBorderColor = () => {
    if (blockedIngredients.length > 0) return 'border-red-500 bg-red-50';
    if (restrictedIngredients.length > 0) return 'border-yellow-400 bg-yellow-50';
    return 'border-gray-200 bg-white';
  };

  return (
    <div className={`p-2 xl:p-3 rounded-lg border-2 ${getCellBorderColor()} transition-all duration-200 min-h-[140px] xl:min-h-[180px] flex flex-col`}>
      {/* Recipe Name */}
      <div className="mb-3">
        <p className={`text-xs xl:text-base font-medium leading-tight break-words ${recipeName ? 'text-gray-900' : 'text-gray-400 italic'}`}>
          {recipeName || 'Sin receta'}
        </p>
      </div>

      {/* Blocked Ingredients Warning */}
      {blockedIngredients.length > 0 && (
        <div className="mb-2 xl:mb-3 p-1.5 xl:p-2.5 bg-red-100 border border-red-400 rounded-lg">
          <div className="flex items-start space-x-1.5">
            <Ban className="w-3 xl:w-4 h-3 xl:h-4 text-red-700 flex-shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="text-xs font-bold text-red-900">
                Bloqueado
              </p>
              <p className="text-xs text-red-800 mt-0.5 break-words">
                Contiene: {blockedIngredients.map(id => ingredientNameMap.get(id) || id).join(', ')}
              </p>
              <p className="text-xs text-red-700 mt-1 italic">
                Selecciona otro platillo
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Restricted Ingredients Warning */}
      {restrictedIngredients.length > 0 && (
        <div className="mb-2 xl:mb-3 p-1 xl:p-2 bg-yellow-200 border border-yellow-400 rounded">
          <div className="flex items-center space-x-1">
            <AlertTriangle className="w-2 xl:w-3 h-2 xl:h-3 text-yellow-700 flex-shrink-0" />
            <p className="text-xs font-bold text-yellow-900 truncate">
              Restricciones
            </p>
          </div>
        </div>
      )}

      {/* Quantity Selector */}
      <div className={`flex items-center justify-center mb-2 xl:mb-3 mt-auto ${blockedIngredients.length > 0 ? 'opacity-40 pointer-events-none' : ''}`}>
        <div className="flex items-center space-x-2">
          <button
            onClick={handleRemoveOne}
            disabled={currentQuantity <= 0 || disabled || blockedIngredients.length > 0}
            className="w-6 xl:w-8 h-6 xl:h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Minus className="w-3 xl:w-4 h-3 xl:h-4 text-gray-600" />
          </button>
          <span className="w-6 xl:w-8 text-center font-medium text-gray-900 text-sm xl:text-lg">
            {currentQuantity}
          </span>
          <button
            onClick={handleAddOne}
            disabled={disabled || blockedIngredients.length > 0}
            className="w-6 xl:w-8 h-6 xl:h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus className="w-3 xl:w-4 h-3 xl:h-4 text-gray-600" />
          </button>
        </div>
      </div>
    </div>
  );
};

const MenuPlanningGrid: React.FC<MenuPlanningGridProps> = ({
  activeWeek,
  selectedPlan,
  selectedCustomer,
  selectedFamilyMemberId,
  onAddToOrder,
  onRemoveFromOrder,
  orderItems,
  disabled = false
}) => {
  const [weeklyMenuPlans, setWeeklyMenuPlans] = useState<any[]>([]);
  const [recipeNames, setRecipeNames] = useState<Map<string, string>>(new Map());
  const [loadingRecipes, setLoadingRecipes] = useState(false);
  const [familyMemberData, setFamilyMemberData] = useState<{ name: string; restrictions: string[] } | null>(null);
  const [ingredientNameMap, setIngredientNameMap] = useState<Map<string, string>>(new Map());
  const [blockedRecipeSet, setBlockedRecipeSet] = useState<Set<string>>(new Set());

  // Load ingredient names once for display in blocked warnings
  useEffect(() => {
    const loadIngredientNames = async () => {
      const { data, error } = await supabase
        .from('ingredients')
        .select('ingredient_id, ingredient_name');
      if (!error && data) {
        const map = new Map<string, string>();
        data.forEach(i => map.set(i.ingredient_id, i.ingredient_name));
        setIngredientNameMap(map);
      }
    };
    loadIngredientNames();
  }, []);

  // Compute which recipes are blocked for the current customer/family member
  const [recipeIngredientsCache, setRecipeIngredientsCache] = useState<Map<string, { ingredient_id: string; restriction_management: string }[]>>(new Map());

  useEffect(() => {
    const loadRecipeIngredients = async () => {
      if (weeklyMenuPlans.length === 0 || !selectedPlan) {
        setRecipeIngredientsCache(new Map());
        setBlockedRecipeSet(new Set());
        return;
      }
      const menuRecipe = weeklyMenuPlans[0];
      const recipeIds = new Set<string>();
      DAYS_OF_WEEK.forEach(day => {
        MEAL_TYPES.forEach(mt => {
          const col = buildRecipeColumn(day, mt.label);
          const rid = menuRecipe[col];
          if (rid) recipeIds.add(rid);
        });
      });
      if (recipeIds.size === 0) { setBlockedRecipeSet(new Set()); return; }

      const { data, error } = await supabase
        .from('recipe_ingredients')
        .select('recipe_id, ingredient_id, recipe_ingredient_restriction_management')
        .in('recipe_id', Array.from(recipeIds));
      if (error || !data) { setBlockedRecipeSet(new Set()); return; }

      const cache = new Map<string, { ingredient_id: string; restriction_management: string }[]>();
      data.forEach(row => {
        if (!cache.has(row.recipe_id)) cache.set(row.recipe_id, []);
        cache.get(row.recipe_id)!.push({ ingredient_id: row.ingredient_id, restriction_management: row.recipe_ingredient_restriction_management || 'None' });
      });
      setRecipeIngredientsCache(cache);

      // Determine which recipes are blocked for current restrictions
      const restrictions = getActiveRestrictions();
      const blocked = new Set<string>();
      cache.forEach((ingredients, recipeId) => {
        const hasBlock = ingredients.some(ing => ing.restriction_management === 'Block' && restrictions.includes(ing.ingredient_id));
        if (hasBlock) blocked.add(recipeId);
      });
      setBlockedRecipeSet(blocked);
    };
    loadRecipeIngredients();
  }, [weeklyMenuPlans, selectedPlan, selectedCustomer, selectedFamilyMemberId, familyMemberData]);

  const getActiveRestrictions = (): string[] => {
    if (selectedFamilyMemberId && familyMemberData?.restrictions) {
      return familyMemberData.restrictions;
    }
    return selectedCustomer?.customer_restrictions || [];
  };

  // Load family member data when selectedFamilyMemberId changes
  React.useEffect(() => {
    const loadFamilyMember = async () => {
      if (!selectedFamilyMemberId) {
        setFamilyMemberData(null);
        return;
      }

      try {
        const { data: customer, error } = await supabase
          .from('customers')
          .select('customer_name, customer_lastname, customer_restrictions')
          .eq('id', selectedFamilyMemberId)
          .maybeSingle();

        if (error || !customer) {
          setFamilyMemberData(null);
          return;
        }

        setFamilyMemberData({
          name: `${customer.customer_name} ${customer.customer_lastname}`.trim(),
          restrictions: customer.customer_restrictions || []
        });
      } catch (error) {
        console.error('[MenuPlanningGrid] Error loading family member:', error);
        setFamilyMemberData(null);
      }
    };

    loadFamilyMember();
  }, [selectedFamilyMemberId]);

  // Helper function to get meals for a specific selection type
  const getMealsForSelection = (
    selectionType: 'overall' | 'column' | 'row',
    mealTypeLabel?: MealTypeLabel,
    dayOfWeek?: DayOfWeek
  ): PendingOrderItem[] => {
    if (!activeWeek || !selectedPlan) return [];

    const meals: PendingOrderItem[] = [];
    
    const daysToProcess = selectionType === 'row' && dayOfWeek ? [dayOfWeek] : DAYS_OF_WEEK;
    const mealTypesToProcess = selectionType === 'column' && mealTypeLabel 
      ? MEAL_TYPES.filter(mt => mt.label === mealTypeLabel)
      : MEAL_TYPES;

    daysToProcess.forEach(day => {
      mealTypesToProcess.forEach(mealTypeObj => {
        const recipeData = getRecipeData(mealTypeObj.label, day);
        if (recipeData.id && !blockedRecipeSet.has(recipeData.id)) { // Skip blocked dishes
          const familyMemberId = selectedFamilyMemberId || null;
          const item: PendingOrderItem = {
            tempId: `select_${day}_${mealTypeObj.label}_${selectedPlan.meal_plans_id}_${activeWeek.week.week_name}${familyMemberId ? `_${familyMemberId}` : ''}`,
            order_week_id: '',
            meal_plans_id: selectedPlan.meal_plans_id,
            meal_type: mealTypeObj.label,
            day_of_week: day,
            quantity: 1,
            meal_plan_name: selectedPlan.meal_plans_name,
            meal_plan_price: selectedPlan.meal_plans_price,
            recipe_name: recipeData.name,
            week_name: activeWeek.week.week_name,
            week_id: activeWeek.week.week_id,
            family_member_id: familyMemberId,
            family_member_name: familyMemberData?.customer_name || undefined
          };
          meals.push(item);
        }
      });
    });

    return meals;
  };

  // Helper function to check if a selection is currently active (all meals are selected)
  const isSelectionActive = (
    selectionType: 'overall' | 'column' | 'row',
    mealTypeLabel?: MealTypeLabel,
    dayOfWeek?: DayOfWeek
  ): boolean => {
    const targetMeals = getMealsForSelection(selectionType, mealTypeLabel, dayOfWeek);
    
    if (targetMeals.length === 0) return false;

    // Check if all target meals are present in orderItems for the current family member
    return targetMeals.every(targetMeal => {
      return orderItems.some(orderItem =>
        orderItem.meal_type === targetMeal.meal_type &&
        orderItem.day_of_week === targetMeal.day_of_week &&
        orderItem.meal_plans_id === targetMeal.meal_plans_id &&
        orderItem.week_name === targetMeal.week_name &&
        (orderItem.family_member_id || null) === (selectedFamilyMemberId || null) &&
        orderItem.quantity > 0
      );
    });
  };

  // Helper function to get button properties based on selection state
  const getButtonProps = (
    selectionType: 'overall' | 'column' | 'row',
    mealTypeLabel?: MealTypeLabel,
    dayOfWeek?: DayOfWeek
  ) => {
    const isActive = isSelectionActive(selectionType, mealTypeLabel, dayOfWeek);
    
    return {
      text: isActive ? 'Quitar' : 'Todo',
      icon: isActive ? X : Check,
      colorClass: isActive ? 'bg-red-500 hover:bg-red-600' : 'bg-success-500 hover:bg-success-600',
      title: isActive ? 'Quitar selección' : 'Seleccionar todo'
    };
  };

  // Load weekly menu plans when active week and selected plan change
  React.useEffect(() => {
    const loadWeeklyMenuPlans = async () => {
      if (!activeWeek || !selectedPlan) {
        setWeeklyMenuPlans([]);
        setRecipeNames(new Map());
        return;
      }

      try {
        setLoadingRecipes(true);

        // Query menu_recipes table which has the new wide structure
        const { data: menuRecipesData, error: menuRecipesError } = await supabase
          .from('menu_recipes')
          .select('*')
          .eq('menu_id', activeWeek.week.weekly_menu)
          .eq('meal_plan_id', selectedPlan.meal_plans_id)
          .maybeSingle();

        if (menuRecipesError) {
          console.error('Error loading menu recipes:', menuRecipesError);
          setWeeklyMenuPlans([]);
          setRecipeNames(new Map());
          return;
        }

        if (!menuRecipesData) {
          setWeeklyMenuPlans([]);
          setRecipeNames(new Map());
          return;
        }

        setWeeklyMenuPlans([menuRecipesData]);

        // Collect all unique recipe IDs from the wide table
        const recipeIds = new Set<string>();
        DAYS_OF_WEEK.forEach(day => {
          MEAL_TYPES.forEach(mealTypeObj => {
            const columnName = buildRecipeColumn(day, mealTypeObj.label);
            const recipeId = menuRecipesData[columnName];
            if (recipeId) {
              recipeIds.add(recipeId);
            }
          });
        });

        // Fetch recipe names for all recipe IDs
        if (recipeIds.size > 0) {
          console.log('[MenuPlanningGrid] Fetching recipe names for IDs:', Array.from(recipeIds));
          const { data: recipesData, error: recipesError } = await supabase
            .from('recipes')
            .select('recipe_id, recipe_name')
            .in('recipe_id', Array.from(recipeIds));

          if (recipesError) {
            console.error('[MenuPlanningGrid] Error loading recipe names:', recipesError);
          } else if (recipesData) {
            console.log('[MenuPlanningGrid] Fetched recipes:', recipesData);
            const nameMap = new Map<string, string>();
            recipesData.forEach(recipe => {
              nameMap.set(recipe.recipe_id, recipe.recipe_name);
            });
            console.log('[MenuPlanningGrid] Recipe name map created:', Array.from(nameMap.entries()));
            setRecipeNames(nameMap);
          }
        }
      } catch (error) {
        console.error('Error loading menu recipes:', error);
        setWeeklyMenuPlans([]);
        setRecipeNames(new Map());
      } finally {
        setLoadingRecipes(false);
      }
    };

    loadWeeklyMenuPlans();
  }, [activeWeek, selectedPlan]);

  // Get recipe name and ID for a specific meal type and day
  const getRecipeData = (mealType: MealTypeLabel, dayOfWeek: DayOfWeek): { name: string | undefined; id: string | null } => {
    if (weeklyMenuPlans.length === 0 || !selectedPlan) {
      return { name: undefined, id: null };
    }

    const menuRecipe = weeklyMenuPlans[0];

    // Build the column name using the helper function
    const columnName = buildRecipeColumn(dayOfWeek, mealType);
    const recipeId = menuRecipe[columnName];

    if (!recipeId) {
      return { name: undefined, id: null };
    }

    // Get the recipe name from the recipeNames map
    const recipeName = recipeNames.get(recipeId);

    console.log(`[MenuPlanningGrid] getRecipeData for ${dayOfWeek} ${mealType}:`, {
      columnName,
      recipeId,
      recipeName,
      recipeNamesMapSize: recipeNames.size
    });

    return {
      name: recipeName,
      id: recipeId
    };
  };

  // Select all functionality
  const handleSelectAllOverall = () => {
    if (!activeWeek || !selectedPlan || disabled) return;

    const targetMeals = getMealsForSelection('overall');
    const isActive = isSelectionActive('overall');

    if (isActive) {
      // Remove all meals
      targetMeals.forEach(meal => {
        onRemoveFromOrder(meal);
      });
    } else {
      // Add all meals
      targetMeals.forEach(meal => {
        onAddToOrder(meal);
      });
    }
  };

  const handleSelectAllColumn = (mealTypeLabel: MealTypeLabel) => {
    if (!activeWeek || !selectedPlan || disabled) return;

    const targetMeals = getMealsForSelection('column', mealTypeLabel);
    const isActive = isSelectionActive('column', mealTypeLabel);

    if (isActive) {
      // Remove all meals in this column
      targetMeals.forEach(meal => {
        onRemoveFromOrder(meal);
      });
    } else {
      // Add all meals in this column
      targetMeals.forEach(meal => {
        onAddToOrder(meal);
      });
    }
  };

  const handleSelectAllRow = (dayOfWeek: DayOfWeek) => {
    if (!activeWeek || !selectedPlan || disabled) return;

    const targetMeals = getMealsForSelection('row', undefined, dayOfWeek);
    const isActive = isSelectionActive('row', undefined, dayOfWeek);

    if (isActive) {
      // Remove all meals in this row
      targetMeals.forEach(meal => {
        onRemoveFromOrder(meal);
      });
    } else {
      // Add all meals in this row
      targetMeals.forEach(meal => {
        onAddToOrder(meal);
      });
    }
  };

  if (!activeWeek) {
    return (
      <div className="bg-gray-50 rounded-xl p-8 text-center">
        <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          Selecciona una semana
        </h3>
        <p className="text-gray-600">
          Primero selecciona una semana de la lista para planificar el menú
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Planning Grid */}
      {selectedPlan ? (
        <div className="bg-white rounded-xl p-2 sm:p-3 md:p-4 lg:p-6 border border-gray-200">
          <h4 className="text-lg font-semibold text-gray-900 mb-6">
            {activeWeek.week.week_name} - {selectedPlan.meal_plans_name}
          </h4>
          
          {loadingRecipes && (
            <div className="mb-4 text-center">
              <div className="inline-flex items-center space-x-2 text-sm text-gray-600">
                <div className="w-4 h-4 border-2 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
                <span>Cargando recetas...</span>
              </div>
            </div>
          )}
          
          {/* Mobile Layout - Stacked Cards */}
          <div className="block lg:hidden space-y-2 sm:space-y-3">
            {/* Mobile Select All Overall */}
            <div className="bg-primary-50 border border-primary-200 rounded-xl p-3 mb-4">
              {(() => {
                const buttonProps = getButtonProps('overall');
                const Icon = buttonProps.icon;
                return (
                  <button
                    onClick={handleSelectAllOverall}
                    disabled={disabled}
                    className={`w-full flex items-center justify-center space-x-2 py-2 px-4 ${buttonProps.colorClass} text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="font-medium">{buttonProps.text === 'Todo' ? 'Seleccionar Todo' : 'Quitar Todo'}</span>
                  </button>
                );
              })()}
            </div>

            {DAYS_OF_WEEK.map((day) => (
              <div key={day} className="bg-gray-50 rounded-xl p-2 sm:p-3">
                <div className="flex items-center justify-between mb-4">
                  <h5 className="font-semibold text-gray-900">
                    {day}
                  </h5>
                  {(() => {
                    const buttonProps = getButtonProps('row', undefined, day);
                    const Icon = buttonProps.icon;
                    return (
                      <button
                        onClick={() => handleSelectAllRow(day)}
                        disabled={disabled}
                        className={`flex items-center space-x-1 px-2 py-1 ${buttonProps.colorClass} text-white rounded-lg transition-colors text-xs disabled:opacity-50 disabled:cursor-not-allowed`}
                        title={`${buttonProps.title} del ${day}`}
                      >
                        <Icon className="w-3 h-3" />
                        <span>{buttonProps.text}</span>
                      </button>
                    );
                  })()}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {MEAL_TYPES.map((mealTypeObj) => {
                    const recipeData = getRecipeData(mealTypeObj.label, day);
                    return (
                      <div key={`${day}-${mealTypeObj.label}`} className="space-y-1 sm:space-y-2">
                        <h6 className="text-sm font-medium text-gray-700 text-center">
                          {mealTypeObj.label}
                        </h6>
                        <GridCell
                          mealType={mealTypeObj.label}
                          dayOfWeek={day}
                          activeWeek={activeWeek}
                          selectedPlan={selectedPlan}
                          selectedCustomer={selectedCustomer}
                          selectedFamilyMemberId={selectedFamilyMemberId}
                          familyMemberData={familyMemberData}
                          onAddToOrder={onAddToOrder}
                          onRemoveFromOrder={onRemoveFromOrder}
                          orderItems={orderItems}
                          disabled={disabled}
                          recipeName={recipeData.name}
                          recipeId={recipeData.id}
                          ingredientNameMap={ingredientNameMap}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Desktop Layout - Grid */}
          {/* Desktop Layout - Responsive Grid */}
          <div className="hidden md:block">
            {/* XL Desktop: Table Layout */}
            <div className="hidden xl:block">
              {/* Top Header with Select All Buttons */}
              <div className="grid grid-cols-6 gap-2 mb-4">
                {/* Overall Select All */}
                <div className="flex items-center justify-center p-2 bg-primary-50 border border-primary-200 rounded-lg">
                  {(() => {
                    const buttonProps = getButtonProps('overall');
                    const Icon = buttonProps.icon;
                    return (
                      <button
                        onClick={handleSelectAllOverall}
                        disabled={disabled}
                        className={`flex items-center space-x-1 px-2 py-1 ${buttonProps.colorClass} text-white rounded text-xs disabled:opacity-50 disabled:cursor-not-allowed transition-colors`}
                        title={buttonProps.title}
                      >
                        <Icon className="w-3 h-3" />
                        <span>{buttonProps.text}</span>
                      </button>
                    );
                  })()}
                </div>
                
                {/* Column Select All for each meal type */}
                {MEAL_TYPES.map((mealTypeObj) => (
                  <div key={mealTypeObj.label} className="flex flex-col items-center justify-center p-2 bg-accent-50 border border-accent-200 rounded-lg space-y-1">
                    <span className="text-xs font-medium text-gray-700 text-center">{mealTypeObj.label}</span>
                    {(() => {
                      const buttonProps = getButtonProps('column', mealTypeObj.label);
                      const Icon = buttonProps.icon;
                      return (
                        <button
                          onClick={() => handleSelectAllColumn(mealTypeObj.label)}
                          disabled={disabled}
                          className={`flex items-center space-x-1 px-1 py-0.5 ${buttonProps.colorClass} text-white rounded text-xs disabled:opacity-50 disabled:cursor-not-allowed transition-colors`}
                          title={`${buttonProps.title} ${mealTypeObj.label}`}
                        >
                          <Icon className="w-2 h-2" />
                          <span>{buttonProps.text}</span>
                        </button>
                      );
                    })()}
                  </div>
                ))}
              </div>

              {/* Table Rows */}
              {DAYS_OF_WEEK.map((day) => (
                <div key={day} className="grid grid-cols-6 gap-2 mb-2">
                  {/* Day Label with Row Select All */}
                  <div className="flex flex-col items-center justify-center font-medium text-gray-700 text-sm p-2 bg-gray-100 rounded-lg space-y-1">
                    <span>{day}</span>
                    {(() => {
                      const buttonProps = getButtonProps('row', undefined, day);
                      const Icon = buttonProps.icon;
                      return (
                        <button
                          onClick={() => handleSelectAllRow(day)}
                          disabled={disabled}
                          className={`flex items-center space-x-1 px-1 py-0.5 ${buttonProps.colorClass} text-white rounded text-xs disabled:opacity-50 disabled:cursor-not-allowed transition-colors`}
                          title={`${buttonProps.title} del ${day}`}
                        >
                          <Icon className="w-2 h-2" />
                          <span>{buttonProps.text}</span>
                        </button>
                      );
                    })()}
                  </div>
                  
                  {/* Meal Cells */}
                  {MEAL_TYPES.map((mealTypeObj) => {
                    const recipeData = getRecipeData(mealTypeObj.label, day);
                    return (
                      <GridCell
                        key={`${day}-${mealTypeObj.label}`}
                        mealType={mealTypeObj.label}
                        dayOfWeek={day}
                        activeWeek={activeWeek}
                        selectedPlan={selectedPlan}
                        selectedCustomer={selectedCustomer}
                        selectedFamilyMemberId={selectedFamilyMemberId}
                        familyMemberData={familyMemberData}
                        onAddToOrder={onAddToOrder}
                        onRemoveFromOrder={onRemoveFromOrder}
                        orderItems={orderItems}
                        disabled={disabled}
                        recipeName={recipeData.name}
                        recipeId={recipeData.id}
                        ingredientNameMap={ingredientNameMap}
                      />
                    );
                  })}
                </div>
              ))}
            </div>

            {/* MD/LG: Card Layout */}
            <div className="xl:hidden space-y-4">
              {DAYS_OF_WEEK.map((day) => (
                <div key={day} className="bg-gray-50 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="font-semibold text-gray-900">{day}</h4>
                    {(() => {
                      const buttonProps = getButtonProps('row', undefined, day);
                      const Icon = buttonProps.icon;
                      return (
                        <button
                          onClick={() => handleSelectAllRow(day)}
                          disabled={disabled}
                          className={`flex items-center space-x-1 px-2 py-1 ${buttonProps.colorClass} text-white rounded-lg transition-colors text-xs disabled:opacity-50 disabled:cursor-not-allowed`}
                          title={`${buttonProps.title} del ${day}`}
                        >
                          <Icon className="w-3 h-3" />
                          <span>{buttonProps.text}</span>
                        </button>
                      );
                    })()}
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {MEAL_TYPES.map((mealTypeObj) => {
                      const recipeData = getRecipeData(mealTypeObj.label, day);
                      return (
                        <div key={`${day}-${mealTypeObj.label}`} className="space-y-2">
                          <h5 className="text-sm font-medium text-gray-700 text-center bg-gray-50 py-2 rounded-lg">
                            {mealTypeObj.label}
                          </h5>
                          <GridCell
                            mealType={mealTypeObj.label}
                            dayOfWeek={day}
                            activeWeek={activeWeek}
                            selectedPlan={selectedPlan}
                            selectedCustomer={selectedCustomer}
                            selectedFamilyMemberId={selectedFamilyMemberId}
                            familyMemberData={familyMemberData}
                            onAddToOrder={onAddToOrder}
                            onRemoveFromOrder={onRemoveFromOrder}
                            orderItems={orderItems}
                            disabled={disabled}
                            recipeName={recipeData.name}
                            recipeId={recipeData.id}
                            ingredientNameMap={ingredientNameMap}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      ) : (
        <div className="bg-gray-50 rounded-xl p-8 text-center">
          <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Selecciona un plan alimenticio
          </h3>
          <p className="text-gray-600">
            Selecciona un plan alimenticio para ver la planificación de menú
          </p>
        </div>
      )}
    </div>
  );
};

export default MenuPlanningGrid;