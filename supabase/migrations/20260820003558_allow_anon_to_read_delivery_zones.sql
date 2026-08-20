/*
# Allow anonymous users to read delivery zones

1. Security Changes
  - Drops the existing "Authenticated users can view delivery zones" SELECT policy.
  - Creates a new SELECT policy granting read access to BOTH `anon` and `authenticated` roles.

2. Why
  - The postal code dropdown is used on the customer signup page, where the visitor
    has no account yet and is unauthenticated (anon role).
  - Delivery zones (postal codes, neighborhoods, pricing tiers) are non-sensitive
    public reference data that must be visible before sign-up.

3. Important Notes
  - INSERT, UPDATE, DELETE policies remain restricted to staff (app_users) only.
  - USING (true) is appropriate because this is intentionally public reference data.
*/

DROP POLICY IF EXISTS "Authenticated users can view delivery zones" ON delivery_zones;

CREATE POLICY "Anyone can view delivery zones"
  ON delivery_zones FOR SELECT
  TO anon, authenticated
  USING (true);
