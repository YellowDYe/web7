/*
# Seed the /login CMS page with a CustomerLogin module

1. New Data
   - Inserts a `cms_pages` row at path `/login`, titled "Iniciar Sesión".
   - Inserts a `cms_modules` row of type `CustomerLogin` linked to that page.
   - Updates the page's module_order to include the shared MainMenu,
     the new CustomerLogin module, and the shared Footer.

2. Important Notes
   - Uses ON CONFLICT to be idempotent: re-running this migration is safe.
   - The MainMenu (`966389a1-...`) and Footer (`c309f23f-...`) module IDs are reused
     from the existing /signup and /checkout pages so the login page has the same
     navigation and footer.
   - module_order is jsonb (a JSON array of UUID strings).
*/

-- 1. Create the /login CMS page (module_order filled in step 3)
INSERT INTO cms_pages (id, path, title, module_order, published)
VALUES (
  'a1b2c3d4-e5f6-7890-abcd-ef0987654321',
  '/login',
  'Iniciar Sesión',
  '[]'::jsonb,
  true
)
ON CONFLICT (id) DO NOTHING;

-- 2. Create the CustomerLogin module linked to the login page
INSERT INTO cms_modules (id, page_id, type, content, name, is_custom, is_active)
VALUES (
  'b1a2c3d4-e5f6-7890-abcd-ef1234567890',
  'a1b2c3d4-e5f6-7890-abcd-ef0987654321',
  'CustomerLogin',
  '{"isSystemModule": true}'::jsonb,
  NULL,
  false,
  true
)
ON CONFLICT (id) DO NOTHING;

-- 3. Set the module_order: MainMenu + CustomerLogin + Footer
UPDATE cms_pages
SET module_order = '["966389a1-be42-4512-a8fc-7b224827f24d","b1a2c3d4-e5f6-7890-abcd-ef1234567890","c309f23f-3b23-4cce-9f5f-87a04fe8f121"]'::jsonb
WHERE id = 'a1b2c3d4-e5f6-7890-abcd-ef0987654321'
  AND module_order = '[]'::jsonb;
