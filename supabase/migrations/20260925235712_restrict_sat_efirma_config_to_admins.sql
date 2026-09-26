/*
  # Restrict SAT e-firma credentials to administrators

  1. Changes
    - Replace the four "Authenticated users can ..." policies on
      `sat_efirma_config`, all keyed only on `auth.uid() IS NOT NULL`, with
      admin-only equivalents.

  2. Security
    - The table holds the company's digital signature material and its password.
      Being signed in as any shopper was enough to read or overwrite it.
*/

DROP POLICY IF EXISTS "Authenticated users can view SAT config" ON public.sat_efirma_config;
DROP POLICY IF EXISTS "Authenticated users can insert SAT config" ON public.sat_efirma_config;
DROP POLICY IF EXISTS "Authenticated users can update SAT config" ON public.sat_efirma_config;
DROP POLICY IF EXISTS "Authenticated users can delete SAT config" ON public.sat_efirma_config;

CREATE POLICY "admin_select_sat_efirma_config"
  ON public.sat_efirma_config FOR SELECT TO authenticated
  USING (is_admin_user());

CREATE POLICY "admin_insert_sat_efirma_config"
  ON public.sat_efirma_config FOR INSERT TO authenticated
  WITH CHECK (is_admin_user());

CREATE POLICY "admin_update_sat_efirma_config"
  ON public.sat_efirma_config FOR UPDATE TO authenticated
  USING (is_admin_user()) WITH CHECK (is_admin_user());

CREATE POLICY "admin_delete_sat_efirma_config"
  ON public.sat_efirma_config FOR DELETE TO authenticated
  USING (is_admin_user());
