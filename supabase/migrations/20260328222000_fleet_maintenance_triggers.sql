-- Triggers: auto employee, stock deduct/restore, total_cost rollup

BEGIN;

CREATE OR REPLACE FUNCTION public.fill_maintenance_employee()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public /* NOSONAR */
AS $$
BEGIN
  IF NEW.employee_id IS NULL THEN
    SELECT va.employee_id INTO NEW.employee_id
    FROM public.vehicle_assignments va
    WHERE va.vehicle_id = NEW.vehicle_id
      AND va.returned_at IS NULL
    ORDER BY va.created_at DESC NULLS LAST
    LIMIT 1;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_fill_maintenance_employee ON public.maintenance_logs;
CREATE TRIGGER trg_fill_maintenance_employee
  BEFORE INSERT ON public.maintenance_logs
  FOR EACH ROW EXECUTE FUNCTION public.fill_maintenance_employee();

CREATE OR REPLACE FUNCTION public.deduct_spare_part_stock()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public /* NOSONAR */
AS $$
BEGIN
  UPDATE public.spare_parts sp
  SET stock_quantity = sp.stock_quantity - NEW.quantity_used,
      updated_at = now()
  WHERE sp.id = NEW.part_id;

  IF (SELECT sp2.stock_quantity FROM public.spare_parts sp2 WHERE sp2.id = NEW.part_id) < 0 THEN
    RAISE EXCEPTION 'Ø§Ù„Ù…Ø®Ø²ÙˆÙ† ØºÙŠØ± ÙƒØ§ÙÙ Ù„Ù„Ù‚Ø·Ø¹Ø© Ø§Ù„Ù…Ø·Ù„ÙˆØ¨Ø©';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_deduct_stock ON public.maintenance_parts;
CREATE TRIGGER trg_deduct_stock
  AFTER INSERT ON public.maintenance_parts
  FOR EACH ROW EXECUTE FUNCTION public.deduct_spare_part_stock();

CREATE OR REPLACE FUNCTION public.restore_spare_part_stock()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public /* NOSONAR */
AS $$
BEGIN
  UPDATE public.spare_parts sp
  SET stock_quantity = sp.stock_quantity + OLD.quantity_used,
      updated_at = now()
  WHERE sp.id = OLD.part_id;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_restore_stock ON public.maintenance_parts;
CREATE TRIGGER trg_restore_stock
  AFTER DELETE ON public.maintenance_parts
  FOR EACH ROW EXECUTE FUNCTION public.restore_spare_part_stock();

CREATE OR REPLACE FUNCTION public.update_maintenance_total_cost()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public /* NOSONAR */
AS $$
DECLARE
  log_id uuid;
BEGIN
  log_id := COALESCE(NEW.maintenance_log_id, OLD.maintenance_log_id);
  UPDATE public.maintenance_logs ml
  SET total_cost = (
      SELECT COALESCE(SUM(mp.quantity_used * mp.cost_at_time), 0)::numeric(10, 2)
      FROM public.maintenance_parts mp
      WHERE mp.maintenance_log_id = log_id
    ),
    updated_at = now()
  WHERE ml.id = log_id;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_update_total_cost ON public.maintenance_parts;
CREATE TRIGGER trg_update_total_cost
  AFTER INSERT OR UPDATE OR DELETE ON public.maintenance_parts
  FOR EACH ROW EXECUTE FUNCTION public.update_maintenance_total_cost();

COMMIT;
