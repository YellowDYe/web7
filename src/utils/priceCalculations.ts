/**
 * Centralized Price Calculation Utilities
 *
 * IMPORTANT PRICING RULES:
 * 1. All prices in database (meal_plans_price, delivery_options_price) are BASE PRICES (before tax)
 * 2. Plan-specific discounts apply to the subtotal (before tax, before delivery)
 * 3. Tax is calculated separately on items and delivery:
 *    - Item tax = (items subtotal - plan discounts) * tax_rate
 *    - Delivery tax = delivery base price * tax_rate
 * 4. Coupon discounts apply after taxes and delivery
 * 5. Custom discounts apply to the FINAL TOTAL (after coupon)
 *
 * DATABASE STORAGE (invoices table):
 * - subtotal: itemsSubtotal (BEFORE plan discounts are applied) - for PayPal compatibility
 * - plan_discount_amount: planDiscountsTotal (discount to be applied to subtotal)
 * - tax_amount: taxAmount (calculated on subtotal AFTER plan discounts)
 * - delivery_option_price: deliveryPrice (base delivery price before tax)
 * - delivery_tax_amount: deliveryTaxAmount (tax on delivery)
 * - coupon_discount_amount: couponDiscountAmount (coupon discount after taxes)
 * - custom_discount_amount: customDiscountAmount (discount on final total)
 * - total_amount: finalTotal (complete calculated total)
 *
 * CALCULATION ORDER:
 * 1. Calculate items subtotal (sum of base_price * quantity) → saved as subtotal
 * 2. Apply plan-specific discounts to items subtotal
 * 3. Calculate subtotal before tax = items subtotal - plan discounts
 * 4. Calculate item tax = subtotal before tax * tax_rate → saved as tax_amount
 * 5. Add delivery base price → saved as delivery_option_price
 * 6. Calculate delivery tax = delivery base price * tax_rate → saved as delivery_tax_amount
 * 7. Calculate total before coupon = subtotal before tax + item tax + delivery + delivery tax
 * 8. Apply coupon discount → saved as coupon_discount_amount
 * 9. Apply custom discount to total
 * 10. Final total = total - coupon discount - custom discount → saved as total_amount
 */

export interface PriceBreakdown {
  itemsSubtotal: number;
  planDiscountsTotal: number;
  subtotalAfterPlanDiscounts: number;
  deliveryPrice: number;
  subtotalBeforeTax: number;
  taxAmount: number;
  deliveryTaxAmount: number;
  totalBeforeCustomDiscount: number;
  couponDiscountAmount: number;
  customDiscountAmount: number;
  finalTotal: number;
}

export function calculateItemSubtotal(basePrice: number, quantity: number): number {
  return basePrice * quantity;
}

export function applyPercentageDiscount(amount: number, discountPercentage: number): number {
  const discountAmount = (amount * discountPercentage) / 100;
  return discountAmount;
}

export function calculateTax(amount: number, taxRate: number): number {
  const taxAmount = (amount * taxRate) / 100;
  return taxAmount;
}

export function calculatePriceBreakdown(
  itemsSubtotal: number,
  planDiscountsTotal: number,
  deliveryPrice: number,
  couponDiscountAmount: number,
  customDiscountAmount: number,
  taxRate: number
): PriceBreakdown {
  // Keep all values with full precision - no intermediate rounding
  // Step 1: Calculate subtotal after plan discounts (items only, no delivery)
  const subtotalAfterPlanDiscounts = itemsSubtotal - planDiscountsTotal;

  // Step 2: Calculate tax on items only (preserve decimal precision)
  const taxAmount = calculateTax(subtotalAfterPlanDiscounts, taxRate);

  // Step 3: Calculate tax on delivery separately (preserve decimal precision)
  const deliveryTaxAmount = calculateTax(deliveryPrice, taxRate);

  // Step 4: subtotalBeforeTax is just items after discounts (delivery not included here)
  const subtotalBeforeTax = subtotalAfterPlanDiscounts;

  // Step 5: Calculate total before coupon/custom discounts = items + item tax + delivery + delivery tax
  const totalBeforeCustomDiscount = subtotalBeforeTax + taxAmount + deliveryPrice + deliveryTaxAmount;

  // Step 6: Apply coupon discount
  const totalAfterCouponDiscount = totalBeforeCustomDiscount - couponDiscountAmount;

  // Step 7: Apply custom discount
  const totalAfterCustomDiscount = totalAfterCouponDiscount - customDiscountAmount;

  // Step 8: Round ONLY the final total to whole number
  const finalTotal = Math.round(totalAfterCustomDiscount);

  return {
    itemsSubtotal,
    planDiscountsTotal,
    subtotalAfterPlanDiscounts,
    deliveryPrice,
    subtotalBeforeTax,
    taxAmount,
    deliveryTaxAmount,
    totalBeforeCustomDiscount,
    couponDiscountAmount,
    customDiscountAmount,
    finalTotal
  };
}

export function validatePriceBreakdown(breakdown: PriceBreakdown): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const tolerance = 1;

  // Validate subtotal after plan discounts
  const expectedSubtotalAfterDiscounts = breakdown.itemsSubtotal - breakdown.planDiscountsTotal;
  if (Math.abs(breakdown.subtotalAfterPlanDiscounts - expectedSubtotalAfterDiscounts) > tolerance) {
    errors.push('Subtotal after plan discounts mismatch');
  }

  // Validate subtotal before tax (should equal subtotal after discounts, no delivery)
  if (Math.abs(breakdown.subtotalBeforeTax - breakdown.subtotalAfterPlanDiscounts) > tolerance) {
    errors.push('Subtotal before tax should equal subtotal after plan discounts');
  }

  // Validate total before custom discount = subtotal + tax + delivery + delivery tax
  const expectedTotalBeforeCustom = breakdown.subtotalBeforeTax + breakdown.taxAmount + breakdown.deliveryPrice + breakdown.deliveryTaxAmount;
  if (Math.abs(breakdown.totalBeforeCustomDiscount - expectedTotalBeforeCustom) > tolerance) {
    errors.push('Total before custom discount mismatch');
  }

  // Validate final total with both coupon and custom discounts
  const expectedFinalTotal = breakdown.totalBeforeCustomDiscount - breakdown.couponDiscountAmount - breakdown.customDiscountAmount;
  if (Math.abs(breakdown.finalTotal - expectedFinalTotal) > tolerance) {
    errors.push('Final total mismatch');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

export function formatPriceBreakdown(breakdown: PriceBreakdown): string {
  return [
    'Price Breakdown:',
    '  Items Subtotal: $' + Math.round(breakdown.itemsSubtotal).toFixed(0),
    '  - Plan Discounts: -$' + Math.round(breakdown.planDiscountsTotal).toFixed(0),
    '  = Subtotal After Discounts: $' + Math.round(breakdown.subtotalAfterPlanDiscounts).toFixed(0),
    '  + Tax (Items): +$' + Math.round(breakdown.taxAmount).toFixed(0),
    '  + Delivery: +$' + Math.round(breakdown.deliveryPrice).toFixed(0),
    '  + Tax (Delivery): +$' + Math.round(breakdown.deliveryTaxAmount).toFixed(0),
    '  = Total Before Discounts: $' + Math.round(breakdown.totalBeforeCustomDiscount).toFixed(0),
    '  - Coupon Discount: -$' + Math.round(breakdown.couponDiscountAmount).toFixed(0),
    '  - Custom Discount: -$' + Math.round(breakdown.customDiscountAmount).toFixed(0),
    '  = FINAL TOTAL: $' + breakdown.finalTotal.toFixed(0)
  ].join('\n');
}
