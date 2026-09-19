-- ============================================================================
-- Migration: Create Supabase Storage Bucket & RLS Policies for Speaking Images
-- File: supabase/migrations/20260913000000_speaking_images_storage.sql
-- Created at: 2026-09-13
-- Scope: Speaking Practice Image Storage ('speaking-images')
-- ============================================================================

-- 1. Create Public Storage Bucket for Speaking Images if not exists
INSERT INTO storage.buckets (id, name, public, avif_autodetection, file_size_limit, allowed_mime_types)
VALUES (
  'speaking-images',
  'speaking-images',
  true,
  false,
  10485760, -- 10MB limit
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  allowed_mime_types = ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

-- 2. Row Level Security Policies for storage.objects in 'speaking-images' bucket

-- 2.1. Public Read Policy: Allow anyone (anon, authenticated, service_role) to SELECT images
DROP POLICY IF EXISTS "Public Read Access for Speaking Images" ON storage.objects;
CREATE POLICY "Public Read Access for Speaking Images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'speaking-images');

-- 2.2. Public Upload / Insert Access: Allow client/scripts with valid anon or service_role key to upload
DROP POLICY IF EXISTS "Upload Access for Speaking Images" ON storage.objects;
CREATE POLICY "Upload Access for Speaking Images"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'speaking-images');

-- 2.3. Public Update Access: Allow client/scripts to update existing image objects
DROP POLICY IF EXISTS "Update Access for Speaking Images" ON storage.objects;
CREATE POLICY "Update Access for Speaking Images"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'speaking-images');

-- 2.4. Delete Access: Allow deletion of objects in speaking-images bucket
DROP POLICY IF EXISTS "Delete Access for Speaking Images" ON storage.objects;
CREATE POLICY "Delete Access for Speaking Images"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'speaking-images');
