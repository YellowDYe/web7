/*
  # Security: require an administrator for user-provisioning RPCs

  `create_invited_user`, `fix_orphaned_user`, `link_orphaned_auth_user`,
  `find_orphaned_auth_users` and `get_invitation_system_health` are
  SECURITY DEFINER and were executable by every authenticated user, which let
  any signed-in account create staff records (including ADMIN) or attach itself
  to an existing staff record. Each now refuses unless the caller is an active
  ADMIN/MANAGER. Bodies are otherwise unchanged.
*/

CREATE OR REPLACE FUNCTION public.create_invited_user(p_email text, p_full_name text, p_role_id text, p_invited_by text, p_temp_password text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
v_auth_user_id uuid;
v_user_id text;
v_invitation_id text;
v_existing_user record;
v_expires_at timestamptz;
BEGIN
-- Authorization: administrators only
IF NOT public.is_admin_user() THEN
RETURN json_build_object('success', false, 'message', 'Not authorized');
END IF;

-- Validate email
IF p_email IS NULL OR TRIM(p_email) = '' THEN
RETURN json_build_object('success', false, 'message', 'Email is required');
END IF;

-- Validate password
IF p_temp_password IS NULL OR LENGTH(p_temp_password) < 8 THEN
RETURN json_build_object('success', false, 'message', 'Temporary password must be at least 8 characters');
END IF;

-- Check if auth user already exists
SELECT id INTO v_auth_user_id
FROM auth.users
WHERE LOWER(email) = LOWER(p_email)
LIMIT 1;

IF v_auth_user_id IS NOT NULL THEN
RETURN json_build_object('success', false, 'message', 'User already exists in authentication system');
END IF;

-- Check if app user already exists
SELECT * INTO v_existing_user
FROM app_users
WHERE LOWER(email) = LOWER(p_email)
LIMIT 1;

IF v_existing_user.id IS NOT NULL THEN
RETURN json_build_object('success', false, 'message', 'User already exists in application');
END IF;

-- Validate role
IF NOT EXISTS (SELECT 1 FROM user_roles WHERE role_id = p_role_id AND is_active = true) THEN
RETURN json_build_object('success', false, 'message', 'Invalid or inactive role: ' || p_role_id);
END IF;

-- Generate user_id
SELECT COALESCE(
'USR' || (MAX(CAST(SUBSTRING(user_id FROM 4) AS INTEGER)) + 1)::text,
'USR1'
) INTO v_user_id
FROM app_users
WHERE user_id ~ '^USR[0-9]+$';

-- Generate invitation_id
SELECT COALESCE(
'INV' || (MAX(CAST(SUBSTRING(invitation_id FROM 4) AS INTEGER)) + 1)::text,
'INV1'
) INTO v_invitation_id
FROM user_invitations
WHERE invitation_id ~ '^INV[0-9]+$';

v_expires_at := CURRENT_TIMESTAMP + INTERVAL '7 days';

BEGIN
INSERT INTO app_users (
user_id, email, full_name, role_id, is_active,
password_change_required, temp_password_set, created_at, updated_at
) VALUES (
v_user_id, LOWER(TRIM(p_email)), TRIM(p_full_name), p_role_id, true,
true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
);

INSERT INTO user_invitations (
invitation_id, email, role_id, invited_by, created_user_id,
temp_password, expires_at, created_at
) VALUES (
v_invitation_id, LOWER(TRIM(p_email)), p_role_id, p_invited_by, v_user_id,
p_temp_password, v_expires_at, CURRENT_TIMESTAMP
);

RETURN json_build_object(
'success', true,
'message', 'User created successfully',
'user_id', v_user_id,
'invitation_id', v_invitation_id,
'email', LOWER(TRIM(p_email)),
'temp_password', p_temp_password,
'expires_at', v_expires_at
);

EXCEPTION WHEN OTHERS THEN
RETURN json_build_object('success', false, 'message', 'Error creating user: ' || SQLERRM);
END;
END;
$function$;

-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.fix_orphaned_user(p_auth_user_id uuid)
RETURNS TABLE(user_id text, email text, full_name text, role_id text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
v_new_user_id text;
v_auth_user record;
v_pending_invitation record;
v_is_oauth_user boolean;
v_assigned_role_id text;
v_user_full_name text;
BEGIN
IF NOT public.is_admin_user() THEN
RAISE EXCEPTION 'Not authorized';
END IF;

SELECT * INTO v_auth_user
FROM auth.users
WHERE id = p_auth_user_id;

IF v_auth_user.id IS NULL THEN
RAISE EXCEPTION 'Auth user not found with id: %', p_auth_user_id;
END IF;

IF EXISTS (SELECT 1 FROM public.app_users WHERE auth_user_id = p_auth_user_id) THEN
RAISE EXCEPTION 'User already has an app_users record';
END IF;

v_is_oauth_user := v_auth_user.raw_app_meta_data->>'provider' IS NOT NULL
AND v_auth_user.raw_app_meta_data->>'provider' != 'email';

v_user_full_name := COALESCE(
v_auth_user.raw_user_meta_data->>'full_name',
v_auth_user.raw_user_meta_data->>'name',
v_auth_user.email
);

SELECT * INTO v_pending_invitation
FROM public.user_invitations
WHERE email = v_auth_user.email
AND accepted_at IS NULL
AND superseded_at IS NULL
AND expires_at > now()
ORDER BY created_at DESC
LIMIT 1;

IF v_pending_invitation.id IS NOT NULL THEN
v_assigned_role_id := v_pending_invitation.role_id;
ELSE
v_assigned_role_id := 'customer';
END IF;

IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role_id = v_assigned_role_id AND is_active = true) THEN
v_assigned_role_id := 'customer';
END IF;

SELECT COALESCE(
'USR' || (MAX(CAST(SUBSTRING(app_users.user_id FROM 4) AS INTEGER)) + 1)::text,
'USR1'
) INTO v_new_user_id
FROM public.app_users
WHERE app_users.user_id ~ '^USR[0-9]+$';

INSERT INTO public.app_users (
user_id, auth_user_id, email, full_name, role_id, is_active,
temp_password_set, migrated_to_supabase_at, invitation_accepted_at
) VALUES (
v_new_user_id, p_auth_user_id, v_auth_user.email, v_user_full_name,
v_assigned_role_id, true,
CASE WHEN v_is_oauth_user THEN true ELSE false END,
now(),
CASE WHEN v_pending_invitation.id IS NOT NULL THEN now() ELSE NULL END
);

IF v_pending_invitation.id IS NOT NULL THEN
UPDATE public.user_invitations
SET accepted_at = now()
WHERE id = v_pending_invitation.id;
END IF;

RETURN QUERY
SELECT v_new_user_id, v_auth_user.email::text, v_user_full_name, v_assigned_role_id;
END;
$function$;

-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.link_orphaned_auth_user(auth_user_email text, force_link boolean DEFAULT false)
RETURNS TABLE(success boolean, message text, app_user_id text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
auth_record record;
app_user_record record;
new_user_id text;
invitation_record record;
BEGIN
IF NOT public.is_admin_user() THEN
RETURN QUERY SELECT false, 'Not authorized'::text, NULL::text;
RETURN;
END IF;

SELECT * INTO auth_record
FROM auth.users
WHERE email = auth_user_email
LIMIT 1;

IF auth_record.id IS NULL THEN
RETURN QUERY SELECT false, 'Auth user not found with email: ' || auth_user_email, NULL::text;
RETURN;
END IF;

IF EXISTS (SELECT 1 FROM public.app_users WHERE auth_user_id = auth_record.id) THEN
SELECT app_users.user_id INTO new_user_id FROM public.app_users WHERE auth_user_id = auth_record.id;
RETURN QUERY SELECT true, 'Auth user already linked to app_user: ' || new_user_id, new_user_id;
RETURN;
END IF;

SELECT * INTO app_user_record
FROM public.app_users
WHERE email = auth_user_email
AND auth_user_id IS NULL
LIMIT 1;

IF app_user_record.id IS NOT NULL THEN
UPDATE public.app_users
SET auth_user_id = auth_record.id,
migrated_to_supabase_at = now(),
invitation_accepted_at = COALESCE(invitation_accepted_at, now())
WHERE id = app_user_record.id;

RETURN QUERY SELECT true,
'Successfully linked existing app_user ' || app_user_record.user_id || ' to auth user',
app_user_record.user_id;
RETURN;
END IF;

SELECT * INTO invitation_record
FROM public.user_invitations
WHERE email = auth_user_email
AND accepted_at IS NULL
AND expires_at > now()
ORDER BY created_at DESC
LIMIT 1;

IF invitation_record.id IS NULL AND NOT force_link THEN
RETURN QUERY SELECT false,
'No valid invitation found. Use force_link=true to create app_user with default role'::text,
NULL::text;
RETURN;
END IF;

SELECT COALESCE(
'USR' || (MAX(CAST(SUBSTRING(app_users.user_id FROM 4) AS INTEGER)) + 1)::text,
'USR1'
) INTO new_user_id
FROM public.app_users
WHERE app_users.user_id ~ '^USR[0-9]+$';

INSERT INTO public.app_users (
user_id, auth_user_id, email, full_name, role_id, is_active,
temp_password_set, migrated_to_supabase_at, invitation_accepted_at
) VALUES (
new_user_id,
auth_record.id,
auth_record.email,
COALESCE(
auth_record.raw_user_meta_data->>'full_name',
auth_record.raw_user_meta_data->>'name',
split_part(auth_record.email, '@', 1)
),
COALESCE(invitation_record.role_id, 'AGENTE'),
true, true, now(), now()
);

IF invitation_record.id IS NOT NULL THEN
UPDATE public.user_invitations
SET accepted_at = now(),
accepted_by_auth_id = auth_record.id
WHERE id = invitation_record.id;
END IF;

RETURN QUERY SELECT true,
'Created new app_user ' || new_user_id || ' and linked to auth user',
new_user_id;
END;
$function$;

-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.find_orphaned_auth_users()
RETURNS TABLE(auth_id uuid, email text, created_at timestamp with time zone, full_name text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
IF NOT public.is_admin_user() THEN
RAISE EXCEPTION 'Not authorized';
END IF;

RETURN QUERY
SELECT
au.id as auth_id,
au.email::text,
au.created_at,
COALESCE(
au.raw_user_meta_data->>'full_name',
au.raw_user_meta_data->>'name',
au.email
)::text as full_name
FROM auth.users au
LEFT JOIN public.app_users apu ON apu.auth_user_id = au.id
WHERE apu.id IS NULL
ORDER BY au.created_at DESC;
END;
$function$;

-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_invitation_system_health()
RETURNS TABLE(check_name text, status text, details text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
trigger_exists boolean;
pending_count integer;
expired_count integer;
accepted_count integer;
orphaned_auth_count integer;
orphaned_app_count integer;
BEGIN
IF NOT public.is_admin_user() THEN
RAISE EXCEPTION 'Not authorized';
END IF;

SELECT EXISTS (
SELECT 1 FROM pg_trigger WHERE tgname = 'on_auth_user_created'
) INTO trigger_exists;

RETURN QUERY SELECT
'Trigger Status'::text,
CASE WHEN trigger_exists THEN 'OK' ELSE 'ERROR' END,
CASE WHEN trigger_exists
THEN 'Trigger on_auth_user_created is active'
ELSE 'Trigger on_auth_user_created is MISSING!'
END;

SELECT COUNT(*) INTO pending_count
FROM public.user_invitations
WHERE accepted_at IS NULL AND expires_at > now();

RETURN QUERY SELECT 'Pending Invitations'::text, 'INFO'::text,
pending_count || ' pending invitation(s)'::text;

SELECT COUNT(*) INTO expired_count
FROM public.user_invitations
WHERE accepted_at IS NULL AND expires_at <= now();

RETURN QUERY SELECT 'Expired Invitations'::text,
CASE WHEN expired_count > 10 THEN 'WARNING' ELSE 'INFO' END,
expired_count || ' expired invitation(s) need cleanup'::text;

SELECT COUNT(*) INTO accepted_count
FROM public.user_invitations
WHERE accepted_at IS NOT NULL;

RETURN QUERY SELECT 'Accepted Invitations'::text, 'INFO'::text,
accepted_count || ' successfully accepted invitation(s)'::text;

SELECT COUNT(*) INTO orphaned_auth_count
FROM auth.users au
WHERE NOT EXISTS (SELECT 1 FROM public.app_users ap WHERE ap.auth_user_id = au.id);

RETURN QUERY SELECT 'Orphaned Auth Users'::text,
CASE WHEN orphaned_auth_count > 0 THEN 'WARNING' ELSE 'OK' END,
orphaned_auth_count || ' auth user(s) without app_users record'::text;

SELECT COUNT(*) INTO orphaned_app_count
FROM public.app_users ap
WHERE ap.auth_user_id IS NOT NULL
AND NOT EXISTS (SELECT 1 FROM auth.users au WHERE au.id = ap.auth_user_id);

RETURN QUERY SELECT 'Orphaned App Users'::text,
CASE WHEN orphaned_app_count > 0 THEN 'WARNING' ELSE 'OK' END,
orphaned_app_count || ' app_users record(s) without auth user'::text;

RETURN;
END;
$function$;

REVOKE ALL ON FUNCTION public.create_invited_user(text, text, text, text, text) FROM anon;
REVOKE ALL ON FUNCTION public.fix_orphaned_user(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.link_orphaned_auth_user(text, boolean) FROM anon;
REVOKE ALL ON FUNCTION public.find_orphaned_auth_users() FROM anon;
REVOKE ALL ON FUNCTION public.get_invitation_system_health() FROM anon;
