-- Track which invoice a spare-parts purchase came from, and allow attaching
-- a scan/photo of the invoice itself so reports can reference the source
-- document (Ø±Ù‚Ù… Ø§Ù„ÙØ§ØªÙˆØ±Ø© / ØªØ§Ø±ÙŠØ® Ø§Ù„ÙØ§ØªÙˆØ±Ø© / ØµÙˆØ±Ø© Ø§Ù„ÙØ§ØªÙˆØ±Ø©).

ALTER TABLE public.spare_parts ADD COLUMN IF NOT EXISTS invoice_number TEXT;
ALTER TABLE public.spare_parts ADD COLUMN IF NOT EXISTS invoice_date DATE;
ALTER TABLE public.spare_parts ADD COLUMN IF NOT EXISTS invoice_attachment_url TEXT;

COMMENT ON COLUMN public.spare_parts.invoice_number IS 'Ø±Ù‚Ù… Ø§Ù„ÙØ§ØªÙˆØ±Ø© Ø§Ù„ØªÙŠ Ø§Ø´ØªØ±ÙŠØª Ù…Ù†Ù‡Ø§ Ù‡Ø°Ù‡ Ø§Ù„Ù‚Ø·Ø¹Ø© (Ø§Ø®ØªÙŠØ§Ø±ÙŠ)';
COMMENT ON COLUMN public.spare_parts.invoice_date IS 'ØªØ§Ø±ÙŠØ® Ø§Ù„ÙØ§ØªÙˆØ±Ø©';
COMMENT ON COLUMN public.spare_parts.invoice_attachment_url IS 'Ù…Ø³Ø§Ø± ØµÙˆØ±Ø©/Ù…Ù„Ù Ø§Ù„ÙØ§ØªÙˆØ±Ø© Ø¯Ø§Ø®Ù„ bucket invoice-attachments';

-- Storage bucket for uploaded invoice scans (mirrors advance-attachments pattern)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'invoice-attachments',
    'invoice-attachments',
    false, -- Private bucket
    8388608, -- 8 MB limit (matches OCR endpoint cap)
    ARRAY['image/jpeg', 'image/png', 'application/pdf', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
    public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Authenticated users can upload invoice attachments" ON storage.objects;
CREATE POLICY "Authenticated users can upload invoice attachments"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK ( bucket_id = 'invoice-attachments' );

DROP POLICY IF EXISTS "Authenticated users can update invoice attachments" ON storage.objects;
CREATE POLICY "Authenticated users can update invoice attachments"
    ON storage.objects FOR UPDATE
    TO authenticated
    USING ( bucket_id = 'invoice-attachments' );

DROP POLICY IF EXISTS "Authenticated users can delete invoice attachments" ON storage.objects;
CREATE POLICY "Authenticated users can delete invoice attachments"
    ON storage.objects FOR DELETE
    TO authenticated
    USING ( bucket_id = 'invoice-attachments' );

DROP POLICY IF EXISTS "Authenticated users can view invoice attachments" ON storage.objects;
CREATE POLICY "Authenticated users can view invoice attachments"
    ON storage.objects FOR SELECT
    TO authenticated
    USING ( bucket_id = 'invoice-attachments' );
