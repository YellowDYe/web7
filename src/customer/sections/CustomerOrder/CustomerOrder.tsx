import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { CircleAlert as AlertCircle } from 'lucide-react';
import { useCustomerAuth } from '../../contexts/CustomerAuthContext';
import { useCart } from '../../contexts/CartContext';
import { SelectedWeek } from '../../../types/week';
import { MealPlan } from '../../../types/mealPlan';
import { DeliveryOption } from '../../../types/deliveryOption';
import { PendingOrderItem, BILLABLE_MEAL_TYPES } from '../../../types/orderMenu';
import { Coupon } from '../../../types/coupon';
import { Discount } from '../../../types/discount';
import { DiscountWithAmount } from '../../../components/orders/OrderSummary';
import { weekService } from '../../../services/weekService';
import { deliveryOptionService } from '../../../services/deliveryOptionService';
import { discountService } from '../../../services/discountService';
import { couponService } from '../../../services/couponService';
import { calculatePriceBreakdown } from '../../../utils/priceCalculations';
import { ingredientService } from '../../../services/ingredientService';
import { validateOrderWeeks, getValidationMessage, getColacionesValidationMessage } from '../../../utils/orderValidation';
import { planIncludesColaciones, calculateRequiredColaciones, getBillableMealsForWeek } from '../../../utils/colacionesHelper';
import { DAYS_OF_WEEK, buildRecipeColumn } from '../../../types/mealTypes';
import { supabase } from '../../../config/supabase';
import PlanDurationSelector from '../../components/orders/PlanDurationSelector';
import CustomerWeekSelector from '../../components/orders/CustomerWeekSelector';
import CustomerMealPlanSelector from '../../components/orders/CustomerMealPlanSelector';
import CustomerPackageSelector from '../../components/orders/CustomerPackageSelector';
import CustomerOrderSidePanel from '../../components/orders/CustomerOrderSidePanel';
import CustomerFamilyMemberSelector from '../../components/orders/CustomerFamilyMemberSelector';
import { FamilyMember } from '../../../types/familyMember';
import { isCustomerFirstOrder } from '../../services/customerOrderService';

export const CustomerOrder: React.FC = () => {
  const navigate = useNavigate();
  const { customer } = useCustomerAuth();
  const { cart, addToCart } = useCart();

  // Order state
  const [planDuration, setPlanDuration] = useState<1 | 2 | 4 | null>(null);
  const [selectedWeeks, setSelectedWeeks] = useState<SelectedWeek[]>([]);
  const [activeWeek, setActiveWeek] = useState<SelectedWeek | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<MealPlan | null>(null);
  const [selectedDeliveryOption, setSelectedDeliveryOption] = useState<DeliveryOption | null>(null);
  const [orderItems, setOrderItems] = useState<PendingOrderItem[]>([]);
  const [orderNotes, setOrderNotes] = useState('');
  const [selectedFamilyMemberId, setSelectedFamilyMemberId] = useState<string | null>(null);
  const [selectedFamilyMember, setSelectedFamilyMember] = useState<FamilyMember | null>(null);

  // Discounts and coupons
  const [availableDiscounts, setAvailableDiscounts] = useState<Discount[]>([]);
  const [appliedDiscountsWithAmounts, setAppliedDiscountsWithAmounts] = useState<DiscountWithAmount[]>([]);
  const [appliedCoupon, setAppliedCoupon] = useState<Coupon | null>(null);
  const [couponDiscountAmount, setCouponDiscountAmount] = useState<number>(0);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [validatingCoupon, setValidatingCoupon] = useState(false);

  // Menu recipe data for resolving colacion recipe names
  const [menuRecipesRow, setMenuRecipesRow] = useState<Record<string, string | null> | null>(null);
  const [colacionRecipeNames, setColacionRecipeNames] = useState<Map<string, string>>(new Map());


  // First-order detection
  const [isFirstOrder, setIsFirstOrder] = useState(false);
  const firstOrderCheckedRef = useRef(false);

  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [restrictionNames, setRestrictionNames] = useState<string[]>([]);
  const [loadingRestrictions, setLoadingRestrictions] = useState(false);

  // Restore order state from cart on mount
  const cartRestoredRef = useRef(false);
  useEffect(() => {
    if (cartRestoredRef.current) return;
    if (!cart || !cart.planDuration) return;

    cartRestoredRef.current = true;

    setPlanDuration(cart.planDuration);
    setSelectedWeeks(cart.selectedWeeks);
    setActiveWeek(cart.activeWeek ?? (cart.selectedWeeks[0] ?? null));
    setSelectedPlan(cart.selectedPlan ?? null);
    setSelectedDeliveryOption(cart.selectedDeliveryOption);
    setOrderItems(cart.orderItems);
    setOrderNotes(cart.orderNotes);
    setSelectedFamilyMemberId(cart.selectedFamilyMemberId ?? null);
    setSelectedFamilyMember(cart.selectedFamilyMember ?? null);
    setAppliedCoupon(cart.appliedCoupon);
    setCouponDiscountAmount(cart.couponDiscountAmount);
  }, [cart]);

  // Auto-select delivery option when duration is set but delivery option is missing
  useEffect(() => {
    if (selectedDeliveryOption || !planDuration) return;
    const autoSelectDelivery = async () => {
      try {
        const deliveryOptions = await deliveryOptionService.getOptions();
        if (deliveryOptions.length === 0) return;
        let option: DeliveryOption | null = null;
        if (planDuration === 1) {
          option = deliveryOptions.find(opt => opt.delivery_options_name.toLowerCase() === 'semanal') ||
            deliveryOptions.find(opt => opt.delivery_options_name.toLowerCase().includes('semana') && !opt.delivery_options_name.toLowerCase().includes('dos')) || null;
        } else if (planDuration === 2) {
          option = deliveryOptions.find(opt => opt.delivery_options_name.toLowerCase().includes('dos semanas')) || null;
        } else if (planDuration === 4) {
          option = deliveryOptions.find(opt => opt.delivery_options_name.toLowerCase().includes('mensual')) || null;
        }
        setSelectedDeliveryOption(option || deliveryOptions[0]);
      } catch {
        // silently ignore
      }
    };
    autoSelectDelivery();
  }, [planDuration, selectedDeliveryOption]);

  // Load customer restrictions
  useEffect(() => {
    if (customer && customer.customer_restrictions && customer.customer_restrictions.length > 0) {
      loadRestrictionNames();
    }
  }, [customer]);

  // Detect first-order and auto-apply PRIMERPEDIDO coupon
  useEffect(() => {
    if (!customer || firstOrderCheckedRef.current) return;
    firstOrderCheckedRef.current = true;

    const checkAndApplyFirstOrderCoupon = async () => {
      try {
        const firstOrder = await isCustomerFirstOrder(customer.id);
        setIsFirstOrder(firstOrder);

        if (firstOrder && !appliedCoupon) {
          const result = await couponService.validateCoupon('PRIMERPEDIDO', customer.id, 0);
          if (result.valid && result.coupon && result.discount_amount !== undefined) {
            setAppliedCoupon(result.coupon);
            setCouponDiscountAmount(result.discount_amount);
            setCouponError(null);
          }
        }
      } catch (err) {
        console.error('Error checking first order:', err);
      }
    };

    checkAndApplyFirstOrderCoupon();
  }, [customer]);

  // Fetch menu_recipes row for current week/plan to resolve colacion recipe names
  useEffect(() => {
    if (!activeWeek?.week.weekly_menu || !selectedPlan) {
      setMenuRecipesRow(null);
      setColacionRecipeNames(new Map());
      return;
    }

    const fetchMenuRecipes = async () => {
      const { data } = await supabase
        .from('menu_recipes')
        .select('*')
        .eq('menu_id', activeWeek.week.weekly_menu)
        .eq('meal_plan_id', selectedPlan.meal_plans_id)
        .maybeSingle();

      if (!data) {
        setMenuRecipesRow(null);
        setColacionRecipeNames(new Map());
        return;
      }

      setMenuRecipesRow(data);

      const recipeIds = new Set<string>();
      DAYS_OF_WEEK.forEach(day => {
        const amCol = buildRecipeColumn(day, 'Colación AM');
        const pmCol = buildRecipeColumn(day, 'Colación PM');
        if (data[amCol]) recipeIds.add(data[amCol]);
        if (data[pmCol]) recipeIds.add(data[pmCol]);
      });

      if (recipeIds.size === 0) {
        setColacionRecipeNames(new Map());
        return;
      }

      const { data: recipesData } = await supabase
        .from('recipes')
        .select('recipe_id, recipe_name')
        .in('recipe_id', Array.from(recipeIds));

      const nameMap = new Map<string, string>();
      if (recipesData) {
        recipesData.forEach(r => nameMap.set(r.recipe_id, r.recipe_name));
      }
      setColacionRecipeNames(nameMap);
    };

    fetchMenuRecipes();
  }, [activeWeek, selectedPlan]);

  // Load available discounts
  useEffect(() => {
    loadDiscounts();
  }, []);

  // Recalculate discounts when order items change
  useEffect(() => {
    calculateAndApplyDiscounts();
  }, [orderItems, availableDiscounts]);

  // Recalculate coupon discount amount when order total changes
  useEffect(() => {
    if (!appliedCoupon || orderItems.length === 0) {
      if (appliedCoupon && orderItems.length === 0) setCouponDiscountAmount(0);
      return;
    }

    const itemsTotal = orderItems.reduce((total, item) => {
      if (BILLABLE_MEAL_TYPES.includes(item.meal_type as any)) {
        return total + (item.meal_plan_price * item.quantity);
      }
      return total;
    }, 0);

    const totalPlanDiscounts = appliedDiscountsWithAmounts.reduce((sum, d) => sum + d.amount, 0);
    const deliveryPrice = selectedDeliveryOption?.delivery_options_price ?? 0;
    const priceBreakdown = calculatePriceBreakdown(itemsTotal, totalPlanDiscounts, deliveryPrice, 0, 0, 16);
    const newDiscountAmount = couponService.calculateDiscount(appliedCoupon, priceBreakdown.totalBeforeCustomDiscount);
    setCouponDiscountAmount(newDiscountAmount);
  }, [appliedCoupon, orderItems, appliedDiscountsWithAmounts, selectedDeliveryOption]);

  // Track previous billable counts per week to detect changes
  const prevBillableRef = useRef<Record<string, number>>({});

  // Auto-populate colaciones when billable meals change for Balance/Fitness plans
  useEffect(() => {
    if (!selectedPlan || !activeWeek) return;
    if (!planIncludesColaciones(selectedPlan.meal_plans_id)) return;

    const weekName = activeWeek.week.week_name;
    const billableCount = getBillableMealsForWeek(orderItems, weekName, selectedPlan.meal_plans_id);
    const prevBillable = prevBillableRef.current[weekName] ?? -1;

    if (billableCount === prevBillable) return;
    prevBillableRef.current = { ...prevBillableRef.current, [weekName]: billableCount };

    const requiredColaciones = calculateRequiredColaciones(billableCount);

    setOrderItems(prev => {
      const withoutColaciones = prev.filter(item =>
        !(item.week_name === weekName &&
          item.meal_plans_id === selectedPlan.meal_plans_id &&
          (item.meal_type === 'Colación AM' || item.meal_type === 'Colación PM'))
      );

      if (requiredColaciones === 0) return withoutColaciones;

      const slots: { day: typeof DAYS_OF_WEEK[number]; type: 'Colación AM' | 'Colación PM' }[] = [];
      for (const day of DAYS_OF_WEEK) {
        slots.push({ day, type: 'Colación AM' });
        slots.push({ day, type: 'Colación PM' });
      }

      const newColaciones: PendingOrderItem[] = [];
      for (let i = 0; i < requiredColaciones; i++) {
        const slot = slots[i % slots.length];
        let recipeName: string | undefined;
        if (menuRecipesRow) {
          const col = buildRecipeColumn(slot.day, slot.type);
          const recipeId = menuRecipesRow[col];
          if (recipeId) recipeName = colacionRecipeNames.get(recipeId);
        }
        newColaciones.push({
          tempId: `colacion_auto_${weekName}_${slot.day}_${slot.type}_${Date.now()}_${i}`,
          order_week_id: '',
          meal_plans_id: selectedPlan.meal_plans_id,
          meal_type: slot.type,
          day_of_week: slot.day,
          quantity: 1,
          meal_plan_name: selectedPlan.meal_plans_name,
          meal_plan_price: 0,
          recipe_name: recipeName,
          week_name: weekName,
          week_id: activeWeek.week.week_id,
          family_member_id: selectedFamilyMemberId,
          family_member_name: selectedFamilyMember?.family_member_name
        });
      }

      return [...withoutColaciones, ...newColaciones];
    });
  }, [orderItems, selectedPlan, activeWeek, selectedFamilyMemberId, selectedFamilyMember, menuRecipesRow, colacionRecipeNames]);

  const loadRestrictionNames = async () => {
    if (!customer?.customer_restrictions) return;

    try {
      setLoadingRestrictions(true);
      const nameMap = await ingredientService.getIngredientNamesByIds(customer.customer_restrictions);
      const names = customer.customer_restrictions
        .map(id => nameMap.get(id))
        .filter((name): name is string => name !== undefined);
      setRestrictionNames(names);
    } catch (err) {
      console.error('Error loading restriction names:', err);
      setRestrictionNames([]);
    } finally {
      setLoadingRestrictions(false);
    }
  };

  const loadDiscounts = async () => {
    try {
      const discounts = await discountService.getActiveDiscounts();
      setAvailableDiscounts(discounts);
    } catch (err) {
      console.error('Error loading discounts:', err);
    }
  };

  const handleClearOrder = () => {
    setOrderItems([]);
  };

  const handleDurationSelect = async (duration: 1 | 2 | 4) => {
    try {
      setLoading(true);
      setPlanDuration(duration);

      // Auto-select delivery option based on duration
      const deliveryOptions = await deliveryOptionService.getOptions();
      let selectedOption: DeliveryOption | null = null;

      if (duration === 1) {
        selectedOption = deliveryOptions.find(opt => opt.delivery_options_name.toLowerCase() === 'semanal') ||
          deliveryOptions.find(opt => opt.delivery_options_name.toLowerCase().includes('semana') && !opt.delivery_options_name.toLowerCase().includes('dos')) || null;
      } else if (duration === 2) {
        selectedOption = deliveryOptions.find(opt => opt.delivery_options_name.toLowerCase().includes('dos semanas')) || null;
      } else if (duration === 4) {
        selectedOption = deliveryOptions.find(opt => opt.delivery_options_name.toLowerCase().includes('mensual')) || null;
      }

      setSelectedDeliveryOption(selectedOption || deliveryOptions[0] || null);

      // Auto-select upcoming weeks
      const upcomingWeeks = await weekService.getUpcomingWeeks(duration);
      const selected = upcomingWeeks.map((week, index) => ({
        week,
        tempId: `temp_${Date.now()}_${index}`
      }));
      setSelectedWeeks(selected);

      // Remove items belonging to weeks that are no longer selected
      const retainedWeekNames = new Set(selected.map(s => s.week.week_name));
      setOrderItems(prev => prev.filter(item => retainedWeekNames.has(item.week_name)));

      // Set first week as active
      if (selected.length > 0) {
        setActiveWeek(selected[0]);
      }
    } catch (err) {
      console.error('Error selecting duration:', err);
      setError('Error al seleccionar la duración del plan');
    } finally {
      setLoading(false);
    }
  };

  const handleWeekSelect = (week: SelectedWeek) => {
    setActiveWeek(week);
    setSelectedPlan(null);

    setSelectedFamilyMemberId(week.family_member_id || null);
    if (week.family_member_id) {
      const member: FamilyMember | null = {
        id: week.family_member_id,
        slot: 1,
        customer_id: customer?.id || '',
        family_member_name: week.family_member_name || '',
        family_member_restrictions: week.family_member_restrictions || []
      };
      setSelectedFamilyMember(member);
    } else {
      setSelectedFamilyMember(null);
    }
  };

  const handlePlanSelect = (plan: MealPlan | null) => {
    setSelectedPlan(plan);
  };

  const handleConfirmPackage = (items: PendingOrderItem[], pendingIds: string[]) => {
    const groupedByWeek = items.reduce<Record<string, PendingOrderItem[]>>((acc, item) => {
      if (!acc[item.week_name]) acc[item.week_name] = [];
      acc[item.week_name].push(item);
      return acc;
    }, {});

    setOrderItems(prev => {
      let next = [...prev];
      Object.entries(groupedByWeek).forEach(([weekName, weekItems]) => {
        const mealTypesBeingAdded = [...new Set(weekItems.map(i => i.meal_type))];
        const planIds = [...new Set(weekItems.map(i => i.meal_plans_id))];
        next = next.filter(item =>
          !(planIds.includes(item.meal_plans_id) &&
            item.week_name === weekName &&
            mealTypesBeingAdded.includes(item.meal_type as any))
        );
      });
      return [...next, ...items];
    });

  };

  const handleRemovePackageMealType = (mealType: string, planId: string, weekName: string) => {
    setOrderItems(prev =>
      prev.filter(item =>
        !(item.week_name === weekName &&
          item.meal_plans_id === planId &&
          item.meal_type === mealType)
      )
    );
  };


  const handleFamilyMemberSelect = (familyMemberId: string | null, member: FamilyMember | null) => {
    setSelectedFamilyMemberId(familyMemberId);
    setSelectedFamilyMember(member);

    if (activeWeek) {
      setSelectedWeeks(prev => prev.map(w =>
        w.tempId === activeWeek.tempId
          ? {
              ...w,
              family_member_id: familyMemberId,
              family_member_name: member?.family_member_name,
              family_member_restrictions: member?.family_member_restrictions
            }
          : w
      ));
    }
  };

  const handleAddToOrder = (item: PendingOrderItem) => {
    const itemWithFamilyMember: PendingOrderItem = {
      ...item,
      family_member_id: selectedFamilyMemberId,
      family_member_name: selectedFamilyMember?.family_member_name
    };

    setOrderItems(prev => {
      const existingItemIndex = prev.findIndex(existingItem =>
        existingItem.meal_type === item.meal_type &&
        existingItem.day_of_week === item.day_of_week &&
        existingItem.meal_plans_id === item.meal_plans_id &&
        existingItem.week_name === item.week_name &&
        existingItem.family_member_id === selectedFamilyMemberId
      );

      if (existingItemIndex !== -1) {
        const updatedItems = [...prev];
        updatedItems[existingItemIndex] = {
          ...updatedItems[existingItemIndex],
          quantity: updatedItems[existingItemIndex].quantity + item.quantity
        };
        return updatedItems;
      } else {
        return [...prev, itemWithFamilyMember];
      }
    });
  };

  const handleRemoveOrderItem = (itemToRemove: PendingOrderItem | string) => {
    setOrderItems(prev => {
      if (typeof itemToRemove === 'string') {
        const itemIndex = prev.findIndex(item => item.tempId === itemToRemove);
        if (itemIndex === -1) return prev;

        const item = prev[itemIndex];
        if (item.quantity > 1) {
          const updatedItems = [...prev];
          updatedItems[itemIndex] = {
            ...item,
            quantity: item.quantity - 1
          };
          return updatedItems;
        } else {
          return prev.filter(item => item.tempId !== itemToRemove);
        }
      } else {
        return prev.filter(item => !(
          item.meal_type === itemToRemove.meal_type &&
          item.day_of_week === itemToRemove.day_of_week &&
          item.meal_plans_id === itemToRemove.meal_plans_id &&
          item.week_name === itemToRemove.week_name
        ));
      }
    });
  };

  const calculateDishesPerPlan = (): Record<string, number> => {
    const planCounts: Record<string, number> = {};

    orderItems.forEach(item => {
      if (BILLABLE_MEAL_TYPES.includes(item.meal_type as any)) {
        const planName = item.meal_plan_name;
        planCounts[planName] = (planCounts[planName] || 0) + item.quantity;
      }
    });

    return planCounts;
  };

  const getApplicableDiscountForPlan = (mealPlansId: string, dishCount: number): Discount | null => {
    const planDiscounts = availableDiscounts.filter(d => d.meal_plans_id === mealPlansId);
    const applicableDiscounts = planDiscounts.filter(d => dishCount >= d.threshold);

    if (applicableDiscounts.length === 0) return null;

    return applicableDiscounts.reduce((best, current) =>
      current.threshold > best.threshold ? current : best
    );
  };

  const calculateAndApplyDiscounts = () => {
    const dishesPerPlan = calculateDishesPerPlan();
    const discountsWithAmounts: DiscountWithAmount[] = [];

    Object.entries(dishesPerPlan).forEach(([planName, dishCount]) => {
      const planItem = orderItems.find(item => item.meal_plan_name === planName);
      if (!planItem) return;

      const discount = getApplicableDiscountForPlan(planItem.meal_plans_id, dishCount);
      if (discount) {
        const planItemsTotal = orderItems
          .filter(item =>
            BILLABLE_MEAL_TYPES.includes(item.meal_type as any) &&
            item.meal_plans_id === planItem.meal_plans_id
          )
          .reduce((total, item) => total + (item.meal_plan_price * item.quantity), 0);

        const planDiscountAmount = planItemsTotal * (discount.discount_percentage / 100);

        discountsWithAmounts.push({
          discount,
          amount: planDiscountAmount
        });
      }
    });

    setAppliedDiscountsWithAmounts(discountsWithAmounts);
  };

  const handleApplyCoupon = async (code: string) => {
    try {
      setValidatingCoupon(true);
      setCouponError(null);

      if (!selectedDeliveryOption || orderItems.length === 0) {
        setCouponError('Necesitas agregar platillos a tu pedido primero');
        return;
      }

      const itemsTotal = orderItems.reduce((total, item) => {
        if (BILLABLE_MEAL_TYPES.includes(item.meal_type as any)) {
          return total + (item.meal_plan_price * item.quantity);
        }
        return total;
      }, 0);

      const totalPlanDiscounts = appliedDiscountsWithAmounts.reduce((sum, d) => sum + d.amount, 0);
      const deliveryPrice = selectedDeliveryOption.delivery_options_price;
      const taxRate = 16;

      const priceBreakdown = calculatePriceBreakdown(
        itemsTotal,
        totalPlanDiscounts,
        deliveryPrice,
        0,
        0,
        taxRate
      );

      const orderTotal = priceBreakdown.totalBeforeCustomDiscount;

      const result = await couponService.validateCoupon(
        code,
        customer?.id || null,
        orderTotal
      );

      if (result.valid && result.coupon && result.discount_amount !== undefined) {
        setAppliedCoupon(result.coupon);
        setCouponDiscountAmount(result.discount_amount);
        setCouponError(null);
      } else {
        setCouponError(result.message || 'Cupón no válido');
      }
    } catch (err: any) {
      console.error('Error applying coupon:', err);
      setCouponError(err.message || 'Error al validar el cupón');
    } finally {
      setValidatingCoupon(false);
    }
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setCouponDiscountAmount(0);
    setCouponError(null);
  };

  const handleAddToCart = () => {
    if (!planDuration || !selectedDeliveryOption) {
      setError('Por favor completa todos los campos requeridos');
      return;
    }

    const validation = validateOrderWeeks(orderItems);
    if (!validation.isValid) {
      let message = '';
      if (validation.incompleteWeeks.length > 0) {
        message = getValidationMessage(validation.incompleteWeeks);
      }
      if (validation.weeksNeedingColaciones.length > 0) {
        const colacionesMessage = getColacionesValidationMessage(validation.weeksNeedingColaciones);
        message = message ? `${message}. ${colacionesMessage}` : colacionesMessage;
      }
      setError(`No se puede agregar al carrito: ${message}`);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    // Add order to cart
    addToCart({
      planDuration,
      selectedWeeks,
      activeWeek,
      selectedPlan,
      selectedFamilyMemberId,
      selectedFamilyMember,
      orderItems,
      orderNotes,
      selectedDeliveryOption,
      appliedCoupon,
      couponDiscountAmount
    });

    // Redirect to cart page to review
    navigate('/cart');
  };

  const getCurrentStep = () => {
    if (!planDuration) return 1;
    if (selectedWeeks.length === 0) return 2;
    if (!selectedPlan) return 3;
    const billableForActiveWeek = activeWeek
      ? orderItems.filter(
          item =>
            item.week_name === activeWeek.week.week_name &&
            BILLABLE_MEAL_TYPES.includes(item.meal_type as any)
        ).length
      : 0;
    if (billableForActiveWeek === 0) return 4;
    const validation = validateOrderWeeks(orderItems);
    if (!validation.isValid) return 4;
    return 5;
  };

  const orderValidation = validateOrderWeeks(orderItems);
  const currentStep = getCurrentStep();
  const canAddToCart = orderValidation.isValid && selectedDeliveryOption && customer;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold text-gray-900 mb-2">Crear Pedido</h1>
        <p className="text-lg text-gray-600">Selecciona tus comidas favoritas</p>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-center space-x-2">
          <AlertCircle className="w-5 h-5" />
          <span>{error}</span>
        </div>
      )}

      {/* Progress Indicator */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          {[
            { num: 1, label: 'Duración' },
            { num: 2, label: 'Semanas' },
            { num: 3, label: 'Plan' },
            { num: 4, label: 'Paquete' },
            { num: 5, label: 'Resumen' }
          ].map((step, index) => (
            <React.Fragment key={step.num}>
              <div className="flex items-center space-x-2">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium ${
                  currentStep >= step.num ? 'bg-red-500 text-white' : 'bg-gray-300 text-gray-500'
                }`}>
                  {step.num}
                </div>
                <span className={`text-sm font-medium hidden sm:block ${
                  currentStep >= step.num ? 'text-red-600' : 'text-gray-500'
                }`}>{step.label}</span>
              </div>
              {index < 4 && <div className="flex-1 h-px bg-gray-300 mx-2"></div>}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Customer Restrictions Display */}
      {customer && restrictionNames.length > 0 && (
        <div className="mb-6 bg-orange-50 border border-orange-200 rounded-xl p-4">
          <h3 className="text-sm font-medium text-orange-800 mb-2">Tus Restricciones Alimenticias:</h3>
          <div className="flex flex-wrap gap-2">
            {restrictionNames.map((name, index) => (
              <span key={index} className="px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-sm">
                {name}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Validation Warning */}
      {orderItems.length > 0 && !orderValidation.isValid && (
        <>
          {orderValidation.incompleteWeeks.length > 0 && (
            <div className="mb-6 bg-orange-50 border border-orange-200 rounded-xl p-4">
              <div className="flex items-start space-x-3">
                <AlertCircle className="w-5 h-5 text-orange-600 mt-0.5 flex-shrink-0" />
                <div>
                  <h3 className="text-sm font-semibold text-orange-800 mb-2">
                    Completa el mínimo de comidas por semana
                  </h3>
                  <p className="text-sm text-orange-700 mb-2">
                    Cada semana debe tener al menos 3 comidas principales (Desayuno, Comida o Cena). Las colaciones no cuentan para el mínimo.
                  </p>
                  <ul className="text-sm text-orange-700 space-y-1">
                    {orderValidation.incompleteWeeks.map((week, index) => (
                      <li key={index} className="flex items-center space-x-2">
                        <span className="w-1.5 h-1.5 bg-orange-600 rounded-full"></span>
                        <span>
                          <strong>{week.weekName}:</strong> {week.billableMealCount} de 3 comidas principales seleccionadas
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {orderValidation.weeksNeedingColaciones.length > 0 && (
            <div className="mb-6 bg-blue-50 border border-blue-200 rounded-xl p-4">
              <div className="flex items-start space-x-3">
                <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                <div>
                  <h3 className="text-sm font-semibold text-blue-800 mb-2">
                    Completa las colaciones requeridas
                  </h3>
                  <p className="text-sm text-blue-700 mb-2">
                    Los planes Fitness y Balance incluyen colaciones. Debes seleccionar el número requerido según tus comidas principales.
                  </p>
                  <ul className="text-sm text-blue-700 space-y-1">
                    {orderValidation.weeksNeedingColaciones.map((week, index) => (
                      <li key={index} className="flex items-center space-x-2">
                        <span className="w-1.5 h-1.5 bg-blue-600 rounded-full"></span>
                        <span>
                          <strong>{week.weekName}:</strong> {week.colacionesSelected} de {week.colacionesRequired} colaciones seleccionadas
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Step 1: Plan Duration Selection */}
      <PlanDurationSelector
        selectedDuration={planDuration}
        onDurationSelect={handleDurationSelect}
        disabled={loading}
      />

      {/* Step 2: Week Display */}
      {selectedWeeks.length > 0 && (
        <CustomerWeekSelector
          selectedWeeks={selectedWeeks}
          activeWeek={activeWeek}
          onWeekSelect={handleWeekSelect}
          deliveryOption={selectedDeliveryOption}
          orderItems={orderItems}
        />
      )}

      {/* Step 2.5: Family Member Selection */}
      {activeWeek && customer && (
        <CustomerFamilyMemberSelector
          customerId={customer.id}
          customerName={`${customer.customer_name} ${customer.customer_lastname}`}
          selectedFamilyMemberId={selectedFamilyMemberId}
          onFamilyMemberSelect={handleFamilyMemberSelect}
          disabled={loading}
        />
      )}

      {/* Step 3: Meal Plan Selection */}
      {activeWeek && (
        <CustomerMealPlanSelector
          activeWeek={activeWeek}
          selectedPlan={selectedPlan}
          onPlanSelect={handlePlanSelect}
          disabled={loading}
          orderItems={orderItems}
        />
      )}

      {/* Step 4: Package Selector */}
      {activeWeek && selectedPlan && (
        <CustomerPackageSelector
          key={activeWeek.tempId}
          activeWeek={activeWeek}
          selectedPlan={selectedPlan}
          orderItems={orderItems}
          selectedFamilyMemberId={selectedFamilyMemberId}
          selectedFamilyMemberName={selectedFamilyMember?.family_member_name}
          customerRestrictions={
            selectedFamilyMember
              ? selectedFamilyMember.family_member_restrictions
              : customer?.customer_restrictions || []
          }
          onConfirmPackage={handleConfirmPackage}
          onRemovePackageMealType={handleRemovePackageMealType}
          disabled={loading}
        />
      )}

      {/* Resumen del Pedido */}
      {activeWeek && selectedPlan && (
        <CustomerOrderSidePanel
          orderItems={orderItems}
          selectedDeliveryOption={selectedDeliveryOption}
          appliedDiscounts={appliedDiscountsWithAmounts}
          couponDiscountAmount={couponDiscountAmount}
          appliedCoupon={appliedCoupon}
          onRemoveItem={handleRemoveOrderItem}
          onAddToCart={handleAddToCart}
          onClearOrder={handleClearOrder}
          orderNotes={orderNotes}
          onOrderNotesChange={setOrderNotes}
          isFirstOrder={isFirstOrder}
          loading={loading}
          canAddToCart={!!canAddToCart}
        />
      )}
    </div>
  );
};
