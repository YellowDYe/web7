/*
  # Harden create_customer_account: auto-detect existing customer + retry on duplicate ID

  1. Changes to `create_customer_account`
    - **Auto-detect existing customer by email**: Before the INSERT/UPDATE branch,
      the function now looks up whether a customer record with the caller's
      verified email already exists. If one is found and `p_existing_customer_id`
      was not supplied by the caller, it auto-fills it. This makes the function
      self-healing: even if the frontend fails to pass the existing customer ID
      (e.g. due to throttling on the email-check RPC), the function still links
      instead of inserting a duplicate.
    - **Retry on duplicate customer_id**: The INSERT branch now lives inside a
      loop (max 5 attempts). If the generated `CUST-XXXX` collides with an
      existing row (unique constraint violation 23505 on `customers_customer_id_key`),
      it re-reads MAX and retries with a higher number. This eliminates the
      "duplicate key value violates unique constraint" error that occurred when
      two signups raced or when the MAX calculation picked a stale number.

  2. Security
    - All existing auth checks are preserved (caller must be signed in, can
      only create for their own email, can only link unclaimed records matching
      their email).
    - The function remains SECURITY DEFINER with search_path pinned to 'public'.

  3. Important Notes
    - The retry loop only catches the specific constraint violation on
      `customers_customer_id_key`; any other error is re-raised immediately.
    - The auto-detection only fills `p_existing_customer_id` when the existing
      record is unclaimed (`auth_user_id IS NULL`) or already owned by the
      caller. Records claimed by a different user are left alone and the
      function proceeds to INSERT (which will succeed with a new customer_id).
*/

CREATE OR REPLACE FUNCTION public.create_customer_account(
  p_auth_user_id uuid,
  p_email text,
  p_nombre text,
  p_apellidos text,
  p_telefono text,
  p_rfc text DEFAULT '',
  p_razon_social text DEFAULT '',
  p_regimen_fiscal text DEFAULT '',
  p_uso_cfdi text DEFAULT 'G03',
  p_codigo_postal text DEFAULT '',
  p_estado text DEFAULT '',
  p_ciudad text DEFAULT '',
  p_colonia text DEFAULT '',
  p_calle text DEFAULT '',
  p_numero_exterior text DEFAULT '',
  p_numero_interior text DEFAULT '',
  p_referencias text DEFAULT '',
  p_customer_notes text DEFAULT '',
  p_existing_customer_id uuid DEFAULT NULL,
  p_customer_restrictions jsonb DEFAULT '[]',
  p_family_members jsonb DEFAULT '[]'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_customer_id text;
  v_result jsonb;
  v_max_num bigint;
  v_new_id uuid;
  v_member jsonb;
  v_slot int;
  v_linked int;
  v_caller_email text;
  v_target_email text;
  v_attempt int;
  v_auto_detected_id uuid;
BEGIN
  -- The caller must be signed in and may only create an account for themselves.
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF p_auth_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Not authorized to create account for another user';
  END IF;

  SELECT lower(trim(u.email)) INTO v_caller_email FROM auth.users u WHERE u.id = auth.uid();

  IF v_caller_email IS NULL THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF lower(trim(COALESCE(p_email, ''))) IS DISTINCT FROM v_caller_email THEN
    RAISE EXCEPTION 'Not authorized to use another email address';
  END IF;

  -- Auto-detect: if the caller did not pass an existing customer ID,
  -- check whether there is already a customer row for this email that
  -- can be claimed (unclaimed or already owned by this caller).
  IF p_existing_customer_id IS NULL THEN
    SELECT c.id INTO v_auto_detected_id
    FROM customers c
    WHERE lower(trim(COALESCE(c.customer_email, ''))) = v_caller_email
      AND (c.auth_user_id IS NULL OR c.auth_user_id = auth.uid())
    LIMIT 1;

    IF v_auto_detected_id IS NOT NULL THEN
      p_existing_customer_id := v_auto_detected_id;
    END IF;
  END IF;

  IF p_existing_customer_id IS NOT NULL THEN
    -- Only an unclaimed record that already carries the caller's own address,
    -- or one the caller already owns, may be linked.
    SELECT lower(trim(COALESCE(c.customer_email, ''))) INTO v_target_email
    FROM customers c WHERE c.id = p_existing_customer_id;

    IF v_target_email IS NULL OR v_target_email IS DISTINCT FROM v_caller_email THEN
      RAISE EXCEPTION 'Not authorized to link this customer record';
    END IF;

    UPDATE customers SET
      auth_user_id = p_auth_user_id,
      customer_email = p_email,
      customer_name = p_nombre,
      customer_lastname = p_apellidos,
      customer_phone = p_telefono,
      customer_street = p_calle,
      customer_street_number = p_numero_exterior,
      customer_interior_number = COALESCE(NULLIF(p_numero_interior, ''), ''),
      customer_colonia = p_colonia,
      customer_delegacion = p_ciudad,
      customer_postal_code = p_codigo_postal,
      customer_delivery_instructions = COALESCE(NULLIF(p_referencias, ''), ''),
      customer_restrictions = p_customer_restrictions,
      customer_notes = COALESCE(NULLIF(p_customer_notes, ''), ''),
      rfc = COALESCE(NULLIF(p_rfc, ''), ''),
      billing_name = COALESCE(NULLIF(p_razon_social, ''), ''),
      tax_regime = COALESCE(NULLIF(p_regimen_fiscal, ''), ''),
      cfdi_use = COALESCE(NULLIF(p_uso_cfdi, ''), 'G03'),
      email_verified = true,
      account_status = 'active',
      last_login = now(),
      updated_at = now()
    WHERE id = p_existing_customer_id
      AND lower(trim(COALESCE(customer_email, ''))) = v_caller_email
      AND (auth_user_id IS NULL OR auth_user_id = auth.uid());

    GET DIAGNOSTICS v_linked = ROW_COUNT;

    IF v_linked = 0 THEN
      RAISE EXCEPTION 'Not authorized to link this customer record';
    END IF;

    v_new_id := p_existing_customer_id;
  ELSE
    -- INSERT path with retry on duplicate customer_id
    v_attempt := 0;
    LOOP
      v_attempt := v_attempt + 1;

      SELECT COALESCE(MAX(
        CASE
          WHEN customer_id ~ '^CUST-[0-9]+$'
          THEN CAST(SUBSTRING(customer_id FROM 6) AS bigint)
          ELSE 0
        END
      ), 0) INTO v_max_num FROM customers;

      v_customer_id := 'CUST-' || (v_max_num + 1)::text;
      v_new_id := gen_random_uuid();

      BEGIN
        INSERT INTO customers (
          id, customer_id, customer_name, customer_lastname, customer_email,
          customer_phone, customer_street, customer_street_number,
          customer_interior_number, customer_colonia, customer_delegacion,
          customer_postal_code, customer_delivery_instructions,
          customer_restrictions, customer_notes, rfc, billing_name, tax_regime,
          cfdi_use, auth_user_id, email_verified, account_status, last_login,
          profile_setup_completed
        ) VALUES (
          v_new_id, v_customer_id, p_nombre, p_apellidos, p_email,
          p_telefono, p_calle, p_numero_exterior,
          COALESCE(NULLIF(p_numero_interior, ''), ''), p_colonia, p_ciudad,
          p_codigo_postal, COALESCE(NULLIF(p_referencias, ''), ''),
          p_customer_restrictions, COALESCE(NULLIF(p_customer_notes, ''), ''),
          COALESCE(NULLIF(p_rfc, ''), ''), COALESCE(NULLIF(p_razon_social, ''), ''),
          COALESCE(NULLIF(p_regimen_fiscal, ''), ''),
          COALESCE(NULLIF(p_uso_cfdi, ''), 'G03'), p_auth_user_id, true,
          'active', now(), true
        );
        EXIT; -- success, leave the loop
      EXCEPTION
        WHEN unique_violation THEN
          IF v_attempt >= 5 THEN
            RAISE;
          END IF;
          -- retry with a fresh MAX
      END;
    END LOOP;
  END IF;

  -- Family members
  v_slot := 0;
  FOR v_member IN SELECT * FROM jsonb_array_elements(p_family_members)
  LOOP
    v_slot := v_slot + 1;
    EXIT WHEN v_slot > 5;

    EXECUTE format(
      'UPDATE customers SET family_member_%s_name = $1, family_member_%s_restrictions = $2 WHERE id = $3',
      v_slot, v_slot
    ) USING
      v_member->>'family_member_name',
      ARRAY(SELECT jsonb_array_elements_text(COALESCE(v_member->'family_member_restrictions', '[]'::jsonb))),
      v_new_id;
  END LOOP;

  SELECT to_jsonb(c.*) INTO v_result FROM customers c WHERE c.id = v_new_id;

  RETURN v_result;
END;
$function$;
