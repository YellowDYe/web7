/*
# Allow signed-in customers to view menu dishes

## Problem
New customers created through sign-up saw no dishes on the order page or the
weekly menu page. The "Users can view menu recipes" and "Users can view recipes"
rules only let a signed-in customer see a dish if they already had a past order
for a week using that menu. Brand-new customers have no orders, so every dish
was hidden. Logged-out visitors could already see all dishes.

## Change
1. Security
   - Add SELECT policy "Customers can view menu recipes" on `menu_recipes`
     for any authenticated user with a linked `customers` row.
   - Add SELECT policy "Customers can view recipes" on `recipes` with the same rule.
   - View-only; writes remain staff-only. This matches the existing open
     anonymous read on both tables and the earlier weekly_menus fix.
*/

DROP POLICY IF EXISTS "Customers can view menu recipes" ON menu_recipes;
CREATE POLICY "Customers can view menu recipes"
ON menu_recipes FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM customers
    WHERE customers.auth_user_id = (SELECT auth.uid())
  )
);

DROP POLICY IF EXISTS "Customers can view recipes" ON recipes;
CREATE POLICY "Customers can view recipes"
ON recipes FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM customers
    WHERE customers.auth_user_id = (SELECT auth.uid())
  )
);