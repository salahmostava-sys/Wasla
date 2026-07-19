-- =============================================================================
-- Fix Supabase Linter Warnings: SECURITY DEFINER Function Permissions
-- =============================================================================
-- This migration addresses security warnings about SECURITY DEFINER functions
-- being callable by anon/authenticated roles when they shouldn't be.
--
-- Issue: Functions like calculate_salary_for_employee_month, preview_salary_for_month
-- are SECURITY DEFINER but accessible to anon/authenticated roles.
--
-- Solution: Revoke EXECUTE from anon/authenticated, grant only to service_role
-- (already done in some migrations, but ensuring consistency)

-- =============================================================================
-- 1. Salary Calculation Functions (should be service_role only)
-- =============================================================================

-- Already has REVOKE in 20260415220000, but ensuring it's applied
REVOKE EXECUTE ON FUNCTION public.calculate_salary_for_employee_month(UUID, TEXT, TEXT, NUMERIC, TEXT) FROM anon;
REVOKE EXECUTE ON FUNCTION public.calculate_salary_for_employee_month(UUID, TEXT, TEXT, NUMERIC, TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.calculate_salary_for_employee_month(UUID, TEXT, TEXT, NUMERIC, TEXT) TO service_role;

REVOKE EXECUTE ON FUNCTION public.preview_salary_for_month(TEXT) FROM anon;
REVOKE EXECUTE ON FUNCTION public.preview_salary_for_month(TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.preview_salary_for_month(TEXT) TO service_role;

-- =============================================================================
-- 2. Permission/Role Check Functions (authenticated only, not anon)
-- =============================================================================

-- These functions check user permissions/roles, so they should be:
-- - NOT callable by anon (unauthenticated users)
-- - Callable by authenticated users (to check their own permissions)
-- - Callable by service_role (for admin operations)

-- has_permission: checks if current user has a specific permission
REVOKE EXECUTE ON FUNCTION public.has_permission(TEXT, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.has_permission(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_permission(TEXT, TEXT) TO service_role;

-- has_role: checks if a user has a specific role
REVOKE EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) FROM anon;
GRANT EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) TO service_role;

-- is_active_user: checks if a user is active
REVOKE EXECUTE ON FUNCTION public.is_active_user(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.is_active_user(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_active_user(UUID) TO service_role;

-- is_admin_or_hr: checks if user is admin or HR
REVOKE EXECUTE ON FUNCTION public.is_admin_or_hr(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.is_admin_or_hr(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin_or_hr(UUID) TO service_role;

-- is_internal_user: checks if current user is internal
REVOKE EXECUTE ON FUNCTION public.is_internal_user() FROM anon;
GRANT EXECUTE ON FUNCTION public.is_internal_user() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_internal_user() TO service_role;

-- =============================================================================
-- 3. Constant Functions (public read-only, safe for all roles)
-- =============================================================================

-- These are IMMUTABLE functions that return constants, safe for all roles
-- They don't access any data, just return literal values
-- Keep them accessible to all roles for convenience

GRANT EXECUTE ON FUNCTION public._const_order_cancelled() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public._const_installment_pending() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public._const_installment_deferred() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public._const_approval_approved() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public._const_work_orders() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public._const_work_shift() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public._const_work_hybrid() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public._const_days_per_month() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public._const_employee_active() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public._const_payment_cash() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public._const_payment_bank() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public._const_calc_calculated() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public._const_tier_fixed() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public._const_tier_incremental() TO anon, authenticated, service_role;

-- =============================================================================
-- Summary of Access Control
-- =============================================================================

-- Function Type                    | anon | authenticated | service_role
-- ---------------------------------|------|---------------|-------------
-- Salary Calculations              |  âŒ  |      âŒ       |      âœ…
-- Permission/Role Checks           |  âŒ  |      âœ…       |      âœ…
-- Constants (read-only)            |  âœ…  |      âœ…       |      âœ…

COMMENT ON FUNCTION public.calculate_salary_for_employee_month(UUID, TEXT, TEXT, NUMERIC, TEXT) IS 
  'SECURITY DEFINER - service_role only. Calculates and saves salary for an employee.';

COMMENT ON FUNCTION public.preview_salary_for_month(TEXT) IS 
  'SECURITY DEFINER - service_role only. Previews salary calculations for all employees.';

COMMENT ON FUNCTION public.has_permission(TEXT, TEXT) IS 
  'SECURITY DEFINER - authenticated only. Checks if current user has a specific permission.';

COMMENT ON FUNCTION public.has_role(UUID, public.app_role) IS 
  'SECURITY DEFINER - authenticated only. Checks if a user has a specific role.';

COMMENT ON FUNCTION public.is_admin_or_hr(UUID) IS 
  'SECURITY DEFINER - authenticated only. Checks if user is admin or HR.';

NOTIFY pgrst, 'reload schema';
