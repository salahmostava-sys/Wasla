-- ============================================================
-- Ø¥Ø¯Ø§Ø±Ø© Ø§Ù„Ø¥Ø¬Ø§Ø²Ø§Øª: leave_requests
-- ============================================================

CREATE TABLE IF NOT EXISTS public.leave_requests (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id      uuid        NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  type             text        NOT NULL CHECK (type IN ('annual','sick','emergency','unpaid','other')),
  start_date       date        NOT NULL,
  end_date         date        NOT NULL,
  days_count       integer     NOT NULL CHECK (days_count > 0),
  status           text        NOT NULL DEFAULT _const_installment_pending() CHECK (status IN (_const_installment_pending(),_const_approval_approved(),'rejected')),
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

-- SELECT: all authenticated users can read (SELECT with USING (true) is intentional for shared HR data)
DROP POLICY IF EXISTS "leave_requests_select" ON public.leave_requests;
CREATE POLICY "leave_requests_select" ON public.leave_requests
  FOR SELECT USING (true);

-- INSERT/UPDATE/DELETE: require authenticated session
DROP POLICY IF EXISTS "leave_requests_insert" ON public.leave_requests;
CREATE POLICY "leave_requests_insert" ON public.leave_requests
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "leave_requests_update" ON public.leave_requests;
CREATE POLICY "leave_requests_update" ON public.leave_requests
  FOR UPDATE USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "leave_requests_delete" ON public.leave_requests;
CREATE POLICY "leave_requests_delete" ON public.leave_requests
  FOR DELETE USING (auth.uid() IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_leave_requests_employee   ON public.leave_requests(employee_id);
CREATE INDEX IF NOT EXISTS idx_leave_requests_status     ON public.leave_requests(status);
CREATE INDEX IF NOT EXISTS idx_leave_requests_start_date ON public.leave_requests(start_date DESC);
CREATE INDEX IF NOT EXISTS idx_leave_requests_type       ON public.leave_requests(type);
