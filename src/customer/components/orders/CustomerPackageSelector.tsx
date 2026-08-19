import React, { useState, useEffect, useRef } from 'react';
import { Package, Coffee, Sun, Soup, Minus, Plus, Check, ShoppingBag, Trash2, TriangleAlert as AlertTriangle, Ban } from 'lucide-react';
import { SelectedWeek } from '../../../types/week';
import { MealPlan } from '../../../types/mealPlan';
import { PendingOrderItem, BILLABLE_MEAL_TYPES } from '../../../types/orderMenu';
import { DAYS_OF_WEEK, buildRecipeColumn } from '../../../types/mealTypes';
import { supabase } from '../../../config/supabase';

interface CardQuantity {
  desayuno: number;
  comida: number;
  cena: number;
}

interface CardSelected {
  desayuno: boolean;
  comida: boolean;
  cena: boolean;
}

interface AddedMealTypeSummary {
  mealType: 'Desayuno' | 'Comida' | 'Cena';
  planId: string;
  planName: string;
  quantity: number;
  pricePerDish: number;
}

export interface PendingListEntry {
  id: string;
  mealType: 'Desayuno' | 'Comida' | 'Cena';
  categoryKey: 'desayuno' | 'comida' | 'cena';
  planId: string;
  planName: string;
  pricePerDish: number;
  quantity: number;
  weekName: string;
  weekId: string;
  weekTempId: string;
}

interface CustomerPackageSelectorProps {
  activeWeek: SelectedWeek;
  selectedPlan: MealPlan;
  orderItems: PendingOrderItem[];
  selectedFamilyMemberId: string | null;
  selectedFamilyMemberName?: string;
  customerRestrictions?: string[];
  onConfirmPackage: (items: PendingOrderItem[], pendingIds: string[]) => void;
  onRemovePackageMealType: (mealType: string, planId: string, weekName: string) => void;
  disabled?: boolean;
}

const MIN_QUANTITY = 0;
const DEFAULT_QUANTITY = 5;

const MEAL_CATEGORIES = [
  {
    key: 'desayuno' as const,
    label: 'Desayuno',
    labelPlural: 'Desayunos',
    mealType: 'Desayuno' as const,
    icon: Sun,
    color: 'amber' as const,
    description: 'Empieza el día con energía',
  },
  {
    key: 'comida' as const,
    label: 'Comida',
    labelPlural: 'Comidas',
    mealType: 'Comida' as const,
    icon: Soup,
    color: 'emerald' as const,
    description: 'El plato fuerte del día',
  },
  {
    key: 'cena' as const,
    label: 'Cena',
    labelPlural: 'Cenas',
    mealType: 'Cena' as const,
    icon: Coffee,
    color: 'blue' as const,
    description: 'Cierra el día bien nutrido',
  },
];

const COLOR_MAP = {
  amber: {
    bg: 'bg-amber-50',
    bgSelected: 'bg-amber-50',
    border: 'border-amber-200',
    borderSelected: 'border-amber-400',
    icon: 'bg-amber-100 text-amber-600',
    iconSelected: 'bg-amber-500 text-white',
    text: 'text-amber-700',
    textDark: 'text-amber-800',
    stepper: 'border-amber-300 text-amber-700 hover:bg-amber-100',
    badge: 'bg-amber-100 text-amber-800 border border-amber-200',
    badgeSelected: 'bg-amber-500 text-white',
    checkRing: 'ring-2 ring-amber-400',
    summaryRow: 'bg-amber-50 border-amber-200',
    summaryIcon: 'bg-amber-100 text-amber-600',
    summaryText: 'text-amber-700',
    pill: 'bg-amber-100 text-amber-800',
    addBtn: 'bg-amber-500 hover:bg-amber-600 text-white',
  },
  emerald: {
    bg: 'bg-white',
    bgSelected: 'bg-emerald-50',
    border: 'border-emerald-200',
    borderSelected: 'border-emerald-500',
    icon: 'bg-emerald-100 text-emerald-600',
    iconSelected: 'bg-emerald-500 text-white',
    text: 'text-emerald-700',
    textDark: 'text-emerald-800',
    stepper: 'border-emerald-300 text-emerald-700 hover:bg-emerald-100',
    badge: 'bg-emerald-100 text-emerald-800 border border-emerald-200',
    badgeSelected: 'bg-emerald-500 text-white',
    checkRing: 'ring-2 ring-emerald-400',
    summaryRow: 'bg-emerald-50 border-emerald-200',
    summaryIcon: 'bg-emerald-100 text-emerald-600',
    summaryText: 'text-emerald-700',
    pill: 'bg-emerald-100 text-emerald-800',
    addBtn: 'bg-emerald-500 hover:bg-emerald-600 text-white',
  },
  blue: {
    bg: 'bg-white',
    bgSelected: 'bg-blue-50',
    border: 'border-blue-200',
    borderSelected: 'border-blue-500',
    icon: 'bg-blue-100 text-blue-600',
    iconSelected: 'bg-blue-500 text-white',
    text: 'text-blue-700',
    textDark: 'text-blue-800',
    stepper: 'border-blue-300 text-blue-700 hover:bg-blue-100',
    badge: 'bg-blue-100 text-blue-800 border border-blue-200',
    badgeSelected: 'bg-blue-500 text-white',
    checkRing: 'ring-2 ring-blue-400',
    summaryRow: 'bg-blue-50 border-blue-200',
    summaryIcon: 'bg-blue-100 text-blue-600',
    summaryText: 'text-blue-700',
    pill: 'bg-blue-100 text-blue-800',
    addBtn: 'bg-blue-500 hover:bg-blue-600 text-white',
  },
};

const formatCurrency = (amount: number): string =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(amount);

const CustomerPackageSelector: React.FC<CustomerPackageSelectorProps> = ({
  activeWeek,
  selectedPlan,
  orderItems,
  selectedFamilyMemberId,
  selectedFamilyMemberName,
  customerRestrictions = [],
  onConfirmPackage,
  onRemovePackageMealType,
  disabled = false,
}) => {
  const [quantities, setQuantities] = useState<CardQuantity>({
    desayuno: DEFAULT_QUANTITY,
    comida: DEFAULT_QUANTITY,
    cena: DEFAULT_QUANTITY,
  });

  const [selected, setSelected] = useState<CardSelected>({
    desayuno: false,
    comida: false,
    cena: false,
  });

  const [menuRecipesRow, setMenuRecipesRow] = useState<Record<string, string | null> | null>(null);
  const [recipeNames, setRecipeNames] = useState<Map<string, string>>(new Map());
  const [recipeRestrictions, setRecipeRestrictions] = useState<Map<string, string[]>>(new Map());
  const [blockedRecipeIds, setBlockedRecipeIds] = useState<Set<string>>(new Set());

  const weekName = activeWeek.week.week_name;

  // Pre-compute maximum available (non-blocked) dishes per meal type
  const maxAvailablePerType = React.useMemo(() => {
    const result: CardQuantity = { desayuno: DAYS_OF_WEEK.length, comida: DAYS_OF_WEEK.length, cena: DAYS_OF_WEEK.length };
    if (!menuRecipesRow || blockedRecipeIds.size === 0) return result;
    MEAL_CATEGORIES.forEach(cat => {
      let available = 0;
      DAYS_OF_WEEK.forEach(day => {
        const col = buildRecipeColumn(day, cat.mealType);
        const recipeId = menuRecipesRow[col];
        if (!recipeId || !blockedRecipeIds.has(recipeId)) available++;
      });
      result[cat.key] = available;
    });
    return result;
  }, [menuRecipesRow, blockedRecipeIds]);

  // Update displayed quantities when blocked dishes are computed (caps default to actual available)
  useEffect(() => {
    setQuantities(prev => {
      const next = { ...prev };
      let changed = false;
      (Object.keys(next) as (keyof CardQuantity)[]).forEach(key => {
        if (!selected[key] && next[key] > maxAvailablePerType[key]) {
          next[key] = maxAvailablePerType[key];
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [maxAvailablePerType]);

  // Cleanup: when blockedRecipeIds loads, remove blocked items from already-selected meal types
  const blockedCleanupDoneRef = useRef(false);
  useEffect(() => {
    if (blockedRecipeIds.size === 0 || !menuRecipesRow) return;
    if (blockedCleanupDoneRef.current) return;
    blockedCleanupDoneRef.current = true;

    MEAL_CATEGORIES.forEach(cat => {
      if (!selected[cat.key]) return;
      const currentItems = orderItems.filter(item =>
        item.meal_plans_id === selectedPlan.meal_plans_id &&
        item.week_name === weekName &&
        item.meal_type === cat.mealType &&
        (item.family_member_id ?? null) === (selectedFamilyMemberId ?? null)
      );
      if (currentItems.length === 0) return;

      const hasBlockedItem = currentItems.some(item => {
        if (!item.day_of_week) return false;
        const col = buildRecipeColumn(item.day_of_week, cat.mealType);
        const recipeId = menuRecipesRow[col];
        return recipeId && blockedRecipeIds.has(recipeId);
      });

      if (hasBlockedItem) {
        const rebuilt = buildItemsForMealType(
          cat.mealType,
          currentItems.length,
          selectedPlan.meal_plans_id,
          selectedPlan.meal_plans_name,
          selectedPlan.meal_plans_price,
          activeWeek.week.week_name,
          activeWeek.week.week_id,
        );
        setQuantities(prev => ({ ...prev, [cat.key]: rebuilt.length }));
        if (rebuilt.length === 0) {
          onRemovePackageMealType(cat.mealType, selectedPlan.meal_plans_id, weekName);
          setSelected(prev => ({ ...prev, [cat.key]: false }));
        } else {
          onConfirmPackage(rebuilt, []);
        }
      }
    });
  }, [blockedRecipeIds, menuRecipesRow]);

  const addedMealTypes: AddedMealTypeSummary[] = React.useMemo(() => {
    const weekItems = orderItems.filter(
      item =>
        item.week_name === weekName &&
        BILLABLE_MEAL_TYPES.includes(item.meal_type)
    );

    const byPlanAndType: Record<string, AddedMealTypeSummary> = {};
    weekItems.forEach(item => {
      const key = `${item.meal_plans_id}__${item.meal_type}`;
      if (!byPlanAndType[key]) {
        byPlanAndType[key] = {
          mealType: item.meal_type as 'Desayuno' | 'Comida' | 'Cena',
          planId: item.meal_plans_id,
          planName: item.meal_plan_name,
          quantity: 0,
          pricePerDish: item.meal_plan_price,
        };
      }
      byPlanAndType[key].quantity += item.quantity;
    });

    return Object.values(byPlanAndType).sort((a, b) => {
      const order = ['Desayuno', 'Comida', 'Cena'];
      return order.indexOf(a.mealType) - order.indexOf(b.mealType);
    });
  }, [orderItems, weekName]);

  const orderItemsRef = useRef(orderItems);
  orderItemsRef.current = orderItems;

  useEffect(() => {
    const items = orderItemsRef.current;
    const planId = selectedPlan.meal_plans_id;
    const memberId = selectedFamilyMemberId ?? null;

    const nextQuantities: CardQuantity = { desayuno: DEFAULT_QUANTITY, comida: DEFAULT_QUANTITY, cena: DEFAULT_QUANTITY };
    const nextSelected: CardSelected = { desayuno: false, comida: false, cena: false };

    MEAL_CATEGORIES.forEach(cat => {
      const total = items
        .filter(item =>
          item.meal_plans_id === planId &&
          item.week_name === weekName &&
          item.meal_type === cat.mealType &&
          (item.family_member_id ?? null) === memberId
        )
        .reduce((sum, item) => sum + item.quantity, 0);

      if (total > 0) {
        nextQuantities[cat.key] = total;
        nextSelected[cat.key] = true;
      }
    });

    setQuantities(nextQuantities);
    setSelected(nextSelected);
    blockedCleanupDoneRef.current = false;
  }, [selectedPlan.meal_plans_id, weekName, selectedFamilyMemberId]);

  useEffect(() => {
    if (!activeWeek?.week.weekly_menu || !selectedPlan) return;

    const fetchRecipes = async () => {
      try {
        const { data } = await supabase
          .from('menu_recipes')
          .select('*')
          .eq('menu_id', activeWeek.week.weekly_menu)
          .eq('meal_plan_id', selectedPlan.meal_plans_id)
          .maybeSingle();

        if (!data) {
          setMenuRecipesRow(null);
          setRecipeNames(new Map());
          return;
        }

        setMenuRecipesRow(data);

        const recipeIds = new Set<string>();
        DAYS_OF_WEEK.forEach(day => {
          ['Desayuno', 'Comida', 'Cena'].forEach(mealLabel => {
            const col = buildRecipeColumn(day, mealLabel as any);
            if (data[col]) recipeIds.add(data[col]);
          });
        });

        if (recipeIds.size === 0) {
          setRecipeNames(new Map());
          setRecipeRestrictions(new Map());
          return;
        }

        const [recipesRes, recipeIngredientsRes] = await Promise.all([
          supabase
            .from('recipes')
            .select('recipe_id, recipe_name')
            .in('recipe_id', Array.from(recipeIds)),
          customerRestrictions.length > 0
            ? supabase
                .from('recipe_ingredients')
                .select('recipe_id, ingredient_id, recipe_ingredient_restriction_management')
                .in('recipe_id', Array.from(recipeIds))
                .in('ingredient_id', customerRestrictions)
            : Promise.resolve({ data: [] }),
        ]);

        const nameMap = new Map<string, string>();
        if (recipesRes.data) {
          recipesRes.data.forEach(r => nameMap.set(r.recipe_id, r.recipe_name));
        }
        setRecipeNames(nameMap);

        const matchedRows = (recipeIngredientsRes.data as { recipe_id: string; ingredient_id: string; recipe_ingredient_restriction_management?: string }[] | null) ?? [];
        const restrictionMap = new Map<string, string[]>();
        const blocked = new Set<string>();

        if (matchedRows.length > 0) {
          const matchedIngredientIds = [...new Set(matchedRows.map(r => r.ingredient_id))];
          const { data: ingredientRows } = await supabase
            .from('ingredients')
            .select('ingredient_id, ingredient_name')
            .in('ingredient_id', matchedIngredientIds);

          const ingredientNameMap = new Map<string, string>();
          (ingredientRows ?? []).forEach(i => ingredientNameMap.set(i.ingredient_id, i.ingredient_name));

          matchedRows.forEach(row => {
            const mgmt = row.recipe_ingredient_restriction_management || 'None';
            const isBlocking = mgmt !== 'Remove' && mgmt !== 'Substitute';
            if (isBlocking) {
              blocked.add(row.recipe_id);
            }
            const ingName = ingredientNameMap.get(row.ingredient_id) || row.ingredient_id;
            const existing = restrictionMap.get(row.recipe_id) || [];
            if (!existing.includes(ingName)) existing.push(ingName);
            restrictionMap.set(row.recipe_id, existing);
          });
        }
        setRecipeRestrictions(restrictionMap);
        setBlockedRecipeIds(blocked);
      } catch {
        // silently ignore fetch errors
      }
    };

    fetchRecipes();
  }, [activeWeek, selectedPlan, customerRestrictions]);

  const buildItemsForMealType = (
    mealType: 'Desayuno' | 'Comida' | 'Cena',
    qty: number,
    planId: string,
    planName: string,
    pricePerDish: number,
    entryWeekName: string,
    entryWeekId: string,
  ): PendingOrderItem[] => {
    const items: PendingOrderItem[] = [];
    let added = 0;
    let dayIndex = 0;
    while (added < qty && dayIndex < DAYS_OF_WEEK.length) {
      const day = DAYS_OF_WEEK[dayIndex];
      dayIndex++;
      if (menuRecipesRow) {
        const col = buildRecipeColumn(day, mealType);
        const recipeId = menuRecipesRow[col];
        if (recipeId && blockedRecipeIds.has(recipeId)) continue;
      }
      let recipeName: string | undefined;
      if (menuRecipesRow) {
        const col = buildRecipeColumn(day, mealType);
        const recipeId = menuRecipesRow[col];
        if (recipeId) recipeName = recipeNames.get(recipeId);
      }
      items.push({
        tempId: `pkg_${entryWeekName}_${mealType}_${day}_${Date.now()}_${added}`,
        order_week_id: '',
        meal_plans_id: planId,
        meal_type: mealType,
        day_of_week: day,
        quantity: 1,
        meal_plan_name: planName,
        meal_plan_price: pricePerDish,
        recipe_name: recipeName,
        week_name: entryWeekName,
        week_id: entryWeekId,
        family_member_id: selectedFamilyMemberId,
        family_member_name: selectedFamilyMemberName,
      });
      added++;
    }
    return items;
  };

  const toggleCard = (key: keyof CardSelected) => {
    if (disabled) return;
    const isCurrentlySelected = selected[key];
    const cat = MEAL_CATEGORIES.find(c => c.key === key)!;

    if (!isCurrentlySelected) {
      const qty = quantities[key];
      const items = buildItemsForMealType(
        cat.mealType,
        qty,
        selectedPlan.meal_plans_id,
        selectedPlan.meal_plans_name,
        selectedPlan.meal_plans_price,
        activeWeek.week.week_name,
        activeWeek.week.week_id,
      );
      if (items.length !== qty) {
        setQuantities(prev => ({ ...prev, [key]: items.length }));
      }
      onConfirmPackage(items, []);
    } else {
      onRemovePackageMealType(cat.mealType, selectedPlan.meal_plans_id, weekName);
      setQuantities(prev => ({ ...prev, [key]: DEFAULT_QUANTITY }));
    }
    setSelected(prev => ({ ...prev, [key]: !isCurrentlySelected }));
  };

  const adjustQuantity = (key: keyof CardQuantity, delta: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (disabled) return;
    const newQty = Math.max(MIN_QUANTITY, quantities[key] + delta);
    setQuantities(prev => ({ ...prev, [key]: newQty }));

    const cat = MEAL_CATEGORIES.find(c => c.key === key)!;

    if (newQty === 0 && selected[key]) {
      onRemovePackageMealType(cat.mealType, selectedPlan.meal_plans_id, weekName);
      setSelected(prev => ({ ...prev, [key]: false }));
    } else if (selected[key] && newQty > 0) {
      const items = buildItemsForMealType(
        cat.mealType,
        newQty,
        selectedPlan.meal_plans_id,
        selectedPlan.meal_plans_name,
        selectedPlan.meal_plans_price,
        activeWeek.week.week_name,
        activeWeek.week.week_id,
      );
      if (items.length !== newQty) {
        setQuantities(prev => ({ ...prev, [key]: items.length }));
      }
      onConfirmPackage(items, []);
    }
  };

  const adjustDayQuantity = (key: keyof CardQuantity, day: string, delta: number) => {
    if (disabled) return;
    if (!selected[key]) return;

    const cat = MEAL_CATEGORIES.find(c => c.key === key)!;

    if (delta > 0 && menuRecipesRow) {
      const col = buildRecipeColumn(day, cat.mealType);
      const recipeId = menuRecipesRow[col];
      if (recipeId && blockedRecipeIds.has(recipeId)) return;
    }

    const currentMemberId = selectedFamilyMemberId || null;

    const dayItems = orderItems.filter(item =>
      item.meal_type === cat.mealType &&
      item.day_of_week === day &&
      item.meal_plans_id === selectedPlan.meal_plans_id &&
      item.week_name === weekName &&
      (item.family_member_id || null) === currentMemberId
    );
    const currentDayQty = dayItems.reduce((sum, item) => sum + item.quantity, 0);
    const newDayQty = Math.max(0, currentDayQty + delta);

    const totalDelta = newDayQty - currentDayQty;
    const newTotalQty = Math.max(MIN_QUANTITY, quantities[key] + totalDelta);
    setQuantities(prev => ({ ...prev, [key]: newTotalQty }));

    if (newTotalQty === 0) {
      onRemovePackageMealType(cat.mealType, selectedPlan.meal_plans_id, weekName);
      setSelected(prev => ({ ...prev, [key]: false }));
    } else {
      const items = buildItemsForMealTypeByDay(
        cat.mealType,
        day,
        newDayQty,
        selectedPlan.meal_plans_id,
        selectedPlan.meal_plans_name,
        selectedPlan.meal_plans_price,
        activeWeek.week.week_name,
        activeWeek.week.week_id,
      );
      onConfirmPackage(items, []);
    }
  };

  const buildItemsForMealTypeByDay = (
    mealType: 'Desayuno' | 'Comida' | 'Cena',
    targetDay: string,
    newDayQty: number,
    planId: string,
    planName: string,
    pricePerDish: number,
    entryWeekName: string,
    entryWeekId: string,
  ): PendingOrderItem[] => {
    const currentMemberId = selectedFamilyMemberId || null;
    const otherDayItems = orderItems.filter(item =>
      item.meal_type === mealType &&
      item.meal_plans_id === planId &&
      item.week_name === entryWeekName &&
      (item.family_member_id || null) === currentMemberId &&
      item.day_of_week !== targetDay
    );

    const items: PendingOrderItem[] = [...otherDayItems];

    if (newDayQty > 0) {
      let recipeName: string | undefined;
      if (menuRecipesRow) {
        const col = buildRecipeColumn(targetDay, mealType);
        const recipeId = menuRecipesRow[col];
        if (recipeId) recipeName = recipeNames.get(recipeId);
      }
      items.push({
        tempId: `pkg_${entryWeekName}_${mealType}_${targetDay}_${Date.now()}`,
        order_week_id: '',
        meal_plans_id: planId,
        meal_type: mealType,
        day_of_week: targetDay,
        quantity: newDayQty,
        meal_plan_name: planName,
        meal_plan_price: pricePerDish,
        recipe_name: recipeName,
        week_name: entryWeekName,
        week_id: entryWeekId,
        family_member_id: selectedFamilyMemberId || undefined,
        family_member_name: selectedFamilyMemberName,
      });
    }

    return items;
  };

  const handleRemoveMealType = (mealType: string, planId: string) => {
    onRemovePackageMealType(mealType, planId, weekName);
    const cat = MEAL_CATEGORIES.find(c => c.mealType === mealType);
    if (cat) {
      setSelected(prev => ({ ...prev, [cat.key]: false }));
      setQuantities(prev => ({ ...prev, [cat.key]: DEFAULT_QUANTITY }));
    }
  };

  const getMealCategoryColor = (mealType: 'Desayuno' | 'Comida' | 'Cena') => {
    const cat = MEAL_CATEGORIES.find(c => c.mealType === mealType);
    return cat ? COLOR_MAP[cat.color] : COLOR_MAP.emerald;
  };

  const getMealCategoryIcon = (mealType: 'Desayuno' | 'Comida' | 'Cena') => {
    const cat = MEAL_CATEGORIES.find(c => c.mealType === mealType);
    return cat ? cat.icon : Soup;
  };

  const totalInCart = addedMealTypes.reduce((sum, m) => sum + m.quantity, 0);
  const totalCartValue = addedMealTypes.reduce((sum, m) => sum + m.quantity * m.pricePerDish, 0);

  return (
    <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <div className="bg-red-100 p-2 rounded-lg">
            <Package className="w-5 h-5 text-red-600" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Selecciona tu Paquete</h2>
            <p className="text-sm text-gray-600">
              Elige qué tiempos de comida deseas para{' '}
              <span className="font-medium text-gray-900">{weekName}</span>
            </p>
          </div>
        </div>
        <div className="hidden sm:flex items-center space-x-2">
          <div className="px-3 py-1.5 bg-red-50 border border-red-200 rounded-full text-sm font-semibold text-red-700">
            {selectedPlan.meal_plans_name}
          </div>
          {totalInCart > 0 && (
            <div className="flex items-center space-x-1.5 px-3 py-1.5 bg-gray-900 rounded-full text-sm font-semibold text-white">
              <ShoppingBag className="w-3.5 h-3.5" />
              <span>{totalInCart} platillos en pedido</span>
            </div>
          )}
        </div>
      </div>

      {/* Already-confirmed items */}
      {addedMealTypes.length > 0 && (
        <div className="mb-6 rounded-xl border border-gray-200 overflow-hidden">
          <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <ShoppingBag className="w-4 h-4 text-gray-600" />
              <span className="text-sm font-semibold text-gray-700">Ya en tu pedido esta semana</span>
            </div>
            <span className="text-xs text-gray-500">{totalInCart} platillos · {formatCurrency(totalCartValue)}</span>
          </div>
          <div className="divide-y divide-gray-100">
            {addedMealTypes.map(entry => {
              const colors = getMealCategoryColor(entry.mealType);
              const Icon = getMealCategoryIcon(entry.mealType);
              return (
                <div key={`${entry.planId}_${entry.mealType}`} className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center space-x-3">
                    <div className={`p-1.5 rounded-lg ${colors.summaryIcon}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{entry.mealType}</p>
                      <p className={`text-xs font-medium ${colors.summaryText}`}>{entry.planName}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-4">
                    <div className="text-right">
                      <p className="text-sm font-semibold text-gray-900">{entry.quantity} platillos</p>
                      <p className="text-xs text-gray-500">{formatCurrency(entry.quantity * entry.pricePerDish)}</p>
                    </div>
                    <button
                      onClick={() => handleRemoveMealType(entry.mealType, entry.planId)}
                      disabled={disabled}
                      title={`Eliminar ${entry.mealType}`}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="bg-gray-50 px-4 py-2.5 border-t border-gray-200 flex items-center justify-between">
            <span className="text-xs text-gray-500">Subtotal acumulado</span>
            <span className="text-sm font-bold text-gray-900">{formatCurrency(totalCartValue)}</span>
          </div>
        </div>
      )}

      {/* Minimum total indicator */}
      {(() => {
        const pendingTotal = Object.entries(selected).reduce((sum, [key, isSelected]) => {
          return isSelected ? sum + quantities[key as keyof CardQuantity] : sum;
        }, 0);
        const grandTotal = totalInCart + pendingTotal;
        const MINIMUM_TOTAL = 3;
        const meetsMinimum = grandTotal >= MINIMUM_TOTAL;
        return (
          <div className={`mb-5 flex items-center justify-between px-4 py-3 rounded-xl border ${meetsMinimum ? 'bg-green-50 border-green-200' : 'bg-orange-50 border-orange-200'}`}>
            <div className="flex items-center space-x-2">
              <span className={`text-sm font-medium ${meetsMinimum ? 'text-green-700' : 'text-orange-700'}`}>
                {meetsMinimum
                  ? `Mínimo alcanzado — puedes combinar cualquier tiempo de comida`
                  : `Selecciona al menos 3 platillos en total (cualquier combinación)`}
              </span>
            </div>
            <div className={`flex items-center space-x-1.5 px-3 py-1 rounded-full text-sm font-bold ${meetsMinimum ? 'bg-green-500 text-white' : 'bg-orange-200 text-orange-800'}`}>
              <span>{grandTotal}</span>
              <span className="font-normal opacity-70">/ {MINIMUM_TOTAL}</span>
            </div>
          </div>
        );
      })()}

      {/* Selectable Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
        {MEAL_CATEGORIES.map(category => {
          const colors = COLOR_MAP[category.color];
          const Icon = category.icon;
          const qty = quantities[category.key];
          const subtotal = qty * selectedPlan.meal_plans_price;
          const isSelected = selected[category.key];
          const alreadyAdded = addedMealTypes.some(
            m => m.mealType === category.mealType && m.planId === selectedPlan.meal_plans_id
          );

          const dishes = menuRecipesRow
            ? DAYS_OF_WEEK.map(day => {
                const col = buildRecipeColumn(day, category.mealType);
                const recipeId = menuRecipesRow[col];
                const name = recipeId ? recipeNames.get(recipeId) : undefined;
                return name ? { day, name, recipeId: recipeId! } : null;
              }).filter(Boolean) as { day: string; name: string; recipeId: string }[]
            : [];

          const getDayQuantity = (day: string): number => {
            const currentMemberId = selectedFamilyMemberId || null;
            return orderItems
              .filter(item =>
                item.meal_type === category.mealType &&
                item.day_of_week === day &&
                item.meal_plans_id === selectedPlan.meal_plans_id &&
                item.week_name === weekName &&
                (item.family_member_id || null) === currentMemberId
              )
              .reduce((sum, item) => sum + item.quantity, 0);
          };

          return (
            <div
              key={category.key}
              className={`rounded-2xl border-2 overflow-hidden transition-all duration-200 select-none ${
                isSelected
                  ? `${colors.borderSelected} ${colors.bgSelected} shadow-md`
                  : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'
              } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <div className="p-5">
                {/* Card Header */}
                <div className="flex items-start justify-between mb-3">
                  <div className={`p-2.5 rounded-xl transition-all duration-200 ${isSelected ? colors.iconSelected : colors.icon}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="flex items-center space-x-2">
                    {alreadyAdded && !isSelected && (
                      <div className={`flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-semibold ${colors.badge}`}>
                        <Check className="w-3 h-3" />
                        <span>En pedido</span>
                      </div>
                    )}
                    {isSelected && (
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center ${colors.badgeSelected}`}>
                        <Check className="w-3.5 h-3.5" />
                      </div>
                    )}
                  </div>
                </div>

                <h3 className="text-lg font-bold text-gray-900">{category.label}</h3>
                <p className="text-sm text-gray-500 mt-0.5 mb-3">{category.description}</p>

                {/* Dish list from weekly menu */}
                {dishes.length > 0 && (
                  <div className="space-y-2 mb-3">
                    {dishes.map(({ day, name, recipeId }) => {
                      const dayQty = isSelected ? getDayQuantity(day) : 0;
                      const warnings = recipeRestrictions.get(recipeId) || [];
                      const isBlocked = blockedRecipeIds.has(recipeId);
                      const displayName = name.length > 50 ? `${name.slice(0, 50)}...` : name;
                      return (
                        <div key={day} className={`py-1 ${isBlocked ? 'opacity-60' : ''}`}>
                          <div className="flex items-start gap-2">
                            <span className={`text-xs font-semibold uppercase tracking-wide flex-shrink-0 w-10 pt-0.5 ${isBlocked ? 'text-red-400' : colors.text}`}>{day.slice(0, 3)}</span>
                            <span className={`text-sm leading-snug flex-1 min-w-0 break-words ${isBlocked ? 'text-gray-400 line-through' : 'text-gray-600'}`}>{displayName}</span>
                            {isSelected && !isBlocked && (
                              <div className="flex-shrink-0 flex items-center gap-0.5">
                                <button
                                  onClick={() => adjustDayQuantity(category.key, day, -1)}
                                  disabled={disabled || dayQty <= 0}
                                  className={`w-5 h-5 rounded-full border flex items-center justify-center text-gray-500 hover:text-gray-700 transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${colors.border}`}
                                >
                                  <Minus className="w-2.5 h-2.5" />
                                </button>
                                <span className={`w-4 text-center text-xs font-bold ${dayQty > 0 ? 'text-gray-900' : 'text-gray-300'}`}>{dayQty}</span>
                                <button
                                  onClick={() => adjustDayQuantity(category.key, day, 1)}
                                  disabled={disabled}
                                  className={`w-5 h-5 rounded-full border flex items-center justify-center text-gray-500 hover:text-gray-700 transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${colors.border}`}
                                >
                                  <Plus className="w-2.5 h-2.5" />
                                </button>
                              </div>
                            )}
                          </div>
                          {isBlocked && warnings.length > 0 && (
                            <div className="flex items-start gap-1.5 mt-1 ml-12 bg-red-50 border border-red-200 rounded-lg px-2 py-1.5">
                              <Ban className="w-3.5 h-3.5 text-red-500 flex-shrink-0 mt-0.5" />
                              <span className="text-xs text-red-600 font-medium leading-snug break-words">
                                No disponible por tu restricción: {warnings.join(', ')}
                              </span>
                            </div>
                          )}
                          {!isBlocked && warnings.length > 0 && (
                            <div className="flex items-start gap-1 mt-1 ml-12">
                              <AlertTriangle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0 mt-0.5" />
                              <span className="text-xs text-amber-600 font-medium leading-snug break-words">
                                Contiene: {warnings.join(', ')} (se puede retirar/sustituir)
                              </span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Quantity stepper — only visible when selected */}
                {isSelected && (
                  <div className={`mt-4 rounded-xl border ${colors.border} ${colors.bg} px-4 py-3`}>
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-xs font-semibold uppercase tracking-wide ${colors.text}`}>Cantidad total</span>
                      <span className={`text-xs font-medium text-gray-400`}>0 = eliminar</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => adjustQuantity(category.key, -1, { stopPropagation: () => {} } as React.MouseEvent)}
                          disabled={disabled || qty <= 0}
                          className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${colors.stepper}`}
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="w-8 text-center text-xl font-bold text-gray-900">{qty}</span>
                        <button
                          onClick={() => adjustQuantity(category.key, 1, { stopPropagation: () => {} } as React.MouseEvent)}
                          disabled={disabled}
                          className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${colors.stepper}`}
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <span className={`text-sm font-bold ${colors.textDark}`}>{formatCurrency(subtotal)}</span>
                    </div>
                  </div>
                )}

                {/* Explicit action button */}
                {!isSelected ? (
                  <div className="mt-4">
                    <p className="text-sm text-gray-500 mb-2">
                      {DEFAULT_QUANTITY} platillos · {formatCurrency(DEFAULT_QUANTITY * selectedPlan.meal_plans_price)}
                    </p>
                    <button
                      onClick={() => toggleCard(category.key)}
                      disabled={disabled}
                      className={`w-full flex items-center justify-center space-x-2 py-3 rounded-xl font-semibold text-sm transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed ${colors.addBtn} shadow-sm hover:shadow-md`}
                    >
                      <Plus className="w-4 h-4" />
                      <span>Agregar {category.labelPlural}</span>
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => toggleCard(category.key)}
                    disabled={disabled}
                    className="w-full mt-4 flex items-center justify-center space-x-2 py-2.5 rounded-xl font-semibold text-sm border-2 border-red-200 text-red-600 hover:bg-red-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Quitar del pedido</span>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>


    </div>
  );
};

export default CustomerPackageSelector;
