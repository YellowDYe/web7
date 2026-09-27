-- F18 / F19: the recipe-images bucket allowed any authenticated user to upload,
-- overwrite or delete objects. Match the media buckets: staff only.

DROP POLICY IF EXISTS "Auth users can upload recipe images" ON storage.objects;
DROP POLICY IF EXISTS "Auth users can update recipe images" ON storage.objects;
DROP POLICY IF EXISTS "Auth users can delete recipe images" ON storage.objects;

CREATE POLICY "Staff can upload recipe images"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'recipe-images' AND public.is_staff_user());

CREATE POLICY "Staff can update recipe images"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'recipe-images' AND public.is_staff_user())
  WITH CHECK (bucket_id = 'recipe-images' AND public.is_staff_user());

CREATE POLICY "Staff can delete recipe images"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'recipe-images' AND public.is_staff_user());
