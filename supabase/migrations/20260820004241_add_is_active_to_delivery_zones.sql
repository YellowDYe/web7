/*
# Add is_active column to delivery_zones

1. Modified Tables
  - `delivery_zones`
    - Added `is_active` (boolean, NOT NULL, DEFAULT true)

2. Why
  - The application code filters delivery zones with `.eq('is_active', true)` but the column
    did not exist, causing every query to fail with a "column does not exist" error.
  - This broke the postal code dropdown for all users (admin, customer, anonymous) with
    "Error al cargar codigos postales".
  - Defaulting to `true` means all existing zones remain visible immediately.

3. Important Notes
  - No data loss: this is an additive change only.
  - An index is added on `is_active` to support the filtered query efficiently.
*/

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'delivery_zones'
      AND column_name = 'is_active'
  ) THEN
    ALTER TABLE delivery_zones ADD COLUMN is_active boolean NOT NULL DEFAULT true;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_delivery_zones_is_active ON delivery_zones (is_active);
