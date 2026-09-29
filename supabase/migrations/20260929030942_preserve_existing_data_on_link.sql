/*
  # Preserve existing customer data when linking an account

  1. Changes to `create_customer_account`
    - In the UPDATE branch (existing customer linking), each profile field now
      uses COALESCE(NULLIF(p_param, ''), existing_column) so that when an empty
      string is passed (e.g. from the shortcut link-only signup flow), the
      existing value in the database is kept instead of being overwritten with
      a blank.
    - Fields that MUST always be set during linking (auth_user_id, customer_email,
      email_verified, account_status, last_login, updated_at) continue to be
      written unconditionally.
    - The INSERT branch (new customer) is unchanged -- it still uses the passed
      values directly since there is no prior data to preserve.

  2. Security
    - All existing auth checks are preserved.
    - The function remains SECURITY DEFINER with search_path pinned to 'public'.

  3. Important Notes
    - This fixes the bug where the link-existing-customer flow passed empty
      placeholder data, which caused the database function to overwrite the
      customer's name, phone, and address with blank strings. After this fix,
      empty strings are treated as "keep existing value."
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
    SELECT lower(trim(COALESCE(c.customer_email, ''))) INTO v_target_email
    FROM customers c WHERE c.id = p_existing_customer_id;

    IF v_target_email IS NULL OR v_target_email IS DISTINCT FROM v_caller_email THEN
      RAISE EXCEPTION 'Not authorized to link this customer record';
    END IF;

    UPDATE customers SET
      auth_user_id = p_auth_user_id,
      customer_email = p_email,
      customer_name = COALESCE(NULLIF(p_nombre, ''), customer_name),
      customer_lastname = COALESCE(NULLIF(p_apellidos, ''), customer_lastname),
      customer_phone = COALESCE(NULLIF(p_telefono, ''), customer_phone),
      customer_street = COALESCE(NULLIF(p_calle, ''), customer_street),
      customer_street_number = COALESCE(NULLIF(p_numero_exterior, ''), customer_street_number),
      customer_interior_number = COALESCE(NULLIF(p_numero_interior, ''), customer_interior_number),
      customer_colonia = COALESCE(NULLIF(p_colonia, ''), customer_colonia),
      customer_delegacion = COALESCE(NULLIF(p_ciudad, ''), customer_delegacion),
      customer_postal_code = COALESCE(NULLIF(p_codigo_postal, ''), customer_postal_code),
      customer_delivery_instructions = COALESCE(NULLIF(p_referencias, ''), customer_delivery_instructions),
      customer_restrictions = CASE WHEN p_customer_restrictions = '[]'::jsonb THEN customer_restrictions ELSE p_customer_restrictions END,
      customer_notes = COALESCE(NULLIF(p_customer_notes, ''), customer_notes),
      rfc = COALESCE(NULLIF(p_rfc, ''), rfc),
      billing_name = COALESCE(NULLIF(p_razon_social, ''), billing_name),
      tax_regime = COALESCE(NULLIF(p_regimen_fiscal, ''), tax_regime),
      cfdi_use = COALESCE(NULLIF(p_uso_cfdi, ''), cfdi_use),
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
        EXIT;
      EXCEPTION
        WHEN unique_violation THEN
          IF v_attempt >= 5 THEN
            RAISE;
          END IF;
      END;
    END LOOP;
  END IF;

  -- Family members (only apply if non-empty array was passed)
  IF p_family_members IS DISTINCT FROM '[]'::jsonb THEN
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
  END IF;

  SELECT to_jsonb(c.*) INTO v_result FROM customers c WHERE c.id = v_new_id;

  RETURN v_result;
END;
$function$;
