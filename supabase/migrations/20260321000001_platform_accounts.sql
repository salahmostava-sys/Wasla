-- ══════════════════════════════════════════════════════════════════════════════
-- Platform Accounts + Account Assignments + System Settings iqama_alert_days
-- Run this ONCE in: Supabase Dashboard → SQL Editor
-- ══════════════════════════════════════════════════════════════════════════════

-- 1. Add iqama_alert_days to system_settings (default 90 days)
ALTER TABLE public.system_settings
  ADD COLUMN IF NOT EXISTS iqama_alert_days INTEGER NOT NULL DEFAULT 90;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. platform_accounts
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.platform_accounts (
  id                     UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  app_id                 UUID        NOT NULL REFERENCES public.apps(id) ON DELETE CASCADE,
  account_username       TEXT        NOT NULL,
  account_id_on_platform TEXT,
  iqama_number           TEXT,
  iqama_expiry_date      DATE,
  status                 TEXT        NOT NULL DEFAULT 'active'
                           CHECK (status IN ('active', 'inactive')),
  notes                  TEXT,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.platform_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "platform_accounts_select" ON public.platform_accounts;
CREATE POLICY "platform_accounts_select"
  ON public.platform_accounts FOR SELECT
  USING (
    is_active_user(auth.uid()) AND (
      has_role(auth.uid(), 'admin') OR
      has_role(auth.uid(), 'hr')    OR
      has_role(auth.uid(), 'operations') OR
      has_role(auth.uid(), 'finance')
    )
  );

DROP POLICY IF EXISTS "platform_accounts_manage" ON public.platform_accounts;
CREATE POLICY "platform_accounts_manage"
  ON public.platform_accounts FOR ALL
  USING (
    is_active_user(auth.uid()) AND (
      has_role(auth.uid(), 'admin') OR
      has_role(auth.uid(), 'hr')
    )
  )
  WITH CHECK (
    is_active_user(auth.uid()) AND (
      has_role(auth.uid(), 'admin') OR
      has_role(auth.uid(), 'hr')
    )
  );

DROP TRIGGER IF EXISTS update_platform_accounts_updated_at ON public.platform_accounts;
CREATE TRIGGER update_platform_accounts_updated_at
  BEFORE UPDATE ON public.platform_accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. account_assignments  (لا يُحذف أي سجل نهائياً — فقط إغلاق بـ end_date)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.account_assignments (
  id          UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id  UUID        NOT NULL REFERENCES public.platform_accounts(id) ON DELETE CASCADE,
  employee_id UUID        NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  start_date  DATE        NOT NULL,
  end_date    DATE,
  month_year  TEXT        NOT NULL,   -- YYYY-MM
  notes       TEXT,
  created_by  UUID        REFERENCES auth.users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.account_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "account_assignments_select" ON public.account_assignments;
CREATE POLICY "account_assignments_select"
  ON public.account_assignments FOR SELECT
  USING (
    is_active_user(auth.uid()) AND (
      has_role(auth.uid(), 'admin') OR
      has_role(auth.uid(), 'hr')    OR
      has_role(auth.uid(), 'operations') OR
      has_role(auth.uid(), 'finance')
    )
  );

DROP POLICY IF EXISTS "account_assignments_insert_update" ON public.account_assignments;
CREATE POLICY "account_assignments_insert_update"
  ON public.account_assignments FOR INSERT
  WITH CHECK (
    is_active_user(auth.uid()) AND (
      has_role(auth.uid(), 'admin') OR
      has_role(auth.uid(), 'hr')
    )
  );

DROP POLICY IF EXISTS "account_assignments_update_only" ON public.account_assignments;
CREATE POLICY "account_assignments_update_only"
  ON public.account_assignments FOR UPDATE
  USING (
    is_active_user(auth.uid()) AND (
      has_role(auth.uid(), 'admin') OR
      has_role(auth.uid(), 'hr')
    )
  );

-- NO DELETE policy intentionally — records are closed with end_date only

DROP TRIGGER IF EXISTS update_account_assignments_updated_at ON public.account_assignments;
CREATE TRIGGER update_account_assignments_updated_at
  BEFORE UPDATE ON public.account_assignments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
