import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createQueryBuilder, type MockQueryResult } from '@shared/test/mocks/supabaseClientMock';


const { tableResults, fromMock, authMock } = vi.hoisted(() => {
  const tableResultsLocal: Record<string, MockQueryResult> = {};
  return {
    tableResults: tableResultsLocal,
    fromMock: vi.fn((table: string) => createQueryBuilder(tableResultsLocal[table] ?? { data: null, error: null })),
    authMock: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null }),
    },
  };
});

vi.mock('@services/supabase/client', () => ({
  supabase: {
    from: fromMock,
    auth: authMock,
  },
}));


import * as maintenanceService from './maintenanceService';

describe('maintenanceService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    for (const k of Object.keys(tableResults)) delete tableResults[k];
    fromMock.mockImplementation((table: string) =>
      createQueryBuilder(tableResults[table] ?? { data: null, error: null }),
    );
  });

  describe('throwMaintenanceSchemaError', () => {
    it('throws custom error if missing schema', async () => {
      tableResults.spare_parts = { data: null, error: new Error("Could not find the table 'public.spare_parts'") };
      await expect(maintenanceService.getSpareparts()).rejects.toThrow('جداول الصيانة غير مفعّلة في قاعدة البيانات الحالية');
    });
    
    it('throws custom error if missing schema in an object', async () => {
      tableResults.spare_parts = { data: null, error: { message: "Could not find the table 'public.maintenance_parts'" } };
      await expect(maintenanceService.getSpareparts()).rejects.toThrow('جداول الصيانة غير مفعّلة في قاعدة البيانات الحالية');
    });

    it('throws custom error if missing schema wrapped', async () => {
      tableResults.spare_parts = { data: null, error: { message: { inner: "Could not find the table 'public.maintenance_logs'" } } };
      await expect(maintenanceService.getSpareparts()).rejects.toThrow('جداول الصيانة غير مفعّلة في قاعدة البيانات الحالية');
    });

    it('throws custom error if missing schema generic fallback', async () => {
      tableResults.spare_parts = { data: null, error: { message: null } };
      await expect(maintenanceService.getSpareparts()).rejects.toThrow('Service failure');
    });
  });

  describe('getSpareparts', () => {
    it('returns array', async () => {
      tableResults.spare_parts = {
        data: [{ id: 'sp1', name_ar: 'فلتر زيت', stock_quantity: 10, min_stock_alert: 5 }],
        error: null,
      };
      const result = await maintenanceService.getSpareparts();
      expect(result).toHaveLength(1);
    });

    it('never swallows errors — always throws', async () => {
      tableResults.spare_parts = { data: null, error: new Error('opaque failure') };
      await expect(maintenanceService.getSpareparts()).rejects.toThrow(/opaque failure/);
    });
  });

  describe('createSparePart', () => {
    it('creates successfully', async () => {
      tableResults.spare_parts = { data: { id: 'new_sp' }, error: null };
      const res = await maintenanceService.createSparePart({ name_ar: 'test' });
      expect(res.id).toBe('new_sp');
    });
    it('throws on error', async () => {
      tableResults.spare_parts = { data: null, error: new Error('create err') };
      await expect(maintenanceService.createSparePart({ name_ar: 'test' })).rejects.toThrow('create err');
    });
  });

  describe('updateSparePart', () => {
    it('updates successfully', async () => {
      tableResults.spare_parts = { data: { id: 'sp1' }, error: null };
      const res = await maintenanceService.updateSparePart('sp1', { name_ar: 'test2' });
      expect(res.id).toBe('sp1');
    });
    it('throws on error', async () => {
      tableResults.spare_parts = { data: null, error: new Error('update err') };
      await expect(maintenanceService.updateSparePart('sp1', {})).rejects.toThrow('update err');
    });
  });

  describe('deleteSparePart', () => {
    it('deletes successfully if not used', async () => {
      tableResults.maintenance_parts = { data: null, error: null, count: 0 };
      tableResults.spare_parts = { data: null, error: null };
      await maintenanceService.deleteSparePart('sp1');
      expect(fromMock).toHaveBeenCalledWith('spare_parts');
    });

    it('throws when part is referenced in maintenance', async () => {
      tableResults.maintenance_parts = { data: null, error: null, count: 3 };
      await expect(maintenanceService.deleteSparePart('sp1')).rejects.toThrow(
        'لا يمكن حذف القطعة لأنها مستخدمة في سجلات صيانة.',
      );
    });

    it('throws on Supabase error during count check', async () => {
      tableResults.maintenance_parts = { data: null, error: new Error('count failed') };
      await expect(maintenanceService.deleteSparePart('sp1')).rejects.toThrow('count failed');
    });

    it('throws on error from delete', async () => {
      fromMock.mockImplementation((table: string) => {
        if (table === 'maintenance_parts') return createQueryBuilder({ data: null, error: null, count: 0 });
        if (table === 'spare_parts') return createQueryBuilder({ data: null, error: new Error('delete blocked') });
        return createQueryBuilder({ data: null, error: null });
      });
      await expect(maintenanceService.deleteSparePart('sp1')).rejects.toThrow('delete blocked');
    });
  });

  describe('getMaintenanceLogs', () => {
    it('returns array', async () => {
      tableResults.maintenance_logs = {
        data: [{ id: 'ml1', vehicle_id: 'v1', type: 'غيار زيت', total_cost: 200, status: 'مكتملة', maintenance_parts: [] }],
        error: null,
      };
      const result = await maintenanceService.getMaintenanceLogs();
      expect(result).toHaveLength(1);
    });
    it('throws on Supabase error', async () => {
      tableResults.maintenance_logs = { data: null, error: new Error('table missing') };
      await expect(maintenanceService.getMaintenanceLogs()).rejects.toThrow('table missing');
    });
  });

  describe('createMaintenanceLog', () => {
    it('creates successfully with parts', async () => {
      fromMock.mockImplementation((table: string) => {
        if (table === 'maintenance_logs') {
          // Both insert and select (in getMaintenanceLogById) will hit this
          // The query builder mock returns the same data for all calls if we don't differentiate
          // But since the mock just returns data, we can provide a valid log object
          return createQueryBuilder({
            data: { id: 'log1', maintenance_parts: [] },
            error: null
          });
        }
        if (table === 'maintenance_parts') return createQueryBuilder({ data: null, error: null });
        return createQueryBuilder({ data: null, error: null });
      });

      const res = await maintenanceService.createMaintenanceLog(
        { vehicle_id: 'v1', maintenance_date: '2026-03-01', type: 'غيار زيت' },
        [{ part_id: 'p1', quantity_used: 1, cost_at_time: 100 }]
      );
      expect(res.id).toBe('log1');
    });

    it('throws on Supabase error insert', async () => {
      tableResults.maintenance_logs = { data: null, error: new Error('insert failed') };
      await expect(
        maintenanceService.createMaintenanceLog({ vehicle_id: 'v1', maintenance_date: '2026-03-01', type: 'غيار زيت' }, [])
      ).rejects.toThrow('insert failed');
    });

    it('throws when vehicle_id missing (simulated by db err)', async () => {
      tableResults.maintenance_logs = { data: null, error: new Error('null value in column "vehicle_id"') };
      await expect(
        maintenanceService.createMaintenanceLog({ vehicle_id: '', maintenance_date: '2026-03-01', type: 'غيار زيت' }, [])
      ).rejects.toThrow('null value');
    });

    it('throws on parts insert error', async () => {
      fromMock.mockImplementation((table: string) => {
        if (table === 'maintenance_logs') return createQueryBuilder({ data: { id: 'log1' }, error: null });
        if (table === 'maintenance_parts') return createQueryBuilder({ data: null, error: new Error('parts err') });
        return createQueryBuilder({ data: null, error: null });
      });

      await expect(
        maintenanceService.createMaintenanceLog(
          { vehicle_id: 'v1', maintenance_date: '2026-03-01', type: 'غيار زيت' },
          [{ part_id: 'p1', quantity_used: 1, cost_at_time: 100 }]
        )
      ).rejects.toThrow('parts err');
    });
    
    it('throws on getMaintenanceLogById error', async () => {
      let logsCallCount = 0;
      fromMock.mockImplementation((table: string) => {
        if (table === 'maintenance_logs') {
          logsCallCount++;
          if (logsCallCount === 1) return createQueryBuilder({ data: { id: 'log1' }, error: null }); // insert
          return createQueryBuilder({ data: null, error: new Error('get err') }); // select
        }
        return createQueryBuilder({ data: null, error: null });
      });

      await expect(
        maintenanceService.createMaintenanceLog({ vehicle_id: 'v1', maintenance_date: '2026-03-01', type: 'غيار زيت' }, [])
      ).rejects.toThrow('get err');
    });
  });

  describe('deleteMaintenanceLog', () => {
    it('deletes successfully', async () => {
      tableResults.maintenance_logs = { data: null, error: null };
      await maintenanceService.deleteMaintenanceLog('log1');
      expect(fromMock).toHaveBeenCalledWith('maintenance_logs');
    });
    it('throws on error', async () => {
      tableResults.maintenance_logs = { data: null, error: new Error('del err') };
      await expect(maintenanceService.deleteMaintenanceLog('log1')).rejects.toThrow('del err');
    });
  });

  describe('getCurrentDriverNameForVehicle', () => {
    it('returns name successfully', async () => {
      tableResults.vehicle_assignments = { data: { employees: { name: 'John' } }, error: null };
      const res = await maintenanceService.getCurrentDriverNameForVehicle('v1');
      expect(res).toBe('John');
    });
    it('returns null if not found', async () => {
      tableResults.vehicle_assignments = { data: null, error: null };
      const res = await maintenanceService.getCurrentDriverNameForVehicle('v1');
      expect(res).toBeNull();
    });
    it('throws on error', async () => {
      tableResults.vehicle_assignments = { data: null, error: new Error('va err') };
      await expect(maintenanceService.getCurrentDriverNameForVehicle('v1')).rejects.toThrow('va err');
    });
  });

  describe('getLowStockSpareParts', () => {
    it('filters client-side', async () => {
      tableResults.spare_parts = {
        data: [
          { id: 'sp1', name_ar: 'فلتر', stock_quantity: 2, min_stock_alert: 5, unit: 'قطعة' },
          { id: 'sp2', name_ar: 'زيت', stock_quantity: 10, min_stock_alert: 5, unit: 'لتر' },
        ],
        error: null,
      };
      const result = await maintenanceService.getLowStockSpareParts();
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('sp1');
    });
    it('throws on error', async () => {
      tableResults.spare_parts = { data: null, error: new Error('lowstock err') };
      await expect(maintenanceService.getLowStockSpareParts()).rejects.toThrow('lowstock err');
    });
  });
});
