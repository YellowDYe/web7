/*
  # Validate coupons server-side and stop publishing the coupon catalogue

  1. Problem
    - `coupons` had a SELECT policy with a predicate of `true` for every signed-in
      user, so any shopper could list every coupon code, its discount and its
      limits straight from the data API.
    - All coupon validation happened in the browser, so the discount was decided
      client-side.

  2. New function
    - `public.validate_coupon_for_customer(p_code text, p_order_amount numeric)`
      SECURITY DEFINER. It resolves the code, checks active/date/minimum/usage
      limits, computes the discount server-side and returns only
      `valid`, `message`, `discount_amount`, `coupon_id`, `code`, `description`,
      `discount_type`, `discount_value`. Per-customer limits are counted against
      the caller's own customer row, resolved from `auth.uid()`.

  3. Security
    - The `coupons` SELECT policy is narrowed to staff, so the catalogue is no
      longer readable by shoppers; the admin coupons screen keeps working.
    - The new function is granted to `authenticated` only.
*/

CREATE OR REPLACE FUNCTION public.validate_coupon_for_customer(
  p_code text,
  p_order_amount numeric
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_coupon public.coupons;
  v_customer_id text;
  v_total_usage integer;
  v_customer_usage integer;
  v_amount numeric;
  v_discount numeric;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('valid', false, 'message', 'Debes iniciar sesion');
  END IF;

  v_amount := COALESCE(p_order_amount, 0);
  IF v_amount < 0 THEN
    v_amount := 0;
  END IF;

  SELECT * INTO v_coupon
  FROM public.coupons
  WHERE upper(btrim(code)) = upper(btrim(COALESCE(p_code, '')))
  LIMIT 1;

  IF v_coupon.id IS NULL THEN
    RETURN jsonb_build_object('valid', false, 'message', 'Cupon no encontrado');
  END IF;

  IF NOT COALESCE(v_coupon.is_active, false) THEN
    RETURN jsonb_build_object('valid', false, 'message', 'Este cupon no esta activo');
  END IF;

  IF v_coupon.valid_from IS NOT NULL AND now() < v_coupon.valid_from THEN
    RETURN jsonb_build_object('valid', false, 'message', 'Este cupon aun no es valido');
  END IF;

  IF v_coupon.valid_until IS NOT NULL AND now() > v_coupon.valid_until THEN
    RETURN jsonb_build_object('valid', false, 'message', 'Este cupon ha expirado');
  END IF;

  IF v_coupon.min_purchase_amount IS NOT NULL AND v_amount < v_coupon.min_purchase_amount THEN
    RETURN jsonb_build_object(
      'valid', false,
      'message', 'Monto minimo de compra requerido: $' || v_coupon.min_purchase_amount::text
    );
  END IF;

  IF v_coupon.usage_limit IS NOT NULL THEN
    SELECT count(*) INTO v_total_usage
    FROM public.coupon_usage
    WHERE coupon_id = v_coupon.id;

    IF v_total_usage >= v_coupon.usage_limit THEN
      RETURN jsonb_build_object('valid', false, 'message', 'Este cupon ha alcanzado su limite de uso');
    END IF;
  END IF;

  IF v_coupon.usage_limit_per_customer IS NOT NULL THEN
    SELECT c.customer_id INTO v_customer_id
    FROM public.customers c
    WHERE c.auth_user_id = auth.uid()
    LIMIT 1;

    IF v_customer_id IS NOT NULL THEN
      SELECT count(*) INTO v_customer_usage
      FROM public.coupon_usage
      WHERE coupon_id = v_coupon.id
        AND customer_id = v_customer_id;

      IF v_customer_usage >= v_coupon.usage_limit_per_customer THEN
        RETURN jsonb_build_object('valid', false, 'message', 'Has alcanzado el limite de uso de este cupon');
      END IF;
    END IF;
  END IF;

  IF v_coupon.discount_type = 'percentage' THEN
    v_discount := (v_amount * COALESCE(v_coupon.discount_value, 0)) / 100.0;
    IF v_coupon.max_discount_amount IS NOT NULL AND v_discount > v_coupon.max_discount_amount THEN
      v_discount := v_coupon.max_discount_amount;
    END IF;
  ELSE
    v_discount := COALESCE(v_coupon.discount_value, 0);
  END IF;

  IF v_discount > v_amount THEN
    v_discount := v_amount;
  END IF;
  IF v_discount < 0 THEN
    v_discount := 0;
  END IF;

  RETURN jsonb_build_object(
    'valid', true,
    'discount_amount', round(v_discount, 2),
    'coupon_id', v_coupon.id,
    'code', v_coupon.code,
    'description', v_coupon.description,
    'discount_type', v_coupon.discount_type,
    'discount_value', v_coupon.discount_value,
    'max_discount_amount', v_coupon.max_discount_amount,
    'min_purchase_amount', v_coupon.min_purchase_amount
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.validate_coupon_for_customer(text, numeric) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.validate_coupon_for_customer(text, numeric) FROM anon;
GRANT EXECUTE ON FUNCTION public.validate_coupon_for_customer(text, numeric) TO authenticated;

DROP POLICY IF EXISTS "Signed in users can view coupons" ON public.coupons;

CREATE POLICY "Staff can view coupons"
  ON public.coupons
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.app_users au
      WHERE au.auth_user_id = (SELECT auth.uid())
        AND au.is_active = true
    )
  );
