import type { App, DailyData, Employee } from '@modules/orders/types';

export const ALL_APPS_REPORT_ID = 'all';

export type DailyAppReportTarget = {
  app_id: string;
  target_orders: number;
  employee_target_orders?: number | null;
};

export type DailyAppReportRow = {
  empId: string;
  empName: string;
  dailyVals: number[];
  total: number;
  employeeTarget: number | null;
  remaining: number | null;
  achievementPercentage: number | null;
  projectedTotal: number | null;
  expectedToReachTarget: boolean | null;
  note: string;
};

type BuildDailyAppReportParams = {
  employees: Employee[];
  apps: App[];
  selectedAppId: string;
  data: DailyData;
  targets: DailyAppReportTarget[];
  employeeAppIdsByApp: Record<string, ReadonlySet<string>>;
  year: number;
  month: number;
  startDay: number;
  endDay: number;
  today?: Date;
};

type ReportPeriod = Pick<BuildDailyAppReportParams, 'year' | 'month' | 'startDay' | 'endDay'> & {
  today: Date;
};

type BuildEmployeeReportRowParams = {
  employee: Employee;
  appIds: string[];
  data: DailyData;
  dayNumbers: number[];
  targets: DailyAppReportTarget[];
  employeeAppIdsByApp: Record<string, ReadonlySet<string>>;
  elapsedDays: number;
};

const getSelectedAppIds = (apps: App[], selectedAppId: string) =>
  selectedAppId === ALL_APPS_REPORT_ID ? apps.map((app) => app.id) : [selectedAppId];

type ResolveEmployeeTargetAppParams = {
  employeeId: string;
  appIds: string[];
  data: DailyData;
  dayNumbers: number[];
  employeeAppIdsByApp: Record<string, ReadonlySet<string>>;
};

const getEmployeeAppOrders = (
  employeeId: string,
  appId: string,
  data: DailyData,
  dayNumbers: number[],
) => dayNumbers.reduce((sum, day) => sum + (data[`${employeeId}::${appId}::${day}`] ?? 0), 0);

const resolveEmployeeTargetApp = ({
  employeeId,
  appIds,
  data,
  dayNumbers,
  employeeAppIdsByApp,
}: ResolveEmployeeTargetAppParams) => {
  if (appIds.length === 1) return appIds[0];

  const assignedAppIds = appIds.filter((appId) => employeeAppIdsByApp[appId]?.has(employeeId));
  const candidateAppIds = assignedAppIds.length > 0 ? assignedAppIds : appIds;
  const [initialAppId, ...remainingAppIds] = candidateAppIds;
  if (!initialAppId) return null;

  return remainingAppIds.reduce((bestAppId, appId) =>
    getEmployeeAppOrders(employeeId, appId, data, dayNumbers)
      > getEmployeeAppOrders(employeeId, bestAppId, data, dayNumbers)
      ? appId
      : bestAppId,
    initialAppId,
  );
};

const getEmployeeTarget = (targets: DailyAppReportTarget[], appId: string | null) =>
  appId === null
    ? null
    : targets.find((target) => target.app_id === appId)?.employee_target_orders ?? null;

const getElapsedDaysInRange = ({ year, month, startDay, endDay, today }: ReportPeriod) => {
  const reportMonth = year * 12 + month;
  const currentMonth = today.getFullYear() * 12 + today.getMonth() + 1;
  if (reportMonth < currentMonth) return endDay - startDay + 1;
  if (reportMonth > currentMonth) return 0;
  return Math.max(0, Math.min(endDay, today.getDate()) - startDay + 1);
};

const getTargetProgress = (
  total: number,
  employeeTarget: number | null,
  elapsedDays: number,
  rangeDays: number,
) => {
  if (employeeTarget === null || employeeTarget <= 0) {
    return { remaining: null, achievementPercentage: null, projectedTotal: null, expectedToReachTarget: null };
  }

  const remaining = Math.max(employeeTarget - total, 0);
  const achievementPercentage = (total / employeeTarget) * 100;
  const projectedTotal = total >= employeeTarget
    ? total
    : elapsedDays > 0 ? Math.round((total / elapsedDays) * rangeDays) : null;
  const expectedToReachTarget = projectedTotal === null ? null : projectedTotal >= employeeTarget;
  return { remaining, achievementPercentage, projectedTotal, expectedToReachTarget };
};

const buildEmployeeReportRow = ({
  employee,
  appIds,
  data,
  dayNumbers,
  targets,
  employeeAppIdsByApp,
  elapsedDays,
}: BuildEmployeeReportRowParams): DailyAppReportRow | null => {
  const dailyVals = dayNumbers.map((day) => appIds.reduce(
    (sum, appId) => sum + (data[`${employee.id}::${appId}::${day}`] ?? 0),
    0,
  ));
  const total = dailyVals.reduce((sum, orders) => sum + orders, 0);
  if (total === 0) return null;

  const targetAppId = resolveEmployeeTargetApp({
    employeeId: employee.id,
    appIds,
    data,
    dayNumbers,
    employeeAppIdsByApp,
  });
  const employeeTarget = getEmployeeTarget(targets, targetAppId);

  return {
    empId: employee.id,
    empName: employee.name,
    dailyVals,
    total,
    employeeTarget,
    ...getTargetProgress(total, employeeTarget, elapsedDays, dayNumbers.length),
    note: '',
  };
};

export function buildDailyAppReportRows({
  employees,
  apps,
  selectedAppId,
  data,
  targets,
  employeeAppIdsByApp,
  year,
  month,
  startDay,
  endDay,
  today = new Date(),
}: BuildDailyAppReportParams): DailyAppReportRow[] {
  if (!selectedAppId) return [];

  const appIds = getSelectedAppIds(apps, selectedAppId);
  if (appIds.length === 0) return [];

  const dayNumbers = Array.from({ length: endDay - startDay + 1 }, (_, index) => startDay + index);
  const elapsedDays = getElapsedDaysInRange({ year, month, startDay, endDay, today });

  return employees
    .map((employee) => buildEmployeeReportRow({
      employee,
      appIds,
      data,
      dayNumbers,
      targets,
      employeeAppIdsByApp,
      elapsedDays,
    }))
    .filter((row): row is DailyAppReportRow => row !== null)
    .sort((first, second) => second.total - first.total);
}

export const getDailyAppReportName = (apps: App[], selectedAppId: string) =>
  selectedAppId === ALL_APPS_REPORT_ID
    ? 'كل المنصات'
    : apps.find((app) => app.id === selectedAppId)?.name ?? 'غير معروف';
