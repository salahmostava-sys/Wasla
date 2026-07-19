-- Prioritize App Salary Schemes over legacy Pricing Rules
-- Fixes an issue where apps with a new `scheme_id` would still be calculated using 
-- the old `pricing_rules` if both were present.

BEGIN;

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
  calculation_method := _const_work_orders();
  fixed_scheme_ids := v_fixed_ids;

  -- 1. Check for attached salary scheme FIRST
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

  IF FOUND AND v_scheme.id IS NOT NULL THEN
    IF COALESCE(v_scheme.scheme_type, 'order_based') = 'fixed_monthly' THEN
      calculation_method := _const_work_shift();
      IF v_scheme.id = ANY(v_fixed_ids) THEN
        earnings := 0;
      ELSE
        earnings := ROUND((COALESCE(v_scheme.monthly_amount, 0) / _const_days_per_month()) * v_attendance_days);
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

    IF FOUND THEN
      IF COALESCE(v_tier.tier_type, 'total_multiplier') = _const_tier_fixed() THEN
        v_total := COALESCE(v_tier.price_per_order, 0);
      ELSIF COALESCE(v_tier.tier_type, 'total_multiplier') = _const_tier_incremental() THEN
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
      RETURN;
    END IF;
  END IF;

  -- 2. Fallback to legacy pricing_rules if no scheme is linked (or if it unexpectedly had no tiers)
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
    ELSIF v_rule.rule_type = _const_work_hybrid() THEN
      earnings := ROUND(
        COALESCE(v_rule.fixed_salary, 0) + (v_orders * COALESCE(v_rule.rate_per_order, 0))
      );
    ELSE
      earnings := ROUND(v_orders * COALESCE(v_rule.rate_per_order, 0));
    END IF;
    RETURN NEXT;
    RETURN;
  END IF;

  RETURN NEXT;
END;
$$;

COMMIT;
