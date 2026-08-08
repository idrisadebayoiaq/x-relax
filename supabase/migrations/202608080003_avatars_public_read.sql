-- Avatars must be publicly readable after upload
UPDATE storage.buckets SET public = true WHERE id = 'avatars';

DROP POLICY IF EXISTS "Public read avatars" ON storage.objects;
CREATE POLICY "Public read avatars"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');
