import { supabase } from "./supabase/client";
import { throwIfError } from "./serviceError";

type QueryError = { message?: string } | null;

export interface ResolveAlertResult {
  id: string;
}

export interface DeferAlertResult {
  id: string;
}

type AlertsFetchResult = [
  { data: unknown[] | null; error: QueryError },
  { data: unknown[] | null; error: QueryError },
  { data: unknown[] | null; error: QueryError },
  { data: unknown[] | null; error: QueryError },
  { data: unknown[] | null; error: QueryError },
  { data: unknown[] | null; error: QueryError },
  { data: unknown[] | null; error: QueryError },
];

export const alertsService = {
  /**
   * @param expiryHorizon تاريخ ISO (yyyy-MM-dd): تنبيه لكل ما ينتهي قبل هذا التاريخ (حسب «أيام التنبيه» في الإعدادات)
   */
  fetchAlertsDataWithTimeout: async (
    expiryHorizon: string,
    timeoutMs: number
  ): Promise<AlertsFetchResult> => {
    const fetchAll = Promise.all([
      supabase
        .from("employees")
        .select("id, name, commercial_record, residency_expiry, probation_end_date, health_insurance_expiry, license_expiry, sponsorship_status, status")
        .eq("status", "active")
        .or(
          `residency_expiry.lte.${expiryHorizon},probation_end_date.lte.${expiryHorizon},health_insurance_expiry.lte.${expiryHorizon},license_expiry.lte.${expiryHorizon}`,
        ),
      supabase
        .from("vehicles")
        .select("id, plate_number, insurance_expiry, authorization_expiry")
        .in("status", ["active", "maintenance", "rental"])
        .or(`insurance_expiry.lte.${expiryHorizon},authorization_expiry.lte.${expiryHorizon}`),
      supabase
        .from("platform_accounts")
        .select("id, account_username, iqama_expiry_date, app_id, apps(name)")
        .eq("status", "active")
        .not("iqama_expiry_date", "is", null)
        .lte("iqama_expiry_date", expiryHorizon),
      supabase
        .from("alerts")
        .select("id, type, due_date, is_resolved, message, details")
        .order("created_at", { ascending: false })
        .limit(500),
      Promise.resolve({ data: [], error: null }), // Disabled spare_parts query per user request
      supabase
        .from("employees")
        .select(
          `
          id, name, sponsorship_status,
          vehicle_assignments(end_date, vehicles(plate_number, type)),
          employee_apps(status, apps(name))
        `,
        )
        .eq("sponsorship_status", "absconded")
        .eq("status", "active"),
      supabase
        .from("commercial_records")
        .select("name, residency_renewal_monthly_cost, residency_renewal_cost_period"),
    ]);

    const timeoutError = () =>
      new Error("انتهت مهلة تحميل البيانات. تحقق من الاتصال ثم أعد فتح الصفحة.");

    const results = (await Promise.race([
      fetchAll,
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(timeoutError()), timeoutMs);
      }),
    ])) as AlertsFetchResult;

    const [employeesRes, vehiclesRes, platformAccountsRes, dbAlertsRes, sparePartsRes, abscondedRes, commercialRecordsRes] = results;
    throwIfError(employeesRes.error, "alertsService.fetchAlertsDataWithTimeout.employees");
    throwIfError(vehiclesRes.error, "alertsService.fetchAlertsDataWithTimeout.vehicles");
    throwIfError(platformAccountsRes.error, "alertsService.fetchAlertsDataWithTimeout.platformAccounts");
    throwIfError(dbAlertsRes.error, "alertsService.fetchAlertsDataWithTimeout.alerts");
    throwIfError(abscondedRes.error, "alertsService.fetchAlertsDataWithTimeout.absconded");
    throwIfError(commercialRecordsRes.error, "alertsService.fetchAlertsDataWithTimeout.commercialRecords");
    if (sparePartsRes.error) {
      results[4] = { data: [], error: null };
    }
    return results;
  },

  // Critical fix: resolve action persists in DB.
  resolveAlert: async (alertId: string, resolvedBy: string | null): Promise<ResolveAlertResult> => {
    const { data, error } = await supabase
      .from("alerts")
      .update({
        is_resolved: true,
        resolved_by: resolvedBy,
      })
      .eq("id", alertId)
      .select("id")
      .maybeSingle();
    throwIfError(error, "alertsService.resolveAlert");
    if (!data?.id) {
      throw new Error("alertsService.resolveAlert: alert not found");
    }
    return { id: data.id };
  },

  // Critical fix: defer action persists in DB.
  deferAlert: async (alertId: string, dueDate: string): Promise<DeferAlertResult> => {
    const { data, error } = await supabase
      .from("alerts")
      .update({
        due_date: dueDate,
        is_resolved: false,
        resolved_by: null,
      })
      .eq("id", alertId)
      .select("id")
      .maybeSingle();
    throwIfError(error, "alertsService.deferAlert");
    if (!data?.id) {
      throw new Error("alertsService.deferAlert: alert not found");
    }
    return { id: data.id };
  },
};
