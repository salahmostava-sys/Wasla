-- Fix: fn_handle_employee_sponsorship_alerts references NEW.company_id which was dropped.
-- Replace with commercial_record lookup (the field that replaced company_id).

CREATE OR REPLACE FUNCTION public.fn_handle_employee_sponsorship_alerts()
RETURNS TRIGGER AS $$
DECLARE
  status TEXT;
  account_list TEXT;
  vehicle_plate_list TEXT;
  vehicle_count INT;
  trade_name TEXT;
  trade_cr TEXT;
  msg TEXT;
  accounts_json JSONB;
  vehicles_json JSONB;
  trade_json JSONB;
BEGIN
  status := NEW.sponsorship_status::TEXT;

  IF (NEW.sponsorship_status IS DISTINCT FROM OLD.sponsorship_status)
     AND (status IN ('absconded', 'terminated')) THEN

    IF status = 'terminated' THEN
      IF NOT EXISTS (
        SELECT 1 FROM public.platform_accounts WHERE employee_id = NEW.id
      ) THEN
        RETURN NEW;
      END IF;
    END IF;

    SELECT
      STRING_AGG(format('%s: %s', a.name, pa.account_username), ', ' ORDER BY a.name),
      COALESCE(JSONB_AGG(
        JSONB_BUILD_OBJECT(
          'app', a.name,
          'username', pa.account_username,
          'account_id_on_platform', pa.account_id_on_platform,
          'iqama_number', pa.iqama_number
        )
      ), '[]'::jsonb)
    INTO account_list, accounts_json
    FROM public.platform_accounts pa
    JOIN public.apps a ON a.id = pa.app_id
    WHERE pa.employee_id = NEW.id;

    SELECT
      COUNT(*)::int,
      STRING_AGG(v.plate_number, ', ' ORDER BY v.plate_number),
      COALESCE(JSONB_AGG(
        JSONB_BUILD_OBJECT('vehicle_id', v.id, 'plate_number', v.plate_number)
      ), '[]'::jsonb)
    INTO vehicle_count, vehicle_plate_list, vehicles_json
    FROM public.vehicle_assignments va
    JOIN public.vehicles v ON v.id = va.vehicle_id
    WHERE va.employee_id = NEW.id
      AND va.end_date IS NULL
      AND va.returned_at IS NULL;

    -- Use commercial_record name instead of the dropped company_id column
    trade_name := NEW.commercial_record;
    trade_cr := NULL;
    trade_json := '{}'::jsonb;

    IF NEW.commercial_record IS NOT NULL AND NEW.commercial_record <> '' THEN
      SELECT
        cr.name,
        cr.cr_number,
        JSONB_BUILD_OBJECT(
          'name', cr.name,
          'cr_number', cr.cr_number
        )
      INTO trade_name, trade_cr, trade_json
      FROM public.commercial_records cr
      WHERE cr.name = NEW.commercial_record
      LIMIT 1;
    END IF;

    msg :=
      format(
        'Ø§Ù„Ù…ÙˆØ¸Ù: %s (Ø§Ù„Ù‡ÙˆÙŠØ©: %s) | Ù…Ù†ØµØ§Øª: %s | Ù…Ø±ÙƒØ¨Ø§Øª: %s | Ø³Ø¬Ù„ ØªØ¬Ø§Ø±ÙŠ: %s',
        COALESCE(NEW.name, 'â€”'),
        COALESCE(NEW.national_id, 'â€”'),
        COALESCE(account_list, 'â€”'),
        COALESCE(vehicle_plate_list, CASE WHEN vehicle_count IS NULL THEN 'â€”' ELSE vehicle_count::TEXT || ' Ù…Ø±ÙƒØ¨Ø©' END),
        COALESCE(trade_name, 'â€”')
      );

    INSERT INTO public.alerts (
      type,
      entity_id,
      entity_type,
      due_date,
      message,
      details
    )
    VALUES (
      CASE WHEN status = 'absconded' THEN 'employee_absconded' ELSE 'employee_terminated' END,
      NEW.id,
      'employee',
      CURRENT_DATE,
      msg,
      JSONB_BUILD_OBJECT(
        'employee_id', NEW.id,
        'employee_name', NEW.name,
        'national_id', NEW.national_id,
        'sponsorship_status', status,
        'platform_accounts', accounts_json,
        'vehicle_count', COALESCE(vehicle_count, 0),
        'vehicle_plates', COALESCE(vehicle_plate_list, ''),
        'vehicles', vehicles_json,
        'trade_register', trade_json,
        'trade_cr_number', trade_cr
      )
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = 'public';
