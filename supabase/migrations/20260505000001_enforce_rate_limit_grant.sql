-- Allow authenticated users to call enforce_rate_limit directly,
-- removing the need for a service-role client in the edge function.
GRANT EXECUTE ON FUNCTION public.enforce_rate_limit(text, int, int) TO authenticated;
