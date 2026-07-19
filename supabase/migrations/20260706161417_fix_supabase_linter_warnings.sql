-- Fix permissive RLS policies on vehicle_documents
DROP POLICY IF EXISTS "Authenticated users can insert vehicle documents" ON public.vehicle_documents;
CREATE POLICY "Authenticated users can insert vehicle documents"
    ON public.vehicle_documents FOR INSERT
    TO authenticated
    WITH CHECK ( auth.uid() IS NOT NULL );

DROP POLICY IF EXISTS "Authenticated users can update vehicle documents" ON public.vehicle_documents;
CREATE POLICY "Authenticated users can update vehicle documents"
    ON public.vehicle_documents FOR UPDATE
    TO authenticated
    USING ( auth.uid() = created_by OR public.is_internal_user() );

DROP POLICY IF EXISTS "Authenticated users can delete vehicle documents" ON public.vehicle_documents;
CREATE POLICY "Authenticated users can delete vehicle documents"
    ON public.vehicle_documents FOR DELETE
    TO authenticated
    USING ( auth.uid() = created_by OR public.is_internal_user() );
