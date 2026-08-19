/*
  # Security: remove the implicit PUBLIC execute grant

  CREATE OR REPLACE preserves the default PUBLIC EXECUTE grant, which is why
  `anon` still resolved as able to execute these. The functions already refuse
  unauthorized callers internally; this removes the grant as well.
*/

REVOKE ALL ON FUNCTION public.clear_password_change_requirement(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.clear_password_change_requirement(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reconcile_account_balance(text, numeric, numeric, timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_invited_user(text, text, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fix_orphaned_user(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.link_orphaned_auth_user(text, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.find_orphaned_auth_users() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_invitation_system_health() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.clear_password_change_requirement(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.clear_password_change_requirement(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reconcile_account_balance(text, numeric, numeric, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_invited_user(text, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fix_orphaned_user(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.link_orphaned_auth_user(text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.find_orphaned_auth_users() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_invitation_system_health() TO authenticated;
