BEGIN;

-- Employee targets (monthly + daily)
CREATE TABLE IF NOT EXISTS public.employee_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  month_year TEXT NOT NULL CHECK (month_year ~ '^\d{4}-\d{2}$'),
  monthly_target_orders INTEGER NOT NULL DEFAULT 0 CHECK (monthly_target_orders >= 0),
  daily_target_orders INTEGER NOT NULL DEFAULT 0 CHECK (daily_target_orders >= 0),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (employee_id, month_year)
);

CREATE INDEX IF NOT EXISTS idx_employee_targets_employee_month
  ON public.employee_targets(employee_id, month_year);

CREATE INDEX IF NOT EXISTS idx_employee_targets_month
  ON public.employee_targets(month_year);

DROP TRIGGER IF EXISTS trg_employee_targets_updated_at ON public.employee_targets;
CREATE TRIGGER trg_employee_targets_updated_at
  BEFORE UPDATE ON public.employee_targets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.employee_targets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS employee_targets_select_policy ON public.employee_targets;
DROP POLICY IF EXISTS employee_targets_manage_policy ON public.employee_targets;

CREATE POLICY employee_targets_select_policy
  ON public.employee_targets
  FOR SELECT
  TO authenticated
  USING (public.is_active_user(auth.uid()));

CREATE POLICY employee_targets_manage_policy
  ON public.employee_targets
  FOR ALL
  TO authenticated
  USING (
    public.is_active_user(auth.uid())
    AND (
      public.has_role(auth.uid(), _const_role_admin())
      OR public.has_role(auth.uid(), _const_role_operations())
      OR public.has_role(auth.uid(), _const_role_hr())
      OR public.has_role(auth.uid(), _const_role_finance())
    )
  )
  WITH CHECK (
    public.is_active_user(auth.uid())
    AND (
      public.has_role(auth.uid(), _const_role_admin())
      OR public.has_role(auth.uid(), _const_role_operations())
      OR public.has_role(auth.uid(), _const_role_hr())
      OR public.has_role(auth.uid(), _const_role_finance())
    )
  );

COMMENT ON TABLE public.employee_targets IS
'Monthly and daily delivery targets per employee.';

-- Import batch tracking for orders imports / monthly replacements
CREATE TABLE IF NOT EXISTS public.order_import_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  month_year TEXT NOT NULL CHECK (month_year ~ '^\d{4}-\d{2}$'),
  source_type TEXT NOT NULL DEFAULT 'manual'
    CHECK (source_type IN ('manual', 'excel', 'api')),
  file_name TEXT,
  target_app_id UUID REFERENCES public.apps(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT _const_installment_pending()
    CHECK (status IN (_const_installment_pending(), 'completed', 'failed')),
  total_rows INTEGER NOT NULL DEFAULT 0 CHECK (total_rows >= 0),
  imported_rows INTEGER NOT NULL DEFAULT 0 CHECK (imported_rows >= 0),
  skipped_rows INTEGER NOT NULL DEFAULT 0 CHECK (skipped_rows >= 0),
  error_count INTEGER NOT NULL DEFAULT 0 CHECK (error_count >= 0),
  error_summary JSONB NOT NULL DEFAULT '[]'::jsonb,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  started_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_order_import_batches_month_year
  ON public.order_import_batches(month_year, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_order_import_batches_status
  ON public.order_import_batches(status);

DROP TRIGGER IF EXISTS trg_order_import_batches_updated_at ON public.order_import_batches;
CREATE TRIGGER trg_order_import_batches_updated_at
  BEFORE UPDATE ON public.order_import_batches
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.order_import_batches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS order_import_batches_select_policy ON public.order_import_batches;
DROP POLICY IF EXISTS order_import_batches_manage_policy ON public.order_import_batches;

CREATE POLICY order_import_batches_select_policy
  ON public.order_import_batches
  FOR SELECT
  TO authenticated
  USING (
    public.is_active_user(auth.uid())
    AND (
      public.has_role(auth.uid(), _const_role_admin())
      OR public.has_role(auth.uid(), _const_role_operations())
      OR public.has_role(auth.uid(), _const_role_hr())
      OR public.has_role(auth.uid(), _const_role_finance())
    )
  );

CREATE POLICY order_import_batches_manage_policy
  ON public.order_import_batches
  FOR ALL
  TO authenticated
  USING (
    public.is_active_user(auth.uid())
    AND (
      public.has_role(auth.uid(), _const_role_admin())
      OR public.has_role(auth.uid(), _const_role_operations())
      OR public.has_role(auth.uid(), _const_role_hr())
      OR public.has_role(auth.uid(), _const_role_finance())
    )
  )
  WITH CHECK (
    public.is_active_user(auth.uid())
    AND (
      public.has_role(auth.uid(), _const_role_admin())
      OR public.has_role(auth.uid(), _const_role_operations())
      OR public.has_role(auth.uid(), _const_role_hr())
      OR public.has_role(auth.uid(), _const_role_finance())
    )
  );

COMMENT ON TABLE public.order_import_batches IS
'Audit trail for orders imports and month replacements.';

ALTER TABLE public.daily_orders
  ADD COLUMN IF NOT EXISTS import_batch_id UUID REFERENCES public.order_import_batches(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_daily_orders_import_batch_id
  ON public.daily_orders(import_batch_id);

-- Monthly accounting snapshot for salary records
CREATE TABLE IF NOT EXISTS public.salary_month_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  month_year TEXT NOT NULL UNIQUE CHECK (month_year ~ '^\d{4}-\d{2}$'),
  snapshot JSONB NOT NULL DEFAULT '[]'::jsonb,
  summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  captured_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_salary_month_snapshots_month
  ON public.salary_month_snapshots(month_year);

DROP TRIGGER IF EXISTS trg_salary_month_snapshots_updated_at ON public.salary_month_snapshots;
CREATE TRIGGER trg_salary_month_snapshots_updated_at
  BEFORE UPDATE ON public.salary_month_snapshots
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.salary_month_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS salary_month_snapshots_select_policy ON public.salary_month_snapshots;
DROP POLICY IF EXISTS salary_month_snapshots_manage_policy ON public.salary_month_snapshots;

CREATE POLICY salary_month_snapshots_select_policy
  ON public.salary_month_snapshots
  FOR SELECT
  TO authenticated
  USING (
    public.is_active_user(auth.uid())
    AND (
      public.has_role(auth.uid(), _const_role_admin())
      OR public.has_role(auth.uid(), _const_role_finance())
    )
  );

CREATE POLICY salary_month_snapshots_manage_policy
  ON public.salary_month_snapshots
  FOR ALL
  TO authenticated
  USING (
    public.is_active_user(auth.uid())
    AND (
      public.has_role(auth.uid(), _const_role_admin())
      OR public.has_role(auth.uid(), _const_role_finance())
    )
  )
  WITH CHECK (
    public.is_active_user(auth.uid())
    AND (
      public.has_role(auth.uid(), _const_role_admin())
      OR public.has_role(auth.uid(), _const_role_finance())
    )
  );

COMMENT ON TABLE public.salary_month_snapshots IS
'Frozen accounting snapshot of salary records for each month.';

-- Daily / monthly performance read models
CREATE OR REPLACE VIEW public.v_rider_daily_platform_orders AS
SELECT
  d.employee_id,
  COALESCE(e.name, '') AS employee_name,
  e.city,
  d.date,
  d.app_id,
  COALESCE(a.name, '—') AS app_name,
  COALESCE(a.brand_color, '#2563eb') AS brand_color,
  SUM(d.orders_count)::INTEGER AS total_orders
FROM public.daily_orders AS d
JOIN public.employees AS e
  ON e.id = d.employee_id
JOIN public.apps AS a
  ON a.id = d.app_id
WHERE d.orders_count > 0
  AND (d.status IS NULL OR d.status <> _const_order_cancelled())
GROUP BY
  d.employee_id,
  e.name,
  e.city,
  d.date,
  d.app_id,
  a.name,
  a.brand_color;

COMMENT ON VIEW public.v_rider_daily_platform_orders IS
'Performance write-model projection: daily orders per employee and platform.';

CREATE OR REPLACE VIEW public.v_rider_daily_performance AS
SELECT
  p.employee_id,
  p.employee_name,
  p.city,
  p.date,
  SUM(p.total_orders)::INTEGER AS total_orders,
  COUNT(*) FILTER (WHERE p.total_orders > 0)::INTEGER AS active_platforms,
  COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'app_id', p.app_id,
        'app_name', p.app_name,
        'brand_color', p.brand_color,
        _const_work_orders(), p.total_orders
      )
      ORDER BY p.total_orders DESC, p.app_name
    ),
    '[]'::jsonb
  ) AS platform_breakdown
FROM public.v_rider_daily_platform_orders AS p
GROUP BY
  p.employee_id,
  p.employee_name,
  p.city,
  p.date;

COMMENT ON VIEW public.v_rider_daily_performance IS
'Performance read-model: one daily summary row per rider with platform breakdown.';

CREATE OR REPLACE VIEW public.v_rider_monthly_performance AS
WITH monthly_base AS (
  SELECT
    d.employee_id,
    d.employee_name,
    d.city,
    to_char(d.date, 'YYYY-MM') AS month_year,
    SUM(d.total_orders)::INTEGER AS total_orders,
    COUNT(*) FILTER (WHERE d.total_orders > 0)::INTEGER AS active_days,
    MAX(d.total_orders)::INTEGER AS best_day_orders,
    MAX(d.date) FILTER (WHERE d.total_orders > 0) AS last_active_date
  FROM public.v_rider_daily_performance AS d
  GROUP BY
    d.employee_id,
    d.employee_name,
    d.city,
    to_char(d.date, 'YYYY-MM')
),
consistency_base AS (
  SELECT
    d.employee_id,
    to_char(d.date, 'YYYY-MM') AS month_year,
    COUNT(*) FILTER (
      WHERE d.total_orders >= (
        mb.total_orders::NUMERIC / NULLIF(mb.active_days, 0)
      )
    )::INTEGER AS consistency_days
  FROM public.v_rider_daily_performance AS d
  JOIN monthly_base AS mb
    ON mb.employee_id = d.employee_id
   AND mb.month_year = to_char(d.date, 'YYYY-MM')
  GROUP BY
    d.employee_id,
    to_char(d.date, 'YYYY-MM')
)
SELECT
  mb.employee_id,
  mb.employee_name,
  mb.city,
  mb.month_year,
  mb.total_orders,
  mb.active_days,
  ROUND(mb.total_orders::NUMERIC / NULLIF(mb.active_days, 0), 2) AS avg_orders_per_day,
  COALESCE(cb.consistency_days, 0) AS consistency_days,
  ROUND(COALESCE(cb.consistency_days, 0)::NUMERIC / NULLIF(mb.active_days, 0), 2) AS consistency_ratio,
  mb.best_day_orders,
  mb.last_active_date,
  COALESCE(t.monthly_target_orders, 0) AS monthly_target_orders,
  COALESCE(t.daily_target_orders, 0) AS daily_target_orders,
  CASE
    WHEN COALESCE(t.monthly_target_orders, 0) > 0 THEN
      ROUND((mb.total_orders::NUMERIC / t.monthly_target_orders::NUMERIC) * 100, 2)
    ELSE 0
  END AS target_achievement_pct
FROM monthly_base AS mb
LEFT JOIN consistency_base AS cb
  ON cb.employee_id = mb.employee_id
 AND cb.month_year = mb.month_year
LEFT JOIN public.employee_targets AS t
  ON t.employee_id = mb.employee_id
 AND t.month_year = mb.month_year;

COMMENT ON VIEW public.v_rider_monthly_performance IS
'Performance read-model: monthly rider metrics, consistency, and target achievement.';

-- Safe transactional month replacement with batch tracking
CREATE OR REPLACE FUNCTION public.replace_daily_orders_month_rpc(
  p_month_year TEXT,
  p_rows JSONB DEFAULT '[]'::jsonb,
  p_source_type TEXT DEFAULT 'manual',
  p_file_name TEXT DEFAULT NULL,
  p_target_app_id UUID DEFAULT NULL
)
RETURNS TABLE (
  batch_id UUID,
  saved_rows INTEGER,
  failed_rows INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public' /* NOSONAR */
AS $$
DECLARE
  v_start DATE;
  v_end DATE;
  v_batch_id UUID;
  v_total_rows INTEGER := COALESCE(jsonb_array_length(COALESCE(p_rows, '[]'::jsonb)), 0);
BEGIN
  IF NOT (
    public.is_active_user(auth.uid())
    AND (
      public.has_role(auth.uid(), _const_role_admin())
      OR public.has_role(auth.uid(), _const_role_operations())
      OR public.has_role(auth.uid(), _const_role_hr())
    )
  ) THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;

  IF p_month_year !~ '^\d{4}-\d{2}$' THEN
    RAISE EXCEPTION 'Invalid month_year format. Expected YYYY-MM';
  END IF;

  IF p_source_type NOT IN ('manual', 'excel', 'api') THEN
    RAISE EXCEPTION 'Invalid source_type';
  END IF;

  v_start := to_date(p_month_year || '-01', 'YYYY-MM-DD');
  v_end := (v_start + INTERVAL '1 month - 1 day')::DATE;

  INSERT INTO public.order_import_batches (
    month_year,
    source_type,
    file_name,
    target_app_id,
    status,
    total_rows,
    started_by,
    meta
  )
  VALUES (
    p_month_year,
    p_source_type,
    NULLIF(BTRIM(p_file_name), ''),
    p_target_app_id,
    _const_installment_pending(),
    v_total_rows,
    auth.uid(),
    jsonb_build_object(
      'replace_mode', 'month',
      'input_rows', v_total_rows
    )
  )
  RETURNING id INTO v_batch_id;

  CREATE TEMP TABLE tmp_orders_import (
    employee_id UUID NOT NULL,
    app_id UUID NOT NULL,
    date DATE NOT NULL,
    orders_count INTEGER NOT NULL
  ) ON COMMIT DROP;

  IF v_total_rows > 0 THEN
    INSERT INTO tmp_orders_import (employee_id, app_id, date, orders_count)
    SELECT
      x.employee_id::UUID,
      x.app_id::UUID,
      x.date::DATE,
      x.orders_count::INTEGER
    FROM jsonb_to_recordset(COALESCE(p_rows, '[]'::jsonb)) AS x(
      employee_id TEXT,
      app_id TEXT,
      date TEXT,
      orders_count INTEGER
    );

    IF EXISTS (
      SELECT 1
      FROM tmp_orders_import
      WHERE date < v_start
         OR date > v_end
         OR orders_count <= 0
    ) THEN
      RAISE EXCEPTION 'Input rows must belong to the target month and have positive orders_count';
    END IF;
  END IF;

  DELETE
  FROM public.daily_orders
  WHERE date BETWEEN v_start AND v_end;

  IF v_total_rows > 0 THEN
    INSERT INTO public.daily_orders (
      employee_id,
      app_id,
      date,
      orders_count,
      status,
      source,
      created_by,
      import_batch_id
    )
    SELECT
      employee_id,
      app_id,
      date,
      orders_count,
      'confirmed',
      CASE
        WHEN p_source_type = 'excel' THEN 'excel_import'
        ELSE p_source_type
      END,
      auth.uid(),
      v_batch_id
    FROM tmp_orders_import
    ON CONFLICT (employee_id, date, app_id)
    DO UPDATE SET
      orders_count = EXCLUDED.orders_count,
      status = 'confirmed',
      source = EXCLUDED.source,
      import_batch_id = EXCLUDED.import_batch_id,
      updated_at = now();
  END IF;

  UPDATE public.order_import_batches
  SET
    status = 'completed',
    imported_rows = v_total_rows,
    skipped_rows = 0,
    error_count = 0,
    error_summary = '[]'::jsonb,
    completed_at = now(),
    updated_at = now()
  WHERE id = v_batch_id;

  batch_id := v_batch_id;
  saved_rows := v_total_rows;
  failed_rows := 0;
  RETURN NEXT;

EXCEPTION WHEN OTHERS THEN
  IF v_batch_id IS NOT NULL THEN
    UPDATE public.order_import_batches
    SET
      status = 'failed',
      imported_rows = 0,
      skipped_rows = 0,
      error_count = 1,
      error_summary = jsonb_build_array(SQLERRM),
      completed_at = now(),
      updated_at = now()
    WHERE id = v_batch_id;
  END IF;
  RAISE;
END;
$$;

COMMENT ON FUNCTION public.replace_daily_orders_month_rpc(TEXT, JSONB, TEXT, TEXT, UUID) IS
'Transactional month replacement for daily orders with import-batch tracking.';

REVOKE EXECUTE ON FUNCTION public.replace_daily_orders_month_rpc(TEXT, JSONB, TEXT, TEXT, UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.replace_daily_orders_month_rpc(TEXT, JSONB, TEXT, TEXT, UUID) TO authenticated;

-- Capture a full accounting snapshot for a month
CREATE OR REPLACE FUNCTION public.capture_salary_month_snapshot(
  p_month_year TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public' /* NOSONAR */
AS $$
DECLARE
  v_snapshot JSONB;
  v_summary JSONB;
BEGIN
  IF NOT (
    public.is_active_user(auth.uid())
    AND (
      public.has_role(auth.uid(), _const_role_admin())
      OR public.has_role(auth.uid(), _const_role_finance())
    )
  ) THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;

  IF p_month_year !~ '^\d{4}-\d{2}$' THEN
    RAISE EXCEPTION 'Invalid month_year format. Expected YYYY-MM';
  END IF;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'employee_id', sr.employee_id,
        'month_year', sr.month_year,
        'base_salary', COALESCE(sr.base_salary, 0),
        'allowances', COALESCE(sr.allowances, 0),
        'attendance_deduction', COALESCE(sr.attendance_deduction, 0),
        'advance_deduction', COALESCE(sr.advance_deduction, 0),
        'external_deduction', COALESCE(sr.external_deduction, 0),
        'manual_deduction', COALESCE(sr.manual_deduction, 0),
        'net_salary', COALESCE(sr.net_salary, 0),
        'is_approved', COALESCE(sr.is_approved, false),
        'payment_method', sr.payment_method,
        'sheet_snapshot', sr.sheet_snapshot
      )
      ORDER BY sr.employee_id
    ),
    '[]'::jsonb
  )
  INTO v_snapshot
  FROM public.salary_records AS sr
  WHERE sr.month_year = p_month_year;

  SELECT jsonb_build_object(
    'month_year', p_month_year,
    'records_count', COUNT(*)::INTEGER,
    'approved_count', COUNT(*) FILTER (WHERE COALESCE(sr.is_approved, false))::INTEGER,
    'total_base_salary', COALESCE(SUM(sr.base_salary), 0),
    'total_net_salary', COALESCE(SUM(sr.net_salary), 0),
    'captured_at', now()
  )
  INTO v_summary
  FROM public.salary_records AS sr
  WHERE sr.month_year = p_month_year;

  INSERT INTO public.salary_month_snapshots (
    month_year,
    snapshot,
    summary,
    captured_by,
    captured_at
  )
  VALUES (
    p_month_year,
    COALESCE(v_snapshot, '[]'::jsonb),
    COALESCE(v_summary, '{}'::jsonb),
    auth.uid(),
    now()
  )
  ON CONFLICT (month_year)
  DO UPDATE SET
    snapshot = EXCLUDED.snapshot,
    summary = EXCLUDED.summary,
    captured_by = EXCLUDED.captured_by,
    captured_at = EXCLUDED.captured_at,
    updated_at = now();

  RETURN COALESCE(v_summary, '{}'::jsonb);
END;
$$;

COMMENT ON FUNCTION public.capture_salary_month_snapshot(TEXT) IS
'Freeze a month-level salary snapshot for accounting and reload parity.';

REVOKE EXECUTE ON FUNCTION public.capture_salary_month_snapshot(TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.capture_salary_month_snapshot(TEXT) TO authenticated;

COMMIT;
