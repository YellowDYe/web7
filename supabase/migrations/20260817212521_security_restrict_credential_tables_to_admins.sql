/*
  # Security: restrict credential and integration tables to administrators

  These tables hold API keys, provider secrets and webhook destinations, but were
  reachable by the `authenticated` role with `USING (true)` or with a predicate
  that only asked whether the caller had *any* app_users row. Because storefront
  customers are also `authenticated`, that published the credentials.

  Affected: external_api_keys, external_api_webhooks, external_api_webhook_logs,
  facturama_config, manychat_config, delivery_tracking_config, stripe_config,
  paypal_config, shipday_config, account_balances.
*/

-- external_api_keys -------------------------------------------------------
DROP POLICY IF EXISTS "authenticated_select_api_keys" ON public.external_api_keys;
DROP POLICY IF EXISTS "authenticated_insert_api_keys" ON public.external_api_keys;
DROP POLICY IF EXISTS "authenticated_update_api_keys" ON public.external_api_keys;
DROP POLICY IF EXISTS "authenticated_delete_api_keys" ON public.external_api_keys;

CREATE POLICY "admin_select_api_keys" ON public.external_api_keys
  FOR SELECT TO authenticated USING (public.is_admin_user());
CREATE POLICY "admin_insert_api_keys" ON public.external_api_keys
  FOR INSERT TO authenticated WITH CHECK (public.is_admin_user());
CREATE POLICY "admin_update_api_keys" ON public.external_api_keys
  FOR UPDATE TO authenticated USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());
CREATE POLICY "admin_delete_api_keys" ON public.external_api_keys
  FOR DELETE TO authenticated USING (public.is_admin_user());

-- external_api_webhooks ---------------------------------------------------
DROP POLICY IF EXISTS "authenticated_select_webhooks" ON public.external_api_webhooks;
DROP POLICY IF EXISTS "authenticated_insert_webhooks" ON public.external_api_webhooks;
DROP POLICY IF EXISTS "authenticated_update_webhooks" ON public.external_api_webhooks;
DROP POLICY IF EXISTS "authenticated_delete_webhooks" ON public.external_api_webhooks;

CREATE POLICY "admin_select_webhooks" ON public.external_api_webhooks
  FOR SELECT TO authenticated USING (public.is_admin_user());
CREATE POLICY "admin_insert_webhooks" ON public.external_api_webhooks
  FOR INSERT TO authenticated WITH CHECK (public.is_admin_user());
CREATE POLICY "admin_update_webhooks" ON public.external_api_webhooks
  FOR UPDATE TO authenticated USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());
CREATE POLICY "admin_delete_webhooks" ON public.external_api_webhooks
  FOR DELETE TO authenticated USING (public.is_admin_user());

-- external_api_webhook_logs ----------------------------------------------
DROP POLICY IF EXISTS "authenticated_select_webhook_logs" ON public.external_api_webhook_logs;
DROP POLICY IF EXISTS "authenticated_insert_webhook_logs" ON public.external_api_webhook_logs;
DROP POLICY IF EXISTS "authenticated_update_webhook_logs" ON public.external_api_webhook_logs;
DROP POLICY IF EXISTS "authenticated_delete_webhook_logs" ON public.external_api_webhook_logs;

CREATE POLICY "admin_select_webhook_logs" ON public.external_api_webhook_logs
  FOR SELECT TO authenticated USING (public.is_admin_user());
CREATE POLICY "admin_insert_webhook_logs" ON public.external_api_webhook_logs
  FOR INSERT TO authenticated WITH CHECK (public.is_admin_user());
CREATE POLICY "admin_update_webhook_logs" ON public.external_api_webhook_logs
  FOR UPDATE TO authenticated USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());
CREATE POLICY "admin_delete_webhook_logs" ON public.external_api_webhook_logs
  FOR DELETE TO authenticated USING (public.is_admin_user());

-- facturama_config --------------------------------------------------------
DROP POLICY IF EXISTS "Authenticated users can select facturama config" ON public.facturama_config;
DROP POLICY IF EXISTS "Admin users can insert facturama config" ON public.facturama_config;
DROP POLICY IF EXISTS "Admin users can update facturama config" ON public.facturama_config;

CREATE POLICY "admin_select_facturama_config" ON public.facturama_config
  FOR SELECT TO authenticated USING (public.is_admin_user());
CREATE POLICY "admin_insert_facturama_config" ON public.facturama_config
  FOR INSERT TO authenticated WITH CHECK (public.is_admin_user());
CREATE POLICY "admin_update_facturama_config" ON public.facturama_config
  FOR UPDATE TO authenticated USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());
CREATE POLICY "admin_delete_facturama_config" ON public.facturama_config
  FOR DELETE TO authenticated USING (public.is_admin_user());

-- manychat_config ---------------------------------------------------------
DROP POLICY IF EXISTS "select_manychat_config" ON public.manychat_config;
DROP POLICY IF EXISTS "insert_manychat_config" ON public.manychat_config;
DROP POLICY IF EXISTS "update_manychat_config" ON public.manychat_config;
DROP POLICY IF EXISTS "delete_manychat_config" ON public.manychat_config;

CREATE POLICY "admin_select_manychat_config" ON public.manychat_config
  FOR SELECT TO authenticated USING (public.is_admin_user());
CREATE POLICY "admin_insert_manychat_config" ON public.manychat_config
  FOR INSERT TO authenticated WITH CHECK (public.is_admin_user());
CREATE POLICY "admin_update_manychat_config" ON public.manychat_config
  FOR UPDATE TO authenticated USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());
CREATE POLICY "admin_delete_manychat_config" ON public.manychat_config
  FOR DELETE TO authenticated USING (public.is_admin_user());

-- delivery_tracking_config ------------------------------------------------
DROP POLICY IF EXISTS "select_delivery_tracking_config" ON public.delivery_tracking_config;
DROP POLICY IF EXISTS "insert_delivery_tracking_config" ON public.delivery_tracking_config;
DROP POLICY IF EXISTS "update_delivery_tracking_config" ON public.delivery_tracking_config;
DROP POLICY IF EXISTS "delete_delivery_tracking_config" ON public.delivery_tracking_config;

CREATE POLICY "admin_select_delivery_tracking_config" ON public.delivery_tracking_config
  FOR SELECT TO authenticated USING (public.is_admin_user());
CREATE POLICY "admin_insert_delivery_tracking_config" ON public.delivery_tracking_config
  FOR INSERT TO authenticated WITH CHECK (public.is_admin_user());
CREATE POLICY "admin_update_delivery_tracking_config" ON public.delivery_tracking_config
  FOR UPDATE TO authenticated USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());
CREATE POLICY "admin_delete_delivery_tracking_config" ON public.delivery_tracking_config
  FOR DELETE TO authenticated USING (public.is_admin_user());

-- stripe_config -----------------------------------------------------------
DROP POLICY IF EXISTS "Admin users can view stripe config" ON public.stripe_config;
DROP POLICY IF EXISTS "Admin users can insert stripe config" ON public.stripe_config;
DROP POLICY IF EXISTS "Admin users can update stripe config" ON public.stripe_config;
DROP POLICY IF EXISTS "Admin users can delete stripe config" ON public.stripe_config;

CREATE POLICY "admin_select_stripe_config" ON public.stripe_config
  FOR SELECT TO authenticated USING (public.is_admin_user());
CREATE POLICY "admin_insert_stripe_config" ON public.stripe_config
  FOR INSERT TO authenticated WITH CHECK (public.is_admin_user());
CREATE POLICY "admin_update_stripe_config" ON public.stripe_config
  FOR UPDATE TO authenticated USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());
CREATE POLICY "admin_delete_stripe_config" ON public.stripe_config
  FOR DELETE TO authenticated USING (public.is_admin_user());

-- paypal_config -----------------------------------------------------------
DROP POLICY IF EXISTS "App users can view paypal config" ON public.paypal_config;
DROP POLICY IF EXISTS "App users can insert paypal config" ON public.paypal_config;
DROP POLICY IF EXISTS "App users can update paypal config" ON public.paypal_config;
DROP POLICY IF EXISTS "App users can delete paypal config" ON public.paypal_config;

CREATE POLICY "admin_select_paypal_config" ON public.paypal_config
  FOR SELECT TO authenticated USING (public.is_admin_user());
CREATE POLICY "admin_insert_paypal_config" ON public.paypal_config
  FOR INSERT TO authenticated WITH CHECK (public.is_admin_user());
CREATE POLICY "admin_update_paypal_config" ON public.paypal_config
  FOR UPDATE TO authenticated USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());
CREATE POLICY "admin_delete_paypal_config" ON public.paypal_config
  FOR DELETE TO authenticated USING (public.is_admin_user());

-- shipday_config ----------------------------------------------------------
DROP POLICY IF EXISTS "Admin users can view shipday config" ON public.shipday_config;
DROP POLICY IF EXISTS "Admin users can insert shipday config" ON public.shipday_config;
DROP POLICY IF EXISTS "Admin users can update shipday config" ON public.shipday_config;
DROP POLICY IF EXISTS "Admin users can delete shipday config" ON public.shipday_config;

CREATE POLICY "admin_select_shipday_config" ON public.shipday_config
  FOR SELECT TO authenticated USING (public.is_admin_user());
CREATE POLICY "admin_insert_shipday_config" ON public.shipday_config
  FOR INSERT TO authenticated WITH CHECK (public.is_admin_user());
CREATE POLICY "admin_update_shipday_config" ON public.shipday_config
  FOR UPDATE TO authenticated USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());
CREATE POLICY "admin_delete_shipday_config" ON public.shipday_config
  FOR DELETE TO authenticated USING (public.is_admin_user());

-- account_balances --------------------------------------------------------
DROP POLICY IF EXISTS "App users can view balance history" ON public.account_balances;
DROP POLICY IF EXISTS "App users can insert balance records" ON public.account_balances;

CREATE POLICY "admin_select_account_balances" ON public.account_balances
  FOR SELECT TO authenticated USING (public.is_admin_user());
CREATE POLICY "admin_insert_account_balances" ON public.account_balances
  FOR INSERT TO authenticated WITH CHECK (public.is_admin_user());
