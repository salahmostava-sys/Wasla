import type React from 'react';
import { getErrorMessage } from '@services/serviceError';
import { isAdministrativeJobTitle } from '@modules/salaries/model/salaryUtils';

/* ─── Row Types ──────────────────────────────────────────────── */

export type DailyRow = {
  id: string;
  employee_id: string;
  date: string;
  km_total: number;
  fuel_cost: number;
  notes: string | null;
  employee?: { name: string; personal_photo_url?: string | null };
};

export type MonthlyRow = {
  employee_id: string;
  employee_name: string;
  personal_photo_url?: string | null;
  km_total: number;
  fuel_cost: number;
  orders_count: number;
  vehicle?: { plate_number: string; type: string; brand?: string | null; model?: string | null } | null;
  daily_count: number;
};

export type Employee = { id: string; name: string; personal_photo_url?: string | null; status?: string | null; sponsorship_status?: string | null; probation_end_date?: string | null; job_title?: string | null; vehicle?: { plate_number: string; type: string; brand?: string | null; model?: string | null } | null };
export type AppRow = { id: string; name: string };
export type DailyMileageResponseRow = DailyRow & { employees?: { name: string; personal_photo_url?: string | null } };
export type ImportStep = 1 | 2 | 3;
export type FuelBranch = 'makkah' | 'jeddah';

export type ImportRow = {
  row_key: string;
  raw_name: string;
  km_total: number;
  fuel_cost: number;
  notes?: string;
  matched_employee?: Employee | null;
  manual_employee_id?: string;
};

/* ─── Helper Types ───────────────────────────────────────────── */

export const MONTHLY_SKELETON_ROWS = ['m1', 'm2', 'm3', 'm4', 'm5'];

export type MonthlyOrderRow = { employee_id: string; orders_count: number };
export type VehicleAssignmentRow = { employee_id: string; vehicles: { plate_number: string; type: string; brand: string; model: string } | null };

export type DailyMileageAggSource = {
  employee_id: string;
  km_total: number;
  fuel_cost: number;
  employees: { name: string; personal_photo_url: string | null } | null;
};

export type MonthlyAgg = { km: number; fuel: number; count: number; name: string; photo?: string | null };

/* ─── Utility Functions ──────────────────────────────────────── */

export const getErrorMessageOrFallback = (err: unknown, fallback: string): string =>
  getErrorMessage(err, fallback);

export const buildOrdersMap = (rows: MonthlyOrderRow[]): Record<string, number> => {
  const map: Record<string, number> = {};
  rows.forEach((row) => {
    map[row.employee_id] = (map[row.employee_id] || 0) + (Number(row.orders_count) || 0);
  });
  return map;
};

export const buildVehicleMap = (
  rows: VehicleAssignmentRow[]
): Record<string, { plate_number: string; type: string; brand: string; model: string }> => {
  const map: Record<string, { plate_number: string; type: string; brand: string; model: string }> = {};
  rows.forEach((row) => {
    if (map[row.employee_id] || !row.vehicles) return;
    map[row.employee_id] = row.vehicles;
  });
  return map;
};

export const buildMonthlyAggMap = (
  rows: DailyMileageAggSource[],
  employeeIdsOnPlatform: Set<string> | null
): Record<string, MonthlyAgg> => {
  const aggMap: Record<string, MonthlyAgg> = {};
  rows.forEach((row) => {
    if (employeeIdsOnPlatform && !employeeIdsOnPlatform.has(row.employee_id)) return;
    const emp = row.employees;
    if (!aggMap[row.employee_id]) {
      aggMap[row.employee_id] = { km: 0, fuel: 0, count: 0, name: emp?.name ?? '', photo: emp?.personal_photo_url };
    }
    aggMap[row.employee_id].km += Number(row.km_total) || 0;
    aggMap[row.employee_id].fuel += Number(row.fuel_cost) || 0;
    aggMap[row.employee_id].count += 1;
  });
  return aggMap;
};

export const buildEmployeeIndex = (employees: Employee[]): Record<string, Employee> => {
  const index: Record<string, Employee> = {};
  employees.forEach((employee) => { index[employee.id] = employee; });
  return index;
};

export const buildMonthlyRows = (
  aggMap: Record<string, MonthlyAgg>,
  ordersMap: Record<string, number>,
  vehicleMap: Record<string, { plate_number: string; type: string; brand?: string | null; model?: string | null }>,
  baseEmployees: Employee[],
  allEmployees: Employee[],
  employeeIdsOnPlatform: Set<string> | null
): MonthlyRow[] => {
  const employeeById = buildEmployeeIndex(allEmployees);
  const isAdminEmployeeId = (id: string): boolean => isAdministrativeJobTitle(employeeById[id]?.job_title);
  const allEmployeeIds = new Set<string>([
    ...baseEmployees
      .filter(e => !isAdministrativeJobTitle(e.job_title))
      .filter(e => !employeeIdsOnPlatform || employeeIdsOnPlatform.has(e.id))
      .map(e => e.id),
    ...Object.keys(aggMap).filter((id) => !isAdminEmployeeId(id)),
    ...Object.keys(ordersMap).filter((id) => (ordersMap[id] || 0) > 0 && !isAdminEmployeeId(id)),
  ]);
  return Array.from(allEmployeeIds).map((employeeId) => {
    const agg = aggMap[employeeId];
    const employee = employeeById[employeeId];
    return {
      employee_id: employeeId,
      employee_name: agg?.name || employee?.name || '—',
      personal_photo_url: agg?.photo || employee?.personal_photo_url || null,
      km_total: agg?.km || 0,
      fuel_cost: agg?.fuel || 0,
      orders_count: ordersMap[employeeId] || 0,
      vehicle: vehicleMap[employeeId] || null,
      daily_count: agg?.count || 0,
    };
  }).sort((a, b) => a.employee_name.localeCompare(b.employee_name, 'ar'));
};

export const mapDailyRows = (rows: DailyMileageResponseRow[]): DailyRow[] =>
  rows.map((row) => ({
    ...row,
    employee: row.employees ? { id: row.employee_id, ...row.employees } : undefined,
  }));

export const applyDailyFilters = (
  rows: DailyRow[],
  selectedEmployee: string,
  employeeIdsOnPlatform: Set<string> | null
): DailyRow[] => {
  if (selectedEmployee && selectedEmployee !== '_all_') {
    return rows.filter((row) => row.employee_id === selectedEmployee);
  }
  if (!employeeIdsOnPlatform) return rows;
  const ids = Array.from(employeeIdsOnPlatform);
  if (ids.length === 0) return [];
  return rows.filter((row) => ids.includes(row.employee_id));
};

export const toCellString = (value: unknown): string => {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return '';
};

/* ─── Save Helper ────────────────────────────────────────────── */

export async function saveVehicleMileageDaily(
  payload: { employee_id: string; date: string; km_total: number; fuel_cost: number; notes: string | null },
  upsertDailyMileage: (payload: { employee_id: string; date: string; km_total: number; fuel_cost: number; notes: string | null }, editId?: string) => Promise<unknown>,
  editId?: string
) {
  await upsertDailyMileage(payload, editId);
}

/* ─── Constants ──────────────────────────────────────────────── */

export const DAY_NAMES = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
export const IMPORT_STEPS: ImportStep[] = [1, 2, 3];

/* ─── Expanded Daily Args ────────────────────────────────────── */

export type DailyExpandedArgs = {
  days: DailyRow[];
  editingDaily: { id: string; km_total: string; fuel_cost: string; notes: string } | null;
  permissionsCanEdit: boolean;
  savingEntry: boolean;
  updateEditingDaily: (field: 'km_total' | 'fuel_cost' | 'notes', value: string) => void;
  saveEditedDaily: (row: DailyRow) => Promise<void>;
  setEditingDaily: React.Dispatch<React.SetStateAction<{ id: string; km_total: string; fuel_cost: string; notes: string } | null>>;
  handleDeleteDaily: (id: string) => Promise<void>;
};
