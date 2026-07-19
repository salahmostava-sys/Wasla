-- Migration: Update salary calculation to support shifts and hybrid work types
-- Date: 2025-01-XX
-- Description: Enhances calculate_salary_for_employee_month to handle orders, shifts, and hybrid platforms

-- Drop existing function
DROP FUNCTION IF EXISTS public.calculate_salary_for_employee_month(UUID, TEXT);

-- Create updated function with shift and hybrid support
CREATE OR REPLACE FUNCTION public.calculate_salary_for_employee_month(
  p_employee_id UUID,
  p_month_year TEXT
)
RETURNS TABLE (
  base_salary NUMERIC,
  orders_bonus NUMERIC,
  shifts_bonus NUMERIC,
  total_earnings NUMERIC,
  deductions NUMERIC,
  net_salary NUMERIC,
  breakdown JSONB
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_start_date DATE;
  v_end_date DATE;
  v_tier_id UUID;
  v_base_salary NUMERIC := 0;
  v_orders_earnings NUMERIC := 0;
  v_shifts_earnings NUMERIC := 0;
  v_total_deductions NUMERIC := 0;
  v_breakdown JSONB := '[]'::jsonb;
  v_app RECORD;
  v_app_orders INT;
  v_app_shifts RECORD;
  v_hybrid_rule RECORD;
  v_pricing RECORD;
  v_app_earnings NUMERIC;
BEGIN
  -- Parse month_year (YYYY-MM)
  v_start_date := (p_month_year || '-01')::DATE;
  v_end_date := (DATE_TRUNC('month', v_start_date) + INTERVAL '1 month - 1 day')::DATE;

  -- Get employee tier
  SELECT tier_id INTO v_tier_id
  FROM employees
  WHERE id = p_employee_id;

  -- Get base salary from tier
  IF v_tier_id IS NOT NULL THEN
    SELECT base_salary INTO v_base_salary
    FROM tiers
    WHERE id = v_tier_id;
  END IF;

  v_base_salary := COALESCE(v_base_salary, 0);

  -- Loop through all active apps for this employee
  FOR v_app IN
    SELECT DISTINCT 
      a.id as app_id,
      a.name as app_name,
      a.work_type
    FROM employee_apps ea
    JOIN apps a ON a.id = ea.app_id
    WHERE ea.employee_id = p_employee_id
      AND ea.status = 'active'
      AND a.is_active IS TRUE
  LOOP
    v_app_earnings := 0;

    -- Handle based on work_type
    IF v_app.work_type = 'orders' OR v_app.work_type IS NULL THEN
      -- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
      -- ORDERS-BASED PLATFORM
      -- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
      
      -- Get total orders for this app
      SELECT COALESCE(SUM(orders_count), 0) INTO v_app_orders
      FROM daily_orders
      WHERE employee_id = p_employee_id
        AND app_id = v_app.app_id
        AND date >= v_start_date
        AND date <= v_end_date;

      -- Find applicable pricing rule
      SELECT * INTO v_pricing
      FROM pricing_rules
      WHERE app_id = v_app.app_id
        AND is_active IS TRUE
        AND (min_orders IS NULL OR v_app_orders >= min_orders)
        AND (max_orders IS NULL OR v_app_orders <= max_orders)
      ORDER BY priority ASC, min_orders DESC NULLS LAST
      LIMIT 1;

      -- Calculate earnings
      IF v_pricing.rule_type = 'per_order' THEN
        v_app_earnings := v_app_orders * COALESCE(v_pricing.rate_per_order, 0);
      ELSIF v_pricing.rule_type = 'fixed' THEN
        v_app_earnings := COALESCE(v_pricing.fixed_salary, 0);
      ELSIF v_pricing.rule_type = 'tiered' THEN
        v_app_earnings := v_app_orders * COALESCE(v_pricing.rate_per_order, 0);
      END IF;

      v_orders_earnings := v_orders_earnings + v_app_earnings;

      -- Add to breakdown
      v_breakdown := v_breakdown || jsonb_build_object(
        'app_id', v_app.app_id, -- NOSONAR
        'app_name', v_app.app_name, -- NOSONAR
        'work_type', 'orders', -- NOSONAR
        'orders_count', v_app_orders,
        'rate_per_order', COALESCE(v_pricing.rate_per_order, 0),
        'earnings', v_app_earnings -- NOSONAR
      );

    ELSIF v_app.work_type = 'shift' THEN
      -- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
      -- SHIFT-BASED PLATFORM
      -- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
      
      -- Get total hours and shifts
      SELECT 
        COALESCE(SUM(hours_worked), 0) as total_hours,
        COUNT(*) as total_shifts
      INTO v_app_shifts
      FROM daily_shifts
      WHERE employee_id = p_employee_id
        AND app_id = v_app.app_id
        AND date >= v_start_date
        AND date <= v_end_date;

      -- Find shift pricing rule
      SELECT * INTO v_pricing
      FROM pricing_rules
      WHERE app_id = v_app.app_id
        AND is_active IS TRUE
        AND rule_type = 'shift'
      ORDER BY priority ASC
      LIMIT 1;

      -- Calculate shift earnings
      IF v_pricing.id IS NOT NULL THEN
        v_app_earnings := v_app_shifts.total_hours * COALESCE(v_pricing.rate_per_order, 0);
      END IF;

      v_shifts_earnings := v_shifts_earnings + v_app_earnings;

      -- Add to breakdown
      v_breakdown := v_breakdown || jsonb_build_object(
        'app_id', v_app.app_id,
        'app_name', v_app.app_name,
        'work_type', 'shift',
        'total_hours', v_app_shifts.total_hours, -- NOSONAR
        'total_shifts', v_app_shifts.total_shifts,
        'rate_per_hour', COALESCE(v_pricing.rate_per_order, 0),
        'earnings', v_app_earnings
      );

    ELSIF v_app.work_type = 'hybrid' THEN
      -- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
      -- HYBRID PLATFORM (Ninja-style)
      -- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
      
      -- Get hybrid rules
      SELECT * INTO v_hybrid_rule
      FROM app_hybrid_rules
      WHERE app_id = v_app.app_id
      LIMIT 1;

      -- Get shift data
      SELECT 
        COALESCE(SUM(hours_worked), 0) as total_hours,
        COUNT(*) as total_shifts
      INTO v_app_shifts
      FROM daily_shifts
      WHERE employee_id = p_employee_id
        AND app_id = v_app.app_id
        AND date >= v_start_date
        AND date <= v_end_date;

      -- Check if minimum hours met
      IF v_app_shifts.total_hours >= COALESCE(v_hybrid_rule.min_hours_for_shift, 0) THEN
        -- Pay shift rate
        v_app_earnings := COALESCE(v_hybrid_rule.shift_rate, 0);
        
        v_breakdown := v_breakdown || jsonb_build_object(
          'app_id', v_app.app_id,
          'app_name', v_app.app_name,
          'work_type', 'hybrid',
          'calculation_method', 'shift', -- NOSONAR
          'total_hours', v_app_shifts.total_hours,
          'min_hours_required', v_hybrid_rule.min_hours_for_shift, -- NOSONAR
          'shift_rate', v_hybrid_rule.shift_rate,
          'earnings', v_app_earnings
        );
        
        v_shifts_earnings := v_shifts_earnings + v_app_earnings;
      ELSE
        -- Fallback to orders if allowed
        IF COALESCE(v_hybrid_rule.fallback_to_orders, false) THEN
          -- Get orders
          SELECT COALESCE(SUM(orders_count), 0) INTO v_app_orders
          FROM daily_orders
          WHERE employee_id = p_employee_id
            AND app_id = v_app.app_id
            AND date >= v_start_date
            AND date <= v_end_date;

          -- Find pricing rule
          SELECT * INTO v_pricing
          FROM pricing_rules
          WHERE app_id = v_app.app_id
            AND is_active IS TRUE
            AND (min_orders IS NULL OR v_app_orders >= min_orders)
            AND (max_orders IS NULL OR v_app_orders <= max_orders)
          ORDER BY priority ASC, min_orders DESC NULLS LAST
          LIMIT 1;

          -- Calculate from orders
          IF v_pricing.rule_type = 'per_order' THEN
            v_app_earnings := v_app_orders * COALESCE(v_pricing.rate_per_order, 0);
          ELSIF v_pricing.rule_type = 'fixed' THEN
            v_app_earnings := COALESCE(v_pricing.fixed_salary, 0);
          END IF;

          v_breakdown := v_breakdown || jsonb_build_object(
            'app_id', v_app.app_id,
            'app_name', v_app.app_name,
            'work_type', 'hybrid',
            'calculation_method', 'orders_fallback',
            'total_hours', v_app_shifts.total_hours,
            'min_hours_required', v_hybrid_rule.min_hours_for_shift,
            'orders_count', v_app_orders,
            'rate_per_order', COALESCE(v_pricing.rate_per_order, 0),
            'earnings', v_app_earnings
          );

          v_orders_earnings := v_orders_earnings + v_app_earnings;
        ELSE
          -- No payment
          v_breakdown := v_breakdown || jsonb_build_object(
            'app_id', v_app.app_id,
            'app_name', v_app.app_name,
            'work_type', 'hybrid',
            'calculation_method', 'none',
            'total_hours', v_app_shifts.total_hours,
            'min_hours_required', v_hybrid_rule.min_hours_for_shift,
            'earnings', 0
          );
        END IF;
      END IF;
    END IF;
  END LOOP;

  -- Calculate deductions (advances installments)
  SELECT COALESCE(SUM(installment_amount), 0) INTO v_total_deductions
  FROM advance_installments
  WHERE advance_id IN (
    SELECT id FROM advances 
    WHERE employee_id = p_employee_id 
      AND status = 'active'
  )
  AND month_year = p_month_year
  AND status = 'pending';

  -- Return results
  RETURN QUERY SELECT
    v_base_salary,
    v_orders_earnings,
    v_shifts_earnings,
    v_base_salary + v_orders_earnings + v_shifts_earnings as total_earnings,
    v_total_deductions,
    v_base_salary + v_orders_earnings + v_shifts_earnings - v_total_deductions as net_salary,
    v_breakdown;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.calculate_salary_for_employee_month(UUID, TEXT) TO authenticated;

COMMENT ON FUNCTION public.calculate_salary_for_employee_month IS 'Calculate employee salary for a month supporting orders, shifts, and hybrid work types';
