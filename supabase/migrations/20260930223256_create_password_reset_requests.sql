/*
# Password reset request throttling

1. New Tables
  - `password_reset_requests`
    - `id` (uuid, primary key)
    - `email` (text, not null) — the address that requested a reset
    - `created_at` (timestamptz, default now()) — when the request was made

2. Purpose
  - Records each branded password-reset email request so the edge function can
    limit how many reset emails a single address can trigger within a short
    window. This prevents mailbox flooding and token farming.

3. Security
  - Enable RLS on `password_reset_requests`.
  - No anon/authenticated policies are added, so the table is fully locked to
    normal clients. The edge function reads and writes it with the service role,
    which bypasses RLS. This keeps request history invisible to the public.
*/

CREATE TABLE IF NOT EXISTS password_reset_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_password_reset_requests_email_created
  ON password_reset_requests (email, created_at);

ALTER TABLE password_reset_requests ENABLE ROW LEVEL SECURITY;
