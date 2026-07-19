-- Fix preview_salary_for_month and calculate_salary_for_employee_month 
-- to process all apps (even those without scheme_id) and use calculate_order_salary_for_app
-- so that it correctly falls back to pricing_rules if scheme has no tiers or app has no scheme.

BEGIN;

DROP FUNCTION IF EXISTS public.preview_salary_for_month(text);

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
SET search_path TO public
AS $$
DECLARE
  v_start DATE; v_end DATE;
  v_emp RECORD; v_app RECORD;
  v_app_orders INTEGER; v_app_shift_days INTEGER; v_app_earnings NUMERIC;
  v_total_orders INTEGER; v_total_shift_days INTEGER; v_base_salary NUMERIC;
  v_external_deduction NUMERIC; v_advance_deduction NUMERIC;
  v_net NUMERIC; v_platform_breakdown JSONB;
  v_calculation_method TEXT;
  v_hybrid_rule RECORD;
  v_day RECORD; v_hours_worked NUMERIC;
  v_monthly_amount NUMERIC;
  v_fixed_scheme_ids UUID[];
  -- Constants
  c_cancelled TEXT := _const_order_cancelled();
  c_active TEXT := _const_employee_active();
  c_approved TEXT := _const_approval_approved();
  c_pending TEXT := _const_installment_pending();
  c_deferred TEXT := _const_installment_deferred();
  c_orders TEXT := _const_work_orders();
  c_shift TEXT := _const_work_shift();
  c_hybrid TEXT := _const_work_hybrid();
  c_days_per_month NUMERIC := _const_days_per_month();
BEGIN
  v_start := to_date(p_month_year || '-01', 'YYYY-MM-DD');
  v_end := (v_start + INTERVAL '1 month - 1 day')::date;

  FOR v_emp IN SELECT e.id FROM employees e WHERE e.status = c_active LOOP
    v_total_orders := 0; v_total_shift_days := 0; v_base_salary := 0;
    v_platform_breakdown := '[]'::jsonb;
    v_fixed_scheme_ids := ARRAY[]::UUID[];

    FOR v_app IN
      SELECT a.id AS app_id, a.name AS app_name, a.work_type,
             s.id AS scheme_id, s.scheme_type, s.monthly_amount
      FROM apps a
      LEFT JOIN salary_schemes s ON s.id = a.scheme_id
      WHERE a.is_active IS TRUE
    LOOP
      v_app_orders := 0; v_app_shift_days := 0; v_app_earnings := 0;
      v_calculation_method := c_orders;

      IF v_app.work_type = c_orders OR v_app.work_type IS NULL THEN
        -- === ORDERS-BASED: salary from daily_orders ===
        SELECT COALESCE(SUM(d.orders_count), 0)::INTEGER INTO v_app_orders
        FROM daily_orders d
        WHERE d.employee_id = v_emp.id AND d.app_id = v_app.app_id
          AND d.date BETWEEN v_start AND v_end
          AND (d.status IS NULL OR d.status <> c_cancelled);

        v_total_orders := v_total_orders + v_app_orders;
        
        -- Use the unified fallback function
        SELECT earnings, calculation_method, fixed_scheme_ids 
        INTO v_app_earnings, v_calculation_method, v_fixed_scheme_ids
        FROM public.calculate_order_salary_for_app(
          v_app.app_id, 
          v_app_orders, 
          0, 
          v_fixed_scheme_ids, 
          true
        );

      ELSIF v_app.work_type = c_shift THEN
        -- === SHIFT-BASED: always full monthly_amount ===
        v_calculation_method := _const_calc_method_shift_fixed();

        IF EXISTS(
          SELECT 1 FROM employee_apps ea
          WHERE ea.employee_id = v_emp.id AND ea.app_id = v_app.app_id
        ) THEN
          SELECT COUNT(*)::INTEGER INTO v_app_shift_days
          FROM daily_shifts ds
          WHERE ds.employee_id = v_emp.id AND ds.app_id = v_app.app_id
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
        -- === HYBRID ===
        v_calculation_method := _const_calc_method_mixed();
        SELECT * INTO v_hybrid_rule FROM app_hybrid_rules WHERE app_id = v_app.app_id;

        IF v_hybrid_rule IS NULL THEN
          v_calculation_method := _const_calc_method_orders_fallback();
          SELECT COALESCE(SUM(d.orders_count), 0)::INTEGER INTO v_app_orders
          FROM daily_orders d
          WHERE d.employee_id = v_emp.id AND d.app_id = v_app.app_id
            AND d.date BETWEEN v_start AND v_end
            AND (d.status IS NULL OR d.status <> c_cancelled);
            
          v_total_orders := v_total_orders + v_app_orders;
          
          SELECT earnings INTO v_app_earnings
          FROM public.calculate_order_salary_for_app(
            v_app.app_id, 
            v_app_orders, 
            0, 
            v_fixed_scheme_ids, 
            true
          );
        ELSE
          FOR v_day IN SELECT generate_series(v_start, v_end, '1 day'::interval)::date AS day_date LOOP
            SELECT hours_worked INTO v_hours_worked
            FROM daily_shifts ds
            WHERE ds.employee_id = v_emp.id
              AND ds.app_id = v_app.app_id
              AND ds.date = v_day.day_date;

            IF v_hours_worked IS NOT NULL AND v_hours_worked > 0 THEN
              v_app_earnings := v_app_earnings + v_hybrid_rule.shift_rate;
              v_app_shift_days := v_app_shift_days + 1;
            ELSIF v_hybrid_rule.fallback_to_orders THEN
              SELECT COALESCE(SUM(d.orders_count), 0)::INTEGER INTO v_app_orders
              FROM daily_orders d
              WHERE d.employee_id = v_emp.id AND d.app_id = v_app.app_id AND d.date = v_day.day_date
                AND (d.status IS NULL OR d.status <> c_cancelled);
                
              v_total_orders := v_total_orders + v_app_orders;
              IF v_app_orders > 0 THEN
                v_app_earnings := v_app_earnings + (
                  SELECT earnings 
                  FROM public.calculate_order_salary_for_app(
                    v_app.app_id, 
                    v_app_orders, 
                    0, 
                    v_fixed_scheme_ids, 
                    false
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
    FROM external_deductions ed
    WHERE ed.employee_id = v_emp.id AND ed.apply_month = p_month_year
      AND ed.approval_status = c_approved;

    SELECT COALESCE(SUM(ai.amount), 0) INTO v_advance_deduction
    FROM advances ad JOIN advance_installments ai ON ai.advance_id = ad.id
    WHERE ad.employee_id = v_emp.id AND ai.month_year = p_month_year
      AND ai.status IN (c_pending, c_deferred);

    v_net := GREATEST(v_base_salary - v_external_deduction - v_advance_deduction, 0);

    employee_id := v_emp.id; total_orders := v_total_orders;
    total_shift_days := v_total_shift_days; base_salary := v_base_salary;
    external_deduction := v_external_deduction; advance_deduction := v_advance_deduction;
    net_salary := v_net; platform_breakdown := v_platform_breakdown;
    RETURN NEXT;
  END LOOP;
END;
$$;


-- =============================================================================
-- Update calculate_salary_for_employee_month
-- =============================================================================

DROP FUNCTION IF EXISTS public.calculate_salary_for_employee_month(UUID, TEXT, TEXT, NUMERIC, TEXT);

CREATE OR REPLACE FUNCTION public.calculate_salary_for_employee_month(
  p_employee_id UUID,
  p_month_year TEXT,
  p_payment_method TEXT DEFAULT _const_payment_cash(),
  p_manual_deduction NUMERIC DEFAULT 0,
  p_manual_deduction_note TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_start DATE; v_end DATE;
  v_app RECORD;
  v_app_orders INTEGER; v_app_shift_days INTEGER; v_app_earnings NUMERIC;
  v_total_orders INTEGER := 0; v_total_shift_days INTEGER := 0;
  v_base_salary NUMERIC := 0; v_external_deduction NUMERIC := 0; v_advance_deduction NUMERIC := 0;
  v_net NUMERIC := 0; v_platform_breakdown JSONB := '[]'::jsonb;
  v_calculation_method TEXT;
  v_hybrid_rule RECORD; v_day RECORD; v_hours_worked NUMERIC;
  v_monthly_amount NUMERIC;
  v_salary_record_id UUID;
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
  v_start := to_date(p_month_year || '-01', 'YYYY-MM-DD');
  v_end := (v_start + INTERVAL '1 month - 1 day')::date;

  FOR v_app IN
    SELECT a.id AS app_id, a.name AS app_name, a.work_type,
           s.id AS scheme_id, s.scheme_type, s.monthly_amount
    FROM apps a
    LEFT JOIN salary_schemes s ON s.id = a.scheme_id
    WHERE a.is_active IS TRUE
  LOOP
    v_app_orders := 0; v_app_shift_days := 0; v_app_earnings := 0;
    v_calculation_method := c_orders;

    IF v_app.work_type = c_orders OR v_app.work_type IS NULL THEN
      SELECT COALESCE(SUM(d.orders_count), 0)::INTEGER INTO v_app_orders
      FROM daily_orders d
      WHERE d.employee_id = p_employee_id AND d.app_id = v_app.app_id
        AND d.date BETWEEN v_start AND v_end
        AND (d.status IS NULL OR d.status <> c_cancelled);

      v_total_orders := v_total_orders + v_app_orders;
      
      SELECT earnings, calculation_method, fixed_scheme_ids 
      INTO v_app_earnings, v_calculation_method, v_fixed_scheme_ids
      FROM public.calculate_order_salary_for_app(
        v_app.app_id, 
        v_app_orders, 
        0, 
        v_fixed_scheme_ids, 
        true
      );

    ELSIF v_app.work_type = c_shift THEN
      v_calculation_method := _const_calc_method_shift_fixed();
      IF EXISTS(
        SELECT 1 FROM employee_apps ea
        WHERE ea.employee_id = p_employee_id AND ea.app_id = v_app.app_id
      ) THEN
        SELECT COUNT(*)::INTEGER INTO v_app_shift_days
        FROM daily_shifts ds
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
      SELECT * INTO v_hybrid_rule FROM app_hybrid_rules WHERE app_id = v_app.app_id;

      IF v_hybrid_rule IS NULL THEN
        v_calculation_method := _const_calc_method_orders_fallback();
        SELECT COALESCE(SUM(d.orders_count), 0)::INTEGER INTO v_app_orders
        FROM daily_orders d
        WHERE d.employee_id = p_employee_id AND d.app_id = v_app.app_id
          AND d.date BETWEEN v_start AND v_end
          AND (d.status IS NULL OR d.status <> c_cancelled);
        v_total_orders := v_total_orders + v_app_orders;
        
        SELECT earnings INTO v_app_earnings
        FROM public.calculate_order_salary_for_app(
          v_app.app_id, 
          v_app_orders, 
          0, 
          v_fixed_scheme_ids, 
          true
        );
      ELSE
        FOR v_day IN SELECT generate_series(v_start, v_end, '1 day'::interval)::date AS day_date LOOP
          SELECT hours_worked INTO v_hours_worked
          FROM daily_shifts ds
          WHERE ds.employee_id = p_employee_id
            AND ds.app_id = v_app.app_id
            AND ds.date = v_day.day_date;

          IF v_hours_worked IS NOT NULL AND v_hours_worked > 0 THEN
            v_app_earnings := v_app_earnings + v_hybrid_rule.shift_rate;
            v_app_shift_days := v_app_shift_days + 1;
          ELSIF v_hybrid_rule.fallback_to_orders THEN
            SELECT COALESCE(SUM(d.orders_count), 0)::INTEGER INTO v_app_orders
            FROM daily_orders d
            WHERE d.employee_id = p_employee_id AND d.app_id = v_app.app_id AND d.date = v_day.day_date
              AND (d.status IS NULL OR d.status <> c_cancelled);
            v_total_orders := v_total_orders + v_app_orders;
            IF v_app_orders > 0 THEN
              v_app_earnings := v_app_earnings + (
                SELECT earnings 
                FROM public.calculate_order_salary_for_app(
                  v_app.app_id, 
                  v_app_orders, 
                  0, 
                  v_fixed_scheme_ids, 
                  false
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
  FROM external_deductions ed
  WHERE ed.employee_id = p_employee_id AND ed.apply_month = p_month_year
    AND ed.approval_status = c_approved;

  SELECT COALESCE(SUM(ai.amount), 0) INTO v_advance_deduction
  FROM advances ad JOIN advance_installments ai ON ai.advance_id = ad.id
  WHERE ad.employee_id = p_employee_id AND ai.month_year = p_month_year
    AND ai.status IN (c_pending, c_deferred);

  v_net := GREATEST(v_base_salary - v_external_deduction - v_advance_deduction - COALESCE(p_manual_deduction, 0), 0);

  INSERT INTO salary_records (
    employee_id, month_year, total_orders, total_shift_days,
    base_salary, external_deduction, advance_deduction,
    manual_deduction, manual_deduction_note,
    net_salary, status, platform_breakdown, payment_method,
    created_at, updated_at
  ) VALUES (
    p_employee_id, p_month_year, v_total_orders, v_total_shift_days,
    v_base_salary, v_external_deduction, v_advance_deduction,
    COALESCE(p_manual_deduction, 0), p_manual_deduction_note,
    v_net, 'pending', v_platform_breakdown, p_payment_method,
    NOW(), NOW()
  )
  RETURNING id INTO v_salary_record_id;

  RETURN v_salary_record_id;
END;
$$;

COMMIT;
