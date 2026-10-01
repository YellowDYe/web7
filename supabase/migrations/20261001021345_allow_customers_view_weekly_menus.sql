/*
# Allow signed-in customers to view weekly menus

## Problem
New customers created through the sign-up flow could not load the week and
meal-plan selection on step 2 of the order process. The order screen looks up
each week's menu, but the existing "Users can view weekly menus" rule only let a
signed-in customer see a menu if they already had a past order that used it.
A brand-new customer has no orders, so they could see no menus, the week list
came back empty, and both the week picker and the plan picker rendered blank.
Older accounts worked only because they already had past orders unlocking the menus.

## Change
1. Security
   - Add a SELECT policy "Customers can view weekly menus" on `weekly_menus`
     allowing any authenticated customer (a user with a linked `customers` row)
     to read weekly menus, regardless of order history.
   - This mirrors the existing "Customers can view delivery options" pattern and
     the already-open anonymous read on weekly menus. Writes remain staff-only;
     this is view-only access.
*/

DROP POLICY IF EXISTS "Customers can view weekly menus" ON weekly_menus;
CREATE POLICY "Customers can view weekly menus"
ON weekly_menus FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM customers
    WHERE customers.auth_user_id = (SELECT auth.uid())
  )
);