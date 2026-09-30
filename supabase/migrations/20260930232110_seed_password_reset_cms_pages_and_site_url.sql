/*
  # Seed /forgot-password and /reset-password CMS pages + public site_url

  1. New Data
     - Two cms_pages at /forgot-password and /reset-password.
     - Two cms_modules (CustomerForgotPassword, CustomerResetPassword) linked to them.
     - Each page ordered as shared MainMenu + its section module + shared Footer.
     - A site_url cms_settings row holding the public storefront address so
       customer password-reset emails always link to the public site.

  2. Notes
     - Reuses shared MainMenu (966389a1-...) and Footer (c309f23f-...) module IDs.
     - Non-custom modules require a non-null page_id, so pages are inserted first.
     - Idempotent via ON CONFLICT DO NOTHING and guarded module_order updates.
*/

INSERT INTO cms_pages (id, path, title, module_order, published)
VALUES
  ('d1a2b3c4-e5f6-7890-abcd-ef3333333333', '/forgot-password', 'Recuperar Contraseña', '[]'::jsonb, true),
  ('d2a3b4c5-e6f7-7890-abcd-ef4444444444', '/reset-password', 'Restablecer Contraseña', '[]'::jsonb, true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO cms_modules (id, page_id, type, content, name, is_custom, is_active)
VALUES
  ('c1f2a3b4-d5e6-7890-abcd-ef1111111111', 'd1a2b3c4-e5f6-7890-abcd-ef3333333333', 'CustomerForgotPassword', '{"isSystemModule": true}'::jsonb, NULL, false, true),
  ('c2f3a4b5-d6e7-7890-abcd-ef2222222222', 'd2a3b4c5-e6f7-7890-abcd-ef4444444444', 'CustomerResetPassword', '{"isSystemModule": true}'::jsonb, NULL, false, true)
ON CONFLICT (id) DO NOTHING;

UPDATE cms_pages
SET module_order = '["966389a1-be42-4512-a8fc-7b224827f24d","c1f2a3b4-d5e6-7890-abcd-ef1111111111","c309f23f-3b23-4cce-9f5f-87a04fe8f121"]'::jsonb
WHERE id = 'd1a2b3c4-e5f6-7890-abcd-ef3333333333' AND module_order = '[]'::jsonb;

UPDATE cms_pages
SET module_order = '["966389a1-be42-4512-a8fc-7b224827f24d","c2f3a4b5-d6e7-7890-abcd-ef2222222222","c309f23f-3b23-4cce-9f5f-87a04fe8f121"]'::jsonb
WHERE id = 'd2a3b4c5-e6f7-7890-abcd-ef4444444444' AND module_order = '[]'::jsonb;

INSERT INTO cms_settings (setting_name, value)
VALUES ('site_url', '"https://holadieta.mx"'::jsonb)
ON CONFLICT (setting_name) DO NOTHING;
