import { SupabaseClient } from '@supabase/supabase-js';
import { PendingOrderItem } from '../types/orderWeek';
import { SelectedWeek } from '../types/week';
import { CustomerWithDetails } from '../types/customer';
import { BlockedDishConflict } from '../components/orders/BlockedDishWarningModal';
import { buildRecipeColumn } from '../types/mealTypes';

export async function detectBlockedDishConflicts(
  orderItems: PendingOrderItem[],
  selectedWeeks: SelectedWeek[],
  selectedCustomer: CustomerWithDetails,
  supabase: SupabaseClient
): Promise<BlockedDishConflict[]> {
  if (orderItems.length === 0) return [];

  // Map week_id -> weekly_menu id
  const weekMenuMap = new Map<string, string>();
  selectedWeeks.forEach(sw => {
    if (sw.week.weekly_menu) {
      weekMenuMap.set(sw.week.week_id, sw.week.weekly_menu);
    }
  });

  // Collect unique (menuId, mealPlanId) pairs
  const menuPlanPairs = new Map<string, { menuId: string; mealPlanId: string }>();
  orderItems.forEach(item => {
    if (!item.week_id) return;
    const menuId = weekMenuMap.get(item.week_id);
    if (!menuId) return;
    const key = `${menuId}__${item.meal_plans_id}`;
    if (!menuPlanPairs.has(key)) {
      menuPlanPairs.set(key, { menuId, mealPlanId: item.meal_plans_id });
    }
  });

  if (menuPlanPairs.size === 0) return [];

  // Fetch menu_recipes rows for each (menu, plan) pair
  const menuRecipesMap = new Map<string, Record<string, string | null>>();
  for (const [key, { menuId, mealPlanId }] of menuPlanPairs) {
    const { data } = await supabase
      .from('menu_recipes')
      .select('*')
      .eq('menu_id', menuId)
      .eq('meal_plan_id', mealPlanId)
      .maybeSingle();
    if (data) menuRecipesMap.set(key, data);
  }

  // Resolve recipe_id for each order item
  type ItemWithRecipe = { item: PendingOrderItem; recipeId: string };
  const itemsWithRecipes: ItemWithRecipe[] = [];

  orderItems.forEach(item => {
    if (!item.week_id || item.quantity <= 0) return;
    const menuId = weekMenuMap.get(item.week_id);
    if (!menuId) return;
    const key = `${menuId}__${item.meal_plans_id}`;
    const menuRecipe = menuRecipesMap.get(key);
    if (!menuRecipe) return;
    const colName = buildRecipeColumn(item.day_of_week, item.meal_type);
    const recipeId = menuRecipe[colName as string];
    if (recipeId) {
      itemsWithRecipes.push({ item, recipeId });
    }
  });

  if (itemsWithRecipes.length === 0) return [];

  const uniqueRecipeIds = [...new Set(itemsWithRecipes.map(x => x.recipeId))];

  // Fetch recipe names and blocked ingredients in parallel
  const [recipesResult, ingredientsResult] = await Promise.all([
    supabase
      .from('recipes')
      .select('recipe_id, recipe_name')
      .in('recipe_id', uniqueRecipeIds),
    supabase
      .from('recipe_ingredients')
      .select('recipe_id, ingredient_id, recipe_ingredient_restriction_management')
      .in('recipe_id', uniqueRecipeIds),
  ]);

  const recipeNameMap = new Map<string, string>();
  (recipesResult.data ?? []).forEach(r => {
    recipeNameMap.set(r.recipe_id, r.recipe_name);
  });

  // Build map: recipeId -> Set of blocked ingredient IDs
  const blockedIngsByRecipe = new Map<string, Set<string>>();
  (ingredientsResult.data ?? []).forEach(ing => {
    if (ing.recipe_ingredient_restriction_management === 'Block') {
      if (!blockedIngsByRecipe.has(ing.recipe_id)) {
        blockedIngsByRecipe.set(ing.recipe_id, new Set());
      }
      blockedIngsByRecipe.get(ing.recipe_id)!.add(ing.ingredient_id);
    }
  });

  // Fetch family member restrictions if needed
  const familyMemberRestrictionsCache = new Map<string, string[]>();
  const uniqueFamilyMemberIds = [...new Set(
    orderItems.map(i => i.family_member_id).filter((id): id is string => !!id)
  )];
  for (const fmId of uniqueFamilyMemberIds) {
    const { data: fmData } = await supabase
      .from('family_members')
      .select('family_member_restrictions')
      .eq('id', fmId)
      .maybeSingle();
    if (fmData?.family_member_restrictions) {
      familyMemberRestrictionsCache.set(fmId, fmData.family_member_restrictions);
    }
  }

  const customerRestrictions: string[] = selectedCustomer.customer_restrictions || [];

  const conflicts: BlockedDishConflict[] = [];

  itemsWithRecipes.forEach(({ item, recipeId }) => {
    const blockedIngs = blockedIngsByRecipe.get(recipeId);
    if (!blockedIngs || blockedIngs.size === 0) return;

    const applicableRestrictions = item.family_member_id
      ? (familyMemberRestrictionsCache.get(item.family_member_id) ?? customerRestrictions)
      : customerRestrictions;

    const hasBlockedConflict = [...blockedIngs].some(ingId =>
      applicableRestrictions.includes(ingId)
    );

    if (hasBlockedConflict) {
      conflicts.push({
        recipeName: recipeNameMap.get(recipeId) || item.recipe_name || '(platillo sin nombre)',
        dayOfWeek: item.day_of_week,
        mealType: item.meal_type,
        weekName: item.week_name,
        familyMemberName: item.family_member_name || null,
      });
    }
  });

  return conflicts;
}
