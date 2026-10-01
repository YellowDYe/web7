/*
# Add customer cart tracking + new-signup notification flag

## Why
The admin dashboard needs an "abandoned carts" number, but shopping carts were
previously stored only in each visitor's browser. This migration adds a small
server-side record of each signed-in customer's cart so abandoned carts can be
counted. It also adds a flag so admins can turn the new-customer sign-up email
on or off alongside the existing order notifications.

## 1. New Tables
- `customer_carts`
  - `auth_user_id` (uuid, primary key) - the signed-in customer the cart belongs to
  - `item_count` (integer, not null, default 0) - how many items are currently in the cart
  - `updated_at` (timestamptz, default now()) - last time the cart changed
  - `created_at` (timestamptz, default now()) - when the cart record was first created
  A cart counts as "abandoned" when `item_count > 0` and it has not changed for
  several hours. When a customer completes checkout their cart empties to 0, so
  it no longer counts.

## 2. Security
- Enable RLS on `customer_carts`.
- Each authenticated customer can read, insert and update ONLY their own cart row
  (`auth.uid() = auth_user_id`).
- Staff (any active non-customer app_users role, via `public.is_staff_user()`)
  can read every cart row so the dashboard can count abandoned carts.
- No delete policy is defined (rows are simply emptied, not removed).

## 3. Modified Data
- Updates the existing `notification_settings` row in `cms_settings` to include
  `notify_on_signup` (default true) if it is not already present, so the setting
  controls whether admins receive an email when a new customer signs up.
*/

CREATE TABLE IF NOT EXISTS customer_carts (
  auth_user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  item_count integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_customer_carts_abandoned
  ON customer_carts (updated_at)
  WHERE item_count > 0;

ALTER TABLE customer_carts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_cart" ON customer_carts;
CREATE POLICY "select_own_cart" ON customer_carts FOR SELECT
  TO authenticated
  USING (auth.uid() = auth_user_id OR public.is_staff_user());

DROP POLICY IF EXISTS "insert_own_cart" ON customer_carts;
CREATE POLICY "insert_own_cart" ON customer_carts FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = auth_user_id);

DROP POLICY IF EXISTS "update_own_cart" ON customer_carts;
CREATE POLICY "update_own_cart" ON customer_carts FOR UPDATE
  TO authenticated
  USING (auth.uid() = auth_user_id)
  WITH CHECK (auth.uid() = auth_user_id);

UPDATE cms_settings
SET value = jsonb_set(
  value,
  '{notify_on_signup}',
  'true'::jsonb,
  true
)
WHERE setting_name = 'notification_settings'
  AND NOT (value ? 'notify_on_signup');