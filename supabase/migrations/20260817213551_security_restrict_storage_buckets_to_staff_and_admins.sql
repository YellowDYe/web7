-- F17: the sat-efirma bucket holds SAT e.firma certificates and private keys.
-- Every authenticated caller, including storefront customers, could read, replace
-- and delete them. Restrict all four operations to admins.
DROP POLICY IF EXISTS "Authenticated users can read e.firma files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload e.firma files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update e.firma files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete e.firma files" ON storage.objects;

CREATE POLICY "admin_select_efirma_objects" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'sat-efirma' AND public.is_admin_user());
CREATE POLICY "admin_insert_efirma_objects" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'sat-efirma' AND public.is_admin_user());
CREATE POLICY "admin_update_efirma_objects" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'sat-efirma' AND public.is_admin_user())
  WITH CHECK (bucket_id = 'sat-efirma' AND public.is_admin_user());
CREATE POLICY "admin_delete_efirma_objects" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'sat-efirma' AND public.is_admin_user());

-- F34: uploads into the site media buckets were open to any signed-in account,
-- so a storefront customer could write and delete site assets. Staff only.
DROP POLICY IF EXISTS "Allow authenticated uploads" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated to delete media files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload media" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update media" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete media" ON storage.objects;
DROP POLICY IF EXISTS "App users can list media files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload website media" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update website media" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete website media" ON storage.objects;
DROP POLICY IF EXISTS "App users can list website media files" ON storage.objects;

CREATE POLICY "staff_select_site_media_objects" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id IN ('media', 'website-media') AND public.is_staff_user());
CREATE POLICY "staff_insert_site_media_objects" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id IN ('media', 'website-media') AND public.is_staff_user());
CREATE POLICY "staff_update_site_media_objects" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id IN ('media', 'website-media') AND public.is_staff_user())
  WITH CHECK (bucket_id IN ('media', 'website-media') AND public.is_staff_user());
CREATE POLICY "staff_delete_site_media_objects" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id IN ('media', 'website-media') AND public.is_staff_user());

-- Server-side upload validation for the public media bucket: images only, 10 MB cap.
UPDATE storage.buckets
SET allowed_mime_types = ARRAY['image/jpeg','image/png','image/gif','image/svg+xml','image/webp','image/avif'],
    file_size_limit = 10485760
WHERE id = 'media';

UPDATE storage.buckets
SET allowed_mime_types = ARRAY['image/jpeg','image/png','image/gif','image/svg+xml','image/webp','image/avif'],
    file_size_limit = 10485760
WHERE id = 'website-media';
