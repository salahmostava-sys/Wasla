import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createQueryBuilder, type MockQueryResult } from '@shared/test/mocks/supabaseClientMock';
import { resetMockTableResults } from '@shared/test/mocks/serviceLayerTestUtils';

const { tableResults, fromMock, rpcMock } = vi.hoisted(() => {
  const tableResultsLocal: Record<string, MockQueryResult> = {};
  return {
    tableResults: tableResultsLocal,
    fromMock: vi.fn((table: string) => createQueryBuilder(tableResultsLocal[table] ?? { data: null, error: null })),
    rpcMock: vi.fn(),
  };
});

vi.mock('@services/supabase/client', () => ({
  supabase: {
    from: fromMock,
    rpc: rpcMock,
  },
}));


import { dashboardService } from './dashboardService';

describe('dashboardService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetMockTableResults(tableResults);
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-05T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('getOverviewRpc', () => {
    it('throws on invalid monthYear format', async () => {
      await expect(dashboardService.getOverviewRpc('2026/04', '2026-04-05')).rejects.toThrow('Invalid monthYear format');
    });

    it('throws on invalid today format', async () => {
      await expect(dashboardService.getOverviewRpc('2026-04', '05-04-2026')).rejects.toThrow('Invalid today format');
    });

    it('returns data successfully on first try', async () => {
      rpcMock.mockResolvedValueOnce({ data: { some: 'data' }, error: null });
      const res = await dashboardService.getOverviewRpc('2026-04', '2026-04-05');
      expect(res).toEqual({ some: 'data' });
    });

    it('retries on signature mismatch and eventually succeeds', async () => {
      rpcMock
        .mockResolvedValueOnce({ data: null, error: { message: 'Could not find the function public.dashboard_overview_rpc' } })
        .mockResolvedValueOnce({ data: { success: true }, error: null });

      const res = await dashboardService.getOverviewRpc('2026-04', '2026-04-05');
      expect(res).toEqual({ success: true });
    });

    it('throws immediately on non-signature mismatch error', async () => {
      rpcMock.mockResolvedValueOnce({ data: null, error: new Error('Permission denied') });
      await expect(dashboardService.getOverviewRpc('2026-04', '2026-04-05')).rejects.toThrow();
    });

    it('throws if all attempts fail with signature mismatch', async () => {
      rpcMock.mockResolvedValue({ data: null, error: new Error('Could not find the function public.dashboard_overview_rpc') });
      await expect(dashboardService.getOverviewRpc('2026-04', '2026-04-05')).rejects.toThrow('Could not find the function');
    });
  });

  describe('simple query methods return correct results', () => {
    it('getActiveEmployeeCount returns visible active employee count', async () => {
      tableResults.employees = {
        data: [{ id: '1', status: 'active', sponsorship_status: 'sponsored', probation_end_date: null }],
        error: null,
      };
      expect(await dashboardService.getActiveEmployeeCount()).toBe(1);
    });

    it('getMonthSalaryTotal returns sum of approved net salaries', async () => {
      tableResults.salary_records = { data: [{ net_salary: 100 }, { net_salary: 200 }], error: null };
      expect(await dashboardService.getMonthSalaryTotal('2026-04')).toBe(300);
    });

    it('getActiveAdvancesTotal returns sum of active advance amounts', async () => {
      tableResults.advances = { data: [{ amount: 50 }, { amount: 150 }], error: null };
      expect(await dashboardService.getActiveAdvancesTotal()).toBe(200);
    });

    it('getAttendanceToday returns grouped counts by status', async () => {
      tableResults.attendance = {
        data: [{ status: 'present' }, { status: 'absent' }, { status: 'absent' }, { status: 'leave' }],
        error: null,
      };
      expect(await dashboardService.getAttendanceToday('2026-04-05')).toEqual({ present: 1, absent: 2, leave: 1 });
    });

    it('getMonthOrdersCount returns sum of orders_count', async () => {
      tableResults.daily_orders = { data: [{ orders_count: 5 }, { orders_count: 10 }], error: null };
      expect(await dashboardService.getMonthOrdersCount('2026-04')).toBe(15);
    });

    it('getAttendanceTrend maps daily status into date-grouped rows', async () => {
      tableResults.attendance = {
        data: [
          { date: '2026-04-01', status: 'present' },
          { date: '2026-04-01', status: 'absent' },
          { date: '2026-04-02', status: 'leave' },
        ],
        error: null,
      };
      expect(await dashboardService.getAttendanceTrend('2026-04-01', '2026-04-02')).toEqual([
        { date: '2026-04-01', present: 1, absent: 1, leave: 0 },
        { date: '2026-04-02', present: 0, absent: 0, leave: 1 },
      ]);
    });

    it('getActiveVehiclesCount returns headcount from count metadata', async () => {
      tableResults.vehicles = { data: null, count: 5, error: null };
      expect(await dashboardService.getActiveVehiclesCount()).toBe(5);
    });

    it('getUnresolvedAlertsCount returns count from metadata', async () => {
      tableResults.alerts = { data: null, count: 3, error: null };
      expect(await dashboardService.getUnresolvedAlertsCount()).toBe(3);
    });
  });

  describe('simple query methods throw on database error', () => {
    it.each([
      ['getActiveApps', () => dashboardService.getActiveApps(), 'apps'],
      ['getActiveEmployeeCount', () => dashboardService.getActiveEmployeeCount(), 'employees'],
      ['getMonthSalaryTotal', () => dashboardService.getMonthSalaryTotal('2026-04'), 'salary_records'],
      ['getActiveAdvancesTotal', () => dashboardService.getActiveAdvancesTotal(), 'advances'],
      ['getAttendanceToday', () => dashboardService.getAttendanceToday('2026-04-05'), 'attendance'],
      ['getMonthOrders', () => dashboardService.getMonthOrders('2026-04'), 'daily_orders'],
      ['getMonthOrdersCount', () => dashboardService.getMonthOrdersCount('2026-04'), 'daily_orders'],
      ['getAttendanceTrend', () => dashboardService.getAttendanceTrend('2026-04-01', '2026-04-02'), 'attendance'],
      ['getRecentActivity', () => dashboardService.getRecentActivity(), 'audit_log'],
      ['getEmployeeAppAssignments', () => dashboardService.getEmployeeAppAssignments(), 'employee_apps'],
      ['getSystemSettings', () => dashboardService.getSystemSettings(), 'system_settings'],
      ['getEmployeeDistribution', () => dashboardService.getEmployeeDistribution(), 'employees'],
      ['getActiveVehiclesCount', () => dashboardService.getActiveVehiclesCount(), 'vehicles'],
      ['getUnresolvedAlertsCount', () => dashboardService.getUnresolvedAlertsCount(), 'alerts'],
      ['getAppTargets', () => dashboardService.getAppTargets('2026-04'), 'app_targets'],
    ])('%s throws when query fails', async (_name, call, tableName) => {
      tableResults[tableName] = { data: null, error: new Error(`${tableName} error`) };
      await expect(call()).rejects.toThrow(`${tableName} error`);
    });
  });

  describe('getSupervisorPerformance', () => {
    it('returns performance rows', async () => {
      tableResults.supervisor_targets = { data: [{ supervisor_id: 's1', target_orders: 100 }], error: null };
      tableResults.profiles = { data: [{ id: 's1', name: 'Supervisor A' }], error: null };
      tableResults.supervisor_employee_assignments = {
        data: [{ supervisor_id: 's1', employee_id: 'e1', start_date: '2026-04-01', end_date: null }],
        error: null,
      };
      tableResults.daily_orders = {
        data: [{ employee_id: 'e1', date: '2026-04-02', orders_count: 50 }],
        error: null,
      };

      const res = await dashboardService.getSupervisorPerformance('2026-04');
      expect(res).toEqual([
        {
          supervisor_id: 's1',
          supervisor_name: 'Supervisor A',
          target_orders: 100,
          actual_orders: 50,
          achievement_percent: 50,
        },
      ]);
    });

    it('throws if targets query fails', async () => {
      tableResults.supervisor_targets = { data: null, error: new Error('targets error') };
      tableResults.profiles = { data: [], error: null };
      tableResults.supervisor_employee_assignments = { data: [], error: null };
      tableResults.daily_orders = { data: [], error: null };

      await expect(dashboardService.getSupervisorPerformance('2026-04')).rejects.toThrow('targets error');
    });
    
    it('throws if profiles query fails', async () => {
      tableResults.supervisor_targets = { data: [], error: null };
      tableResults.profiles = { data: null, error: new Error('profiles error') };
      tableResults.supervisor_employee_assignments = { data: [], error: null };
      tableResults.daily_orders = { data: [], error: null };

      await expect(dashboardService.getSupervisorPerformance('2026-04')).rejects.toThrow('profiles error');
    });
    
    it('throws if assignments query fails', async () => {
      tableResults.supervisor_targets = { data: [], error: null };
      tableResults.profiles = { data: [], error: null };
      tableResults.supervisor_employee_assignments = { data: null, error: new Error('assignments error') };
      tableResults.daily_orders = { data: [], error: null };

      await expect(dashboardService.getSupervisorPerformance('2026-04')).rejects.toThrow('assignments error');
    });

    it('throws if orders query fails', async () => {
      tableResults.supervisor_targets = { data: [], error: null };
      tableResults.profiles = { data: [], error: null };
      tableResults.supervisor_employee_assignments = { data: [], error: null };
      tableResults.daily_orders = { data: null, error: new Error('orders error') };

      await expect(dashboardService.getSupervisorPerformance('2026-04')).rejects.toThrow('orders error');
    });
  });

  describe('getAdditionalMetrics', () => {
    const validMetricsSetup = () => {
      tableResults.vehicle_mileage_daily = { data: [{ fuel_cost: 100, km_total: 50 }], error: null };
      tableResults.maintenance_logs = { data: [{ cost: 200 }], error: null };
      tableResults.violations = { data: [{ amount: 300 }], error: null };
      tableResults.advances = { data: [{ amount: 400 }], error: null };
      tableResults.salary_records = { data: [{ net_salary: 500 }], error: null };
    };

    it('returns formatted metrics', async () => {
      validMetricsSetup();
      const res = await dashboardService.getAdditionalMetrics('2026-04');
      expect(res).toEqual({
        fuelCost: 100,
        fuelLiters: 50,
        maintenanceCost: 200,
        violationsCount: 0,
        violationsCost: 0,
        pendingAdvances: 400,
        totalSalaries: 500,
      });
    });

    it.each([
      ['maintenance', 'maintenance_logs', 'm error'],
      ['fuel', 'vehicle_mileage_daily', 'f error'],
      ['advances', 'advances', 'a error'],
      ['salaries', 'salary_records', 's error'],
    ])('throws when %s query fails', async (_label, tableName, errorMsg) => {
      validMetricsSetup();
      tableResults[tableName] = { data: null, error: new Error(errorMsg) };
      await expect(dashboardService.getAdditionalMetrics('2026-04')).rejects.toThrow(errorMsg);
    });
  });

  describe('getKPIs', () => {
    const validKpiSetup = () => {
      tableResults.employees = {
        data: [{ id: '1', status: 'active', sponsorship_status: 'sponsored', probation_end_date: null }],
        error: null,
      };
      tableResults.attendance = { data: [{ status: 'present' }], error: null };
      tableResults.advances = { data: [{ amount: 10 }], error: null };
      tableResults.salary_records = { data: [{ net_salary: 100 }], error: null };
    };

    it('returns aggregated KPIs from multiple data sources', async () => {
      validKpiSetup();
      const res = await dashboardService.getKPIs('2026-04', '2026-04-05');
      expect(res.kpis).toEqual({
        activeEmployees: 1,
        presentToday: 1,
        absentToday: 0,
        activeAdvances: 10,
        totalSalaries: 100,
        totalOrders: 0,
      });
    });

    it.each([
      ['attendance', 'attendance', 'att err'],
      ['advances', 'advances', 'adv err'],
      ['salary', 'salary_records', 'sal err'],
    ])('throws when %s query fails', async (_label, tableName, errorMsg) => {
      validKpiSetup();
      tableResults[tableName] = { data: null, error: new Error(errorMsg) };
      await expect(dashboardService.getKPIs('2026-04', '2026-04-05')).rejects.toThrow(errorMsg);
    });
  });
});
