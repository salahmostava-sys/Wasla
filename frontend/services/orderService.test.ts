import { beforeEach, describe, expect, it, vi } from 'vitest';

const { fromMock, upsertMock, rpcMock, tableResults, getUserMock } = vi.hoisted(() => {
  const tableResultsLocal: Record<string, any> = {};
  const upsertMockLocal = vi.fn();
  const getUserMockLocal = vi.fn();
  return {
    tableResults: tableResultsLocal,
    fromMock: vi.fn((table: string) => {
      const result = tableResultsLocal[table] ?? { data: null, error: null };
      const chainObj = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        lte: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        range: vi.fn().mockReturnThis(),
        ilike: vi.fn().mockReturnThis(),
        delete: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockReturnValue(Promise.resolve(result)),
        single: vi.fn().mockReturnValue(Promise.resolve(result)),
        then: (resolve: any) => Promise.resolve(result).then(resolve),
      };
      const queryBuilder = {
        ...chainObj,
        upsert: vi.fn((...args: any[]) => {
          const val = upsertMockLocal(...args);
          if (val !== undefined) {
             if (val instanceof Promise) {
               const prom = val as any;
               prom.select = () => prom;
               prom.single = () => prom;
               return prom;
             }
             return val;
          }
          return chainObj;
        }),
      };
      return queryBuilder;
    }),
    upsertMock: upsertMockLocal,
    rpcMock: vi.fn(),
    getUserMock: getUserMockLocal,
  };
});

vi.mock('@services/supabase/client', () => ({
  supabase: {
    from: fromMock,
    rpc: rpcMock,
    auth: {
      getUser: (...args: any[]) => getUserMock(...args),
    },
  },
}));


import { orderService, type DailyOrderUpsertRow } from './orderService';

describe('orderService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    for (const k of Object.keys(tableResults)) delete tableResults[k];
    rpcMock.mockResolvedValue({ data: null, error: null });
    // Provide an authenticated user by default so lockMonth tests work
    getUserMock.mockResolvedValue({ data: { user: { id: 'user1' } }, error: null });
  });

  describe('bulkUpsert and replaceMonthData', () => {
    beforeEach(() => {
      rpcMock.mockResolvedValue({ data: null, error: { message: 'Could not find the function public.replace_daily_orders_month_rpc' } });
    });

    it('falls back to row-by-row saves when a chunk fails so valid rows are not lost', async () => {
      const rows: DailyOrderUpsertRow[] = [
        { employee_id: 'emp-1', app_id: 'app-1', date: '2026-04-01', orders_count: 12 },
        { employee_id: 'emp-2', app_id: 'app-1', date: '2026-04-01', orders_count: 8 },
      ];

      upsertMock
        .mockResolvedValueOnce({
          error: {
            message: 'chunk failed',
            code: '23503',
            details: 'foreign key violation',
            hint: null,
          },
        })
        .mockResolvedValueOnce({ error: null })
        .mockResolvedValueOnce({ error: { message: 'employee not found' } });

      const result = await orderService.bulkUpsert(rows, 2);

      expect(result.saved).toBe(1);
      expect(result.failed).toEqual([
        {
          row: rows[1],
          error: 'employee not found',
        },
      ]);
      expect(fromMock).toHaveBeenCalled();
      expect(upsertMock).toHaveBeenNthCalledWith(1, rows, { onConflict: 'employee_id,app_id,date' });
      expect(upsertMock).toHaveBeenNthCalledWith(2, [rows[0]], { onConflict: 'employee_id,app_id,date' });
      expect(upsertMock).toHaveBeenNthCalledWith(3, [rows[1]], { onConflict: 'employee_id,app_id,date' });
    });

    it('uses the transactional month replacement rpc when available', async () => {
      const rows: DailyOrderUpsertRow[] = [
        { employee_id: 'emp-1', app_id: 'app-1', date: '2026-04-01', orders_count: 12 },
      ];

      rpcMock.mockReset();
      rpcMock.mockResolvedValueOnce({
        data: [{ batch_id: 'batch-1', saved_rows: 1, failed_rows: 0 }],
        error: null,
      });

      const result = await orderService.replaceMonthData('2026-04', rows, 200, {
        sourceType: 'excel',
        fileName: 'orders.xlsx',
        targetAppId: 'app-1',
      });

      expect(rpcMock).toHaveBeenCalledWith('replace_daily_orders_month_rpc', {
        p_month_year: '2026-04',
        p_rows: rows,
        p_source_type: 'excel',
        p_file_name: 'orders.xlsx',
        p_target_app_id: 'app-1',
      });
      expect(result).toEqual({
        saved: 1,
        failed: [],
        batchId: 'batch-1',
      });
    });
  });



  describe('getMonthPaged', () => {
    it('returns paged result', async () => {
      tableResults.daily_orders = { data: [{ id: '1' }], count: 1 };
      const res = await orderService.getMonthPaged({ monthYear: '2024-01', page: 1, pageSize: 10, filters: { appIds: ['a1'], branch: 'makkah', search: 'test' } });
      expect(res.rows).toHaveLength(1);
      expect(res.total).toBe(1);
    });
  });

  describe('upsert', () => {
    it('upserts a single record', async () => {
      tableResults.daily_orders = { data: { id: '1' } };
      upsertMock.mockReturnValueOnce({ select: () => ({ single: () => Promise.resolve(tableResults.daily_orders) }) });
      const res = await orderService.upsert('e1', '2024-01-01', 'a1', 5);
      expect(res).toEqual({ id: '1' });
    });
  });

  describe('delete', () => {
    it('completes without error on success', async () => {
      tableResults.daily_orders = { data: null };
      await expect(orderService.delete('1')).resolves.toBeUndefined();
    });
    it('throws formatted error on failure', async () => {
      tableResults.daily_orders = { data: null, error: new Error('delete blocked') };
      await expect(orderService.delete('1')).rejects.toThrow('delete blocked');
    });
  });

  describe('getTotalByEmployee', () => {
    it('returns total', async () => {
      tableResults.daily_orders = { data: [{ orders_count: 5 }, { orders_count: 3 }] };
      const res = await orderService.getTotalByEmployee('e1', '2024-01');
      expect(res).toBe(8);
    });
  });



  describe('getMonthLockStatus', () => {
    it('returns true if locked', async () => {
      tableResults.locked_months = { data: { month_year: '2024-01' } };
      const res = await orderService.getMonthLockStatus('2024-01');
      expect(res.locked).toBe(true);
    });
    it('returns false if not locked', async () => {
      tableResults.locked_months = { data: null };
      const res = await orderService.getMonthLockStatus('2024-01');
      expect(res.locked).toBe(false);
    });
  });

  describe('lockMonth', () => {
    it('completes without error when authenticated', async () => {
      tableResults.locked_months = { data: null };
      await expect(orderService.lockMonth('2024-01')).resolves.toBeUndefined();
    });
  });

  describe('unlockMonth', () => {
    it('completes without error', async () => {
      tableResults.locked_months = { data: null };
      await expect(orderService.unlockMonth('2024-01')).resolves.toBeUndefined();
    });
  });
});
