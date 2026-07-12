-- Fix all recursive and potentially recursive constant functions in the database to prevent statement timeouts and stack depth limit errors.
CREATE OR REPLACE FUNCTION public._const_order_cancelled() RETURNS TEXT LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path TO public AS 'SELECT ''cancelled''::TEXT;';
CREATE OR REPLACE FUNCTION public._const_installment_pending() RETURNS TEXT LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path TO public AS 'SELECT ''pending''::TEXT;';
CREATE OR REPLACE FUNCTION public._const_installment_deferred() RETURNS TEXT LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path TO public AS 'SELECT ''deferred''::TEXT;';
CREATE OR REPLACE FUNCTION public._const_approval_approved() RETURNS TEXT LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path TO public AS 'SELECT ''approved''::TEXT;';
CREATE OR REPLACE FUNCTION public._const_work_orders() RETURNS TEXT LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path TO public AS 'SELECT ''orders''::TEXT;';
CREATE OR REPLACE FUNCTION public._const_work_shift() RETURNS TEXT LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path TO public AS 'SELECT ''shift''::TEXT;';
CREATE OR REPLACE FUNCTION public._const_work_hybrid() RETURNS TEXT LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path TO public AS 'SELECT ''hybrid''::TEXT;';
CREATE OR REPLACE FUNCTION public._const_days_per_month() RETURNS NUMERIC LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path TO public AS 'SELECT 30.0::NUMERIC;';
CREATE OR REPLACE FUNCTION public._const_employee_active() RETURNS TEXT LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path TO public AS 'SELECT ''active''::TEXT;';
CREATE OR REPLACE FUNCTION public._const_payment_cash() RETURNS TEXT LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path TO public AS 'SELECT ''cash''::TEXT;';
CREATE OR REPLACE FUNCTION public._const_payment_bank() RETURNS TEXT LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path TO public AS 'SELECT ''bank''::TEXT;';
CREATE OR REPLACE FUNCTION public._const_calc_calculated() RETURNS TEXT LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path TO public AS 'SELECT ''calculated''::TEXT;';
CREATE OR REPLACE FUNCTION public._const_calc_source_v6() RETURNS TEXT LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path TO public AS 'SELECT ''engine_v6_shift_fallback''::TEXT;';
CREATE OR REPLACE FUNCTION public._const_calc_source_v7() RETURNS TEXT LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path TO public AS 'SELECT ''engine_v7_shift_fixed''::TEXT;';
CREATE OR REPLACE FUNCTION public._const_calc_method_orders() RETURNS TEXT LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path TO public AS 'SELECT ''orders''::TEXT;';
CREATE OR REPLACE FUNCTION public._const_calc_method_shift() RETURNS TEXT LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path TO public AS 'SELECT ''shift''::TEXT;';
CREATE OR REPLACE FUNCTION public._const_calc_method_shift_fixed() RETURNS TEXT LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path TO public AS 'SELECT ''shift_fixed''::TEXT;';
CREATE OR REPLACE FUNCTION public._const_calc_method_shift_full_month() RETURNS TEXT LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path TO public AS 'SELECT ''shift_full_month''::TEXT;';
CREATE OR REPLACE FUNCTION public._const_calc_method_mixed() RETURNS TEXT LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path TO public AS 'SELECT ''mixed''::TEXT;';
CREATE OR REPLACE FUNCTION public._const_calc_method_orders_fallback() RETURNS TEXT LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path TO public AS 'SELECT ''orders_fallback''::TEXT;';
CREATE OR REPLACE FUNCTION public._const_tier_fixed() RETURNS TEXT LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path TO public AS 'SELECT ''fixed_amount''::TEXT;';
CREATE OR REPLACE FUNCTION public._const_tier_incremental() RETURNS TEXT LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path TO public AS 'SELECT ''base_plus_incremental''::TEXT;';

-- Role Constants (returning app_role enum type)
CREATE OR REPLACE FUNCTION public._const_role_admin() RETURNS public.app_role LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path TO public AS 'SELECT ''admin''::public.app_role;';
CREATE OR REPLACE FUNCTION public._const_role_hr() RETURNS public.app_role LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path TO public AS 'SELECT ''hr''::public.app_role;';
CREATE OR REPLACE FUNCTION public._const_role_finance() RETURNS public.app_role LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path TO public AS 'SELECT ''finance''::public.app_role;';
CREATE OR REPLACE FUNCTION public._const_role_operations() RETURNS public.app_role LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path TO public AS 'SELECT ''operations''::public.app_role;';
CREATE OR REPLACE FUNCTION public._const_role_viewer() RETURNS public.app_role LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path TO public AS 'SELECT ''viewer''::public.app_role;';
