-- Drop supervisor_targets table completely

-- This will automatically drop related constraints, indexes, RLS policies, and triggers
DROP TABLE IF EXISTS public.supervisor_targets CASCADE;
