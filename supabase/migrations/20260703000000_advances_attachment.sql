-- Add attachment_url column to advances table
ALTER TABLE public.advances ADD COLUMN IF NOT EXISTS attachment_url TEXT;

-- Create the advance-attachments bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'advance-attachments',
    'advance-attachments',
    false, -- Private bucket
    5242880, -- 5 MB limit
    ARRAY['image/jpeg', 'image/png', 'application/pdf', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
    public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- RLS policies for advance-attachments bucket
DROP POLICY IF EXISTS "Authenticated users can upload advance attachments" ON storage.objects;
CREATE POLICY "Authenticated users can upload advance attachments"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK ( bucket_id = 'advance-attachments' );

DROP POLICY IF EXISTS "Authenticated users can update their advance attachments" ON storage.objects;
CREATE POLICY "Authenticated users can update their advance attachments"
    ON storage.objects FOR UPDATE
    TO authenticated
    USING ( bucket_id = 'advance-attachments' );

DROP POLICY IF EXISTS "Authenticated users can delete advance attachments" ON storage.objects;
CREATE POLICY "Authenticated users can delete advance attachments"
    ON storage.objects FOR DELETE
    TO authenticated
    USING ( bucket_id = 'advance-attachments' );

DROP POLICY IF EXISTS "Authenticated users can view advance attachments" ON storage.objects;
CREATE POLICY "Authenticated users can view advance attachments"
    ON storage.objects FOR SELECT
    TO authenticated
    USING ( bucket_id = 'advance-attachments' );
