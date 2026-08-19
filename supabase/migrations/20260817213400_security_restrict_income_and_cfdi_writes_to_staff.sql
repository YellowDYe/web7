-- F13 (completion): income records must be staff-only for writes as well as reads.
-- The previous predicates only required an app_users row, which customers also have.
DROP POLICY IF EXISTS "App users can insert incomes" ON public.incomes;
DROP POLICY IF EXISTS "App users can update incomes" ON public.incomes;
DROP POLICY IF EXISTS "App users can delete incomes" ON public.incomes;

CREATE POLICY "staff_insert_incomes" ON public.incomes
  FOR INSERT TO authenticated WITH CHECK (public.is_staff_user());
CREATE POLICY "staff_update_incomes" ON public.incomes
  FOR UPDATE TO authenticated USING (public.is_staff_user()) WITH CHECK (public.is_staff_user());
CREATE POLICY "staff_delete_incomes" ON public.incomes
  FOR DELETE TO authenticated USING (public.is_staff_user());

-- Same structural problem on protein_orders: an app_users row is not staff.
DROP POLICY IF EXISTS "App users can view protein orders" ON public.protein_orders;
DROP POLICY IF EXISTS "App users can insert protein orders" ON public.protein_orders;
DROP POLICY IF EXISTS "App users can update protein orders" ON public.protein_orders;
DROP POLICY IF EXISTS "App users can delete protein orders" ON public.protein_orders;

CREATE POLICY "staff_select_protein_orders" ON public.protein_orders
  FOR SELECT TO authenticated USING (public.is_staff_user());
CREATE POLICY "staff_insert_protein_orders" ON public.protein_orders
  FOR INSERT TO authenticated WITH CHECK (public.is_staff_user());
CREATE POLICY "staff_update_protein_orders" ON public.protein_orders
  FOR UPDATE TO authenticated USING (public.is_staff_user()) WITH CHECK (public.is_staff_user());
CREATE POLICY "staff_delete_protein_orders" ON public.protein_orders
  FOR DELETE TO authenticated USING (public.is_staff_user());

-- cfdis writes: same, staff only.
DROP POLICY IF EXISTS "App users can insert cfdis" ON public.cfdis;
DROP POLICY IF EXISTS "App users can update cfdis" ON public.cfdis;

CREATE POLICY "staff_insert_cfdis" ON public.cfdis
  FOR INSERT TO authenticated WITH CHECK (public.is_staff_user());
CREATE POLICY "staff_update_cfdis" ON public.cfdis
  FOR UPDATE TO authenticated USING (public.is_staff_user()) WITH CHECK (public.is_staff_user());

-- The role helpers do not need to be reachable by unauthenticated callers.
REVOKE EXECUTE ON FUNCTION public.is_staff_user() FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_admin_user() FROM anon;
