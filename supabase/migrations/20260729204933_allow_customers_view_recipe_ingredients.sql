/*
# Allow customers to view recipe ingredients

1. Purpose
   - Customers ordering meals need to see which ingredients make up each dish
     so allergy and restriction warnings can be shown on the meal cards.
   - The `ingredients` and `recipes` tables already have customer-facing read
     policies, but `recipe_ingredients` only allowed staff/app users to read,
     which caused the warning check to return nothing for logged-in customers.

2. Security
   - Adds a SELECT-only policy on `recipe_ingredients` for authenticated users
     who are registered customers (matching the existing
     "Customers can view ingredients" policy pattern on the `ingredients` table).
   - No insert/update/delete access is granted to customers.
*/

DROP POLICY IF EXISTS "Customers can view recipe ingredients" ON recipe_ingredients;
CREATE POLICY "Customers can view recipe ingredients"
ON recipe_ingredients FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM customers
    WHERE customers.auth_user_id = auth.uid()
  )
);
