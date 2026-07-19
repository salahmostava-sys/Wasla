BEGIN;

CREATE TABLE IF NOT EXISTS public.commercial_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT commercial_records_name_not_blank CHECK (btrim(name) <> '')
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_commercial_records_name_ci
  ON public.commercial_records (lower(btrim(name)));

ALTER TABLE public.commercial_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS commercial_records_select_policy ON public.commercial_records;
DROP POLICY IF EXISTS commercial_records_insert_policy ON public.commercial_records;
DROP POLICY IF EXISTS commercial_records_update_policy ON public.commercial_records;
DROP POLICY IF EXISTS commercial_records_delete_policy ON public.commercial_records;

CREATE POLICY commercial_records_select_policy
ON public.commercial_records
FOR SELECT
TO authenticated
USING (
  public.is_internal_user()
  AND public.has_permission('employees', 'view') /* NOSONAR */
);

CREATE POLICY commercial_records_insert_policy
ON public.commercial_records
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_internal_user()
  AND public.has_permission('employees', 'write') /* NOSONAR */
);

CREATE POLICY commercial_records_update_policy
ON public.commercial_records
FOR UPDATE
TO authenticated
USING (
  public.is_internal_user()
  AND public.has_permission('employees', 'write') /* NOSONAR */
)
WITH CHECK (
  public.is_internal_user()
  AND public.has_permission('employees', 'write') /* NOSONAR */
);

CREATE POLICY commercial_records_delete_policy
ON public.commercial_records
FOR DELETE
TO authenticated
USING (
  public.is_internal_user()
  AND public.has_permission('employees', 'write') /* NOSONAR */
);

DROP TRIGGER IF EXISTS trg_commercial_records_updated_at ON public.commercial_records;
CREATE TRIGGER trg_commercial_records_updated_at
  BEFORE UPDATE ON public.commercial_records
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS iqama_photo_url text;

CREATE INDEX IF NOT EXISTS idx_employees_commercial_record
  ON public.employees (commercial_record)
  WHERE commercial_record IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_employees_residency_expiry
  ON public.employees (residency_expiry)
  WHERE residency_expiry IS NOT NULL;

INSERT INTO public.commercial_records (name)
SELECT DISTINCT btrim(commercial_record)
FROM public.employees
WHERE NULLIF(btrim(commercial_record), '') IS NOT NULL
ON CONFLICT DO NOTHING;

UPDATE storage.buckets
SET allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
WHERE id = 'employee-documents'; /* NOSONAR */

DROP POLICY IF EXISTS "HR/admin/finance can view employee documents" ON storage.objects;
DROP POLICY IF EXISTS "HR/admin can upload employee documents" ON storage.objects;
DROP POLICY IF EXISTS "HR/admin can update employee documents" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete employee documents" ON storage.objects;

DROP POLICY IF EXISTS "Employees docs: view by employee permissions" ON storage.objects;
CREATE POLICY "Employees docs: view by employee permissions"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'employee-documents' /* NOSONAR */
    AND public.is_internal_user()
    AND public.has_permission('employees', 'view') /* NOSONAR */
  );

DROP POLICY IF EXISTS "Employees docs: upload by employee permissions" ON storage.objects;
CREATE POLICY "Employees docs: upload by employee permissions"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'employee-documents' /* NOSONAR */
    AND public.is_internal_user()
    AND public.has_permission('employees', 'write') /* NOSONAR */
  );

DROP POLICY IF EXISTS "Employees docs: update by employee permissions" ON storage.objects;
CREATE POLICY "Employees docs: update by employee permissions"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'employee-documents' /* NOSONAR */
    AND public.is_internal_user()
    AND public.has_permission('employees', 'write') /* NOSONAR */
  )
  WITH CHECK (
    bucket_id = 'employee-documents' /* NOSONAR */
    AND public.is_internal_user()
    AND public.has_permission('employees', 'write') /* NOSONAR */
  );

DROP POLICY IF EXISTS "Employees docs: delete by employee permissions" ON storage.objects;
CREATE POLICY "Employees docs: delete by employee permissions"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'employee-documents' /* NOSONAR */
    AND public.is_internal_user()
    AND public.has_permission('employees', 'write') /* NOSONAR */
  );

CREATE OR REPLACE FUNCTION public.has_permission(p_resource text, p_action text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public /* NOSONAR */
AS $$
DECLARE
  v_allowed boolean := FALSE;
BEGIN
  IF NOT public.is_internal_user() THEN
    RETURN false;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.user_roles ur
    LEFT JOIN public.roles r ON r.id = ur.role_id
    WHERE ur.user_id = auth.uid()
      AND (
        ur.role = 'admin'
        OR lower(COALESCE(r.title, '')) = 'admin'
      )
  ) THEN
    RETURN true;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    LEFT JOIN public.roles r ON r.id = ur.role_id
    WHERE ur.user_id = auth.uid()
      AND COALESCE(r.is_active, true) IS TRUE
      AND (
        COALESCE((r.permissions -> '*' ->> p_action)::boolean, false)
        OR COALESCE((r.permissions -> p_resource ->> p_action)::boolean, false)
      )
  ) INTO v_allowed;

  IF v_allowed THEN
    RETURN true;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND (
        (ur.role = 'hr' AND (
          (p_resource = 'employees'  AND p_action IN ('view','write')) OR
          (p_resource = 'orders'     AND p_action IN ('view','write')) OR
          (p_resource = 'attendance' AND p_action IN ('view','write')) OR /* NOSONAR */
          (p_resource = 'salary'     AND p_action = 'view') OR /* NOSONAR */
          (p_resource = 'roles'      AND p_action = 'view') OR
          (p_resource = 'financials' AND p_action = 'view') /* NOSONAR */
        ))
        OR
        (ur.role = 'finance' AND (
          (p_resource = 'employees'  AND p_action = 'view') OR
          (p_resource = 'orders'     AND p_action = 'view') OR
          (p_resource = 'attendance' AND p_action = 'view') OR /* NOSONAR */
          (p_resource = 'salary'     AND p_action IN ('view','write','approve')) OR /* NOSONAR */
          (p_resource = 'financials' AND p_action IN ('view','write','approve')) OR /* NOSONAR */
          (p_resource = 'roles'      AND p_action = 'view')
        ))
        OR
        (ur.role = 'operations' AND (
          (p_resource = 'employees'  AND p_action IN ('view','write')) OR
          (p_resource = 'orders'     AND p_action IN ('view','write')) OR
          (p_resource = 'attendance' AND p_action IN ('view','write')) OR /* NOSONAR */
          (p_resource = 'salary'     AND p_action = 'view') OR /* NOSONAR */
          (p_resource = 'financials' AND p_action = 'view') /* NOSONAR */
        ))
        OR
        (ur.role = 'viewer' AND p_action = 'view')
      )
  ) THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

REVOKE ALL ON FUNCTION public.has_permission(text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.has_permission(text, text) TO authenticated;

COMMIT;
