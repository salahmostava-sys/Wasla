-- Establishment-level fields required to generate Saudi WPS / Mudad wage files.
-- These describe the CLIENT COMPANY (the employer), stored per deployment and
-- edited from Settings → Organization Info. They are NOT the software's name.

ALTER TABLE public.trade_registers
  ADD COLUMN IF NOT EXISTS mol_establishment_number text,
  ADD COLUMN IF NOT EXISTS employer_iban text,
  ADD COLUMN IF NOT EXISTS employer_bank_code text,
  ADD COLUMN IF NOT EXISTS tax_number text;

COMMENT ON COLUMN public.trade_registers.mol_establishment_number IS 'Ministry of Labor establishment/unified number (used in the WPS file header).';
COMMENT ON COLUMN public.trade_registers.employer_iban IS 'Employer bank IBAN that salaries are disbursed from (WPS header).';
COMMENT ON COLUMN public.trade_registers.employer_bank_code IS 'Employer bank 2-digit Saudi code (derived from the employer IBAN).';
COMMENT ON COLUMN public.trade_registers.tax_number IS 'VAT/tax number — moved out of the generic notes column into a dedicated field.';
