/*
  # Server-side payment quotes

  1. New Tables
    - `payment_quotes`
      - `id` (uuid, primary key)
      - `auth_user_id` (uuid) - the signed-in user the quote was issued to
      - `amount` (numeric) - the amount quoted to the payment provider
      - `currency` (text, default MXN)
      - `preference_id` (text, nullable) - Mercado Pago preference the quote backs
      - `status` (text, default 'pending') - pending | claimed
      - `payment_id` (text, nullable) - provider payment that claimed the quote
      - `created_at` / `claimed_at` (timestamptz)
      - `expires_at` (timestamptz, default now() + 2 hours)

  2. Security
    - RLS enabled with no policies: only the service role (edge functions) may
      read or write quotes. The browser must never be able to see or alter the
      amount that will be charged.

  3. Notes
    - The capture step reads the amount from this table instead of trusting the
      amount posted by the browser, and claims the row atomically so a single
      quote cannot be charged twice.
*/

CREATE TABLE IF NOT EXISTS public.payment_quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id uuid,
  amount numeric NOT NULL,
  currency text NOT NULL DEFAULT 'MXN',
  preference_id text,
  status text NOT NULL DEFAULT 'pending',
  payment_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  claimed_at timestamptz,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '2 hours')
);

ALTER TABLE public.payment_quotes ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS payment_quotes_auth_user_id_idx
  ON public.payment_quotes (auth_user_id);

REVOKE ALL ON public.payment_quotes FROM anon, authenticated;
