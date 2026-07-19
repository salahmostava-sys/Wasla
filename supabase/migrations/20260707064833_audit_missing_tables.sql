-- Treasury
DROP TRIGGER IF EXISTS audit_treasury_transactions ON public.treasury_transactions;
CREATE TRIGGER audit_treasury_transactions
AFTER INSERT OR UPDATE OR DELETE ON public.treasury_transactions
FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

DROP TRIGGER IF EXISTS audit_treasury_accounts ON public.treasury_accounts;
CREATE TRIGGER audit_treasury_accounts
AFTER INSERT OR UPDATE OR DELETE ON public.treasury_accounts
FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

DROP TRIGGER IF EXISTS audit_treasury_categories ON public.treasury_categories;
CREATE TRIGGER audit_treasury_categories
AFTER INSERT OR UPDATE OR DELETE ON public.treasury_categories
FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

-- Maintenance
DROP TRIGGER IF EXISTS audit_maintenance_logs ON public.maintenance_logs;
CREATE TRIGGER audit_maintenance_logs
AFTER INSERT OR UPDATE OR DELETE ON public.maintenance_logs
FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

DROP TRIGGER IF EXISTS audit_spare_parts ON public.spare_parts;
CREATE TRIGGER audit_spare_parts
AFTER INSERT OR UPDATE OR DELETE ON public.spare_parts
FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

-- External Deductions
DROP TRIGGER IF EXISTS audit_external_deductions ON public.external_deductions;
CREATE TRIGGER audit_external_deductions
AFTER INSERT OR UPDATE OR DELETE ON public.external_deductions
FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

-- Employee Wallet
DROP TRIGGER IF EXISTS audit_employee_wallet_transactions ON public.employee_wallet_transactions;
CREATE TRIGGER audit_employee_wallet_transactions
AFTER INSERT OR UPDATE OR DELETE ON public.employee_wallet_transactions
FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();
