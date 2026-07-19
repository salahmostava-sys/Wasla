-- Align salary engine with the salaries sheet:
-- 1. Orders earnings use per-app pricing rules and attached salary schemes.
-- 2. Fixed monthly schemes are prorated once per shared scheme id.
-- 3. Month-wide salary calculations include active admin titles and any employee
--    with monthly activity or an existing salary record for the target month.

BEGIN;

DROP FUNCTION IF EXISTS public.is_salary_admin_job_title(TEXT);
DROP FUNCTION IF EXISTS public.calculate_order_salary_for_app(UUID, INTEGER, INTEGER, UUID[], BOOLEAN);
DROP FUNCTION IF EXISTS public.is_salary_month_visible_employee(UUID, TEXT, TEXT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.is_salary_admin_job_title(p_job_title TEXT)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT COALESCE(p_job_title, '') ~* '(admin|administrator|manager|supervisor|coordinator|accountant|finance|financial|hr|human resources|operations|operation|office|reception|support|customer service|it|logistics|fleet|procurement|purchasing|payroll|Ø¥Ø¯Ø§Ø±Ø©|Ø§Ø¯Ø§Ø±Ø©|Ø¥Ø¯Ø§Ø±ÙŠ|Ø§Ø¯Ø§Ø±ÙŠ|Ù…Ø¯ÙŠØ±|Ù…Ø´Ø±Ù|Ù…Ù†Ø³Ù‚|Ù…ØØ§Ø³Ø¨|Ù…Ø§Ù„ÙŠØ©|Ù…Ø§Ù„ÙŠ|Ù…ÙˆØ§Ø±Ø¯|Ø´Ø¤ÙˆÙ†|Ø§Ø³ØªÙ‚Ø¨Ø§Ù„|Ø®Ø¯Ù…Ø© Ø¹Ù…Ù„Ø§Ø¡|Ø¯Ø¹Ù…|ØªÙ‚Ù†ÙŠØ©|Ø¹Ù…Ù„ÙŠØ§Øª|ØªØ´ØºÙŠÙ„|Ù„ÙˆØ¬Ø³Øª)';
$$;

CREATE OR REPLACE FUNCTION public.calculate_order_salary_for_app(
  p_app_id UUID,
  p_orders INTEGER,
  p_attendance_days INTEGER DEFAULT 0,
  p_fixed_scheme_ids UUID[] DEFAULT ARRAY[]::UUID[],
  p_allow_target_bonus BOOLEAN DEFAULT true
)
RETURNS TABLE (
  earnings NUMERIC,
  calculation_method TEXT,
  fixed_scheme_ids UUID[]
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public' /* NOSONAR */
AS $$
DECLARE
  v_orders INTEGER := GREATEST(COALESCE(p_orders, 0), 0);
  v_attendance_days INTEGER := GREATEST(COALESCE(p_attendance_days, 0), 0);
  v_rule RECORD;
  v_scheme RECORD;
  v_tier RECORD;
  v_total NUMERIC := 0;
  v_tier_orders INTEGER;
  v_fixed_ids UUID[] := COALESCE(p_fixed_scheme_ids, ARRAY[]::UUID[]);
  v_threshold INTEGER;
  v_incremental_price NUMERIC;
BEGIN
  earnings := 0;
  calculation_method := 'orders';
  fixed_scheme_ids := v_fixed_ids;

  SELECT pr.*
  INTO v_rule
  FROM public.pricing_rules pr
  WHERE pr.app_id = p_app_id
    AND pr.is_active IS TRUE
    AND v_orders >= COALESCE(pr.min_orders, 0)
    AND (pr.max_orders IS NULL OR v_orders <= pr.max_orders)
  ORDER BY pr.priority DESC, pr.min_orders ASC
  LIMIT 1;

  IF FOUND THEN
    IF v_rule.rule_type = 'fixed' THEN
      earnings := ROUND(COALESCE(v_rule.fixed_salary, 0));
    ELSIF v_rule.rule_type = 'hybrid' THEN
      earnings := ROUND(
        COALESCE(v_rule.fixed_salary, 0) + (v_orders * COALESCE(v_rule.rate_per_order, 0))
      );
    ELSE
      earnings := ROUND(v_orders * COALESCE(v_rule.rate_per_order, 0));
    END IF;
    RETURN NEXT;
    RETURN;
  END IF;

  SELECT
    ss.id,
    ss.scheme_type,
    ss.monthly_amount,
    ss.target_orders,
    ss.target_bonus
  INTO v_scheme
  FROM public.apps a
  LEFT JOIN public.salary_schemes ss ON ss.id = a.scheme_id
  WHERE a.id = p_app_id;

  IF NOT FOUND OR v_scheme.id IS NULL THEN
    RETURN NEXT;
    RETURN;
  END IF;

  IF COALESCE(v_scheme.scheme_type, 'order_based') = 'fixed_monthly' THEN
    calculation_method := 'shift';
    IF v_scheme.id = ANY(v_fixed_ids) THEN
      earnings := 0;
    ELSE
      earnings := ROUND((COALESCE(v_scheme.monthly_amount, 0) / 30.0) * v_attendance_days);
      fixed_scheme_ids := array_append(v_fixed_ids, v_scheme.id);
    END IF;
    RETURN NEXT;
    RETURN;
  END IF;

  IF v_orders <= 0 THEN
    RETURN NEXT;
    RETURN;
  END IF;

  SELECT t.*
  INTO v_tier
  FROM public.salary_scheme_tiers t
  WHERE t.scheme_id = v_scheme.id
    AND v_orders >= t.from_orders
    AND (t.to_orders IS NULL OR v_orders <= t.to_orders)
  ORDER BY t.tier_order
  LIMIT 1;

  IF NOT FOUND THEN
    SELECT t.*
    INTO v_tier
    FROM public.salary_scheme_tiers t
    WHERE t.scheme_id = v_scheme.id
    ORDER BY t.tier_order DESC
    LIMIT 1;
  END IF;

  IF NOT FOUND THEN
    RETURN NEXT;
    RETURN;
  END IF;

  IF COALESCE(v_tier.tier_type, 'total_multiplier') = 'fixed_amount' THEN
    v_total := COALESCE(v_tier.price_per_order, 0);
  ELSIF COALESCE(v_tier.tier_type, 'total_multiplier') = 'base_plus_incremental' THEN
    v_threshold := COALESCE(v_tier.incremental_threshold, v_tier.from_orders);
    v_incremental_price := COALESCE(v_tier.incremental_price, 0);
    v_total :=
      COALESCE(v_tier.price_per_order, 0)
      + (GREATEST(v_orders - v_threshold, 0) * v_incremental_price);
  ELSIF COALESCE(v_tier.tier_type, 'total_multiplier') = 'per_order_band' THEN
    v_total := v_orders * COALESCE(v_tier.price_per_order, 0);
  ELSE
    v_total := 0;
    FOR v_tier IN
      SELECT *
      FROM public.salary_scheme_tiers
      WHERE scheme_id = v_scheme.id
      ORDER BY tier_order
    LOOP
      EXIT WHEN v_orders < v_tier.from_orders;
      v_tier_orders :=
        LEAST(v_orders, COALESCE(v_tier.to_orders, v_orders)) - v_tier.from_orders + 1;
      IF v_tier_orders > 0 THEN
        v_total := v_total + (v_tier_orders * COALESCE(v_tier.price_per_order, 0));
      END IF;
    END LOOP;
  END IF;

  IF p_allow_target_bonus
    AND COALESCE(v_scheme.target_orders, 0) > 0
    AND COALESCE(v_scheme.target_bonus, 0) > 0
    AND v_orders >= v_scheme.target_orders THEN
    v_total := v_total + v_scheme.target_bonus;
  END IF;

  earnings := ROUND(v_total);
  RETURN NEXT;
END;
$$;

CREATE OR REPLACE FUNCTION public.is_salary_month_visible_employee(
  p_employee_id UUID,
  p_month_year TEXT,
  p_status TEXT,
  p_sponsorship_status TEXT,
  p_job_title TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public' /* NOSONAR */
AS $$
DECLARE
  v_start DATE := to_date(p_month_year || '-01', 'YYYY-MM-DD');
  v_end DATE := (v_start + INTERVAL '1 month - 1 day')::date;
  v_has_orders BOOLEAN;
  v_has_attendance BOOLEAN;
  v_has_shifts BOOLEAN;
  v_has_saved_salary BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM public.daily_orders d
    WHERE d.employee_id = p_employee_id
      AND d.date BETWEEN v_start AND v_end
      AND (d.status IS NULL OR d.status <> 'cancelled')
  )
  INTO v_has_orders;

  SELECT EXISTS (
    SELECT 1
    FROM public.attendance a
    WHERE a.employee_id = p_employee_id
      AND a.date BETWEEN v_start AND v_end
  )
  INTO v_has_attendance;

  SELECT EXISTS (
    SELECT 1
    FROM public.daily_shifts s
    WHERE s.employee_id = p_employee_id
      AND s.date BETWEEN v_start AND v_end
  )
  INTO v_has_shifts;

  SELECT EXISTS (
    SELECT 1
    FROM public.salary_records sr
    WHERE sr.employee_id = p_employee_id
      AND sr.month_year = p_month_year
  )
  INTO v_has_saved_salary;

  IF v_has_orders OR v_has_attendance OR v_has_shifts OR v_has_saved_salary THEN
    RETURN TRUE;
  END IF;

  IF COALESCE(p_status, '') <> 'active' THEN
    RETURN FALSE;
  END IF;

  IF COALESCE(p_sponsorship_status, '') IN ('absconded', 'terminated') THEN
    RETURN FALSE;
  END IF;

  RETURN public.is_salary_admin_job_title(p_job_title);
END;
$$;

DROP FUNCTION IF EXISTS public.calculate_salary_for_employee_month(UUID, TEXT, TEXT, NUMERIC, TEXT);
DROP FUNCTION IF EXISTS public.calculate_salary_for_month(TEXT, TEXT);
DROP FUNCTION IF EXISTS public.preview_salary_for_month(TEXT);

CREATE OR REPLACE FUNCTION public.calculate_salary_for_employee_month(
  p_employee_id UUID,
  p_month_year TEXT,
  p_payment_method TEXT DEFAULT 'cash',
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
SET search_path TO 'public' /* NOSONAR */
AS $$
DECLARE
  v_start DATE;
  v_end DATE;
  v_total_orders INTEGER := 0;
  v_total_shift_days INTEGER := 0;
  v_base_salary NUMERIC := 0;
  v_attendance_deduction NUMERIC := 0;
  v_external_deduction NUMERIC := 0;
  v_advance_deduction NUMERIC := 0;
  v_manual_deduction NUMERIC := GREATEST(COALESCE(p_manual_deduction, 0), 0);
  v_net NUMERIC := 0;
  v_app RECORD;
  v_app_orders INTEGER;
  v_app_shifts INTEGER;
  v_app_earnings NUMERIC;
  v_hybrid_rule RECORD;
  v_pricing_rule RECORD;
  v_day RECORD;
  v_hours_worked NUMERIC;
  v_attendance_days INTEGER := 0;
  v_fixed_scheme_ids UUID[] := ARRAY[]::UUID[];
  v_order_calc RECORD;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.employees AS e WHERE e.id = p_employee_id
  ) THEN
    RAISE EXCEPTION 'Employee not found';
  END IF;

  v_start := to_date(p_month_year || '-01', 'YYYY-MM-DD');
  v_end := (v_start + INTERVAL '1 month - 1 day')::date;

  SELECT COUNT(*)::INTEGER
  INTO v_attendance_days
  FROM public.attendance a
  WHERE a.employee_id = p_employee_id
    AND a.date BETWEEN v_start AND v_end;

  FOR v_app IN
    SELECT a.id, a.name, a.work_type
    FROM public.apps a
    WHERE a.is_active IS TRUE
  LOOP
    v_app_earnings := 0;

    IF v_app.work_type = 'orders' OR v_app.work_type IS NULL THEN
      SELECT COALESCE(SUM(d.orders_count), 0)::INTEGER
      INTO v_app_orders
      FROM public.daily_orders AS d
      WHERE d.employee_id = p_employee_id
        AND d.app_id = v_app.id
        AND d.date BETWEEN v_start AND v_end
        AND (d.status IS NULL OR d.status <> 'cancelled');

      v_total_orders := v_total_orders + v_app_orders;

      SELECT *
      INTO v_order_calc
      FROM public.calculate_order_salary_for_app(
        v_app.id,
        v_app_orders,
        v_attendance_days,
        v_fixed_scheme_ids,
        true
      );

      v_app_earnings := COALESCE(v_order_calc.earnings, 0);
      v_fixed_scheme_ids := COALESCE(v_order_calc.fixed_scheme_ids, v_fixed_scheme_ids);

    ELSIF v_app.work_type = 'shift' THEN
      SELECT COUNT(*)::INTEGER
      INTO v_app_shifts
      FROM public.daily_shifts AS s
      WHERE s.employee_id = p_employee_id
        AND s.app_id = v_app.id
        AND s.date BETWEEN v_start AND v_end
        AND s.hours_worked >= 8;

      v_total_shift_days := v_total_shift_days + v_app_shifts;

      SELECT *
      INTO v_pricing_rule
      FROM public.pricing_rules
      WHERE app_id = v_app.id
        AND is_active IS TRUE
      ORDER BY priority DESC
      LIMIT 1;

      IF v_pricing_rule.fixed_salary IS NOT NULL THEN
        v_app_earnings := v_app_shifts * v_pricing_rule.fixed_salary;
      ELSE
        v_app_earnings := v_app_shifts * 150;
      END IF;

    ELSIF v_app.work_type = 'hybrid' THEN
      SELECT *
      INTO v_hybrid_rule
      FROM public.app_hybrid_rules
      WHERE app_id = v_app.id;

      IF v_hybrid_rule IS NULL THEN
        SELECT COALESCE(SUM(d.orders_count), 0)::INTEGER
        INTO v_app_orders
        FROM public.daily_orders AS d
        WHERE d.employee_id = p_employee_id
          AND d.app_id = v_app.id
          AND d.date BETWEEN v_start AND v_end
          AND (d.status IS NULL OR d.status <> 'cancelled');

        v_total_orders := v_total_orders + v_app_orders;

        SELECT *
        INTO v_order_calc
        FROM public.calculate_order_salary_for_app(
          v_app.id,
          v_app_orders,
          v_attendance_days,
          v_fixed_scheme_ids,
          true
        );

        v_app_earnings := COALESCE(v_order_calc.earnings, 0);
        v_fixed_scheme_ids := COALESCE(v_order_calc.fixed_scheme_ids, v_fixed_scheme_ids);
      ELSE
        FOR v_day IN
          SELECT generate_series(v_start, v_end, '1 day'::interval)::date AS day_date
        LOOP
          SELECT hours_worked INTO v_hours_worked
          FROM public.daily_shifts
          WHERE employee_id = p_employee_id
            AND app_id = v_app.id
            AND date = v_day.day_date;

          IF v_hours_worked IS NOT NULL AND v_hours_worked >= v_hybrid_rule.min_hours_for_shift THEN
            v_app_earnings := v_app_earnings + v_hybrid_rule.shift_rate;
            v_total_shift_days := v_total_shift_days + 1;
          ELSE
            IF v_hybrid_rule.fallback_to_orders THEN
              SELECT COALESCE(SUM(d.orders_count), 0)::INTEGER
              INTO v_app_orders
              FROM public.daily_orders AS d
              WHERE d.employee_id = p_employee_id
                AND d.app_id = v_app.id
                AND d.date = v_day.day_date
                AND (d.status IS NULL OR d.status <> 'cancelled');

              v_total_orders := v_total_orders + v_app_orders;

              IF v_app_orders > 0 THEN
                SELECT *
                INTO v_order_calc
                FROM public.calculate_order_salary_for_app(
                  v_app.id,
                  v_app_orders,
                  0,
                  ARRAY[]::UUID[],
                  false
                );
                v_app_earnings := v_app_earnings + COALESCE(v_order_calc.earnings, 0);
              END IF;
            END IF;
          END IF;
        END LOOP;
      END IF;
    END IF;

    v_base_salary := v_base_salary + v_app_earnings;
  END LOOP;

  SELECT COALESCE(SUM(ed.amount), 0)
  INTO v_external_deduction
  FROM public.external_deductions AS ed
  WHERE ed.employee_id = p_employee_id
    AND ed.apply_month = p_month_year
    AND ed.approval_status = 'approved';

  SELECT COALESCE(SUM(ai.amount), 0)
  INTO v_advance_deduction
  FROM public.advances AS ad
  JOIN public.advance_installments AS ai ON ai.advance_id = ad.id
  WHERE ad.employee_id = p_employee_id
    AND ai.month_year = p_month_year
    AND ai.status IN ('pending', 'deferred');

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
    v_manual_deduction,
    p_manual_deduction_note,
    v_net,
    COALESCE(NULLIF(TRIM(p_payment_method), ''), 'cash'),
    'calculated',
    'engine_v5_sheet_aligned',
    false,
    NULL
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
    sheet_snapshot = NULL,
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

CREATE OR REPLACE FUNCTION public.calculate_salary_for_month(
  p_month_year TEXT,
  p_payment_method TEXT DEFAULT 'cash'
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
SET search_path TO 'public' /* NOSONAR */
AS $$
DECLARE
  v_emp RECORD;
BEGIN
  FOR v_emp IN
    SELECT e.id
    FROM public.employees AS e
    WHERE public.is_salary_month_visible_employee(
      e.id,
      p_month_year,
      COALESCE(e.status::text, ''),
      COALESCE(e.sponsorship_status::text, ''),
      e.job_title
    )
    ORDER BY e.name
  LOOP
    RETURN QUERY
    SELECT *
    FROM public.calculate_salary_for_employee_month(
      v_emp.id,
      p_month_year,
      p_payment_method,
      0,
      NULL
    );
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.preview_salary_for_month(
  p_month_year TEXT
)
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
SET search_path = public /* NOSONAR */
AS $$
DECLARE
  v_start DATE;
  v_end DATE;
  v_emp RECORD;
  v_app RECORD;
  v_app_orders INTEGER;
  v_app_shift_days INTEGER;
  v_app_earnings NUMERIC;
  v_hybrid_rule RECORD;
  v_pricing_rule RECORD;
  v_day RECORD;
  v_hours_worked NUMERIC;
  v_total_orders INTEGER;
  v_total_shift_days INTEGER;
  v_base_salary NUMERIC;
  v_external_deduction NUMERIC;
  v_advance_deduction NUMERIC;
  v_net NUMERIC;
  v_platform_breakdown JSONB;
  v_calculation_method TEXT;
  v_attendance_days INTEGER;
  v_fixed_scheme_ids UUID[];
  v_order_calc RECORD;
  v_fallback_orders_total INTEGER;
BEGIN
  v_start := to_date(p_month_year || '-01', 'YYYY-MM-DD');
  v_end := (v_start + INTERVAL '1 month - 1 day')::date;

  FOR v_emp IN
    SELECT e.id
    FROM public.employees e
    WHERE public.is_salary_month_visible_employee(
      e.id,
      p_month_year,
      COALESCE(e.status::text, ''),
      COALESCE(e.sponsorship_status::text, ''),
      e.job_title
    )
    ORDER BY e.name
  LOOP
    v_total_orders := 0;
    v_total_shift_days := 0;
    v_base_salary := 0;
    v_platform_breakdown := '[]'::jsonb;
    v_fixed_scheme_ids := ARRAY[]::UUID[];

    SELECT COUNT(*)::INTEGER
    INTO v_attendance_days
    FROM public.attendance a
    WHERE a.employee_id = v_emp.id
      AND a.date BETWEEN v_start AND v_end;

    FOR v_app IN
      SELECT a.id, a.name, a.work_type
      FROM public.apps a
      WHERE a.is_active IS TRUE
    LOOP
      v_app_orders := 0;
      v_app_shift_days := 0;
      v_app_earnings := 0;
      v_calculation_method := 'orders';
      v_fallback_orders_total := 0;

      IF v_app.work_type = 'orders' OR v_app.work_type IS NULL THEN
        SELECT COALESCE(SUM(d.orders_count), 0)::INTEGER
        INTO v_app_orders
        FROM public.daily_orders AS d
        WHERE d.employee_id = v_emp.id
          AND d.app_id = v_app.id
          AND d.date BETWEEN v_start AND v_end
          AND (d.status IS NULL OR d.status <> 'cancelled');

        v_total_orders := v_total_orders + v_app_orders;

        SELECT *
        INTO v_order_calc
        FROM public.calculate_order_salary_for_app(
          v_app.id,
          v_app_orders,
          v_attendance_days,
          v_fixed_scheme_ids,
          true
        );

        v_app_earnings := COALESCE(v_order_calc.earnings, 0);
        v_calculation_method := COALESCE(v_order_calc.calculation_method, 'orders');
        v_fixed_scheme_ids := COALESCE(v_order_calc.fixed_scheme_ids, v_fixed_scheme_ids);

      ELSIF v_app.work_type = 'shift' THEN
        v_calculation_method := 'shift';

        SELECT COUNT(*)::INTEGER
        INTO v_app_shift_days
        FROM public.daily_shifts AS s
        WHERE s.employee_id = v_emp.id
          AND s.app_id = v_app.id
          AND s.date BETWEEN v_start AND v_end
          AND s.hours_worked >= 8;

        v_total_shift_days := v_total_shift_days + v_app_shift_days;

        SELECT * INTO v_pricing_rule
        FROM public.pricing_rules
        WHERE app_id = v_app.id
          AND is_active IS TRUE
        ORDER BY priority DESC
        LIMIT 1;

        IF v_pricing_rule.fixed_salary IS NOT NULL THEN
          v_app_earnings := v_app_shift_days * v_pricing_rule.fixed_salary;
        ELSE
          v_app_earnings := v_app_shift_days * 150;
        END IF;

      ELSIF v_app.work_type = 'hybrid' THEN
        SELECT * INTO v_hybrid_rule
        FROM public.app_hybrid_rules
        WHERE app_id = v_app.id;

        IF v_hybrid_rule IS NULL THEN
          v_calculation_method := 'orders_fallback';

          SELECT COALESCE(SUM(d.orders_count), 0)::INTEGER
          INTO v_app_orders
          FROM public.daily_orders AS d
          WHERE d.employee_id = v_emp.id
            AND d.app_id = v_app.id
            AND d.date BETWEEN v_start AND v_end
            AND (d.status IS NULL OR d.status <> 'cancelled');

          v_total_orders := v_total_orders + v_app_orders;

          SELECT *
          INTO v_order_calc
          FROM public.calculate_order_salary_for_app(
            v_app.id,
            v_app_orders,
            v_attendance_days,
            v_fixed_scheme_ids,
            true
          );

          v_app_earnings := COALESCE(v_order_calc.earnings, 0);
          v_fixed_scheme_ids := COALESCE(v_order_calc.fixed_scheme_ids, v_fixed_scheme_ids);
        ELSE
          FOR v_day IN
            SELECT generate_series(v_start, v_end, '1 day'::interval)::date AS day_date
          LOOP
            SELECT hours_worked INTO v_hours_worked
            FROM public.daily_shifts
            WHERE employee_id = v_emp.id
              AND app_id = v_app.id
              AND date = v_day.day_date;

            IF v_hours_worked IS NOT NULL AND v_hours_worked >= v_hybrid_rule.min_hours_for_shift THEN
              v_app_earnings := v_app_earnings + v_hybrid_rule.shift_rate;
              v_app_shift_days := v_app_shift_days + 1;
            ELSIF v_hybrid_rule.fallback_to_orders THEN
              SELECT COALESCE(SUM(d.orders_count), 0)::INTEGER
              INTO v_app_orders
              FROM public.daily_orders AS d
              WHERE d.employee_id = v_emp.id
                AND d.app_id = v_app.id
                AND d.date = v_day.day_date
                AND (d.status IS NULL OR d.status <> 'cancelled');

              v_total_orders := v_total_orders + v_app_orders;
              v_fallback_orders_total := v_fallback_orders_total + v_app_orders;

              IF v_app_orders > 0 THEN
                SELECT *
                INTO v_order_calc
                FROM public.calculate_order_salary_for_app(
                  v_app.id,
                  v_app_orders,
                  0,
                  ARRAY[]::UUID[],
                  false
                );
                v_app_earnings := v_app_earnings + COALESCE(v_order_calc.earnings, 0);
              END IF;
            END IF;
          END LOOP;

          v_app_orders := v_fallback_orders_total;
          v_total_shift_days := v_total_shift_days + v_app_shift_days;

          IF v_app_shift_days > 0 AND v_app_orders > 0 THEN
            v_calculation_method := 'mixed';
          ELSIF v_app_shift_days > 0 THEN
            v_calculation_method := 'shift';
          ELSIF v_app_orders > 0 THEN
            v_calculation_method := 'orders_fallback';
          ELSE
            v_calculation_method := 'none';
          END IF;
        END IF;
      END IF;

      v_base_salary := v_base_salary + v_app_earnings;

      IF v_app_orders > 0 OR v_app_shift_days > 0 OR v_app_earnings > 0 THEN
        v_platform_breakdown := v_platform_breakdown || jsonb_build_object(
          'app_id', v_app.id,
          'app_name', v_app.name,
          'work_type', COALESCE(v_app.work_type, 'orders'),
          'calculation_method', v_calculation_method,
          'orders_count', v_app_orders,
          'shift_days', v_app_shift_days,
          'earnings', v_app_earnings
        );
      END IF;
    END LOOP;

    SELECT COALESCE(SUM(ed.amount), 0)
    INTO v_external_deduction
    FROM public.external_deductions AS ed
    WHERE ed.employee_id = v_emp.id
      AND ed.apply_month = p_month_year
      AND ed.approval_status = 'approved';

    SELECT COALESCE(SUM(ai.amount), 0)
    INTO v_advance_deduction
    FROM public.advances AS ad
    JOIN public.advance_installments AS ai ON ai.advance_id = ad.id
    WHERE ad.employee_id = v_emp.id
      AND ai.month_year = p_month_year
      AND ai.status IN ('pending', 'deferred');

    v_net := GREATEST(
      v_base_salary
      - v_external_deduction
      - v_advance_deduction,
      0
    );

    employee_id := v_emp.id;
    total_orders := v_total_orders;
    total_shift_days := v_total_shift_days;
    base_salary := v_base_salary;
    external_deduction := v_external_deduction;
    advance_deduction := v_advance_deduction;
    net_salary := v_net;
    platform_breakdown := v_platform_breakdown;

    RETURN NEXT;
  END LOOP;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.calculate_salary_for_employee_month(UUID, TEXT, TEXT, NUMERIC, TEXT) FROM anon;
REVOKE EXECUTE ON FUNCTION public.calculate_salary_for_employee_month(UUID, TEXT, TEXT, NUMERIC, TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.calculate_salary_for_employee_month(UUID, TEXT, TEXT, NUMERIC, TEXT) TO service_role;

REVOKE EXECUTE ON FUNCTION public.calculate_salary_for_month(TEXT, TEXT) FROM anon;
REVOKE EXECUTE ON FUNCTION public.calculate_salary_for_month(TEXT, TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.calculate_salary_for_month(TEXT, TEXT) TO service_role;

REVOKE EXECUTE ON FUNCTION public.preview_salary_for_month(TEXT) FROM anon;
REVOKE EXECUTE ON FUNCTION public.preview_salary_for_month(TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.preview_salary_for_month(TEXT) TO service_role;

COMMENT ON FUNCTION public.calculate_salary_for_employee_month IS
  'v5: Sheet-aligned salary calculation using app pricing rules, salary schemes, and admin-title visibility';

COMMENT ON FUNCTION public.preview_salary_for_month IS
  'v4: Sheet-aligned preview with per-platform breakdown and admin-title visibility';

COMMIT;
