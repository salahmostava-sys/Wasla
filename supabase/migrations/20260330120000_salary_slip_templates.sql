-- Create salary_slip_templates table
CREATE TABLE IF NOT EXISTS public.salary_slip_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    header_html TEXT DEFAULT '',
    footer_html TEXT DEFAULT '',
    selected_columns JSONB DEFAULT '[]'::jsonb,
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.salary_slip_templates ENABLE ROW LEVEL SECURITY;

-- Simple policies (everyone can read for now, admins can write)
-- Note: Adjust based on roles if they exist.
DROP POLICY IF EXISTS "Enable read access for all users" ON public.salary_slip_templates;
CREATE POLICY "Enable read access for all users" ON public.salary_slip_templates
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Enable write access for authenticated users" ON public.salary_slip_templates;
CREATE POLICY "Enable write access for authenticated users" ON public.salary_slip_templates
    FOR ALL USING (auth.role() = 'authenticated');

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_salary_slip_templates_updated_at ON public.salary_slip_templates;
CREATE TRIGGER update_salary_slip_templates_updated_at
    BEFORE UPDATE ON public.salary_slip_templates
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Seed a default template
INSERT INTO public.salary_slip_templates (name, header_html, footer_html, selected_columns, is_default)
VALUES (
    'Default Enterprise Template',
    '<div class="header"><div><div class="header-brand">Muhimmat Delivery</div><div class="header-subtitle">Monthly Salary Slip</div></div></div>',
    '<div class="footer"><div class="signature-box"><div class="signature-line"></div><div>Employee Signature</div></div><div class="signature-box"><div class="signature-line"></div><div>Management Approval</div></div></div>',
    '["employeeName", "nationalId", "totalOrders", "baseSalary", "incentives", "netSalary"]'::jsonb,
    true
) ON CONFLICT DO NOTHING;
