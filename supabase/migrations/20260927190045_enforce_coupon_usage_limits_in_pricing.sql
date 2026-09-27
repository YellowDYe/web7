-- F20: price_customer_cart applied a coupon without consulting the usage
-- limits recorded on the coupon, so a single-use code could be reused. Since
-- this function now decides the amount actually charged, enforce the limits
-- here.

CREATE OR REPLACE FUNCTION public.price_customer_cart(
  p_items jsonb DEFAULT '[]'::jsonb,
  p_protein_items jsonb DEFAULT '[]'::jsonb,
  p_delivery_option_id text DEFAULT NULL::text,
  p_coupon_code text DEFAULT NULL::text
)
RETURNS numeric
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_items_total numeric := 0;
  v_protein_total numeric := 0;
  v_plan_discount numeric := 0;
  v_delivery_price numeric := 0;
  v_coupon_discount numeric := 0;
  v_subtotal numeric := 0;
  v_total numeric := 0;
  r record;
  v_pct numeric;
  v_coupon record;
  v_customer_uuid uuid;
  v_total_uses integer := 0;
  v_customer_uses integer := 0;
  v_coupon_allowed boolean := true;
BEGIN
  -- Meal plan items, priced from meal_plans.
  FOR r IN
    SELECT mp.meal_plans_id AS plan_id,
           SUM(GREATEST((i->>'quantity')::int, 0)) AS qty,
           mp.meal_plans_price AS price
    FROM jsonb_array_elements(COALESCE(p_items, '[]'::jsonb)) AS i
    JOIN public.meal_plans mp ON mp.meal_plans_id = (i->>'meal_plans_id')
    GROUP BY mp.meal_plans_id, mp.meal_plans_price
  LOOP
    v_items_total := v_items_total + (r.price * r.qty);

    SELECT d.discount_percentage INTO v_pct
    FROM public.discounts d
    WHERE d.meal_plans_id = r.plan_id
      AND d.threshold <= r.qty
      AND (d.expires_at IS NULL OR d.expires_at > now())
    ORDER BY d.threshold DESC
    LIMIT 1;

    IF v_pct IS NOT NULL THEN
      v_plan_discount := v_plan_discount + ((r.price * r.qty) * (v_pct / 100.0));
    END IF;
    v_pct := NULL;
  END LOOP;

  -- Protein items, priced from protein_plans.
  SELECT COALESCE(SUM(pp.protein_plans_price * GREATEST((i->>'quantity')::int, 0)), 0)
  INTO v_protein_total
  FROM jsonb_array_elements(COALESCE(p_protein_items, '[]'::jsonb)) AS i
  JOIN public.protein_plans pp ON pp.protein_plans_id = (i->>'protein_plans_id');

  -- Delivery, priced from delivery_options.
  IF p_delivery_option_id IS NOT NULL THEN
    SELECT COALESCE(delivery_options_price, 0) INTO v_delivery_price
    FROM public.delivery_options
    WHERE delivery_options_id = p_delivery_option_id;
    v_delivery_price := COALESCE(v_delivery_price, 0);
  END IF;

  v_subtotal := v_items_total + v_protein_total - v_plan_discount + v_delivery_price;

  -- Coupon: the largest discount the stored coupon actually permits.
  IF p_coupon_code IS NOT NULL AND btrim(p_coupon_code) <> '' THEN
    SELECT * INTO v_coupon
    FROM public.coupons c
    WHERE lower(btrim(c.code)) = lower(btrim(p_coupon_code))
      AND COALESCE(c.is_active, false) = true
      AND (c.valid_from IS NULL OR c.valid_from <= now())
      AND (c.valid_until IS NULL OR c.valid_until >= now())
    LIMIT 1;

    IF v_coupon.code IS NOT NULL THEN
      -- Global redemption limit.
      IF v_coupon.usage_limit IS NOT NULL THEN
        SELECT COUNT(*) INTO v_total_uses
        FROM public.coupon_usage cu
        WHERE cu.coupon_id = v_coupon.id;

        IF v_total_uses >= v_coupon.usage_limit THEN
          v_coupon_allowed := false;
        END IF;
      END IF;

      -- Per-customer redemption limit, scoped to the calling account.
      IF v_coupon_allowed AND v_coupon.usage_limit_per_customer IS NOT NULL THEN
        SELECT c.id INTO v_customer_uuid
        FROM public.customers c
        WHERE c.auth_user_id = auth.uid()
        LIMIT 1;

        IF v_customer_uuid IS NOT NULL THEN
          SELECT COUNT(*) INTO v_customer_uses
          FROM public.coupon_usage cu
          WHERE cu.coupon_id = v_coupon.id
            AND cu.customer_id = v_customer_uuid;

          IF v_customer_uses >= v_coupon.usage_limit_per_customer THEN
            v_coupon_allowed := false;
          END IF;
        END IF;
      END IF;
    END IF;

    IF v_coupon.code IS NOT NULL
       AND v_coupon_allowed
       AND (v_coupon.min_purchase_amount IS NULL OR v_subtotal >= v_coupon.min_purchase_amount) THEN
      IF v_coupon.discount_type = 'percentage' THEN
        v_coupon_discount := v_subtotal * (COALESCE(v_coupon.discount_value, 0) / 100.0);
      ELSE
        v_coupon_discount := COALESCE(v_coupon.discount_value, 0);
      END IF;

      IF v_coupon.max_discount_amount IS NOT NULL THEN
        v_coupon_discount := LEAST(v_coupon_discount, v_coupon.max_discount_amount);
      END IF;
    END IF;
  END IF;

  v_coupon_discount := LEAST(GREATEST(v_coupon_discount, 0), v_subtotal);
  v_subtotal := v_subtotal - v_coupon_discount;
  v_total := v_subtotal * 1.16;

  RETURN round(GREATEST(v_total, 0), 2);
END;
$function$;
