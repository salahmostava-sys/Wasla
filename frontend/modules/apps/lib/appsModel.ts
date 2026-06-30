import { getDate, getDaysInMonth, format } from 'date-fns';
import type { AppUpsertPayload } from '@services/appService';
import type { WorkType } from '@shared/types/shifts';
import type {
  AppData,
  AppEmployee,
  AppEmployeeAssignmentRow,
  AppEmployeeOrderRow,
  AppFormValues,
  AppMonthlyOrderRow,
  CustomColumn,
} from '@modules/apps/types';
import type { Json } from '@services/supabase/types';

type AppOverviewSource = {
  id: string;
  name: string;
  name_en: string | null;
  brand_color: string;
  text_color: string;
  is_active: boolean;
  is_active_this_month?: boolean;
  custom_columns?: Json | null;
  work_type?: WorkType | null;
};

const TERMINATED_SPONSORSHIP_STATUSES = new Set(['absconded', 'terminated']);

export const normalizeCustomColumns = (value: unknown): CustomColumn[] => {
  if (!Array.isArray(value)) return [];

  return value.flatMap((item) => {
    if (
      item &&
      typeof item === 'object' &&
      typeof (item as { key?: unknown }).key === 'string' &&
      typeof (item as { label?: unknown }).label === 'string'
    ) {
      return [
        {
          key: (item as { key: string }).key,
          label: (item as { label: string }).label,
        },
      ];
    }

    return [];
  });
};

export const toAppFormValues = (app?: Partial<AppData> | null): AppFormValues => ({
  name: app?.name ?? '',
  name_en: app?.name_en ?? '',
  brand_color: app?.brand_color ?? '#6366f1',
  text_color: app?.text_color ?? '#ffffff',
  is_active: app?.is_active ?? true,
  custom_columns: normalizeCustomColumns(app?.custom_columns),
});

export const toAppUpsertPayload = (values: AppFormValues): AppUpsertPayload => ({
  name: values.name.trim(),
  name_en: values.name_en.trim() || null,
  brand_color: values.brand_color,
  text_color: values.text_color,
  is_active: values.is_active,
  custom_columns: values.custom_columns as unknown as Json,
});

export const buildAppsOverview = (
  apps: AppOverviewSource[],
  orderRows: AppMonthlyOrderRow[],
  assignments: AppEmployeeAssignmentRow[],
): AppData[] => {
  const statsMap = new Map<string, { ordersCount: number }>();
  const employeeIdsByApp = new Map<string, Set<string>>();

  orderRows.forEach((row) => {
    if (!row.app_id) return;

    const current = statsMap.get(row.app_id) ?? {
      ordersCount: 0,
    };

    current.ordersCount += row.orders_count ?? 0;
    statsMap.set(row.app_id, current);
  });

  assignments.forEach((assignment) => {
    if (!assignment.app_id || !isVisibleEmployee(assignment.employees)) return;
    const current = employeeIdsByApp.get(assignment.app_id) ?? new Set<string>();
    current.add(assignment.employee_id);
    employeeIdsByApp.set(assignment.app_id, current);
  });

  return apps.map((app) => {
    const stats = statsMap.get(app.id);

    return {
      id: app.id,
      name: app.name,
      name_en: app.name_en,
      brand_color: app.brand_color,
      text_color: app.text_color,
      is_active: app.is_active,
      is_active_this_month: app.is_active_this_month ?? app.is_active,
      employeeCount: employeeIdsByApp.get(app.id)?.size ?? 0,
      ordersCount: stats?.ordersCount ?? 0,
      work_type: app.work_type ?? null,
      logo_url: app.logo_url ?? null,
      custom_columns: normalizeCustomColumns(app.custom_columns),
    };
  });
};

export const getMonthBounds = (monthYear: string, referenceDate = new Date()) => {
  const monthDate = new Date(`${monthYear}-01`);
  const daysInMonth = getDaysInMonth(monthDate);
  const isCurrentMonth = monthYear === format(referenceDate, 'yyyy-MM');
  const daysPassed = isCurrentMonth ? Math.max(1, getDate(referenceDate)) : daysInMonth;

  return {
    startDate: `${monthYear}-01`,
    endDate: `${monthYear}-${String(daysInMonth).padStart(2, '0')}`,
    daysInMonth,
    daysPassed,
  };
};

const isVisibleEmployee = (row: AppEmployeeAssignmentRow['employees']) => {
  if (!row) return false;
  if (row.status !== 'active') return false;
  return !TERMINATED_SPONSORSHIP_STATUSES.has(row.sponsorship_status ?? '');
};

export const buildAppEmployees = ({
  assignments,
  orderRows,
  targetOrders,
  daysInMonth,
  daysPassed,
}: {
  assignments: AppEmployeeAssignmentRow[];
  orderRows: AppEmployeeOrderRow[];
  targetOrders: number | null;
  daysInMonth: number;
  daysPassed: number;
}): AppEmployee[] => {
  const visibleEmployees = assignments
    .map((assignment) => assignment.employees)
    .filter((e): e is NonNullable<typeof e> => e != null && isVisibleEmployee(e));

  const totalsByEmployee = new Map<string, number>();
  orderRows.forEach((row) => {
    if (!row.employee_id) return;
    totalsByEmployee.set(row.employee_id, (totalsByEmployee.get(row.employee_id) ?? 0) + (row.orders_count ?? 0));
  });

  const riderCount = visibleEmployees.length;
  const targetShare = targetOrders !== null && riderCount > 0 ? targetOrders / riderCount : null;

  return visibleEmployees.map((employee) => {
    const monthOrders = totalsByEmployee.get(employee.id) ?? 0;
    const projectedMonthEnd = Math.round((monthOrders / daysPassed) * daysInMonth);

    return {
      id: employee?.id,
      name: employee?.name,
      national_id: employee?.national_id ?? null,
      phone: employee?.phone ?? null,
      job_title: employee?.job_title ?? null,
      status: employee?.status,
      monthOrders,
      targetShare,
      projectedMonthEnd,
      onTrack: targetShare == null ? null : projectedMonthEnd >= targetShare * 0.95,
    };
  });
};
