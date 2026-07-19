ALTER TABLE public.treasury_transactions ADD COLUMN app_id UUID REFERENCES public.apps(id) ON DELETE SET NULL;
