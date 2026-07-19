-- Allow attaching documents (license, insurance, registration, authorization,
-- or any other scan/photo) to a vehicle, so users can see and download every
-- document related to a given vehicle from its details view.

CREATE TABLE IF NOT EXISTS public.vehicle_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vehicle_id UUID NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
    doc_type TEXT NOT NULL DEFAULT 'other',
    title TEXT,
    file_path TEXT NOT NULL,
    file_name TEXT NOT NULL,
    notes TEXT,
    created_by UUID REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.vehicle_documents IS 'Ù…Ø³ØªÙ†Ø¯Ø§Øª Ø§Ù„Ù…Ø±ÙƒØ¨Ø© (Ø±Ø®ØµØ©ØŒ ØªØ£Ù…ÙŠÙ†ØŒ ØªØ³Ø¬ÙŠÙ„ØŒ ØªÙÙˆÙŠØ¶ØŒ Ø£Ùˆ Ø£ÙŠ Ù…Ù„Ù Ø¢Ø®Ø±)';
COMMENT ON COLUMN public.vehicle_documents.doc_type IS 'license | insurance | registration | authorization | other';
COMMENT ON COLUMN public.vehicle_documents.file_path IS 'Ù…Ø³Ø§Ø± Ø§Ù„Ù…Ù„Ù Ø¯Ø§Ø®Ù„ bucket vehicle-documents';

CREATE INDEX IF NOT EXISTS idx_vehicle_documents_vehicle_id ON public.vehicle_documents(vehicle_id);

ALTER TABLE public.vehicle_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view vehicle documents" ON public.vehicle_documents;
CREATE POLICY "Authenticated users can view vehicle documents"
    ON public.vehicle_documents FOR SELECT
    TO authenticated
    USING ( true );

DROP POLICY IF EXISTS "Authenticated users can insert vehicle documents" ON public.vehicle_documents;
CREATE POLICY "Authenticated users can insert vehicle documents"
    ON public.vehicle_documents FOR INSERT
    TO authenticated
    WITH CHECK ( true );

DROP POLICY IF EXISTS "Authenticated users can update vehicle documents" ON public.vehicle_documents;
CREATE POLICY "Authenticated users can update vehicle documents"
    ON public.vehicle_documents FOR UPDATE
    TO authenticated
    USING ( true );

DROP POLICY IF EXISTS "Authenticated users can delete vehicle documents" ON public.vehicle_documents;
CREATE POLICY "Authenticated users can delete vehicle documents"
    ON public.vehicle_documents FOR DELETE
    TO authenticated
    USING ( true );

-- Storage bucket for uploaded vehicle documents (mirrors invoice-attachments pattern)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'vehicle-documents',
    'vehicle-documents',
    false, -- Private bucket
    8388608, -- 8 MB limit
    ARRAY['image/jpeg', 'image/png', 'application/pdf', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
    public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Authenticated users can upload vehicle documents" ON storage.objects;
CREATE POLICY "Authenticated users can upload vehicle documents"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK ( bucket_id = 'vehicle-documents' );

DROP POLICY IF EXISTS "Authenticated users can update their vehicle documents" ON storage.objects;
CREATE POLICY "Authenticated users can update their vehicle documents"
    ON storage.objects FOR UPDATE
    TO authenticated
    USING ( bucket_id = 'vehicle-documents' );

DROP POLICY IF EXISTS "Authenticated users can delete vehicle documents" ON storage.objects;
CREATE POLICY "Authenticated users can delete vehicle documents"
    ON storage.objects FOR DELETE
    TO authenticated
    USING ( bucket_id = 'vehicle-documents' );

DROP POLICY IF EXISTS "Authenticated users can view vehicle document files" ON storage.objects;
CREATE POLICY "Authenticated users can view vehicle document files"
    ON storage.objects FOR SELECT
    TO authenticated
    USING ( bucket_id = 'vehicle-documents' );
