BEGIN;

CREATE OR REPLACE FUNCTION public.assign_platform_account(
  p_account_id uuid,
  p_employee_id uuid,
  p_start_date date,
  p_notes text DEFAULT NULL,
  p_created_by uuid DEFAULT NULL
)
RETURNS public.account_assignments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public /* NOSONAR */
AS $$
DECLARE
  v_assignment public.account_assignments;
BEGIN
  IF auth.uid() IS NULL
     OR NOT public.is_active_user(auth.uid())
     OR NOT (
       public.has_role(auth.uid(), 'admin')
       OR public.has_role(auth.uid(), 'hr')
     ) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF p_account_id IS NULL THEN
    RAISE EXCEPTION 'account_id is required';
  END IF;

  IF p_employee_id IS NULL THEN
    RAISE EXCEPTION 'employee_id is required';
  END IF;

  IF p_start_date IS NULL THEN
    RAISE EXCEPTION 'start_date is required';
  END IF;

  PERFORM 1
  FROM public.platform_accounts
  WHERE id = p_account_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'platform account not found';
  END IF;

  PERFORM 1
  FROM public.employees
  WHERE id = p_employee_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'employee not found';
  END IF;

  UPDATE public.account_assignments
  SET end_date = CURRENT_DATE
  WHERE account_id = p_account_id
    AND end_date IS NULL;

  INSERT INTO public.account_assignments (
    account_id,
    employee_id,
    start_date,
    end_date,
    month_year,
    notes,
    created_by
  )
  VALUES (
    p_account_id,
    p_employee_id,
    p_start_date,
    NULL,
    to_char(p_start_date, 'YYYY-MM'),
    NULLIF(btrim(COALESCE(p_notes, '')), ''),
    COALESCE(p_created_by, auth.uid())
  )
  RETURNING * INTO v_assignment;

  UPDATE public.platform_accounts
  SET employee_id = p_employee_id
  WHERE id = p_account_id;

  RETURN v_assignment;
END;
$$;

REVOKE ALL ON FUNCTION public.assign_platform_account(uuid, uuid, date, text, uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.assign_platform_account(uuid, uuid, date, text, uuid) TO authenticated;

COMMIT;
