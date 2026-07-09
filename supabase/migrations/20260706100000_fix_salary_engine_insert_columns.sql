-- ============================================================================
-- CRITICAL FIX: calculate_salary_for_employee_month currently INSERTs into
-- columns that do not exist on public.salary_records:
--   total_orders, total_shift_days, platform_breakdown, status
-- (the real columns are calc_status/calc_source, and there is no
-- total_orders/total_shift_days/platform_breakdown column on the table).
-- Any call to this function (salary-engine "employee" or "month" mode)
-- currently fails outright with: column "total_orders" does not exist.
--
-- It was also missing ON CONFLICT (employee_id, month_year) DO UPDATE, even
-- though that unique constraint exists — so recalculating an already-saved
-- month would additionally fail with a duplicate key error.
--
-- This migration restores the correct, real column list, adds the missing
-- ON CONFLICT upsert, and switches the return shape back to the TABLE shape
-- that calculate_salary_for_month() (still defined from the 2026-04-08
-- migration) expects via the returned query results from the function
-- calculate_salary_for_employee_month -- that call has been silently
-- broken since 2026-06-28 because the function's return type changed to a
-- bare UUID. Restoring the TABLE shape fixes calculate_salary_for_month()
-- too, with zero frontend changes needed (frontend never depended on the
-- RPC return shape for the "employee" mode; the "month" mode UI reads
-- employee_id / base_salary / advance_deduction / external_deduction from
-- the returned rows, all of which are preserved below).
--
-- No business logic (per-app / per-platform calculation) is changed.
-- ============================================================================

BEGIN;

DROP FUNCTION IF EXISTS public.calculate_salary_for_employee_month(UUID, TEXT, TEXT, NUMERIC, TEXT);

CREATE OR REPLACE FUNCTION public.calculate_salary_for_employee_month(
  p_employee_id UUID,
  p_month_year TEXT,
  p_payment_method TEXT DEFAULT _const_payment_cash(),
  p_manual_deduction NUMERIC DEFAULT 0,
  p_manual_deduction_note TEXT DEFAULT NULL
)
RETURNS TABLE (
  employee_id UUID,
  month_year TEXT,
  total_orders INTEGER,
  total_shift_days INTEGER,
  base_salary NUMERIC,
  attendance_deduction NUMERIC,
  external_deduction NUMERIC,
  advance_deduction NUMERIC,
  manual_deduction NUMERIC,
  net_salary NUMERIC,
  calc_status TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_start DATE; v_end DATE;
  v_app RECORD;
  v_app_orders INTEGER; v_app_shift_days INTEGER; v_app_earnings NUMERIC;
  v_total_orders INTEGER := 0; v_total_shift_days INTEGER := 0;
  v_base_salary NUMERIC := 0; v_attendance_deduction NUMERIC := 0;
  v_external_deduction NUMERIC := 0; v_advance_deduction NUMERIC := 0;
  v_net NUMERIC := 0; v_platform_breakdown JSONB := '[]'::jsonb;
  v_calculation_method TEXT;
  v_hybrid_rule RECORD; v_day RECORD; v_hours_worked NUMERIC;
  v_monthly_amount NUMERIC;
  v_fixed_scheme_ids UUID[] := ARRAY[]::UUID[];
  -- Constants
  c_cancelled TEXT := _const_order_cancelled();
  c_approved TEXT := _const_approval_approved();
  c_pending TEXT := _const_installment_pending();
  c_deferred TEXT := _const_installment_deferred();
  c_orders TEXT := _const_work_orders();
  c_shift TEXT := _const_work_shift();
  c_hybrid TEXT := _const_work_hybrid();
  c_days_per_month NUMERIC := _const_days_per_month();
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.employees e WHERE e.id = p_employee_id) THEN
    RAISE EXCEPTION 'Employee not found';
  END IF;

  v_start := to_date(p_month_year || '-01', 'YYYY-MM-DD');
  v_end := (v_start + INTERVAL '1 month - 1 day')::date;

  FOR v_app IN
    SELECT a.id AS app_id, a.name AS app_name, a.work_type,
           s.id AS scheme_id, s.scheme_type, s.monthly_amount
    FROM public.apps a
    LEFT JOIN public.salary_schemes s ON s.id = a.scheme_id
    WHERE a.is_active IS TRUE
  LOOP
    v_app_orders := 0; v_app_shift_days := 0; v_app_earnings := 0;
    v_calculation_method := c_orders;

    IF v_app.work_type = c_orders OR v_app.work_type IS NULL THEN
      SELECT COALESCE(SUM(d.orders_count), 0)::INTEGER INTO v_app_orders
      FROM public.daily_orders d
      WHERE d.employee_id = p_employee_id AND d.app_id = v_app.app_id
        AND d.date BETWEEN v_start AND v_end
        AND (d.status IS NULL OR d.status <> c_cancelled);

      v_total_orders := v_total_orders + v_app_orders;

      SELECT earnings, calculation_method, fixed_scheme_ids
      INTO v_app_earnings, v_calculation_method, v_fixed_scheme_ids
      FROM public.calculate_order_salary_for_app(
        v_app.app_id, v_app_orders, 0, v_fixed_scheme_ids, true
      );

    ELSIF v_app.work_type = c_shift THEN
      v_calculation_method := _const_calc_method_shift_fixed();
      IF EXISTS(
        SELECT 1 FROM public.employee_apps ea
        WHERE ea.employee_id = p_employee_id AND ea.app_id = v_app.app_id
      ) THEN
        SELECT COUNT(*)::INTEGER INTO v_app_shift_days
        FROM public.daily_shifts ds
        WHERE ds.employee_id = p_employee_id AND ds.app_id = v_app.app_id
          AND ds.date BETWEEN v_start AND v_end AND ds.hours_worked > 0;

        v_total_shift_days := v_total_shift_days + v_app_shift_days;

        v_monthly_amount := COALESCE(v_app.monthly_amount, 0);
        IF v_monthly_amount > 0 AND v_app_shift_days > 0 THEN
          v_app_earnings := ROUND((v_monthly_amount / c_days_per_month) * v_app_shift_days);
        ELSE
          v_app_earnings := 0;
        END IF;
      END IF;

    ELSIF v_app.work_type = c_hybrid THEN
      v_calculation_method := _const_calc_method_mixed();
      SELECT * INTO v_hybrid_rule FROM public.app_hybrid_rules WHERE app_id = v_app.app_id;

      IF v_hybrid_rule IS NULL THEN
        v_calculation_method := _const_calc_method_orders_fallback();
        SELECT COALESCE(SUM(d.orders_count), 0)::INTEGER INTO v_app_orders
        FROM public.daily_orders d
        WHERE d.employee_id = p_employee_id AND d.app_id = v_app.app_id
          AND d.date BETWEEN v_start AND v_end
          AND (d.status IS NULL OR d.status <> c_cancelled);
        v_total_orders := v_total_orders + v_app_orders;

        SELECT earnings INTO v_app_earnings
        FROM public.calculate_order_salary_for_app(
          v_app.app_id, v_app_orders, 0, v_fixed_scheme_ids, true
        );
      ELSE
        FOR v_day IN SELECT generate_series(v_start, v_end, '1 day'::interval)::date AS day_date LOOP
          SELECT hours_worked INTO v_hours_worked
          FROM public.daily_shifts
          WHERE employee_id = p_employee_id AND app_id = v_app.app_id AND date = v_day.day_date;

          IF v_hours_worked IS NOT NULL AND v_hours_worked > 0 THEN
            v_app_earnings := v_app_earnings + v_hybrid_rule.shift_rate;
            v_app_shift_days := v_app_shift_days + 1;
          ELSIF v_hybrid_rule.fallback_to_orders THEN
            SELECT COALESCE(SUM(d.orders_count), 0)::INTEGER INTO v_app_orders
            FROM public.daily_orders d
            WHERE d.employee_id = p_employee_id AND d.app_id = v_app.app_id AND d.date = v_day.day_date
              AND (d.status IS NULL OR d.status <> c_cancelled);
            v_total_orders := v_total_orders + v_app_orders;
            IF v_app_orders > 0 THEN
              v_app_earnings := v_app_earnings + (
                SELECT earnings FROM public.calculate_order_salary_for_app(
                  v_app.app_id, v_app_orders, 0, v_fixed_scheme_ids, false
                )
              );
            END IF;
          END IF;
        END LOOP;
        v_total_shift_days := v_total_shift_days + v_app_shift_days;
      END IF;
    END IF;

    v_base_salary := v_base_salary + v_app_earnings;

    IF v_app_orders > 0 OR v_app_shift_days > 0 OR v_app_earnings > 0 THEN
      v_platform_breakdown := v_platform_breakdown || jsonb_build_object(
        'app_id', v_app.app_id, 'app_name', v_app.app_name,
        'work_type', COALESCE(v_app.work_type, c_orders),
        'calculation_method', v_calculation_method,
        'orders_count', v_app_orders, 'shift_days', v_app_shift_days,
        'earnings', ROUND(v_app_earnings)
      );
    END IF;
  END LOOP;

  SELECT COALESCE(SUM(ed.amount), 0) INTO v_external_deduction
  FROM public.external_deductions ed
  WHERE ed.employee_id = p_employee_id AND ed.apply_month = p_month_year
    AND ed.approval_status = c_approved;

  SELECT COALESCE(SUM(ai.amount), 0) INTO v_advance_deduction
  FROM public.advances ad JOIN public.advance_installments ai ON ai.advance_id = ad.id
  WHERE ad.employee_id = p_employee_id AND ai.month_year = p_month_year
    AND ai.status IN (c_pending, c_deferred);

  v_net := GREATEST(
    v_base_salary - v_attendance_deduction - v_external_deduction - v_advance_deduction
      - COALESCE(p_manual_deduction, 0),
    0
  );

  -- FIX: only real public.salary_records columns are written here.
  -- (total_orders / total_shift_days / platform_breakdown / "status" do NOT
  -- exist on this table and previously made every call fail outright.)
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
    is_approved,
    sheet_snapshot
  )
  VALUES (
    p_employee_id,
    p_month_year,
    v_base_salary,
    v_attendance_deduction,
    v_external_deduction,
    v_advance_deduction,
    COALESCE(p_manual_deduction, 0),
    p_manual_deduction_note,
    v_net,
    COALESCE(NULLIF(TRIM(p_payment_method), ''), _const_payment_cash()),
    _const_calc_calculated(),
    'engine_v6_platform_breakdown',
    false,
    NULL
  )
  -- FIX: was missing this upsert clause, even though the table has a
  -- UNIQUE(employee_id, month_year) constraint — recalculating an
  -- already-saved month previously failed with a duplicate key error.
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
    public.salary_records.employee_id,
    public.salary_records.month_year,
    v_total_orders,
    v_total_shift_days,
    public.salary_records.base_salary,
    public.salary_records.attendance_deduction,
    public.salary_records.external_deduction,
    public.salary_records.advance_deduction,
    public.salary_records.manual_deduction,
    public.salary_records.net_salary,
    public.salary_records.calc_status
  INTO
    employee_id,
    month_year,
    total_orders,
    total_shift_days,
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

REVOKE EXECUTE ON FUNCTION public.calculate_salary_for_employee_month(UUID, TEXT, TEXT, NUMERIC, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.calculate_salary_for_employee_month(UUID, TEXT, TEXT, NUMERIC, TEXT) TO service_role;

COMMENT ON FUNCTION public.calculate_salary_for_employee_month IS
  'v6: fixes INSERT column list (total_orders/total_shift_days/platform_breakdown/status did not exist on salary_records — every call failed), restores ON CONFLICT upsert, and restores the TABLE return shape expected by calculate_salary_for_month().';

COMMIT;
