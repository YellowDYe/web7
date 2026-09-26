/*
  # Restrict IDSE credentials to administrators

  1. Changes
    - Replace the four "Authenticated users can ..." policies on
      `idse_credentials` with admin-only equivalents.

  2. Security
    - These are the government portal credentials used for social security
      filings. Any signed-in account could read or replace them.
*/

DROP POLICY IF EXISTS "Authenticated users can view idse credentials" ON public.idse_credentials;
DROP POLICY IF EXISTS "Authenticated users can insert idse credentials" ON public.idse_credentials;
DROP POLICY IF EXISTS "Authenticated users can update idse credentials" ON public.idse_credentials;
DROP POLICY IF EXISTS "Authenticated users can delete idse credentials" ON public.idse_credentials;

CREATE POLICY "admin_select_idse_credentials"
  ON public.idse_credentials FOR SELECT TO authenticated
  USING (is_admin_user());

CREATE POLICY "admin_insert_idse_credentials"
  ON public.idse_credentials FOR INSERT TO authenticated
  WITH CHECK (is_admin_user());

CREATE POLICY "admin_update_idse_credentials"
  ON public.idse_credentials FOR UPDATE TO authenticated
  USING (is_admin_user()) WITH CHECK (is_admin_user());

CREATE POLICY "admin_delete_idse_credentials"
  ON public.idse_credentials FOR DELETE TO authenticated
  USING (is_admin_user());
