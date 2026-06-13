import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createQueryBuilder, type MockQueryResult } from '@shared/test/mocks/supabaseClientMock';
import { resetMockTableResults } from '@shared/test/mocks/serviceLayerTestUtils';

const { tableResults, fromMock } = vi.hoisted(() => {
  const tableResultsLocal: Record<string, MockQueryResult> = {};
  return {
    tableResults: tableResultsLocal,
    fromMock: vi.fn((table: string) => createQueryBuilder(tableResultsLocal[table] ?? { data: null, error: null })),
  };
});

vi.mock('@services/supabase/client', () => ({
  supabase: {
    from: fromMock,
  },
}));


import { fuelService } from './fuelService';

describe('fuelService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetMockTableResults(tableResults);
  });

  describe('getActiveEmployees', () => {
    it('returns operationally visible employees', async () => {
      tableResults.employees = {
        data: [{ id: 'e1', name: 'أحمد', city: 'makkah', status: 'active', sponsorship_status: 'sponsored', probation_end_date: null }],
        error: null,
      };

      const result = await fuelService.getActiveEmployees();
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('أحمد');
    });

    it('throws formatted error on database failure', async () => {
      tableResults.employees = { data: null, error: new Error('connection refused') };
      await expect(fuelService.getActiveEmployees()).rejects.toThrow('connection refused');
    });
  });

  describe('simple query methods throw on database error', () => {
    it.each([
      ['getActiveApps', () => fuelService.getActiveApps(), 'apps'],
      ['getActiveEmployeeAppLinks', () => fuelService.getActiveEmployeeAppLinks(), 'employee_apps'],
      ['getMonthlyDailyMileage', () => fuelService.getMonthlyDailyMileage('2026-03-01', '2026-03-31'), 'vehicle_mileage_daily'],
      ['getMonthlyOrders', () => fuelService.getMonthlyOrders('2026-03-01', '2026-03-31'), 'daily_orders'],
      ['getMonthlyFuelByMonthYear', () => fuelService.getMonthlyFuelByMonthYear('2026-03'), 'vehicle_mileage'],
      ['getActiveVehicleAssignments', () => fuelService.getActiveVehicleAssignments(), 'vehicle_assignments'],
    ])('%s throws when query fails', async (_name, call, tableName) => {
      tableResults[tableName] = { data: null, error: new Error('query failed') };
      await expect(call()).rejects.toThrow();
    });
  });

  describe('getDailyMileageByMonth', () => {
    it('returns array', async () => {
      tableResults.vehicle_mileage_daily = {
        data: [{ id: 'vm1', employee_id: 'e1', km_total: 120, fuel_cost: 50 }],
        error: null,
      };

      const result = await fuelService.getDailyMileageByMonth('2026-03-01', '2026-03-31');
      expect(result).toHaveLength(1);
      expect(result[0].km_total).toBe(120);
    });

    it('throws on error', async () => {
      tableResults.vehicle_mileage_daily = {
        data: null,
        error: new Error('network failure'),
      };

      await expect(
        fuelService.getDailyMileageByMonth('2026-03-01', '2026-03-31'),
      ).rejects.toThrow('network failure');
    });
  });

  describe('getDailyMileagePaged', () => {
    it('throws on invalid date format', async () => {
      await expect(fuelService.getDailyMileagePaged({ monthStart: 'bad', monthEnd: '2026-03-31', page: 1, pageSize: 10 })).rejects.toThrow('Invalid date format');
    });

    it('returns paged result', async () => {
      tableResults.vehicle_mileage_daily = { data: [{ id: '1' }], error: null, count: 1 };
      const res = await fuelService.getDailyMileagePaged({ monthStart: '2026-03-01', monthEnd: '2026-03-31', page: 1, pageSize: 10, filters: { employeeId: 'e1', branch: 'jeddah', search: 'ahmed' } });
      expect(res.rows).toHaveLength(1);
      expect(res.total).toBe(1);
    });

    it('throws on error', async () => {
      tableResults.vehicle_mileage_daily = { data: null, error: new Error('err') };
      await expect(fuelService.getDailyMileagePaged({ monthStart: '2026-03-01', monthEnd: '2026-03-31', page: 1, pageSize: 10 })).rejects.toThrow('err');
    });
  });

  describe('exportDailyMileage', () => {
    it('collects all pages and returns combined row set', async () => {
      // Page 1: full chunk of 2 rows (count=3 signals more data)
      const page1Builder = (() => {
        const p: any = Promise.resolve({ data: [{ id: '1' }, { id: '2' }], error: null, count: 3 });
        p.select = vi.fn().mockReturnValue(p); p.eq = vi.fn().mockReturnValue(p);
        p.gte = vi.fn().mockReturnValue(p); p.lte = vi.fn().mockReturnValue(p);
        p.order = vi.fn().mockReturnValue(p); p.range = vi.fn().mockReturnValue(p);
        p.ilike = vi.fn().mockReturnValue(p);
        return p;
      })();
      // Page 2: partial chunk (< chunkSize) so pagination stops
      const page2Builder = (() => {
        const p: any = Promise.resolve({ data: [{ id: '3' }], error: null, count: 3 });
        p.select = vi.fn().mockReturnValue(p); p.eq = vi.fn().mockReturnValue(p);
        p.gte = vi.fn().mockReturnValue(p); p.lte = vi.fn().mockReturnValue(p);
        p.order = vi.fn().mockReturnValue(p); p.range = vi.fn().mockReturnValue(p);
        p.ilike = vi.fn().mockReturnValue(p);
        return p;
      })();

      fromMock
        .mockReturnValueOnce(page1Builder)
        .mockReturnValueOnce(page2Builder);

      const res = await fuelService.exportDailyMileage({
        monthStart: '2026-03-01', monthEnd: '2026-03-31', chunkSize: 2, maxRows: 10,
      });

      expect(res).toHaveLength(3);
      expect(fromMock).toHaveBeenCalledWith('vehicle_mileage_daily');
    });
  });

  describe('upsertDailyMileage', () => {
    const validPayload = {
      employee_id: '11111111-1111-1111-1111-111111111111',
      date: '2026-03-15',
      km_total: 100,
      fuel_cost: 45,
      notes: null,
    };

    it('throws on invalid employee_id', async () => {
      await expect(fuelService.upsertDailyMileage({ ...validPayload, employee_id: 'bad' })).rejects.toThrow('Invalid employee_id');
    });
    it('throws on invalid date', async () => {
      await expect(fuelService.upsertDailyMileage({ ...validPayload, date: 'bad' })).rejects.toThrow('Invalid date format');
    });
    it('throws on invalid km_total', async () => {
      await expect(fuelService.upsertDailyMileage({ ...validPayload, km_total: -1 })).rejects.toThrow('Invalid km_total');
    });
    it('throws on invalid fuel_cost', async () => {
      await expect(fuelService.upsertDailyMileage({ ...validPayload, fuel_cost: -1 })).rejects.toThrow('Invalid fuel_cost');
    });

    it('updates when editId is provided', async () => {
      tableResults.vehicle_mileage_daily = { data: null, error: null };
      await fuelService.upsertDailyMileage(validPayload, 'edit-1');
      expect(fromMock).toHaveBeenCalledWith('vehicle_mileage_daily');
    });

    it('upserts when editId is not provided', async () => {
      tableResults.vehicle_mileage_daily = { data: null, error: null };
      await fuelService.upsertDailyMileage(validPayload);
      expect(fromMock).toHaveBeenCalledWith('vehicle_mileage_daily');
    });

    it('throws on error', async () => {
      tableResults.vehicle_mileage_daily = {
        data: null,
        error: new Error('upsert conflict'),
      };

      await expect(
        fuelService.upsertDailyMileage(validPayload),
      ).rejects.toThrow('upsert conflict');
    });

    it('throws on update error', async () => {
      tableResults.vehicle_mileage_daily = {
        data: null,
        error: new Error('update error'),
      };

      await expect(
        fuelService.upsertDailyMileage(validPayload, 'edit-1'),
      ).rejects.toThrow('update error');
    });
  });

  describe('deleteDailyMileage', () => {
    it('deletes successfully', async () => {
      tableResults.vehicle_mileage_daily = { data: null, error: null };
      await fuelService.deleteDailyMileage('1');
      expect(fromMock).toHaveBeenCalledWith('vehicle_mileage_daily');
    });
    it('throws on error', async () => {
      tableResults.vehicle_mileage_daily = {
        data: null,
        error: new Error('delete failed'),
      };

      await expect(fuelService.deleteDailyMileage('vm1')).rejects.toThrow('delete failed');
    });
  });

  describe('saveMonthlyMileageImport', () => {
    it('upserts with overwrite', async () => {
      tableResults.vehicle_mileage = { data: null, error: null };
      await fuelService.saveMonthlyMileageImport([{ employee_id: 'e1', month_year: '2026-03', km_total: 100, fuel_cost: 50, notes: null }], true);
      expect(fromMock).toHaveBeenCalledWith('vehicle_mileage');
    });
    it('throws on overwrite error', async () => {
      tableResults.vehicle_mileage = { data: null, error: new Error('upsert err') };
      await expect(fuelService.saveMonthlyMileageImport([], true)).rejects.toThrow('upsert err');
    });

    it('inserts ignoring duplicates', async () => {
      tableResults.vehicle_mileage = { data: null, error: null };
      await fuelService.saveMonthlyMileageImport([{ employee_id: 'e1', month_year: '2026-03', km_total: 100, fuel_cost: 50, notes: null }], false);
      expect(fromMock).toHaveBeenCalledWith('vehicle_mileage');
    });
    it('throws on insert error', async () => {
      tableResults.vehicle_mileage = { data: null, error: new Error('insert err') };
      await expect(fuelService.saveMonthlyMileageImport([], false)).rejects.toThrow('insert err');
    });
  });
});
