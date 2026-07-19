-- Restore salary RPC functions after single-org company_id removal.
-- These definitions remove company_id dependencies that were left from tenant-era functions.

DROP FUNCTION IF EXISTS public.calculate_salary_for_employee_month(uuid, text, text, numeric, text) CASCADE;
DROP FUNCTION IF EXISTS public.calculate_salary_for_month(text, text) CASCADE;
DROP FUNCTION IF EXISTS public.preview_salary_for_month(text) CASCADE;

CREATE OR REPLACE FUNCTION public.calculate_salary_for_employee_month(
  p_employee_id uuid,
  p_month_year text,
  p_payment_method text DEFAULT 'cash'::text,
  p_manual_deduction numeric DEFAULT 0,
  p_manual_deduction_note text DEFAULT NULL::text
)
RETURNS TABLE(
  employee_id uuid,
  month_year text,
  total_orders integer,
  attendance_days integer,
  base_salary numeric,
  attendance_deduction numeric,
  external_deduction numeric,
  advance_deduction numeric,
  manual_deduction numeric,
  net_salary numeric,
  calc_status text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public' /* NOSONAR */
AS $$
DECLARE
  v_start DATE;
  v_end DATE;
  v_orders INTEGER := 0;
  v_attendance_days INTEGER := 0;
  v_base_salary NUMERIC := 0;
  v_attendance_deduction NUMERIC := 0;
  v_external_deduction NUMERIC := 0;
  v_advance_deduction NUMERIC := 0;
  v_manual_deduction NUMERIC := GREATEST(COALESCE(p_manual_deduction, 0), 0);
  v_net NUMERIC := 0;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.employees e
    WHERE e.id = p_employee_id
  ) THEN
    RAISE EXCEPTION 'Employee not found';
  END IF;

  v_start := to_date(p_month_year || '-01', 'YYYY-MM-DD');
  v_end := (v_start + INTERVAL '1 month - 1 day')::date;

  SELECT COALESCE(SUM(d.orders_count), 0)::INTEGER
    INTO v_orders
  FROM public.daily_orders d
  WHERE d.employee_id = p_employee_id
    AND d.date BETWEEN v_start AND v_end
    AND (d.status IS NULL OR d.status <> 'cancelled');

  SELECT COALESCE(COUNT(*), 0)::INTEGER
    INTO v_attendance_days
  FROM public.attendance a
  WHERE a.employee_id = p_employee_id
    AND a.date BETWEEN v_start AND v_end
    AND a.status IN ('present', 'late');

  v_base_salary := public.calc_tier_salary(v_orders);

  SELECT COALESCE(SUM(ed.amount), 0)
    INTO v_external_deduction
  FROM public.external_deductions ed
  WHERE ed.employee_id = p_employee_id
    AND ed.apply_month = p_month_year
    AND ed.approval_status = 'approved';

  SELECT COALESCE(SUM(ai.amount), 0)
    INTO v_advance_deduction
  FROM public.advances ad
  JOIN public.advance_installments ai ON ai.advance_id = ad.id
  WHERE ad.employee_id = p_employee_id
    AND ai.month_year = p_month_year
    AND ai.status IN ('pending', 'deferred');

  v_attendance_deduction := 0;
  v_net := GREATEST(
    v_base_salary
    - v_attendance_deduction
    - v_external_deduction
    - v_advance_deduction
    - v_manual_deduction,
    0
  );

  INSERT INTO public.salary_records (
    employee_id,
    month_year,
    base_salary,
    attendance_deduction,
    external_deduction,
    advance_deduction,
    manual_deduction,
    manual_deduction_note,
    net_salary,
    payment_method,
    calc_status,
    calc_source,
    is_approved
  )
  VALUES (
    p_employee_id,
    p_month_year,
    v_base_salary,
    v_attendance_deduction,
    v_external_deduction,
    v_advance_deduction,
    v_manual_deduction,
    p_manual_deduction_note,
    v_net,
    COALESCE(NULLIF(TRIM(p_payment_method), ''), 'cash'),
    'calculated',
    'engine_v3',
    false
  )
  ON CONFLICT (employee_id, month_year)
  DO UPDATE SET
    base_salary = EXCLUDED.base_salary,
    attendance_deduction = EXCLUDED.attendance_deduction,
    external_deduction = EXCLUDED.external_deduction,
    advance_deduction = EXCLUDED.advance_deduction,
    manual_deduction = EXCLUDED.manual_deduction,
    manual_deduction_note = EXCLUDED.manual_deduction_note,
    net_salary = EXCLUDED.net_salary,
    payment_method = EXCLUDED.payment_method,
    calc_status = EXCLUDED.calc_status,
    calc_source = EXCLUDED.calc_source,
    updated_at = now()
  RETURNING
    salary_records.employee_id,
    salary_records.month_year,
    v_orders,
    v_attendance_days,
    salary_records.base_salary,
    salary_records.attendance_deduction,
    salary_records.external_deduction,
    salary_records.advance_deduction,
    salary_records.manual_deduction,
    salary_records.net_salary,
    salary_records.calc_status
  INTO
    employee_id,
    month_year,
    total_orders,
    attendance_days,
    base_salary,
    attendance_deduction,
    external_deduction,
    advance_deduction,
    manual_deduction,
    net_salary,
    calc_status;

  RETURN NEXT;
END;
$$;

CREATE OR REPLACE FUNCTION public.calculate_salary_for_month(
  p_month_year text,
  p_payment_method text DEFAULT 'cash'::text
)
RETURNS TABLE(
  employee_id uuid,
  month_year text,
  total_orders integer,
  attendance_days integer,
  base_salary numeric,
  attendance_deduction numeric,
  external_deduction numeric,
  advance_deduction numeric,
  manual_deduction numeric,
  net_salary numeric,
  calc_status text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public' /* NOSONAR */
AS $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT e.id
    FROM public.employees e
    WHERE e.status = 'active'
    ORDER BY e.name
  LOOP
    RETURN QUERY
    SELECT *
    FROM public.calculate_salary_for_employee_month(
      r.id,
      p_month_year,
      p_payment_method,
      0,
      NULL
    );
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.preview_salary_for_month(
  p_month_year text
)
RETURNS TABLE(
  employee_id uuid,
  total_orders integer,
  base_salary numeric,
  external_deduction numeric,
  advance_deduction numeric,
  net_salary numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public' /* NOSONAR */
AS $$
DECLARE
  v_start DATE;
  v_end DATE;
BEGIN
  v_start := to_date(p_month_year || '-01', 'YYYY-MM-DD');
  v_end := (v_start + INTERVAL '1 month - 1 day')::date;

  RETURN QUERY
  WITH active_emp AS (
    SELECT e.id
    FROM public.employees e
    WHERE e.status = 'active'
  ),
  orders_cte AS (
    SELECT
      d.employee_id,
      COALESCE(SUM(d.orders_count), 0)::INTEGER AS total_orders
    FROM public.daily_orders d
    JOIN active_emp ae ON ae.id = d.employee_id
    WHERE d.date BETWEEN v_start AND v_end
      AND (d.status IS NULL OR d.status <> 'cancelled')
    GROUP BY d.employee_id
  ),
  ext_cte AS (
    SELECT
      ed.employee_id,
      COALESCE(SUM(ed.amount), 0)::NUMERIC AS external_deduction
    FROM public.external_deductions ed
    JOIN active_emp ae ON ae.id = ed.employee_id
    WHERE ed.apply_month = p_month_year
      AND ed.approval_status = 'approved'
    GROUP BY ed.employee_id
  ),
  adv_cte AS (
    SELECT
      ad.employee_id,
      COALESCE(SUM(ai.amount), 0)::NUMERIC AS advance_deduction
    FROM public.advances ad
    JOIN public.advance_installments ai ON ai.advance_id = ad.id
    JOIN active_emp ae ON ae.id = ad.employee_id
    WHERE ai.month_year = p_month_year
      AND ai.status IN ('pending', 'deferred')
    GROUP BY ad.employee_id
  )
  SELECT
    ae.id AS employee_id,
    COALESCE(o.total_orders, 0) AS total_orders,
    public.calc_tier_salary(COALESCE(o.total_orders, 0)) AS base_salary,
    COALESCE(ex.external_deduction, 0) AS external_deduction,
    COALESCE(ad.advance_deduction, 0) AS advance_deduction,
    GREATEST(
      public.calc_tier_salary(COALESCE(o.total_orders, 0))
      - COALESCE(ex.external_deduction, 0)
      - COALESCE(ad.advance_deduction, 0),
      0
    ) AS net_salary
  FROM active_emp ae
  LEFT JOIN orders_cte o ON o.employee_id = ae.id
  LEFT JOIN ext_cte ex ON ex.employee_id = ae.id
  LEFT JOIN adv_cte ad ON ad.employee_id = ae.id
  ORDER BY ae.id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.preview_salary_for_month(TEXT) FROM anon;
REVOKE EXECUTE ON FUNCTION public.preview_salary_for_month(TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.preview_salary_for_month(TEXT) TO service_role;

REVOKE EXECUTE ON FUNCTION public.calculate_salary_for_month(TEXT, TEXT) FROM anon;
REVOKE EXECUTE ON FUNCTION public.calculate_salary_for_month(TEXT, TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.calculate_salary_for_month(TEXT, TEXT) TO service_role;
