CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS public.user_telegram_integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  phone_number varchar NOT NULL UNIQUE,
  otp_code varchar(4) NOT NULL CHECK (otp_code ~ '^[0-9]{4}$'),
  telegram_chat_id varchar NULL,
  is_linked boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_telegram_integrations_phone_number
  ON public.user_telegram_integrations (phone_number);

CREATE INDEX IF NOT EXISTS idx_user_telegram_integrations_chat_id
  ON public.user_telegram_integrations (telegram_chat_id);

ALTER TABLE public.user_telegram_integrations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own telegram integration" ON public.user_telegram_integrations;
CREATE POLICY "Users can view own telegram integration"
  ON public.user_telegram_integrations
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create own telegram integration" ON public.user_telegram_integrations;
CREATE POLICY "Users can create own telegram integration"
  ON public.user_telegram_integrations
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own telegram integration" ON public.user_telegram_integrations;
CREATE POLICY "Users can update own telegram integration"
  ON public.user_telegram_integrations
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
