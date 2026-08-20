/*
# Fix integer overflow in create_customer_account function

1. Problem
  - The customer_id generation logic casts the numeric suffix to int (4 bytes, max ~2.1 billion).
  - Existing customer_ids like CUST-1766722813604 exceed that range.
  - This causes "value is out of range for type integer" on every signup attempt.

2. Fix
  - Changed the variable type from int to bigint to handle the large numeric suffixes.
  - The rest of the function logic remains the same.
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
  p_customer_restrictions jsonb DEFAULT '[]'::jsonb,
  p_family_members jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_customer_id text;
  v_result jsonb;
  v_max_num bigint;
  v_new_id uuid;
  v_member jsonb;
  v_slot int;
BEGIN
  -- Enforce that the caller is creating their own account
  IF p_auth_user_id != auth.uid() THEN
    RAISE EXCEPTION 'Not authorized to create account for another user';
  END IF;

  -- If linking to an existing customer record
  IF p_existing_customer_id IS NOT NULL THEN
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
    WHERE id = p_existing_customer_id;

    v_new_id := p_existing_customer_id;
  ELSE
    -- Generate next customer_id using bigint to handle large existing numbers
    SELECT COALESCE(MAX(
      CASE
        WHEN customer_id ~ '^CUST-[0-9]+$'
        THEN CAST(SUBSTRING(customer_id FROM 6) AS bigint)
        ELSE 0
      END
    ), 0) INTO v_max_num FROM customers;

    v_customer_id := 'CUST-' || LPAD((v_max_num + 1)::text, 4, '0');
    v_new_id := gen_random_uuid();

    INSERT INTO customers (
      id,
      customer_id,
      customer_name,
      customer_lastname,
      customer_email,
      customer_phone,
      customer_street,
      customer_street_number,
      customer_interior_number,
      customer_colonia,
      customer_delegacion,
      customer_postal_code,
      customer_delivery_instructions,
      customer_restrictions,
      customer_notes,
      rfc,
      billing_name,
      tax_regime,
      cfdi_use,
      auth_user_id,
      email_verified,
      account_status,
      last_login,
      profile_setup_completed
    ) VALUES (
      v_new_id,
      v_customer_id,
      p_nombre,
      p_apellidos,
      p_email,
      p_telefono,
      p_calle,
      p_numero_exterior,
      COALESCE(NULLIF(p_numero_interior, ''), ''),
      p_colonia,
      p_ciudad,
      p_codigo_postal,
      COALESCE(NULLIF(p_referencias, ''), ''),
      p_customer_restrictions,
      COALESCE(NULLIF(p_customer_notes, ''), ''),
      COALESCE(NULLIF(p_rfc, ''), ''),
      COALESCE(NULLIF(p_razon_social, ''), ''),
      COALESCE(NULLIF(p_regimen_fiscal, ''), ''),
      COALESCE(NULLIF(p_uso_cfdi, ''), 'G03'),
      p_auth_user_id,
      true,
      'active',
      now(),
      true
    );
  END IF;

  -- Update family members (up to 5 slots)
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

  -- Return the created/updated customer
  SELECT to_jsonb(c.*) INTO v_result FROM customers c WHERE c.id = v_new_id;

  RETURN v_result;
END;
$$;
