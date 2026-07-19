-- Add work_type to apps table
ALTER TABLE apps ADD COLUMN IF NOT EXISTS work_type TEXT DEFAULT 'orders' 
  CHECK (work_type IN ('orders', 'shift', 'hybrid'));

COMMENT ON COLUMN apps.work_type IS 'Ù†ÙˆØ¹ Ø§Ù„Ø¹Ù…Ù„: orders (Ø·Ù„Ø¨Ø§Øª), shift (Ø¯ÙˆØ§Ù…), hybrid (Ù…Ø®ØªÙ„Ø·)';

-- Create daily_shifts table for shift-based work
CREATE TABLE IF NOT EXISTS daily_shifts (
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

COMMENT ON TABLE daily_shifts IS 'ØªØ³Ø¬ÙŠÙ„ Ø³Ø§Ø¹Ø§Øª Ø§Ù„Ø¯ÙˆØ§Ù… Ø§Ù„ÙŠÙˆÙ…ÙŠØ© Ù„Ù„Ù…ÙˆØ¸ÙÙŠÙ†';
COMMENT ON COLUMN daily_shifts.hours_worked IS 'Ø¹Ø¯Ø¯ Ø³Ø§Ø¹Ø§Øª Ø§Ù„Ø¹Ù…Ù„ ÙÙŠ Ø§Ù„ÙŠÙˆÙ…';

CREATE INDEX IF NOT EXISTS idx_daily_shifts_employee_date ON daily_shifts(employee_id, date);
CREATE INDEX IF NOT EXISTS idx_daily_shifts_app_date ON daily_shifts(app_id, date);
CREATE INDEX IF NOT EXISTS idx_daily_shifts_date ON daily_shifts(date);

-- Create app_hybrid_rules table for hybrid platforms
CREATE TABLE IF NOT EXISTS app_hybrid_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  app_id UUID NOT NULL REFERENCES apps(id) ON DELETE CASCADE UNIQUE,
  min_hours_for_shift DECIMAL(4,2) NOT NULL CHECK (min_hours_for_shift > 0),
  shift_rate DECIMAL(10,2) NOT NULL CHECK (shift_rate >= 0),
  fallback_to_orders BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE app_hybrid_rules IS 'Ù‚ÙˆØ§Ø¹Ø¯ Ø§Ù„Ù…Ù†ØµØ§Øª Ø§Ù„Ù…Ø®ØªÙ„Ø·Ø© (Ø¯ÙˆØ§Ù… Ø£Ùˆ Ø·Ù„Ø¨Ø§Øª)';
COMMENT ON COLUMN app_hybrid_rules.min_hours_for_shift IS 'Ø§Ù„ØØ¯ Ø§Ù„Ø£Ø¯Ù†Ù‰ Ù…Ù† Ø§Ù„Ø³Ø§Ø¹Ø§Øª Ù„Ø§ØØªØ³Ø§Ø¨ Ø§Ù„Ø¯ÙˆØ§Ù…';
COMMENT ON COLUMN app_hybrid_rules.shift_rate IS 'Ø³Ø¹Ø± Ø§Ù„Ø¯ÙˆØ§Ù… Ø§Ù„ÙŠÙˆÙ…ÙŠ Ø¨Ø§Ù„Ø±ÙŠØ§Ù„';
COMMENT ON COLUMN app_hybrid_rules.fallback_to_orders IS 'Ø§Ù„ØªØÙˆÙŠÙ„ Ù„ØØ³Ø§Ø¨ Ø§Ù„Ø·Ù„Ø¨Ø§Øª Ø¹Ù†Ø¯ Ø¹Ø¯Ù… ØªØÙ‚ÙŠÙ‚ Ø§Ù„Ø³Ø§Ø¹Ø§Øª Ø§Ù„Ù…Ø·Ù„ÙˆØ¨Ø©';

-- Function to prevent overlap between orders and shifts on same day
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
      RAISE EXCEPTION 'Ù„Ø§ ÙŠÙ…ÙƒÙ† ØªØ³Ø¬ÙŠÙ„ Ø¯ÙˆØ§Ù… ÙÙŠ ÙŠÙˆÙ… ÙŠØØªÙˆÙŠ Ø¹Ù„Ù‰ Ø·Ù„Ø¨Ø§Øª Ù„Ù†ÙØ³ Ø§Ù„Ù…ÙˆØ¸Ù ÙˆØ§Ù„Ù…Ù†ØµØ©';
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
      RAISE EXCEPTION 'Ù„Ø§ ÙŠÙ…ÙƒÙ† ØªØ³Ø¬ÙŠÙ„ Ø·Ù„Ø¨Ø§Øª ÙÙŠ ÙŠÙˆÙ… ÙŠØØªÙˆÙŠ Ø¹Ù„Ù‰ Ø¯ÙˆØ§Ù… Ù„Ù†ÙØ³ Ø§Ù„Ù…ÙˆØ¸Ù ÙˆØ§Ù„Ù…Ù†ØµØ©';
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

DROP TRIGGER IF EXISTS daily_shifts_updated_at ON daily_shifts;
CREATE TRIGGER daily_shifts_updated_at
  BEFORE UPDATE ON daily_shifts
  FOR EACH ROW EXECUTE FUNCTION update_daily_shifts_updated_at();

-- Update trigger for app_hybrid_rules
DROP TRIGGER IF EXISTS app_hybrid_rules_updated_at ON app_hybrid_rules;
CREATE TRIGGER app_hybrid_rules_updated_at
  BEFORE UPDATE ON app_hybrid_rules
  FOR EACH ROW EXECUTE FUNCTION update_daily_shifts_updated_at();

-- Enable RLS on new tables
ALTER TABLE daily_shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_hybrid_rules ENABLE ROW LEVEL SECURITY;

-- RLS Policies for daily_shifts
DROP POLICY IF EXISTS "Authenticated users can view daily_shifts" ON daily_shifts;
CREATE POLICY "Authenticated users can view daily_shifts"
  ON daily_shifts FOR SELECT
  USING (public.is_active_user(auth.uid()));

DROP POLICY IF EXISTS "Authenticated users can insert daily_shifts" ON daily_shifts;
CREATE POLICY "Authenticated users can insert daily_shifts"
  ON daily_shifts FOR INSERT
  WITH CHECK (public.is_active_user(auth.uid()));

DROP POLICY IF EXISTS "Authenticated users can update daily_shifts" ON daily_shifts;
CREATE POLICY "Authenticated users can update daily_shifts"
  ON daily_shifts FOR UPDATE
  USING (public.is_active_user(auth.uid()));

DROP POLICY IF EXISTS "Authenticated users can delete daily_shifts" ON daily_shifts;
CREATE POLICY "Authenticated users can delete daily_shifts"
  ON daily_shifts FOR DELETE
  USING (public.is_active_user(auth.uid()));

-- RLS Policies for app_hybrid_rules
DROP POLICY IF EXISTS "Authenticated users can view app_hybrid_rules" ON app_hybrid_rules;
CREATE POLICY "Authenticated users can view app_hybrid_rules"
  ON app_hybrid_rules FOR SELECT
  USING (public.is_active_user(auth.uid()));

DROP POLICY IF EXISTS "Authenticated users can insert app_hybrid_rules" ON app_hybrid_rules;
CREATE POLICY "Authenticated users can insert app_hybrid_rules"
  ON app_hybrid_rules FOR INSERT
  WITH CHECK (public.is_active_user(auth.uid()));

DROP POLICY IF EXISTS "Authenticated users can update app_hybrid_rules" ON app_hybrid_rules;
CREATE POLICY "Authenticated users can update app_hybrid_rules"
  ON app_hybrid_rules FOR UPDATE
  USING (public.is_active_user(auth.uid()));

DROP POLICY IF EXISTS "Authenticated users can delete app_hybrid_rules" ON app_hybrid_rules;
CREATE POLICY "Authenticated users can delete app_hybrid_rules"
  ON app_hybrid_rules FOR DELETE
  USING (public.is_active_user(auth.uid()));
