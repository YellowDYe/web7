/*
  # Restrict SAT invoicing rules to administrators

  1. Problem
    - All four policies on `sat_cfdi_rules` had a predicate of `true`, so any
      signed-in account (including a shopper) could read, insert, change or
      delete the rules that classify tax documents.

  2. Changes
    - Replace them with admin-only policies.
*/

DROP POLICY IF EXISTS "select_sat_cfdi_rules" ON public.sat_cfdi_rules;
DROP POLICY IF EXISTS "insert_sat_cfdi_rules" ON public.sat_cfdi_rules;
DROP POLICY IF EXISTS "update_sat_cfdi_rules" ON public.sat_cfdi_rules;
DROP POLICY IF EXISTS "delete_sat_cfdi_rules" ON public.sat_cfdi_rules;

CREATE POLICY "admin_select_sat_cfdi_rules"
  ON public.sat_cfdi_rules FOR SELECT TO authenticated
  USING (is_admin_user());

CREATE POLICY "admin_insert_sat_cfdi_rules"
  ON public.sat_cfdi_rules FOR INSERT TO authenticated
  WITH CHECK (is_admin_user());

CREATE POLICY "admin_update_sat_cfdi_rules"
  ON public.sat_cfdi_rules FOR UPDATE TO authenticated
  USING (is_admin_user()) WITH CHECK (is_admin_user());

CREATE POLICY "admin_delete_sat_cfdi_rules"
  ON public.sat_cfdi_rules FOR DELETE TO authenticated
  USING (is_admin_user());
