-- Security fix: preview_salary_for_month_v2 exposed all employees' salary
-- data (base_salary, net_salary, order counts) to ANY authenticated user,
-- with no role/permission check. Restrict to admin/HR only.

CREATE OR REPLACE FUNCTION public.preview_salary_for_month_v2(p_month_year TEXT)
RETURNS TABLE (
  employee_id UUID,
  total_orders INTEGER,
  base_salary NUMERIC,
  net_salary NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_start DATE;
  v_end DATE;
  v_emp RECORD;
  v_app RECORD;
  v_orders INTEGER;
  v_earnings NUMERIC;
  v_total_orders INTEGER;
  v_base_salary NUMERIC;
  v_deduction NUMERIC;
  v_net NUMERIC;
  c_cancelled TEXT := _const_order_cancelled();
  c_active TEXT := _const_employee_active();
  c_approved TEXT := _const_approval_approved();
  c_pending TEXT := _const_installment_pending();
  c_deferred TEXT := _const_installment_deferred();
BEGIN
  -- Authorization check: only admin/HR may preview salary data for others.
  IF NOT public.is_admin_or_hr(auth.uid()) THEN
    RAISE EXCEPTION 'Access denied: admin or HR role required'
      USING ERRCODE = '42501';
  END IF;

  v_start := to_date(p_month_year || '-01', 'YYYY-MM-DD');
  v_end := (v_start + INTERVAL '1 month - 1 day')::date;

  FOR v_emp IN
    SELECT e.id FROM employees e
    WHERE e.status = c_active
  LOOP
    v_total_orders := 0;
    v_base_salary := 0;

    FOR v_app IN
      SELECT a.id, a.scheme_id
      FROM apps a
      WHERE a.is_active IS TRUE AND a.scheme_id IS NOT NULL
    LOOP
      SELECT COALESCE(SUM(d.orders_count), 0)::INTEGER INTO v_orders
      FROM daily_orders d
      WHERE d.employee_id = v_emp.id
        AND d.app_id = v_app.id
        AND d.date BETWEEN v_start AND v_end
        AND (d.status IS NULL OR d.status <> c_cancelled);

      v_total_orders := v_total_orders + v_orders;
      v_earnings := calc_tier_salary(v_orders, v_app.scheme_id);
      v_base_salary := v_base_salary + v_earnings;
    END LOOP;

    SELECT COALESCE(SUM(ed.amount), 0) INTO v_deduction
    FROM external_deductions ed
    WHERE ed.employee_id = v_emp.id
      AND ed.apply_month = p_month_year
      AND ed.approval_status = c_approved;

    SELECT COALESCE(SUM(ai.amount), 0) INTO v_deduction
    FROM advances ad
    JOIN advance_installments ai ON ai.advance_id = ad.id
    WHERE ad.employee_id = v_emp.id
      AND ai.month_year = p_month_year
      AND ai.status IN (c_pending, c_deferred);

    v_net := GREATEST(v_base_salary - v_deduction, 0);

    employee_id := v_emp.id;
    total_orders := v_total_orders;
    base_salary := v_base_salary;
    net_salary := v_net;
    RETURN NEXT;
  END LOOP;
END;
$$;
