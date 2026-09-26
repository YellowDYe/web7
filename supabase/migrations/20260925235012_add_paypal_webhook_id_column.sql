/*
  # F3: store the PayPal webhook id so incoming events can be verified

  PayPal's verify-webhook-signature API requires the webhook id that the event
  was delivered for. The config table had no place to keep it, which is why the
  webhook handler had no way to verify anything.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'paypal_config'
      AND column_name = 'webhook_id'
  ) THEN
    ALTER TABLE public.paypal_config ADD COLUMN webhook_id text;
  END IF;
END $$;
