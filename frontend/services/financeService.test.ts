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


import { financeService } from './financeService';

// Helper to reset the shared tableResults object between tests
function clearTableResults() {
  for (const k of Object.keys(tableResults)) {
    delete tableResults[k];
  }
}

describe('financeService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearTableResults();
  });

  // ── getByMonth ────────────────────────────────────────────────────────────
  describe('getByMonth', () => {
    it('returns transactions sorted by date desc', async () => {
      tableResults.finance_transactions = {
        data: [
          { id: '1', type: 'revenue', amount: 5000, month_year: '2026-04', date: '2026-04-15' },
          { id: '2', type: 'expense', amount: 3000, month_year: '2026-04', date: '2026-04-10' },
        ],
        error: null,
      };
      const result = await financeService.getByMonth('2026-04');
      expect(result).toHaveLength(2);
      expect(fromMock).toHaveBeenCalledWith('finance_transactions');
    });

    it('returns empty array when data is null', async () => {
      tableResults.finance_transactions = { data: null, error: null };
      expect(await financeService.getByMonth('2026-04')).toEqual([]);
    });

    it('throws on error', async () => {
      tableResults.finance_transactions = { data: null, error: new Error('DB error') };
      await expect(financeService.getByMonth('2026-04')).rejects.toThrow('DB error');
    });
  });

  // ── getMonthlySummary ─────────────────────────────────────────────────────
  describe('getMonthlySummary', () => {
    it('calculates revenue, expenses, and balance', async () => {
      tableResults.finance_transactions = {
        data: [
          { id: '1', type: 'revenue', amount: 10000, month_year: '2026-04' },
          { id: '2', type: 'expense', amount: 6000, month_year: '2026-04' },
          { id: '3', type: 'expense', amount: 2000, month_year: '2026-04' },
        ],
        error: null,
      };
      const summary = await financeService.getMonthlySummary('2026-04');
      expect(summary.revenue).toBe(10000);
      expect(summary.expenses).toBe(8000);
      expect(summary.balance).toBe(2000);
      expect(summary.transactions).toHaveLength(3);
    });

    it('returns zeroes when no transactions exist', async () => {
      tableResults.finance_transactions = { data: [], error: null };
      const summary = await financeService.getMonthlySummary('2026-04');
      expect(summary.revenue).toBe(0);
      expect(summary.expenses).toBe(0);
      expect(summary.balance).toBe(0);
    });

    it('handles negative balance (expenses > revenue)', async () => {
      tableResults.finance_transactions = {
        data: [
          { id: '1', type: 'revenue', amount: 1000, month_year: '2026-04' },
          { id: '2', type: 'expense', amount: 4000, month_year: '2026-04' },
        ],
        error: null,
      };
      const summary = await financeService.getMonthlySummary('2026-04');
      expect(summary.balance).toBe(-3000);
    });

    it('throws when getByMonth fails', async () => {
      tableResults.finance_transactions = { data: null, error: new Error('conn lost') };
      await expect(financeService.getMonthlySummary('2026-04')).rejects.toThrow('conn lost');
    });
  });

  // ── create ────────────────────────────────────────────────────────────────
  describe('create', () => {
    it('inserts a transaction and returns it', async () => {
      tableResults.finance_transactions = {
        data: { id: 'new-1', type: 'revenue', amount: 500, month_year: '2026-04' },
        error: null,
      };
      const result = await financeService.create({
        type: 'revenue',
        category: 'توصيل',
        amount: 500,
        month_year: '2026-04',
        date: '2026-04-20',
      });
      expect(result).toBeDefined();
      expect(fromMock).toHaveBeenCalledWith('finance_transactions');
    });

    it('inserts is_auto=false for manual transactions', async () => {
      tableResults.finance_transactions = {
        data: { id: 'new-2', is_auto: false },
        error: null,
      };
      const result = await financeService.create({
        type: 'expense',
        category: 'وقود',
        amount: 200,
        month_year: '2026-04',
        date: '2026-04-10',
      });
      expect(result).toBeDefined();
    });

    it('throws on insert error', async () => {
      tableResults.finance_transactions = { data: null, error: new Error('constraint violation') };
      await expect(
        financeService.create({ type: 'expense', category: 'وقود', amount: 200, month_year: '2026-04', date: '2026-04-10' }),
      ).rejects.toThrow('constraint violation');
    });
  });

  // ── update ────────────────────────────────────────────────────────────────
  describe('update', () => {
    it('resolves without error on success', async () => {
      tableResults.finance_transactions = { data: null, error: null };
      await expect(financeService.update('tx-1', { amount: 9000 })).resolves.toBeUndefined();
    });

    it('throws on update error', async () => {
      tableResults.finance_transactions = { data: null, error: new Error('locked row') };
      await expect(financeService.update('tx-1', { amount: 0 })).rejects.toThrow('locked row');
    });
  });

  // ── delete ────────────────────────────────────────────────────────────────
  describe('delete', () => {
    it('resolves without error on success', async () => {
      tableResults.finance_transactions = { data: null, error: null };
      await expect(financeService.delete('tx-1')).resolves.toBeUndefined();
    });

    it('throws on error', async () => {
      tableResults.finance_transactions = { data: null, error: new Error('access denied') };
      await expect(financeService.delete('tx-1')).rejects.toThrow('access denied');
    });
  });
});
