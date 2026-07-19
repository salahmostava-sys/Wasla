-- ============================================================
-- Fix Logo Upload (Avatars bucket restrictions)
-- Allows SVG files and increases limit to 5MB
-- ============================================================

UPDATE storage.buckets
SET 
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml', 'image/gif'],
  file_size_limit = 5242880
WHERE id = 'avatars';
