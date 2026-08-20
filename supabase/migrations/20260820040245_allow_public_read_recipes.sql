/*
# Allow public (anon) read access to recipes table

1. Security Changes
   - Add SELECT policy for anon role on `recipes` table

2. Reason
   - The weekly menu module displays recipe names and images to guest visitors.
     Without anon read access, the menu shows empty recipe cards.
   - Recipe data (name, image) is not sensitive and is publicly displayed
     on the customer-facing website.

3. Important Notes
   - Write operations remain restricted to admin/staff users.
*/

DROP POLICY IF EXISTS "Anon can view recipes" ON recipes;
CREATE POLICY "Anon can view recipes"
  ON recipes FOR SELECT
  TO anon
  USING (true);
