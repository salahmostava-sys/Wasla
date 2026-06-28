import { differenceInDays, parseISO } from 'date-fns';
import type { BranchKey } from '@shared/components/table/GlobalTableFilters';
import {
  normalizeEmployeeCities,
  normalizeEmployeeCityValue,
} from '@modules/employees/model/employeeCity';

export type Employee = {
  id: string;
  name: string;
  name_en?: string | null;
  job_title?: string | null;
  phone?: string | null;
  email?: string | null;
  national_id?: string | null;
  bank_account_number?: string | null;
  iban?: string | null;
  city?: string | null;
  cities?: string[] | null;
  join_date?: string | null;
  birth_date?: string | null;
  residency_expiry?: string | null;
  health_insurance_expiry?: string | null;
  probation_end_date?: string | null;
  license_status?: string | null;
  license_expiry?: string | null;
  sponsorship_status?: string | null;
  id_photo_url?: string | null;
  iqama_photo_url?: string | null;
  license_photo_url?: string | null;
  personal_photo_url?: string | null;
  status: string;
  salary_type: string;
  base_salary: number;
  nationality?: string | null;
  preferred_language?: string | null;
  commercial_record?: string | null;
  platform_apps?: Array<{ id: string; name: string; brand_color?: string | null }> | null;
};

export type SortDir = 'asc' | 'desc' | null;

export const parseBranchFilter = (branch: BranchKey): Exclude<BranchKey, 'all'> | undefined => {
  if (branch === 'makkah' || branch === 'jeddah') return branch;
  return undefined;
};

export const getEmployeeFieldValue = (employee: Employee, field: string): unknown => {
  return (employee as Record<string, unknown>)[field];
};

function safeText(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return '';
  }
}

export const getEmployeeCities = (employee: Pick<Employee, 'cities' | 'city'>): string[] =>
  normalizeEmployeeCities(employee.cities ?? [], employee.city);

export const getEmployeePrimaryCity = (employee: Pick<Employee, 'cities' | 'city'>): string | null =>
  getEmployeeCities(employee)[0] ?? normalizeEmployeeCityValue(employee.city);

const calcResidency = (expiry?: string | null) => {
  if (!expiry) return { days: null as number | null, status: 'unknown' as const };
  const days = differenceInDays(parseISO(expiry), new Date());
  const status = days >= 0 ? 'valid' : 'expired';
  return { days, status };
};

const matchesText = (source: string | null | undefined, filterValue: string): boolean =>
  (source || '').toLowerCase().includes(filterValue.toLowerCase());

const matchesExact = (source: string | null | undefined, filterValue: string): boolean =>
  (source || '') === filterValue;

/** Supports exact date or range "from..to" (either side optional). */
const matchesDate = (source: string | null | undefined, filterValue: string): boolean => {
  const dateStr = (source || '').slice(0, 10);
  if (!dateStr) return false;
  if (filterValue.includes('..')) {
    const [from, to] = filterValue.split('..');
    if (from && dateStr < from) return false;
    if (to && dateStr > to) return false;
    return true;
  }
  return dateStr === filterValue;
};

function matchesResidencyFilter(employee: Employee, filterValue: string): boolean {
  const res = calcResidency(employee.residency_expiry);
  if (filterValue === 'valid') return res.status === 'valid';
  if (filterValue === 'expired') return res.status === 'expired';
  if (filterValue === 'urgent') return res.days !== null && res.days < 30;
  return true;
}

function matchesMultiExact(source: string | null | undefined, filterValue: string): boolean {
  const parts = filterValue
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length === 0) return true;
  return parts.includes(source || '');
}

function matchesEmployeeCities(employee: Employee, filterValue: string): boolean {
  const parts = filterValue
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length === 0) return true;

  const employeeCities = getEmployeeCities(employee);
  return employeeCities.some((city) => parts.includes(city));
}

function matchesPlatformApps(employee: Employee, filterValue: string): boolean {
  const parts = filterValue
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length === 0) return true;

  const appIds = (employee.platform_apps ?? []).map((app) => app.id);
  return appIds.some((appId) => parts.includes(appId));
}

function matchesColumnFilter(employee: Employee, key: string, filterValue: string): boolean {
  if (!filterValue) return true;
  const predicates: Record<string, () => boolean> = {
    name: () => matchesText(employee.name, filterValue),
    name_en: () => matchesText(employee.name_en, filterValue),
    national_id: () => (employee.national_id ?? '').includes(filterValue),
    phone: () => (employee.phone ?? '').includes(filterValue),
    job_title: () => matchesText(employee.job_title, filterValue),
    city: () => matchesEmployeeCities(employee, filterValue),
    nationality: () => matchesText(employee.nationality, filterValue),
    platform_apps: () => matchesPlatformApps(employee, filterValue),
    commercial_record: () => matchesText(employee.commercial_record, filterValue),
    sponsorship_status: () => matchesMultiExact(employee.sponsorship_status, filterValue),
    license_status: () => matchesExact(employee.license_status, filterValue),
    status: () => matchesExact(employee.status, filterValue),
    residency_status: () => matchesResidencyFilter(employee, filterValue),
    join_date: () => matchesDate(employee.join_date, filterValue),
    birth_date: () => matchesDate(employee.birth_date, filterValue),
    probation_end_date: () => matchesDate(employee.probation_end_date, filterValue),
    residency_combined: () => matchesDate(employee.residency_expiry, filterValue),
    health_insurance_expiry: () => matchesDate(employee.health_insurance_expiry, filterValue),
    license_expiry: () => matchesDate(employee.license_expiry, filterValue),
    email: () => matchesText(employee.email, filterValue),
    bank_account_number: () => (employee.bank_account_number ?? '').includes(filterValue),
  };
  const predicate = predicates[key];
  if (!predicate) return true;
  return predicate();
}

export function applyEmployeeFilters(rows: Employee[], colFilters: Record<string, string>): Employee[] {
  return rows.filter((employee) => {
    for (const [key, value] of Object.entries(colFilters)) {
      if (!matchesColumnFilter(employee, key, value)) return false;
    }
    return true;
  });
}

export function sortEmployees(rows: Employee[], sortField: string | null, sortDir: SortDir): Employee[] {
  if (!sortField || !sortDir) return rows;
  return [...rows].sort((a, b) => { // NOSONAR
    // 1. Force inactive/ended/absconded/terminated to the bottom
    const isAInactive = a.status !== 'active' || a.sponsorship_status === 'absconded' || a.sponsorship_status === 'terminated';
    const isBInactive = b.status !== 'active' || b.sponsorship_status === 'absconded' || b.sponsorship_status === 'terminated';

    if (isAInactive && !isBInactive) return 1; // A to bottom
    if (!isAInactive && isBInactive) return -1; // B to bottom

    // 2. Normal sort logic
    const [va, vb]: [string | number, string | number] = sortField === 'days_residency'
      ? [
        a.residency_expiry ? differenceInDays(parseISO(a.residency_expiry), new Date()) : -9999,
        b.residency_expiry ? differenceInDays(parseISO(b.residency_expiry), new Date()) : -9999,
      ]
      : (() => {
        const aVal = getEmployeeFieldValue(a, sortField);
        const bVal = getEmployeeFieldValue(b, sortField);
        return [
          typeof aVal === 'number' ? aVal : safeText(aVal),
          typeof bVal === 'number' ? bVal : safeText(bVal),
        ];
      })();
    if (va < vb) return sortDir === 'asc' ? -1 : 1;
    if (va > vb) return sortDir === 'asc' ? 1 : -1;
    return 0;
  });
}
