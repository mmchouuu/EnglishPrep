-- Remove unsafe public write policies.
DROP POLICY IF EXISTS "Upload Access for Speaking Images"
ON storage.objects;

DROP POLICY IF EXISTS "Update Access for Speaking Images"
ON storage.objects;

DROP POLICY IF EXISTS "Delete Access for Speaking Images"
ON storage.objects;

DROP POLICY IF EXISTS "Admin Upload Access for Speaking Images"
ON storage.objects;

DROP POLICY IF EXISTS "Admin Update Access for Speaking Images"
ON storage.objects;

DROP POLICY IF EXISTS "Admin Delete Access for Speaking Images"
ON storage.objects;

-- Speaking images: public read, service-role write only.
CREATE POLICY "Admin Upload Access for Speaking Images"
ON storage.objects
FOR INSERT
TO service_role
WITH CHECK (bucket_id = 'speaking-images');

CREATE POLICY "Admin Update Access for Speaking Images"
ON storage.objects
FOR UPDATE
TO service_role
USING (bucket_id = 'speaking-images')
WITH CHECK (bucket_id = 'speaking-images');

CREATE POLICY "Admin Delete Access for Speaking Images"
ON storage.objects
FOR DELETE
TO service_role
USING (bucket_id = 'speaking-images');

-- Recreate private recording policies.
DROP POLICY IF EXISTS "Owner read access for speaking recordings"
ON storage.objects;

DROP POLICY IF EXISTS "Owner insert access for speaking recordings"
ON storage.objects;

DROP POLICY IF EXISTS "Owner update access for speaking recordings"
ON storage.objects;

DROP POLICY IF EXISTS "Owner delete access for speaking recordings"
ON storage.objects;

CREATE POLICY "Owner read access for speaking recordings"
ON storage.objects
FOR SELECT
TO authenticated
USING (
    bucket_id = 'speaking-recordings'
    AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Owner insert access for speaking recordings"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'speaking-recordings'
    AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Owner update access for speaking recordings"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
    bucket_id = 'speaking-recordings'
    AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
    bucket_id = 'speaking-recordings'
    AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Owner delete access for speaking recordings"
ON storage.objects
FOR DELETE
TO authenticated
USING (
    bucket_id = 'speaking-recordings'
    AND (storage.foldername(name))[1] = auth.uid()::text
);
