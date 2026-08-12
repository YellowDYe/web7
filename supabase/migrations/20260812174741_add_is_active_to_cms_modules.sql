/*
# Add is_active column to cms_modules

1. Modified Tables
   - `cms_modules`
     - Added `is_active` (boolean, NOT NULL, default true)
       - Controls whether a module is rendered on the customer-facing site.
       - Existing modules are all set to active by default, preserving current behavior.

2. Important Notes
   - This is a non-destructive, additive change.
   - All existing modules will default to active (true).
   - The admin panel will provide a toggle to activate/deactivate modules without deleting them.
*/

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'cms_modules'
      AND column_name = 'is_active'
  ) THEN
    ALTER TABLE cms_modules ADD COLUMN is_active boolean NOT NULL DEFAULT true;
  END IF;
END $$;
