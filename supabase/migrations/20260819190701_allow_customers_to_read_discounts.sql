/*
# Allow customers to read discounts

1. Security Changes
  - Add a new SELECT policy on the `discounts` table for customers.
  - Customers (authenticated users with a row in the `customers` table matching their auth UID)
    can now read discount records so the order page can auto-apply plan-based discounts.
  - This is read-only; customers still cannot create, update, or delete discounts.

2. Important Notes
  - The existing "App users can view discounts" policy remains unchanged for staff/admin access.
  - The new policy uses an EXISTS check against `customers.auth_user_id` to scope access.
*/

DROP POLICY IF EXISTS "Customers can view discounts" ON discounts;
CREATE POLICY "Customers can view discounts"
  ON discounts FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM customers
      WHERE customers.auth_user_id = auth.uid()
    )
  );
