/*
# Allow public (anon) read access to weekly menu tables

1. Security Changes
   - Add SELECT policy for anon role on `weeks` table
   - Add SELECT policy for anon role on `weekly_menus` table
   - Add SELECT policy for anon role on `menu_recipes` table
   - Add SELECT policy for anon role on `meal_plans` table

2. Reason
   - The "Menu Semanal" (weekly menu) section needs to be visible to
     guest visitors who are not logged in. Previously, all SELECT policies
     on these tables were scoped to `authenticated` only, causing empty
     results for anonymous users and showing "menu not available" incorrectly.

3. Important Notes
   - These tables contain read-only public information (what meals are
     available this week). No sensitive data is exposed.
   - Write operations (INSERT/UPDATE/DELETE) remain restricted to admin users.
*/

-- weeks: allow anon to read
DROP POLICY IF EXISTS "Anon can view weeks" ON weeks;
CREATE POLICY "Anon can view weeks"
  ON weeks FOR SELECT
  TO anon
  USING (true);

-- weekly_menus: allow anon to read
DROP POLICY IF EXISTS "Anon can view weekly menus" ON weekly_menus;
CREATE POLICY "Anon can view weekly menus"
  ON weekly_menus FOR SELECT
  TO anon
  USING (true);

-- menu_recipes: allow anon to read
DROP POLICY IF EXISTS "Anon can view menu recipes" ON menu_recipes;
CREATE POLICY "Anon can view menu recipes"
  ON menu_recipes FOR SELECT
  TO anon
  USING (true);

-- meal_plans: allow anon to read
DROP POLICY IF EXISTS "Anon can view meal plans" ON meal_plans;
CREATE POLICY "Anon can view meal plans"
  ON meal_plans FOR SELECT
  TO anon
  USING (true);
