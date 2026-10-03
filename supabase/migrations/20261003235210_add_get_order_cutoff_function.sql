/*
# Expose the weekly order cut-off to the store

1. New function
- `get_order_cutoff()` returns `{ cutoff_day, cutoff_hour }` from `woocommerce_config`
  (day 0=Sunday … 6=Saturday, hour in Mexico City time). Falls back to Saturday 11:00
  when no config row exists. The website order page uses it so website orders follow the
  same cut-off as WooCommerce orders.
2. Security
- SECURITY DEFINER so customers can read ONLY these two non-sensitive values; the rest of
  `woocommerce_config` (API keys, secrets) stays admin-only.
- EXECUTE granted to anon and authenticated; revoked from PUBLIC first.
*/

CREATE OR REPLACE FUNCTION public.get_order_cutoff()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'cutoff_day', COALESCE((SELECT cutoff_day FROM woocommerce_config ORDER BY created_at NULLS LAST LIMIT 1), 6),
    'cutoff_hour', COALESCE((SELECT cutoff_hour FROM woocommerce_config ORDER BY created_at NULLS LAST LIMIT 1), 11)
  );
$$;

REVOKE ALL ON FUNCTION public.get_order_cutoff() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_order_cutoff() TO anon, authenticated;
