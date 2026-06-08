import { beforeEach, describe, expect, it, vi } from 'vitest';
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


import { performanceService } from './performanceService';

describe('performanceService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetMockTableResults(tableResults);
  });

  describe('getDashboard', () => {
    it('returns dashboard payload from the backend rpc', async () => {
      rpcMock.mockResolvedValueOnce({
        data: {
          monthYear: '2026-04',
          summary: { totalOrders: 520 },
        },
        error: null,
      });

      const result = await performanceService.getDashboard('2026-04');

      expect(rpcMock).toHaveBeenCalledWith('performance_dashboard_rpc', {
        p_month_year: '2026-04',
      });
      expect(result.summary.totalOrders).toBe(520);
    });

    it('throws on error', async () => {
      rpcMock.mockResolvedValueOnce({ data: null, error: new Error('dash error') });
      await expect(performanceService.getDashboard('2026-04')).rejects.toThrow('dash error');
    });
  });

  describe('getRiderProfile', () => {
    it('returns profile payload', async () => {
      rpcMock.mockResolvedValueOnce({ data: { monthYear: '2026-04' }, error: null });
      const res = await performanceService.getRiderProfile('u1', '2026-04');
      expect(res.monthYear).toBe('2026-04');
    });
    it('throws on error', async () => {
      rpcMock.mockResolvedValueOnce({ data: null, error: new Error('prof error') });
      await expect(performanceService.getRiderProfile('u1', '2026-04')).rejects.toThrow('prof error');
    });
  });

  describe('upsertEmployeeTarget', () => {
    it('upserts target', async () => {
      tableResults.employee_targets = { data: { id: 't1' }, error: null };
      const res = await performanceService.upsertEmployeeTarget({ employeeId: 'u1', monthYear: '2026-04', monthlyTargetOrders: 10, dailyTargetOrders: 1 });
      expect(res.id).toBe('t1');
    });
    it('throws on error', async () => {
      tableResults.employee_targets = { data: null, error: new Error('target error') };
      await expect(performanceService.upsertEmployeeTarget({ employeeId: 'u1', monthYear: '2026-04', monthlyTargetOrders: 10, dailyTargetOrders: 1 })).rejects.toThrow('target error');
    });
  });

  describe('getImportHistory', () => {
    it('returns data', async () => {
      tableResults.order_import_batches = { data: [{ id: 'b1' }], error: null };
      const res = await performanceService.getImportHistory('2026-04');
      expect(res).toHaveLength(1);
    });

    it('throws when import history query fails', async () => {
      tableResults.order_import_batches = {
        data: null,
        error: new Error('history down'),
      };

      await expect(performanceService.getImportHistory('2026-04')).rejects.toThrow('history down');
    });

    it('returns empty array if error includes order_import_batches (schema issue)', async () => {
      tableResults.order_import_batches = {
        data: null,
        error: new Error('Could not find table order_import_batches'),
      };
      const res = await performanceService.getImportHistory('2026-04');
      expect(res).toEqual([]);
    });
  });

  describe('deleteImportBatch', () => {
    it('deletes successfully', async () => {
      tableResults.order_import_batches = { data: null, error: null };
      await performanceService.deleteImportBatch('b1');
      expect(fromMock).toHaveBeenCalledWith('order_import_batches');
    });
    it('throws on error', async () => {
      tableResults.order_import_batches = { data: null, error: new Error('del err') };
      await expect(performanceService.deleteImportBatch('b1')).rejects.toThrow('del err');
    });
  });

  describe('captureSalaryMonthSnapshot', () => {
    it('captures salary month snapshot', async () => {
      rpcMock.mockResolvedValueOnce({
        data: { month_year: '2026-04', records_count: 3 },
        error: null,
      });

      const result = await performanceService.captureSalaryMonthSnapshot('2026-04');

      expect(rpcMock).toHaveBeenCalledWith('capture_salary_month_snapshot', {
        p_month_year: '2026-04',
      });
      expect(result).toEqual({ month_year: '2026-04', records_count: 3 });
    });

    it('throws on error', async () => {
      rpcMock.mockResolvedValueOnce({ data: null, error: new Error('snap err') });
      await expect(performanceService.captureSalaryMonthSnapshot('2026-04')).rejects.toThrow('snap err');
    });
  });
});
