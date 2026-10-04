import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { CircleAlert as AlertCircle, ChevronLeft, ChevronRight, ShoppingCart, Calendar } from 'lucide-react';
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
import { validateOrderWeeks, getValidationMessage, getColacionesValidationMessage, getBillableMealCountForWeek } from '../../../utils/orderValidation';
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
import { friendlyError } from '../../utils/friendlyError';
import { resolveOrderPageContent } from './orderPageContent';

interface CustomerOrderProps {
  content?: unknown;
}

export const CustomerOrder: React.FC<CustomerOrderProps> = ({ content }) => {
  const texts = resolveOrderPageContent(content);
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
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Load customer restrictions

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

    if (cart.orderItems && cart.orderItems.length > 0) {
      setStep(5);
    }
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

  const handleToggleMondayDelivery = (weekTempId: string) => {
    setSelectedWeeks(prev => prev.map(w => {
      if (w.tempId !== weekTempId) return w;
      const isCurrentlyMonday = !!w.monday_delivery;
      const originalDate = w.original_week_date ?? w.week.week_date;

      if (isCurrentlyMonday) {
        return {
          ...w,
          monday_delivery: false,
          week: { ...w.week, week_date: originalDate },
          original_week_date: originalDate
        };
      }

      if (!originalDate) return w;
      const [year, month, day] = originalDate.split('-').map(Number);
      const date = new Date(year, month - 1, day);
      date.setDate(date.getDate() + 1);
      const mondayDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

      return {
        ...w,
        monday_delivery: true,
        original_week_date: originalDate,
        week: { ...w.week, week_date: mondayDate }
      };
    }));
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
      setCouponError(friendlyError(err, 'Error al validar el cupón'));
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

    const validation = validateOrderWeeks(orderItems, selectedWeeks.map(w => w.week.week_name));
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

  const selectedWeekNames = selectedWeeks.map(w => w.week.week_name);
  const orderValidation = validateOrderWeeks(orderItems, selectedWeekNames);
  const canAddToCart = orderValidation.isValid && selectedDeliveryOption && customer;

  const activeWeekBillable = activeWeek
    ? orderItems.filter(
        item =>
          item.week_name === activeWeek.week.week_name &&
          BILLABLE_MEAL_TYPES.includes(item.meal_type as any)
      ).length
    : 0;

  const steps = [
    { num: 1, label: texts.stepLabelDuration },
    { num: 2, label: texts.stepLabelWeek },
    { num: 3, label: texts.stepLabelPlan },
    { num: 4, label: texts.stepLabelMenu },
    { num: 5, label: texts.stepLabelSummary }
  ];

  const formatDeliveryDate = (dateStr?: string | null): string => {
    if (!dateStr) return '';
    const [y, m, d] = dateStr.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    return new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short' }).format(date);
  };

  const activeWeekIndex = activeWeek
    ? selectedWeeks.findIndex(w => w.tempId === activeWeek.tempId)
    : -1;

  const formatLongDeliveryDate = (dateStr?: string | null): string => {
    if (!dateStr) return '';
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Intl.DateTimeFormat('es-MX', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(y, m - 1, d));
  };
  const activeWeekDeliveryLabel = formatLongDeliveryDate(activeWeek?.week.week_date);
  const weekLabels: Record<string, string> = Object.fromEntries(
    selectedWeeks.map((w, i) => {
      const date = formatLongDeliveryDate(w.week.week_date);
      return [w.week.week_name, date ? `Semana ${i + 1} · ${date}` : `Semana ${i + 1}`];
    })
  );

  const incompleteWeeks = selectedWeeks.filter(
    w => getBillableMealCountForWeek(orderItems, w.week.week_name) < 3
  );

  const canReachStep = (target: number): boolean => {
    if (target <= 1) return true;
    if (target === 2) return planDuration != null;
    if (target === 3) return !!activeWeek;
    if (target === 4) return !!activeWeek && !!selectedPlan;
    return orderItems.length > 0;
  };

  const goToStep = (target: number) => {
    if (!canReachStep(target)) return;
    setStep(target as 1 | 2 | 3 | 4 | 5);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleContinue = () => {
    if (step === 4) {
      const nextWeek = incompleteWeeks.find(w => w.tempId !== activeWeek?.tempId);
      if (nextWeek) {
        handleWeekSelect(nextWeek);
        setStep(2);
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }
      goToStep(5);
      return;
    }
    goToStep(step + 1);
  };

  const canContinue = (): boolean => {
    if (step === 1) return planDuration != null;
    if (step === 2) return !!activeWeek;
    if (step === 3) return !!selectedPlan;
    if (step === 4) return activeWeekBillable >= 3;
    return false;
  };

  const continueLabel =
    step === 4
      ? (incompleteWeeks.some(w => w.tempId !== activeWeek?.tempId) ? texts.nextWeekButton : texts.viewSummaryButton)
      : texts.continueButton;

  // Running total for the floating summary bar
  const floatingItemsTotal = orderItems.reduce((total, item) => (
    BILLABLE_MEAL_TYPES.includes(item.meal_type as any)
      ? total + item.meal_plan_price * item.quantity
      : total
  ), 0);
  const floatingPlanDiscounts = appliedDiscountsWithAmounts.reduce((sum, d) => sum + d.amount, 0);
  const floatingBreakdown = calculatePriceBreakdown(
    floatingItemsTotal,
    floatingPlanDiscounts,
    selectedDeliveryOption?.delivery_options_price ?? 0,
    couponDiscountAmount,
    0,
    16
  );
  const totalBillableCount = orderItems
    .filter(item => BILLABLE_MEAL_TYPES.includes(item.meal_type as any))
    .reduce((sum, item) => sum + item.quantity, 0);
  const formatCurrency = (amount: number): string =>
    new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(amount);
  const showFloatingSummary = orderItems.length > 0 && step < 5;
  const floatingSummaryContent = (
    <>
      <span className="flex items-center gap-1.5 text-sm font-medium text-gray-600">
        <ShoppingCart className="w-4 h-4" />
        {totalBillableCount} comida{totalBillableCount !== 1 ? 's' : ''}
      </span>
      <span className="text-base font-bold">{formatCurrency(floatingBreakdown.finalTotal)}</span>
    </>
  );

  const validationWarnings = orderItems.length > 0 && !orderValidation.isValid ? (
    <>
      {texts.showMinMealsNotice && orderValidation.incompleteWeeks.length > 0 && (
        <div className="mb-6 bg-orange-50 border border-orange-200 rounded-xl p-4">
          <div className="flex items-start space-x-3">
            <AlertCircle className="w-5 h-5 text-orange-600 mt-0.5 flex-shrink-0" />
            <div>
              {texts.minMealsTitle && (
                <h3 className="text-sm font-semibold text-orange-800 mb-2">
                  {texts.minMealsTitle}
                </h3>
              )}
              {texts.minMealsDescription && (
                <p className="text-sm text-orange-700 mb-2">
                  {texts.minMealsDescription}
                </p>
              )}
              <ul className="text-sm text-orange-700 space-y-1">
                {orderValidation.incompleteWeeks.map((week, index) => (
                  <li key={index} className="flex items-center space-x-2">
                    <span className="w-1.5 h-1.5 bg-orange-600 rounded-full"></span>
                    <span>
                      <strong>{weekLabels[week.weekName] ?? week.weekName}:</strong> {week.billableMealCount} de 3 comidas principales seleccionadas
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {texts.showColacionesNotice && orderValidation.weeksNeedingColaciones.length > 0 && (
        <div className="mb-6 bg-blue-50 border border-blue-200 rounded-xl p-4">
          <div className="flex items-start space-x-3">
            <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
            <div>
              {texts.colacionesTitle && (
                <h3 className="text-sm font-semibold text-blue-800 mb-2">
                  {texts.colacionesTitle}
                </h3>
              )}
              {texts.colacionesDescription && (
                <p className="text-sm text-blue-700 mb-2">
                  {texts.colacionesDescription}
                </p>
              )}
              <ul className="text-sm text-blue-700 space-y-1">
                {orderValidation.weeksNeedingColaciones.map((week, index) => (
                  <li key={index} className="flex items-center space-x-2">
                    <span className="w-1.5 h-1.5 bg-blue-600 rounded-full"></span>
                    <span>
                      <strong>{weekLabels[week.weekName] ?? week.weekName}:</strong> {week.colacionesSelected} de {week.colacionesRequired} colaciones seleccionadas
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </>
  ) : null;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-40 lg:pb-8">
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
          {steps.map((s, index) => {
            const reachable = canReachStep(s.num);
            return (
              <React.Fragment key={s.num}>
                <button
                  type="button"
                  onClick={() => goToStep(s.num)}
                  disabled={!reachable}
                  className={`flex items-center space-x-1 sm:space-x-2 ${reachable ? 'cursor-pointer' : 'cursor-not-allowed'}`}
                >
                  <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-xs sm:text-sm font-medium flex-shrink-0 transition-all ${
                    step === s.num
                      ? 'bg-red-500 text-white ring-2 ring-red-200'
                      : step > s.num
                        ? 'bg-red-500 text-white'
                        : 'bg-gray-300 text-gray-500'
                  }`}>
                    {s.num}
                  </div>
                  <span className={`text-sm font-medium hidden sm:block ${
                    step >= s.num ? 'text-red-600' : 'text-gray-500'
                  }`}>{s.label}</span>
                </button>
                {index < steps.length - 1 && <div className="flex-1 h-px bg-gray-300 mx-1 sm:mx-2"></div>}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* Step 1: Plan Duration Selection */}
      {step === 1 && (
        <PlanDurationSelector
          selectedDuration={planDuration}
          onDurationSelect={handleDurationSelect}
          disabled={loading}
          texts={texts}
        />
      )}

      {/* Step 2: Week Selection */}
      {step === 2 && (
        <>
          {selectedWeeks.length > 1 && activeWeekIndex >= 0 && (
            <div className="mb-4 text-sm font-medium text-gray-600">
              Semana {activeWeekIndex + 1} de {selectedWeeks.length}
            </div>
          )}
          {selectedWeeks.length > 0 && (
            <CustomerWeekSelector
              selectedWeeks={selectedWeeks}
              activeWeek={activeWeek}
              onWeekSelect={handleWeekSelect}
              onToggleMondayDelivery={handleToggleMondayDelivery}
              orderItems={orderItems}
              texts={texts}
            />
          )}

          {activeWeek && customer && (
            <CustomerFamilyMemberSelector
              customerId={customer.id}
              customerName={`${customer.customer_name} ${customer.customer_lastname}`}
              selectedFamilyMemberId={selectedFamilyMemberId}
              onFamilyMemberSelect={handleFamilyMemberSelect}
              disabled={loading}
              texts={texts}
            />
          )}

          {texts.showNextStepNotice && texts.nextStepNotice && activeWeek && (
            <div className="mt-6 bg-red-50 border border-red-200 rounded-xl p-4 flex items-start space-x-3">
              <Calendar className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-red-800">
                {texts.nextStepNotice}{' '}
                <strong>{formatDeliveryDate(activeWeek.week.week_date)}</strong>.
              </p>
            </div>
          )}
        </>
      )}

      {/* Step 3: Plan Selection */}
      {step === 3 && activeWeek && (
        <CustomerMealPlanSelector
          activeWeek={activeWeek}
          selectedPlan={selectedPlan}
          onPlanSelect={handlePlanSelect}
          disabled={loading}
          orderItems={orderItems}
          weekNumber={activeWeekIndex + 1}
          deliveryDateLabel={activeWeekDeliveryLabel}
          texts={texts}
        />
      )}

      {/* Step 4: Menu (meals) Selector */}
      {step === 4 && activeWeek && selectedPlan && (
        <>
          {validationWarnings}
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
            weekNumber={activeWeekIndex + 1}
            deliveryDateLabel={activeWeekDeliveryLabel}
            texts={texts}
          />
        </>
      )}

      {/* Step 5: Resumen del Pedido */}
      {step === 5 && (
        <>
          {validationWarnings}
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
            isLoggedIn={!!customer}
            selectedWeekNames={selectedWeekNames}
            weekLabels={weekLabels}
            texts={texts}
          />
        </>
      )}

      {/* Bottom navigation bar: fixed on mobile, inline on desktop */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-200 shadow-[0_-4px_16px_rgba(0,0,0,0.08)] lg:static lg:z-auto lg:shadow-none lg:border-t-0 lg:mt-8 lg:bg-transparent">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          {showFloatingSummary && (
            <button
              type="button"
              onClick={() => goToStep(5)}
              className="lg:hidden w-full mb-2.5 pb-2.5 border-b border-gray-100 flex items-center justify-between text-gray-900"
            >
              {floatingSummaryContent}
            </button>
          )}
          <div className="flex items-center justify-between gap-3">
          {step > 1 ? (
            <button
              type="button"
              onClick={() => goToStep(step - 1)}
              className="inline-flex items-center gap-1.5 px-4 sm:px-5 py-3 rounded-xl border border-gray-300 text-gray-700 font-semibold text-sm hover:bg-gray-50 transition-colors active:scale-95 flex-shrink-0"
            >
              <ChevronLeft className="w-4 h-4" />
              <span className={step === 5 ? '' : 'hidden sm:inline'}>{texts.backButton}</span>
            </button>
          ) : (
            <div className="flex-shrink-0" />
          )}

          {showFloatingSummary && (
            <button
              type="button"
              onClick={() => goToStep(5)}
              className="hidden lg:flex flex-1 min-w-0 items-center justify-center gap-3 text-gray-900"
            >
              {floatingSummaryContent}
            </button>
          )}

          {step < 5 ? (
            <button
              type="button"
              onClick={handleContinue}
              disabled={!canContinue()}
              className="inline-flex items-center gap-1.5 px-5 sm:px-6 py-3 rounded-xl bg-red-500 hover:bg-red-600 disabled:bg-gray-200 disabled:text-gray-400 text-white font-semibold text-sm transition-all active:scale-95 disabled:cursor-not-allowed disabled:active:scale-100 flex-shrink-0"
            >
              {continueLabel}
              <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <div className="flex-shrink-0" />
          )}
          </div>
        </div>
      </div>
    </div>
  );
};
