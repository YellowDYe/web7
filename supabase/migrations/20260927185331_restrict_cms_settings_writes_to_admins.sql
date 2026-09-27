-- F1: cms_settings drives script injection on every storefront page.
-- Only active ADMIN/MANAGER accounts may write it.

DROP POLICY IF EXISTS "App users can insert cms settings" ON cms_settings;
DROP POLICY IF EXISTS "App users can update cms settings" ON cms_settings;
DROP POLICY IF EXISTS "App users can delete cms settings" ON cms_settings;

CREATE POLICY "Admins can insert cms settings"
  ON cms_settings FOR INSERT TO authenticated
  WITH CHECK (is_admin_user());

CREATE POLICY "Admins can update cms settings"
  ON cms_settings FOR UPDATE TO authenticated
  USING (is_admin_user())
  WITH CHECK (is_admin_user());

CREATE POLICY "Admins can delete cms settings"
  ON cms_settings FOR DELETE TO authenticated
  USING (is_admin_user());
