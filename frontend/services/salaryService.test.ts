import { beforeEach, describe, expect, it, vi } from 'vitest';

const { fromMock, rpcMock, getSessionMock, invokeMock } = vi.hoisted(() => ({
  fromMock: vi.fn(),
  rpcMock: vi.fn(),
  getSessionMock: vi.fn(),
  invokeMock: vi.fn(),
}));

vi.mock('@services/supabase/client', () => ({
  supabase: {
    from: fromMock,
    rpc: rpcMock,
    auth: {
      getSession: getSessionMock,
    },
    functions: {
      invoke: invokeMock,
    },
  },
}));


import { salaryService, getTierSalaryExplanationLines } from './salaryService';
import type { SalarySchemeTier } from './salaryService';

describe('salaryService', () => {
  let tableMocks: Record<string, any>;

  beforeEach(() => {
    vi.clearAllMocks();
    invokeMock.mockReset();
    tableMocks = {};
    fromMock.mockImplementation((table: string) => {
      const mockObj = tableMocks[table] ?? { data: null, error: null };
      return {
        select: vi.fn().mockReturnThis(),
        insert: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis(),
        upsert: vi.fn().mockReturnThis(),
        delete: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        or: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        lte: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        range: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue(mockObj),
        maybeSingle: vi.fn().mockResolvedValue(mockObj),
        then: (resolve: any) => Promise.resolve(mockObj).then(resolve),
      };
    });
  });

  describe('getTierSalaryExplanationLines', () => {
    it('returns empty if no tiers', () => {
      expect(getTierSalaryExplanationLines(10, [], null, null)).toEqual([]);
    });

    it('returns per order band format', () => {
      const tiers: SalarySchemeTier[] = [{ from_orders: 1, to_orders: 10, price_per_order: 5, tier_order: 1, tier_type: 'per_order_band' }];
      const res = getTierSalaryExplanationLines(5, tiers, null, null);
      expect(res[0]).toContain('5 × 5');
    });

    it('returns fixed amount format', () => {
      const tiers: SalarySchemeTier[] = [{ from_orders: 1, to_orders: 10, price_per_order: 50, tier_order: 1, tier_type: 'fixed_amount' }];
      const res = getTierSalaryExplanationLines(5, tiers, null, null);
      expect(res[0]).toContain('مبلغ ثابت');
    });

    it('returns base plus incremental format', () => {
      const tiers: SalarySchemeTier[] = [{ from_orders: 1, to_orders: 10, price_per_order: 50, tier_order: 1, tier_type: 'base_plus_incremental', incremental_threshold: 5, incremental_price: 2 }];
      const res = getTierSalaryExplanationLines(8, tiers, null, null);
      expect(res[0]).toContain('50 + (8 - 5) × 2');
    });

    it('returns total multiplier format', () => {
      const tiers: SalarySchemeTier[] = [
        { from_orders: 1, to_orders: 10, price_per_order: 5, tier_order: 1, tier_type: 'total_multiplier' },
        { from_orders: 11, to_orders: null, price_per_order: 10, tier_order: 2, tier_type: 'total_multiplier' }
      ];
      const res = getTierSalaryExplanationLines(15, tiers, 20, 100);
      expect(res[0]).toContain('10 × 5 + 5 × 10');
    });

    it('adds target bonus', () => {
      const tiers: SalarySchemeTier[] = [{ from_orders: 1, to_orders: null, price_per_order: 5, tier_order: 1, tier_type: 'fixed_amount' }];
      const res = getTierSalaryExplanationLines(20, tiers, 10, 100);
      expect(res).toHaveLength(2);
      expect(res[1]).toContain('مكافأة الهدف');
    });
  });

  describe('calculateTierSalary', () => {
    it('returns 0 for no tiers or orders', () => {
      expect(salaryService.calculateTierSalary(0, [], null, null)).toBe(0);
    });

    it('calculates fixed amount', () => {
      const tiers: SalarySchemeTier[] = [{ from_orders: 1, to_orders: 10, price_per_order: 50, tier_order: 1, tier_type: 'fixed_amount' }];
      expect(salaryService.calculateTierSalary(5, tiers, null, null)).toBe(50);
    });

    it('calculates base plus incremental', () => {
      const tiers: SalarySchemeTier[] = [{ from_orders: 1, to_orders: 10, price_per_order: 50, tier_order: 1, tier_type: 'base_plus_incremental', incremental_threshold: 5, incremental_price: 2 }];
      expect(salaryService.calculateTierSalary(8, tiers, null, null)).toBe(56);
    });

    it('calculates per order band', () => {
      const tiers: SalarySchemeTier[] = [{ from_orders: 1, to_orders: 10, price_per_order: 5, tier_order: 1, tier_type: 'per_order_band' }];
      expect(salaryService.calculateTierSalary(5, tiers, null, null)).toBe(25);
    });

    it('calculates total multiplier', () => {
      const tiers: SalarySchemeTier[] = [
        { from_orders: 1, to_orders: 10, price_per_order: 5, tier_order: 1, tier_type: 'total_multiplier' },
        { from_orders: 11, to_orders: null, price_per_order: 10, tier_order: 2, tier_type: 'total_multiplier' }
      ];
      expect(salaryService.calculateTierSalary(15, tiers, 20, 100)).toBe(100); // 50 + 50
    });

    it('adds target bonus', () => {
      const tiers: SalarySchemeTier[] = [{ from_orders: 1, to_orders: null, price_per_order: 50, tier_order: 1, tier_type: 'fixed_amount' }];
      expect(salaryService.calculateTierSalary(20, tiers, 10, 100)).toBe(150);
    });
  });

  describe('calculateFixedMonthlySalary', () => {
    it('calculates correctly', () => {
      expect(salaryService.calculateFixedMonthlySalary(3000, 15)).toBe(1500);
      expect(salaryService.calculateFixedMonthlySalary(0, 15)).toBe(0);
    });
  });


  describe('getPricingRulesForApps', () => {
    it('returns grouped rules', async () => {
      tableMocks.pricing_rules = { data: [{ app_id: 'app1', id: '1' }], error: null };
      const res = await salaryService.getPricingRulesForApps(['app1']);
      expect(res.app1).toHaveLength(1);
    });
    
    it('returns empty for no apps', async () => {
      const res = await salaryService.getPricingRulesForApps([]);
      expect(res).toEqual({});
    });
  });

  describe('getOrderCount', () => {
    it('returns order count sum', async () => {
      tableMocks.daily_orders = { data: [{ orders_count: 5 }, { orders_count: 10 }], error: null };
      const res = await salaryService.getOrderCount('e1', 'a1', '2026-03');
      expect(res).toBe(15);
    });
  });

  describe('applyPricingRules', () => {
    it('returns 0 if no rule matched', () => {
      expect(salaryService.applyPricingRules([], 10).salary).toBe(0);
    });
    
    it('applies fixed rule', () => {
      expect(salaryService.applyPricingRules([{ min_orders: 1, max_orders: 20, rule_type: 'fixed', fixed_salary: 100 } as any], 10).salary).toBe(100);
    });
    
    it('applies per_order rule', () => {
      expect(salaryService.applyPricingRules([{ min_orders: 1, max_orders: 20, rule_type: 'per_order', rate_per_order: 10 } as any], 10).salary).toBe(100);
    });
    
    it('applies hybrid rule', () => {
      expect(salaryService.applyPricingRules([{ min_orders: 1, max_orders: 20, rule_type: 'hybrid', fixed_salary: 50, rate_per_order: 5 } as any], 10).salary).toBe(100);
    });
  });

  describe('calculateSalaryByRules', () => {
    it('returns calculated salary', async () => {
      tableMocks.pricing_rules = { data: [{ min_orders: 1, max_orders: 20, rule_type: 'fixed', fixed_salary: 100 }], error: null };
      tableMocks.daily_orders = { data: [{ orders_count: 10 }], error: null };
      const res = await salaryService.calculateSalaryByRules('e1', 'a1', '2026-03');
      expect(res.salary).toBe(100);
    });
  });

  describe('calculateSalaryForEmployeeMonth', () => {
    it('returns salary calculation for employee month', async () => {
      getSessionMock.mockResolvedValue({ data: { session: { access_token: 'fake-token' } } });
      invokeMock.mockResolvedValue({ data: { net_salary: 1000 }, error: null });

      const result = await salaryService.calculateSalaryForEmployeeMonth(
        '123e4567-e89b-12d3-a456-426614174000',
        '2026-03',
        'cash',
        100,
        'Penalty'
      );
      expect(result).toEqual({ net_salary: 1000 });
      expect(invokeMock).toHaveBeenCalledWith('salary-engine', {
        body: { mode: 'employee', employee_id: '123e4567-e89b-12d3-a456-426614174000', month_year: '2026-03', payment_method: 'cash', manual_deduction: 100, manual_deduction_note: 'Penalty' },
      });
    });
    
    it('throws error when auth fails', async () => {
      getSessionMock.mockResolvedValueOnce({ data: { session: null } });
      await expect(
        salaryService.calculateSalaryForEmployeeMonth('123e4567-e89b-12d3-a456-426614174000', '2026-03')
      ).rejects.toThrow();
    });
  });

  describe('calculateSalaryForMonth', () => {
    it('returns monthly salary calculation', async () => {
      getSessionMock.mockResolvedValue({ data: { session: { access_token: 'tk' } } });
      invokeMock.mockResolvedValue({ data: { success: true }, error: null });
      const res = await salaryService.calculateSalaryForMonth({ monthYear: '2024-05', paymentMethod: 'bank' });
      expect(res).toEqual({ success: true });
      expect(invokeMock).toHaveBeenCalledWith('salary-engine', {
        body: { mode: 'month', month_year: '2024-05', payment_method: 'bank' },
      });
    });
  });

  describe('getSalaryPreviewForMonth', () => {
    it('returns salary preview data', async () => {
      getSessionMock.mockResolvedValue({ data: { session: { access_token: 'tk' } } });
      invokeMock.mockResolvedValue({ data: [{ eId: 'e1' }], error: null });
      const res = await salaryService.getSalaryPreviewForMonth('2024-05');
      expect(res).toEqual([{ eId: 'e1' }]);
    });
    
    it('falls back to RPC on fetch failure', async () => {
      getSessionMock.mockResolvedValueOnce({ data: { session: { access_token: 'fake-token' } } });
      invokeMock.mockResolvedValueOnce({ data: null, error: new Error('bad') });
      rpcMock.mockResolvedValueOnce({ data: [{ id: '2' }], error: null });
      const res = await salaryService.getSalaryPreviewForMonth('2026-03');
      expect(res).toEqual([{ id: '2' }]);
    });
  });

  describe('getPagedByMonth', () => {
    it('returns paged records', async () => {
      fromMock.mockImplementation(() => {
        return {
          select: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          range: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          or: vi.fn().mockReturnThis(),
          then: (resolve: any) => Promise.resolve({ data: [{ id: '1' }], count: 1, error: null }).then(resolve)
        };
      });
      const res = await salaryService.getPagedByMonth({ monthYear: '2026-03', page: 1, pageSize: 10, filters: { branch: 'makkah', search: 'x', approved: 'approved' } });
      expect(res.rows).toHaveLength(1);
    });
  });

  describe('exportMonth', () => {
    it('fetches chunked records', async () => {
      let callCount = 0;
      fromMock.mockImplementation(() => {
        return {
          select: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          range: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          or: vi.fn().mockReturnThis(),
          then: (resolve: any) => {
            callCount++;
            const data = callCount === 1 ? [{ id: '1' }, { id: '2' }] : [];
            return Promise.resolve({ data, count: 2, error: null }).then(resolve);
          }
        };
      });
      const res = await salaryService.exportMonth({ monthYear: '2026-03', chunkSize: 2, maxRows: 4 });
      expect(res).toHaveLength(2);
    });
  });

  describe('getMonthRecordsForSalaryContext', () => {
    it('fetches records', async () => {
      let rangeCallCount = 0;
      fromMock.mockImplementation(() => {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          range: vi.fn().mockImplementation((_offset) => {
            rangeCallCount++;
            const data = rangeCallCount <= 2 ? [{ id: '1' }] : [];
            return Promise.resolve({ data, error: null });
          })
        };
      });
      const res = await salaryService.getMonthRecordsForSalaryContext('2026-03');
      // page 0 (detect) -> page 1 (has data) -> page 2 (no data)
      expect(res).toHaveLength(1);
    });
  });

  describe('upsert', () => {
    it('returns upserted record', async () => {
      tableMocks.salary_records = { data: { id: '1', employee_id: 'e1' }, error: null };
      const res = await salaryService.upsert({ employee_id: 'e1', month_year: '2026-03' });
      expect(res).toEqual({ id: '1', employee_id: 'e1' });
    });
    it('throws on database error', async () => {
      tableMocks.salary_records = { data: null, error: new Error('conflict') };
      await expect(salaryService.upsert({ employee_id: 'e1', month_year: '2026-03' })).rejects.toThrow('conflict');
    });
  });

  describe('upsertMany', () => {
    it('completes without error on success', async () => {
      tableMocks.salary_records = { error: null };
      await expect(salaryService.upsertMany([{ employee_id: 'e1' }])).resolves.toBeUndefined();
    });
  });

  describe('update', () => {
    it('returns updated record', async () => {
      tableMocks.salary_records = { data: { id: '1', notes: 'x' }, error: null };
      const res = await salaryService.update('1', { notes: 'x' });
      expect(res).toEqual({ id: '1', notes: 'x' });
    });
  });

  describe('approve', () => {
    it('completes without error on success', async () => {
      tableMocks.salary_records = { error: null };
      await expect(salaryService.approve('1')).resolves.toBeUndefined();
    });
  });

  describe('delete', () => {
    it('completes without error on success', async () => {
      tableMocks.salary_records = { error: null };
      await expect(salaryService.delete('1')).resolves.toBeUndefined();
    });
  });

  describe('getMonthTotal', () => {
    it('returns sum', async () => {
      tableMocks.salary_records = { data: [{ net_salary: 100 }, { net_salary: 200 }], error: null };
      const res = await salaryService.getMonthTotal('2026-03');
      expect(res).toBe(300);
    });
  });


});
