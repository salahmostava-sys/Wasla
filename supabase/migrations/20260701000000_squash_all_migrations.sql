-- ============================================================
-- FILE: 20260701000000_squash_all_migrations.sql
-- PURPOSE: Squashed baseline schema - consolidation of 180 migration files
-- CREATED: 2026-07-01
-- NOTE: This file contains the complete schema (tables, functions, RLS, indexes)
--       for a fresh database setup. DO NOT apply this to production!
--       Production already has all migrations applied.
-- USAGE: Use this file ONLY for:
--        - Local development (fresh DB setup)
--        - New developer onboarding
--        - Disaster recovery (if needed)
-- ============================================================

-- SECTION 1: Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- SECTION 2: ENUMs
-- FILE: 20260226083236_a06ac86d-f40a-4105-8231-3099763861e3.sql
﻿
CREATE TYPE public.app_role AS ENUM ('admin', 'hr', 'finance', 'operations', 'viewer');

-- NOSONAR
CREATE TYPE public.salary_type AS ENUM (_const_work_shift(), _const_work_orders());

CREATE TYPE public.employee_status AS ENUM (_const_employee_active(), 'inactive', 'ended');

CREATE TYPE public.attendance_status AS ENUM ('present', 'absent', 'leave', 'sick', 'late');

CREATE TYPE public.vehicle_type AS ENUM ('motorcycle', 'car');

CREATE TYPE public.vehicle_status AS ENUM (_const_employee_active(), 'maintenance', 'inactive');

CREATE TYPE public.advance_status AS ENUM (_const_employee_active(), 'completed', 'paused');

CREATE TYPE public.installment_status AS ENUM (_const_installment_pending(), 'deducted', _const_installment_deferred());

CREATE TYPE public.deduction_type AS ENUM ('fine', 'return', 'delay', 'accident', 'other');

CREATE TYPE public.approval_status AS ENUM (_const_installment_pending(), _const_approval_approved(), 'rejected');

CREATE TYPE public.maintenance_type AS ENUM ('routine', 'breakdown', 'accident');

CREATE TYPE public.scheme_status AS ENUM (_const_employee_active(), 'archived');

-- FILE: 20260305073335_6a77e95f-f6cd-4721-bd47-d67009b898d8.sql
﻿
CREATE TYPE public.city_enum AS ENUM ('makkah', 'jeddah');

CREATE TYPE public.license_status_enum AS ENUM ('has_license', 'no_license', 'applied');

CREATE TYPE public.sponsorship_status_enum AS ENUM ('sponsored', 'not_sponsored', 'absconded', 'terminated');

-- SECTION 3: Tables
-- TABLE: account_assignments
CREATE TABLE IF NOT EXISTS public.account_assignments (
    id          UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    account_id  UUID        NOT NULL REFERENCES public.platform_accounts(id) ON DELETE CASCADE,
    employee_id UUID        NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
    start_date  DATE        NOT NULL,
    end_date    DATE,
    month_year  TEXT        NOT NULL,
    -- YYYY-MM
  notes       TEXT,
    created_by  UUID        REFERENCES auth.users(id),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.account_assignments ENABLE ROW LEVEL SECURITY;


-- TABLE: admin_action_log
CREATE TABLE IF NOT EXISTS public.admin_action_log (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at timestamptz NOT NULL DEFAULT now(),
    user_id uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
    action text NOT NULL,
    table_name text NULL,
    record_id text NULL,
    meta jsonb NOT NULL DEFAULT '{}'::jsonb,
    company_id uuid NULL
);
ALTER TABLE public.admin_action_log ENABLE ROW LEVEL SECURITY;


-- TABLE: advances
CREATE TABLE IF NOT EXISTS public.advances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
    amount NUMERIC(10,2) NOT NULL,
    disbursement_date DATE NOT NULL DEFAULT CURRENT_DATE,
    total_installments INT NOT NULL DEFAULT 1,
    monthly_amount NUMERIC(10,2) NOT NULL,
    first_deduction_month TEXT NOT NULL,
    note TEXT,
    status public.advance_status NOT NULL DEFAULT _const_employee_active(),
    approved_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    is_written_off boolean NOT NULL DEFAULT false,
    written_off_at timestamp with time zone,
    written_off_reason text,
    company_id uuid,
    created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);
ALTER TABLE public.advances ENABLE ROW LEVEL SECURITY;


-- TABLE: advance_installments
CREATE TABLE IF NOT EXISTS public.advance_installments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    advance_id UUID NOT NULL REFERENCES public.advances(id) ON DELETE CASCADE,
    month_year TEXT NOT NULL,
    amount NUMERIC(10,2) NOT NULL,
    status public.installment_status NOT NULL DEFAULT _const_installment_pending(),
    deducted_at TIMESTAMPTZ,
    notes text,
    company_id uuid,
    created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);
ALTER TABLE public.advance_installments ENABLE ROW LEVEL SECURITY;


-- TABLE: alerts
CREATE TABLE IF NOT EXISTS public.alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type TEXT NOT NULL,
    entity_id UUID,
    entity_type TEXT,
    due_date DATE,
    is_resolved BOOLEAN NOT NULL DEFAULT false,
    resolved_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    message TEXT,
    details JSONB,
    company_id uuid
);
ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;


-- TABLE: apps
CREATE TABLE IF NOT EXISTS public.apps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    name_en TEXT,
    logo_url TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    is_archived BOOLEAN NOT NULL DEFAULT false,
    brand_color TEXT NOT NULL DEFAULT '#6366f1',
    text_color TEXT NOT NULL DEFAULT '#ffffff',
    scheme_id UUID REFERENCES public.salary_schemes(id) ON DELETE SET NULL,
    custom_columns JSONB DEFAULT '[]'::jsonb,
    company_id uuid
);
ALTER TABLE public.apps ENABLE ROW LEVEL SECURITY;


-- TABLE: app_hybrid_rules
CREATE TABLE IF NOT EXISTS public.app_hybrid_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    app_id UUID NOT NULL REFERENCES apps(id) ON DELETE CASCADE UNIQUE,
    min_hours_for_shift DECIMAL(4,2) NOT NULL CHECK (min_hours_for_shift > 0),
    shift_rate DECIMAL(10,2) NOT NULL CHECK (shift_rate >= 0),
    fallback_to_orders BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.app_hybrid_rules ENABLE ROW LEVEL SECURITY;


-- TABLE: app_monthly_activations
CREATE TABLE IF NOT EXISTS public.app_monthly_activations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    app_id UUID NOT NULL REFERENCES public.apps(id) ON DELETE CASCADE,
    month_year TEXT NOT NULL,
    -- Format: YYYY-MM
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(app_id, month_year)
);
ALTER TABLE public.app_monthly_activations ENABLE ROW LEVEL SECURITY;


-- TABLE: app_targets
CREATE TABLE IF NOT EXISTS public.app_targets (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    app_id uuid NOT NULL REFERENCES public.apps(id) ON DELETE CASCADE,
    month_year text NOT NULL,
    target_orders integer NOT NULL DEFAULT 0,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    UNIQUE (app_id, month_year),
    company_id uuid
);
ALTER TABLE public.app_targets ENABLE ROW LEVEL SECURITY;


-- TABLE: attendance
CREATE TABLE IF NOT EXISTS public.attendance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    status public.attendance_status NOT NULL DEFAULT 'present',
    check_in TIME,
    check_out TIME,
    note TEXT,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(employee_id, date),
    total_hours NUMERIC(6,
    late BOOLEAN NOT NULL DEFAULT false,
    early_leave BOOLEAN NOT NULL DEFAULT false,
    company_id uuid,
    updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;


-- TABLE: attendance_status_configs
CREATE TABLE IF NOT EXISTS public.attendance_status_configs (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    name text NOT NULL,
    color text NOT NULL DEFAULT '#6366f1',
    created_at timestamptz DEFAULT now()
);
ALTER TABLE public.attendance_status_configs ENABLE ROW LEVEL SECURITY;


-- TABLE: audit_log
CREATE TABLE IF NOT EXISTS public.audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id),
    action TEXT NOT NULL,
    table_name TEXT NOT NULL,
    record_id UUID,
    old_value JSONB,
    new_value JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    company_id uuid
);
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;


-- TABLE: commercial_records
CREATE TABLE IF NOT EXISTS public.commercial_records (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT commercial_records_name_not_blank CHECK (btrim(name) <> '')
);
ALTER TABLE public.commercial_records ENABLE ROW LEVEL SECURITY;


-- TABLE: daily_orders
CREATE TABLE IF NOT EXISTS public.daily_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    app_id UUID NOT NULL REFERENCES public.apps(id),
    orders_count INT NOT NULL DEFAULT 0,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(employee_id, date, app_id),
    source TEXT NOT NULL DEFAULT 'manual',
    company_id uuid,
    updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    import_batch_id UUID REFERENCES public.order_import_batches(id) ON DELETE SET NULL
);
ALTER TABLE public.daily_orders ENABLE ROW LEVEL SECURITY;


-- TABLE: daily_shifts
CREATE TABLE IF NOT EXISTS public.daily_shifts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    app_id UUID NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    hours_worked DECIMAL(4,2) NOT NULL CHECK (hours_worked >= 0 AND hours_worked <= 24),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT daily_shifts_unique_employee_app_date UNIQUE(employee_id, app_id, date)
);
ALTER TABLE public.daily_shifts ENABLE ROW LEVEL SECURITY;


-- TABLE: departments
CREATE TABLE IF NOT EXISTS public.departments (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    name_en TEXT,
    description TEXT,
    manager_id UUID,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    company_id uuid
);
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;


-- TABLE: edge_rate_limits
CREATE TABLE IF NOT EXISTS public.edge_rate_limits (
    key text PRIMARY KEY,
    window_start timestamptz NOT NULL,
    request_count integer NOT NULL DEFAULT 0,
    updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.edge_rate_limits ENABLE ROW LEVEL SECURITY;


-- TABLE: employees
CREATE TABLE IF NOT EXISTS public.employees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    name_en TEXT,
    phone TEXT,
    national_id TEXT UNIQUE,
    iban TEXT,
    is_sponsored BOOLEAN NOT NULL DEFAULT false,
    dob DATE,
    residency_expiry DATE,
    license_has BOOLEAN NOT NULL DEFAULT false,
    license_expiry DATE,
    email TEXT,
    salary_type public.salary_type NOT NULL DEFAULT _const_work_orders(),
    base_salary NUMERIC(10,2) NOT NULL DEFAULT 0,
    allowances JSONB DEFAULT '{}',
    status public.employee_status NOT NULL DEFAULT _const_employee_active(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    job_title text,
    bank_account_number text,
    city public.city_enum,
    join_date date,
    license_status public.license_status_enum DEFAULT 'no_license',
    sponsorship_status public.sponsorship_status_enum DEFAULT 'not_sponsored',
    id_photo_url text,
    license_photo_url text,
    personal_photo_url text,
    preferred_language text NOT NULL DEFAULT 'ar' CHECK (preferred_language IN ('ar',
    nationality text,
    birth_date date,
    department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
    position_id UUID REFERENCES public.positions(id) ON DELETE SET NULL,
    probation_end_date date NULL,
    health_insurance_expiry date,
    role_id UUID REFERENCES public.roles(id) ON DELETE SET NULL,
    company_id uuid,
    created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    commercial_record TEXT,
    cities text[],
    iqama_photo_url text
);
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;


-- TABLE: employee_apps
CREATE TABLE IF NOT EXISTS public.employee_apps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
    app_id UUID NOT NULL REFERENCES public.apps(id),
    username TEXT,
    status TEXT NOT NULL DEFAULT _const_employee_active(),
    joined_date DATE,
    UNIQUE(employee_id, app_id),
    company_id uuid
);
ALTER TABLE public.employee_apps ENABLE ROW LEVEL SECURITY;


-- TABLE: employee_roles
CREATE TABLE IF NOT EXISTS public.employee_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
    role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE RESTRICT,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    assigned_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    is_primary BOOLEAN NOT NULL DEFAULT false,
    UNIQUE (employee_id, role_id)
);
ALTER TABLE public.employee_roles ENABLE ROW LEVEL SECURITY;


-- TABLE: employee_scheme
CREATE TABLE IF NOT EXISTS public.employee_scheme (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
    scheme_id UUID NOT NULL REFERENCES public.salary_schemes(id),
    assigned_date DATE NOT NULL DEFAULT CURRENT_DATE,
    assigned_by UUID REFERENCES auth.users(id),
    company_id uuid
);
ALTER TABLE public.employee_scheme ENABLE ROW LEVEL SECURITY;


-- TABLE: employee_targets
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
ALTER TABLE public.employee_targets ENABLE ROW LEVEL SECURITY;


-- TABLE: employee_tiers
CREATE TABLE IF NOT EXISTS public.employee_tiers (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
    package_type TEXT NOT NULL DEFAULT 'شريحة أساسية',
    start_date DATE NOT NULL DEFAULT CURRENT_DATE,
    renewal_date DATE NOT NULL,
    delivery_status TEXT NOT NULL DEFAULT _const_installment_pending(),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    sim_number text,
    app_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
    company_id uuid
);
ALTER TABLE public.employee_tiers ENABLE ROW LEVEL SECURITY;


-- TABLE: external_deductions
CREATE TABLE IF NOT EXISTS public.external_deductions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
    source_app_id UUID REFERENCES public.apps(id),
    type public.deduction_type NOT NULL DEFAULT 'fine',
    amount NUMERIC(10,2) NOT NULL,
    incident_date DATE,
    apply_month TEXT NOT NULL,
    approval_status public.approval_status NOT NULL DEFAULT _const_installment_pending(),
    note TEXT,
    approved_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    linked_advance_id UUID REFERENCES public.advances(id) ON DELETE SET NULL,
    company_id uuid,
    created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);
ALTER TABLE public.external_deductions ENABLE ROW LEVEL SECURITY;


-- TABLE: finance_transactions
CREATE TABLE IF NOT EXISTS public.finance_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type TEXT NOT NULL CHECK (type IN ('revenue', 'expense')),
    category TEXT NOT NULL,
    description TEXT,
    amount NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
    month_year TEXT NOT NULL,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    is_auto BOOLEAN NOT NULL DEFAULT false,
    reference_type TEXT,
    reference_id UUID,
    notes TEXT,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.finance_transactions ENABLE ROW LEVEL SECURITY;


-- TABLE: hr_performance_reviews
CREATE TABLE IF NOT EXISTS public.hr_performance_reviews (
    id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id         uuid        NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
    month_year          text        NOT NULL CHECK (month_year ~ '^\d{4}-\d{2}$'),
    reviewer_id         uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
    attendance_score    integer     NOT NULL DEFAULT 5 CHECK (attendance_score BETWEEN 1 AND 10),
    performance_score   integer     NOT NULL DEFAULT 5 CHECK (performance_score BETWEEN 1 AND 10),
    behavior_score      integer     NOT NULL DEFAULT 5 CHECK (behavior_score BETWEEN 1 AND 10),
    commitment_score    integer     NOT NULL DEFAULT 5 CHECK (commitment_score BETWEEN 1 AND 10),
    notes               text,
    created_at          timestamptz DEFAULT now(),
    updated_at          timestamptz DEFAULT now(),
    CONSTRAINT hr_reviews_unique_employee_month UNIQUE (employee_id, month_year)
);
ALTER TABLE public.hr_performance_reviews ENABLE ROW LEVEL SECURITY;


-- TABLE: IF
ALTER TABLE IF EXISTS public.employees DROP CONSTRAINT IF EXISTS employees_company_id_fkey;
ALTER TABLE IF EXISTS public.user_roles DROP CONSTRAINT IF EXISTS user_roles_company_id_fkey;
ALTER TABLE IF EXISTS public.user_permissions DROP CONSTRAINT IF EXISTS user_permissions_company_id_fkey;
ALTER TABLE IF EXISTS public.departments DROP CONSTRAINT IF EXISTS departments_company_id_fkey;
ALTER TABLE IF EXISTS public.positions DROP CONSTRAINT IF EXISTS positions_company_id_fkey;
ALTER TABLE IF EXISTS public.apps DROP CONSTRAINT IF EXISTS apps_company_id_fkey;
ALTER TABLE IF EXISTS public.app_targets DROP CONSTRAINT IF EXISTS app_targets_company_id_fkey;
ALTER TABLE IF EXISTS public.salary_schemes DROP CONSTRAINT IF EXISTS salary_schemes_company_id_fkey;
ALTER TABLE IF EXISTS public.salary_scheme_tiers DROP CONSTRAINT IF EXISTS salary_scheme_tiers_company_id_fkey;
ALTER TABLE IF EXISTS public.scheme_month_snapshots DROP CONSTRAINT IF EXISTS scheme_month_snapshots_company_id_fkey;
ALTER TABLE IF EXISTS public.employee_scheme DROP CONSTRAINT IF EXISTS employee_scheme_company_id_fkey;
ALTER TABLE IF EXISTS public.employee_apps DROP CONSTRAINT IF EXISTS employee_apps_company_id_fkey;
ALTER TABLE IF EXISTS public.employee_tiers DROP CONSTRAINT IF EXISTS employee_tiers_company_id_fkey;
ALTER TABLE IF EXISTS public.vehicles DROP CONSTRAINT IF EXISTS vehicles_company_id_fkey;
ALTER TABLE IF EXISTS public.vehicle_assignments DROP CONSTRAINT IF EXISTS vehicle_assignments_company_id_fkey;
ALTER TABLE IF EXISTS public.maintenance_logs DROP CONSTRAINT IF EXISTS maintenance_logs_company_id_fkey;
ALTER TABLE IF EXISTS public.vehicle_mileage DROP CONSTRAINT IF EXISTS vehicle_mileage_company_id_fkey;
ALTER TABLE IF EXISTS public.vehicle_mileage_daily DROP CONSTRAINT IF EXISTS vehicle_mileage_daily_company_id_fkey;
ALTER TABLE IF EXISTS public.daily_orders DROP CONSTRAINT IF EXISTS daily_orders_company_id_fkey;
ALTER TABLE IF EXISTS public.attendance DROP CONSTRAINT IF EXISTS attendance_company_id_fkey;
ALTER TABLE IF EXISTS public.external_deductions DROP CONSTRAINT IF EXISTS external_deductions_company_id_fkey;
ALTER TABLE IF EXISTS public.advances DROP CONSTRAINT IF EXISTS advances_company_id_fkey;
ALTER TABLE IF EXISTS public.advance_installments DROP CONSTRAINT IF EXISTS advance_installments_company_id_fkey;
ALTER TABLE IF EXISTS public.salary_records DROP CONSTRAINT IF EXISTS salary_records_company_id_fkey;
ALTER TABLE IF EXISTS public.pl_records DROP CONSTRAINT IF EXISTS pl_records_company_id_fkey;
ALTER TABLE IF EXISTS public.alerts DROP CONSTRAINT IF EXISTS alerts_company_id_fkey;
ALTER TABLE IF EXISTS public.locked_months DROP CONSTRAINT IF EXISTS locked_months_company_id_fkey;
ALTER TABLE IF EXISTS public.system_settings DROP CONSTRAINT IF EXISTS system_settings_company_id_fkey;
ALTER TABLE IF EXISTS public.audit_log DROP CONSTRAINT IF EXISTS audit_log_company_id_fkey;
ALTER TABLE IF EXISTS public.admin_action_log DROP CONSTRAINT IF EXISTS admin_action_log_company_id_fkey;
ALTER TABLE IF EXISTS public.platform_accounts DROP CONSTRAINT IF EXISTS platform_accounts_company_id_fkey;
ALTER TABLE IF EXISTS public.platform_account_assignments DROP CONSTRAINT IF EXISTS platform_account_assignments_company_id_fkey;
ALTER TABLE IF EXISTS public.employees DROP COLUMN IF EXISTS company_id CASCADE;
ALTER TABLE IF EXISTS public.daily_orders DROP COLUMN IF EXISTS company_id CASCADE;
ALTER TABLE IF EXISTS public.attendance DROP COLUMN IF EXISTS company_id CASCADE;
ALTER TABLE IF EXISTS public.advances DROP COLUMN IF EXISTS company_id CASCADE;
ALTER TABLE IF EXISTS public.advance_installments DROP COLUMN IF EXISTS company_id CASCADE;
ALTER TABLE IF EXISTS public.external_deductions DROP COLUMN IF EXISTS company_id CASCADE;
ALTER TABLE IF EXISTS public.salary_records DROP COLUMN IF EXISTS company_id CASCADE;
ALTER TABLE IF EXISTS public.pl_records DROP COLUMN IF EXISTS company_id CASCADE;
ALTER TABLE IF EXISTS public.user_roles DROP COLUMN IF EXISTS company_id CASCADE;
ALTER TABLE IF EXISTS public.user_permissions DROP COLUMN IF EXISTS company_id CASCADE;
ALTER TABLE IF EXISTS public.departments DROP COLUMN IF EXISTS company_id CASCADE;
ALTER TABLE IF EXISTS public.positions DROP COLUMN IF EXISTS company_id CASCADE;
ALTER TABLE IF EXISTS public.apps DROP COLUMN IF EXISTS company_id CASCADE;
ALTER TABLE IF EXISTS public.app_targets DROP COLUMN IF EXISTS company_id CASCADE;
ALTER TABLE IF EXISTS public.salary_schemes DROP COLUMN IF EXISTS company_id CASCADE;
ALTER TABLE IF EXISTS public.salary_scheme_tiers DROP COLUMN IF EXISTS company_id CASCADE;
ALTER TABLE IF EXISTS public.scheme_month_snapshots DROP COLUMN IF EXISTS company_id CASCADE;
ALTER TABLE IF EXISTS public.employee_scheme DROP COLUMN IF EXISTS company_id CASCADE;
ALTER TABLE IF EXISTS public.employee_apps DROP COLUMN IF EXISTS company_id CASCADE;
ALTER TABLE IF EXISTS public.employee_tiers DROP COLUMN IF EXISTS company_id CASCADE;
ALTER TABLE IF EXISTS public.vehicles DROP COLUMN IF EXISTS company_id CASCADE;
ALTER TABLE IF EXISTS public.vehicle_assignments DROP COLUMN IF EXISTS company_id CASCADE;
ALTER TABLE IF EXISTS public.maintenance_logs DROP COLUMN IF EXISTS company_id CASCADE;
ALTER TABLE IF EXISTS public.vehicle_mileage DROP COLUMN IF EXISTS company_id CASCADE;
ALTER TABLE IF EXISTS public.vehicle_mileage_daily DROP COLUMN IF EXISTS company_id CASCADE;
ALTER TABLE IF EXISTS public.alerts DROP COLUMN IF EXISTS company_id CASCADE;
ALTER TABLE IF EXISTS public.locked_months DROP COLUMN IF EXISTS company_id CASCADE;
ALTER TABLE IF EXISTS public.system_settings DROP COLUMN IF EXISTS company_id CASCADE;
ALTER TABLE IF EXISTS public.audit_log DROP COLUMN IF EXISTS company_id CASCADE;
ALTER TABLE IF EXISTS public.admin_action_log DROP COLUMN IF EXISTS company_id CASCADE;
ALTER TABLE IF EXISTS public.platform_accounts DROP COLUMN IF EXISTS company_id CASCADE;
ALTER TABLE IF EXISTS public.platform_account_assignments DROP COLUMN IF EXISTS company_id CASCADE;
DROP TABLE IF EXISTS public.companies CASCADE;
COMMIT;

-- FILE: 20260327092500_restore_single_org_salary_functions.sql
DROP FUNCTION IF EXISTS public.calculate_salary_for_employee_month(uuid, text, text, numeric, text) CASCADE;
DROP FUNCTION IF EXISTS public.calculate_salary_for_month(text, text) CASCADE;
DROP FUNCTION IF EXISTS public.preview_salary_for_month(text) CASCADE;

-- FILE: 20260327101500_fix_dashboard_overview_city_enum_unknown.sql
﻿-- Fix dashboard_overview_rpc city enum casting issue.

-- FILE: 20260327120000_finalize_remove_company_id_single_org.sql
﻿-- Final cleanup: remove any remaining company_id dependencies.
BEGIN;
ALTER TABLE IF EXISTS public.profiles DROP COLUMN IF EXISTS company_id CASCADE;
ALTER TABLE IF EXISTS public.employees DROP COLUMN IF EXISTS company_id CASCADE;
ALTER TABLE IF EXISTS public.attendance DROP COLUMN IF EXISTS company_id CASCADE;
ALTER TABLE IF EXISTS public.daily_orders DROP COLUMN IF EXISTS company_id CASCADE;
ALTER TABLE IF EXISTS public.advances DROP COLUMN IF EXISTS company_id CASCADE;
ALTER TABLE IF EXISTS public.advance_installments DROP COLUMN IF EXISTS company_id CASCADE;
ALTER TABLE IF EXISTS public.external_deductions DROP COLUMN IF EXISTS company_id CASCADE;
ALTER TABLE IF EXISTS public.salary_records DROP COLUMN IF EXISTS company_id CASCADE;
ALTER TABLE IF EXISTS public.platform_accounts DROP COLUMN IF EXISTS company_id CASCADE;
ALTER TABLE IF EXISTS public.platform_account_assignments DROP COLUMN IF EXISTS company_id CASCADE;
DROP FUNCTION IF EXISTS public.sync_attendance_company_id() CASCADE;
DROP FUNCTION IF EXISTS public.sync_daily_orders_company_id() CASCADE;
DROP FUNCTION IF EXISTS public.sync_advances_company_id() CASCADE;
DROP FUNCTION IF EXISTS public.sync_external_deductions_company_id() CASCADE;
DROP FUNCTION IF EXISTS public.sync_salary_records_company_id() CASCADE;
DROP FUNCTION IF EXISTS public.sync_advance_installments_company_id() CASCADE;
COMMIT;

-- FILE: 20260327120001_avatars_allow_svg_mime.sql
UPDATE storage.buckets
SET allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml']::text[]
WHERE id = 'avatars';

-- FILE: 20260327123500_fix_employees_visibility_after_company_id_removal.sql
BEGIN;
ALTER TABLE IF EXISTS public.account_assignments DROP COLUMN IF EXISTS company_id CASCADE;
COMMIT;

-- FILE: 20260328220000_fleet_spare_parts.sql
﻿-- Fleet: spare parts inventory (single-org RLS aligned with vehicles / fuel)
BEGIN;
ALTER TABLE IF EXISTS public.maintenance_logs RENAME TO maintenance_logs_legacy_pre_fleet;

-- TABLE: leave_requests
CREATE TABLE IF NOT EXISTS public.leave_requests (
    id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id      uuid        NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
    type             text        NOT NULL CHECK (type IN ('annual','sick','emergency','unpaid','other')),
    start_date       date        NOT NULL,
    end_date         date        NOT NULL,
    days_count       integer     NOT NULL CHECK (days_count > 0),
    status           text        NOT NULL DEFAULT _const_installment_pending() CHECK (status IN (_const_installment_pending(),
    _const_approval_approved(),'rejected')),
    reason           text,
    reviewer_id      uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
    review_note      text,
    reviewed_at      timestamptz,
    created_by       uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at       timestamptz DEFAULT now(),
    updated_at       timestamptz DEFAULT now(),
    CONSTRAINT leave_dates_check CHECK (end_date >= start_date)
);
ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;


-- TABLE: locked_months
CREATE TABLE IF NOT EXISTS public.locked_months (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    month_year TEXT NOT NULL UNIQUE,
    locked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    locked_by UUID REFERENCES auth.users(id),
    company_id uuid
);
ALTER TABLE public.locked_months ENABLE ROW LEVEL SECURITY;


-- TABLE: maintenance_logs
CREATE TABLE IF NOT EXISTS public.maintenance_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vehicle_id UUID NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
    type public.maintenance_type NOT NULL DEFAULT 'routine',
    description TEXT,
    cost NUMERIC(10,2) DEFAULT 0,
    paid_by TEXT DEFAULT 'company',
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    status TEXT DEFAULT 'completed',
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    company_id uuid
);
ALTER TABLE public.maintenance_logs ENABLE ROW LEVEL SECURITY;


-- TABLE: maintenance_parts
CREATE TABLE IF NOT EXISTS public.maintenance_parts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    maintenance_log_id UUID NOT NULL REFERENCES public.maintenance_logs(id) ON DELETE CASCADE,
    part_id UUID NOT NULL REFERENCES public.spare_parts(id) ON DELETE RESTRICT,
    quantity_used NUMERIC(10, 2) NOT NULL,
    cost_at_time NUMERIC(10, 2) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.maintenance_parts ENABLE ROW LEVEL SECURITY;


-- TABLE: order_import_batches
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
ALTER TABLE public.order_import_batches ENABLE ROW LEVEL SECURITY;


-- TABLE: platform_accounts
CREATE TABLE IF NOT EXISTS public.platform_accounts (
    id                     UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    app_id                 UUID        NOT NULL REFERENCES public.apps(id) ON DELETE CASCADE,
    account_username       TEXT        NOT NULL,
    account_id_on_platform TEXT,
    iqama_number           TEXT,
    iqama_expiry_date      DATE,
    status                 TEXT        NOT NULL DEFAULT _const_employee_active()
                           CHECK (status IN (_const_employee_active(), 'inactive')),
    notes                  TEXT,
    created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
    employee_id UUID REFERENCES public.employees(id) ON DELETE SET NULL
);
ALTER TABLE public.platform_accounts ENABLE ROW LEVEL SECURITY;


-- TABLE: pl_records
CREATE TABLE IF NOT EXISTS public.pl_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    month_year TEXT NOT NULL UNIQUE,
    revenue_riders NUMERIC(10,2) NOT NULL DEFAULT 0,
    revenue_other NUMERIC(10,2) NOT NULL DEFAULT 0,
    cost_salaries NUMERIC(10,2) NOT NULL DEFAULT 0,
    cost_vehicles NUMERIC(10,2) NOT NULL DEFAULT 0,
    cost_deductions NUMERIC(10,2) NOT NULL DEFAULT 0,
    cost_other NUMERIC(10,2) NOT NULL DEFAULT 0,
    notes TEXT,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    company_id uuid,
    updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);
ALTER TABLE public.pl_records ENABLE ROW LEVEL SECURITY;


-- TABLE: positions
CREATE TABLE IF NOT EXISTS public.positions (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    name_en TEXT,
    department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    company_id uuid
);
ALTER TABLE public.positions ENABLE ROW LEVEL SECURITY;


-- TABLE: pricing_rules
CREATE TABLE IF NOT EXISTS public.pricing_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    app_id UUID NOT NULL REFERENCES public.apps(id) ON DELETE CASCADE,
    min_orders INTEGER NOT NULL DEFAULT 0,
    max_orders INTEGER,
    rule_type TEXT NOT NULL DEFAULT 'per_order' -- NOSONAR
    CHECK (rule_type IN ('per_order',
    'fixed',
    _const_work_hybrid())),
    rate_per_order NUMERIC(10,2),
    fixed_salary NUMERIC(10,2),
    bonus_target_orders INTEGER,
    bonus_amount NUMERIC(10,2),
    is_active BOOLEAN NOT NULL DEFAULT true,
    priority INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT pricing_rules_order_range_chk CHECK (
    max_orders IS NULL OR max_orders >= min_orders
  ),
    CONSTRAINT pricing_rules_payload_chk CHECK (
    (rule_type = 'per_order' AND rate_per_order IS NOT NULL) OR
    (rule_type = 'fixed' AND fixed_salary IS NOT NULL) OR
    (rule_type = _const_work_hybrid() AND rate_per_order IS NOT NULL AND fixed_salary IS NOT NULL)
  )
);
ALTER TABLE public.pricing_rules ENABLE ROW LEVEL SECURITY;


-- TABLE: profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url text;
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('avatars', 'avatars', true, 2097152, ARRAY['image/jpeg','image/png','image/webp']) -- NOSONAR
ON CONFLICT (id) DO NOTHING;

-- FILE: 20260308075948_985c6682-cdd2-4600-b9e6-5cd61215cebd.sql
﻿
ALTER TABLE public.profiles
ALTER COLUMN is_active SET DEFAULT false;

-- FILE: 20260324140000_pricing_rules.sql
﻿-- Pricing rules for payroll calculation (db-driven)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS company_id uuid;
ALTER TABLE public.profiles
  ALTER COLUMN company_id SET DEFAULT public.jwt_company_id();
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_company_id_fkey
      FOREIGN KEY (company_id) REFERENCES public.trade_registers(id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'attendance_company_id_fkey'
      AND conrelid = 'public.attendance'::regclass
  ) THEN
    ALTER TABLE public.attendance
      ADD CONSTRAINT attendance_company_id_fkey
      FOREIGN KEY (company_id) REFERENCES public.trade_registers(id);
  END IF;

-- FILE: 20260325233000_fix_employees_rls_company_id_null.sql
-- Fix employees RLS when jwt_company_id() is NULL.

-- TABLE: roles
CREATE TABLE IF NOT EXISTS public.roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL UNIQUE CHECK (title IN ('admin', 'hr', 'accountant', 'viewer', 'operations')),
    permissions JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;


-- TABLE: salary_drafts
CREATE TABLE IF NOT EXISTS public.salary_drafts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    month_year TEXT NOT NULL,
    employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
    draft_data JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    UNIQUE(user_id, month_year, employee_id)
);
ALTER TABLE public.salary_drafts ENABLE ROW LEVEL SECURITY;


-- TABLE: salary_month_snapshots
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
ALTER TABLE public.salary_month_snapshots ENABLE ROW LEVEL SECURITY;


-- TABLE: salary_records
CREATE TABLE IF NOT EXISTS public.salary_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
    month_year TEXT NOT NULL,
    base_salary NUMERIC(10,2) NOT NULL DEFAULT 0,
    allowances NUMERIC(10,2) NOT NULL DEFAULT 0,
    attendance_deduction NUMERIC(10,2) NOT NULL DEFAULT 0,
    advance_deduction NUMERIC(10,2) NOT NULL DEFAULT 0,
    external_deduction NUMERIC(10,2) NOT NULL DEFAULT 0,
    manual_deduction NUMERIC(10,2) NOT NULL DEFAULT 0,
    manual_deduction_note TEXT,
    net_salary NUMERIC(10,2) NOT NULL DEFAULT 0,
    is_approved BOOLEAN NOT NULL DEFAULT false,
    approved_by UUID REFERENCES auth.users(id),
    approved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(employee_id, month_year),
    payment_method text DEFAULT _const_payment_cash() NOT NULL,
    calc_source TEXT NOT NULL DEFAULT 'engine_v1',
    company_id uuid,
    created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    version INTEGER DEFAULT 1 NOT NULL,
    sheet_snapshot JSONB
);
ALTER TABLE public.salary_records ENABLE ROW LEVEL SECURITY;


-- TABLE: salary_schemes
CREATE TABLE IF NOT EXISTS public.salary_schemes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    name_en TEXT,
    target_orders INT,
    target_bonus NUMERIC(10,2),
    status public.scheme_status NOT NULL DEFAULT _const_employee_active(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    scheme_type TEXT NOT NULL DEFAULT 'order_based',
    monthly_amount NUMERIC DEFAULT NULL,
    company_id uuid
);
ALTER TABLE public.salary_schemes ENABLE ROW LEVEL SECURITY;


-- TABLE: salary_scheme_tiers
CREATE TABLE IF NOT EXISTS public.salary_scheme_tiers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scheme_id UUID NOT NULL REFERENCES public.salary_schemes(id) ON DELETE CASCADE,
    tier_order INT NOT NULL DEFAULT 1,
    from_orders INT NOT NULL DEFAULT 0,
    to_orders INT,
    price_per_order NUMERIC(10,2) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    tier_type TEXT NOT NULL DEFAULT 'total_multiplier',
    incremental_threshold INTEGER DEFAULT NULL,
    incremental_price NUMERIC DEFAULT NULL,
    company_id uuid
);
ALTER TABLE public.salary_scheme_tiers ENABLE ROW LEVEL SECURITY;


-- TABLE: salary_slip_templates
CREATE TABLE IF NOT EXISTS public.salary_slip_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    header_html TEXT,
    footer_html TEXT,
    selected_columns JSONB DEFAULT '[]'::jsonb,
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.salary_slip_templates ENABLE ROW LEVEL SECURITY;


-- TABLE: salary_tiers
CREATE TABLE IF NOT EXISTS public.salary_tiers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    app_id UUID NOT NULL REFERENCES public.apps(id) ON DELETE CASCADE,
    min_orders INTEGER NOT NULL DEFAULT 0,
    max_orders INTEGER,
    tier_type TEXT NOT NULL DEFAULT 'per_order' -- NOSONAR
    CHECK (tier_type IN ('per_order',
    'fixed',
    _const_work_hybrid())),
    rate_per_order NUMERIC(10,2),
    fixed_amount NUMERIC(10,2),
    extra_rate NUMERIC(10,2),
    priority INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT salary_tiers_range_chk CHECK (max_orders IS NULL OR max_orders >= min_orders),
    CONSTRAINT salary_tiers_payload_chk CHECK (
    (tier_type = 'per_order' AND rate_per_order IS NOT NULL) OR
    (tier_type = 'fixed' AND fixed_amount IS NOT NULL) OR
    (tier_type = _const_work_hybrid() AND fixed_amount IS NOT NULL AND extra_rate IS NOT NULL)
  )
);
ALTER TABLE public.salary_tiers ENABLE ROW LEVEL SECURITY;


-- TABLE: scheme_month_snapshots
CREATE TABLE IF NOT EXISTS public.scheme_month_snapshots (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    scheme_id uuid NOT NULL REFERENCES public.salary_schemes(id) ON DELETE CASCADE,
    month_year text NOT NULL,
    snapshot jsonb NOT NULL DEFAULT '[]'::jsonb,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    UNIQUE(scheme_id, month_year),
    company_id uuid
);
ALTER TABLE public.scheme_month_snapshots ENABLE ROW LEVEL SECURITY;


-- TABLE: spare_parts
CREATE TABLE IF NOT EXISTS public.spare_parts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name_ar TEXT NOT NULL,
    part_number TEXT,
    stock_quantity NUMERIC(10, 2) NOT NULL DEFAULT 0,
    min_stock_alert NUMERIC(10, 2) DEFAULT 5,
    unit TEXT DEFAULT 'قطعة',
    unit_cost NUMERIC(10, 2) NOT NULL DEFAULT 0,
    supplier TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.spare_parts ENABLE ROW LEVEL SECURITY;


-- TABLE: supervisor_employee_assignments
CREATE TABLE IF NOT EXISTS public.supervisor_employee_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    supervisor_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
    start_date DATE NOT NULL DEFAULT CURRENT_DATE,
    end_date DATE,
    notes TEXT,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT supervisor_employee_assignments_dates_chk
    CHECK (end_date IS NULL OR end_date >= start_date),
    CONSTRAINT supervisor_employee_assignments_unique_open UNIQUE (supervisor_id, employee_id, start_date)
);
ALTER TABLE public.supervisor_employee_assignments ENABLE ROW LEVEL SECURITY;


-- TABLE: supervisor_targets
CREATE TABLE IF NOT EXISTS public.supervisor_targets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    supervisor_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    month_year TEXT NOT NULL,
    target_orders NUMERIC(10, 0) NOT NULL DEFAULT 0,
    notes TEXT,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT supervisor_targets_month_fmt_chk CHECK (month_year ~ '^\d{4}-\d{2}$'),
    CONSTRAINT supervisor_targets_target_non_negative_chk CHECK (target_orders >= 0),
    CONSTRAINT supervisor_targets_unique UNIQUE (supervisor_id, month_year)
);
ALTER TABLE public.supervisor_targets ENABLE ROW LEVEL SECURITY;


-- TABLE: system_settings
CREATE TABLE IF NOT EXISTS public.system_settings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    project_name_ar text NOT NULL DEFAULT 'نظام التوصيل',
    project_name_en text NOT NULL DEFAULT 'Delivery System',
    project_subtitle_ar text NOT NULL DEFAULT 'إدارة المناديب',
    project_subtitle_en text NOT NULL DEFAULT 'Rider Management',
    logo_url text,
    default_language text NOT NULL DEFAULT 'ar',
    theme text NOT NULL DEFAULT 'light',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    iqama_alert_days INTEGER NOT NULL DEFAULT 90,
    company_id uuid
);
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;


-- TABLE: trade_registers
CREATE TABLE IF NOT EXISTS public.trade_registers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    name_en TEXT,
    cr_number TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.trade_registers ENABLE ROW LEVEL SECURITY;


-- TABLE: user_permissions
CREATE TABLE IF NOT EXISTS public.user_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    permission_key TEXT NOT NULL,
    can_view BOOLEAN NOT NULL DEFAULT false,
    can_edit BOOLEAN NOT NULL DEFAULT false,
    can_delete BOOLEAN NOT NULL DEFAULT false,
    UNIQUE(user_id, permission_key),
    company_id uuid
);
ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;


-- TABLE: user_roles
ALTER TABLE public.user_roles
  ADD COLUMN IF NOT EXISTS role_id UUID;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'user_roles_role_id_fkey'
      AND conrelid = 'public.user_roles'::regclass
  ) THEN
    ALTER TABLE public.user_roles
      ADD CONSTRAINT user_roles_role_id_fkey
      FOREIGN KEY (role_id) REFERENCES public.roles(id) ON DELETE CASCADE;
  END IF;
END $$;
UPDATE public.user_roles ur
SET role_id = r.id
FROM public.roles r
WHERE ur.role_id IS NULL
  AND lower(r.title) = lower(ur.role::text);
CREATE UNIQUE INDEX IF NOT EXISTS uq_user_roles_user_role_id
  ON public.user_roles(user_id, role_id)
  WHERE role_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_user_roles_role_id
  ON public.user_roles(role_id);

-- FILE: 20260325001000_attendance_checkin_checkout_metrics.sql
ALTER TABLE public.user_roles ADD COLUMN IF NOT EXISTS company_id uuid;
ALTER TABLE public.user_roles ALTER COLUMN company_id SET DEFAULT public.jwt_company_id();
    ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.trade_registers(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_permissions_company_id_fkey') THEN
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles           ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.user_roles           ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- TABLE: vehicles
CREATE TABLE IF NOT EXISTS public.vehicles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plate_number TEXT UNIQUE NOT NULL,
    type public.vehicle_type NOT NULL DEFAULT 'motorcycle',
    brand TEXT,
    model TEXT,
    year INT,
    insurance_expiry DATE,
    registration_expiry DATE,
    status public.vehicle_status NOT NULL DEFAULT _const_employee_active(),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    authorization_expiry date,
    plate_number_en TEXT,
    chassis_number TEXT,
    serial_number TEXT,
    has_fuel_chip boolean NOT NULL DEFAULT false,
    company_id uuid
);
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;


-- TABLE: vehicle_assignments
CREATE TABLE IF NOT EXISTS public.vehicle_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vehicle_id UUID NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
    start_date DATE NOT NULL DEFAULT CURRENT_DATE,
    end_date DATE,
    reason TEXT,
    notes TEXT,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    returned_at timestamp with time zone,
    start_at timestamp with time zone,
    company_id uuid
);
ALTER TABLE public.vehicle_assignments ENABLE ROW LEVEL SECURITY;


-- TABLE: vehicle_mileage
CREATE TABLE IF NOT EXISTS public.vehicle_mileage (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
    month_year text NOT NULL,
    km_total numeric NOT NULL DEFAULT 0,
    fuel_cost numeric NOT NULL DEFAULT 0,
    cost_per_km numeric GENERATED ALWAYS AS (
    CASE WHEN km_total > 0 THEN fuel_cost / km_total ELSE NULL END
  ) STORED,
    notes text,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(employee_id, month_year),
    company_id uuid
);
ALTER TABLE public.vehicle_mileage ENABLE ROW LEVEL SECURITY;


-- TABLE: vehicle_mileage_daily
CREATE TABLE IF NOT EXISTS public.vehicle_mileage_daily (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
    date date NOT NULL,
    km_total numeric NOT NULL DEFAULT 0,
    fuel_cost numeric NOT NULL DEFAULT 0,
    notes text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(employee_id, date),
    company_id uuid
);
ALTER TABLE public.vehicle_mileage_daily ENABLE ROW LEVEL SECURITY;



-- SECTION 5/6/7: Functions
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
          FROM daily_shifts
          WHERE employee_id = p_employee_id AND app_id = v_app.app_id AND date = v_day.day_date;

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

CREATE OR REPLACE FUNCTION public._const_role_admin()
  RETURNS public.app_role
  LANGUAGE sql IMMUTABLE PARALLEL SAFE
  SET search_path TO public
AS $$ SELECT 'admin'::public.app_role; $$;

CREATE OR REPLACE FUNCTION public._const_role_finance()
  RETURNS public.app_role
  LANGUAGE sql IMMUTABLE PARALLEL SAFE
  SET search_path TO public
AS $$ SELECT 'finance'::public.app_role; $$;

CREATE OR REPLACE FUNCTION public._const_role_viewer()
  RETURNS public.app_role
  LANGUAGE sql IMMUTABLE PARALLEL SAFE
  SET search_path TO public
AS $$ SELECT 'viewer'::public.app_role; $$;

CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role
  FROM public.user_roles
  WHERE user_id = auth.uid()
  ORDER BY CASE role
    WHEN 'admin'      THEN 1
    WHEN 'finance'    THEN 2
    WHEN 'hr'         THEN 3
    WHEN 'operations' THEN 4
    WHEN 'viewer'     THEN 5
    ELSE 99
  END
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS trg_profiles_updated_at ON public.profiles;
CREATE TRIGGER trg_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS trg_employees_updated_at ON public.employees;
CREATE TRIGGER trg_employees_updated_at BEFORE UPDATE ON public.employees FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS trg_vehicles_updated_at ON public.vehicles;
CREATE TRIGGER trg_vehicles_updated_at BEFORE UPDATE ON public.vehicles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS trg_advances_updated_at ON public.advances;
CREATE TRIGGER trg_advances_updated_at BEFORE UPDATE ON public.advances FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS trg_salary_records_updated_at ON public.salary_records;
CREATE TRIGGER trg_salary_records_updated_at BEFORE UPDATE ON public.salary_records FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS trg_salary_schemes_updated_at ON public.salary_schemes;
CREATE TRIGGER trg_salary_schemes_updated_at BEFORE UPDATE ON public.salary_schemes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS trg_daily_orders_updated_at ON public.daily_orders;
CREATE TRIGGER trg_daily_orders_updated_at BEFORE UPDATE ON public.daily_orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- AUTO-CREATE PROFILE ON SIGNUP
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'name', NEW.email));
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.is_active_user(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT is_active FROM public.profiles WHERE id = _user_id LIMIT 1),
    false
  )
$$;

CREATE OR REPLACE FUNCTION public.log_audit_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.audit_log (user_id, table_name, action, record_id, old_value, new_value)
  VALUES (
    auth.uid(),
    TG_TABLE_NAME,
    TG_OP,
    CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END,
    CASE WHEN TG_OP IN ('UPDATE','DELETE') THEN to_jsonb(OLD) ELSE NULL END,
    CASE WHEN TG_OP IN ('INSERT','UPDATE') THEN to_jsonb(NEW) ELSE NULL END
  );
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name, is_active)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
    false
  );
  RETURN NEW;
END;
$$;

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

CREATE OR REPLACE FUNCTION public.calculate_salary_for_month(
  p_month_year TEXT,
  p_payment_method TEXT DEFAULT _const_payment_cash()
)
RETURNS TABLE (
  employee_id UUID,
  month_year TEXT,
  total_orders INTEGER,
  total_shift_days INTEGER,
  base_salary NUMERIC,
  attendance_deduction NUMERIC,
  external_deduction NUMERIC,
  advance_deduction NUMERIC,
  manual_deduction NUMERIC,
  net_salary NUMERIC,
  calc_status TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_emp RECORD;
BEGIN
  FOR v_emp IN
    SELECT e.id
    FROM public.employees AS e
    WHERE public.is_salary_month_visible_employee(
      e.id,
      p_month_year,
      COALESCE(e.status::text, ''),
      COALESCE(e.sponsorship_status::text, ''),
      e.job_title
    )
    ORDER BY e.name
  LOOP
    RETURN QUERY
    SELECT *
    FROM public.calculate_salary_for_employee_month(
      v_emp.id,
      p_month_year,
      p_payment_method,
      0,
      NULL
    );
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.jwt_company_id()
RETURNS uuid
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT NULL::uuid;
$$;

CREATE OR REPLACE FUNCTION public.sync_employees_company_columns()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.company_id IS NULL AND NEW.trade_register_id IS NOT NULL THEN
    NEW.company_id := NEW.trade_register_id;
  ELSIF NEW.company_id IS NOT NULL AND NEW.trade_register_id IS NULL THEN
    NEW.trade_register_id := NEW.company_id;
  ELSIF NEW.company_id IS NOT NULL
    AND NEW.trade_register_id IS NOT NULL
    AND NEW.company_id <> NEW.trade_register_id THEN
    RAISE EXCEPTION 'company_id and trade_register_id must match';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.employee_in_my_company(_employee_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.employees AS e
    WHERE e.id = _employee_id
  );
$$;

CREATE OR REPLACE FUNCTION public.platform_account_in_my_company(_account_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.platform_accounts pa
    WHERE pa.id = _account_id
  );
$$;

CREATE OR REPLACE FUNCTION public.assignment_in_my_company(_assignment_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.account_assignments aa
    WHERE aa.id = _assignment_id
  );
$$;

CREATE OR REPLACE FUNCTION public.sync_platform_accounts_company_id()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  employee_company_id uuid;
BEGIN
  IF NEW.employee_id IS NOT NULL THEN
    SELECT e.company_id INTO employee_company_id
    FROM public.employees e
    WHERE e.id = NEW.employee_id;

    IF employee_company_id IS NULL THEN
      RAISE EXCEPTION 'employee_id must belong to a company';
    END IF;

    IF NEW.company_id IS NULL THEN
      NEW.company_id := employee_company_id;
    ELSIF NEW.company_id <> employee_company_id THEN
      RAISE EXCEPTION 'platform_accounts.company_id must match employee company';
    END IF;
  END IF;

  IF NEW.company_id IS NULL THEN
    NEW.company_id := public.jwt_company_id();
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_account_assignments_company_id()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  employee_company_id uuid;
  account_company_id uuid;
BEGIN
  SELECT e.company_id INTO employee_company_id
  FROM public.employees e
  WHERE e.id = NEW.employee_id;

  IF employee_company_id IS NULL THEN
    RAISE EXCEPTION 'employee_id must belong to a company';
  END IF;

  SELECT pa.company_id INTO account_company_id
  FROM public.platform_accounts pa
  WHERE pa.id = NEW.account_id;

  IF account_company_id IS NULL THEN
    RAISE EXCEPTION 'account_id must belong to a company';
  END IF;

  IF employee_company_id <> account_company_id THEN
    RAISE EXCEPTION 'employee and account must belong to the same company';
  END IF;

  IF NEW.company_id IS NULL THEN
    NEW.company_id := employee_company_id;
  ELSIF NEW.company_id <> employee_company_id THEN
    RAISE EXCEPTION 'account_assignments.company_id mismatch';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.advance_in_my_company(_advance_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.advances AS a
    WHERE a.id = _advance_id
  );
$$;

CREATE OR REPLACE FUNCTION public.sync_attendance_company_id()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  employee_company_id uuid;
BEGIN
  SELECT company_id INTO employee_company_id FROM public.employees WHERE id = NEW.employee_id;
  IF employee_company_id IS NULL THEN
    RAISE EXCEPTION 'attendance.employee_id must belong to a tenant-bound employee';
  END IF;
  NEW.company_id := employee_company_id;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_daily_orders_company_id()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  employee_company_id uuid;
BEGIN
  SELECT company_id INTO employee_company_id FROM public.employees WHERE id = NEW.employee_id;
  IF employee_company_id IS NULL THEN
    RAISE EXCEPTION 'daily_orders.employee_id must belong to a tenant-bound employee';
  END IF;
  NEW.company_id := employee_company_id;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_advances_company_id()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  employee_company_id uuid;
BEGIN
  SELECT company_id INTO employee_company_id FROM public.employees WHERE id = NEW.employee_id;
  IF employee_company_id IS NULL THEN
    RAISE EXCEPTION 'advances.employee_id must belong to a tenant-bound employee';
  END IF;
  NEW.company_id := employee_company_id;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_external_deductions_company_id()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  employee_company_id uuid;
BEGIN
  SELECT company_id INTO employee_company_id FROM public.employees WHERE id = NEW.employee_id;
  IF employee_company_id IS NULL THEN
    RAISE EXCEPTION 'external_deductions.employee_id must belong to a tenant-bound employee';
  END IF;
  NEW.company_id := employee_company_id;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_salary_records_company_id()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  employee_company_id uuid;
BEGIN
  SELECT company_id INTO employee_company_id FROM public.employees WHERE id = NEW.employee_id;
  IF employee_company_id IS NULL THEN
    RAISE EXCEPTION 'salary_records.employee_id must belong to a tenant-bound employee';
  END IF;
  NEW.company_id := employee_company_id;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_advance_installments_company_id()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  advance_company_id uuid;
BEGIN
  SELECT company_id INTO advance_company_id FROM public.advances WHERE id = NEW.advance_id;
  IF advance_company_id IS NULL THEN
    RAISE EXCEPTION 'advance_installments.advance_id must belong to a tenant-bound advance';
  END IF;
  NEW.company_id := advance_company_id;
  RETURN NEW;
END;
$$;

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
  v_tier RECORD;
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
            FROM daily_shifts
            WHERE employee_id = v_emp.id AND app_id = v_app.app_id AND date = v_day.day_date;

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

CREATE OR REPLACE FUNCTION public.enforce_rate_limit(
  p_key text,
  p_limit integer,
  p_window_seconds integer
)
RETURNS TABLE (
  allowed boolean,
  remaining integer,
  reset_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now timestamptz := now();
  v_window_start timestamptz;
  v_count integer;
BEGIN
  IF p_key IS NULL OR length(btrim(p_key)) = 0 THEN
    RAISE EXCEPTION 'p_key is required';
  END IF;
  IF p_limit <= 0 THEN
    RAISE EXCEPTION 'p_limit must be > 0';
  END IF;
  IF p_window_seconds <= 0 THEN
    RAISE EXCEPTION 'p_window_seconds must be > 0';
  END IF;

  v_window_start := to_timestamp(
    floor(extract(epoch from v_now) / p_window_seconds) * p_window_seconds
  );

  INSERT INTO public.edge_rate_limits AS rl (key, window_start, request_count, updated_at)
  VALUES (p_key, v_window_start, 1, v_now)
  ON CONFLICT (key) DO UPDATE SET
    window_start = CASE
      WHEN rl.window_start = EXCLUDED.window_start THEN rl.window_start
      ELSE EXCLUDED.window_start
    END,
    request_count = CASE
      WHEN rl.window_start = EXCLUDED.window_start THEN rl.request_count + 1
      ELSE 1
    END,
    updated_at = v_now
  RETURNING rl.request_count INTO v_count;

  RETURN QUERY
  SELECT
    (v_count <= p_limit) AS allowed,
    GREATEST(p_limit - v_count, 0) AS remaining,
    v_window_start + (p_window_seconds || ' seconds')::interval AS reset_at;
END;
$$;

CREATE OR REPLACE FUNCTION public.dashboard_overview_rpc(
  p_month_year TEXT,
  p_today DATE DEFAULT CURRENT_DATE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_start DATE := to_date(p_month_year || '-01', 'YYYY-MM-DD');
  v_end DATE := (v_start + INTERVAL '1 month - 1 day')::date;
  v_prev_start DATE := (v_start - INTERVAL '1 month')::date;
  v_prev_end DATE := (v_start - INTERVAL '1 day')::date;
  v_week_start DATE := (p_today - INTERVAL '6 day')::date;
BEGIN
  IF NOT (
    is_active_user(auth.uid())
    AND (
      has_role(auth.uid(), _const_role_admin())
      OR has_role(auth.uid(), _const_role_hr())
      OR has_role(auth.uid(), _const_role_finance())
      OR has_role(auth.uid(), _const_role_operations())
    )
  ) THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;

  RETURN (
    WITH
      apps_active AS (
        SELECT a.id, a.name, COALESCE(a.brand_color, '#6366f1') AS brand_color, COALESCE(a.text_color, '#ffffff') AS text_color
        FROM public.apps a
        WHERE a.is_active IS TRUE
      ),
      emp_details AS (
        SELECT e.id, e.city, e.license_status, e.sponsorship_status
        FROM public.employees e
        WHERE e.status = _const_employee_active()
      ),
      att_today AS (
        SELECT
          COUNT(*) FILTER (WHERE a.status = 'present')::INT AS present,
          COUNT(*) FILTER (WHERE a.status = 'absent')::INT  AS absent,
          COUNT(*) FILTER (WHERE a.status = 'late')::INT    AS late,
          COUNT(*) FILTER (WHERE a.status = 'leave')::INT   AS leave,
          COUNT(*) FILTER (WHERE a.status = 'sick')::INT    AS sick
        FROM public.attendance a
        WHERE a.date = p_today
      ),
      att_week AS (
        SELECT
          a.date::TEXT AS date,
          COUNT(*) FILTER (WHERE a.status = 'present')::INT AS present,
          COUNT(*) FILTER (WHERE a.status = 'absent')::INT  AS absent,
          COUNT(*) FILTER (WHERE a.status = 'late')::INT    AS late,
          COUNT(*) FILTER (WHERE a.status = 'leave')::INT   AS leave,
          COUNT(*) FILTER (WHERE a.status = 'sick')::INT    AS sick
        FROM public.attendance a
        WHERE a.date BETWEEN v_week_start AND p_today
        GROUP BY a.date
        ORDER BY a.date
      ),
      prev_month_orders AS (
        SELECT COALESCE(SUM(d.orders_count), 0)::INT AS total
        FROM public.daily_orders d
        WHERE d.date BETWEEN v_prev_start AND v_prev_end
      ),
      best_rate AS (
        SELECT DISTINCT ON (pr.app_id)
          pr.app_id,
          COALESCE(pr.rate_per_order, 0)::NUMERIC AS rate
        FROM public.pricing_rules pr
        WHERE pr.is_active IS TRUE
          AND pr.rule_type = 'per_order'
          AND pr.min_orders = 0
          AND pr.max_orders IS NULL
          AND pr.rate_per_order IS NOT NULL
        ORDER BY pr.app_id, COALESCE(pr.priority, 0) DESC
      ),
      targets AS (
        SELECT t.app_id, COALESCE(t.target_orders, 0)::INT AS target_orders
        FROM public.app_targets t
        WHERE t.month_year = p_month_year
      ),
      orders_by_app AS (
        SELECT
          d.app_id,
          COALESCE(a.name, '—') AS app,
          COALESCE(a.brand_color, '#6366f1') AS brand_color,
          COALESCE(a.text_color, '#ffffff') AS text_color,
          COALESCE(SUM(d.orders_count), 0)::INT AS orders,
          COUNT(DISTINCT d.employee_id)::INT AS riders,
          COALESCE(t.target_orders, 0)::INT AS target,
          COALESCE(br.rate, 0)::NUMERIC AS rate_per_order,
          (COALESCE(SUM(d.orders_count), 0) * COALESCE(br.rate, 0))::NUMERIC AS est_revenue
        FROM public.daily_orders d
        LEFT JOIN apps_active a ON a.id = d.app_id
        LEFT JOIN targets t ON t.app_id = d.app_id
        LEFT JOIN best_rate br ON br.app_id = d.app_id
        WHERE d.date BETWEEN v_start AND LEAST(v_end, p_today)
        GROUP BY d.app_id, a.name, a.brand_color, a.text_color, t.target_orders, br.rate
        ORDER BY orders DESC
      ),
      orders_by_city AS (
        SELECT
          COALESCE(e.city::TEXT, 'unknown') AS city,
          COALESCE(SUM(d.orders_count), 0)::INT AS orders
        FROM public.daily_orders d
        JOIN public.employees e ON e.id = d.employee_id
        WHERE d.date BETWEEN v_start AND LEAST(v_end, p_today)
          AND e.city::TEXT IN ('makkah', 'jeddah')
        GROUP BY e.city
        ORDER BY orders DESC
      ),
      rider_app AS (
        SELECT
          d.employee_id,
          d.app_id,
          COALESCE(SUM(d.orders_count), 0)::INT AS orders,
          ROW_NUMBER() OVER (PARTITION BY d.employee_id ORDER BY COALESCE(SUM(d.orders_count), 0) DESC) AS rn
        FROM public.daily_orders d
        WHERE d.date BETWEEN v_start AND LEAST(v_end, p_today)
        GROUP BY d.employee_id, d.app_id
      ),
      riders AS (
        SELECT
          r.employee_id,
          COALESCE(e.name, '') AS name,
          r.orders,
          r.app_id,
          COALESCE(a.name, '—') AS app,
          COALESCE(a.brand_color, '#6366f1') AS app_color
        FROM rider_app r
        LEFT JOIN public.employees e ON e.id = r.employee_id
        LEFT JOIN apps_active a ON a.id = r.app_id
        WHERE r.rn = 1
        ORDER BY r.orders DESC
      ),
      recent_activity AS (
        SELECT al.action, al.table_name, al.created_at, al.user_id
        FROM public.audit_log al
        ORDER BY al.created_at DESC
        LIMIT 6
      ),
      counts AS (
        SELECT
          (SELECT COUNT(*)::INT FROM public.vehicles v WHERE v.status = _const_employee_active()) AS active_vehicles,
          (SELECT COUNT(*)::INT FROM public.alerts al WHERE al.is_resolved IS FALSE) AS active_alerts,
          (SELECT COUNT(*)::INT FROM apps_active) AS active_apps
      ),
      totals AS (
        SELECT
          COALESCE((SELECT SUM(o.orders)::INT FROM orders_by_app o), 0) AS total_orders,
          COALESCE((SELECT SUM(o.est_revenue)::NUMERIC FROM orders_by_app o), 0) AS est_revenue_total
      )
    SELECT jsonb_build_object(
      'monthYear', p_month_year,
      'today', p_today::TEXT,
      'apps', COALESCE((SELECT jsonb_agg(to_jsonb(a) ORDER BY a.name) FROM apps_active a), '[]'::jsonb),
      'empDetails', COALESCE((SELECT jsonb_agg(to_jsonb(e) ORDER BY e.id) FROM emp_details e), '[]'::jsonb),
      'attendanceToday', (SELECT to_jsonb(t) FROM att_today t),
      'attendanceWeek', COALESCE((SELECT jsonb_agg(to_jsonb(w) ORDER BY w.date) FROM att_week w), '[]'::jsonb),
      'ordersByApp', COALESCE((
        SELECT jsonb_agg(
          jsonb_build_object(
            'appId', o.app_id,
            'app', o.app,
            _const_work_orders(), o.orders,
            'riders', o.riders,
            'brandColor', o.brand_color,
            'textColor', o.text_color,
            'target', o.target,
            'estRevenue', ROUND(o.est_revenue)
          )
          ORDER BY o.orders DESC
        )
        FROM orders_by_app o
      ), '[]'::jsonb),
      'ordersByCity', COALESCE((SELECT jsonb_agg(to_jsonb(c) ORDER BY c.orders DESC) FROM orders_by_city c), '[]'::jsonb),
      'riders', COALESCE((
        SELECT jsonb_agg(
          jsonb_build_object(
            'employee_id', r.employee_id,
            'name', r.name,
            _const_work_orders(), r.orders,
            'appId', r.app_id,
            'app', r.app,
            'appColor', r.app_color
          )
          ORDER BY r.orders DESC
        )
        FROM riders r
      ), '[]'::jsonb),
      'recentActivity', COALESCE((SELECT jsonb_agg(to_jsonb(ra) ORDER BY ra.created_at DESC) FROM recent_activity ra), '[]'::jsonb),
      'kpis', jsonb_build_object(
        'prevMonthOrders', (SELECT total FROM prev_month_orders),
        'activeVehicles', (SELECT active_vehicles FROM counts),
        'activeAlerts', (SELECT active_alerts FROM counts),
        'activeApps', (SELECT active_apps FROM counts),
        'totalOrders', (SELECT total_orders FROM totals),
        'estRevenueTotal', (SELECT est_revenue_total FROM totals)
      )
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.is_internal_user()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND COALESCE(p.is_active, true) IS TRUE
    )
    AND EXISTS (
      SELECT 1
      FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
    );
$$;

CREATE OR REPLACE FUNCTION public.has_permission(p_resource text, p_action text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_allowed boolean := FALSE;
BEGIN
  IF NOT public.is_internal_user() THEN
    RETURN false;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.user_roles ur
    LEFT JOIN public.roles r ON r.id = ur.role_id
    WHERE ur.user_id = auth.uid()
      AND (
        ur.role = _const_role_admin()
        OR lower(COALESCE(r.title, '')) = 'admin'
      )
  ) THEN
    RETURN true;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    LEFT JOIN public.roles r ON r.id = ur.role_id
    WHERE ur.user_id = auth.uid()
      AND COALESCE(r.is_active, true) IS TRUE
      AND (
        COALESCE((r.permissions -> '*' ->> p_action)::boolean, false)
        OR COALESCE((r.permissions -> p_resource ->> p_action)::boolean, false)
      )
  ) INTO v_allowed;

  IF v_allowed THEN
    RETURN true;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND (
        (ur.role = _const_role_hr() AND (
          (p_resource = 'employees'  AND p_action IN ('view','write')) OR
          (p_resource = _const_work_orders()     AND p_action IN ('view','write')) OR
          (p_resource = 'attendance' AND p_action IN ('view','write')) OR
          (p_resource = 'salary'     AND p_action = 'view') OR
          (p_resource = 'roles'      AND p_action = 'view') OR
          (p_resource = 'financials' AND p_action = 'view')
        ))
        OR
        (ur.role = _const_role_finance() AND (
          (p_resource = 'employees'  AND p_action = 'view') OR
          (p_resource = _const_work_orders()     AND p_action = 'view') OR
          (p_resource = 'attendance' AND p_action = 'view') OR
          (p_resource = 'salary'     AND p_action IN ('view','write','approve')) OR
          (p_resource = 'financials' AND p_action IN ('view','write','approve')) OR
          (p_resource = 'roles'      AND p_action = 'view')
        ))
        OR
        (ur.role = _const_role_operations() AND (
          (p_resource = 'employees'  AND p_action IN ('view','write')) OR
          (p_resource = _const_work_orders()     AND p_action IN ('view','write')) OR
          (p_resource = 'attendance' AND p_action IN ('view','write')) OR
          (p_resource = 'salary'     AND p_action = 'view') OR
          (p_resource = 'financials' AND p_action = 'view')
        ))
        OR
        (ur.role = _const_role_viewer() AND p_action = 'view')
      )
  ) THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_audit_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.created_by IS NULL THEN
      NEW.created_by := auth.uid();
    END IF;
    IF NEW.updated_by IS NULL THEN
      NEW.updated_by := auth.uid();
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    NEW.updated_by := auth.uid();
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.log_admin_action_cud()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_record_id text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_record_id := COALESCE(OLD.id::text, NULL);
    INSERT INTO public.admin_action_log (user_id, action, table_name, record_id, meta)
    VALUES (
      v_actor,
      lower(TG_OP),
      TG_TABLE_NAME,
      v_record_id,
      jsonb_build_object /* NOSONAR */('old', to_jsonb(OLD))
    );
    RETURN OLD;
  ELSE
    v_record_id := COALESCE(NEW.id::text, NULL);
    INSERT INTO public.admin_action_log (user_id, action, table_name, record_id, meta)
    VALUES (
      v_actor,
      lower(TG_OP),
      TG_TABLE_NAME,
      v_record_id,
      CASE
        WHEN TG_OP = 'INSERT' THEN jsonb_build_object /* NOSONAR */('new', to_jsonb(NEW))
        ELSE jsonb_build_object /* NOSONAR */('old', to_jsonb(OLD), 'new', to_jsonb(NEW))
      END
    );
    RETURN NEW;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.check_in(
  p_employee_id uuid,
  p_checkin_at timestamptz DEFAULT now()
)
RETURNS public.attendance
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.attendance;
  v_date date := (p_checkin_at AT TIME ZONE 'UTC')::date;
  v_time time := (p_checkin_at AT TIME ZONE 'UTC')::time;
  v_start time := time '09:00:00';
BEGIN
  IF NOT public.is_internal_user() OR NOT public.has_permission('attendance', 'write') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF p_employee_id IS NULL THEN
    RAISE EXCEPTION 'employee_id is required';
  END IF;

  INSERT INTO public.attendance (employee_id, date, status, check_in, late)
  VALUES (p_employee_id, v_date, 'present'::public.attendance_status, v_time, v_time > v_start)
  ON CONFLICT (employee_id, date)
  DO UPDATE SET
    check_in = EXCLUDED.check_in,
    status = 'present'::public.attendance_status,
    late = EXCLUDED.late
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.check_out(
  p_employee_id uuid,
  p_checkout_at timestamptz DEFAULT now()
)
RETURNS public.attendance
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.attendance;
  v_date date := (p_checkout_at AT TIME ZONE 'UTC')::date;
  v_time time := (p_checkout_at AT TIME ZONE 'UTC')::time;
  v_end time := time '18:00:00';
  v_hours numeric(6,2);
BEGIN
  IF NOT public.is_internal_user() OR NOT public.has_permission('attendance', 'write') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF p_employee_id IS NULL THEN
    RAISE EXCEPTION 'employee_id is required';
  END IF;

  SELECT * INTO v_row
  FROM public.attendance a
  WHERE a.employee_id = p_employee_id
    AND a.date = v_date
  LIMIT 1;

  IF v_row.id IS NULL OR v_row.check_in IS NULL THEN
    RAISE EXCEPTION 'No check-in found for this employee/date';
  END IF;

  v_hours := ROUND(GREATEST(EXTRACT(EPOCH FROM (v_time - v_row.check_in)), 0) / 3600.0, 2);

  UPDATE public.attendance
  SET
    check_out = v_time,
    total_hours = v_hours,
    early_leave = (v_time < v_end)
  WHERE id = v_row.id
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.calculate_salary(
  p_employee_id uuid,
  p_month_year text,
  p_payment_method text DEFAULT _const_payment_cash(),
  p_manual_deduction numeric DEFAULT 0,
  p_manual_deduction_note text DEFAULT NULL
)
RETURNS TABLE (
  employee_id uuid,
  month_year text,
  total_orders integer,
  attendance_days integer,
  base_salary numeric,
  attendance_deduction numeric,
  external_deduction numeric,
  advance_deduction numeric,
  manual_deduction numeric,
  net_salary numeric,
  calc_status text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_internal_user() OR NOT public.has_permission('salary', 'approve') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  RETURN QUERY
  SELECT *
  FROM public.calculate_salary_for_employee_month(
    p_employee_id,
    p_month_year,
    p_payment_method,
    p_manual_deduction,
    p_manual_deduction_note
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.dashboard_overview(
  p_cip text,
  p_monthly_year text,
  p_today date DEFAULT CURRENT_DATE
)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.dashboard_overview_rpc(p_monthly_year, COALESCE(p_today, CURRENT_DATE));
$$;

CREATE OR REPLACE FUNCTION public.fill_maintenance_employee()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.employee_id IS NULL THEN
    SELECT va.employee_id INTO NEW.employee_id
    FROM public.vehicle_assignments va
    WHERE va.vehicle_id = NEW.vehicle_id
      AND va.returned_at IS NULL
    ORDER BY va.created_at DESC NULLS LAST
    LIMIT 1;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.deduct_spare_part_stock()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE public.spare_parts sp
  SET stock_quantity = sp.stock_quantity - NEW.quantity_used,
      updated_at = now()
  WHERE sp.id = NEW.part_id;

  IF (SELECT sp2.stock_quantity FROM public.spare_parts sp2 WHERE sp2.id = NEW.part_id) < 0 THEN
    RAISE EXCEPTION 'المخزون غير كافٍ للقطعة المطلوبة';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.restore_spare_part_stock()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE public.spare_parts sp
  SET stock_quantity = sp.stock_quantity + OLD.quantity_used,
      updated_at = now()
  WHERE sp.id = OLD.part_id;
  RETURN OLD;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_maintenance_total_cost()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  log_id uuid;
BEGIN
  log_id := COALESCE(NEW.maintenance_log_id, OLD.maintenance_log_id);
  UPDATE public.maintenance_logs ml
  SET total_cost = (
      SELECT COALESCE(SUM(mp.quantity_used * mp.cost_at_time), 0)::numeric(10, 2)
      FROM public.maintenance_parts mp
      WHERE mp.maintenance_log_id = log_id
    ),
    updated_at = now()
  WHERE ml.id = log_id;
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE OR REPLACE FUNCTION public.assign_platform_account(
  p_account_id uuid,
  p_employee_id uuid,
  p_start_date date,
  p_notes text DEFAULT NULL,
  p_created_by uuid DEFAULT NULL
)
RETURNS public.account_assignments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_assignment public.account_assignments;
BEGIN
  IF auth.uid() IS NULL
     OR NOT public.is_active_user(auth.uid())
     OR NOT (
       public.has_role(auth.uid(), _const_role_admin())
       OR public.has_role(auth.uid(), _const_role_hr())
     ) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF p_account_id IS NULL THEN
    RAISE EXCEPTION 'account_id is required';
  END IF;

  IF p_employee_id IS NULL THEN
    RAISE EXCEPTION 'employee_id is required';
  END IF;

  IF p_start_date IS NULL THEN
    RAISE EXCEPTION 'start_date is required';
  END IF;

  PERFORM 1
  FROM public.platform_accounts
  WHERE id = p_account_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'platform account not found';
  END IF;

  PERFORM 1
  FROM public.employees
  WHERE id = p_employee_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'employee not found';
  END IF;

  UPDATE public.account_assignments
  SET end_date = CURRENT_DATE
  WHERE account_id = p_account_id
    AND end_date IS NULL;

  INSERT INTO public.account_assignments (
    account_id,
    employee_id,
    start_date,
    end_date,
    month_year,
    notes,
    created_by
  )
  VALUES (
    p_account_id,
    p_employee_id,
    p_start_date,
    NULL,
    to_char(p_start_date, 'YYYY-MM'),
    NULLIF(btrim(COALESCE(p_notes, '')), ''),
    COALESCE(p_created_by, auth.uid())
  )
  RETURNING * INTO v_assignment;

  UPDATE public.platform_accounts
  SET employee_id = p_employee_id
  WHERE id = p_account_id;

  RETURN v_assignment;
END;
$$;

CREATE OR REPLACE FUNCTION check_no_overlap_orders_shifts()
RETURNS TRIGGER AS $$
BEGIN
  -- If inserting/updating daily_shifts, check for existing orders
  IF TG_TABLE_NAME = 'daily_shifts' THEN
    IF EXISTS (
      SELECT 1 FROM daily_orders 
      WHERE employee_id = NEW.employee_id 
        AND app_id = NEW.app_id 
        AND date = NEW.date
    ) THEN
      RAISE EXCEPTION 'لا يمكن تسجيل دوام في يوم يحتوي على طلبات لنفس الموظف والمنصة';
    END IF;
  END IF;
  
  -- If inserting/updating daily_orders, check for existing shifts
  IF TG_TABLE_NAME = 'daily_orders' THEN
    IF EXISTS (
      SELECT 1 FROM daily_shifts 
      WHERE employee_id = NEW.employee_id 
        AND app_id = NEW.app_id 
        AND date = NEW.date
    ) THEN
      RAISE EXCEPTION 'لا يمكن تسجيل طلبات في يوم يحتوي على دوام لنفس الموظف والمنصة';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers to enforce no overlap
DROP TRIGGER IF EXISTS prevent_orders_shifts_overlap_on_orders ON daily_orders;
CREATE TRIGGER prevent_orders_shifts_overlap_on_orders
  BEFORE INSERT OR UPDATE ON daily_orders
  FOR EACH ROW EXECUTE FUNCTION check_no_overlap_orders_shifts();

DROP TRIGGER IF EXISTS prevent_orders_shifts_overlap_on_shifts ON daily_shifts;
CREATE TRIGGER prevent_orders_shifts_overlap_on_shifts
  BEFORE INSERT OR UPDATE ON daily_shifts
  FOR EACH ROW EXECUTE FUNCTION check_no_overlap_orders_shifts();

-- Update trigger for daily_shifts
CREATE OR REPLACE FUNCTION update_daily_shifts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.update_salary_drafts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS salary_drafts_updated_at ON public.salary_drafts;

CREATE TRIGGER salary_drafts_updated_at
BEFORE UPDATE ON public.salary_drafts
FOR EACH ROW
EXECUTE FUNCTION public.update_salary_drafts_updated_at();

-- 11. Function to increment version on salary_records update
CREATE OR REPLACE FUNCTION public.increment_salary_record_version()
RETURNS TRIGGER AS $$
BEGIN
  NEW.version = OLD.version + 1;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.is_salary_admin_job_title(p_job_title TEXT)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT
    COALESCE(p_job_title, '') <> ''
    AND NOT (
      COALESCE(p_job_title, '') ~* '(مندوب|سائق|توصيل|موصل|مرسال|rider|driver|delivery|courier|dispatch|messenger)'
    );
$$;

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
SET search_path TO 'public'
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

CREATE OR REPLACE FUNCTION public.is_salary_month_visible_employee(
  p_employee_id UUID,
  p_month_year TEXT,
  p_status TEXT,
  p_sponsorship_status TEXT,
  p_job_title TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_start DATE := to_date(p_month_year || '-01', 'YYYY-MM-DD');
  v_end DATE := (v_start + INTERVAL '1 month - 1 day')::date;
  v_has_orders BOOLEAN;
  v_has_attendance BOOLEAN;
  v_has_shifts BOOLEAN;
  v_has_saved_salary BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM public.daily_orders d
    WHERE d.employee_id = p_employee_id
      AND d.date BETWEEN v_start AND v_end
      AND (d.status IS NULL OR d.status <> _const_order_cancelled())
  )
  INTO v_has_orders;

  SELECT EXISTS (
    SELECT 1
    FROM public.attendance a
    WHERE a.employee_id = p_employee_id
      AND a.date BETWEEN v_start AND v_end
  )
  INTO v_has_attendance;

  SELECT EXISTS (
    SELECT 1
    FROM public.daily_shifts s
    WHERE s.employee_id = p_employee_id
      AND s.date BETWEEN v_start AND v_end
  )
  INTO v_has_shifts;

  SELECT EXISTS (
    SELECT 1
    FROM public.salary_records sr
    WHERE sr.employee_id = p_employee_id
      AND sr.month_year = p_month_year
  )
  INTO v_has_saved_salary;

  IF v_has_orders OR v_has_attendance OR v_has_shifts OR v_has_saved_salary THEN
    RETURN TRUE;
  END IF;

  IF COALESCE(p_status, '') <> _const_employee_active() THEN
    RETURN FALSE;
  END IF;

  IF COALESCE(p_sponsorship_status, '') IN ('absconded', 'terminated') THEN
    RETURN FALSE;
  END IF;

  RETURN public.is_salary_admin_job_title(p_job_title);
END;
$$;

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
SET search_path TO 'public'
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

CREATE OR REPLACE FUNCTION public.capture_salary_month_snapshot(
  p_month_year TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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

CREATE OR REPLACE FUNCTION public.performance_dashboard_rpc(
  p_month_year TEXT,
  p_today DATE DEFAULT CURRENT_DATE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_start DATE;
  v_end DATE;
  v_effective_end DATE;
  v_prev_month TEXT;
  v_week_start DATE;
  v_prev_week_end DATE;
  v_prev_week_start DATE;
BEGIN
  IF NOT (
    public.is_active_user(auth.uid())
    AND (
      public.has_role(auth.uid(), _const_role_admin())
      OR public.has_role(auth.uid(), _const_role_hr())
      OR public.has_role(auth.uid(), _const_role_finance())
      OR public.has_role(auth.uid(), _const_role_operations())
    )
  ) THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;

  IF p_month_year !~ '^\d{4}-\d{2}$' THEN
    RAISE EXCEPTION 'Invalid month_year format. Expected YYYY-MM';
  END IF;

  v_start := to_date(p_month_year || '-01', 'YYYY-MM-DD');
  v_end := (v_start + INTERVAL '1 month - 1 day')::DATE;
  v_effective_end := LEAST(COALESCE(p_today, CURRENT_DATE), v_end);
  v_prev_month := to_char((v_start - INTERVAL '1 month')::DATE, 'YYYY-MM');
  v_week_start := (v_effective_end - INTERVAL '6 day')::DATE;
  v_prev_week_end := (v_week_start - INTERVAL '1 day')::DATE;
  v_prev_week_start := (v_prev_week_end - INTERVAL '6 day')::DATE;

  RETURN (
    WITH current_month AS MATERIALIZED (
      SELECT *
      FROM public.v_rider_monthly_performance
      WHERE month_year = p_month_year
    ),
    prev_month AS MATERIALIZED (
      SELECT *
      FROM public.v_rider_monthly_performance
      WHERE month_year = v_prev_month
    ),
    current_ranked AS (
      SELECT
        cm.employee_id,
        cm.employee_name,
        cm.city,
        cm.month_year,
        cm.total_orders,
        cm.active_days,
        cm.avg_orders_per_day,
        cm.consistency_days,
        cm.consistency_ratio,
        cm.best_day_orders,
        cm.last_active_date,
        cm.monthly_target_orders,
        cm.daily_target_orders,
        cm.target_achievement_pct,
        ROW_NUMBER() OVER (
          ORDER BY cm.total_orders DESC, cm.avg_orders_per_day DESC, cm.employee_name
        ) AS rank_position,
        COALESCE(pm.total_orders, 0) AS prev_total_orders,
        COALESCE(pm.active_days, 0) AS prev_active_days,
        COALESCE(pm.avg_orders_per_day, 0) AS prev_avg_orders_per_day,
        CASE
          WHEN COALESCE(pm.total_orders, 0) > 0 THEN
            ROUND(((cm.total_orders - pm.total_orders)::NUMERIC / pm.total_orders::NUMERIC) * 100, 2)
          WHEN cm.total_orders > 0 THEN 100
          ELSE 0
        END AS growth_pct,
        CASE
          WHEN COALESCE(pm.total_orders, 0) > 0 AND ((cm.total_orders - pm.total_orders)::NUMERIC / pm.total_orders::NUMERIC) >= 0.05 THEN 'up'
          WHEN COALESCE(pm.total_orders, 0) > 0 AND ((cm.total_orders - pm.total_orders)::NUMERIC / pm.total_orders::NUMERIC) <= -0.05 THEN 'down'
          ELSE 'stable'
        END AS trend_code
      FROM current_month AS cm
      LEFT JOIN prev_month AS pm
        ON pm.employee_id = cm.employee_id
    ),
    leaderboard_date AS MATERIALIZED (
      SELECT MAX(date) AS date
      FROM public.v_rider_daily_performance
      WHERE date BETWEEN v_start AND v_effective_end
        AND total_orders > 0
    ),
    current_day_ranked AS (
      SELECT
        d.employee_id,
        d.employee_name,
        d.total_orders,
        ROW_NUMBER() OVER (ORDER BY d.total_orders DESC, d.employee_name) AS top_rank,
        ROW_NUMBER() OVER (ORDER BY d.total_orders ASC, d.employee_name) AS low_rank
      FROM public.v_rider_daily_performance AS d
      JOIN leaderboard_date AS ld
        ON ld.date = d.date
    ),
    app_meta AS (
      SELECT
        a.id,
        a.name,
        COALESCE(a.brand_color, '#2563eb') AS brand_color,
        COALESCE(a.text_color, '#ffffff') AS text_color
      FROM public.apps AS a
      WHERE a.is_active IS TRUE
    ),
    orders_by_app AS (
      SELECT
        p.app_id,
        MAX(p.app_name) AS app_name,
        MAX(p.brand_color) AS brand_color,
        COALESCE(MAX(am.text_color), '#ffffff') AS text_color,
        SUM(p.total_orders)::INTEGER AS total_orders,
        COUNT(DISTINCT p.employee_id)::INTEGER AS rider_count
      FROM public.v_rider_daily_platform_orders AS p
      LEFT JOIN app_meta AS am
        ON am.id = p.app_id
      WHERE p.date BETWEEN v_start AND v_effective_end
      GROUP BY p.app_id
    ),
    prev_orders_by_app AS (
      SELECT
        p.app_id,
        SUM(p.total_orders)::INTEGER AS total_orders
      FROM public.v_rider_daily_platform_orders AS p
      WHERE p.date BETWEEN (v_start - INTERVAL '1 month')::DATE AND (v_start - INTERVAL '1 day')::DATE
      GROUP BY p.app_id
    ),
    app_targets AS (
      SELECT app_id, COALESCE(target_orders, 0)::INTEGER AS target_orders
      FROM public.app_targets
      WHERE month_year = p_month_year
    ),
    app_comparison AS (
      SELECT
        oba.app_id,
        oba.app_name,
        oba.brand_color,
        oba.text_color,
        oba.total_orders,
        oba.rider_count,
        COALESCE(at.target_orders, 0) AS target_orders,
        COALESCE(po.total_orders, 0) AS previous_orders,
        CASE
          WHEN COALESCE(po.total_orders, 0) > 0 THEN
            ROUND(((oba.total_orders - po.total_orders)::NUMERIC / po.total_orders::NUMERIC) * 100, 2)
          WHEN oba.total_orders > 0 THEN 100
          ELSE 0
        END AS growth_pct,
        CASE
          WHEN COALESCE(at.target_orders, 0) > 0 THEN
            ROUND((oba.total_orders::NUMERIC / at.target_orders::NUMERIC) * 100, 2)
          ELSE 0
        END AS target_achievement_pct
      FROM orders_by_app AS oba
      LEFT JOIN prev_orders_by_app AS po
        ON po.app_id = oba.app_id
      LEFT JOIN app_targets AS at
        ON at.app_id = oba.app_id
    ),
    orders_by_city AS (
      SELECT
        COALESCE(city, 'unknown') AS city,
        SUM(total_orders)::INTEGER AS orders
      FROM current_month
      GROUP BY city
    ),
    team_avg AS (
      SELECT
        ROUND(AVG(total_orders)::NUMERIC, 2) AS avg_total_orders
      FROM current_month
    ),
    performance_distribution AS (
      SELECT
        COUNT(*) FILTER (
          WHERE cr.total_orders > 0
            AND cr.total_orders >= COALESCE(ta.avg_total_orders, 0) * 1.2
        )::INTEGER AS excellent,
        COUNT(*) FILTER (
          WHERE cr.total_orders > 0
            AND cr.total_orders < COALESCE(ta.avg_total_orders, 0) * 0.8
        )::INTEGER AS weak,
        COUNT(*) FILTER (
          WHERE cr.total_orders > 0
            AND cr.total_orders >= COALESCE(ta.avg_total_orders, 0) * 0.8
            AND cr.total_orders < COALESCE(ta.avg_total_orders, 0) * 1.2
        )::INTEGER AS average
      FROM current_ranked AS cr
      CROSS JOIN team_avg AS ta
    ),
    month_comparison AS (
      SELECT
        COALESCE((SELECT SUM(total_orders)::INTEGER FROM current_month), 0) AS current_orders,
        COALESCE((SELECT SUM(total_orders)::INTEGER FROM prev_month), 0) AS previous_orders,
        COALESCE((SELECT SUM(active_days)::INTEGER FROM current_month), 0) AS current_active_days,
        COALESCE((SELECT SUM(active_days)::INTEGER FROM prev_month), 0) AS previous_active_days
    ),
    week_comparison AS (
      SELECT
        COALESCE((
          SELECT SUM(total_orders)::INTEGER
          FROM public.v_rider_daily_performance
          WHERE date BETWEEN v_week_start AND v_effective_end
        ), 0) AS current_orders,
        COALESCE((
          SELECT SUM(total_orders)::INTEGER
          FROM public.v_rider_daily_performance
          WHERE date BETWEEN v_prev_week_start AND v_prev_week_end
        ), 0) AS previous_orders
    ),
    daily_trend AS (
      SELECT
        date::TEXT AS date,
        SUM(total_orders)::INTEGER AS orders
      FROM public.v_rider_daily_performance
      WHERE date BETWEEN v_start AND v_effective_end
      GROUP BY date
      ORDER BY date
    ),
    monthly_trend AS (
      SELECT
        ms.month_year,
        COALESCE(SUM(mp.total_orders), 0)::INTEGER AS total_orders,
        COUNT(*) FILTER (WHERE COALESCE(mp.total_orders, 0) > 0)::INTEGER AS active_riders,
        ROUND(
          COALESCE(SUM(mp.total_orders), 0)::NUMERIC
          / NULLIF(COUNT(*) FILTER (WHERE COALESCE(mp.total_orders, 0) > 0), 0),
          2
        ) AS avg_orders_per_rider
      FROM (
        SELECT to_char((v_start - (gs * INTERVAL '1 month'))::DATE, 'YYYY-MM') AS month_year
        FROM generate_series(5, 0, -1) AS gs
      ) AS ms
      LEFT JOIN public.v_rider_monthly_performance AS mp
        ON mp.month_year = ms.month_year
      GROUP BY ms.month_year
      ORDER BY ms.month_year
    ),
    active_employees AS (
      SELECT COUNT(*)::INTEGER AS total
      FROM public.employees
      WHERE status = _const_employee_active()
    ),
    targets_summary AS (
      SELECT
        COALESCE(SUM(target_orders), 0)::INTEGER AS total_target_orders
      FROM public.app_targets
      WHERE month_year = p_month_year
    ),
    alerts_source AS (
      SELECT
        cr.employee_id,
        cr.employee_name,
        cr.total_orders,
        cr.active_days,
        cr.growth_pct,
        cr.last_active_date,
        cr.target_achievement_pct,
        cr.consistency_ratio,
        'declining'::TEXT AS alert_type,
        'high'::TEXT AS severity,
        1 AS severity_rank
      FROM current_ranked AS cr
      WHERE cr.prev_total_orders >= 50
        AND cr.growth_pct <= -20

      UNION ALL

      SELECT
        cr.employee_id,
        cr.employee_name,
        cr.total_orders,
        cr.active_days,
        cr.growth_pct,
        cr.last_active_date,
        cr.target_achievement_pct,
        cr.consistency_ratio,
        'inactive_recently'::TEXT AS alert_type,
        'high'::TEXT AS severity,
        1 AS severity_rank
      FROM current_ranked AS cr
      WHERE cr.total_orders > 0
        AND cr.last_active_date IS NOT NULL
        AND cr.last_active_date <= (v_effective_end - INTERVAL '3 day')::DATE

      UNION ALL

      SELECT
        cr.employee_id,
        cr.employee_name,
        cr.total_orders,
        cr.active_days,
        cr.growth_pct,
        cr.last_active_date,
        cr.target_achievement_pct,
        cr.consistency_ratio,
        'below_target'::TEXT AS alert_type,
        'medium'::TEXT AS severity,
        2 AS severity_rank
      FROM current_ranked AS cr
      WHERE cr.monthly_target_orders > 0
        AND cr.target_achievement_pct < 70

      UNION ALL

      SELECT
        cr.employee_id,
        cr.employee_name,
        cr.total_orders,
        cr.active_days,
        cr.growth_pct,
        cr.last_active_date,
        cr.target_achievement_pct,
        cr.consistency_ratio,
        'low_consistency'::TEXT AS alert_type,
        'medium'::TEXT AS severity,
        2 AS severity_rank
      FROM current_ranked AS cr
      WHERE cr.active_days >= 8
        AND cr.consistency_ratio < 0.5
    )
    SELECT jsonb_build_object(
      'monthYear', p_month_year,
      'effectiveEndDate', v_effective_end::TEXT,
      'leaderboardDate', COALESCE((SELECT date::TEXT FROM leaderboard_date), v_effective_end::TEXT),
      'summary', jsonb_build_object(
        'totalOrders', COALESCE((SELECT current_orders FROM month_comparison), 0),
        'activeRiders', COALESCE((SELECT COUNT(*)::INTEGER FROM current_month WHERE total_orders > 0), 0),
        'activeEmployees', COALESCE((SELECT total FROM active_employees), 0),
        'avgOrdersPerRider', COALESCE((
          SELECT ROUND(
            COALESCE((SELECT current_orders FROM month_comparison), 0)::NUMERIC
            / NULLIF((SELECT COUNT(*)::INTEGER FROM current_month WHERE total_orders > 0), 0),
            2
          )
        ), 0),
        'topPerformerToday', (
          SELECT jsonb_build_object(
            'employeeId', employee_id,
            'employeeName', employee_name,
            'totalOrders', total_orders
          )
          FROM current_day_ranked
          WHERE top_rank = 1
        ),
        'lowPerformerToday', (
          SELECT jsonb_build_object(
            'employeeId', employee_id,
            'employeeName', employee_name,
            'totalOrders', total_orders
          )
          FROM current_day_ranked
          WHERE low_rank = 1
        ),
        'topPerformerMonth', (
          SELECT jsonb_build_object(
            'employeeId', employee_id,
            'employeeName', employee_name,
            'totalOrders', total_orders,
            'rank', rank_position
          )
          FROM current_ranked
          WHERE rank_position = 1
        ),
        'lowPerformerMonth', (
          SELECT jsonb_build_object(
            'employeeId', employee_id,
            'employeeName', employee_name,
            'totalOrders', total_orders
          )
          FROM current_ranked
          WHERE total_orders > 0
          ORDER BY total_orders ASC, employee_name
          LIMIT 1
        )
      ),
      'comparison', jsonb_build_object(
        'month', (
          SELECT jsonb_build_object(
            'currentOrders', current_orders,
            'previousOrders', previous_orders,
            'growthPct',
              CASE
                WHEN previous_orders > 0 THEN ROUND(((current_orders - previous_orders)::NUMERIC / previous_orders::NUMERIC) * 100, 2)
                WHEN current_orders > 0 THEN 100
                ELSE 0
              END,
            'currentActiveDays', current_active_days,
            'previousActiveDays', previous_active_days,
            'activeDaysDelta', current_active_days - previous_active_days
          )
          FROM month_comparison
        ),
        'week', (
          SELECT jsonb_build_object(
            'currentOrders', current_orders,
            'previousOrders', previous_orders,
            'growthPct',
              CASE
                WHEN previous_orders > 0 THEN ROUND(((current_orders - previous_orders)::NUMERIC / previous_orders::NUMERIC) * 100, 2)
                WHEN current_orders > 0 THEN 100
                ELSE 0
              END
          )
          FROM week_comparison
        )
      ),
      'targets', (
        SELECT jsonb_build_object(
          'totalTargetOrders', total_target_orders,
          'targetAchievementPct',
            CASE
              WHEN total_target_orders > 0 THEN
                ROUND((
                  COALESCE((SELECT current_orders FROM month_comparison), 0)::NUMERIC
                  / total_target_orders::NUMERIC
                ) * 100, 2)
              ELSE 0
            END
        )
        FROM targets_summary
      ),
      'distribution', (
        SELECT jsonb_build_object(
          'excellent', excellent,
          'average', average,
          'weak', weak
        )
        FROM performance_distribution
      ),
      'ordersByApp', COALESCE((
        SELECT jsonb_agg(
          jsonb_build_object(
            'appId', app_id,
            'appName', app_name,
            'brandColor', brand_color,
            'textColor', text_color,
            _const_work_orders()::TEXT, total_orders,
            'riders', rider_count,
            'targetOrders', target_orders,
            'targetAchievementPct', target_achievement_pct,
            'previousOrders', previous_orders,
            'growthPct', growth_pct
          )
          ORDER BY total_orders DESC, app_name
        )
        FROM app_comparison
      ), '[]'::jsonb),
      'ordersByCity', COALESCE((
        SELECT jsonb_agg(
          jsonb_build_object(
            'city', city,
            _const_work_orders()::TEXT, orders
          )
          ORDER BY orders DESC, city
        )
        FROM orders_by_city
      ), '[]'::jsonb),
      'dailyTrend', COALESCE((
        SELECT jsonb_agg(
          jsonb_build_object(
            'date', date,
            _const_work_orders()::TEXT, orders
          )
          ORDER BY date
        )
        FROM daily_trend
      ), '[]'::jsonb),
      'monthlyTrend', COALESCE((
        SELECT jsonb_agg(
          jsonb_build_object(
            'monthYear', month_year,
            'totalOrders', total_orders,
            'activeRiders', active_riders,
            'avgOrdersPerRider', COALESCE(avg_orders_per_rider, 0)
          )
          ORDER BY month_year
        )
        FROM monthly_trend
      ), '[]'::jsonb),
      'rankings', jsonb_build_object(
        'topPerformers', COALESCE((
          SELECT jsonb_agg(
            jsonb_build_object(
              'employeeId', employee_id,
              'employeeName', employee_name,
              'city', city,
              'totalOrders', total_orders,
              'activeDays', active_days,
              'avgOrdersPerDay', avg_orders_per_day,
              'consistencyRatio', consistency_ratio,
              'growthPct', growth_pct,
              'targetAchievementPct', target_achievement_pct,
              'rank', rank_position,
              'trendCode', trend_code
            )
            ORDER BY rank_position
          )
          FROM (
            SELECT *
            FROM current_ranked
            ORDER BY rank_position
            LIMIT 10
          ) AS ranked_top
        ), '[]'::jsonb),
        'lowPerformers', COALESCE((
          SELECT jsonb_agg(
            jsonb_build_object(
              'employeeId', employee_id,
              'employeeName', employee_name,
              'city', city,
              'totalOrders', total_orders,
              'activeDays', active_days,
              'avgOrdersPerDay', avg_orders_per_day,
              'consistencyRatio', consistency_ratio,
              'growthPct', growth_pct,
              'targetAchievementPct', target_achievement_pct,
              'rank', rank_position,
              'trendCode', trend_code
            )
            ORDER BY total_orders ASC, employee_name
          )
          FROM (
            SELECT *
            FROM current_ranked
            WHERE total_orders > 0
            ORDER BY total_orders ASC, employee_name
            LIMIT 10
          ) AS ranked_low
        ), '[]'::jsonb),
        'mostImproved', COALESCE((
          SELECT jsonb_agg(
            jsonb_build_object(
              'employeeId', employee_id,
              'employeeName', employee_name,
              'city', city,
              'totalOrders', total_orders,
              'activeDays', active_days,
              'avgOrdersPerDay', avg_orders_per_day,
              'consistencyRatio', consistency_ratio,
              'growthPct', growth_pct,
              'targetAchievementPct', target_achievement_pct,
              'rank', rank_position,
              'trendCode', trend_code
            )
            ORDER BY growth_pct DESC, total_orders DESC
          )
          FROM (
            SELECT *
            FROM current_ranked
            WHERE growth_pct > 0
            ORDER BY growth_pct DESC, total_orders DESC
            LIMIT 10
          ) AS ranked_improved
        ), '[]'::jsonb),
        'mostDeclined', COALESCE((
          SELECT jsonb_agg(
            jsonb_build_object(
              'employeeId', employee_id,
              'employeeName', employee_name,
              'city', city,
              'totalOrders', total_orders,
              'activeDays', active_days,
              'avgOrdersPerDay', avg_orders_per_day,
              'consistencyRatio', consistency_ratio,
              'growthPct', growth_pct,
              'targetAchievementPct', target_achievement_pct,
              'rank', rank_position,
              'trendCode', trend_code
            )
            ORDER BY growth_pct ASC, total_orders ASC
          )
          FROM (
            SELECT *
            FROM current_ranked
            WHERE growth_pct < 0
            ORDER BY growth_pct ASC, total_orders ASC
            LIMIT 10
          ) AS ranked_declined
        ), '[]'::jsonb)
      ),
      'alerts', COALESCE((
        SELECT jsonb_agg(
          jsonb_build_object(
            'employeeId', employee_id,
            'employeeName', employee_name,
            'alertType', alert_type,
            'severity', severity,
            'totalOrders', total_orders,
            'activeDays', active_days,
            'growthPct', growth_pct,
            'lastActiveDate', last_active_date,
            'targetAchievementPct', target_achievement_pct,
            'consistencyRatio', consistency_ratio
          )
          ORDER BY severity_rank ASC, total_orders DESC, employee_name
        )
        FROM (
          SELECT *
          FROM alerts_source
          ORDER BY severity_rank ASC, total_orders DESC, employee_name
          LIMIT 12
        ) AS ranked_alerts
      ), '[]'::jsonb)
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.rider_profile_performance_rpc(
  p_employee_id UUID,
  p_month_year TEXT,
  p_today DATE DEFAULT CURRENT_DATE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_start DATE;
  v_end DATE;
  v_effective_end DATE;
  v_prev_month TEXT;
  v_week_start DATE;
  v_prev_week_end DATE;
  v_prev_week_start DATE;
BEGIN
  IF NOT (
    public.is_active_user(auth.uid())
    AND (
      public.has_role(auth.uid(), _const_role_admin())
      OR public.has_role(auth.uid(), _const_role_hr())
      OR public.has_role(auth.uid(), _const_role_finance())
      OR public.has_role(auth.uid(), _const_role_operations())
    )
  ) THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;

  IF p_month_year !~ '^\d{4}-\d{2}$' THEN
    RAISE EXCEPTION 'Invalid month_year format. Expected YYYY-MM';
  END IF;

  v_start := to_date(p_month_year || '-01', 'YYYY-MM-DD');
  v_end := (v_start + INTERVAL '1 month - 1 day')::DATE;
  v_effective_end := LEAST(COALESCE(p_today, CURRENT_DATE), v_end);
  v_prev_month := to_char((v_start - INTERVAL '1 month')::DATE, 'YYYY-MM');
  v_week_start := (v_effective_end - INTERVAL '6 day')::DATE;
  v_prev_week_end := (v_week_start - INTERVAL '1 day')::DATE;
  v_prev_week_start := (v_prev_week_end - INTERVAL '6 day')::DATE;

  RETURN (
    WITH employee_base AS (
      SELECT
        e.id,
        e.name,
        e.phone,
        e.city,
        e.join_date
      FROM public.employees AS e
      WHERE e.id = p_employee_id
    ),
    employee_platforms AS (
      SELECT
        a.id AS app_id,
        a.name AS app_name,
        COALESCE(a.brand_color, '#2563eb') AS brand_color,
        ea.status
      FROM public.employee_apps AS ea
      JOIN public.apps AS a
        ON a.id = ea.app_id
      WHERE ea.employee_id = p_employee_id
      ORDER BY a.name
    ),
    current_month AS MATERIALIZED (
      SELECT *
      FROM public.v_rider_monthly_performance
      WHERE employee_id = p_employee_id
        AND month_year = p_month_year
      LIMIT 1
    ),
    prev_month AS MATERIALIZED (
      SELECT *
      FROM public.v_rider_monthly_performance
      WHERE employee_id = p_employee_id
        AND month_year = v_prev_month
      LIMIT 1
    ),
    current_rank AS (
      SELECT
        ranked.employee_id,
        ranked.rank_position,
        ranked.total_riders
      FROM (
        SELECT
          employee_id,
          ROW_NUMBER() OVER (
            ORDER BY total_orders DESC, avg_orders_per_day DESC, employee_name
          ) AS rank_position,
          COUNT(*) OVER () AS total_riders
        FROM public.v_rider_monthly_performance
        WHERE month_year = p_month_year
      ) AS ranked
      WHERE ranked.employee_id = p_employee_id
    ),
    employee_target AS (
      SELECT
        monthly_target_orders,
        daily_target_orders
      FROM public.employee_targets
      WHERE employee_id = p_employee_id
        AND month_year = p_month_year
      LIMIT 1
    ),
    monthly_series AS (
      SELECT to_char((v_start - (gs * INTERVAL '1 month'))::DATE, 'YYYY-MM') AS month_year
      FROM generate_series(2, 0, -1) AS gs
    ),
    last_three_months AS (
      SELECT
        ms.month_year,
        COALESCE(mp.total_orders, 0)::INTEGER AS total_orders,
        COALESCE(mp.avg_orders_per_day, 0) AS avg_orders_per_day,
        COALESCE(mp.active_days, 0)::INTEGER AS active_days,
        COALESCE(mp.consistency_ratio, 0) AS consistency_ratio,
        COALESCE(mp.target_achievement_pct, 0) AS target_achievement_pct
      FROM monthly_series AS ms
      LEFT JOIN public.v_rider_monthly_performance AS mp
        ON mp.employee_id = p_employee_id
       AND mp.month_year = ms.month_year
      ORDER BY ms.month_year
    ),
    recent_daily_orders AS (
      SELECT
        d.date::TEXT AS date,
        d.total_orders
      FROM public.v_rider_daily_performance AS d
      WHERE d.employee_id = p_employee_id
        AND d.date BETWEEN GREATEST(v_start, (v_effective_end - INTERVAL '20 day')::DATE) AND v_effective_end
      ORDER BY d.date
    ),
    platform_breakdown AS (
      SELECT
        p.app_id,
        MAX(p.app_name) AS app_name,
        MAX(p.brand_color) AS brand_color,
        SUM(p.total_orders)::INTEGER AS total_orders
      FROM public.v_rider_daily_platform_orders AS p
      WHERE p.employee_id = p_employee_id
        AND p.date BETWEEN v_start AND v_effective_end
      GROUP BY p.app_id
      ORDER BY total_orders DESC, app_name
    ),
    week_comparison AS (
      SELECT
        COALESCE((
          SELECT SUM(total_orders)::INTEGER
          FROM public.v_rider_daily_performance
          WHERE employee_id = p_employee_id
            AND date BETWEEN v_week_start AND v_effective_end
        ), 0) AS current_orders,
        COALESCE((
          SELECT SUM(total_orders)::INTEGER
          FROM public.v_rider_daily_performance
          WHERE employee_id = p_employee_id
            AND date BETWEEN v_prev_week_start AND v_prev_week_end
        ), 0) AS previous_orders
    ),
    salary_snapshot AS (
      SELECT
        base_salary,
        allowances,
        advance_deduction,
        external_deduction,
        manual_deduction,
        attendance_deduction,
        net_salary,
        is_approved,
        payment_method
      FROM public.salary_records
      WHERE employee_id = p_employee_id
        AND month_year = p_month_year
      LIMIT 1
    ),
    derived_metrics AS (
      SELECT
        COALESCE((SELECT total_orders FROM current_month), 0)::INTEGER AS current_orders,
        COALESCE((SELECT total_orders FROM prev_month), 0)::INTEGER AS previous_orders,
        COALESCE((SELECT active_days FROM current_month), 0)::INTEGER AS current_active_days,
        COALESCE((SELECT active_days FROM prev_month), 0)::INTEGER AS previous_active_days,
        COALESCE((SELECT avg_orders_per_day FROM current_month), 0) AS current_avg_orders_per_day,
        COALESCE((SELECT avg_orders_per_day FROM prev_month), 0) AS previous_avg_orders_per_day,
        COALESCE((SELECT consistency_ratio FROM current_month), 0) AS current_consistency_ratio,
        COALESCE((SELECT target_achievement_pct FROM current_month), 0) AS current_target_achievement_pct,
        COALESCE((SELECT monthly_target_orders FROM current_month), (SELECT monthly_target_orders FROM employee_target), 0)::INTEGER AS current_monthly_target_orders,
        COALESCE((SELECT daily_target_orders FROM current_month), (SELECT daily_target_orders FROM employee_target), 0)::INTEGER AS current_daily_target_orders,
        COALESCE((SELECT last_active_date FROM current_month), NULL) AS last_active_date
    ),
    alerts_source AS (
      SELECT
        'declining'::TEXT AS alert_type,
        'high'::TEXT AS severity,
        1 AS severity_rank
      FROM derived_metrics
      WHERE previous_orders >= 30
        AND (
          CASE
            WHEN previous_orders > 0 THEN ((current_orders - previous_orders)::NUMERIC / previous_orders::NUMERIC) * 100
            WHEN current_orders > 0 THEN 100
            ELSE 0
          END
        ) <= -20

      UNION ALL

      SELECT
        'inactive_recently'::TEXT AS alert_type,
        'high'::TEXT AS severity,
        1 AS severity_rank
      FROM derived_metrics
      WHERE current_orders > 0
        AND last_active_date IS NOT NULL
        AND last_active_date <= (v_effective_end - INTERVAL '3 day')::DATE

      UNION ALL

      SELECT
        'below_target'::TEXT AS alert_type,
        'medium'::TEXT AS severity,
        2 AS severity_rank
      FROM derived_metrics
      WHERE current_monthly_target_orders > 0
        AND current_target_achievement_pct < 70

      UNION ALL

      SELECT
        'low_consistency'::TEXT AS alert_type,
        'medium'::TEXT AS severity,
        2 AS severity_rank
      FROM derived_metrics
      WHERE current_active_days >= 8
        AND current_consistency_ratio < 0.5
    ),
    judgment AS (
      SELECT
        CASE
          WHEN dm.current_orders = 0 THEN 'inactive'
          WHEN dm.previous_orders > 0
            AND (((dm.current_orders - dm.previous_orders)::NUMERIC / dm.previous_orders::NUMERIC) * 100) >= 10
            AND dm.current_consistency_ratio >= 0.65 THEN 'excellent_stable'
          WHEN dm.previous_orders > 0
            AND (((dm.current_orders - dm.previous_orders)::NUMERIC / dm.previous_orders::NUMERIC) * 100) <= -10 THEN 'declining'
          WHEN dm.current_monthly_target_orders > 0
            AND dm.current_target_achievement_pct < 60 THEN 'below_target'
          WHEN dm.current_consistency_ratio >= 0.7 THEN 'stable'
          ELSE 'average'
        END AS judgment_code,
        CASE
          WHEN dm.previous_orders > 0
            AND (((dm.current_orders - dm.previous_orders)::NUMERIC / dm.previous_orders::NUMERIC) * 100) >= 5 THEN 'up'
          WHEN dm.previous_orders > 0
            AND (((dm.current_orders - dm.previous_orders)::NUMERIC / dm.previous_orders::NUMERIC) * 100) <= -5 THEN 'down'
          ELSE 'stable'
        END AS trend_code
      FROM derived_metrics AS dm
    )
    SELECT jsonb_build_object(
      'monthYear', p_month_year,
      'effectiveEndDate', v_effective_end::TEXT,
      'employee', (
        SELECT jsonb_build_object(
          'employeeId', eb.id,
          'employeeName', eb.name,
          'phone', eb.phone,
          'city', eb.city,
          'joinDate', eb.join_date
        )
        FROM employee_base AS eb
      ),
      'summary', (
        SELECT jsonb_build_object(
          'totalOrders', dm.current_orders,
          'avgOrdersPerDay', dm.current_avg_orders_per_day,
          'activeDays', dm.current_active_days,
          'consistencyRatio', dm.current_consistency_ratio,
          'monthlyTargetOrders', dm.current_monthly_target_orders,
          'dailyTargetOrders', dm.current_daily_target_orders,
          'targetAchievementPct', dm.current_target_achievement_pct,
          'rank', COALESCE((SELECT rank_position FROM current_rank), 0),
          'rankOutOf', COALESCE((SELECT total_riders FROM current_rank), 0),
          'lastActiveDate', dm.last_active_date
        )
        FROM derived_metrics AS dm
      ),
      'comparison', jsonb_build_object(
        'month', (
          SELECT jsonb_build_object(
            'currentOrders', dm.current_orders,
            'previousOrders', dm.previous_orders,
            'growthPct',
              CASE
                WHEN dm.previous_orders > 0 THEN ROUND(((dm.current_orders - dm.previous_orders)::NUMERIC / dm.previous_orders::NUMERIC) * 100, 2)
                WHEN dm.current_orders > 0 THEN 100
                ELSE 0
              END,
            'currentAvgOrdersPerDay', dm.current_avg_orders_per_day,
            'previousAvgOrdersPerDay', dm.previous_avg_orders_per_day,
            'avgGrowthPct',
              CASE
                WHEN dm.previous_avg_orders_per_day > 0 THEN ROUND(((dm.current_avg_orders_per_day - dm.previous_avg_orders_per_day) / dm.previous_avg_orders_per_day) * 100, 2)
                WHEN dm.current_avg_orders_per_day > 0 THEN 100
                ELSE 0
              END,
            'currentActiveDays', dm.current_active_days,
            'previousActiveDays', dm.previous_active_days,
            'activeDaysDelta', dm.current_active_days - dm.previous_active_days
          )
          FROM derived_metrics AS dm
        ),
        'week', (
          SELECT jsonb_build_object(
            'currentOrders', current_orders,
            'previousOrders', previous_orders,
            'growthPct',
              CASE
                WHEN previous_orders > 0 THEN ROUND(((current_orders - previous_orders)::NUMERIC / previous_orders::NUMERIC) * 100, 2)
                WHEN current_orders > 0 THEN 100
                ELSE 0
              END
          )
          FROM week_comparison
        )
      ),
      'platforms', COALESCE((
        SELECT jsonb_agg(
          jsonb_build_object(
            'appId', ep.app_id,
            'appName', ep.app_name,
            'brandColor', ep.brand_color,
            'status', ep.status
          )
          ORDER BY ep.app_name
        )
        FROM employee_platforms AS ep
      ), '[]'::jsonb),
      'platformBreakdown', COALESCE((
        SELECT jsonb_agg(
          jsonb_build_object(
            'appId', pb.app_id,
            'appName', pb.app_name,
            'brandColor', pb.brand_color,
            _const_work_orders(), pb.total_orders
          )
          ORDER BY pb.total_orders DESC, pb.app_name
        )
        FROM platform_breakdown AS pb
      ), '[]'::jsonb),
      'recentDailyOrders', COALESCE((
        SELECT jsonb_agg(
          jsonb_build_object(
            'date', rdo.date,
            _const_work_orders(), rdo.total_orders
          )
          ORDER BY rdo.date
        )
        FROM recent_daily_orders AS rdo
      ), '[]'::jsonb),
      'lastThreeMonths', COALESCE((
        SELECT jsonb_agg(
          jsonb_build_object(
            'monthYear', month_year,
            'totalOrders', total_orders,
            'avgOrdersPerDay', avg_orders_per_day,
            'activeDays', active_days,
            'consistencyRatio', consistency_ratio,
            'targetAchievementPct', target_achievement_pct
          )
          ORDER BY month_year
        )
        FROM last_three_months
      ), '[]'::jsonb),
      'trend', (
        SELECT jsonb_build_object(
          'trendCode', j.trend_code,
          'judgmentCode', j.judgment_code
        )
        FROM judgment AS j
      ),
      'alerts', COALESCE((
        SELECT jsonb_agg(
          jsonb_build_object(
            'alertType', alert_type,
            'severity', severity
          )
          ORDER BY severity_rank, alert_type
        )
        FROM alerts_source
      ), '[]'::jsonb),
      'salary', (
        SELECT jsonb_build_object(
          'baseSalary', COALESCE(ss.base_salary, 0),
          'allowances', COALESCE(ss.allowances, 0),
          'attendanceDeduction', COALESCE(ss.attendance_deduction, 0),
          'advanceDeduction', COALESCE(ss.advance_deduction, 0),
          'externalDeduction', COALESCE(ss.external_deduction, 0),
          'manualDeduction', COALESCE(ss.manual_deduction, 0),
          'netSalary', COALESCE(ss.net_salary, 0),
          'isApproved', COALESCE(ss.is_approved, false),
          'paymentMethod', ss.payment_method
        )
        FROM salary_snapshot AS ss
      )
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.calculate_employee_salary(
  p_employee_id UUID,
  p_month_year TEXT,
  p_payment_method TEXT DEFAULT NULL,
  p_manual_deduction NUMERIC DEFAULT 0,
  p_manual_deduction_note TEXT DEFAULT NULL
)
RETURNS TABLE (
  employee_id UUID,
  employee_name TEXT,
  base_salary NUMERIC,
  total_orders INTEGER,
  total_shift_days INTEGER,
  total_earnings NUMERIC,
  advance_deduction NUMERIC,
  external_deduction NUMERIC,
  manual_deduction NUMERIC,
  manual_deduction_note TEXT,
  attendance_deduction NUMERIC,
  net_salary NUMERIC,
  platform_breakdown JSONB,
  payment_method TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_employee RECORD;
  v_start DATE;
  v_end DATE;
  v_total_orders INTEGER := 0;
  v_total_shift_days INTEGER := 0;
  v_total_earnings NUMERIC := 0;
  v_advance_deduction NUMERIC := 0;
  v_external_deduction NUMERIC := 0;
  v_attendance_deduction NUMERIC := 0;
  v_app RECORD;
  v_app_orders INTEGER := 0;
  v_app_shifts INTEGER := 0;
  v_app_earnings NUMERIC := 0;
  v_pricing_rule RECORD;
  v_hybrid_rule RECORD;
  v_hours_worked NUMERIC;
  v_day RECORD;
  v_platform_breakdown JSONB := '[]'::JSONB;
  v_platform_item JSONB;
  v_payment_method TEXT;
BEGIN
  v_start := (p_month_year || '-01')::DATE;
  v_end := (v_start + INTERVAL '1 month' - INTERVAL '1 day')::DATE;

  SELECT * INTO v_employee FROM public.employees WHERE id = p_employee_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Employee not found: %', p_employee_id;
  END IF;

  FOR v_app IN
    SELECT a.id, a.name, COALESCE(a.work_type, _const_work_orders()) AS work_type
    FROM public.apps a
    JOIN public.employee_apps ea ON ea.app_id = a.id
    WHERE ea.employee_id = p_employee_id
      AND ea.status = _const_employee_active()
      AND a.is_active IS TRUE
    ORDER BY a.name
  LOOP
    v_app_orders := 0;
    v_app_shifts := 0;
    v_app_earnings := 0;

    IF v_app.work_type = _const_work_orders() THEN
      SELECT COALESCE(SUM(d.orders_count), 0)::INTEGER INTO v_app_orders
      FROM public.daily_orders AS d
      WHERE d.employee_id = p_employee_id
        AND d.app_id = v_app.id
        AND d.date BETWEEN v_start AND v_end
        AND (d.status IS NULL OR d.status <> _const_order_cancelled());
      v_total_orders := v_total_orders + v_app_orders;
      v_app_earnings := public.calc_tier_salary(v_app_orders);

    ELSIF v_app.work_type = _const_work_shift() THEN
      SELECT COUNT(*)::INTEGER INTO v_app_shifts
      FROM public.daily_shifts AS s
      WHERE s.employee_id = p_employee_id
        AND s.app_id = v_app.id
        AND s.date BETWEEN v_start AND v_end
        AND s.hours_worked > 0;
      v_total_shift_days := v_total_shift_days + v_app_shifts;

      SELECT * INTO v_pricing_rule
      FROM public.pricing_rules
      WHERE app_id = v_app.id AND is_active IS TRUE
      ORDER BY priority DESC LIMIT 1;

      IF v_pricing_rule.fixed_salary IS NOT NULL THEN
        v_app_earnings := v_app_shifts * v_pricing_rule.fixed_salary;
      ELSE
        v_app_earnings := v_app_shifts * 150;
      END IF;

    ELSIF v_app.work_type = _const_work_hybrid() THEN
      SELECT * INTO v_hybrid_rule FROM public.app_hybrid_rules WHERE app_id = v_app.id;

      IF v_hybrid_rule IS NULL THEN
        SELECT COALESCE(SUM(d.orders_count), 0)::INTEGER INTO v_app_orders
        FROM public.daily_orders AS d
        WHERE d.employee_id = p_employee_id
          AND d.app_id = v_app.id
          AND d.date BETWEEN v_start AND v_end
          AND (d.status IS NULL OR d.status <> _const_order_cancelled());
        v_total_orders := v_total_orders + v_app_orders;
        v_app_earnings := public.calc_tier_salary(v_app_orders);
      ELSE
        FOR v_day IN
          SELECT generate_series(v_start, v_end, '1 day'::interval)::date AS day_date
        LOOP
          SELECT ds.hours_worked INTO v_hours_worked
          FROM public.daily_shifts AS ds
          WHERE ds.employee_id = p_employee_id
            AND ds.app_id = v_app.id
            AND ds.date = v_day.day_date;

          IF v_hours_worked IS NOT NULL AND v_hours_worked > 0 THEN
            v_app_earnings := v_app_earnings + v_hybrid_rule.shift_rate;
            v_total_shift_days := v_total_shift_days + 1;
          ELSE
            IF v_hybrid_rule.fallback_to_orders THEN
              SELECT COALESCE(SUM(d.orders_count), 0)::INTEGER INTO v_app_orders
              FROM public.daily_orders AS d
              WHERE d.employee_id = p_employee_id
                AND d.app_id = v_app.id
                AND d.date = v_day.day_date
                AND (d.status IS NULL OR d.status <> _const_order_cancelled());
              v_total_orders := v_total_orders + v_app_orders;
              IF v_app_orders > 0 THEN
                v_app_earnings := v_app_earnings + public.calc_tier_salary(v_app_orders);
              END IF;
            END IF;
          END IF;
        END LOOP;
      END IF;
    END IF;

    v_total_earnings := v_total_earnings + v_app_earnings;
    v_platform_item := jsonb_build_object(
      'app_id', v_app.id,
      'app_name', v_app.name,
      'work_type', v_app.work_type,
      _const_work_orders(), v_app_orders,
      'shift_days', v_app_shifts,
      'earnings', v_app_earnings
    );
    v_platform_breakdown := v_platform_breakdown || jsonb_build_array(v_platform_item);
  END LOOP;

  -- Advance deductions (month_year is correct for advance_installments)
  SELECT COALESCE(SUM(ai.amount), 0) INTO v_advance_deduction
  FROM public.advance_installments ai
  JOIN public.advances a ON a.id = ai.advance_id
  WHERE a.employee_id = p_employee_id
    AND ai.month_year = p_month_year
    AND ai.status = _const_installment_pending();

  -- FIX: external_deductions uses apply_month (not month_year)
  --      and approval_status (not status)
  SELECT COALESCE(SUM(ed.amount), 0) INTO v_external_deduction
  FROM public.external_deductions ed
  WHERE ed.employee_id = p_employee_id
    AND ed.apply_month = p_month_year
    AND ed.approval_status = _const_approval_approved();

  v_payment_method := COALESCE(
    p_payment_method,
    CASE WHEN v_employee.iban IS NOT NULL
         THEN _const_payment_bank()
         ELSE _const_payment_cash()
    END
  );

  RETURN QUERY SELECT
    p_employee_id,
    v_employee.name::TEXT,
    v_total_earnings,
    v_total_orders,
    v_total_shift_days,
    v_total_earnings,
    v_advance_deduction,
    v_external_deduction,
    p_manual_deduction,
    p_manual_deduction_note,
    v_attendance_deduction,
    v_total_earnings - v_advance_deduction - v_external_deduction
      - p_manual_deduction - v_attendance_deduction,
    v_platform_breakdown,
    v_payment_method;
END;
$$;

CREATE OR REPLACE FUNCTION _const_order_cancelled() RETURNS TEXT AS $$
  SELECT 'cancelled'::TEXT;
$$ LANGUAGE SQL IMMUTABLE SET search_path = public;

-- Get installment statuses: pending, deferred
CREATE OR REPLACE FUNCTION _const_installment_pending() RETURNS TEXT AS $$
  SELECT 'pending'::TEXT;
$$ LANGUAGE SQL IMMUTABLE SET search_path = public;

CREATE OR REPLACE FUNCTION _const_installment_deferred() RETURNS TEXT
  LANGUAGE sql IMMUTABLE PARALLEL SAFE
  SET search_path TO public
AS $$ SELECT 'deferred'::TEXT; $$;

CREATE OR REPLACE FUNCTION _const_work_orders() RETURNS TEXT
  LANGUAGE sql IMMUTABLE PARALLEL SAFE
  SET search_path TO public
AS $$ SELECT 'orders'::TEXT; $$;

CREATE OR REPLACE FUNCTION _const_work_hybrid() RETURNS TEXT AS $$
  SELECT 'hybrid'::TEXT;
$$ LANGUAGE SQL IMMUTABLE SET search_path = public;

-- Get days per month constant
CREATE OR REPLACE FUNCTION _const_days_per_month() RETURNS NUMERIC AS $$
  SELECT 30.0::NUMERIC;
$$ LANGUAGE SQL IMMUTABLE SET search_path = public;

CREATE OR REPLACE FUNCTION _const_employee_active() RETURNS TEXT
  LANGUAGE sql IMMUTABLE PARALLEL SAFE
  SET search_path TO public
AS $$ SELECT 'active'::TEXT; $$;

CREATE OR REPLACE FUNCTION _const_payment_bank() RETURNS TEXT AS $$
  SELECT 'bank'::TEXT;
$$ LANGUAGE SQL IMMUTABLE SET search_path = public;

-- Get calculation status
CREATE OR REPLACE FUNCTION _const_calc_calculated() RETURNS TEXT AS $$
  SELECT 'calculated'::TEXT;
$$ LANGUAGE SQL IMMUTABLE SET search_path = public;

CREATE OR REPLACE FUNCTION _const_calc_source_v6() RETURNS TEXT AS $$
  SELECT 'engine_v6_shift_fallback'::TEXT;
$$ LANGUAGE SQL IMMUTABLE SET search_path = public;

CREATE OR REPLACE FUNCTION _const_calc_source_v7() RETURNS TEXT AS $$
  SELECT 'engine_v7_shift_fixed'::TEXT;
$$ LANGUAGE SQL IMMUTABLE SET search_path = public;

CREATE OR REPLACE FUNCTION _const_calc_method_orders() RETURNS TEXT AS $$
  SELECT _const_work_orders()::TEXT;
$$ LANGUAGE SQL IMMUTABLE SET search_path = public;

CREATE OR REPLACE FUNCTION _const_calc_method_shift() RETURNS TEXT AS $$
  SELECT _const_work_shift()::TEXT;
$$ LANGUAGE SQL IMMUTABLE SET search_path = public;

CREATE OR REPLACE FUNCTION _const_calc_method_shift_fixed() RETURNS TEXT AS $$
  SELECT 'shift_fixed'::TEXT;
$$ LANGUAGE SQL IMMUTABLE SET search_path = public;

CREATE OR REPLACE FUNCTION _const_calc_method_shift_full_month() RETURNS TEXT AS $$
  SELECT 'shift_full_month'::TEXT;
$$ LANGUAGE SQL IMMUTABLE SET search_path = public;

CREATE OR REPLACE FUNCTION _const_calc_method_mixed() RETURNS TEXT AS $$
  SELECT 'mixed'::TEXT;
$$ LANGUAGE SQL IMMUTABLE SET search_path = public;

CREATE OR REPLACE FUNCTION _const_calc_method_orders_fallback() RETURNS TEXT AS $$
  SELECT 'orders_fallback'::TEXT;
$$ LANGUAGE SQL IMMUTABLE SET search_path = public;

CREATE OR REPLACE FUNCTION _const_tier_fixed() RETURNS TEXT AS $$
  SELECT 'fixed_amount'::TEXT;
$$ LANGUAGE SQL IMMUTABLE SET search_path = public;

CREATE OR REPLACE FUNCTION _const_tier_incremental() RETURNS TEXT AS $$
  SELECT 'base_plus_incremental'::TEXT;
$$ LANGUAGE SQL IMMUTABLE SET search_path = public;

CREATE OR REPLACE FUNCTION public.test_shift_salary()
RETURNS TABLE (app_name TEXT, scheme_name TEXT, monthly_amount NUMERIC, daily_rate NUMERIC)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT a.name, s.name, s.monthly_amount, s.monthly_amount / _const_days_per_month()
  FROM apps a
  JOIN salary_schemes s ON s.id = a.scheme_id
  WHERE a.work_type = _const_work_shift() AND a.is_active IS TRUE;
$$;

CREATE OR REPLACE FUNCTION public.preview_salary_for_month_v2(p_month_year TEXT)
RETURNS TABLE (
  employee_id UUID,
  total_orders INTEGER,
  base_salary NUMERIC,
  net_salary NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_start DATE;
  v_end DATE;
  v_emp RECORD;
  v_app RECORD;
  v_orders INTEGER;
  v_earnings NUMERIC;
  v_total_orders INTEGER;
  v_base_salary NUMERIC;
  v_deduction NUMERIC;
  v_net NUMERIC;
  -- Constants (c_days_per_month removed — was declared but never used)
  c_cancelled TEXT := _const_order_cancelled();
  c_active TEXT := _const_employee_active();
  c_approved TEXT := _const_approval_approved();
  c_pending TEXT := _const_installment_pending();
  c_deferred TEXT := _const_installment_deferred();
BEGIN
  v_start := to_date(p_month_year || '-01', 'YYYY-MM-DD');
  v_end := (v_start + INTERVAL '1 month - 1 day')::date;

  FOR v_emp IN
    SELECT e.id FROM employees e
    WHERE e.status = c_active
  LOOP
    v_total_orders := 0;
    v_base_salary := 0;

    FOR v_app IN
      SELECT a.id, a.scheme_id
      FROM apps a
      WHERE a.is_active IS TRUE AND a.scheme_id IS NOT NULL
    LOOP
      SELECT COALESCE(SUM(d.orders_count), 0)::INTEGER INTO v_orders
      FROM daily_orders d
      WHERE d.employee_id = v_emp.id
        AND d.app_id = v_app.id
        AND d.date BETWEEN v_start AND v_end
        AND (d.status IS NULL OR d.status <> c_cancelled);

      v_total_orders := v_total_orders + v_orders;
      v_earnings := calc_tier_salary(v_orders, v_app.scheme_id);
      v_base_salary := v_base_salary + v_earnings;
    END LOOP;

    SELECT COALESCE(SUM(ed.amount), 0) INTO v_deduction
    FROM external_deductions ed
    WHERE ed.employee_id = v_emp.id
      AND ed.apply_month = p_month_year
      AND ed.approval_status = c_approved;

    SELECT COALESCE(SUM(ai.amount), 0) INTO v_deduction
    FROM advances ad
    JOIN advance_installments ai ON ai.advance_id = ad.id
    WHERE ad.employee_id = v_emp.id
      AND ai.month_year = p_month_year
      AND ai.status IN (c_pending, c_deferred);

    v_net := GREATEST(v_base_salary - v_deduction, 0);

    employee_id := v_emp.id;
    total_orders := v_total_orders;
    base_salary := v_base_salary;
    net_salary := v_net;
    RETURN NEXT;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.check_employee_operational_records(p_employee_id UUID)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.daily_orders        WHERE employee_id = p_employee_id
    UNION ALL
    SELECT 1 FROM public.advances            WHERE employee_id = p_employee_id
    UNION ALL
    SELECT 1 FROM public.attendance          WHERE employee_id = p_employee_id
    UNION ALL
    SELECT 1 FROM public.vehicle_assignments WHERE employee_id = p_employee_id
    UNION ALL
    SELECT 1 FROM public.platform_accounts   WHERE employee_id = p_employee_id
    UNION ALL
    SELECT 1 FROM public.salary_records      WHERE employee_id = p_employee_id
  );
$$;

CREATE OR REPLACE FUNCTION public.text_to_employee_status(text)
  RETURNS public.employee_status
  LANGUAGE SQL IMMUTABLE STRICT
  SET search_path = public
AS $$
  SELECT $1::public.employee_status;
$$;

CREATE OR REPLACE FUNCTION public.is_admin_or_hr(uid uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN (
    public.has_role(uid, _const_role_admin())
    OR public.has_role(uid, _const_role_hr())
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.eq_emp_status_text(a public.employee_status, b text)
  RETURNS boolean LANGUAGE sql IMMUTABLE STRICT
  SET search_path = public
AS $$ SELECT a::text = b; $$;

CREATE OR REPLACE FUNCTION public.eq_text_emp_status(a text, b public.employee_status)
  RETURNS boolean LANGUAGE sql IMMUTABLE STRICT
  SET search_path = public
AS $$ SELECT a = b::text; $$;

CREATE OR REPLACE FUNCTION public.neq_emp_status_text(a public.employee_status, b text)
  RETURNS boolean LANGUAGE sql IMMUTABLE STRICT
  SET search_path = public
AS $$ SELECT a::text <> b; $$;

CREATE OR REPLACE FUNCTION public.neq_text_emp_status(a text, b public.employee_status)
  RETURNS boolean LANGUAGE sql IMMUTABLE STRICT
  SET search_path = public
AS $$ SELECT a <> b::text; $$;

CREATE OR REPLACE FUNCTION public._const_role_hr()
  RETURNS public.app_role
  LANGUAGE sql IMMUTABLE PARALLEL SAFE
  SET search_path TO public
AS $$ SELECT 'hr'::public.app_role; $$;

CREATE OR REPLACE FUNCTION public._const_role_operations()
  RETURNS public.app_role
  LANGUAGE sql IMMUTABLE PARALLEL SAFE
  SET search_path TO public
AS $$ SELECT 'operations'::public.app_role; $$;

CREATE OR REPLACE FUNCTION _const_work_shift() RETURNS TEXT
  LANGUAGE sql IMMUTABLE PARALLEL SAFE
  SET search_path TO public
AS $$ SELECT 'shift'::TEXT; $$;

CREATE OR REPLACE FUNCTION _const_installment_pending() RETURNS TEXT
  LANGUAGE sql IMMUTABLE PARALLEL SAFE
  SET search_path TO public
AS $$ SELECT 'pending'::TEXT; $$;

CREATE OR REPLACE FUNCTION _const_approval_approved() RETURNS TEXT
  LANGUAGE sql IMMUTABLE PARALLEL SAFE
  SET search_path TO public
AS $$ SELECT 'approved'::TEXT; $$;

-- SECTION 8: Views
CREATE OR REPLACE VIEW public.v_rider_daily_platform_orders
WITH (security_invoker = true)
AS
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
JOIN public.employees AS e ON e.id = d.employee_id
JOIN public.apps AS a ON a.id = d.app_id
WHERE d.orders_count > 0
  AND (d.status IS NULL OR d.status <> _const_order_cancelled())
GROUP BY d.employee_id, e.name, e.city, d.date, d.app_id, a.name, a.brand_color;

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

-- SECTION 9: Triggers
CREATE TRIGGER trg_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_employees_updated_at BEFORE UPDATE ON public.employees FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_vehicles_updated_at BEFORE UPDATE ON public.vehicles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_advances_updated_at BEFORE UPDATE ON public.advances FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_salary_records_updated_at BEFORE UPDATE ON public.salary_records FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_salary_schemes_updated_at BEFORE UPDATE ON public.salary_schemes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_daily_orders_updated_at BEFORE UPDATE ON public.daily_orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE TRIGGER update_system_settings_updated_at
  BEFORE UPDATE ON public.system_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER on_auth_user_created_assign_role
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_role();

CREATE TRIGGER update_departments_updated_at
  BEFORE UPDATE ON public.departments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_positions_updated_at
  BEFORE UPDATE ON public.positions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_employee_tiers_updated_at
  BEFORE UPDATE ON public.employee_tiers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER audit_employees
AFTER INSERT OR UPDATE OR DELETE ON public.employees
FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

CREATE TRIGGER audit_advances
AFTER INSERT OR UPDATE OR DELETE ON public.advances
FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

CREATE TRIGGER audit_salary_records
AFTER INSERT OR UPDATE OR DELETE ON public.salary_records
FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

CREATE TRIGGER audit_attendance
AFTER INSERT OR UPDATE OR DELETE ON public.attendance
FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

CREATE TRIGGER audit_daily_orders
AFTER INSERT OR UPDATE OR DELETE ON public.daily_orders
FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

CREATE TRIGGER audit_vehicles
AFTER INSERT OR UPDATE OR DELETE ON public.vehicles
FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

CREATE TRIGGER audit_vehicle_assignments
AFTER INSERT OR UPDATE OR DELETE ON public.vehicle_assignments
FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

CREATE TRIGGER audit_apps
AFTER INSERT OR UPDATE OR DELETE ON public.apps
FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

CREATE TRIGGER audit_user_roles
AFTER INSERT OR UPDATE OR DELETE ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

CREATE TRIGGER audit_system_settings
AFTER INSERT OR UPDATE OR DELETE ON public.system_settings
FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

CREATE TRIGGER update_vehicle_mileage_daily_updated_at
  BEFORE UPDATE ON public.vehicle_mileage_daily
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_platform_accounts_updated_at
  BEFORE UPDATE ON public.platform_accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_account_assignments_updated_at
  BEFORE UPDATE ON public.account_assignments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_employee_sponsorship_alerts
  AFTER UPDATE OF sponsorship_status ON public.employees
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_handle_employee_sponsorship_alerts();

CREATE TRIGGER update_pricing_rules_updated_at
  BEFORE UPDATE ON public.pricing_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_roles_updated_at
  BEFORE UPDATE ON public.roles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_salary_tiers_updated_at
  BEFORE UPDATE ON public.salary_tiers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_sync_employees_company_columns
BEFORE INSERT OR UPDATE ON public.employees
FOR EACH ROW
EXECUTE FUNCTION public.sync_employees_company_columns();

CREATE TRIGGER trg_sync_platform_accounts_company_id
BEFORE INSERT OR UPDATE ON public.platform_accounts
FOR EACH ROW
EXECUTE FUNCTION public.sync_platform_accounts_company_id();

CREATE TRIGGER trg_sync_account_assignments_company_id
BEFORE INSERT OR UPDATE ON public.account_assignments
FOR EACH ROW
EXECUTE FUNCTION public.sync_account_assignments_company_id();

CREATE TRIGGER trg_sync_attendance_company_id
BEFORE INSERT OR UPDATE ON public.attendance
FOR EACH ROW EXECUTE FUNCTION public.sync_attendance_company_id();

CREATE TRIGGER trg_sync_daily_orders_company_id
BEFORE INSERT OR UPDATE ON public.daily_orders
FOR EACH ROW EXECUTE FUNCTION public.sync_daily_orders_company_id();

CREATE TRIGGER trg_sync_advances_company_id
BEFORE INSERT OR UPDATE ON public.advances
FOR EACH ROW EXECUTE FUNCTION public.sync_advances_company_id();

CREATE TRIGGER trg_sync_external_deductions_company_id
BEFORE INSERT OR UPDATE ON public.external_deductions
FOR EACH ROW EXECUTE FUNCTION public.sync_external_deductions_company_id();

CREATE TRIGGER trg_sync_salary_records_company_id
BEFORE INSERT OR UPDATE ON public.salary_records
FOR EACH ROW EXECUTE FUNCTION public.sync_salary_records_company_id();

CREATE TRIGGER trg_sync_advance_installments_company_id
BEFORE INSERT OR UPDATE ON public.advance_installments
FOR EACH ROW EXECUTE FUNCTION public.sync_advance_installments_company_id();

CREATE TRIGGER trg_employees_set_audit_columns
  BEFORE INSERT OR UPDATE ON public.employees
  FOR EACH ROW EXECUTE FUNCTION public.set_audit_columns();

CREATE TRIGGER trg_daily_orders_set_audit_columns
  BEFORE INSERT OR UPDATE ON public.daily_orders
  FOR EACH ROW EXECUTE FUNCTION public.set_audit_columns();

CREATE TRIGGER trg_attendance_set_audit_columns
  BEFORE INSERT OR UPDATE ON public.attendance
  FOR EACH ROW EXECUTE FUNCTION public.set_audit_columns();

CREATE TRIGGER trg_advances_set_audit_columns
  BEFORE INSERT OR UPDATE ON public.advances
  FOR EACH ROW EXECUTE FUNCTION public.set_audit_columns();

CREATE TRIGGER trg_advance_installments_set_audit_columns
  BEFORE INSERT OR UPDATE ON public.advance_installments
  FOR EACH ROW EXECUTE FUNCTION public.set_audit_columns();

CREATE TRIGGER trg_external_deductions_set_audit_columns
  BEFORE INSERT OR UPDATE ON public.external_deductions
  FOR EACH ROW EXECUTE FUNCTION public.set_audit_columns();

CREATE TRIGGER trg_salary_records_set_audit_columns
  BEFORE INSERT OR UPDATE ON public.salary_records
  FOR EACH ROW EXECUTE FUNCTION public.set_audit_columns();

CREATE TRIGGER trg_pl_records_set_audit_columns
  BEFORE INSERT OR UPDATE ON public.pl_records
  FOR EACH ROW EXECUTE FUNCTION public.set_audit_columns();

CREATE TRIGGER trg_user_roles_set_audit_columns
  BEFORE INSERT OR UPDATE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.set_audit_columns();

CREATE TRIGGER trg_employees_admin_log
  AFTER INSERT OR UPDATE OR DELETE ON public.employees
  FOR EACH ROW EXECUTE FUNCTION public.log_admin_action_cud();

CREATE TRIGGER trg_daily_orders_admin_log
  AFTER INSERT OR UPDATE OR DELETE ON public.daily_orders
  FOR EACH ROW EXECUTE FUNCTION public.log_admin_action_cud();

CREATE TRIGGER trg_attendance_admin_log
  AFTER INSERT OR UPDATE OR DELETE ON public.attendance
  FOR EACH ROW EXECUTE FUNCTION public.log_admin_action_cud();

CREATE TRIGGER trg_advances_admin_log
  AFTER INSERT OR UPDATE OR DELETE ON public.advances
  FOR EACH ROW EXECUTE FUNCTION public.log_admin_action_cud();

CREATE TRIGGER trg_advance_installments_admin_log
  AFTER INSERT OR UPDATE OR DELETE ON public.advance_installments
  FOR EACH ROW EXECUTE FUNCTION public.log_admin_action_cud();

CREATE TRIGGER trg_external_deductions_admin_log
  AFTER INSERT OR UPDATE OR DELETE ON public.external_deductions
  FOR EACH ROW EXECUTE FUNCTION public.log_admin_action_cud();

CREATE TRIGGER trg_salary_records_admin_log
  AFTER INSERT OR UPDATE OR DELETE ON public.salary_records
  FOR EACH ROW EXECUTE FUNCTION public.log_admin_action_cud();

CREATE TRIGGER trg_pl_records_admin_log
  AFTER INSERT OR UPDATE OR DELETE ON public.pl_records
  FOR EACH ROW EXECUTE FUNCTION public.log_admin_action_cud();

CREATE TRIGGER trg_user_roles_admin_log
  AFTER INSERT OR UPDATE OR DELETE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.log_admin_action_cud();

CREATE TRIGGER update_spare_parts_updated_at
  BEFORE UPDATE ON public.spare_parts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_maintenance_logs_updated_at
  BEFORE UPDATE ON public.maintenance_logs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_fill_maintenance_employee
  BEFORE INSERT ON public.maintenance_logs
  FOR EACH ROW EXECUTE FUNCTION public.fill_maintenance_employee();

CREATE TRIGGER trg_deduct_stock
  AFTER INSERT ON public.maintenance_parts
  FOR EACH ROW EXECUTE FUNCTION public.deduct_spare_part_stock();

CREATE TRIGGER trg_restore_stock
  AFTER DELETE ON public.maintenance_parts
  FOR EACH ROW EXECUTE FUNCTION public.restore_spare_part_stock();

CREATE TRIGGER trg_update_total_cost
  AFTER INSERT OR UPDATE OR DELETE ON public.maintenance_parts
  FOR EACH ROW EXECUTE FUNCTION public.update_maintenance_total_cost();

CREATE TRIGGER update_supervisor_employee_assignments_updated_at
  BEFORE UPDATE ON public.supervisor_employee_assignments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_supervisor_targets_updated_at
  BEFORE UPDATE ON public.supervisor_targets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_salary_slip_templates_updated_at
    BEFORE UPDATE ON public.salary_slip_templates
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER prevent_orders_shifts_overlap_on_orders
  BEFORE INSERT OR UPDATE ON daily_orders
  FOR EACH ROW EXECUTE FUNCTION check_no_overlap_orders_shifts();

CREATE TRIGGER prevent_orders_shifts_overlap_on_shifts
  BEFORE INSERT OR UPDATE ON daily_shifts
  FOR EACH ROW EXECUTE FUNCTION check_no_overlap_orders_shifts();

CREATE TRIGGER daily_shifts_updated_at
  BEFORE UPDATE ON daily_shifts
  FOR EACH ROW EXECUTE FUNCTION update_daily_shifts_updated_at();

CREATE TRIGGER app_hybrid_rules_updated_at
  BEFORE UPDATE ON app_hybrid_rules
  FOR EACH ROW EXECUTE FUNCTION update_daily_shifts_updated_at();

CREATE TRIGGER salary_drafts_updated_at
BEFORE UPDATE ON public.salary_drafts
FOR EACH ROW
EXECUTE FUNCTION public.update_salary_drafts_updated_at();

CREATE TRIGGER salary_records_version_increment
BEFORE UPDATE ON public.salary_records
FOR EACH ROW
EXECUTE FUNCTION public.increment_salary_record_version();

CREATE TRIGGER trg_commercial_records_updated_at
  BEFORE UPDATE ON public.commercial_records
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_employee_targets_updated_at
  BEFORE UPDATE ON public.employee_targets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_order_import_batches_updated_at
  BEFORE UPDATE ON public.order_import_batches
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_salary_month_snapshots_updated_at
  BEFORE UPDATE ON public.salary_month_snapshots
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER finance_transactions_updated_at
  BEFORE UPDATE ON public.finance_transactions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- SECTION 11: RLS Policies
CREATE POLICY "unified_delete_policy" ON public."employee_tiers" FOR DELETE
  USING ( (is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'hr'::app_role))) );

CREATE POLICY "unified_insert_policy" ON public."employee_tiers" FOR INSERT
  WITH CHECK ( (is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'hr'::app_role))) );

CREATE POLICY "unified_select_policy" ON public."employee_tiers" FOR SELECT
  USING ( (is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'hr'::app_role))) );

CREATE POLICY "unified_update_policy" ON public."employee_tiers" FOR UPDATE
  USING ( (is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'hr'::app_role))) )
  WITH CHECK ( (is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'hr'::app_role))) );

CREATE POLICY "unified_delete_policy" ON public."profiles" FOR DELETE
  USING ( (is_active_user(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role)) );

CREATE POLICY "unified_insert_policy" ON public."profiles" FOR INSERT
  WITH CHECK ( has_role(auth.uid(), 'admin'::app_role) );

CREATE POLICY "unified_select_policy" ON public."profiles" FOR SELECT
  USING ( (is_active_user(auth.uid()) OR (auth.uid() = id)) );

CREATE POLICY "unified_update_policy" ON public."profiles" FOR UPDATE
  USING ( ((is_active_user(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role)) OR (auth.uid() = id)) )
  WITH CHECK ( ((is_active_user(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role)) OR (auth.uid() = id)) );

CREATE POLICY "unified_delete_policy" ON public."user_permissions" FOR DELETE
  USING ( (is_active_user(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role)) );

CREATE POLICY "unified_insert_policy" ON public."user_permissions" FOR INSERT
  WITH CHECK ( (is_active_user(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role)) );

CREATE POLICY "unified_select_policy" ON public."user_permissions" FOR SELECT
  USING ( ((is_active_user(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role)) OR ((auth.uid() = user_id) OR (is_active_user(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role)))) );

CREATE POLICY "unified_update_policy" ON public."user_permissions" FOR UPDATE
  USING ( (is_active_user(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role)) )
  WITH CHECK ( (is_active_user(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role)) );

CREATE POLICY "unified_delete_policy" ON public."hr_performance_reviews" FOR DELETE
  USING ( is_admin_or_hr(auth.uid()) );

CREATE POLICY "unified_insert_policy" ON public."hr_performance_reviews" FOR INSERT
  WITH CHECK ( is_admin_or_hr(auth.uid()) );

CREATE POLICY "unified_update_policy" ON public."hr_performance_reviews" FOR UPDATE
  USING ( is_admin_or_hr(auth.uid()) )
  WITH CHECK ( is_admin_or_hr(auth.uid()) );

CREATE POLICY "unified_delete_policy" ON public."apps" FOR DELETE
  USING ( (is_active_user(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role)) );

CREATE POLICY "unified_insert_policy" ON public."apps" FOR INSERT
  WITH CHECK ( (is_active_user(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role)) );

CREATE POLICY "unified_select_policy" ON public."apps" FOR SELECT
  USING ( ((is_active_user(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role)) OR is_active_user(auth.uid())) );

CREATE POLICY "unified_update_policy" ON public."apps" FOR UPDATE
  USING ( (is_active_user(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role)) )
  WITH CHECK ( (is_active_user(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role)) );

CREATE POLICY "unified_delete_policy" ON public."salary_scheme_tiers" FOR DELETE
  USING ( (is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'finance'::app_role))) );

CREATE POLICY "unified_insert_policy" ON public."salary_scheme_tiers" FOR INSERT
  WITH CHECK ( (is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'finance'::app_role))) );

CREATE POLICY "unified_select_policy" ON public."salary_scheme_tiers" FOR SELECT
  USING ( ((is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'finance'::app_role))) OR is_active_user(auth.uid())) );

CREATE POLICY "unified_update_policy" ON public."salary_scheme_tiers" FOR UPDATE
  USING ( (is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'finance'::app_role))) )
  WITH CHECK ( (is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'finance'::app_role))) );

CREATE POLICY "unified_delete_policy" ON public."trade_registers" FOR DELETE
  USING ( (is_active_user(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role)) );

CREATE POLICY "unified_insert_policy" ON public."trade_registers" FOR INSERT
  WITH CHECK ( (is_active_user(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role)) );

CREATE POLICY "unified_select_policy" ON public."trade_registers" FOR SELECT
  USING ( ((is_active_user(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role)) OR is_active_user(auth.uid())) );

CREATE POLICY "unified_update_policy" ON public."trade_registers" FOR UPDATE
  USING ( (is_active_user(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role)) )
  WITH CHECK ( (is_active_user(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role)) );

CREATE POLICY "unified_delete_policy" ON public."employee_scheme" FOR DELETE
  USING ( (is_active_user(auth.uid()) AND employee_in_my_company(employee_id) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'hr'::app_role))) );

CREATE POLICY "unified_insert_policy" ON public."employee_scheme" FOR INSERT
  WITH CHECK ( (is_active_user(auth.uid()) AND employee_in_my_company(employee_id) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'hr'::app_role))) );

CREATE POLICY "unified_select_policy" ON public."employee_scheme" FOR SELECT
  USING ( ((is_active_user(auth.uid()) AND employee_in_my_company(employee_id) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'hr'::app_role))) OR (is_active_user(auth.uid()) AND employee_in_my_company(employee_id) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'hr'::app_role) OR has_role(auth.uid(), 'finance'::app_role)))) );

CREATE POLICY "unified_update_policy" ON public."employee_scheme" FOR UPDATE
  USING ( (is_active_user(auth.uid()) AND employee_in_my_company(employee_id) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'hr'::app_role))) )
  WITH CHECK ( (is_active_user(auth.uid()) AND employee_in_my_company(employee_id) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'hr'::app_role))) );

CREATE POLICY "unified_delete_policy" ON public."employee_apps" FOR DELETE
  USING ( (is_active_user(auth.uid()) AND employee_in_my_company(employee_id) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'hr'::app_role))) );

CREATE POLICY "unified_insert_policy" ON public."employee_apps" FOR INSERT
  WITH CHECK ( (is_active_user(auth.uid()) AND employee_in_my_company(employee_id) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'hr'::app_role))) );

CREATE POLICY "unified_select_policy" ON public."employee_apps" FOR SELECT
  USING ( ((is_active_user(auth.uid()) AND employee_in_my_company(employee_id) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'hr'::app_role))) OR (is_active_user(auth.uid()) AND employee_in_my_company(employee_id) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'hr'::app_role) OR has_role(auth.uid(), 'operations'::app_role)))) );

CREATE POLICY "unified_update_policy" ON public."employee_apps" FOR UPDATE
  USING ( (is_active_user(auth.uid()) AND employee_in_my_company(employee_id) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'hr'::app_role))) )
  WITH CHECK ( (is_active_user(auth.uid()) AND employee_in_my_company(employee_id) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'hr'::app_role))) );

CREATE POLICY "unified_delete_policy" ON public."salary_schemes" FOR DELETE
  USING ( (is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'finance'::app_role))) );

CREATE POLICY "unified_insert_policy" ON public."salary_schemes" FOR INSERT
  WITH CHECK ( (is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'finance'::app_role))) );

CREATE POLICY "unified_select_policy" ON public."salary_schemes" FOR SELECT
  USING ( ((is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'finance'::app_role))) OR is_active_user(auth.uid())) );

CREATE POLICY "unified_update_policy" ON public."salary_schemes" FOR UPDATE
  USING ( (is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'finance'::app_role))) )
  WITH CHECK ( (is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'finance'::app_role))) );

CREATE POLICY "unified_delete_policy" ON public."vehicle_assignments" FOR DELETE
  USING ( (is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operations'::app_role))) );

CREATE POLICY "unified_insert_policy" ON public."vehicle_assignments" FOR INSERT
  WITH CHECK ( (is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operations'::app_role))) );

CREATE POLICY "unified_select_policy" ON public."vehicle_assignments" FOR SELECT
  USING ( ((is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operations'::app_role))) OR (is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'hr'::app_role) OR has_role(auth.uid(), 'operations'::app_role)))) );

CREATE POLICY "unified_update_policy" ON public."vehicle_assignments" FOR UPDATE
  USING ( (is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operations'::app_role))) )
  WITH CHECK ( (is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operations'::app_role))) );

CREATE POLICY "unified_delete_policy" ON public."daily_orders" FOR DELETE
  USING ( ((is_active_user(auth.uid()) AND employee_in_my_company(employee_id) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'hr'::app_role) OR has_role(auth.uid(), 'operations'::app_role))) OR (is_internal_user() AND has_permission('orders'::text, 'delete'::text))) );

CREATE POLICY "unified_insert_policy" ON public."daily_orders" FOR INSERT
  WITH CHECK ( ((is_active_user(auth.uid()) AND employee_in_my_company(employee_id) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'hr'::app_role) OR has_role(auth.uid(), 'operations'::app_role))) OR (is_internal_user() AND has_permission('orders'::text, 'write'::text))) );

CREATE POLICY "unified_select_policy" ON public."daily_orders" FOR SELECT
  USING ( ((is_active_user(auth.uid()) AND employee_in_my_company(employee_id) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'hr'::app_role) OR has_role(auth.uid(), 'operations'::app_role))) OR ((is_internal_user() AND has_permission('orders'::text, 'view'::text)) OR (is_active_user(auth.uid()) AND employee_in_my_company(employee_id) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'hr'::app_role) OR has_role(auth.uid(), 'operations'::app_role) OR has_role(auth.uid(), 'finance'::app_role))))) );

CREATE POLICY "unified_update_policy" ON public."daily_orders" FOR UPDATE
  USING ( ((is_active_user(auth.uid()) AND employee_in_my_company(employee_id) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'hr'::app_role) OR has_role(auth.uid(), 'operations'::app_role))) OR (is_internal_user() AND has_permission('orders'::text, 'write'::text))) )
  WITH CHECK ( ((is_active_user(auth.uid()) AND employee_in_my_company(employee_id) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'hr'::app_role) OR has_role(auth.uid(), 'operations'::app_role))) OR (is_internal_user() AND has_permission('orders'::text, 'write'::text))) );

CREATE POLICY "unified_delete_policy" ON public."attendance" FOR DELETE
  USING ( ((is_active_user(auth.uid()) AND employee_in_my_company(employee_id) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'hr'::app_role))) OR (is_internal_user() AND has_permission('attendance'::text, 'delete'::text))) );

CREATE POLICY "unified_insert_policy" ON public."attendance" FOR INSERT
  WITH CHECK ( ((is_active_user(auth.uid()) AND employee_in_my_company(employee_id) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'hr'::app_role))) OR (is_internal_user() AND has_permission('attendance'::text, 'write'::text))) );

CREATE POLICY "unified_select_policy" ON public."attendance" FOR SELECT
  USING ( ((is_active_user(auth.uid()) AND employee_in_my_company(employee_id) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'hr'::app_role) OR has_role(auth.uid(), 'operations'::app_role) OR has_role(auth.uid(), 'finance'::app_role))) OR (is_internal_user() AND has_permission('attendance'::text, 'view'::text))) );

CREATE POLICY "unified_update_policy" ON public."attendance" FOR UPDATE
  USING ( ((is_active_user(auth.uid()) AND employee_in_my_company(employee_id) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'hr'::app_role))) OR (is_internal_user() AND has_permission('attendance'::text, 'write'::text))) )
  WITH CHECK ( ((is_active_user(auth.uid()) AND employee_in_my_company(employee_id) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'hr'::app_role))) OR (is_internal_user() AND has_permission('attendance'::text, 'write'::text))) );

CREATE POLICY "unified_delete_policy" ON public."vehicles" FOR DELETE
  USING ( (is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operations'::app_role))) );

CREATE POLICY "unified_insert_policy" ON public."vehicles" FOR INSERT
  WITH CHECK ( (is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operations'::app_role))) );

CREATE POLICY "unified_select_policy" ON public."vehicles" FOR SELECT
  USING ( ((is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operations'::app_role))) OR (is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'hr'::app_role) OR has_role(auth.uid(), 'operations'::app_role)))) );

CREATE POLICY "unified_update_policy" ON public."vehicles" FOR UPDATE
  USING ( (is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operations'::app_role))) )
  WITH CHECK ( (is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operations'::app_role))) );

CREATE POLICY "unified_delete_policy" ON public."advances" FOR DELETE
  USING ( ((is_active_user(auth.uid()) AND employee_in_my_company(employee_id) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'finance'::app_role))) OR (is_internal_user() AND has_permission('financials'::text, 'delete'::text))) );

CREATE POLICY "unified_insert_policy" ON public."advances" FOR INSERT
  WITH CHECK ( ((is_active_user(auth.uid()) AND employee_in_my_company(employee_id) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'finance'::app_role))) OR (is_internal_user() AND has_permission('financials'::text, 'write'::text))) );

CREATE POLICY "unified_select_policy" ON public."advances" FOR SELECT
  USING ( ((is_active_user(auth.uid()) AND employee_in_my_company(employee_id) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'finance'::app_role))) OR ((is_internal_user() AND has_permission('financials'::text, 'view'::text)) OR (is_active_user(auth.uid()) AND employee_in_my_company(employee_id) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'hr'::app_role) OR has_role(auth.uid(), 'finance'::app_role))))) );

CREATE POLICY "unified_update_policy" ON public."advances" FOR UPDATE
  USING ( ((is_active_user(auth.uid()) AND employee_in_my_company(employee_id) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'finance'::app_role))) OR (is_internal_user() AND has_permission('financials'::text, 'write'::text))) )
  WITH CHECK ( ((is_active_user(auth.uid()) AND employee_in_my_company(employee_id) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'finance'::app_role))) OR (is_internal_user() AND has_permission('financials'::text, 'write'::text))) );

CREATE POLICY "unified_delete_policy" ON public."alerts" FOR DELETE
  USING ( (is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'hr'::app_role))) );

CREATE POLICY "unified_insert_policy" ON public."alerts" FOR INSERT
  WITH CHECK ( (is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'hr'::app_role))) );

CREATE POLICY "unified_select_policy" ON public."alerts" FOR SELECT
  USING ( ((is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'hr'::app_role))) OR is_active_user(auth.uid())) );

CREATE POLICY "unified_update_policy" ON public."alerts" FOR UPDATE
  USING ( (is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'hr'::app_role))) )
  WITH CHECK ( (is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'hr'::app_role))) );

CREATE POLICY "unified_delete_policy" ON public."advance_installments" FOR DELETE
  USING ( ((is_active_user(auth.uid()) AND advance_in_my_company(advance_id) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'finance'::app_role))) OR (is_internal_user() AND has_permission('financials'::text, 'delete'::text))) );

CREATE POLICY "unified_insert_policy" ON public."advance_installments" FOR INSERT
  WITH CHECK ( ((is_active_user(auth.uid()) AND advance_in_my_company(advance_id) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'finance'::app_role))) OR (is_internal_user() AND has_permission('financials'::text, 'write'::text))) );

CREATE POLICY "unified_select_policy" ON public."advance_installments" FOR SELECT
  USING ( ((is_active_user(auth.uid()) AND advance_in_my_company(advance_id) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'finance'::app_role))) OR ((is_internal_user() AND has_permission('financials'::text, 'view'::text)) OR (is_active_user(auth.uid()) AND advance_in_my_company(advance_id) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'hr'::app_role) OR has_role(auth.uid(), 'finance'::app_role))))) );

CREATE POLICY "unified_update_policy" ON public."advance_installments" FOR UPDATE
  USING ( ((is_active_user(auth.uid()) AND advance_in_my_company(advance_id) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'finance'::app_role))) OR (is_internal_user() AND has_permission('financials'::text, 'write'::text))) )
  WITH CHECK ( ((is_active_user(auth.uid()) AND advance_in_my_company(advance_id) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'finance'::app_role))) OR (is_internal_user() AND has_permission('financials'::text, 'write'::text))) );

CREATE POLICY "unified_delete_policy" ON public."departments" FOR DELETE
  USING ( (is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'hr'::app_role))) );

CREATE POLICY "unified_insert_policy" ON public."departments" FOR INSERT
  WITH CHECK ( (is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'hr'::app_role))) );

CREATE POLICY "unified_select_policy" ON public."departments" FOR SELECT
  USING ( ((is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'hr'::app_role))) OR is_active_user(auth.uid())) );

CREATE POLICY "unified_update_policy" ON public."departments" FOR UPDATE
  USING ( (is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'hr'::app_role))) )
  WITH CHECK ( (is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'hr'::app_role))) );

CREATE POLICY "unified_delete_policy" ON public."vehicle_mileage_daily" FOR DELETE
  USING ( (is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operations'::app_role) OR has_role(auth.uid(), 'finance'::app_role))) );

CREATE POLICY "unified_insert_policy" ON public."vehicle_mileage_daily" FOR INSERT
  WITH CHECK ( (is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operations'::app_role) OR has_role(auth.uid(), 'finance'::app_role))) );

CREATE POLICY "unified_select_policy" ON public."vehicle_mileage_daily" FOR SELECT
  USING ( ((is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operations'::app_role) OR has_role(auth.uid(), 'finance'::app_role))) OR ((is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operations'::app_role) OR has_role(auth.uid(), 'finance'::app_role) OR has_role(auth.uid(), 'hr'::app_role))) OR is_active_user(auth.uid()))) );

CREATE POLICY "unified_update_policy" ON public."vehicle_mileage_daily" FOR UPDATE
  USING ( (is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operations'::app_role) OR has_role(auth.uid(), 'finance'::app_role))) )
  WITH CHECK ( (is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operations'::app_role) OR has_role(auth.uid(), 'finance'::app_role))) );

CREATE POLICY "unified_delete_policy" ON public."pricing_rules" FOR DELETE
  USING ( (is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'finance'::app_role))) );

CREATE POLICY "unified_insert_policy" ON public."pricing_rules" FOR INSERT
  WITH CHECK ( (is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'finance'::app_role))) );

CREATE POLICY "unified_select_policy" ON public."pricing_rules" FOR SELECT
  USING ( ((is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'finance'::app_role))) OR is_active_user(auth.uid())) );

CREATE POLICY "unified_update_policy" ON public."pricing_rules" FOR UPDATE
  USING ( (is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'finance'::app_role))) )
  WITH CHECK ( (is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'finance'::app_role))) );

CREATE POLICY "unified_delete_policy" ON public."locked_months" FOR DELETE
  USING ( ((is_active_user(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role)) OR (is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'finance'::app_role)))) );

CREATE POLICY "unified_insert_policy" ON public."locked_months" FOR INSERT
  WITH CHECK ( ((is_active_user(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role)) OR (is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'finance'::app_role)))) );

CREATE POLICY "unified_select_policy" ON public."locked_months" FOR SELECT
  USING ( ((is_active_user(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role)) OR (is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'finance'::app_role))) OR is_active_user(auth.uid())) );

CREATE POLICY "unified_update_policy" ON public."locked_months" FOR UPDATE
  USING ( ((is_active_user(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role)) OR (is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'finance'::app_role)))) )
  WITH CHECK ( ((is_active_user(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role)) OR (is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'finance'::app_role)))) );

CREATE POLICY "unified_delete_policy" ON public."platform_accounts" FOR DELETE
  USING ( (is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'hr'::app_role))) );

CREATE POLICY "unified_insert_policy" ON public."platform_accounts" FOR INSERT
  WITH CHECK ( (is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'hr'::app_role))) );

CREATE POLICY "unified_select_policy" ON public."platform_accounts" FOR SELECT
  USING ( ((is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'hr'::app_role))) OR (is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'hr'::app_role) OR has_role(auth.uid(), 'operations'::app_role) OR has_role(auth.uid(), 'finance'::app_role)))) );

CREATE POLICY "unified_update_policy" ON public."platform_accounts" FOR UPDATE
  USING ( (is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'hr'::app_role))) )
  WITH CHECK ( (is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'hr'::app_role))) );

CREATE POLICY "unified_insert_policy" ON public."account_assignments" FOR INSERT
  WITH CHECK ( (is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'hr'::app_role))) );

CREATE POLICY "unified_select_policy" ON public."account_assignments" FOR SELECT
  USING ( (is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'hr'::app_role) OR has_role(auth.uid(), 'operations'::app_role) OR has_role(auth.uid(), 'finance'::app_role))) );

CREATE POLICY "unified_update_policy" ON public."account_assignments" FOR UPDATE
  USING ( (is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'hr'::app_role))) )
  WITH CHECK ( (is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'hr'::app_role))) );

CREATE POLICY "unified_delete_policy" ON public."employee_targets" FOR DELETE
  USING ( (is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operations'::app_role) OR has_role(auth.uid(), 'hr'::app_role) OR has_role(auth.uid(), 'finance'::app_role))) );

CREATE POLICY "unified_insert_policy" ON public."employee_targets" FOR INSERT
  WITH CHECK ( (is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operations'::app_role) OR has_role(auth.uid(), 'hr'::app_role) OR has_role(auth.uid(), 'finance'::app_role))) );

CREATE POLICY "unified_select_policy" ON public."employee_targets" FOR SELECT
  USING ( ((is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operations'::app_role) OR has_role(auth.uid(), 'hr'::app_role) OR has_role(auth.uid(), 'finance'::app_role))) OR is_active_user(auth.uid())) );

CREATE POLICY "unified_update_policy" ON public."employee_targets" FOR UPDATE
  USING ( (is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operations'::app_role) OR has_role(auth.uid(), 'hr'::app_role) OR has_role(auth.uid(), 'finance'::app_role))) )
  WITH CHECK ( (is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operations'::app_role) OR has_role(auth.uid(), 'hr'::app_role) OR has_role(auth.uid(), 'finance'::app_role))) );

CREATE POLICY "unified_delete_policy" ON public."employee_roles" FOR DELETE
  USING ( (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'hr'::app_role)) );

CREATE POLICY "unified_insert_policy" ON public."employee_roles" FOR INSERT
  WITH CHECK ( (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'hr'::app_role)) );

CREATE POLICY "unified_select_policy" ON public."employee_roles" FOR SELECT
  USING ( (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'hr'::app_role) OR is_active_user(auth.uid())) );

CREATE POLICY "unified_update_policy" ON public."employee_roles" FOR UPDATE
  USING ( (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'hr'::app_role)) )
  WITH CHECK ( (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'hr'::app_role)) );

CREATE POLICY "unified_delete_policy" ON public."salary_tiers" FOR DELETE
  USING ( (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'finance'::app_role)) );

CREATE POLICY "unified_insert_policy" ON public."salary_tiers" FOR INSERT
  WITH CHECK ( (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'finance'::app_role)) );

CREATE POLICY "unified_select_policy" ON public."salary_tiers" FOR SELECT
  USING ( (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'finance'::app_role) OR is_active_user(auth.uid())) );

CREATE POLICY "unified_update_policy" ON public."salary_tiers" FOR UPDATE
  USING ( (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'finance'::app_role)) )
  WITH CHECK ( (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'finance'::app_role)) );

CREATE POLICY "unified_delete_policy" ON public."maintenance_logs" FOR DELETE
  USING ( (is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operations'::app_role))) );

CREATE POLICY "unified_insert_policy" ON public."maintenance_logs" FOR INSERT
  WITH CHECK ( (is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operations'::app_role))) );

CREATE POLICY "unified_select_policy" ON public."maintenance_logs" FOR SELECT
  USING ( ((is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operations'::app_role))) OR is_active_user(auth.uid())) );

CREATE POLICY "unified_update_policy" ON public."maintenance_logs" FOR UPDATE
  USING ( (is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operations'::app_role))) )
  WITH CHECK ( (is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operations'::app_role))) );

CREATE POLICY "unified_delete_policy" ON public."order_import_batches" FOR DELETE
  USING ( (is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operations'::app_role) OR has_role(auth.uid(), 'hr'::app_role) OR has_role(auth.uid(), 'finance'::app_role))) );

CREATE POLICY "unified_insert_policy" ON public."order_import_batches" FOR INSERT
  WITH CHECK ( (is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operations'::app_role) OR has_role(auth.uid(), 'hr'::app_role) OR has_role(auth.uid(), 'finance'::app_role))) );

CREATE POLICY "unified_select_policy" ON public."order_import_batches" FOR SELECT
  USING ( (is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operations'::app_role) OR has_role(auth.uid(), 'hr'::app_role) OR has_role(auth.uid(), 'finance'::app_role))) );

CREATE POLICY "unified_update_policy" ON public."order_import_batches" FOR UPDATE
  USING ( (is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operations'::app_role) OR has_role(auth.uid(), 'hr'::app_role) OR has_role(auth.uid(), 'finance'::app_role))) )
  WITH CHECK ( (is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operations'::app_role) OR has_role(auth.uid(), 'hr'::app_role) OR has_role(auth.uid(), 'finance'::app_role))) );

CREATE POLICY "unified_delete_policy" ON public."salary_month_snapshots" FOR DELETE
  USING ( (is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'finance'::app_role))) );

CREATE POLICY "unified_insert_policy" ON public."salary_month_snapshots" FOR INSERT
  WITH CHECK ( (is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'finance'::app_role))) );

CREATE POLICY "unified_select_policy" ON public."salary_month_snapshots" FOR SELECT
  USING ( (is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'finance'::app_role))) );

CREATE POLICY "unified_update_policy" ON public."salary_month_snapshots" FOR UPDATE
  USING ( (is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'finance'::app_role))) )
  WITH CHECK ( (is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'finance'::app_role))) );

CREATE POLICY "unified_delete_policy" ON public."app_hybrid_rules" FOR DELETE
  USING ( is_active_user(auth.uid()) );

CREATE POLICY "unified_insert_policy" ON public."app_hybrid_rules" FOR INSERT
  WITH CHECK ( is_active_user(auth.uid()) );

CREATE POLICY "unified_select_policy" ON public."app_hybrid_rules" FOR SELECT
  USING ( is_active_user(auth.uid()) );

CREATE POLICY "unified_update_policy" ON public."app_hybrid_rules" FOR UPDATE
  USING ( is_active_user(auth.uid()) )
  WITH CHECK ( is_active_user(auth.uid()) );

CREATE POLICY "unified_delete_policy" ON public."attendance_status_configs" FOR DELETE
  USING ( (is_active_user(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role)) );

CREATE POLICY "unified_insert_policy" ON public."attendance_status_configs" FOR INSERT
  WITH CHECK ( (is_active_user(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role)) );

CREATE POLICY "unified_select_policy" ON public."attendance_status_configs" FOR SELECT
  USING ( ((is_active_user(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role)) OR true) );

CREATE POLICY "unified_update_policy" ON public."attendance_status_configs" FOR UPDATE
  USING ( (is_active_user(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role)) )
  WITH CHECK ( (is_active_user(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role)) );

CREATE POLICY "unified_delete_policy" ON public."daily_shifts" FOR DELETE
  USING ( is_active_user(auth.uid()) );

CREATE POLICY "unified_insert_policy" ON public."daily_shifts" FOR INSERT
  WITH CHECK ( is_active_user(auth.uid()) );

CREATE POLICY "unified_select_policy" ON public."daily_shifts" FOR SELECT
  USING ( is_active_user(auth.uid()) );

CREATE POLICY "unified_update_policy" ON public."daily_shifts" FOR UPDATE
  USING ( is_active_user(auth.uid()) )
  WITH CHECK ( is_active_user(auth.uid()) );

CREATE POLICY "unified_delete_policy" ON public."positions" FOR DELETE
  USING ( (is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'hr'::app_role))) );

CREATE POLICY "unified_insert_policy" ON public."positions" FOR INSERT
  WITH CHECK ( (is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'hr'::app_role))) );

CREATE POLICY "unified_select_policy" ON public."positions" FOR SELECT
  USING ( ((is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'hr'::app_role))) OR is_active_user(auth.uid())) );

CREATE POLICY "unified_update_policy" ON public."positions" FOR UPDATE
  USING ( (is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'hr'::app_role))) )
  WITH CHECK ( (is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'hr'::app_role))) );

CREATE POLICY "unified_delete_policy" ON public."app_targets" FOR DELETE
  USING ( (is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operations'::app_role) OR has_role(auth.uid(), 'finance'::app_role))) );

CREATE POLICY "unified_insert_policy" ON public."app_targets" FOR INSERT
  WITH CHECK ( (is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operations'::app_role) OR has_role(auth.uid(), 'finance'::app_role))) );

CREATE POLICY "unified_select_policy" ON public."app_targets" FOR SELECT
  USING ( ((is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operations'::app_role) OR has_role(auth.uid(), 'finance'::app_role))) OR is_active_user(auth.uid())) );

CREATE POLICY "unified_update_policy" ON public."app_targets" FOR UPDATE
  USING ( (is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operations'::app_role) OR has_role(auth.uid(), 'finance'::app_role))) )
  WITH CHECK ( (is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operations'::app_role) OR has_role(auth.uid(), 'finance'::app_role))) );

CREATE POLICY "unified_delete_policy" ON public."scheme_month_snapshots" FOR DELETE
  USING ( (is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'finance'::app_role))) );

CREATE POLICY "unified_insert_policy" ON public."scheme_month_snapshots" FOR INSERT
  WITH CHECK ( (is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'finance'::app_role))) );

CREATE POLICY "unified_select_policy" ON public."scheme_month_snapshots" FOR SELECT
  USING ( ((is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'finance'::app_role))) OR is_active_user(auth.uid())) );

CREATE POLICY "unified_update_policy" ON public."scheme_month_snapshots" FOR UPDATE
  USING ( (is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'finance'::app_role))) )
  WITH CHECK ( (is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'finance'::app_role))) );

CREATE POLICY "unified_delete_policy" ON public."vehicle_mileage" FOR DELETE
  USING ( (is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operations'::app_role))) );

CREATE POLICY "unified_insert_policy" ON public."vehicle_mileage" FOR INSERT
  WITH CHECK ( (is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operations'::app_role))) );

CREATE POLICY "unified_select_policy" ON public."vehicle_mileage" FOR SELECT
  USING ( (is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operations'::app_role))) );

CREATE POLICY "unified_update_policy" ON public."vehicle_mileage" FOR UPDATE
  USING ( (is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operations'::app_role))) )
  WITH CHECK ( (is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operations'::app_role))) );

CREATE POLICY "unified_insert_policy" ON public."system_settings" FOR INSERT
  WITH CHECK ( (is_active_user(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role)) );

CREATE POLICY "unified_update_policy" ON public."system_settings" FOR UPDATE
  USING ( (is_active_user(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role)) )
  WITH CHECK ( (is_active_user(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role)) );

CREATE POLICY "unified_insert_policy" ON public."audit_log" FOR INSERT
  WITH CHECK ( (is_active_user(auth.uid()) AND (auth.uid() = user_id)) );

CREATE POLICY "unified_select_policy" ON public."audit_log" FOR SELECT
  USING ( (is_active_user(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role)) );

CREATE POLICY "unified_delete_policy" ON public."salary_drafts" FOR DELETE
  USING ( (auth.uid() = user_id) );

CREATE POLICY "unified_insert_policy" ON public."salary_drafts" FOR INSERT
  WITH CHECK ( (auth.uid() = user_id) );

CREATE POLICY "unified_select_policy" ON public."salary_drafts" FOR SELECT
  USING ( (auth.uid() = user_id) );

CREATE POLICY "unified_update_policy" ON public."salary_drafts" FOR UPDATE
  USING ( (auth.uid() = user_id) )
  WITH CHECK ( (auth.uid() = user_id) );

CREATE POLICY "unified_delete_policy" ON public."external_deductions" FOR DELETE
  USING ( ((is_active_user(auth.uid()) AND employee_in_my_company(employee_id) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'finance'::app_role))) OR (is_internal_user() AND has_permission('financials'::text, 'delete'::text))) );

CREATE POLICY "unified_insert_policy" ON public."external_deductions" FOR INSERT
  WITH CHECK ( ((is_active_user(auth.uid()) AND employee_in_my_company(employee_id) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'finance'::app_role))) OR (is_internal_user() AND has_permission('financials'::text, 'write'::text))) );

CREATE POLICY "unified_select_policy" ON public."external_deductions" FOR SELECT
  USING ( ((is_active_user(auth.uid()) AND employee_in_my_company(employee_id) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'finance'::app_role))) OR ((is_active_user(auth.uid()) AND employee_in_my_company(employee_id) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'finance'::app_role))) OR (is_internal_user() AND has_permission('financials'::text, 'view'::text)))) );

CREATE POLICY "unified_update_policy" ON public."external_deductions" FOR UPDATE
  USING ( ((is_active_user(auth.uid()) AND employee_in_my_company(employee_id) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'finance'::app_role))) OR (is_internal_user() AND has_permission('financials'::text, 'write'::text))) )
  WITH CHECK ( ((is_active_user(auth.uid()) AND employee_in_my_company(employee_id) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'finance'::app_role))) OR (is_internal_user() AND has_permission('financials'::text, 'write'::text))) );

CREATE POLICY "unified_insert_policy" ON public."admin_action_log" FOR INSERT
  WITH CHECK ( (is_internal_user() AND (NOT (user_id IS DISTINCT FROM auth.uid()))) );

CREATE POLICY "unified_delete_policy" ON public."salary_records" FOR DELETE
  USING ( ((is_active_user(auth.uid()) AND employee_in_my_company(employee_id) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'finance'::app_role))) OR (is_internal_user() AND has_permission('salary'::text, 'delete'::text))) );

CREATE POLICY "unified_insert_policy" ON public."salary_records" FOR INSERT
  WITH CHECK ( ((is_active_user(auth.uid()) AND employee_in_my_company(employee_id) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'finance'::app_role))) OR (is_internal_user() AND has_permission('salary'::text, 'write'::text))) );

CREATE POLICY "unified_select_policy" ON public."salary_records" FOR SELECT
  USING ( ((is_active_user(auth.uid()) AND employee_in_my_company(employee_id) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'finance'::app_role))) OR ((is_internal_user() AND has_permission('salary'::text, 'view'::text)) OR (is_active_user(auth.uid()) AND employee_in_my_company(employee_id) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'finance'::app_role))))) );

CREATE POLICY "unified_update_policy" ON public."salary_records" FOR UPDATE
  USING ( ((is_active_user(auth.uid()) AND employee_in_my_company(employee_id) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'finance'::app_role))) OR (is_internal_user() AND has_permission('salary'::text, 'write'::text))) )
  WITH CHECK ( ((is_active_user(auth.uid()) AND employee_in_my_company(employee_id) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'finance'::app_role))) OR (is_internal_user() AND has_permission('salary'::text, 'write'::text))) );

CREATE POLICY "unified_delete_policy" ON public."supervisor_employee_assignments" FOR DELETE
  USING ( (is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operations'::app_role))) );

CREATE POLICY "unified_insert_policy" ON public."supervisor_employee_assignments" FOR INSERT
  WITH CHECK ( (is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operations'::app_role))) );

CREATE POLICY "unified_select_policy" ON public."supervisor_employee_assignments" FOR SELECT
  USING ( ((is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operations'::app_role))) OR is_active_user(auth.uid())) );

CREATE POLICY "unified_update_policy" ON public."supervisor_employee_assignments" FOR UPDATE
  USING ( (is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operations'::app_role))) )
  WITH CHECK ( (is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operations'::app_role))) );

CREATE POLICY "unified_delete_policy" ON public."supervisor_targets" FOR DELETE
  USING ( (is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operations'::app_role))) );

CREATE POLICY "unified_insert_policy" ON public."supervisor_targets" FOR INSERT
  WITH CHECK ( (is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operations'::app_role))) );

CREATE POLICY "unified_select_policy" ON public."supervisor_targets" FOR SELECT
  USING ( ((is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operations'::app_role))) OR is_active_user(auth.uid())) );

CREATE POLICY "unified_update_policy" ON public."supervisor_targets" FOR UPDATE
  USING ( (is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operations'::app_role))) )
  WITH CHECK ( (is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operations'::app_role))) );

CREATE POLICY "unified_delete_policy" ON public."maintenance_parts" FOR DELETE
  USING ( (is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operations'::app_role))) );

CREATE POLICY "unified_insert_policy" ON public."maintenance_parts" FOR INSERT
  WITH CHECK ( (is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operations'::app_role))) );

CREATE POLICY "unified_select_policy" ON public."maintenance_parts" FOR SELECT
  USING ( ((is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operations'::app_role))) OR is_active_user(auth.uid())) );

CREATE POLICY "unified_update_policy" ON public."maintenance_parts" FOR UPDATE
  USING ( (is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operations'::app_role))) )
  WITH CHECK ( (is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operations'::app_role))) );

CREATE POLICY "unified_delete_policy" ON public."spare_parts" FOR DELETE
  USING ( (is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operations'::app_role))) );

CREATE POLICY "unified_insert_policy" ON public."spare_parts" FOR INSERT
  WITH CHECK ( (is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operations'::app_role))) );

CREATE POLICY "unified_select_policy" ON public."spare_parts" FOR SELECT
  USING ( ((is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operations'::app_role))) OR is_active_user(auth.uid())) );

CREATE POLICY "unified_update_policy" ON public."spare_parts" FOR UPDATE
  USING ( (is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operations'::app_role))) )
  WITH CHECK ( (is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operations'::app_role))) );

CREATE POLICY "unified_delete_policy" ON public."leave_requests" FOR DELETE
  USING ( is_admin_or_hr(auth.uid()) );

CREATE POLICY "unified_insert_policy" ON public."leave_requests" FOR INSERT
  WITH CHECK ( is_admin_or_hr(auth.uid()) );

CREATE POLICY "unified_update_policy" ON public."leave_requests" FOR UPDATE
  USING ( is_admin_or_hr(auth.uid()) )
  WITH CHECK ( is_admin_or_hr(auth.uid()) );

CREATE POLICY "unified_delete_policy" ON public."salary_slip_templates" FOR DELETE
  USING (
    (auth.role() = 'authenticated'::text) OR
    (is_active_user(auth.uid()) AND
     (has_role(auth.uid(), 'admin'::public.app_role) OR
      has_role(auth.uid(), 'operations'::public.app_role)))
  );

CREATE POLICY "unified_insert_policy" ON public."salary_slip_templates" FOR INSERT
  WITH CHECK (
    (auth.role() = 'authenticated'::text) OR
    (is_active_user(auth.uid()) AND
     (has_role(auth.uid(), 'admin'::public.app_role) OR
      has_role(auth.uid(), 'operations'::public.app_role)))
  );

CREATE POLICY "unified_update_policy" ON public."salary_slip_templates" FOR UPDATE
  USING (
    (auth.role() = 'authenticated'::text) OR
    (is_active_user(auth.uid()) AND
     (has_role(auth.uid(), 'admin'::public.app_role) OR
      has_role(auth.uid(), 'operations'::public.app_role)))
  )
  WITH CHECK (
    (auth.role() = 'authenticated'::text) OR
    (is_active_user(auth.uid()) AND
     (has_role(auth.uid(), 'admin'::public.app_role) OR
      has_role(auth.uid(), 'operations'::public.app_role)))
  );

CREATE POLICY "unified_select_policy" ON public."salary_slip_templates" FOR SELECT
  USING (
    (auth.role() = 'authenticated'::text) OR
    (is_active_user(auth.uid()) AND
     (has_role(auth.uid(), 'admin'::public.app_role) OR
      has_role(auth.uid(), 'operations'::public.app_role)))
  );

CREATE POLICY "unified_delete_policy" ON public."edge_rate_limits" FOR DELETE
  USING (
    (auth.role() = 'authenticated'::text) OR
    (is_active_user(auth.uid()) AND
     (has_role(auth.uid(), 'admin'::public.app_role) OR
      has_role(auth.uid(), 'operations'::public.app_role)))
  );

CREATE POLICY "unified_insert_policy" ON public."edge_rate_limits" FOR INSERT
  WITH CHECK (
    (auth.role() = 'authenticated'::text) OR
    (is_active_user(auth.uid()) AND
     (has_role(auth.uid(), 'admin'::public.app_role) OR
      has_role(auth.uid(), 'operations'::public.app_role)))
  );

CREATE POLICY "unified_update_policy" ON public."edge_rate_limits" FOR UPDATE
  USING (
    (auth.role() = 'authenticated'::text) OR
    (is_active_user(auth.uid()) AND
     (has_role(auth.uid(), 'admin'::public.app_role) OR
      has_role(auth.uid(), 'operations'::public.app_role)))
  )
  WITH CHECK (
    (auth.role() = 'authenticated'::text) OR
    (is_active_user(auth.uid()) AND
     (has_role(auth.uid(), 'admin'::public.app_role) OR
      has_role(auth.uid(), 'operations'::public.app_role)))
  );

CREATE POLICY "unified_select_policy" ON public."edge_rate_limits" FOR SELECT
  USING (
    (auth.role() = 'authenticated'::text) OR
    (is_active_user(auth.uid()) AND
     (has_role(auth.uid(), 'admin'::public.app_role) OR
      has_role(auth.uid(), 'operations'::public.app_role)))
  );

CREATE POLICY "unified_delete_policy" ON public."finance_transactions" FOR DELETE
  USING (
    (auth.role() = 'authenticated'::text) OR
    (is_active_user(auth.uid()) AND
     (has_role(auth.uid(), 'admin'::public.app_role) OR
      has_role(auth.uid(), 'finance'::public.app_role)))
  );

CREATE POLICY "unified_insert_policy" ON public."finance_transactions" FOR INSERT
  WITH CHECK (
    (auth.role() = 'authenticated'::text) OR
    (is_active_user(auth.uid()) AND
     (has_role(auth.uid(), 'admin'::public.app_role) OR
      has_role(auth.uid(), 'finance'::public.app_role)))
  );

CREATE POLICY "unified_update_policy" ON public."finance_transactions" FOR UPDATE
  USING (
    (auth.role() = 'authenticated'::text) OR
    (is_active_user(auth.uid()) AND
     (has_role(auth.uid(), 'admin'::public.app_role) OR
      has_role(auth.uid(), 'finance'::public.app_role)))
  )
  WITH CHECK (
    (auth.role() = 'authenticated'::text) OR
    (is_active_user(auth.uid()) AND
     (has_role(auth.uid(), 'admin'::public.app_role) OR
      has_role(auth.uid(), 'finance'::public.app_role)))
  );

CREATE POLICY "unified_select_policy" ON public."finance_transactions" FOR SELECT
  USING (
    (auth.role() = 'authenticated'::text) OR
    (is_active_user(auth.uid()) AND
     (has_role(auth.uid(), 'admin'::public.app_role) OR
      has_role(auth.uid(), 'finance'::public.app_role)))
  );

-- SECTION 13: NOTIFY pgrst
NOTIFY pgrst, 'reload schema';
