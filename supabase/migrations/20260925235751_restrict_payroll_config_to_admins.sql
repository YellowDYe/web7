/*
  # Restrict payroll configuration to administrators

  1. Changes
    - Replace the three "Authenticated users can ..." policies on
      `payroll_config` with admin-only equivalents.

  2. Security
    - Payroll settings drive salary calculations; any signed-in account could
      read and alter them.
*/

DROP POLICY IF EXISTS "Authenticated users can view payroll config" ON public.payroll_config;
DROP POLICY IF EXISTS "Authenticated users can insert payroll config" ON public.payroll_config;
DROP POLICY IF EXISTS "Authenticated users can update payroll config" ON public.payroll_config;

CREATE POLICY "admin_select_payroll_config"
  ON public.payroll_config FOR SELECT TO authenticated
  USING (is_admin_user());

CREATE POLICY "admin_insert_payroll_config"
  ON public.payroll_config FOR INSERT TO authenticated
  WITH CHECK (is_admin_user());

CREATE POLICY "admin_update_payroll_config"
  ON public.payroll_config FOR UPDATE TO authenticated
  USING (is_admin_user()) WITH CHECK (is_admin_user());
