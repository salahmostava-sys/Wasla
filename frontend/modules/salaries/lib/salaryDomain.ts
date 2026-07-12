import {
  salaryService,
  type PricingRule,
  type SalaryPreviewPlatformBreakdown,
} from '@services/salaryService';
import { salaryDataService } from '@services/salaryDataService';
import { salaryDraftService } from '@services/salaryDraftService';
import {
  filterRetainedEmployeesForSalaryMonth,
  isExcludedSponsorshipStatus,
} from '@shared/lib/employeeVisibility';
import {
  getPrimaryPlatformActivityCount,
  hasPlatformActivity,
  isAdministrativeJobTitle,
  toCityArabicLabel,
} from '@modules/salaries/model/salaryUtils';
import { logError } from '@shared/lib/logger';
import { safeStr } from '@shared/lib/utils';
import type { SlipLanguage } from '@shared/lib/salarySlipTranslations';
import type {
  AppWithSchemeRow,
  OrderWithAppRow,
  PlatformSalaryMetric,
  PreparedSalaryState,
  SalaryDraftPatch,
  SalaryBaseContextData,
  SalaryRow,
  SalaryRowSnapshot,
  SchemeData,
} from '@modules/salaries/types/salary.types';
import type { WorkType } from '@shared/types/shifts';

// NOTE: calculatePlatformSalary and wasFixedSchemeAlreadyCalculated were removed.
// All salary calculation now lives exclusively in the Supabase RPC (preview_salary_for_month).
// Local fallback calculation was removed to ensure single source of truth.

type SavedSalaryRecord = {
  is_approved: boolean;
  net_salary: number;
  base_salary?: number | null;
  allowances?: number | null;
  attendance_deduction?: number | null;
  advance_deduction?: number | null;
  external_deduction?: number | null;
  manual_deduction?: number | null;
  payment_method?: string | null;
  sheet_snapshot?: SalaryRowSnapshot | null;
};

const isRecordObject = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

const normalizePaymentMethod = (
  value: unknown,
  fallback: SalaryRow['paymentMethod'],
): SalaryRow['paymentMethod'] => {
  if (value === 'bank' || value === 'cash') return value;
  return fallback;
};

const readSavedSnapshot = (value: unknown): Partial<SalaryRowSnapshot> | null =>
  isRecordObject(value) ? (value) : null;

const getFallbackSavedCustomDeductions = (manualDeduction: number): Record<string, number> => {
  if (manualDeduction <= 0) return {};
  return { 'saved___خصم يدوي محفوظ': manualDeduction };
};

export const buildSalaryDraftPatch = (row: SalaryRow): SalaryDraftPatch => ({
  platformOrders: row.platformOrders,
  incentives: row.incentives,
  sickAllowance: row.sickAllowance,
  violations: row.violations,
  customDeductions: row.customDeductions,
  transfer: row.transfer,
  advanceDeduction: row.advanceDeduction,
  externalDeduction: row.externalDeduction,
  platformIncome: row.platformIncome,
  // FIX Q5: engineBaseSalary is optional on SalaryRow but SalaryDraftPatch stores it.
  // Coerce undefined → 0 so we never write undefined into the DB JSONB column,
  // which would cause the field to round-trip as null and lose the user's value.
  engineBaseSalary: row.engineBaseSalary ?? 0,
  paymentMethod: row.paymentMethod,
});

export const buildSalaryRowSnapshot = (row: SalaryRow): SalaryRowSnapshot => ({
  bankAccount: row.bankAccount,
  hasIban: row.hasIban,
  paymentMethod: row.paymentMethod,
  platformOrders: row.platformOrders,
  platformSalaries: row.platformSalaries,
  platformMetrics: row.platformMetrics,
  incentives: row.incentives,
  sickAllowance: row.sickAllowance,
  violations: row.violations,
  customDeductions: row.customDeductions,
  transfer: row.transfer,
  advanceDeduction: row.advanceDeduction,
  externalDeduction: row.externalDeduction,
  platformIncome: row.platformIncome,
  engineBaseSalary: row.engineBaseSalary,
});

function arraysMatch(left: unknown[], right: unknown[]): boolean {
  if (left.length !== right.length) return false;
  for (let i = 0; i < left.length; i++) {
    if (!valuesMatch(left[i], right[i])) return false;
  }
  return true;
}

function objectsMatch(left: Record<string, unknown>, right: Record<string, unknown>): boolean {
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  if (leftKeys.length !== rightKeys.length) return false;
  for (const key of leftKeys) {
    if (!Object.hasOwn(right, key)) return false;
    if (!valuesMatch(left[key], right[key])) return false;
  }
  return true;
}

function valuesMatch(left: unknown, right: unknown): boolean {
  if (left === right) return true;
  if (!left && !right) return true;
  if (Array.isArray(left) && Array.isArray(right)) {
    return arraysMatch(left, right);
  }
  if (isRecordObject(left) && isRecordObject(right)) {
    return objectsMatch(left, right);
  }
  return false;
}

const rowDiffersFromDraft = (row: SalaryRow, patch: SalaryDraftPatch) =>
  Object.entries(patch).some(([key, value]) => {
    const rowValue = (row as unknown as Record<string, unknown>)[key];
    return !valuesMatch(rowValue, value);
  });

export const buildSavedMap = (savedRecords: Array<{ employee_id: string } & SavedSalaryRecord> | null | undefined) => {
  const savedMap: Record<string, SavedSalaryRecord> = {};
  savedRecords?.forEach((r) => {
    savedMap[r.employee_id] = {
      is_approved: r.is_approved,
      // FIX #5: Use ?? instead of || to correctly preserve legitimate 0 values.
      // || treats 0 as falsy, which would incorrectly replace a real 0 with 0 anyway
      // but masks future bugs where negative values or strings are involved.
      net_salary: Number(r.net_salary ?? 0),
      base_salary: Number(r.base_salary ?? 0),
      allowances: Number(r.allowances ?? 0),
      attendance_deduction: Number(r.attendance_deduction ?? 0),
      advance_deduction: Number(r.advance_deduction ?? 0),
      external_deduction: Number(r.external_deduction ?? 0),
      manual_deduction: Number(r.manual_deduction ?? 0),
      payment_method: r.payment_method ?? null,
      sheet_snapshot: r.sheet_snapshot ?? null,
    };
  });
  return savedMap;
};

type PreviewMapEntry = {
  base_salary: number;
  advance_deduction: number;
  external_deduction: number;
  total_shift_days: number;
  platform_breakdown: Record<string, PlatformSalaryMetric>;
};

const toWorkType = (value: unknown): WorkType => {
  if (value === 'shift' || value === 'hybrid') return value;
  return 'orders';
};

const normalizePreviewPlatformBreakdown = (value: unknown) => {
  const breakdown: Record<string, PlatformSalaryMetric> = {};
  if (!Array.isArray(value)) return breakdown;

  const typedValue = value as unknown as SalaryPreviewPlatformBreakdown[];
  typedValue.forEach((item) => {
    const appName = safeStr(item.app_name).trim();
    if (!appName) return;

    breakdown[appName] = {
      appName,
      workType: toWorkType(item.work_type),
      calculationMethod: item.calculation_method ?? null,
      ordersCount: Number(item.orders_count || 0),
      shiftDays: Number(item.shift_days || 0),
      salary: Number(item.earnings || 0),
    };
  });

  return breakdown;
};

export const buildPreviewMap = (previewData: Array<Record<string, unknown>> | null | undefined) => {
  const previewMap: Record<string, PreviewMapEntry> = {};
  (previewData || []).forEach((row) => {
    const employeeId = safeStr(row.employee_id);
    if (!employeeId) return;
    previewMap[employeeId] = {
      base_salary: Number(row.base_salary || 0),
      advance_deduction: Number(row.advance_deduction || 0),
      external_deduction: Number(row.external_deduction || 0),
      total_shift_days: Number(row.total_shift_days || 0),
      platform_breakdown: normalizePreviewPlatformBreakdown(row.platform_breakdown),
    };
  });
  return previewMap;
};

export const buildAttendanceDaysMap = (rows: Array<{ employee_id: string }> | null | undefined) => {
  const attendanceDaysMap: Record<string, number> = {};
  rows?.forEach((r) => {
    const employeeId = r.employee_id ? String(r.employee_id) : '';
    if (!employeeId) return;
    attendanceDaysMap[employeeId] = (attendanceDaysMap[employeeId] || 0) + 1;
  });
  return attendanceDaysMap;
};

export const buildFuelCostMap = (rows: Array<{ employee_id: string; fuel_cost: number | string }> | null | undefined) => {
  const fuelCostMap: Record<string, number> = {};
  rows?.forEach((r) => {
    const employeeId = r.employee_id ? String(r.employee_id) : '';
    if (!employeeId) return;
    // FIX #2: `Number(null)` → 0, but `Number('')` → 0 and `Number(undefined)` → NaN.
    // The `|| 0` after Number() catches NaN (since NaN is falsy) and propagates a safe 0
    // instead of silently corrupting the entire row's salary with NaN arithmetic.
    fuelCostMap[employeeId] = (fuelCostMap[employeeId] || 0) + (Number(r.fuel_cost) || 0);
  });
  return fuelCostMap;
};

const buildOrdersMap = (rows: OrderWithAppRow[] | null | undefined) => {
  const ordMap: Record<string, Record<string, number>> = {};
  (rows || []).forEach((r) => {
    const employeeId = r.employee_id ? String(r.employee_id) : '';
    if (!employeeId) return;
    // Supabase returns foreign key relationship as object (not array)
    const appName = r.apps?.name;
    if (!appName) return;
    if (!ordMap[employeeId]) ordMap[employeeId] = {};
    ordMap[employeeId][appName] = (ordMap[employeeId][appName] || 0) + r.orders_count;
  });
  return ordMap;
};

type SalaryMonthVisibilityEmployee = {
  id: string;
  job_title?: string | null;
  sponsorship_status?: string | null;
};

const hasMonthlyPlatformPreviewActivity = (
  employeeId: string,
  previewMap: Record<string, PreviewMapEntry>,
) =>
  Object.values(previewMap[employeeId]?.platform_breakdown || {}).some(
    (metric) => (metric.ordersCount || 0) > 0 || (metric.shiftDays || 0) > 0,
  );

export const shouldIncludeEmployeeInSalaryMonth = (
  employee: SalaryMonthVisibilityEmployee,
  ordMap: Record<string, Record<string, number>>,
  attendanceDaysMap: Record<string, number>,
  previewMap: Record<string, PreviewMapEntry>,
  savedEmployeeIds?: ReadonlySet<string>,
) => {
  const hasOrders = Object.values(ordMap[employee.id] || {}).some((count) => count > 0);
  const hasAttendance = (attendanceDaysMap[employee.id] || 0) > 0;
  const hasPreviewActivity = hasMonthlyPlatformPreviewActivity(employee.id, previewMap);
  const hasMonthlyActivity = hasOrders || hasAttendance || hasPreviewActivity;
  // Absconded/terminated: only show if they have ACTUAL activity (not just saved record)
  if (isExcludedSponsorshipStatus(employee.sponsorship_status ?? null)) {
    return hasMonthlyActivity;
  }
  if (hasMonthlyActivity) return true;
  if (savedEmployeeIds?.has(employee.id)) return true;
  return isAdministrativeJobTitle(employee.job_title ?? null);
};

const filterSalaryMonthEmployees = <T extends SalaryMonthVisibilityEmployee>(
  employees: readonly T[],
  ordMap: Record<string, Record<string, number>>,
  attendanceDaysMap: Record<string, number>,
  previewMap: Record<string, PreviewMapEntry>,
  savedEmployeeIds?: ReadonlySet<string>,
) =>
  employees.filter((employee) =>
    shouldIncludeEmployeeInSalaryMonth(
      employee,
      ordMap,
      attendanceDaysMap,
      previewMap,
      savedEmployeeIds,
    ),
  );

const resolveRowStatus = (
  saved: { is_approved: boolean; net_salary: number } | undefined,
  pendingInstallmentsCount: number,
  deductedInstallmentsCount: number
): SalaryRow['status'] => {
  if (!saved?.is_approved) return 'pending';
  if (deductedInstallmentsCount > 0 || pendingInstallmentsCount === 0) {
    return pendingInstallmentsCount === 0 ? 'paid' : 'approved';
  }
  return 'approved';
};

const buildEmpPlatformSchemeMap = (
  employeeIds: string[],
  platformNames: string[],
  appSchemeMap: Record<string, SchemeData | null>
) => {
  const out: Record<string, Record<string, SchemeData | null>> = {};
  for (const employeeId of employeeIds) {
    out[employeeId] = {};
    for (const platformName of platformNames) {
      out[employeeId][platformName] = appSchemeMap[platformName] ?? null;
    }
  }
  return out;
};

const buildAdvanceInstallmentMaps = async (
  selectedMonth: string,
  allAdvances: Array<{ id: string; employee_id: string }> | null | undefined
) => {
  const advInstIds: Record<string, string[]> = {};
  const deductedInstIds: Record<string, string[]> = {};
  const advRemainingMap: Record<string, number> = {};
  if (!allAdvances || allAdvances.length === 0) {
    return { advInstIds, deductedInstIds, advRemainingMap };
  }

  const advanceIds = allAdvances.map((a) => a.id);
  const advIdToEmpMap: Record<string, string> = {};
  for (const advance of allAdvances) advIdToEmpMap[advance.id] = advance.employee_id;

  // FIX C5: run both queries in parallel — independent, no ordering requirement
  // Use Promise.allSettled to prevent single-query failure from breaking everything
  const [advInstDataResult, allPendingInstsResult] = await Promise.allSettled([
    salaryDataService.getMonthInstallmentsForAdvances(selectedMonth, advanceIds),
    salaryDataService.getPendingInstallmentsForAdvances(advanceIds),
  ]);
  const advInstData = advInstDataResult.status === 'fulfilled' ? advInstDataResult.value : null;
  const allPendingInsts = allPendingInstsResult.status === 'fulfilled' ? allPendingInstsResult.value : null;

  allPendingInsts?.forEach((inst) => {
    const empId = advIdToEmpMap[inst.advance_id];
    if (!empId) return;
    advRemainingMap[empId] = (advRemainingMap[empId] || 0) + Number(inst.amount);
  });

  advInstData?.forEach((inst) => {
    const empId = advIdToEmpMap[inst.advance_id];
    if (!empId) return;
    if (inst.status === 'pending' || inst.status === 'deferred') {
      if (!advInstIds[empId]) advInstIds[empId] = [];
      advInstIds[empId].push(inst.id);
      return;
    }
    if (inst.status === 'deducted') {
      if (!deductedInstIds[empId]) deductedInstIds[empId] = [];
      deductedInstIds[empId].push(inst.id);
    }
  });

  return { advInstIds, deductedInstIds, advRemainingMap };
};

const resolvePlatformPreviewMetric = ({
  previewMetric,
}: {
  previewMetric?: PlatformSalaryMetric | null;
}): PlatformSalaryMetric | null => {
  return previewMetric ?? null;
};

function buildEmployeeSalaryRow(params: {
  emp: Record<string, unknown>;
  selectedMonth: string;
  platformNames: string[];
  appWorkTypeMap: Record<string, WorkType>;
  empOrders: Record<string, number>;
  attendanceDays: number;
  saved: SavedSalaryRecord | undefined;
  preview: PreviewMapEntry;
  pendingInstallmentIds: string[];
  deductedInstallmentIds: string[];
  advRemaining: number;
  fuelCost: number;
}): SalaryRow {
  const {
    emp, selectedMonth, platformNames, appWorkTypeMap, empOrders,
    attendanceDays, saved, preview, pendingInstallmentIds,
    deductedInstallmentIds, advRemaining, fuelCost
  } = params;
  const employeeId = String(emp.id);

  const platformOrders: Record<string, number> = {};
  const platformSalaries: Record<string, number> = {};
  const platformMetrics: Record<string, PlatformSalaryMetric> = {};
  for (const platformName of platformNames) {
    const previewMetric = resolvePlatformPreviewMetric({
      previewMetric: preview?.platform_breakdown[platformName],
    });
    if (previewMetric) {
      platformMetrics[platformName] = previewMetric;
      platformOrders[platformName] = getPrimaryPlatformActivityCount(previewMetric);
      // FIX #4: Store the raw float — do NOT round per-platform here.
      // Rounding at cell level causes banker's-rounding drift: sum of rounded values
      // may differ from the server's total. Round only in the display formatter.
      platformSalaries[platformName] = previewMetric.salary;
      continue;
    }

    const orders = empOrders[platformName] || 0;
    const fallbackMetric: PlatformSalaryMetric = {
      appName: platformName,
      workType: appWorkTypeMap[platformName] || 'orders',
      calculationMethod: null,
      ordersCount: orders,
      shiftDays: 0,
      salary: 0,
    };

    platformMetrics[platformName] = fallbackMetric;
    platformOrders[platformName] = getPrimaryPlatformActivityCount(fallbackMetric);
    platformSalaries[platformName] = 0;
  }

  const savedSnapshot = readSavedSnapshot(saved?.sheet_snapshot);
  const status = resolveRowStatus(saved, pendingInstallmentIds.length, deductedInstallmentIds.length);
  const hasIban = !!emp.iban;
  const rawCity = (emp.city as string | null | undefined) ?? null;
  const cityKey: 'makkah' | 'jeddah' | null = rawCity === 'makkah' || rawCity === 'jeddah' ? rawCity : null;
  const preferredLanguage = (emp.preferred_language as SlipLanguage | null | undefined) ?? 'ar';
  const phone = (emp.phone as string | null | undefined) ?? null;
  const workDays = Math.max(attendanceDays, preview.total_shift_days || 0);
  const fallbackPaymentMethod = hasIban ? 'bank' : 'cash';

  const baseRow: SalaryRow = {
    id: `${employeeId}-${selectedMonth}`,
    employeeId,
    // FIX #1: Use safeStr() instead of String() to guard against Supabase JOIN
    // returning an object (e.g. { id, name }) instead of a plain string.
    // String(object) → "[object Object]" which corrupts salary slips.
    employeeName: safeStr(emp.name),
    jobTitle: safeStr(emp.job_title, 'مندوب توصيل'),
    nationalId: safeStr(emp.national_id, '•'),
    city: toCityArabicLabel(rawCity),
    cityKey,
    bankAccount: emp.iban ? safeStr(emp.iban).slice(-6) : '',
    hasIban,
    paymentMethod: normalizePaymentMethod(saved?.payment_method, fallbackPaymentMethod),
    registeredApps: platformNames.filter((platformName) => hasPlatformActivity(platformMetrics[platformName])),
    platformOrders,
    platformSalaries,
    platformMetrics,
    incentives: Number(saved?.allowances || 0),
    sickAllowance: 0,
    violations: Number(saved?.attendance_deduction || 0),
    customDeductions: getFallbackSavedCustomDeductions(Number(saved?.manual_deduction || 0)),
    transfer: 0,
    advanceDeduction: Number(saved?.advance_deduction ?? preview.advance_deduction ?? 0),
    advanceInstallmentIds: pendingInstallmentIds,
    advanceRemaining: advRemaining,
    externalDeduction: Number(saved?.external_deduction ?? preview.external_deduction ?? 0),
    status,
    preferredLanguage,
    phone,
    workDays,
    fuelCost,
    platformIncome: 0,
    engineBaseSalary: Number(saved?.base_salary ?? preview.base_salary ?? 0),
    preferEngineBaseSalary: !!saved && !savedSnapshot && Number(saved.base_salary || 0) > 0,
  };

  const mergedRow = savedSnapshot
    ? {
        ...baseRow,
        ...savedSnapshot,
        paymentMethod: normalizePaymentMethod(savedSnapshot.paymentMethod, baseRow.paymentMethod),
        status,
        preferredLanguage,
        phone,
        city: toCityArabicLabel(rawCity),
        cityKey,
        advanceInstallmentIds: pendingInstallmentIds,
        advanceRemaining: advRemaining,
        workDays,
        fuelCost,
        preferEngineBaseSalary: false,
      }
    : baseRow;

  mergedRow.registeredApps = platformNames.filter((platformName) =>
    hasPlatformActivity(mergedRow.platformMetrics[platformName]),
  );

  return mergedRow;
}

export const buildSalaryRows = ({
  employees,
  selectedMonth,
  platformNames,
  appNameToId: _appNameToId,
  appWorkTypeMap,
  rulesMap: _rulesMap,
  appSchemeMap: _appSchemeMap,
  ordMap,
  attendanceDaysMap,
  savedMap,
  previewMap,
  advInstIds,
  deductedInstIds,
  advRemainingMap,
  fuelCostMap,
}: {
  employees: Array<Record<string, unknown>>;
  selectedMonth: string;
  platformNames: string[];
  appNameToId: Record<string, string>;
  appWorkTypeMap: Record<string, WorkType>;
  rulesMap: Record<string, PricingRule[]>;
  appSchemeMap: Record<string, SchemeData | null>;
  ordMap: Record<string, Record<string, number>>;
  attendanceDaysMap: Record<string, number>;
  savedMap: Record<string, SavedSalaryRecord>;
  previewMap: Record<string, PreviewMapEntry>;
  advInstIds: Record<string, string[]>;
  deductedInstIds: Record<string, string[]>;
  advRemainingMap: Record<string, number>;
  fuelCostMap: Record<string, number>;
}) => {
  const newRows: SalaryRow[] = [];
  for (const emp of employees) {
    const employeeId = String(emp.id);
    const empOrders = ordMap[employeeId] || {};
    const attendanceDays = attendanceDaysMap[employeeId] || 0;
    const preview = previewMap[employeeId] ?? {
      base_salary: 0,
      advance_deduction: 0,
      external_deduction: 0,
      total_shift_days: 0,
      platform_breakdown: {},
    };

    newRows.push(
      buildEmployeeSalaryRow({
        emp,
        selectedMonth,
        platformNames,
        appWorkTypeMap,
        empOrders,
        attendanceDays,
        saved: savedMap[employeeId],
        preview,
        pendingInstallmentIds: advInstIds[employeeId] || [],
        deductedInstallmentIds: deductedInstIds[employeeId] || [],
        advRemaining: advRemainingMap[employeeId] || 0,
        fuelCost: fuelCostMap[employeeId] || 0,
      })
    );
  }

  return newRows;
};

const readLocalSalaryDraftMap = (storageKey?: string): Record<string, SalaryDraftPatch> => {
  if (!storageKey || typeof sessionStorage === 'undefined') return {};
  try {
    const raw = sessionStorage.getItem(storageKey);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || parsed === null) return {};
    const typedParsed = parsed as Record<string, unknown>;
    const result: Record<string, SalaryDraftPatch> = {};
    for (const [key, value] of Object.entries(typedParsed)) {
      if (isRecordObject(value)) {
        result[key] = value as unknown as SalaryDraftPatch;
      }
    }
    return result;
  } catch (e) {
    logError('[Salaries] Failed to read drafts from sessionStorage', e, { level: 'warn' });
    return {};
  }
};

const hydrateRowsWithDraft = async (
  rows: SalaryRow[],
  monthYear: string,
  storageKey?: string,
) => {
  const localDraftMap = readLocalSalaryDraftMap(storageKey);
  const applyDraftPatch = (row: SalaryRow, patch?: SalaryDraftPatch) => {
    if (!patch) return row;
    const normalizedPatch = {
      ...buildSalaryDraftPatch(row),
      ...patch,
    };
    if (!rowDiffersFromDraft(row, normalizedPatch)) {
      return row;
    }
    return { ...row, ...normalizedPatch, isDirty: true };
  };

  try {
    const serverDraftMap = await salaryDraftService.getDraftsForMonth(monthYear);
    return rows.map((row) => applyDraftPatch(row, serverDraftMap[row.id] ?? localDraftMap[row.id]));
  } catch (e) {
    logError('[Salaries] Failed to load drafts from server', e, { level: 'warn' });
    return rows.map((row) => applyDraftPatch(row, localDraftMap[row.id]));
  }
};

const buildAppMaps = (appsWithScheme: AppWithSchemeRow[] | null | undefined) => {
  const appSchemeMap: Record<string, SchemeData | null> = {};
  const appNameToId: Record<string, string> = {};
  const appWorkTypeMap: Record<string, WorkType> = {};
  (appsWithScheme || []).forEach((app) => {
    appSchemeMap[app.name] = app.salary_schemes ?? null;
    appNameToId[app.name] = app.id;
    appWorkTypeMap[app.name] = toWorkType(app.work_type);
  });
  return { appSchemeMap, appNameToId, appWorkTypeMap };
};

/**
 * Fetches pricing rules for all apps in a single DB query.
 * Previously made N separate queries (one per app) — now one bulk query.
 */
export const fetchPricingRulesMap = async (appNameToId: Record<string, string>) => {
  const appIds = Object.values(appNameToId);
  if (appIds.length === 0) return {};
  // Single query instead of Promise.all with N individual calls
  return await salaryService.getPricingRulesForApps(appIds);
};

export const getManualDeductionTotal = (row: SalaryRow) =>
  Object.values(row.customDeductions || {}).reduce((sum, value) => sum + value, 0);

export const getTotalDeductions = (row: SalaryRow) =>
  row.advanceDeduction + row.externalDeduction + row.violations + getManualDeductionTotal(row);

export const buildPlatformSetupWarnings = ({
  apps,
  rulesMap,
  rows,
}: {
  apps: AppWithSchemeRow[];
  rulesMap: Record<string, PricingRule[]>;
  rows: SalaryRow[];
}) => {
  const relevantAppNames = new Set(
    rows.flatMap((row) => row.registeredApps)
  );

  if (relevantAppNames.size === 0) {
    return {
      appsWithoutPricingRules: [],
      appsWithoutScheme: [],
    };
  }

  const relevantApps = apps.filter((app) => relevantAppNames.has(app.name));

  return {
    appsWithoutPricingRules: relevantApps
      .filter((app) => {
        // Only hybrid needs pricing rules; shift uses salary_schemes.monthly_amount directly
        if (app.work_type !== 'hybrid') return false;
        return !rulesMap[app.id] || rulesMap[app.id].length === 0;
      })
      .map((app) => app.name),
    appsWithoutScheme: relevantApps
      .filter((app) => {
        // All platform types need a scheme (orders for tiers, shift for monthly_amount)
        if (app.scheme_id) return false;
        return !app.salary_schemes?.id;
      })
      .map((app) => app.name),
  };
};

export async function prepareSalaryState({
  salaryBaseContext,
  selectedMonth,
  activeEmployeeIdsInMonth,
  salariesDraftKey: _salariesDraftKey,
}: {
  salaryBaseContext: SalaryBaseContextData;
  selectedMonth: string;
  activeEmployeeIdsInMonth: ReadonlySet<string> | undefined;
  salariesDraftKey?: string;
}): Promise<PreparedSalaryState> {
  const { monthlyContext, previewData } = salaryBaseContext;
  const { employees: empRows, orders, appsWithSchemeRes, attendanceRows, fuelRes, savedRecords, allAdvances } = monthlyContext;
  const savedMap = buildSavedMap(
    savedRecords as Array<{ employee_id: string } & SavedSalaryRecord> | null | undefined,
  );
  const previewMap = buildPreviewMap((previewData || []) as Array<Record<string, unknown>>);
  // FIX #10: wrap subsidiary async calls in try/catch so a failure in
  // advance installments doesn't crash the entire salary page.
  let advInstIds: Record<string, string[]> = {};
  let deductedInstIds: Record<string, string[]> = {};
  let advRemainingMap: Record<string, number> = {};
  try {
    const advResult = await buildAdvanceInstallmentMaps(
      selectedMonth,
      (allAdvances as Array<{ id: string; employee_id: string }> | null | undefined) || []
    );
    advInstIds = advResult.advInstIds;
    deductedInstIds = advResult.deductedInstIds;
    advRemainingMap = advResult.advRemainingMap;
  } catch (e) {
    logError('[Salaries] Failed to load advance installments — continuing without advance data', e, { level: 'warn' });
  }

  const monthStartIso = `${selectedMonth}-01`;
  const attendanceDaysMap = buildAttendanceDaysMap(attendanceRows as Array<{ employee_id: string }> | null | undefined);
  const fuelCostMap = buildFuelCostMap(fuelRes as Array<{ employee_id: string; fuel_cost: number | string }> | null | undefined);
  const ordMap = buildOrdersMap(orders as OrderWithAppRow[] | null);
  const savedEmployeeIds = new Set(Object.keys(savedMap));
  const visibleEmployees = filterRetainedEmployeesForSalaryMonth(
    (empRows || []) as {
      id: string;
      status?: string | null;
      job_title?: string | null;
      sponsorship_status?: string | null;
      probation_end_date?: string | null;
    }[],
    monthStartIso,
    activeEmployeeIdsInMonth
  );
  const employees = filterSalaryMonthEmployees(
    visibleEmployees,
    ordMap,
    attendanceDaysMap,
    previewMap,
    savedEmployeeIds,
  );
  const appsFromApi = (appsWithSchemeRes as AppWithSchemeRow[] | null) || [];
  const { appSchemeMap, appNameToId, appWorkTypeMap } = buildAppMaps(appsFromApi);
  const platformNames = appsFromApi.map((a) => a.name);
  const rulesMap = await fetchPricingRulesMap(appNameToId);
  const builtEmpPlatformScheme = buildEmpPlatformSchemeMap(employees.map((emp) => emp.id), platformNames, appSchemeMap);
  const newRows = buildSalaryRows({
    employees: employees,
    selectedMonth,
    platformNames,
    appNameToId,
    appWorkTypeMap,
    rulesMap,
    appSchemeMap,
    ordMap,
    attendanceDaysMap,
    savedMap,
    previewMap,
    advInstIds,
    deductedInstIds,
    advRemainingMap,
    fuelCostMap,
  });
  const hydratedRows = await hydrateRowsWithDraft(newRows, selectedMonth, _salariesDraftKey);
  const { appsWithoutPricingRules, appsWithoutScheme } = buildPlatformSetupWarnings({
    apps: appsFromApi,
    rulesMap,
    rows: hydratedRows,
  });

  return {
    appNameToId,
    rulesMap,
    appsWithoutPricingRules,
    appsWithoutScheme,
    builtEmpPlatformScheme,
    hydratedRows,
  };
}
