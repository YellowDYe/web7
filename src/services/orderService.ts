import { supabase } from '../config/supabase';
import { Order, PendingOrderItem, OrderWithDetails, CreateOrderData, SelectedWeek } from '../types/order';
import { DeliveryOption } from '../types';
import { BankAccount } from '../types/bankAccount';
import { taxService } from './taxService';
import {
  unpivotOrderWeek,
  pivotOrderItems,
  buildQuantityUpdates,
  groupItemsByWeekAndPlan,
  logTransformation,
  OrderWeekWithQuantities,
  MealPlanInfo,
  RecipeNameLookup
} from '../utils/orderWeeksTransformer';
import { buildRecipeColumn, DAYS_OF_WEEK, MEAL_TYPES } from '../types/mealTypes';

const BILLABLE_MEAL_TYPES = ['Desayuno', 'Comida', 'Cena'] as const;

export class OrderService {
  // Retry helper for handling transient database errors
  private async retryOperation<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    operationName: string = 'operation'
  ): Promise<T> {
    let lastError: any;
    const delays = [100, 300, 500]; // Exponential backoff delays in ms

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error: any) {
        lastError = error;

        // Check if this is a duplicate key error that might be resolved with retry
        const isDuplicateKeyError = error?.code === '23505' ||
                                    error?.message?.includes('duplicate key') ||
                                    error?.message?.includes('unique constraint');

        if (isDuplicateKeyError && attempt < maxRetries - 1) {
          const delay = delays[attempt] || 500;
          console.warn(`${operationName} attempt ${attempt + 1} failed with duplicate key error, retrying in ${delay}ms...`, error);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }

        // If it's not a duplicate key error or we've exhausted retries, throw
        if (attempt === maxRetries - 1) {
          console.error(`${operationName} failed after ${maxRetries} attempts:`, error);
        }
        throw error;
      }
    }

    throw lastError;
  }

  // Generate next order ID using database sequence (atomic, thread-safe)
  private async generateNextOrderId(): Promise<string> {
    try {
      // Use the database function to generate the next order ID atomically
      // This eliminates race conditions by using a PostgreSQL sequence
      const { data, error } = await supabase.rpc('generate_next_order_id');

      if (error) {
        console.error('Error generating order ID from sequence:', error);
        throw new Error(`Failed to generate order ID: ${error.message}`);
      }

      if (!data) {
        throw new Error('No order ID returned from sequence');
      }

      return data;
    } catch (error) {
      console.error('Error in generateNextOrderId:', error);
      throw error;
    }
  }

  // Get orders with server-side pagination, sorting, and filtering
  async getOrders(options: {
    page?: number;
    limit?: number;
    sortBy?: 'order_id' | 'order_customer_name' | 'order_total_price' | 'order_status' | 'created_at';
    sortDirection?: 'asc' | 'desc';
    searchTerm?: string;
    weekFilter?: string;
    deliveryDateFilter?: string;
  } = {}): Promise<{ orders: OrderWithDetails[]; totalCount: number }> {
    try {
      const {
        page = 1,
        limit = 10,
        sortBy = 'created_at',
        sortDirection = 'desc',
        searchTerm = '',
        weekFilter = '',
        deliveryDateFilter = ''
      } = options;

      // Build the base query
      let query = supabase
        .from('orders')
        .select(`
          *,
          customers!inner(
            customer_name,
            customer_email,
            customer_phone
          )
        `, { count: 'exact' });

      // Apply search filter
      if (searchTerm) {
        query = query.or(`order_id.ilike.%${searchTerm}%,order_customer_name.ilike.%${searchTerm}%,order_customer_email.ilike.%${searchTerm}%`);
      }

      // Apply sorting
      const ascending = sortDirection === 'asc';
      query = query.order(sortBy, { ascending });

      // Apply pagination
      const from = (page - 1) * limit;
      const to = from + limit - 1;
      query = query.range(from, to);

      const { data: orders, error: ordersError, count } = await query;

      if (ordersError) throw ordersError;
      if (!orders) return { orders: [], totalCount: 0 };

      // Get order IDs for this page
      const orderIds = orders.map(order => order.order_id);

      // Fetch order weeks ONLY for the current page's orders
      const { data: allOrderWeeks, error: weeksError } = await supabase
        .from('order_weeks')
        .select(`
          *,
          weeks(
            week_name
          ),
          meal_plans(
            meal_plans_id,
            meal_plans_name,
            meal_plans_price
          )
        `)
        .in('order_id', orderIds);

      if (weeksError) throw weeksError;

      // Fetch invoices ONLY for the current page's orders
      const { data: allInvoices, error: invoicesError } = await supabase
        .from('invoices')
        .select('order_id, total_amount, payment_date')
        .in('order_id', orderIds);

      if (invoicesError) {
        console.warn('Error fetching invoices:', invoicesError);
      }

      // Group weeks by order_id
      const weeksByOrder = (allOrderWeeks || []).reduce((acc, week) => {
        if (!acc[week.order_id]) acc[week.order_id] = [];
        acc[week.order_id].push(week);
        return acc;
      }, {} as Record<string, any[]>);

      // Group invoices by order_id with total_amount and payment_date
      const invoicesByOrder = (allInvoices || []).reduce((acc, invoice) => {
        acc[invoice.order_id] = {
          total_amount: invoice.total_amount,
          payment_date: invoice.payment_date
        };
        return acc;
      }, {} as Record<string, { total_amount: number; payment_date: string | null }>);

      // Add weeks data and invoice total to each order
      let ordersWithDetails = orders.map(order => ({
        ...order,
        weeks: weeksByOrder[order.order_id] || [],
        menuItems: [], // Will be loaded via getOrderWithDetails when needed
        weeks_count: weeksByOrder[order.order_id]?.length || 0,
        week_names: weeksByOrder[order.order_id]?.map(w => w.weeks.week_name) || [],
        delivery_dates: weeksByOrder[order.order_id]?.map(w => w.delivery_date).filter(Boolean) || [],
        invoice_total_amount: invoicesByOrder[order.order_id]?.total_amount || null,
        payment_date: invoicesByOrder[order.order_id]?.payment_date || null
      }));

      // Apply client-side filtering for week and delivery date (these require the joined data)
      if (weekFilter) {
        ordersWithDetails = ordersWithDetails.filter(order =>
          order.week_names.some(name => name === weekFilter)
        );
      }

      if (deliveryDateFilter) {
        ordersWithDetails = ordersWithDetails.filter(order =>
          order.delivery_dates.some(date => date === deliveryDateFilter)
        );
      }

      return {
        orders: ordersWithDetails,
        totalCount: count || 0
      };
    } catch (error) {
      console.error('Error fetching orders:', error);
      throw error;
    }
  }

  // Get order with full details
  async getOrderWithDetails(orderId: string): Promise<OrderWithDetails | null> {
    try {
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .select(`
          *,
          customers!inner(
            customer_name,
            customer_email,
            customer_phone,
            customer_street,
            customer_street_number,
            customer_interior_number,
            customer_colonia,
            customer_delegacion,
            customer_postal_code,
            customer_delivery_instructions
          )
        `)
        .eq('id', orderId)
        .single();

      if (orderError) throw orderError;
      if (!orderData) return null;

      const order = orderData;

      // Fetch order weeks with all quantity columns and meal plan details
      const { data: orderWeeks, error: weeksError } = await supabase
        .from('order_weeks')
        .select(`
          *,
          weeks(
            week_name,
            weekly_menu
          ),
          meal_plans(
            meal_plans_id,
            meal_plans_name,
            meal_plans_price
          )
        `)
        .eq('order_id', order.order_id);

      if (weeksError) throw weeksError;

      // Fetch menu recipes and recipe names for all order weeks
      const recipeNamesByWeek = new Map<string, RecipeNameLookup>();

      for (const week of orderWeeks || []) {
        if (week.meal_plans && week.meal_plan_id && week.weeks) {
          try {
            const weekData = week.weeks;

            if (weekData.weekly_menu) {
              const { data: menuRecipesData, error: menuRecipesError } = await supabase
                .from('menu_recipes')
                .select('*')
                .eq('menu_id', weekData.weekly_menu)
                .eq('meal_plan_id', week.meal_plan_id)
                .maybeSingle();

              if (menuRecipesData) {
                const recipeIds = new Set<string>();

                DAYS_OF_WEEK.forEach(day => {
                  MEAL_TYPES.forEach(mealType => {
                    const columnName = buildRecipeColumn(day, mealType.label);
                    const recipeId = menuRecipesData[columnName];
                    if (recipeId) {
                      recipeIds.add(recipeId);
                    }
                  });
                });


                if (recipeIds.size > 0) {
                  const { data: recipesData } = await supabase
                    .from('recipes')
                    .select('recipe_id, recipe_name')
                    .in('recipe_id', Array.from(recipeIds));

                  if (recipesData) {
                    const recipeNameMap: RecipeNameLookup = {};

                    DAYS_OF_WEEK.forEach(day => {
                      MEAL_TYPES.forEach(mealType => {
                        const columnName = buildRecipeColumn(day, mealType.label);
                        const recipeId = menuRecipesData[columnName];
                        if (recipeId) {
                          const recipe = recipesData.find(r => r.recipe_id === recipeId);
                          if (recipe) {
                            const lookupKey = `${day}-${mealType.label}`;
                            recipeNameMap[lookupKey] = recipe.recipe_name;
                          }
                        }
                      });
                    });

                    recipeNamesByWeek.set(week.order_week_id, recipeNameMap);
                  }
                }
              } else {
              }
            }
          } catch (error) {
            console.error('Error loading recipe names for week:', week.order_week_id, error);
          }
        }
      }

      // Transform order weeks into menu items using unpivot utility
      const menuItems: PendingOrderItem[] = [];

      for (const week of orderWeeks || []) {
        if (week.meal_plans && week.meal_plan_id) {
          const mealPlanInfo: MealPlanInfo = {
            meal_plans_id: week.meal_plans.meal_plans_id,
            meal_plans_name: week.meal_plans.meal_plans_name,
            meal_plans_price: week.meal_plans.meal_plans_price
          };
          const weekName = week.weeks.week_name;
          const recipeNameLookup = recipeNamesByWeek.get(week.order_week_id);

          const items = unpivotOrderWeek(week as OrderWeekWithQuantities, mealPlanInfo, weekName, recipeNameLookup);
          menuItems.push(...items);

          logTransformation('unpivot', {
            order_week_id: week.order_week_id,
            meal_plan: mealPlanInfo.meal_plans_name,
            hasRecipeNames: !!recipeNameLookup
          }, {
            itemCount: items.length,
            totalQuantity: items.reduce((sum, item) => sum + item.quantity, 0)
          });
        }
      }


      // Structure the response with all required data
      return {
        ...order,
        weeks: orderWeeks || [],
        menuItems,
        weeks_count: orderWeeks?.length || 0,
        week_names: orderWeeks?.map(w => w.weeks.week_name) || [],
        delivery_dates: orderWeeks?.map(w => w.delivery_date).filter(Boolean) || []
      };
    } catch (error) {
      console.error('Error fetching order details:', error);
      throw error;
    }
  }

  // Update existing order
  async updateOrder(orderUuid: string, updates: Partial<Order>): Promise<Order> {
    try {
      const { data, error } = await supabase
        .from('orders')
        .update(updates)
        .eq('id', orderUuid)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error updating order:', error);
      throw error;
    }
  }

  // Update order without triggering invoice synchronization
  async updateOrderWithoutInvoiceSync(orderUuid: string, updates: Partial<Order>): Promise<Order> {
    try {
      const { data, error } = await supabase
        .from('orders')
        .update(updates)
        .eq('id', orderUuid)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error updating order without invoice sync:', error);
      throw error;
    }
  }

  // Update order status specifically for payment toggle
  async updateOrderStatus(orderUuid: string, status: Order['order_status']): Promise<Order> {
    try {
      const { data, error } = await supabase
        .from('orders')
        .update({
          order_status: status,
          updated_at: new Date().toISOString()
        })
        .eq('id', orderUuid)
        .select()
        .single();

      if (error) throw error;

      // Synchronize invoice status and payment_date
      try {
        const { invoiceService } = await import('./invoiceService');
        const invoice = await invoiceService.getInvoiceByOrderId(data.order_id);

        if (invoice) {
          const newInvoiceStatus = status === 'completed' || status === 'delivered' ? 'paid' :
                                   status === 'cancelled' ? 'cancelled' : 'draft';
          const paymentDate = (status === 'completed' || status === 'delivered') ?
                             new Date().toISOString().split('T')[0] : null;

          await invoiceService.updateInvoiceStatus(invoice.id, newInvoiceStatus, paymentDate);
        }
      } catch (invoiceError) {
        console.warn('Could not update corresponding invoice status:', invoiceError);
        // Don't fail the order update if invoice update fails
      }

      return data;
    } catch (error) {
      console.error('Error updating order status:', error);
      throw error;
    }
  }

  // Create order week with embedded quantities
  async createOrderWeek(orderWeekData: {
    order_id: string;
    week_id: string;
    meal_plan_id: string;
    delivery_date?: string | null;
    family_member_id?: string | null;
    quantities?: Partial<Record<string, number>>;
  }) {
    try {
      // Validate required fields
      if (!orderWeekData.order_id) {
        throw new Error('order_id is required for creating order week');
      }
      if (!orderWeekData.week_id) {
        throw new Error('week_id is required for creating order week');
      }
      if (!orderWeekData.meal_plan_id) {
        throw new Error('meal_plan_id is required for creating order week');
      }

      // Validate quantities if provided
      if (orderWeekData.quantities) {
        const hasNonZeroQuantity = Object.values(orderWeekData.quantities).some(qty => qty && qty > 0);
        if (!hasNonZeroQuantity) {
          throw new Error('Order week must have at least one non-zero quantity');
        }
      }

      // Generate unique order_week_id using UUID
      const orderWeekId = `OW-${crypto.randomUUID()}`;

      const newOrderWeek = {
        order_week_id: orderWeekId,
        order_id: orderWeekData.order_id,
        week_id: orderWeekData.week_id,
        meal_plan_id: orderWeekData.meal_plan_id,
        delivery_date: orderWeekData.delivery_date || null,
        family_member_id: orderWeekData.family_member_id || null,
        ...orderWeekData.quantities
      };


      const { data, error } = await supabase
        .from('order_weeks')
        .insert([newOrderWeek])
        .select()
        .single();

      if (error) {
        console.error('Database error creating order week:', error);

        if (error.code === '23505' && error.message.includes('order_weeks_unique_combination_idx')) {
          throw new Error(
            `This order already has the meal plan "${orderWeekData.meal_plan_id}" for week "${orderWeekData.week_id}". ` +
            `Each order-week-plan combination must be unique.`
          );
        }

        throw new Error(`Failed to create order week: ${error.message}`);
      }

      return data;
    } catch (error) {
      console.error('Error creating order week:', error);
      throw error;
    }
  }

  // Update complete order with weeks and menu items
  async updateCompleteOrder(
    orderUuid: string,
    updates: Partial<Order>,
    selectedWeeks: any[],
    orderItems: PendingOrderItem[],
    weekDeliveryDates: Record<string, string>,
    selectedDeliveryOption?: DeliveryOption | null,
    totalDiscountAmount: number = 0,
    customDiscountAmount: number = 0,
    selectedBankAccount?: BankAccount | null,
    isPaid?: boolean
  ): Promise<Order> {
    try {
      // Validate order items before proceeding
      this.validateOrderItems(orderItems);

      // Update basic order information without triggering invoice sync
      const updatedOrder = await this.updateOrderWithoutInvoiceSync(orderUuid, updates);

      // Delete existing order weeks (this will cascade delete menu items)
      const { error: deleteWeeksError } = await supabase
        .from('order_weeks')
        .delete()
        .eq('order_id', updatedOrder.order_id);

      if (deleteWeeksError) {
        console.error('Error deleting existing order weeks:', deleteWeeksError);
        throw deleteWeeksError;
      }

      // Group order items by week and meal plan
      const grouped = groupItemsByWeekAndPlan(orderItems);
      const orderWeeks = [];
      const createdOrderWeekIds: string[] = [];

      try {
        // Create order weeks with quantities embedded
        for (const selectedWeek of selectedWeeks) {
          const deliveryDate = weekDeliveryDates[selectedWeek.week.week_id] || null;

          // Find items for this week - match by week_id first, then fall back to week_name
          const weekItems = orderItems.filter(item =>
            item.week_id === selectedWeek.week.week_id ||
            item.week_name === selectedWeek.week.week_name
          );

          if (weekItems.length === 0) {
            console.warn('No items found for week:', {
              week_id: selectedWeek.week.week_id,
              week_name: selectedWeek.week.week_name
            });
            continue;
          }


          // Group by meal plan AND family member for this week
          const planFamilyGroups: Record<string, PendingOrderItem[]> = {};
          for (const item of weekItems) {
            if (!item.meal_plans_id) {
              console.error('Item missing meal_plans_id:', item);
              throw new Error(`Order item is missing meal_plans_id for week ${selectedWeek.week.week_name}`);
            }
            // Create composite key: mealPlanId + familyMemberId
            const groupKey = `${item.meal_plans_id}__${item.family_member_id || 'main'}`;
            if (!planFamilyGroups[groupKey]) {
              planFamilyGroups[groupKey] = [];
            }
            planFamilyGroups[groupKey].push(item);
          }


          // Create one order_week per meal plan per family member
          for (const [groupKey, items] of Object.entries(planFamilyGroups)) {
            const [mealPlanId, familyMemberKey] = groupKey.split('__');
            const familyMemberId = familyMemberKey === 'main' ? null : familyMemberKey;
            const quantities = buildQuantityUpdates(items);


            const orderWeek = await this.createOrderWeek({
              order_id: updatedOrder.order_id,
              week_id: selectedWeek.week.week_id,
              meal_plan_id: mealPlanId,
              delivery_date: deliveryDate,
              family_member_id: familyMemberId,
              quantities
            });

            orderWeeks.push(orderWeek);
            createdOrderWeekIds.push(orderWeek.order_week_id);

            logTransformation('pivot', {
              itemCount: items.length,
              totalQuantity: items.reduce((sum, item) => sum + item.quantity, 0)
            }, {
              order_week_id: orderWeek.order_week_id,
              quantityColumns: Object.keys(quantities).length
            });
          }
        }

      } catch (orderWeekError) {
        console.error('Error creating order weeks during update:', orderWeekError);
        throw new Error(`Failed to create order weeks: ${orderWeekError instanceof Error ? orderWeekError.message : 'Unknown error'}`);
      }

      // Update associated invoice if it exists
      const { invoiceService } = await import('./invoiceService');
      const existingInvoice = await invoiceService.getInvoiceByOrderId(updatedOrder.order_id);
      
      if (existingInvoice) {
        // Generate new invoice summary
        const lineItems = this.generateInvoiceLineItems(orderItems);
        const mealsSummary = lineItems
          .map(item => `${item.week_name}, ${item.plan_name}, ${item.total_dishes} platillo${item.total_dishes !== 1 ? 's' : ''}`)
          .join(' / ');
        
        const deliverySummary = selectedDeliveryOption 
          ? ` / Envío: ${selectedDeliveryOption.delivery_options_name}`
          : '';
        
        const invoiceSummary = mealsSummary + deliverySummary;

        // Update invoice with new calculations and status
        const orderStatus = isPaid ? 'completed' : 'pending';
        const couponDiscountAmount = 0; // Coupons not used in admin order updates
        await invoiceService.updateInvoiceFromOrder(
          existingInvoice.id,
          {
            customer_name: updates.order_customer_name!,
            customer_email: updates.order_customer_email!,
            invoice_summary: invoiceSummary,
            bank_account_id: selectedBankAccount?.account_id
          },
          orderItems,
          selectedDeliveryOption,
          totalDiscountAmount,
          couponDiscountAmount,
          customDiscountAmount,
          orderStatus
        );
      } else if (selectedBankAccount || isPaid) {
        // Generate invoice summary
        const lineItems = this.generateInvoiceLineItems(orderItems);
        const mealsSummary = lineItems
          .map(item => `${item.week_name}, ${item.plan_name}, ${item.total_dishes} platillo${item.total_dishes !== 1 ? 's' : ''}`)
          .join(' / ');
        
        const deliverySummary = selectedDeliveryOption 
          ? ` / Envío: ${selectedDeliveryOption.delivery_options_name}`
          : '';
        
        const invoiceSummary = mealsSummary + deliverySummary;

        const orderStatus = isPaid ? 'completed' : 'pending';
        const invoice = await invoiceService.createInvoice(
          {
            order_id: updatedOrder.order_id,
            customer_name: updates.order_customer_name!,
            customer_email: updates.order_customer_email!,
            invoice_summary: invoiceSummary,
            bank_account_id: selectedBankAccount?.account_id
          },
          orderItems,
          selectedDeliveryOption,
          totalDiscountAmount,
          customDiscountAmount,
          orderStatus === 'completed' ? 'paid' : 'draft'
        );
        
        // Update order with invoice number
        await this.updateOrderWithoutInvoiceSync(updatedOrder.id, {
          order_invoice_number: invoice.invoice_number,
          order_status: orderStatus
        });
        
      }

      return updatedOrder;
    } catch (error) {
      console.error('Error updating complete order:', error);
      throw error;
    }
  }

  // Delete order
  async deleteOrder(orderUuid: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('orders')
        .delete() 
        .eq('id', orderUuid);

      if (error) throw error;
    } catch (error) {
      console.error('Error deleting order:', error);
      throw error;
    }
  }

  // Create basic order with retry logic for race condition handling
  async createOrder(orderData: Partial<Order>): Promise<Order> {
    return this.retryOperation(
      async () => {
        const orderId = await this.generateNextOrderId();

        const newOrder = {
          order_id: orderId,
          ...orderData
        };

        const { data, error } = await supabase
          .from('orders')
          .insert([newOrder])
          .select()
          .single();

        if (error) throw error;
        return data;
      },
      3,
      'Create order'
    );
  }

  // Validate order items before creating order
  private validateOrderItems(orderItems: PendingOrderItem[]): void {
    if (!orderItems || orderItems.length === 0) {
      throw new Error('Order must have at least one item');
    }

    const invalidItems = orderItems.filter(item =>
      !item.meal_plans_id ||
      !item.week_id ||
      !item.week_name ||
      item.quantity <= 0
    );

    if (invalidItems.length > 0) {
      console.error('Invalid order items found:', invalidItems);
      throw new Error(`Found ${invalidItems.length} invalid order item(s). All items must have meal_plans_id, week_id, week_name, and quantity > 0`);
    }

  }

  // Create complete order with weeks, menu items, and invoice
  async createCompleteOrder(
    orderData: CreateOrderData,
    selectedWeeks: SelectedWeek[],
    orderItems: PendingOrderItem[],
    selectedDeliveryOption: DeliveryOption | null,
    totalDiscountAmount: number = 0,
    couponDiscountAmount: number = 0,
    customDiscountAmount: number = 0,
    weekDeliveryDates: Record<string, string>,
    selectedBankAccount?: BankAccount,
    isPaid: boolean = false,
    paymentDate?: string
  ): Promise<Order> {
    try {

      // Validate order items before proceeding
      this.validateOrderItems(orderItems);

      // Create basic order
      const newOrder = await this.createOrder(orderData);

      // Group order items by week and meal plan
      const grouped = groupItemsByWeekAndPlan(orderItems);
      const orderWeeks = [];
      const createdOrderWeekIds: string[] = [];

      try {
        // Create order weeks with quantities embedded
        for (const selectedWeek of selectedWeeks) {
          const deliveryDate = weekDeliveryDates[selectedWeek.week.week_id] || null;

          // Find items for this week - match by week_id first, then fall back to week_name
          const weekItems = orderItems.filter(item =>
            item.week_id === selectedWeek.week.week_id ||
            item.week_name === selectedWeek.week.week_name
          );

          if (weekItems.length === 0) {
            console.warn('No items found for week:', {
              week_id: selectedWeek.week.week_id,
              week_name: selectedWeek.week.week_name
            });
            continue;
          }


          // Group by meal plan AND family member for this week
          const planFamilyGroups: Record<string, PendingOrderItem[]> = {};
          for (const item of weekItems) {
            if (!item.meal_plans_id) {
              console.error('Item missing meal_plans_id:', item);
              throw new Error(`Order item is missing meal_plans_id for week ${selectedWeek.week.week_name}`);
            }
            // Create composite key: mealPlanId + familyMemberId
            const groupKey = `${item.meal_plans_id}__${item.family_member_id || 'main'}`;
            if (!planFamilyGroups[groupKey]) {
              planFamilyGroups[groupKey] = [];
            }
            planFamilyGroups[groupKey].push(item);
          }


          // Create one order_week per meal plan per family member
          for (const [groupKey, items] of Object.entries(planFamilyGroups)) {
            const [mealPlanId, familyMemberKey] = groupKey.split('__');
            const familyMemberId = familyMemberKey === 'main' ? null : familyMemberKey;
            const quantities = buildQuantityUpdates(items);


            const orderWeek = await this.createOrderWeek({
              order_id: newOrder.order_id,
              week_id: selectedWeek.week.week_id,
              meal_plan_id: mealPlanId,
              delivery_date: deliveryDate,
              family_member_id: familyMemberId,
              quantities
            });

            orderWeeks.push(orderWeek);
            createdOrderWeekIds.push(orderWeek.order_week_id);

            logTransformation('pivot', {
              itemCount: items.length,
              totalQuantity: items.reduce((sum, item) => sum + item.quantity, 0)
            }, {
              order_week_id: orderWeek.order_week_id,
              quantityColumns: Object.keys(quantities).length
            });
          }
        }

      } catch (orderWeekError) {
        console.error('Error creating order weeks, rolling back order:', orderWeekError);

        // Delete the order since order week creation failed
        try {
          await this.deleteOrder(newOrder.id);
        } catch (rollbackError) {
          console.error('Failed to rollback order:', rollbackError);
        }

        throw new Error(`Failed to create order weeks: ${orderWeekError instanceof Error ? orderWeekError.message : 'Unknown error'}`);
      }

      // Create invoice if needed
      if (selectedBankAccount || isPaid) {
        const { invoiceService } = await import('./invoiceService');
        
        // Generate invoice summary
        const lineItems = this.generateInvoiceLineItems(orderItems);
        const mealsSummary = lineItems
          .map(item => `${item.week_name}, ${item.plan_name}, ${item.total_dishes} platillo${item.total_dishes !== 1 ? 's' : ''}`)
          .join(' / ');
        
        const deliverySummary = selectedDeliveryOption 
          ? ` / Envío: ${selectedDeliveryOption.delivery_options_name}`
          : '';
        
        const invoiceSummary = mealsSummary + deliverySummary;

        const orderStatus = isPaid ? 'completed' : 'pending';
        const invoice = await invoiceService.createInvoiceFromOrder(
          newOrder,
          {
            customer_name: orderData.order_customer_name,
            customer_email: orderData.order_customer_email,
            invoice_summary: invoiceSummary,
            bank_account_id: selectedBankAccount?.account_id,
            payment_date: paymentDate
          },
          orderItems,
          selectedDeliveryOption,
          totalDiscountAmount,
          couponDiscountAmount,
          customDiscountAmount,
          orderStatus
        );
        
        // Update order with invoice number
        await this.updateOrderWithoutInvoiceSync(newOrder.id, {
          order_invoice_number: invoice.invoice_number
        });
        
      }

      return newOrder;
    } catch (error) {
      console.error('Error creating complete order:', error);
      throw error;
    }
  }

  private generateInvoiceLineItems(orderItems: PendingOrderItem[]) {
    // Group items by week and plan
    const grouped = orderItems.reduce((acc, item) => {
      if (!BILLABLE_MEAL_TYPES.includes(item.meal_type as any)) return acc;

      const key = `${item.week_id}-${item.meal_plans_id}`;
      if (!acc[key]) {
        acc[key] = {
          week_name: item.week_name,
          plan_name: item.meal_plan_name,
          total_dishes: 0,
          total_price: 0
        };
      }
      acc[key].total_dishes += item.quantity;
      acc[key].total_price += item.meal_plan_price * item.quantity;
      return acc;
    }, {} as Record<string, any>);

    return Object.values(grouped);
  }

  // Create grouped orders (one per family member) with a shared invoice
  async createGroupedOrders(
    primaryCustomer: { id: string; name: string; email: string },
    familyMembers: Array<{ id: string; name: string; email: string | null; items: PendingOrderItem[] }>,
    selectedWeeks: SelectedWeek[],
    allOrderItems: PendingOrderItem[],
    selectedDeliveryOption: DeliveryOption | null,
    totalDiscountAmount: number = 0,
    couponDiscountAmount: number = 0,
    customDiscountAmount: number = 0,
    weekDeliveryDates: Record<string, string>,
    selectedBankAccount?: BankAccount,
    isPaid: boolean = false,
    paymentDate?: string,
    orderNotes?: string | null,
    totalPrice: number = 0
  ): Promise<{ orders: Order[]; invoiceGroupId: string }> {
    const invoiceGroupId = crypto.randomUUID();
    const createdOrders: Order[] = [];

    try {
      // Create one order per family member (including primary customer)
      for (const member of familyMembers) {
        if (member.items.length === 0) continue;

        const memberTotal = member.items
          .filter(item => BILLABLE_MEAL_TYPES.includes(item.meal_type as any))
          .reduce((sum, item) => sum + (item.meal_plan_price * item.quantity), 0);

        const orderData: CreateOrderData = {
          customer_id: member.id,
          order_customer_name: member.name,
          order_customer_email: member.email || primaryCustomer.email || '',
          order_total_price: memberTotal,
          order_invoice_number: '',
          order_status: isPaid ? 'completed' : 'pending',
          order_notes: orderNotes,
          invoice_group_id: invoiceGroupId,
        };

        const newOrder = await this.createOrder(orderData);
        createdOrders.push(newOrder);

        // Create order weeks for this member's items
        for (const selectedWeek of selectedWeeks) {
          const deliveryDate = weekDeliveryDates[selectedWeek.week.week_id] || null;
          const weekItems = member.items.filter(item =>
            item.week_id === selectedWeek.week.week_id ||
            item.week_name === selectedWeek.week.week_name
          );

          if (weekItems.length === 0) continue;

          // Group by meal plan
          const planGroups: Record<string, PendingOrderItem[]> = {};
          for (const item of weekItems) {
            if (!item.meal_plans_id) continue;
            if (!planGroups[item.meal_plans_id]) {
              planGroups[item.meal_plans_id] = [];
            }
            planGroups[item.meal_plans_id].push(item);
          }

          for (const [mealPlanId, items] of Object.entries(planGroups)) {
            const quantities = buildQuantityUpdates(items);
            await this.createOrderWeek({
              order_id: newOrder.order_id,
              week_id: selectedWeek.week.week_id,
              meal_plan_id: mealPlanId,
              delivery_date: deliveryDate,
              family_member_id: null,
              quantities
            });
          }
        }
      }

      // Create a single shared invoice for all orders
      if (selectedBankAccount || isPaid) {
        const { invoiceService } = await import('./invoiceService');
        const primaryOrder = createdOrders[0];

        const lineItems = this.generateInvoiceLineItems(allOrderItems);
        const mealsSummary = lineItems
          .map(item => `${item.week_name}, ${item.plan_name}, ${item.total_dishes} platillo${item.total_dishes !== 1 ? 's' : ''}`)
          .join(' / ');
        const deliverySummary = selectedDeliveryOption
          ? ` / Envío: ${selectedDeliveryOption.delivery_options_name}`
          : '';
        const invoiceSummary = mealsSummary + deliverySummary;

        const orderStatus = isPaid ? 'completed' : 'pending';
        const invoice = await invoiceService.createInvoiceFromOrder(
          primaryOrder,
          {
            customer_name: primaryCustomer.name,
            customer_email: primaryCustomer.email,
            invoice_summary: invoiceSummary,
            bank_account_id: selectedBankAccount?.account_id,
            payment_date: paymentDate,
            invoice_group_id: invoiceGroupId
          },
          allOrderItems,
          selectedDeliveryOption,
          totalDiscountAmount,
          couponDiscountAmount,
          customDiscountAmount,
          orderStatus
        );

        // Update all orders with the shared invoice number
        for (const order of createdOrders) {
          await this.updateOrderWithoutInvoiceSync(order.id, {
            order_invoice_number: invoice.invoice_number
          });
        }
      }

      return { orders: createdOrders, invoiceGroupId };
    } catch (error) {
      // Cleanup: delete any orders that were created
      for (const order of createdOrders) {
        try { await this.deleteOrder(order.id); } catch { /* best effort */ }
      }
      throw error;
    }
  }
}

export const orderService = new OrderService();