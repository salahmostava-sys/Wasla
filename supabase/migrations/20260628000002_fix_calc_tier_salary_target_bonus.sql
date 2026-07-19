-- Fix: calc_tier_salary should include target_bonus from salary_schemes
-- when the number of orders meets or exceeds target_orders.

CREATE OR REPLACE FUNCTION public.calc_tier_salary(
  p_orders INTEGER,
  p_scheme_id UUID DEFAULT NULL
)
RETURNS NUMERIC
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_tier RECORD;
  v_salary NUMERIC := 0;
  v_target_orders INT;
  v_target_bonus NUMERIC;
BEGIN
  IF p_orders <= 0 OR p_scheme_id IS NULL THEN RETURN 0; END IF;

  FOR v_tier IN
    SELECT * FROM public.salary_scheme_tiers
    WHERE scheme_id = p_scheme_id
      AND from_orders <= p_orders
    ORDER BY from_orders DESC
    LIMIT 1
  LOOP
    IF v_tier.tier_type = _const_tier_fixed() THEN
      v_salary := v_tier.price_per_order;
    ELSIF v_tier.tier_type = _const_tier_incremental() THEN
      v_salary := v_tier.price_per_order
        + GREATEST(p_orders - COALESCE(v_tier.incremental_threshold, v_tier.from_orders), 0)
        * COALESCE(v_tier.incremental_price, 0);
    ELSE
      v_salary := p_orders * v_tier.price_per_order;
    END IF;
  END LOOP;

  -- Add target bonus if applicable
  SELECT target_orders, target_bonus INTO v_target_orders, v_target_bonus
  FROM public.salary_schemes
  WHERE id = p_scheme_id;

  IF v_target_orders IS NOT NULL AND v_target_bonus IS NOT NULL AND p_orders >= v_target_orders THEN
    v_salary := v_salary + v_target_bonus;
  END IF;

  RETURN v_salary;
END;
$$;
