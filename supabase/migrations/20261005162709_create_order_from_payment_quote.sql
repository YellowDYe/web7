/*
# Server-side order creation from a Mercado Pago checkout

Plain English: until now an order was only saved if the customer's browser came back
after paying. Cash payments (OXXO, bank transfer) are paid later at a store, so the
customer never comes back and no order was saved. This routine lets the payment
notifier build the order itself from the cart the customer saved at checkout.

1. New function `create_order_from_payment_quote(p_quote_id, p_payment_id, p_paid_amount, p_paid, p_cash)`
   - Locks the checkout quote row so two callers can never create two orders.
   - Returns the existing order when the quote or payment is already linked.
   - Re-prices everything from the database (meal plans, plan discounts, delivery,
     coupons, proteins); the saved cart only says *what* was ordered, never the price.
   - Refuses to create an order when the amount paid does not cover the re-priced cart.
   - Creates the order, its weekly meal rows, the invoice, protein rows and coupon usage.
   - Status: `completed` when paid, `pending_cash_payment` for unpaid cash tickets,
     otherwise `pending`.
2. New unique index on `orders.mp_payment_id` so one payment can only ever be attached
   to one order.

Security:
- SECURITY DEFINER, callable only by the service role (the payment notifier).
  Execute is revoked from public, anon and authenticated.
*/

CREATE UNIQUE INDEX IF NOT EXISTS orders_mp_payment_id_unique
  ON public.orders (mp_payment_id) WHERE mp_payment_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.create_order_from_payment_quote(
  p_quote_id uuid,
  p_payment_id text,
  p_paid_amount numeric,
  p_paid boolean,
  p_cash boolean
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
DECLARE
  q record;
  c record;
  r record;
  s jsonb;
  v_cart jsonb;
  v_raw_items jsonb;
  v_items jsonb;
  v_proteins jsonb;
  v_price_items jsonb;
  v_price_proteins jsonb;
  v_existing uuid;
  v_has_meals boolean;
  v_delivery_id text;
  v_delivery_name text := '';
  v_delivery_price numeric := 0;
  v_coupon_code text;
  v_coupon_id bigint;
  v_items_total numeric := 0;
  v_plan_discount numeric := 0;
  v_protein_total numeric := 0;
  v_meal_total numeric := 0;
  v_full_total numeric := 0;
  v_coupon_discount numeric := 0;
  v_order_total numeric;
  v_order_uuid uuid;
  v_order_number text;
  v_status text;
  v_invoice_number text;
  v_summary text;
  v_pct numeric;
  v_zero jsonb;
  v_row jsonb;
  v_cols text;
BEGIN
  SELECT * INTO q FROM payment_quotes WHERE id = p_quote_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'quote_not_found'; END IF;

  IF q.order_id IS NOT NULL THEN
    RETURN jsonb_build_object('order_id', q.order_id, 'created', false);
  END IF;

  SELECT id INTO v_existing FROM orders WHERE mp_payment_id = p_payment_id LIMIT 1;
  IF v_existing IS NOT NULL THEN
    UPDATE payment_quotes SET order_id = v_existing, payment_id = p_payment_id WHERE id = p_quote_id;
    RETURN jsonb_build_object('order_id', v_existing, 'created', false);
  END IF;

  s := q.order_snapshot;
  IF s IS NULL THEN RAISE EXCEPTION 'snapshot_missing'; END IF;
  v_cart := COALESCE(s->'cart', '{}'::jsonb);
  v_raw_items := CASE WHEN jsonb_typeof(v_cart->'orderItems') = 'array' THEN v_cart->'orderItems' ELSE '[]'::jsonb END;

  SELECT * INTO c FROM customers
  WHERE customer_id = s->'customer'->>'customer_id' AND auth_user_id = q.auth_user_id
  LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'customer_not_found'; END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'week_id', w.week_id,
      'week_name', w.week_name,
      'week_date', w.week_date,
      'meal_plans_id', mp.meal_plans_id,
      'plan_name', mp.meal_plans_name,
      'price', mp.meal_plans_price,
      'family_member_id', NULLIF(left(COALESCE(i->>'family_member_id', ''), 64), ''),
      'col', d.prefix || '_' || m.key || '_qty',
      'billable', m.billable,
      'quantity', z.qty)), '[]'::jsonb)
  INTO v_items
  FROM jsonb_array_elements(v_raw_items) i
  CROSS JOIN LATERAL (SELECT CASE WHEN (i->>'quantity') ~ '^\d{1,4}$' THEN (i->>'quantity')::int ELSE 0 END AS qty) z
  JOIN meal_plans mp ON mp.meal_plans_id = i->>'meal_plans_id'
  JOIN weeks w ON w.week_id = COALESCE(NULLIF(i->>'week_id', ''),
                   (SELECT w2.week_id FROM weeks w2 WHERE w2.week_name = i->>'week_name' LIMIT 1))
  JOIN (VALUES ('Lunes','lunes'),('Martes','martes'),('Miércoles','miercoles'),('Jueves','jueves'),('Viernes','viernes'))
       AS d(label, prefix) ON d.label = i->>'day_of_week'
  JOIN (VALUES ('Desayuno','desayuno',true),('Colación AM','colacion_am',false),('Comida','comida',true),
               ('Colación PM','colacion_pm',false),('Cena','cena',true))
       AS m(label, key, billable) ON m.label = i->>'meal_type'
  WHERE z.qty > 0;

  IF jsonb_array_length(v_items) <> jsonb_array_length(v_raw_items) THEN
    RAISE EXCEPTION 'invalid_items';
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'id', pp.id, 'protein_plans_id', pp.protein_plans_id, 'name', pp.protein_plans_name,
      'price', pp.protein_plans_price, 'quantity', z.qty)), '[]'::jsonb),
    COALESCE(SUM(pp.protein_plans_price * z.qty), 0)
  INTO v_proteins, v_protein_total
  FROM jsonb_array_elements(CASE WHEN jsonb_typeof(s->'proteinCart') = 'array' THEN s->'proteinCart' ELSE '[]'::jsonb END) p
  CROSS JOIN LATERAL (SELECT CASE WHEN (p->>'quantity') ~ '^\d{1,3}$' THEN (p->>'quantity')::int ELSE 0 END AS qty) z
  JOIN protein_plans pp ON pp.id::text = p->'proteinPlan'->>'id'
  WHERE z.qty > 0;

  v_has_meals := jsonb_array_length(v_items) > 0;
  IF NOT v_has_meals AND jsonb_array_length(v_proteins) = 0 THEN
    RAISE EXCEPTION 'empty_cart';
  END IF;

  FOR r IN
    SELECT x->>'meal_plans_id' AS pid, (x->>'price')::numeric AS price, SUM((x->>'quantity')::int) AS qty
    FROM jsonb_array_elements(v_items) x
    WHERE (x->>'billable')::boolean
    GROUP BY 1, 2
  LOOP
    v_items_total := v_items_total + r.price * r.qty;
    SELECT dc.discount_percentage INTO v_pct FROM discounts dc
    WHERE dc.meal_plans_id = r.pid AND dc.threshold <= r.qty
      AND (dc.expires_at IS NULL OR dc.expires_at > now())
    ORDER BY dc.threshold DESC LIMIT 1;
    IF v_pct IS NOT NULL THEN
      v_plan_discount := v_plan_discount + r.price * r.qty * (v_pct / 100.0);
    END IF;
    v_pct := NULL;
  END LOOP;

  IF v_has_meals THEN
    SELECT delivery_options_id, delivery_options_name, COALESCE(delivery_options_price, 0)
    INTO v_delivery_id, v_delivery_name, v_delivery_price
    FROM delivery_options
    WHERE delivery_options_id = v_cart->'selectedDeliveryOption'->>'delivery_options_id';
    IF v_delivery_id IS NULL THEN RAISE EXCEPTION 'invalid_delivery_option'; END IF;
  END IF;

  v_coupon_code := NULLIF(btrim(COALESCE(v_cart->'appliedCoupon'->>'code', '')), '');

  SELECT COALESCE(jsonb_agg(jsonb_build_object('meal_plans_id', x->>'meal_plans_id', 'quantity', (x->>'quantity')::int)), '[]'::jsonb)
  INTO v_price_items
  FROM jsonb_array_elements(v_items) x WHERE (x->>'billable')::boolean;

  SELECT COALESCE(jsonb_agg(jsonb_build_object('protein_plans_id', x->>'protein_plans_id', 'quantity', (x->>'quantity')::int)), '[]'::jsonb)
  INTO v_price_proteins
  FROM jsonb_array_elements(v_proteins) x;

  v_full_total := price_customer_cart(v_price_items, v_price_proteins, v_delivery_id, v_coupon_code);
  IF COALESCE(p_paid_amount, 0) + 1 < v_full_total THEN
    RAISE EXCEPTION 'amount_mismatch: paid %, expected %', p_paid_amount, v_full_total;
  END IF;

  IF v_has_meals THEN
    v_meal_total := price_customer_cart(v_price_items, '[]'::jsonb, v_delivery_id, v_coupon_code);
    v_coupon_discount := GREATEST(0, (v_items_total - v_plan_discount + v_delivery_price) - v_meal_total / 1.16);
    v_order_total := round(v_meal_total);
  ELSE
    v_order_total := round(v_protein_total * 1.16, 2);
  END IF;

  v_status := CASE WHEN p_paid THEN 'completed' WHEN p_cash THEN 'pending_cash_payment' ELSE 'pending' END;
  v_order_number := generate_next_order_id();

  INSERT INTO orders (
    order_id, customer_id, order_customer_name, order_customer_email, order_status, order_notes,
    order_total_price, order_invoice_number, payment_provider, mp_payment_id,
    stripe_payment_status, stripe_paid_at, is_test
  ) VALUES (
    v_order_number, c.customer_id,
    btrim(COALESCE(c.customer_name, '') || ' ' || COALESCE(c.customer_lastname, '')),
    COALESCE(c.customer_email, ''), v_status,
    CASE WHEN v_has_meals THEN NULLIF(left(COALESCE(v_cart->>'orderNotes', ''), 2000), '') ELSE 'Pedido de proteinas' END,
    v_order_total, '', 'mercadopago', p_payment_id,
    CASE WHEN p_paid THEN 'succeeded' ELSE 'pending' END,
    CASE WHEN p_paid THEN now() ELSE NULL END,
    COALESCE(c.is_test, false)
  ) RETURNING id INTO v_order_uuid;

  IF v_has_meals THEN
    SELECT jsonb_object_agg(d.prefix || '_' || m.key || '_qty', 0) INTO v_zero
    FROM (VALUES ('lunes'),('martes'),('miercoles'),('jueves'),('viernes')) d(prefix)
    CROSS JOIN (VALUES ('desayuno'),('colacion_am'),('comida'),('colacion_pm'),('cena')) m(key);

    FOR r IN
      SELECT g.week_id, g.week_date, g.pid, g.fm, jsonb_object_agg(g.col, g.qty) AS qtys
      FROM (
        SELECT x->>'week_id' AS week_id, x->>'week_date' AS week_date, x->>'meal_plans_id' AS pid,
               x->>'family_member_id' AS fm, x->>'col' AS col, SUM((x->>'quantity')::int) AS qty
        FROM jsonb_array_elements(v_items) x
        GROUP BY 1, 2, 3, 4, 5
      ) g
      GROUP BY g.week_id, g.week_date, g.pid, g.fm
    LOOP
      v_row := v_zero || r.qtys || jsonb_build_object(
        'order_week_id', 'OW-' || gen_random_uuid()::text,
        'order_id', v_order_number,
        'week_id', r.week_id,
        'meal_plan_id', r.pid,
        'delivery_date', r.week_date,
        'family_member_id', r.fm);
      SELECT string_agg(quote_ident(k), ', ') INTO v_cols FROM jsonb_object_keys(v_row) k;
      EXECUTE format('INSERT INTO order_weeks (%1$s) SELECT %1$s FROM jsonb_populate_record(NULL::order_weeks, $1)', v_cols)
      USING v_row;
    END LOOP;

    SELECT string_agg(format('%s, %s, %s platillo%s', g.week_name, g.plan_name, g.qty, CASE WHEN g.qty = 1 THEN '' ELSE 's' END),
                      ' / ' ORDER BY g.week_date, g.plan_name)
    INTO v_summary
    FROM (
      SELECT x->>'week_name' AS week_name, x->>'week_date' AS week_date, x->>'plan_name' AS plan_name,
             SUM((x->>'quantity')::int) AS qty
      FROM jsonb_array_elements(v_items) x
      WHERE (x->>'billable')::boolean
      GROUP BY 1, 2, 3
    ) g;
    v_summary := COALESCE(v_summary, '') || ' / Envío: ' || COALESCE(v_delivery_name, '');

    v_invoice_number := generate_next_invoice_number();
    INSERT INTO invoices (
      invoice_id, invoice_number, order_id, customer_name, customer_email, invoice_summary,
      subtotal, delivery_option_price, tax_amount, delivery_tax_amount, total_amount,
      plan_discount_amount, coupon_discount_amount, custom_discount_amount, invoice_status, payment_date
    ) VALUES (
      'INV-' || floor(extract(epoch FROM clock_timestamp()) * 1000)::bigint || '-' || floor(random() * 1000)::int,
      v_invoice_number, v_order_number,
      btrim(COALESCE(c.customer_name, '') || ' ' || COALESCE(c.customer_lastname, '')),
      COALESCE(c.customer_email, ''), v_summary,
      round(v_items_total), round(v_delivery_price),
      round((v_items_total - v_plan_discount) * 0.16), round(v_delivery_price * 0.16),
      round((v_items_total - v_plan_discount) * 1.16 + v_delivery_price * 1.16 - v_coupon_discount),
      round(v_plan_discount), round(v_coupon_discount), 0,
      CASE WHEN p_paid THEN 'paid' ELSE 'draft' END,
      CASE WHEN p_paid THEN now() ELSE NULL END
    );
    UPDATE orders SET order_invoice_number = v_invoice_number WHERE id = v_order_uuid;
  END IF;

  INSERT INTO protein_orders (order_id, customer_id, protein_plan_id, protein_plan_name, quantity, unit_price, total_price, status)
  SELECT v_order_uuid, c.customer_id, (x->>'id')::uuid, x->>'name', (x->>'quantity')::int,
         (x->>'price')::numeric, round((x->>'price')::numeric * (x->>'quantity')::int, 2), 'pending'
  FROM jsonb_array_elements(v_proteins) x;

  IF v_coupon_code IS NOT NULL AND v_coupon_discount >= 0.01 THEN
    SELECT id INTO v_coupon_id FROM coupons WHERE lower(btrim(code)) = lower(v_coupon_code) LIMIT 1;
    IF v_coupon_id IS NOT NULL THEN
      INSERT INTO coupon_usage (coupon_id, customer_id, order_id, discount_applied)
      VALUES (v_coupon_id, c.id, v_order_uuid, round(v_coupon_discount, 2));
    END IF;
  END IF;

  UPDATE payment_quotes
  SET order_id = v_order_uuid, payment_id = p_payment_id, status = 'claimed', claimed_at = COALESCE(claimed_at, now())
  WHERE id = p_quote_id;

  RETURN jsonb_build_object(
    'order_id', v_order_uuid,
    'order_number', v_order_number,
    'created', true,
    'customer_name', btrim(COALESCE(c.customer_name, '') || ' ' || COALESCE(c.customer_lastname, '')),
    'customer_email', c.customer_email,
    'delivery_option_name', v_delivery_name,
    'subtotal', round(v_items_total + v_protein_total, 2),
    'plan_discount', round(v_plan_discount, 2),
    'delivery_price', v_delivery_price,
    'coupon_discount', round(v_coupon_discount, 2),
    'tax_amount', round(v_full_total - v_full_total / 1.16, 2),
    'final_total', v_full_total
  );
END;
$fn$;

REVOKE ALL ON FUNCTION public.create_order_from_payment_quote(uuid, text, numeric, boolean, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_order_from_payment_quote(uuid, text, numeric, boolean, boolean) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_order_from_payment_quote(uuid, text, numeric, boolean, boolean) TO service_role;
