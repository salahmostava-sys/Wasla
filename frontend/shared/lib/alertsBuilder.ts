import { addDays, differenceInDays, format, parseISO } from "date-fns";

const ISO_DATE_FORMAT = "yyyy-MM-dd";

export interface Alert {
  id: string;
  type: string;
  entityName: string;
  dueDate: string;
  daysLeft: number;
  severity: "urgent" | "warning" | "info";
  resolved: boolean;
}

export type EmployeeAlertRow = {
  id: string;
  name: string;
  commercial_record?: string | null;
  residency_expiry: string | null;
  probation_end_date: string | null;
  health_insurance_expiry?: string | null;
  license_expiry?: string | null;
  sponsorship_status?: string | null;
};

export type AbscondedEmployeeAlertRow = {
  id: string;
  name: string;
  sponsorship_status?: string | null;
  vehicle_assignments?: {
    end_date: string | null;
    vehicles: { plate_number: string; type: string } | null;
  }[] | null;
  employee_apps?: {
    status: string | null;
    apps: { name: string | null } | null;
  }[] | null;
};

export type VehicleExpiryRow = {
  id: string;
  plate_number: string;
  insurance_expiry: string | null;
  authorization_expiry: string | null;
};

export type PlatformAccountAlertRow = {
  id: string;
  account_username: string;
  iqama_expiry_date: string | null;
  app_id: string;
  apps?: { name?: string | null } | null;
};

export type PersistedAlertRow = {
  id: string;
  type: string;
  due_date: string | null;
  is_resolved: boolean | null;
  message: string | null;
  details: Record<string, unknown> | null;
};

export type LowStockSparePartAlertRow = {
  id: string;
  name_ar: string;
  stock_quantity: number;
  min_stock_alert: number;
  unit: string;
};

const getStandardSeverity = (daysLeft: number): Alert["severity"] => {
  if (daysLeft <= 7) return "urgent";
  if (daysLeft <= 14) return "warning";
  return "info";
};

const getProbationSeverity = (daysLeft: number): Alert["severity"] => {
  if (daysLeft < 0) return "info";
  if (daysLeft <= 7) return "urgent";
  return "warning";
};

const pushEmployeeExpiryAlerts = (
  generatedAlerts: Alert[],
  emp: EmployeeAlertRow,
  threshold: string,
  today: Date
) => {
  const employeeLabel = emp.commercial_record?.trim()
    ? `${emp.name} • السجل: ${emp.commercial_record.trim()}`
    : emp.name;

  if (emp.residency_expiry && emp.residency_expiry <= threshold) {
    const daysLeft = differenceInDays(parseISO(emp.residency_expiry), today);
    generatedAlerts.push({
      id: `res-${emp.id}`,
      type: "residency",
      entityName: employeeLabel,
      dueDate: emp.residency_expiry,
      daysLeft,
      severity: getStandardSeverity(daysLeft),
      resolved: false,
    });
  }

  if (emp.probation_end_date && emp.probation_end_date <= threshold) {
    const daysLeft = differenceInDays(parseISO(emp.probation_end_date), today);
    generatedAlerts.push({
      id: `prob-${emp.id}`,
      type: "probation",
      entityName: employeeLabel,
      dueDate: emp.probation_end_date,
      daysLeft,
      severity: getProbationSeverity(daysLeft),
      resolved: false,
    });
  }

  if (emp.health_insurance_expiry && emp.health_insurance_expiry <= threshold) {
    const daysLeft = differenceInDays(parseISO(emp.health_insurance_expiry), today);
    generatedAlerts.push({
      id: `hi-${emp.id}`,
      type: "health_insurance",
      entityName: employeeLabel,
      dueDate: emp.health_insurance_expiry,
      daysLeft,
      severity: getStandardSeverity(daysLeft),
      resolved: false,
    });
  }

  if (emp.license_expiry && emp.license_expiry <= threshold) {
    const daysLeft = differenceInDays(parseISO(emp.license_expiry), today);
    generatedAlerts.push({
      id: `lic-${emp.id}`,
      type: "driving_license",
      entityName: employeeLabel,
      dueDate: emp.license_expiry,
      daysLeft,
      severity: getStandardSeverity(daysLeft),
      resolved: false,
    });
  }
};

const vehicleTypeLabelAr = (type: string | null | undefined): string => {
  if (type === "motorcycle") return "دباب";
  if (type === "car") return "سيارة";
  return type?.trim() ? type : "مركبة";
};

const pushAbscondedSummaryAlerts = (
  out: Alert[],
  rows: AbscondedEmployeeAlertRow[] | null | undefined,
  today: Date
) => {
  if (!rows?.length) return;
  const dueDate = format(today, ISO_DATE_FORMAT);
  for (const emp of rows) {
    const openAssignments = (emp.vehicle_assignments ?? []).filter((va) => !va.end_date);
    const custodyParts = openAssignments
      .map((va) => va.vehicles)
      .filter((v): v is NonNullable<typeof v> => Boolean(v))
      .map((v) => `${vehicleTypeLabelAr(v.type)} ${v.plate_number}`);
    const custody = custodyParts.length ? custodyParts.join("، ") : "لا عهدة مركبة مفتوحة";

    const platformNames = (emp.employee_apps ?? [])
      .filter((ea) => (ea.status ?? "").toLowerCase() === "active")
      .map((ea) => ea.apps?.name)
      .filter((n): n is string => Boolean(n?.trim()));
    const platforms =
      platformNames.length > 0 ? `حسابات منصات نشطة: ${platformNames.join("، ")}` : "لا يوجد ربط منصة نشط";

    out.push({
      id: `absconded-${emp.id}`,
      type: "employee_absconded",
      entityName: `${emp.name} — حالة هروب. العهدة: ${custody}. ${platforms}.`,
      dueDate,
      daysLeft: 0,
      severity: "urgent",
      resolved: false,
    });
  }
};

const pushVehicleExpiryAlerts = (
  out: Alert[],
  vehicles: VehicleExpiryRow[] | null | undefined,
  threshold: string,
  today: Date
) => {
  if (!vehicles?.length) return;
  for (const v of vehicles) {
    if (v.insurance_expiry && v.insurance_expiry <= threshold) {
      const days = differenceInDays(parseISO(v.insurance_expiry), today);
      out.push({
        id: `ins-${v.id}`,
        type: "insurance",
        entityName: `مركبة ${v.plate_number}`,
        dueDate: v.insurance_expiry,
        daysLeft: days,
        severity: getStandardSeverity(days),
        resolved: false,
      });
    }
    if (v.authorization_expiry && v.authorization_expiry <= threshold) {
      const days = differenceInDays(parseISO(v.authorization_expiry), today);
      out.push({
        id: `auth-${v.id}`,
        type: "authorization",
        entityName: `مركبة ${v.plate_number}`,
        dueDate: v.authorization_expiry,
        daysLeft: days,
        severity: getStandardSeverity(days),
        resolved: false,
      });
    }
  }
};

const pushPlatformAccountAlerts = (out: Alert[], rows: PlatformAccountAlertRow[], today: Date) => {
  for (const acc of rows) {
    if (!acc.iqama_expiry_date) continue;
    const days = differenceInDays(parseISO(acc.iqama_expiry_date), today);
    const appName = acc.apps?.name ?? "منصة";
    const expiryFormatted = format(parseISO(acc.iqama_expiry_date), "dd/MM/yyyy");
    out.push({
      id: `pla-${acc.id}`,
      type: "platform_account",
      entityName: `إقامة الحساب ${acc.account_username} على منصة ${appName} ستنتهي في ${expiryFormatted}، قد يتوقف الحساب.`,
      dueDate: acc.iqama_expiry_date,
      daysLeft: days,
      severity: getStandardSeverity(days),
      resolved: false,
    });
  }
};

const pushLowStockSparePartAlerts = (out: Alert[], rows: LowStockSparePartAlertRow[] | null | undefined, today: Date) => {
  if (!rows?.length) return;
  const dueDate = format(today, ISO_DATE_FORMAT);
  for (const p of rows) {
    if (Number(p.stock_quantity) >= Number(p.min_stock_alert ?? 0)) continue;
    out.push({
      id: `lowstock-${p.id}`,
      type: "low_stock",
      entityName: `قطعة "${p.name_ar}" وصلت للحد الأدنى (متبقي: ${p.stock_quantity} ${p.unit})`,
      dueDate,
      daysLeft: 0,
      severity: "warning",
      resolved: false,
    });
  }
};

const pushPersistedDbAlerts = (out: Alert[], rows: PersistedAlertRow[], today: Date) => {
  for (const a of rows) {
    const dueDate = a.due_date ?? format(today, ISO_DATE_FORMAT);
    const daysLeft = differenceInDays(parseISO(dueDate), today);
    const details = a.details ?? {};
    const detailsEmployeeName = typeof details.employee_name === "string" ? details.employee_name : null;
    const entityName = detailsEmployeeName ?? a.message ?? "—";
    out.push({
      id: a.id,
      type: a.type,
      entityName,
      dueDate,
      daysLeft,
      severity: getStandardSeverity(daysLeft),
      resolved: !!a.is_resolved,
    });
  }
};

export type AlertSourceResponses = {
  employeesRes: { data: EmployeeAlertRow[] | null };
  vehiclesRes: { data: VehicleExpiryRow[] | null };
  platformAccountsRes: { data: PlatformAccountAlertRow[] | null };
  dbAlertsRes: { data: PersistedAlertRow[] | null };
  sparePartsRes: { data: LowStockSparePartAlertRow[] | null };
  abscondedRes: { data: AbscondedEmployeeAlertRow[] | null };
};

export function buildAlertsFromResponses(
  responses: AlertSourceResponses,
  threshold: string,
  today: Date
): Alert[] {
  const { employeesRes, vehiclesRes, platformAccountsRes, dbAlertsRes, sparePartsRes, abscondedRes } = responses;
  const generatedAlerts: Alert[] = [];
  const employees = employeesRes.data ?? [];
  const platformAccounts = platformAccountsRes.data ?? [];
  const dbAlerts = dbAlertsRes.data ?? [];
  const spareParts = sparePartsRes.data ?? [];
  const absconded = abscondedRes.data ?? [];
  employees.forEach((emp) => pushEmployeeExpiryAlerts(generatedAlerts, emp, threshold, today));
  pushVehicleExpiryAlerts(generatedAlerts, vehiclesRes.data, threshold, today);
  pushPlatformAccountAlerts(generatedAlerts, platformAccounts, today);
  pushLowStockSparePartAlerts(generatedAlerts, spareParts, today);
  pushPersistedDbAlerts(generatedAlerts, dbAlerts, today);
  pushAbscondedSummaryAlerts(generatedAlerts, absconded, today);
  generatedAlerts.sort((a, b) => a.daysLeft - b.daysLeft);
  return generatedAlerts;
}

export const daysFromTodayIso = (days: number) => format(addDays(new Date(), days), ISO_DATE_FORMAT);
