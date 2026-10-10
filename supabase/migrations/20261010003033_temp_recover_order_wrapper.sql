/*
# Recover Franco Guerrero's order from payment quote aab7b99d

## Context
Payment 182363666579 ($1,377) was approved by Mercado Pago but no order was created
because the create_order_from_payment_quote function was broken (reverted invoice
status fix). The function is now fixed. This migration creates a temporary SECURITY
DEFINER wrapper to call it from execute_sql, then drops the wrapper.

## Security
- Temporary function, dropped immediately after use.
- Only callable while it exists; revoked from all roles.
*/

CREATE OR REPLACE FUNCTION public._temp_recover_order(p_quote uuid, p_payment text, p_amount numeric)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  RETURN create_order_from_payment_quote(p_quote, p_payment, p_amount, true, false);
END;
$$;

REVOKE ALL ON FUNCTION public._temp_recover_order(uuid, text, numeric) FROM PUBLIC, anon, authenticated;
