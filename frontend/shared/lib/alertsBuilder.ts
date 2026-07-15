import { differenceInDays, format, parseISO } from "date-fns";
import { fmtNum } from "@shared/lib/utils";

const ISO_DATE_FORMAT = "yyyy-MM-dd";

export interface Alert {
  id: string;
  type: string;
  entityName: string;
  dueDate: string;
  daysLeft: number;
  severity: "urgent" | "warning" | "info";
  resolved: boolean;
  persisted?: boolean;
  persistedId?: string;
  sourceKey?: string;
  entityId?: string | null;
  entityType?: string | null;
  workflowStatus?: "open" | "in_progress" | "snoozed" | "resolved";
  assignedTo?: string | null;
  assignedName?: string | null;
  estimatedCost?: number | null;
  resolutionNote?: string | null;
  snoozedUntil?: string | null;
  residencyRenewalCost?: number | null;
  residencyRenewalCostPeriod?: "monthly" | "yearly" | null;
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
  status?: string | null;
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

export type VehicleRentalAlertRow = {
  id: string;
  plate_number: string;
  rental_start_date: string | null;
  rental_monthly_amount: number | null;
  status: string;
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
  entity_id?: string | null;
  entity_type?: string | null;
  source_key?: string | null;
  status?: "open" | "in_progress" | "snoozed" | "resolved" | null;
  assigned_to?: string | null;
  estimated_cost?: number | null;
  resolution_note?: string | null;
  snoozed_until?: string | null;
  assigned_profile?: { name?: string | null; email?: string | null } | null;
};

export type LowStockSparePartAlertRow = {
  id: string;
  name_ar: string;
  stock_quantity: number;
  min_stock_alert: number;
  unit: string;
};

export type CommercialRecordRenewalCostRow = {
  name: string;
  residency_renewal_monthly_cost: number | null;
  residency_renewal_cost_period?: "monthly" | "yearly" | null;
};

const commercialRecordKey = (value: string | null | undefined) => (value ?? "").trim().toLocaleLowerCase();

const getResidencyRenewalCost = (
  emp: EmployeeAlertRow,
  renewalCostByRecord: Map<string, CommercialRecordRenewalCostRow>
) => {
  const record = renewalCostByRecord.get(commercialRecordKey(emp.commercial_record));
  const rawCost = record?.residency_renewal_monthly_cost ?? null;
  if (rawCost === null) return { cost: null, period: null };

  const period = record?.residency_renewal_cost_period === "yearly" ? "yearly" : "monthly";
  return {
    cost: period === "yearly" ? rawCost : rawCost * 3,
    period,
  };
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

const shouldSkipEmployeeExpiryAlerts = (emp: EmployeeAlertRow) => {
  if (emp.status && emp.status.toLowerCase() !== 'active') {
    return true;
  }

  const invalidStatuses = ['absconded', 'expired', 'terminated', 'inactive', 'canceled', 'final_exit'];
  return Boolean(emp.sponsorship_status && invalidStatuses.includes(emp.sponsorship_status.toLowerCase()));
};

const getEmployeeAlertLabel = (emp: EmployeeAlertRow) =>
  emp.commercial_record?.trim()
    ? `${emp.name} • السجل: ${emp.commercial_record.trim()}`
    : emp.name;

const getResidencyRenewalLabel = (renewal: ReturnType<typeof getResidencyRenewalCost>) => {
  if (renewal.cost === null) return "";
  const periodLabel = renewal.period === "yearly" ? "سنوي" : "3 شهور";
  return ` — تكلفة التجديد: ${fmtNum(renewal.cost)} ر.س (${periodLabel})`;
};

const buildResidencyAlert = (
  emp: EmployeeAlertRow,
  employeeLabel: string,
  today: Date,
  renewalCostByRecord: Map<string, CommercialRecordRenewalCostRow>
): Alert | null => {
  if (!emp.residency_expiry) return null;
  const daysLeft = differenceInDays(parseISO(emp.residency_expiry), today);
  const renewal = getResidencyRenewalCost(emp, renewalCostByRecord);
  return {
    id: `res-${emp.id}`,
    sourceKey: `res-${emp.id}`,
    entityId: emp.id,
    entityType: "employee",
    type: "residency",
    entityName: `${employeeLabel}${getResidencyRenewalLabel(renewal)}`,
    dueDate: emp.residency_expiry,
    daysLeft,
    severity: getStandardSeverity(daysLeft),
    resolved: false,
    residencyRenewalCost: renewal.cost,
    residencyRenewalCostPeriod: renewal.period,
  };
};

const buildEmployeeDateAlert = (
  id: string,
  type: string,
  entityName: string,
  dueDate: string | null | undefined,
  today: Date,
  severityForDays: (daysLeft: number) => Alert["severity"]
): Alert | null => {
  if (!dueDate) return null;
  const daysLeft = differenceInDays(parseISO(dueDate), today);
  return {
    id,
    sourceKey: id,
    entityId: id.slice(id.indexOf("-") + 1),
    entityType: "employee",
    type,
    entityName,
    dueDate,
    daysLeft,
    severity: severityForDays(daysLeft),
    resolved: false,
  };
};

const pushIfDue = (out: Alert[], alert: Alert | null, threshold: string) => {
  if (alert && alert.dueDate <= threshold) {
    out.push(alert);
  }
};

/** عدد الأيام قبل تاريخ استحقاق الإيجار لإظهار التنبيه */
const RENTAL_ALERT_LEAD_DAYS = 5;

/**
 * تحسب تاريخ الاستحقاق الشهري القادم بناءً على يوم بدء الإيجار.
 * مثال: بدأ الإيجار في 5 يناير → الاستحقاق كل شهر في اليوم 5.
 * إذا كان اليوم 5 مضى هذا الشهر ينتقل للشهر القادم.
 */
const getNextRentalDueDate = (rentalStartDate: string, today: Date): Date => {
  const startDay = parseISO(rentalStartDate).getDate();
  const year = today.getFullYear();
  const month = today.getMonth(); // 0-indexed

  // جرب استحقاق هذا الشهر
  const thisMonthDue = new Date(year, month, startDay);
  // إذا الاستحقاق لم يمر بعد (today < dueDate) أو لا يزال ضمن نافذة التنبيه → استخدمه
  if (today <= thisMonthDue) return thisMonthDue;
  // وإلا انتقل للشهر القادم
  return new Date(year, month + 1, startDay);
};

const pushVehicleRentalAlerts = (
  out: Alert[],
  vehicles: VehicleRentalAlertRow[] | null | undefined,
  today: Date
) => {
  if (!vehicles?.length) return;
  for (const v of vehicles) {
    if (v.status !== "rental" || !v.rental_start_date) continue;
    const dueDate = getNextRentalDueDate(v.rental_start_date, today);
    const dueDateStr = format(dueDate, ISO_DATE_FORMAT);
    const daysLeft = differenceInDays(dueDate, today);
    // إظهار التنبيه فقط متى كان الاستحقاق خلال نافذة RENTAL_ALERT_LEAD_DAYS
    if (daysLeft > RENTAL_ALERT_LEAD_DAYS) continue;
    const amountStr = v.rental_monthly_amount != null
      ? ` — المبلغ: ${fmtNum(v.rental_monthly_amount)} ر.س`
      : "";
    out.push({
      id: `rental-${v.id}`,
      sourceKey: `rental-${v.id}`,
      entityId: v.id,
      entityType: "vehicle",
      type: "vehicle_rental",
      entityName: `إيجار مركبة ${v.plate_number}${amountStr}`,
      dueDate: dueDateStr,
      daysLeft,
      severity: daysLeft <= 1 ? "urgent" : daysLeft <= 3 ? "warning" : "info",
      resolved: false,
    });
  }
};

const pushEmployeeExpiryAlerts = (
  generatedAlerts: Alert[],
  emp: EmployeeAlertRow,
  threshold: string,
  today: Date,
  renewalCostByRecord: Map<string, CommercialRecordRenewalCostRow>
) => {
  if (shouldSkipEmployeeExpiryAlerts(emp)) return;

  const employeeLabel = getEmployeeAlertLabel(emp);
  pushIfDue(generatedAlerts, buildResidencyAlert(emp, employeeLabel, today, renewalCostByRecord), threshold);
  pushIfDue(generatedAlerts, buildEmployeeDateAlert(`prob-${emp.id}`, "probation", employeeLabel, emp.probation_end_date, today, getProbationSeverity), threshold);
  pushIfDue(generatedAlerts, buildEmployeeDateAlert(`hi-${emp.id}`, "health_insurance", employeeLabel, emp.health_insurance_expiry, today, getStandardSeverity), threshold);
  pushIfDue(generatedAlerts, buildEmployeeDateAlert(`lic-${emp.id}`, "driving_license", employeeLabel, emp.license_expiry, today, getStandardSeverity), threshold);
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
      sourceKey: `absconded-${emp.id}`,
      entityId: emp.id,
      entityType: "employee",
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
        sourceKey: `ins-${v.id}`,
        entityId: v.id,
        entityType: "vehicle",
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
        sourceKey: `auth-${v.id}`,
        entityId: v.id,
        entityType: "vehicle",
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
      sourceKey: `pla-${acc.id}`,
      entityId: acc.id,
      entityType: "platform_account",
      type: "platform_account",
      entityName: `إقامة الحساب ${acc.account_username} على منصة ${appName} ستنتهي في ${expiryFormatted}، قد يتوقف الحساب.`,
      dueDate: acc.iqama_expiry_date,
      daysLeft: days,
      severity: getStandardSeverity(days),
      resolved: false,
    });
  }
};

const pushPersistedDbAlerts = (out: Alert[], rows: PersistedAlertRow[], today: Date) => {
  for (const a of rows) {
    const dueDate = a.snoozed_until ?? a.due_date ?? format(today, ISO_DATE_FORMAT);
    const daysLeft = differenceInDays(parseISO(dueDate), today);
    const details = a.details ?? {};
    const detailsEmployeeName = typeof details.employee_name === "string" ? details.employee_name : null;
    const entityName = detailsEmployeeName ?? a.message ?? "—";
    const workflowStatus = a.status ?? (a.is_resolved ? "resolved" : "open");
    const generatedAlert = a.source_key
      ? out.find((candidate) => candidate.sourceKey === a.source_key)
      : undefined;
    const workflowFields = {
      persisted: true,
      persistedId: a.id,
      workflowStatus,
      assignedTo: a.assigned_to ?? null,
      assignedName: a.assigned_profile?.name ?? a.assigned_profile?.email ?? null,
      estimatedCost: a.estimated_cost ?? null,
      resolutionNote: a.resolution_note ?? null,
      snoozedUntil: a.snoozed_until ?? null,
      resolved: workflowStatus === "resolved" || !!a.is_resolved,
    };

    if (generatedAlert) {
      Object.assign(generatedAlert, workflowFields, { dueDate, daysLeft });
      continue;
    }

    out.push({
      id: a.source_key ?? a.id,
      sourceKey: a.source_key ?? undefined,
      entityId: a.entity_id ?? null,
      entityType: a.entity_type ?? null,
      type: a.type,
      entityName,
      dueDate,
      daysLeft,
      severity: getStandardSeverity(daysLeft),
      ...workflowFields,
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
  commercialRecordsRes: { data: CommercialRecordRenewalCostRow[] | null };
  rentalVehiclesRes: { data: VehicleRentalAlertRow[] | null };
};

export function buildAlertsFromResponses(
  responses: AlertSourceResponses,
  threshold: string,
  today: Date
): Alert[] {
  const { employeesRes, vehiclesRes, platformAccountsRes, dbAlertsRes, sparePartsRes: _sparePartsRes, abscondedRes, commercialRecordsRes, rentalVehiclesRes } = responses;
  const generatedAlerts: Alert[] = [];
  const employees = employeesRes.data ?? [];
  const platformAccounts = platformAccountsRes.data ?? [];
  const dbAlerts = dbAlertsRes.data ?? [];
  const absconded = abscondedRes.data ?? [];
  const renewalCostByRecord = new Map(
    (commercialRecordsRes.data ?? [])
      .filter((record) => record.name?.trim())
      .map((record) => [commercialRecordKey(record.name), record] as const)
  );
  employees.forEach((emp) => pushEmployeeExpiryAlerts(generatedAlerts, emp, threshold, today, renewalCostByRecord));
  pushVehicleExpiryAlerts(generatedAlerts, vehiclesRes.data, threshold, today);
  pushVehicleRentalAlerts(generatedAlerts, rentalVehiclesRes.data, today);
  pushPlatformAccountAlerts(generatedAlerts, platformAccounts, today);
  // Inventory alerts disabled per user request
  pushPersistedDbAlerts(generatedAlerts, dbAlerts, today);
  pushAbscondedSummaryAlerts(generatedAlerts, absconded, today);
  generatedAlerts.sort((a, b) => a.daysLeft - b.daysLeft);
  return generatedAlerts;
}
