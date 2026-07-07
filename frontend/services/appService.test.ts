import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createQueryBuilder, type MockQueryResult } from '@shared/test/mocks/supabaseClientMock';

const { tableResults, fromMock } = vi.hoisted(() => {
  const tableResultsLocal: Record<string, MockQueryResult> = {};
  return {
    tableResults: tableResultsLocal,
    fromMock: vi.fn((table: string) =>
      createQueryBuilder(tableResultsLocal[table] ?? { data: null, error: null }),
    ),
  };
});

vi.mock('@services/supabase/client', () => ({
  supabase: { from: fromMock },
}));


import { appService } from './appService';

describe('appService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    for (const k of Object.keys(tableResults)) delete tableResults[k];
  });

  describe('getAll', () => {
    it('returns apps on success', async () => {
      tableResults.apps = {
        data: [{ id: 'a1', name: 'App', is_active: true }],
      };
      const rows = await appService.getAll();
      expect(rows).toHaveLength(1);
    });

    it('throws on error', async () => {
      tableResults.apps = { data: null, error: new Error('db') };
      await expect(appService.getAll()).rejects.toThrow('db');
    });
  });

  describe('getMonthlyApps', () => {
    it('returns apps with is_active_this_month mapped', async () => {
      tableResults.apps = { data: [{ id: 'a1', is_active: true }, { id: 'a2', is_active: false }] };
      const res = await appService.getMonthlyApps('2024-01');
      expect(res[0].is_active_this_month).toBe(true);
      expect(res[1].is_active_this_month).toBe(false);
    });
  });

  describe('create', () => {
    it('inserts app', async () => {
      await appService.create({ name: 'App', name_en: null, brand_color: '#000', text_color: '#fff', is_active: true, custom_columns: [] });
      expect(fromMock).toHaveBeenCalledWith('apps');
    });
  });

  describe('update', () => {
    it('updates app', async () => {
      await appService.update('a1', { name: 'App', name_en: null, brand_color: '#000', text_color: '#fff', is_active: true, custom_columns: [] });
      expect(fromMock).toHaveBeenCalledWith('apps');
    });
  });

  describe('toggleMonthlyActive', () => {
    it('updates is_active', async () => {
      await appService.toggleMonthlyActive('a1', '2024-01', true);
      expect(fromMock).toHaveBeenCalledWith('apps');
    });
  });

  describe('delete', () => {
    it('soft deletes app', async () => {
      await appService.delete('a1');
      expect(fromMock).toHaveBeenCalledWith('apps');
    });
  });

  describe('permanentDelete', () => {
    it('deletes from all dependent tables and apps', async () => {
      await appService.permanentDelete('a1');
      expect(fromMock).toHaveBeenCalledWith('employee_apps');
      expect(fromMock).toHaveBeenCalledWith('daily_orders');
      expect(fromMock).toHaveBeenCalledWith('apps');
    });
  });

  describe('getAppDependencies', () => {
    it('returns counts of dependent records', async () => {
      tableResults.employee_apps = { count: 1 };
      tableResults.daily_orders = { count: 2 };
      tableResults.app_targets = { count: 0 };
      tableResults.pricing_rules = { count: 0 };
      const res = await appService.getAppDependencies('a1');
      expect(res.hasAnyDependencies).toBe(true);
      expect(res.employeeAppsCount).toBe(1);
    });
  });

  describe('countActiveEmployeeApps', () => {
    it('returns count', async () => {
      tableResults.employee_apps = { count: 7 };
      const count = await appService.countActiveEmployeeApps('a1');
      expect(count).toBe(7);
    });
  });

  describe('getActiveEmployeeAppsWithEmployees', () => {
    it('returns employees for app', async () => {
      tableResults.employee_apps = { data: [{ app_id: 'a1', employee_id: 'e1' }] };
      const res = await appService.getActiveEmployeeAppsWithEmployees('a1');
      expect(res).toHaveLength(1);
    });
  });

  describe('getActiveAssignmentsWithEmployees', () => {
    it('returns assignments', async () => {
      tableResults.employee_apps = { data: [{ app_id: 'a1' }] };
      const res = await appService.getActiveAssignmentsWithEmployees();
      expect(res).toHaveLength(1);
    });
  });

  describe('getEmployeeMonthlyOrders', () => {
    it('returns orders', async () => {
      tableResults.daily_orders = { data: [{ orders_count: 5 }] };
      const res = await appService.getEmployeeMonthlyOrders('e1', 'a1', '2024-01-01', '2024-01-31');
      expect(res).toHaveLength(1);
    });
  });

  describe('getMonthlyOrdersForApp', () => {
    it('returns orders for app', async () => {
      tableResults.daily_orders = { data: [{ employee_id: 'e1', orders_count: 5 }] };
      const res = await appService.getMonthlyOrdersForApp('a1', '2024-01-01', '2024-01-31');
      expect(res).toHaveLength(1);
    });
  });

  describe('assignScheme', () => {
    it('assigns scheme', async () => {
      await appService.assignScheme('a1', 's1');
      expect(fromMock).toHaveBeenCalledWith('apps');
    });
  });

  describe('getActiveWithScheme', () => {
    it('returns apps with scheme', async () => {
      tableResults.apps = { data: [{ id: 'a1' }] };
      const res = await appService.getActiveWithScheme();
      expect(res).toHaveLength(1);
    });
  });

  describe('getActiveWithSalarySchemes', () => {
    it('returns apps with full salary schemes', async () => {
      tableResults.apps = { data: [{ id: 'a1' }] };
      const res = await appService.getActiveWithSalarySchemes();
      expect(res).toHaveLength(1);
    });
  });

  describe('getAppTargetForMonth', () => {
    it('returns target if found', async () => {
      tableResults.app_targets = { data: { target_orders: 100, employee_target_orders: 50 } };
      const res = await appService.getAppTargetForMonth('a1', '2024-01');
      expect(res).toEqual({ targetOrders: 100, employeeTargetOrders: 50 });
    });

    it('returns null if no target', async () => {
      tableResults.app_targets = { data: null };
      const res = await appService.getAppTargetForMonth('a1', '2024-01');
      expect(res).toEqual({ targetOrders: null, employeeTargetOrders: null });
    });
  });
});
