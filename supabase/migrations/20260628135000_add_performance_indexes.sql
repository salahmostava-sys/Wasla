-- Add performance indexes for frequently queried columns

CREATE INDEX IF NOT EXISTS idx_employees_name ON public.employees(name);
CREATE INDEX IF NOT EXISTS idx_daily_orders_date ON public.daily_orders(date);
