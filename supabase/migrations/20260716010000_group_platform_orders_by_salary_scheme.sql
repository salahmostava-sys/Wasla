-- Platforms linked to one order-based salary scheme form one calculation
-- group. Their orders are aggregated before the scheme tiers and target bonus
-- are applied, while the per-platform order breakdown remains available.

BEGIN;

CREATE OR REPLACE FUNCTION public.calculate_employee_platform_pay(
  p_employee_id UUID,
  p_month_year TEXT
)
RETURNS TABLE (
  total_orders INTEGER,
  total_shift_days INTEGER,
  base_salary NUMERIC,
  platform_breakdown JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public /* NOSONAR */
AS $$
DECLARE
  v_start DATE := to_date(p_month_year || '-01', 'YYYY-MM-DD');
  v_end DATE := (v_start + INTERVAL '1 month - 1 day')::DATE;
  v_app RECORD;
  v_hybrid_rule RECORD;
  v_day RECORD;
  v_day_orders INTEGER;
  v_app_orders INTEGER;
  v_app_shift_days INTEGER;
  v_app_earnings NUMERIC;
  v_hours_worked NUMERIC;
  v_monthly_amount NUMERIC;
  v_calculation_method TEXT;
  v_is_groupable_order_activity BOOLEAN;
  v_scheme_total_orders INTEGER;
  v_fixed_scheme_ids UUID[] := ARRAY[]::UUID[];
  v_paid_order_scheme_ids UUID[] := ARRAY[]::UUID[];
  v_total_orders INTEGER := 0;
  v_total_shift_days INTEGER := 0;
  v_base_salary NUMERIC := 0;
  v_platform_breakdown JSONB := '[]'::JSONB;
  c_cancelled TEXT := _const_order_cancelled();
  c_orders TEXT := _const_work_orders();
  c_shift TEXT := _const_work_shift();
  c_hybrid TEXT := _const_work_hybrid();
  c_days_per_month NUMERIC := _const_days_per_month();
BEGIN
  FOR v_app IN
    SELECT
      a.id AS app_id,
      a.name AS app_name,
      a.work_type,
      s.id AS scheme_id,
      s.scheme_type,
      s.monthly_amount
    FROM public.apps a
    LEFT JOIN public.salary_schemes s ON s.id = a.scheme_id
    WHERE a.is_active IS TRUE
    ORDER BY a.id
  LOOP
    v_app_orders := 0;
    v_app_shift_days := 0;
    v_app_earnings := 0;
    v_scheme_total_orders := NULL;
    v_calculation_method := c_orders;
    v_is_groupable_order_activity := false;

    IF v_app.work_type = c_orders OR v_app.work_type IS NULL THEN
      SELECT COALESCE(SUM(d.orders_count), 0)::INTEGER
      INTO v_app_orders
      FROM public.daily_orders d
      WHERE d.employee_id = p_employee_id
        AND d.app_id = v_app.app_id
        AND d.date BETWEEN v_start AND v_end
        AND (d.status IS NULL OR d.status <> c_cancelled);

      v_is_groupable_order_activity := true;

    ELSIF v_app.work_type = c_shift THEN
      v_calculation_method := _const_calc_method_shift_fixed();
      IF EXISTS (
        SELECT 1
        FROM public.employee_apps ea
        WHERE ea.employee_id = p_employee_id
          AND ea.app_id = v_app.app_id
      ) THEN
        SELECT COUNT(*)::INTEGER
        INTO v_app_shift_days
        FROM public.daily_shifts ds
        WHERE ds.employee_id = p_employee_id
          AND ds.app_id = v_app.app_id
          AND ds.date BETWEEN v_start AND v_end
          AND ds.hours_worked > 0;

        v_monthly_amount := COALESCE(v_app.monthly_amount, 0);
        IF v_monthly_amount > 0 AND v_app_shift_days > 0 THEN
          v_app_earnings := ROUND((v_monthly_amount / c_days_per_month) * v_app_shift_days);
        END IF;
      END IF;

    ELSIF v_app.work_type = c_hybrid THEN
      v_calculation_method := _const_calc_method_mixed();
      SELECT *
      INTO v_hybrid_rule
      FROM public.app_hybrid_rules
      WHERE app_id = v_app.app_id;

      IF v_hybrid_rule IS NULL THEN
        v_calculation_method := _const_calc_method_orders_fallback();
        SELECT COALESCE(SUM(d.orders_count), 0)::INTEGER
        INTO v_app_orders
        FROM public.daily_orders d
        WHERE d.employee_id = p_employee_id
          AND d.app_id = v_app.app_id
          AND d.date BETWEEN v_start AND v_end
          AND (d.status IS NULL OR d.status <> c_cancelled);

        v_is_groupable_order_activity := true;
      ELSE
        FOR v_day IN
          SELECT generate_series(v_start, v_end, '1 day'::INTERVAL)::DATE AS day_date
        LOOP
          SELECT ds.hours_worked
          INTO v_hours_worked
          FROM public.daily_shifts ds
          WHERE ds.employee_id = p_employee_id
            AND ds.app_id = v_app.app_id
            AND ds.date = v_day.day_date;

          IF v_hours_worked IS NOT NULL AND v_hours_worked > 0 THEN
            v_app_earnings := v_app_earnings + v_hybrid_rule.shift_rate;
            v_app_shift_days := v_app_shift_days + 1;
          ELSIF v_hybrid_rule.fallback_to_orders THEN
            SELECT COALESCE(SUM(d.orders_count), 0)::INTEGER
            INTO v_day_orders
            FROM public.daily_orders d
            WHERE d.employee_id = p_employee_id
              AND d.app_id = v_app.app_id
              AND d.date = v_day.day_date
              AND (d.status IS NULL OR d.status <> c_cancelled);

            v_app_orders := v_app_orders + v_day_orders;
            v_total_orders := v_total_orders + v_day_orders;
            IF v_day_orders > 0 THEN
              v_app_earnings := v_app_earnings + (
                SELECT earnings
                FROM public.calculate_order_salary_for_app(
                  v_app.app_id,
                  v_day_orders,
                  0,
                  v_fixed_scheme_ids,
                  false
                )
              );
            END IF;
          END IF;
        END LOOP;
      END IF;
    END IF;

    IF v_is_groupable_order_activity THEN
      v_total_orders := v_total_orders + v_app_orders;

      IF v_app.scheme_id IS NOT NULL
        AND COALESCE(v_app.scheme_type, 'order_based') = 'order_based'
        AND EXISTS (
          SELECT 1
          FROM public.salary_scheme_tiers tier
          WHERE tier.scheme_id = v_app.scheme_id
        )
        AND NOT EXISTS (
          SELECT 1
          FROM public.apps grouped_hybrid
          JOIN public.app_hybrid_rules hybrid_rule ON hybrid_rule.app_id = grouped_hybrid.id
          WHERE grouped_hybrid.scheme_id = v_app.scheme_id
            AND grouped_hybrid.is_active IS TRUE
        ) THEN
        SELECT COALESCE(SUM(d.orders_count), 0)::INTEGER
        INTO v_scheme_total_orders
        FROM public.daily_orders d
        JOIN public.apps grouped_app ON grouped_app.id = d.app_id
        WHERE d.employee_id = p_employee_id
          AND grouped_app.scheme_id = v_app.scheme_id
          AND grouped_app.is_active IS TRUE
          AND (
            grouped_app.work_type = c_orders
            OR grouped_app.work_type IS NULL
            OR (
              grouped_app.work_type = c_hybrid
              AND NOT EXISTS (
                SELECT 1
                FROM public.app_hybrid_rules grouped_rule
                WHERE grouped_rule.app_id = grouped_app.id
              )
            )
          )
          AND d.date BETWEEN v_start AND v_end
          AND (d.status IS NULL OR d.status <> c_cancelled);

        IF v_scheme_total_orders > 0
          AND NOT (v_app.scheme_id = ANY(v_paid_order_scheme_ids)) THEN
          SELECT earnings, calculation_method, fixed_scheme_ids
          INTO v_app_earnings, v_calculation_method, v_fixed_scheme_ids
          FROM public.calculate_order_salary_for_app(
            v_app.app_id,
            v_scheme_total_orders,
            0,
            v_fixed_scheme_ids,
            true
          );
          v_paid_order_scheme_ids := array_append(v_paid_order_scheme_ids, v_app.scheme_id);
        ELSE
          v_app_earnings := 0;
        END IF;
      ELSE
        SELECT earnings, calculation_method, fixed_scheme_ids
        INTO v_app_earnings, v_calculation_method, v_fixed_scheme_ids
        FROM public.calculate_order_salary_for_app(
          v_app.app_id,
          v_app_orders,
          0,
          v_fixed_scheme_ids,
          true
        );
      END IF;
    END IF;

    v_total_shift_days := v_total_shift_days + v_app_shift_days;
    v_base_salary := v_base_salary + v_app_earnings;

    IF v_app_orders > 0 OR v_app_shift_days > 0 OR v_app_earnings > 0 THEN
      v_platform_breakdown := v_platform_breakdown || jsonb_build_object(
        'app_id', v_app.app_id,
        'app_name', v_app.app_name,
        'scheme_id', v_app.scheme_id,
        'scheme_total_orders', v_scheme_total_orders,
        'work_type', COALESCE(v_app.work_type, c_orders),
        'calculation_method', v_calculation_method,
        'orders_count', v_app_orders,
        'shift_days', v_app_shift_days,
        'earnings', v_app_earnings
      );
    END IF;
  END LOOP;

  total_orders := v_total_orders;
  total_shift_days := v_total_shift_days;
  base_salary := v_base_salary;
  platform_breakdown := v_platform_breakdown;
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.calculate_employee_platform_pay(UUID, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.calculate_employee_platform_pay(UUID, TEXT)
  TO service_role;

DROP FUNCTION IF EXISTS public.preview_salary_for_month(TEXT);

CREATE OR REPLACE FUNCTION public.preview_salary_for_month(p_month_year TEXT)
RETURNS TABLE (
  employee_id UUID,
  total_orders INTEGER,
  total_shift_days INTEGER,
  base_salary NUMERIC,
  external_deduction NUMERIC,
  advance_deduction NUMERIC,
  net_salary NUMERIC,
  platform_breakdown JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public /* NOSONAR */
AS $$
DECLARE
  v_employee RECORD;
  v_platform_pay RECORD;
  v_external_deduction NUMERIC;
  v_advance_deduction NUMERIC;
  c_active TEXT := _const_employee_active();
  c_approved TEXT := _const_approval_approved();
  c_pending TEXT := _const_installment_pending();
  c_deferred TEXT := _const_installment_deferred();
BEGIN
  FOR v_employee IN
    SELECT e.id
    FROM public.employees e
    WHERE e.status = c_active
  LOOP
    SELECT *
    INTO v_platform_pay
    FROM public.calculate_employee_platform_pay(v_employee.id, p_month_year);

    SELECT COALESCE(SUM(ed.amount), 0)
    INTO v_external_deduction
    FROM public.external_deductions ed
    WHERE ed.employee_id = v_employee.id
      AND ed.apply_month = p_month_year
      AND ed.approval_status = c_approved;

    SELECT COALESCE(SUM(ai.amount), 0)
    INTO v_advance_deduction
    FROM public.advances advance_record
    JOIN public.advance_installments ai ON ai.advance_id = advance_record.id
    WHERE advance_record.employee_id = v_employee.id
      AND ai.month_year = p_month_year
      AND ai.status IN (c_pending, c_deferred);

    employee_id := v_employee.id;
    total_orders := COALESCE(v_platform_pay.total_orders, 0);
    total_shift_days := COALESCE(v_platform_pay.total_shift_days, 0);
    base_salary := COALESCE(v_platform_pay.base_salary, 0);
    external_deduction := v_external_deduction;
    advance_deduction := v_advance_deduction;
    net_salary := GREATEST(base_salary - external_deduction - advance_deduction, 0);
    platform_breakdown := COALESCE(v_platform_pay.platform_breakdown, '[]'::JSONB);
    RETURN NEXT;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.preview_salary_for_month(TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.preview_salary_for_month(TEXT)
  TO service_role;

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
SET search_path TO public /* NOSONAR */
AS $$
DECLARE
  v_platform_pay RECORD;
  v_attendance_deduction NUMERIC := 0;
  v_external_deduction NUMERIC := 0;
  v_advance_deduction NUMERIC := 0;
  v_net NUMERIC;
  c_approved TEXT := _const_approval_approved();
  c_pending TEXT := _const_installment_pending();
  c_deferred TEXT := _const_installment_deferred();
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.employees e WHERE e.id = p_employee_id) THEN
    RAISE EXCEPTION 'Employee not found';
  END IF;

  SELECT *
  INTO v_platform_pay
  FROM public.calculate_employee_platform_pay(p_employee_id, p_month_year);

  SELECT COALESCE(SUM(ed.amount), 0)
  INTO v_external_deduction
  FROM public.external_deductions ed
  WHERE ed.employee_id = p_employee_id
    AND ed.apply_month = p_month_year
    AND ed.approval_status = c_approved;

  SELECT COALESCE(SUM(ai.amount), 0)
  INTO v_advance_deduction
  FROM public.advances advance_record
  JOIN public.advance_installments ai ON ai.advance_id = advance_record.id
  WHERE advance_record.employee_id = p_employee_id
    AND ai.month_year = p_month_year
    AND ai.status IN (c_pending, c_deferred);

  v_net := GREATEST(
    COALESCE(v_platform_pay.base_salary, 0)
      - v_attendance_deduction
      - v_external_deduction
      - v_advance_deduction
      - COALESCE(p_manual_deduction, 0),
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
    is_approved,
    sheet_snapshot
  )
  VALUES (
    p_employee_id,
    p_month_year,
    COALESCE(v_platform_pay.base_salary, 0),
    v_attendance_deduction,
    v_external_deduction,
    v_advance_deduction,
    COALESCE(p_manual_deduction, 0),
    p_manual_deduction_note,
    v_net,
    COALESCE(NULLIF(TRIM(p_payment_method), ''), _const_payment_cash()),
    _const_calc_calculated(),
    'engine_v7_grouped_scheme_orders',
    false,
    NULL
  )
  ON CONFLICT ON CONSTRAINT salary_records_employee_id_month_year_key
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
    COALESCE(v_platform_pay.total_orders, 0),
    COALESCE(v_platform_pay.total_shift_days, 0),
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

REVOKE ALL ON FUNCTION public.calculate_salary_for_employee_month(UUID, TEXT, TEXT, NUMERIC, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.calculate_salary_for_employee_month(UUID, TEXT, TEXT, NUMERIC, TEXT)
  TO service_role;

COMMENT ON FUNCTION public.calculate_employee_platform_pay(UUID, TEXT) IS
  'Aggregates orders across active platforms sharing one order-based salary scheme and applies that scheme once.';

COMMENT ON FUNCTION public.calculate_salary_for_employee_month(UUID, TEXT, TEXT, NUMERIC, TEXT) IS
  'v7: groups platform orders by salary scheme before applying tiers and target bonus.';

COMMIT;
