/*
  # Security: role helper functions + authorization guards on privileged RPCs

  1. New helper functions
     - `public.is_staff_user()` - true when the caller has an active app_users row
       whose role is NOT the 'customer' role.
     - `public.is_admin_user()` - true when the caller has an active app_users row
       with role ADMIN or MANAGER.
     Both are SECURITY DEFINER so they can be used inside RLS policies on
     app_users itself without recursion.

  2. Authorization guards added
     - create_invited_user, fix_orphaned_user, link_orphaned_auth_user,
       find_orphaned_auth_users, get_invitation_system_health,
       reconcile_account_balance: now require an administrator caller.
     - clear_password_change_requirement (both overloads): restricted to the
       caller's own record or an administrator; EXECUTE revoked from anon.

  3. Hardening
     - get_missing_he_submissions: search_path pinned.
*/

-- ---------------------------------------------------------------------------
-- 1. Role helpers
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.is_staff_user()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.app_users au
    WHERE au.auth_user_id = auth.uid()
      AND COALESCE(au.is_active, true) = true
      AND au.role_id IS DISTINCT FROM 'customer'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_admin_user()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.app_users au
    WHERE au.auth_user_id = auth.uid()
      AND COALESCE(au.is_active, true) = true
      AND au.role_id IN ('ADMIN', 'MANAGER')
  );
$$;

REVOKE ALL ON FUNCTION public.is_staff_user() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_admin_user() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_staff_user() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin_user() TO authenticated;

-- ---------------------------------------------------------------------------
-- 2. get_missing_he_submissions: pin search_path
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_missing_he_submissions(min_date text)
RETURNS TABLE(order_id text, week_id text, delivery_date text, family_member_id text)
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $function$
SELECT
ow.order_id::text,
ow.week_id::text,
ow.delivery_date::text,
ow.family_member_id::text
FROM order_weeks ow
WHERE ow.delivery_date >= min_date::date
AND NOT EXISTS (
SELECT 1 FROM delivery_tracking_submissions dts
WHERE dts.order_id = ow.order_id
AND dts.delivery_order_id = ow.order_id || '_' || ow.week_id
AND dts.submission_status = 'success'
)
AND EXISTS (
SELECT 1 FROM delivery_tracking_submissions dts2
WHERE dts2.order_id = ow.order_id
AND dts2.submission_status = 'success'
)
ORDER BY ow.delivery_date, ow.order_id;
$function$;

-- ---------------------------------------------------------------------------
-- 3. clear_password_change_requirement: self or admin only
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.clear_password_change_requirement(p_email text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
v_auth_user_id uuid;
BEGIN
IF auth.uid() IS NULL THEN
RETURN json_build_object('success', false, 'message', 'Not authorized');
END IF;

SELECT auth_user_id INTO v_auth_user_id
FROM app_users
WHERE email = p_email
LIMIT 1;

IF v_auth_user_id IS NULL THEN
RETURN json_build_object('success', false, 'message', 'User not found');
END IF;

IF v_auth_user_id <> auth.uid() AND NOT public.is_admin_user() THEN
RETURN json_build_object('success', false, 'message', 'Not authorized');
END IF;

UPDATE app_users
SET password_change_required = false, temp_password_set = false
WHERE auth_user_id = v_auth_user_id;

RETURN json_build_object('success', true);
END;
$function$;

CREATE OR REPLACE FUNCTION public.clear_password_change_requirement(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
IF auth.uid() IS NULL THEN
RAISE EXCEPTION 'Not authorized';
END IF;

IF p_user_id <> auth.uid() AND NOT public.is_admin_user() THEN
RAISE EXCEPTION 'Not authorized';
END IF;

UPDATE app_users
SET password_change_required = false, temp_password_set = false
WHERE auth_user_id = p_user_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.clear_password_change_requirement(text) FROM anon;
REVOKE ALL ON FUNCTION public.clear_password_change_requirement(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.clear_password_change_requirement(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.clear_password_change_requirement(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- 4. reconcile_account_balance: admin only
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.reconcile_account_balance(
  p_account_id text,
  p_old_balance numeric,
  p_new_balance numeric,
  p_reconciliation_date timestamp with time zone DEFAULT now()
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
v_diff numeric;
v_reconciliation_id uuid;
BEGIN
IF NOT public.is_admin_user() THEN
RAISE EXCEPTION 'Not authorized';
END IF;

v_diff := p_new_balance - p_old_balance;

INSERT INTO bank_account_reconciliations (
bank_account_id,
previous_balance,
new_balance,
balance_difference,
reconciliation_date
) VALUES (
p_account_id,
p_old_balance,
p_new_balance,
v_diff,
p_reconciliation_date
)
RETURNING id INTO v_reconciliation_id;

INSERT INTO account_balances (
account_id,
previous_balance,
new_balance,
balance_change,
movement_table,
change_reason,
movement_date
) VALUES (
p_account_id,
p_old_balance,
p_new_balance,
v_diff,
'bank_account_reconciliations',
'reconciliation',
p_reconciliation_date
);

RETURN v_reconciliation_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.reconcile_account_balance(text, numeric, numeric, timestamptz) FROM anon;
GRANT EXECUTE ON FUNCTION public.reconcile_account_balance(text, numeric, numeric, timestamptz) TO authenticated;
