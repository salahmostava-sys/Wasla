BEGIN;

CREATE OR REPLACE FUNCTION private.alerts_summary_rpc(
  p_expiry_horizon date,
  p_urgent_horizon date
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, private
AS $$
DECLARE
  v_summary jsonb;
BEGIN
  IF p_expiry_horizon IS NULL OR p_urgent_horizon IS NULL THEN
    RAISE EXCEPTION 'Alert horizons are required' USING ERRCODE = '22004';
  END IF;

  IF p_urgent_horizon > p_expiry_horizon THEN
    RAISE EXCEPTION 'Urgent horizon cannot exceed expiry horizon' USING ERRCODE = '22023';
  END IF;

  IF COALESCE(auth.role(), '') <> 'service_role'
     AND NOT COALESCE(public.has_permission('alerts', 'view'), false) THEN
    RAISE EXCEPTION 'Insufficient permission to view alerts' USING ERRCODE = '42501';
  END IF;

  WITH employee_alerts AS (
    SELECT
      due.prefix || employee.id::text AS source_key,
      due.due_date,
      due.due_date <= p_urgent_horizon
        AND (NOT due.is_probation OR due.due_date >= CURRENT_DATE) AS is_urgent
    FROM public.employees AS employee
    CROSS JOIN LATERAL (
      VALUES
        ('res-', employee.residency_expiry, false),
        ('prob-', employee.probation_end_date, true),
        ('hi-', employee.health_insurance_expiry, false),
        ('lic-', employee.license_expiry, false)
    ) AS due(prefix, due_date, is_probation)
    WHERE employee.status::text = 'active'
      AND COALESCE(lower(employee.sponsorship_status::text), '') <> ALL (
        ARRAY['absconded', 'expired', 'terminated', 'inactive', 'canceled', 'final_exit']
      )
      AND due.due_date IS NOT NULL
      AND due.due_date <= p_expiry_horizon
  ),
  vehicle_alerts AS (
    SELECT
      due.prefix || vehicle.id::text AS source_key,
      due.due_date,
      due.due_date <= p_urgent_horizon AS is_urgent
    FROM public.vehicles AS vehicle
    CROSS JOIN LATERAL (
      VALUES
        ('ins-', vehicle.insurance_expiry),
        ('auth-', vehicle.authorization_expiry)
    ) AS due(prefix, due_date)
    WHERE vehicle.status::text IN ('active', 'maintenance', 'rental')
      AND due.due_date IS NOT NULL
      AND due.due_date <= p_expiry_horizon
  ),
  platform_alerts AS (
    SELECT
      'pla-' || account.id::text AS source_key,
      account.iqama_expiry_date AS due_date,
      account.iqama_expiry_date <= p_urgent_horizon AS is_urgent
    FROM public.platform_accounts AS account
    WHERE account.status = 'active'
      AND account.iqama_expiry_date IS NOT NULL
      AND account.iqama_expiry_date <= p_expiry_horizon
  ),
  absconded_alerts AS (
    SELECT
      'absconded-' || employee.id::text AS source_key,
      CURRENT_DATE AS due_date,
      true AS is_urgent
    FROM public.employees AS employee
    WHERE employee.status::text = 'active'
      AND lower(employee.sponsorship_status::text) = 'absconded'
  ),
  rental_effective_dates AS (
    SELECT
      vehicle.id,
      GREATEST(CURRENT_DATE, vehicle.rental_start_date)::date AS effective_date,
      EXTRACT(DAY FROM vehicle.rental_start_date)::integer AS rental_day
    FROM public.vehicles AS vehicle
    WHERE vehicle.status::text = 'rental'
      AND vehicle.rental_start_date IS NOT NULL
  ),
  rental_current_month_due_dates AS (
    SELECT
      rental.id,
      rental.effective_date,
      rental.rental_day,
      (
        date_trunc('month', rental.effective_date)::date
        + LEAST(
          rental.rental_day,
          EXTRACT(DAY FROM (
            date_trunc('month', rental.effective_date) + INTERVAL '1 month - 1 day'
          ))::integer
        ) - 1
      )::date AS current_month_due_date
    FROM rental_effective_dates AS rental
  ),
  rental_alerts AS (
    SELECT
      'rental-' || rental.id::text AS source_key,
      due.next_due_date AS due_date,
      due.next_due_date <= CURRENT_DATE + 1 AS is_urgent
    FROM rental_current_month_due_dates AS rental
    CROSS JOIN LATERAL (
      SELECT CASE
        WHEN rental.current_month_due_date >= rental.effective_date
          THEN rental.current_month_due_date
        ELSE (
          (date_trunc('month', rental.effective_date) + INTERVAL '1 month')::date
          + LEAST(
            rental.rental_day,
            EXTRACT(DAY FROM (
              date_trunc('month', rental.effective_date) + INTERVAL '2 months - 1 day'
            ))::integer
          ) - 1
        )::date
      END AS next_due_date
    ) AS due
    WHERE due.next_due_date <= CURRENT_DATE + 5
  ),
  generated_alerts AS (
    SELECT * FROM employee_alerts
    UNION ALL
    SELECT * FROM vehicle_alerts
    UNION ALL
    SELECT * FROM platform_alerts
    UNION ALL
    SELECT * FROM absconded_alerts
    UNION ALL
    SELECT * FROM rental_alerts
  ),
  active_generated_alerts AS (
    SELECT generated.*
    FROM generated_alerts AS generated
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.alerts AS persisted
      WHERE persisted.source_key = generated.source_key
        AND (
          persisted.due_date IS NULL
          OR persisted.due_date = generated.due_date
          OR (
            persisted.status = 'snoozed'
            AND persisted.snoozed_until = persisted.due_date
          )
        )
        AND (
          persisted.is_resolved IS TRUE
          OR persisted.status = 'resolved'
        )
    )
  ),
  unique_persisted_alerts AS (
    SELECT
      COALESCE(persisted.source_key, persisted.id::text) AS source_key,
      COALESCE(persisted.due_date, CURRENT_DATE) AS due_date,
      COALESCE(persisted.due_date, CURRENT_DATE) <= p_urgent_horizon AS is_urgent
    FROM public.alerts AS persisted
    WHERE COALESCE(persisted.is_resolved, false) IS FALSE
      AND COALESCE(persisted.status, 'open') <> 'resolved'
      AND NOT EXISTS (
        SELECT 1
        FROM generated_alerts AS generated
        WHERE generated.source_key = persisted.source_key
          AND (
            persisted.due_date IS NULL
            OR persisted.due_date = generated.due_date
            OR (
              persisted.status = 'snoozed'
              AND persisted.snoozed_until = persisted.due_date
            )
          )
      )
  ),
  active_alerts AS (
    SELECT source_key, due_date, is_urgent FROM active_generated_alerts
    UNION ALL
    SELECT source_key, due_date, is_urgent FROM unique_persisted_alerts
  )
  SELECT jsonb_build_object(
    'unresolved_count', COUNT(*)::integer,
    'urgent_count', COUNT(*) FILTER (WHERE is_urgent)::integer
  )
  INTO v_summary
  FROM active_alerts;

  RETURN v_summary;
END;
$$;

REVOKE ALL ON FUNCTION private.alerts_summary_rpc(date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.alerts_summary_rpc(date, date) TO authenticated, service_role;

SET LOCAL request.jwt.claims = '{"role":"service_role"}';
SELECT private.alerts_summary_rpc(CURRENT_DATE + 90, CURRENT_DATE + 7);
ROLLBACK;
