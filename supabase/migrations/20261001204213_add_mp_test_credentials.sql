/*
# Separate Mercado Pago test credentials

1. Modified Tables
- `mercado_pago_config`
  - `test_access_token` (text, nullable): Access Token from the Mercado Pago "credenciales de prueba".
  - `test_public_key` (text, nullable): Public Key from the same test credentials.

2. Behavior
- When `test_mode` is on and both test keys are saved, staff sessions at checkout use the test keys
  (so Mercado Pago test cards work); customers keep paying with the live keys.

3. Security
- No policy changes; the table is already restricted to admins and the payment server function.
*/

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'mercado_pago_config' AND column_name = 'test_access_token') THEN
    ALTER TABLE mercado_pago_config ADD COLUMN test_access_token text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'mercado_pago_config' AND column_name = 'test_public_key') THEN
    ALTER TABLE mercado_pago_config ADD COLUMN test_public_key text;
  END IF;
END $$;
