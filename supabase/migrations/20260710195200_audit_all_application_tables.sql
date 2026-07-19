-- Ensure the activity log captures CUD changes across all application tables.
-- Excludes audit tables themselves to avoid recursive logging.

CREATE OR REPLACE FUNCTION public.log_audit_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public /* NOSONAR */
AS $$
DECLARE
  v_row jsonb;
  v_id_text text;
  v_record_id uuid;
BEGIN
  v_row := CASE WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END;
  v_id_text := v_row ->> 'id';

  IF v_id_text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    v_record_id := v_id_text::uuid;
  END IF;

  INSERT INTO public.audit_log (user_id, table_name, action, record_id, old_value, new_value)
  VALUES (
    auth.uid(),
    TG_TABLE_NAME,
    TG_OP,
    v_record_id,
    CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) ELSE NULL END,
    CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) ELSE NULL END
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

DO $$
DECLARE
  v_table text;
  v_tables text[] := ARRAY[
    'profiles',
    'user_roles',
    'user_permissions',
    'trade_registers',
    'apps',
    'app_monthly_activations',
    'app_targets',
    'pricing_rules',
    'platform_accounts',
    'account_assignments',
    'salary_schemes',
    'salary_scheme_tiers',
    'salary_tiers',
    'salary_records',
    'salary_deductions',
    'salary_drafts',
    'salary_month_snapshots',
    'salary_slip_templates',
    'scheme_month_snapshots',
    'employees',
    'employee_scheme',
    'employee_apps',
    'employee_tiers',
    'employee_roles',
    'employee_targets',
    'employee_wallet_transactions',
    'attendance',
    'attendance_status_configs',
    'daily_orders',
    'daily_shifts',
    'order_import_batches',
    'advances',
    'advance_installments',
    'external_deductions',
    'vehicles',
    'vehicle_assignments',
    'vehicle_documents',
    'vehicle_mileage',
    'vehicle_mileage_daily',
    'fuel_records',
    'maintenance_logs',
    'maintenance_parts',
    'maintenance_records',
    'spare_parts',
    'treasury_accounts',
    'treasury_categories',
    'treasury_transactions',
    'finance_transactions',
    'commercial_records',
    'departments',
    'positions',
    'leave_requests',
    'hr_performance_reviews',
    'alerts',
    'locked_months',
    'system_settings'
  ];
BEGIN
  FOREACH v_table IN ARRAY v_tables LOOP
    IF to_regclass(format('public.%I', v_table)) IS NOT NULL THEN
      EXECUTE format('DROP TRIGGER IF EXISTS audit_%I ON public.%I', v_table, v_table);
      EXECUTE format(
        'CREATE TRIGGER audit_%I AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.log_audit_event()',
        v_table,
        v_table
      );
    END IF;
  END LOOP;
END;
$$;
