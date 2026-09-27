-- F2: cms_pages / cms_modules / cms_media writes were open to any row in
-- app_users, including deactivated accounts. Require active staff.

DROP POLICY IF EXISTS "App users can insert cms pages" ON cms_pages;
DROP POLICY IF EXISTS "App users can update cms pages" ON cms_pages;
DROP POLICY IF EXISTS "App users can delete cms pages" ON cms_pages;

CREATE POLICY "Staff can insert cms pages" ON cms_pages FOR INSERT TO authenticated WITH CHECK (is_staff_user());
CREATE POLICY "Staff can update cms pages" ON cms_pages FOR UPDATE TO authenticated USING (is_staff_user()) WITH CHECK (is_staff_user());
CREATE POLICY "Staff can delete cms pages" ON cms_pages FOR DELETE TO authenticated USING (is_staff_user());

DROP POLICY IF EXISTS "App users can insert cms modules" ON cms_modules;
DROP POLICY IF EXISTS "App users can update cms modules" ON cms_modules;
DROP POLICY IF EXISTS "App users can delete cms modules" ON cms_modules;

CREATE POLICY "Staff can insert cms modules" ON cms_modules FOR INSERT TO authenticated WITH CHECK (is_staff_user());
CREATE POLICY "Staff can update cms modules" ON cms_modules FOR UPDATE TO authenticated USING (is_staff_user()) WITH CHECK (is_staff_user());
CREATE POLICY "Staff can delete cms modules" ON cms_modules FOR DELETE TO authenticated USING (is_staff_user());

DROP POLICY IF EXISTS "App users can insert cms media" ON cms_media;
DROP POLICY IF EXISTS "App users can update cms media" ON cms_media;
DROP POLICY IF EXISTS "App users can delete cms media" ON cms_media;

CREATE POLICY "Staff can insert cms media" ON cms_media FOR INSERT TO authenticated WITH CHECK (is_staff_user());
CREATE POLICY "Staff can update cms media" ON cms_media FOR UPDATE TO authenticated USING (is_staff_user()) WITH CHECK (is_staff_user());
CREATE POLICY "Staff can delete cms media" ON cms_media FOR DELETE TO authenticated USING (is_staff_user());
