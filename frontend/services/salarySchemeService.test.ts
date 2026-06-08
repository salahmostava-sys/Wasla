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


import { salarySchemeService } from './salarySchemeService';

describe('salarySchemeService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetMockTableResults(tableResults);
  });

  describe('getSchemes', () => {
    it('returns schemes successfully', async () => {
      tableResults.salary_schemes = { data: [{ id: 'scheme1' }], error: null };
      const result = await salarySchemeService.getSchemes();
      expect(fromMock).toHaveBeenCalledWith('salary_schemes');
      expect(result).toEqual([{ id: 'scheme1' }]);
    });
  });

  describe('getTiers', () => {
    it('returns tiers', async () => {
      tableResults.salary_scheme_tiers = { data: [{ id: 'tier1' }], error: null };
      const res = await salarySchemeService.getTiers();
      expect(fromMock).toHaveBeenCalledWith('salary_scheme_tiers');
      expect(res).toEqual([{ id: 'tier1' }]);
    });
  });

  describe('getSnapshots', () => {
    it('returns snapshots', async () => {
      tableResults.scheme_month_snapshots = { data: [{ scheme_id: 's1', month_year: '2024-05' }], error: null };
      const res = await salarySchemeService.getSnapshots();
      expect(fromMock).toHaveBeenCalledWith('scheme_month_snapshots');
      expect(res).toEqual([{ scheme_id: 's1', month_year: '2024-05' }]);
    });
  });

  describe('updateScheme', () => {
    it('updates scheme', async () => {
      tableResults.salary_schemes = { data: null, error: null };
      await salarySchemeService.updateScheme('s1', { name: 'test' } as any);
      expect(fromMock).toHaveBeenCalledWith('salary_schemes');
    });
  });

  describe('createScheme', () => {
    it('creates a new scheme and returns its id', async () => {
      tableResults.salary_schemes = { data: { id: 'scheme1' }, error: null };

      const payload = {
        name: 'New Scheme',
        scheme_type: 'order_based' as const,
        monthly_amount: null,
        target_orders: null,
        target_bonus: null,
      };

      const result = await salarySchemeService.createScheme(payload);
      expect(fromMock).toHaveBeenCalledWith('salary_schemes');
      expect(result).toEqual({ id: 'scheme1' });
    });
  });

  describe('deleteSchemeTiers', () => {
    it('deletes tiers', async () => {
      tableResults.salary_scheme_tiers = { data: null, error: null };
      await salarySchemeService.deleteSchemeTiers('s1');
      expect(fromMock).toHaveBeenCalledWith('salary_scheme_tiers');
    });
  });

  describe('insertSchemeTiers', () => {
    it('inserts tiers', async () => {
      tableResults.salary_scheme_tiers = { data: null, error: null };
      await salarySchemeService.insertSchemeTiers([{} as any]);
      expect(fromMock).toHaveBeenCalledWith('salary_scheme_tiers');
    });
  });

  describe('updateSchemeStatus', () => {
    it('updates status', async () => {
      tableResults.salary_schemes = { data: null, error: null };
      await salarySchemeService.updateSchemeStatus('s1', 'active');
      expect(fromMock).toHaveBeenCalledWith('salary_schemes');
    });
  });

  describe('upsertSnapshot', () => {
    it('upserts a scheme snapshot successfully', async () => {
      tableResults.scheme_month_snapshots = { data: null, error: null };
      const snapshot = { name: 'New Scheme' };
      await salarySchemeService.upsertSnapshot('scheme1', '2026-03', snapshot);
      expect(fromMock).toHaveBeenCalledWith('scheme_month_snapshots');
    });

    it('throws error when supabase fails', async () => {
      tableResults.scheme_month_snapshots = { data: null, error: new Error('db error') };
      await expect(
        salarySchemeService.upsertSnapshot('scheme1', '2026-03', {})
      ).rejects.toThrow('db error');
    });
  });

  describe('deleteSnapshot', () => {
    it('deletes snapshot', async () => {
      tableResults.scheme_month_snapshots = { data: null, error: null };
      await salarySchemeService.deleteSnapshot('s1', '2024-05');
      expect(fromMock).toHaveBeenCalledWith('scheme_month_snapshots');
    });
  });
});
