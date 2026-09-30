/*
# Allow public read access to google_maps_config

1. Security Changes
   - Add SELECT policy for anon + authenticated roles on google_maps_config
   - This is needed because the customer signup form (pre-auth) and profile
     edit page both need the API key to load Google Places autocomplete.
   - Google Maps API keys are designed for client-side use and are protected
     by domain restrictions in the Google Cloud Console, not by secrecy.

2. Important Notes
   - The existing staff_select policy is kept for backwards compatibility.
   - Write policies remain admin-only (unchanged).
*/

DROP POLICY IF EXISTS "public_select_google_maps_config" ON google_maps_config;
CREATE POLICY "public_select_google_maps_config"
  ON google_maps_config FOR SELECT
  TO anon, authenticated
  USING (true);
