/*
# Allow all authenticated users to read delivery zones

1. Security Changes
  - Drops the existing staff-only SELECT policy on `delivery_zones`.
  - Adds a new SELECT policy that allows ANY authenticated user (customers included) to read delivery zones.
  - This fixes "Error al cargar códigos postales" when a customer user tries to load the postal code dropdown.

2. Important Notes
  - INSERT, UPDATE, DELETE policies remain restricted to staff (app_users) only.
  - Delivery zone data (postal codes, neighborhoods) is non-sensitive reference data that customers need when filling in their address.
*/

-- Drop the old staff-only SELECT policy
DROP POLICY IF EXISTS "App users can view delivery zones" ON delivery_zones;

-- Create a new SELECT policy for all authenticated users
CREATE POLICY "Authenticated users can view delivery zones"
  ON delivery_zones FOR SELECT
  TO authenticated
  USING (true);
