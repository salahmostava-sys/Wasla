/**
 * Employee Visibility Module
 *
 * Controls which employees appear in lists, attendance rosters, and salary pages.
 *
 * Rules:
 * - Absconded/terminated employees are hidden by default.
 * - They remain visible if they had activity (orders/attendance) in the target month.
 * - The `probation_end_date` field doubles as the effective exit date for absconded/terminated.
 *
 * Used by: Employees page, Orders page, Salaries page, Attendance page.
 */
export const EXCLUDED_SPONSORSHIP_STATUSES = ['absconded', 'terminated'] as const;
export type ExcludedSponsorshipStatus = (typeof EXCLUDED_SPONSORSHIP_STATUSES)[number];

export type EmployeeLike = {
  id: string;
  status?: string | null;
  sponsorship_status?: string | null;
  probation_end_date?: string | null;
  job_title?: string | null;
};

export function isExcludedSponsorshipStatus(status: string | null | undefined): boolean {
  if (!status) return false;
  return (EXCLUDED_SPONSORSHIP_STATUSES as readonly string[]).includes(status);
}

const INVENTORY_KEYWORDS = ['مخزون', 'مستودع', 'inventory', 'warehouse'];

export function isInventoryJobTitle(jobTitle: string | null | undefined): boolean {
  if (!jobTitle) return false;
  const normalized = jobTitle.toLowerCase();
  return INVENTORY_KEYWORDS.some((kw) => normalized.includes(kw));
}

export function isEmployeeExcluded(employee: EmployeeLike): boolean {
  return (
    employee.status === 'inactive' ||
    employee.status === 'ended' ||
    isExcludedSponsorshipStatus(employee.sponsorship_status ?? null) ||
    isInventoryJobTitle(employee.job_title ?? null)
  );
}

/**
 * Visibility rule:
 * - Hide absconded/terminated/inactive by default.
 * - Keep visible if employee has activity in the target month (activeEmployeeIdsInMonth contains id).
 */
export function isEmployeeVisibleInMonth(
  employee: EmployeeLike,
  activeEmployeeIdsInMonth: ReadonlySet<string> | null | undefined
): boolean {
  // STRICT FILTERING: Never show excluded employees regardless of historical activity.
  if (isEmployeeExcluded(employee)) return false;
  
  // If they are not excluded (i.e. they are active), they should always be visible
  // so new employees can have orders assigned to them.
  return true;
}

export function filterVisibleEmployeesInMonth<T extends EmployeeLike>(
  employees: readonly T[],
  activeEmployeeIdsInMonth: ReadonlySet<string> | null | undefined
): T[] {
  return employees.filter((e) => isEmployeeVisibleInMonth(e, activeEmployeeIdsInMonth));
}

export function isEmployeeRetainedForMonth<T extends EmployeeLike>(
  employee: T,
  activeEmployeeIdsInMonth: ReadonlySet<string> | null | undefined
): boolean {
  if (isEmployeeExcluded(employee)) return false;
  if (employee.status === 'active') return true;
  if (activeEmployeeIdsInMonth === undefined) return false;
  return !!activeEmployeeIdsInMonth?.has(employee.id);
}

export function filterRetainedEmployeesForMonth<T extends EmployeeLike>(
  employees: readonly T[],
  activeEmployeeIdsInMonth: ReadonlySet<string> | null | undefined
): T[] {
  return employees.filter((e) => isEmployeeRetainedForMonth(e, activeEmployeeIdsInMonth));
}

/**
 * الرواتب الشهرية: المستبعد من الهروب/إنهاء الخدمة يُدرَج في الشهر إذا كان ما زال ضمن
 * نافذة ذلك الشهر حسب `probation_end_date` (انظر `isAttendanceRosterVisibleInMonth`)،
 * دون اشتراط وجود طلبات أو حضور. يبقى النشاط الشهري كدعم عند حالات الحواف.
 */
export function isEmployeeVisibleForSalaryMonth<T extends EmployeeLike>(
  employee: T,
  monthStartIso: string,
  activeEmployeeIdsInMonth: ReadonlySet<string> | null | undefined
): boolean {
  // STRICT FILTERING: Hide absconded/terminated/inventory completely
  if (isEmployeeExcluded(employee)) return false;
  
  if (activeEmployeeIdsInMonth === undefined) return true;
  if (isAttendanceRosterVisibleInMonth(employee, monthStartIso)) return true;
  return !!activeEmployeeIdsInMonth?.has(employee.id);
}

export function filterVisibleEmployeesForSalaryMonth<T extends EmployeeLike>(
  employees: readonly T[],
  monthStartIso: string,
  activeEmployeeIdsInMonth: ReadonlySet<string> | null | undefined
): T[] {
  return employees.filter((e) => isEmployeeVisibleForSalaryMonth(e, monthStartIso, activeEmployeeIdsInMonth));
}

export function filterRetainedEmployeesForSalaryMonth<T extends EmployeeLike>(
  employees: readonly T[],
  monthStartIso: string,
  activeEmployeeIdsInMonth: ReadonlySet<string> | null | undefined
): T[] {
  return employees.filter(
    (e) =>
      isEmployeeRetainedForMonth(e, activeEmployeeIdsInMonth) &&
      isEmployeeVisibleForSalaryMonth(e, monthStartIso, activeEmployeeIdsInMonth),
  );
}

function toDateOnlyIso(input: string | null | undefined): string | null {
  if (!input) return null;
  const trimmed = input.trim();
  if (!trimmed) return null;
  if (trimmed.length >= 10) return trimmed.slice(0, 10);
  return null;
}

/**
 * Unified operational visibility:
 * - Any non-excluded sponsorship status => visible.
 * - absconded/terminated => hidden once effective date starts.
 * - Effective date uses `probation_end_date` (existing business field).
 * - If effective date is missing/invalid, hide immediately (safe default).
 */
export function isOperationallyVisibleEmployee(
  employee: Pick<EmployeeLike, 'sponsorship_status' | 'probation_end_date' | 'job_title' | 'status'> & { id?: string },
  asOfDate: Date = new Date()
): boolean {
  if (isInventoryJobTitle(employee.job_title ?? null) || employee.status === 'inactive' || employee.status === 'ended') return false;
  if (!isExcludedSponsorshipStatus(employee.sponsorship_status ?? null)) return true;
  const effectiveDateIso = toDateOnlyIso(employee.probation_end_date ?? null);
  if (!effectiveDateIso) return false;
  const todayIso = asOfDate.toISOString().slice(0, 10);
  return todayIso < effectiveDateIso;
}

export function filterOperationallyVisibleEmployees<T extends EmployeeLike>(
  employees: readonly T[],
  asOfDate: Date = new Date()
): T[] {
  return employees.filter((e) => isOperationallyVisibleEmployee(e, asOfDate));
}

/**
 * قائمة الحضور اليومية: يظهر المندوب في هروب/إنهاء خدمة حتى يُحدَّد تاريخ فعّال في `probation_end_date`.
 * من تاريخ الهروب/إنهاء الخدمة (شامل) لا يظهر في الحضور.
 */
export function isAttendanceRosterVisibleOnDate(
  employee: EmployeeLike,
  asOfDate: Date
): boolean {
  if (isInventoryJobTitle(employee.job_title ?? null) || employee.status === 'inactive' || employee.status === 'ended') return false;
  if (!isExcludedSponsorshipStatus(employee.sponsorship_status ?? null)) return true;
  const effectiveDateIso = toDateOnlyIso(employee.probation_end_date ?? null);
  // STRICT: no date = hide immediately (safe default)
  if (!effectiveDateIso) return false;
  const asOfIso = asOfDate.toISOString().slice(0, 10);
  return asOfIso < effectiveDateIso;
}

export function filterAttendanceRosterEmployees<T extends EmployeeLike>(
  employees: readonly T[],
  asOfDate: Date
): T[] {
  return employees.filter((e) => isAttendanceRosterVisibleOnDate(e, asOfDate));
}

/**
 * السجل الشهري: يُدرَج المندوب إذا كان لا يزال ضمن القائمة التشغيلية في أي يوم داخل الشهر
 * (أي تاريخ الخروج بعد أول يوم من الشهر).
 */
export function isAttendanceRosterVisibleInMonth(
  employee: EmployeeLike,
  monthStartIso: string
): boolean {
  if (isInventoryJobTitle(employee.job_title ?? null) || employee.status === 'inactive' || employee.status === 'ended') return false;
  if (!isExcludedSponsorshipStatus(employee.sponsorship_status ?? null)) return true;
  const effectiveDateIso = toDateOnlyIso(employee.probation_end_date ?? null);
  // STRICT: no date = hide immediately (safe default)
  if (!effectiveDateIso) return false;
  /** يُستبعد من الشهر فقط إذا انتهت الخدمة قبل أول يوم من الشهر؛ من ينتهي داخل الشهر يبقى لترحيل الطلبات للرواتب */
  return effectiveDateIso >= monthStartIso;
}

export function filterEmployeesForAttendanceMonth<T extends EmployeeLike>(
  employees: readonly T[],
  monthStartIso: string
): T[] {
  return employees.filter((e) => isAttendanceRosterVisibleInMonth(e, monthStartIso));
}

