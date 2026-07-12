-- ============================================================================
-- Index Audit â€” pg_stat_user_indexes analysis (2026-04-26)
-- ============================================================================
-- Uncomment sections as you decide to act on them.

-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
-- HIGH PRIORITY â€” unused indexes wasting write performance + storage
-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

-- â¶ idx_admin_action_log_created_at  â€”  0 scans , 1032 kB
--    Every INSERT into admin_action_log pays the write penalty
--    of maintaining this index without reads ever using it.
--    DROP INDEX IF EXISTS idx_admin_action_log_created_at;

-- â· idx_daily_orders_perf_employee_date  â€”  0 scans , 168 kB
--    Created for performance_dashboard_rpcs.  If the feature is not yet
--    live, the index is pure overhead on every daily_orders write.
--    DROP INDEX IF EXISTS idx_daily_orders_perf_employee_date;

-- â¸ idx_daily_orders_status  â€”  0 scans , 48 kB
--    Status-based queries may not be967m in use.  Monitor one more week.
--    DROP INDEX IF EXISTS idx_daily_orders_status;

-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
-- LOW PRIORITY â€” tiny indexes (â‰¤16 kB) with â‰¤10 scans
-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
-- These collectively waste ~256 kB and add minor write overhead.
-- Many are pkeys / unique constraints â€” those are SKIPPED below.

-- idx_employees_role_id                â€” 0 scans
-- idx_commercial_records_name_ci       â€” 0 scans
-- idx_salary_records_calc_status       â€” 0 scans
-- idx_attendance_employee_date_late    â€” 0 scans
-- idx_order_import_batches_status      â€” 0 scans
-- idx_finance_transactions_date        â€” 0 scans
-- idx_attendance_employee_status_date  â€” 0 scans
-- idx_employees_residency_expiry       â€” 0 scans

-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
-- HEAVILY-USED â€” keep and monitor
-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
-- user_roles_user_id_role_key          â€” 12.7M scans
-- profiles_pkey                        â€” 9.9M  scans
-- employees_pkey                       â€” 314K  scans
-- idx_daily_shifts_app_date            â€” 116K  scans
-- idx_daily_orders_employee_date       â€” 68K   scans
-- daily_orders_employee_id_date_app_id_key â€” 58K scans
-- salary_schemes_pkey                  â€” 52K   scans
-- auth_rate_limits (edge_rate_limits)  â€” 538   scans (rate-limiting: OK)
