import { beforeEach, describe, expect, it, vi } from 'vitest';

const { fromMock, rpcMock, getSessionMock, invokeMock, callServerFunctionMock } = vi.hoisted(() => ({
  fromMock: vi.fn(),
  rpcMock: vi.fn(),
  getSessionMock: vi.fn(),
  invokeMock: vi.fn(),
  callServerFunctionMock: vi.fn(),
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

vi.mock('@services/serverFunction', () => ({
  callServerFunction: callServerFunctionMock,
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
      const p: any = Promise.resolve(mockObj);
      p.select = vi.fn().mockReturnValue(p);
      p.insert = vi.fn().mockReturnValue(p);
      p.update = vi.fn().mockReturnValue(p);
      p.upsert = vi.fn().mockReturnValue(p);
      p.delete = vi.fn().mockReturnValue(p);
      p.eq = vi.fn().mockReturnValue(p);
      p.in = vi.fn().mockReturnValue(p);
      p.or = vi.fn().mockReturnValue(p);
      p.gte = vi.fn().mockReturnValue(p);
      p.lte = vi.fn().mockReturnValue(p);
      p.order = vi.fn().mockReturnValue(p);
      p.limit = vi.fn().mockReturnValue(p);
      p.range = vi.fn().mockReturnValue(p);
      p.single = vi.fn().mockResolvedValue(mockObj);
      p.maybeSingle = vi.fn().mockResolvedValue(mockObj);
      return p;
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
      callServerFunctionMock.mockResolvedValue({ net_salary: 1000 });

      const result = await salaryService.calculateSalaryForEmployeeMonth(
        '123e4567-e89b-12d3-a456-426614174000',
        '2026-03',
        'cash',
        100,
        'Penalty'
      );
      expect(result).toEqual({ net_salary: 1000 });
      expect(callServerFunctionMock).toHaveBeenCalledWith('salary-engine', {
        mode: 'employee',
        employee_id: '123e4567-e89b-12d3-a456-426614174000',
        month_year: '2026-03',
        payment_method: 'cash',
        manual_deduction: 100,
        manual_deduction_note: 'Penalty',
      });
    });
    
    it('throws error when auth fails', async () => {
      callServerFunctionMock.mockRejectedValueOnce(new Error('Not authenticated'));
      await expect(
        salaryService.calculateSalaryForEmployeeMonth('123e4567-e89b-12d3-a456-426614174000', '2026-03')
      ).rejects.toThrow();
    });
  });

  describe('calculateSalaryForMonth', () => {
    it('returns monthly salary calculation', async () => {
      callServerFunctionMock.mockResolvedValue({ success: true });
      const res = await salaryService.calculateSalaryForMonth({ monthYear: '2024-05', paymentMethod: 'bank' });
      expect(res).toEqual({ success: true });
      expect(callServerFunctionMock).toHaveBeenCalledWith('salary-engine', {
        mode: 'month',
        month_year: '2024-05',
        payment_method: 'bank',
      });
    });
  });

  describe('getSalaryPreviewForMonth', () => {
    it('returns salary preview rows from a direct array response', async () => {
      callServerFunctionMock.mockResolvedValue([{ eId: 'e1' }]);
      const res = await salaryService.getSalaryPreviewForMonth('2024-05');
      expect(res).toEqual([{ eId: 'e1' }]);
    });

    it('unwraps salary-engine payloads wrapped in { data }', async () => {
      callServerFunctionMock.mockResolvedValue({ data: [{ eId: 'e2' }] });
      const res = await salaryService.getSalaryPreviewForMonth('2026-03');
      expect(res).toEqual([{ eId: 'e2' }]);
    });

    it('propagates salary-engine failures', async () => {
      callServerFunctionMock.mockRejectedValueOnce(new Error('network error'));
      await expect(salaryService.getSalaryPreviewForMonth('2026-03')).rejects.toThrow('network error');
    });
  });

  describe('getPagedByMonth', () => {
    it('returns paged records', async () => {
      fromMock.mockImplementation(() => {
        const p: any = Promise.resolve({ data: [{ id: '1' }], count: 1, error: null });
        p.select = vi.fn().mockReturnValue(p);
        p.order = vi.fn().mockReturnValue(p);
        p.range = vi.fn().mockReturnValue(p);
        p.eq = vi.fn().mockReturnValue(p);
        p.or = vi.fn().mockReturnValue(p);
        return p;
      });
      const res = await salaryService.getPagedByMonth({ monthYear: '2026-03', page: 1, pageSize: 10, filters: { branch: 'makkah', search: 'x', approved: 'approved' } });
      expect(res.rows).toHaveLength(1);
    });
  });

  describe('exportMonth', () => {
    it('fetches chunked records', async () => {
      let callCount = 0;
      fromMock.mockImplementation(() => {
        callCount++;
        const data = callCount === 1 ? [{ id: '1' }, { id: '2' }] : [];
        const p: any = Promise.resolve({ data, count: 2, error: null });
        p.select = vi.fn().mockReturnValue(p);
        p.order = vi.fn().mockReturnValue(p);
        p.range = vi.fn().mockReturnValue(p);
        p.eq = vi.fn().mockReturnValue(p);
        p.or = vi.fn().mockReturnValue(p);
        return p;
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

  describe('deleteByEmployeeMonth', () => {
    it('completes without error on success', async () => {
      tableMocks.salary_records = { error: null };
      await expect(
        salaryService.deleteByEmployeeMonth('e1', '2026-03'),
      ).resolves.toBeUndefined();
    });
  });

  describe('updateWithVersionCheck', () => {
    it('returns no conflict when a row was updated', async () => {
      tableMocks.salary_records = { data: [{ id: '1' }], error: null };
      const res = await salaryService.updateWithVersionCheck('1', 2, { is_approved: true });
      expect(res).toEqual({ conflict: false });
    });
    it('returns a conflict when no row matched the expected version', async () => {
      tableMocks.salary_records = { data: [], error: null };
      const res = await salaryService.updateWithVersionCheck('1', 2, { is_approved: true });
      expect(res).toEqual({ conflict: true });
    });
    it('throws on a non-conflict database error', async () => {
      tableMocks.salary_records = { data: null, error: new Error('boom') };
      await expect(
        salaryService.updateWithVersionCheck('1', 2, { is_approved: true }),
      ).rejects.toThrow('boom');
    });
  });

  describe('insertNew', () => {
    it('returns no conflict on success', async () => {
      tableMocks.salary_records = { error: null };
      const res = await salaryService.insertNew({ employee_id: 'e1', month_year: '2026-03' });
      expect(res).toEqual({ conflict: false });
    });
    it('returns a conflict on a unique-violation error', async () => {
      tableMocks.salary_records = { error: { code: '23505', message: 'duplicate key' } };
      const res = await salaryService.insertNew({ employee_id: 'e1', month_year: '2026-03' });
      expect(res).toEqual({ conflict: true });
    });
    it('throws on any other database error', async () => {
      tableMocks.salary_records = { error: { code: '22P02', message: 'bad input' } };
      await expect(
        salaryService.insertNew({ employee_id: 'e1', month_year: '2026-03' }),
      ).rejects.toThrow('bad input');
    });
  });

  describe('getCurrentVersionsForMonth', () => {
    it('returns employee/version pairs', async () => {
      tableMocks.salary_records = {
        data: [{ employee_id: 'e1', version: 3 }],
        error: null,
      };
      const res = await salaryService.getCurrentVersionsForMonth('2026-03', ['e1']);
      expect(res).toEqual([{ employee_id: 'e1', version: 3 }]);
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
