/*
  # Security: stop staff accounts from editing their own privileges

  Previously `app_users` had SELECT `USING (true)` (so every customer could read
  the staff roster) and INSERT/UPDATE/DELETE gated only on "the caller has some
  app_users row", which let any staff member — or anyone who obtained a row —
  set `role_id = 'ADMIN'` on themselves or edit any other staff record.

  1. SELECT is now the caller's own row, or any row for staff.
  2. INSERT and DELETE are administrator-only.
  3. UPDATE is administrator-only, plus the caller's own row.
  4. A BEFORE UPDATE trigger rejects any change to the privilege-bearing
     columns (role_id, is_active, auth_user_id, user_id, email) unless the
     caller is an administrator or there is no user session (server-side jobs).
*/

DROP POLICY IF EXISTS "Authenticated users can read app users" ON public.app_users;
DROP POLICY IF EXISTS "App users can insert app users" ON public.app_users;
DROP POLICY IF EXISTS "App users can update app users" ON public.app_users;
DROP POLICY IF EXISTS "App users can delete app users" ON public.app_users;

CREATE POLICY "self_or_staff_select_app_users" ON public.app_users
  FOR SELECT TO authenticated
  USING (auth_user_id = auth.uid() OR public.is_staff_user());

CREATE POLICY "admin_insert_app_users" ON public.app_users
  FOR INSERT TO authenticated WITH CHECK (public.is_admin_user());

CREATE POLICY "admin_or_self_update_app_users" ON public.app_users
  FOR UPDATE TO authenticated
  USING (public.is_admin_user() OR auth_user_id = auth.uid())
  WITH CHECK (public.is_admin_user() OR auth_user_id = auth.uid());

CREATE POLICY "admin_delete_app_users" ON public.app_users
  FOR DELETE TO authenticated USING (public.is_admin_user());

-- Column-level guard: only administrators may move privilege columns.
CREATE OR REPLACE FUNCTION public.enforce_app_users_privilege_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- No end-user session (service role / SQL migrations): allow.
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF public.is_admin_user() THEN
    RETURN NEW;
  END IF;

  IF NEW.role_id IS DISTINCT FROM OLD.role_id
     OR NEW.is_active IS DISTINCT FROM OLD.is_active
     OR NEW.auth_user_id IS DISTINCT FROM OLD.auth_user_id
     OR NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.email IS DISTINCT FROM OLD.email THEN
    RAISE EXCEPTION 'Not authorized to change account privileges';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_app_users_privilege_columns ON public.app_users;
CREATE TRIGGER trg_app_users_privilege_columns
  BEFORE UPDATE ON public.app_users
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_app_users_privilege_columns();
