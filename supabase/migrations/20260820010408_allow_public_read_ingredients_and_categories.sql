/*
# Allow all authenticated users to read ingredients and ingredient categories

1. Problem
  - During customer signup, the restriction selector needs to read from `ingredients`
    and `ingredient_categories` tables.
  - Current policies only allow users who already exist in `app_users` or `customers`
    to read these tables.
  - A brand-new user (just signed up, no customer row yet) cannot read ingredients,
    causing the restriction selector to appear empty.

2. Changes
  - Add a new SELECT policy on `ingredients` allowing any authenticated user to read.
  - Add a new SELECT policy on `ingredient_categories` allowing any authenticated user to read.
  - Also allow `anon` since the restriction step is reached before the auth user is created
    (during the multi-step signup form, the user browses restrictions before clicking "Create Account").

3. Security
  - Ingredients and ingredient categories are non-sensitive reference/catalog data.
  - Making them publicly readable does not expose any private information.
*/

-- Allow anyone (including anonymous browsing signup form) to read ingredients
DROP POLICY IF EXISTS "Anyone can view ingredients" ON ingredients;
CREATE POLICY "Anyone can view ingredients"
  ON ingredients FOR SELECT
  TO anon, authenticated
  USING (true);

-- Allow anyone to read ingredient categories
DROP POLICY IF EXISTS "Anyone can view ingredient categories" ON ingredient_categories;
CREATE POLICY "Anyone can view ingredient categories"
  ON ingredient_categories FOR SELECT
  TO anon, authenticated
  USING (true);
