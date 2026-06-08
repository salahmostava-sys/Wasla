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


import { advanceService } from './advanceService';

describe('advanceService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetMockTableResults(tableResults);
  });

  describe('getAll', () => {
    it('returns advances', async () => {
      tableResults.advances = { data: [{ id: 'a1' }], error: null };
      const res = await advanceService.getAll();
      expect(res).toEqual([{ id: 'a1' }]);
    });
  });

  describe('getById', () => {
    it('returns single advance', async () => {
      tableResults.advances = { data: { id: 'a1' }, error: null };
      const res = await advanceService.getById('a1');
      expect(res).toEqual({ id: 'a1' });
    });
  });

  describe('create', () => {
    it('creates advance successfully', async () => {
      tableResults.advances = {
        data: { id: 'adv-1', employee_id: 'emp-1', amount: 1000 },
        error: null,
      };

      const result = await advanceService.create({
        employee_id: 'emp-1',
        amount: 1000,
        monthly_amount: 250,
        total_installments: 4,
        disbursement_date: '2026-03-01',
        first_deduction_month: '2026-04',
      });

      expect(result?.id).toBe('adv-1');
      expect(fromMock).toHaveBeenCalledWith('advances');
    });

    it('throws when create advance fails', async () => {
      tableResults.advances = {
        data: null,
        error: new Error('insert failed'),
      };

      await expect(
        advanceService.create({
          employee_id: 'emp-1',
          amount: 1000,
          monthly_amount: 250,
          total_installments: 4,
          disbursement_date: '2026-03-01',
          first_deduction_month: '2026-04',
        }),
      ).rejects.toThrow('insert failed');
    });
  });

  describe('insertMany', () => {
    it('inserts many rows', async () => {
      tableResults.advances = { data: null, error: null };
      await advanceService.insertMany([]);
      expect(fromMock).toHaveBeenCalledWith('advances');
    });
  });

  describe('update', () => {
    it('updates advance', async () => {
      tableResults.advances = { data: null, error: null };
      await advanceService.update('1', { amount: 500 });
      expect(fromMock).toHaveBeenCalledWith('advances');
    });
  });

  describe('updateStatus', () => {
    it('updates status', async () => {
      tableResults.advances = { data: null, error: null };
      await advanceService.updateStatus('1', 'paused');
      expect(fromMock).toHaveBeenCalledWith('advances');
    });
  });

  describe('delete', () => {
    it('deletes advance', async () => {
      tableResults.advances = { data: null, error: null };
      await advanceService.delete('1');
      expect(fromMock).toHaveBeenCalledWith('advances');
    });
  });

  describe('deleteMany', () => {
    it('deletes many advances', async () => {
      tableResults.advances = { data: null, error: null };
      await advanceService.deleteMany(['1']);
      expect(fromMock).toHaveBeenCalledWith('advances');
    });
  });

  describe('writeOffMany', () => {
    it('writes off advances', async () => {
      tableResults.advances = { data: null, error: null };
      await advanceService.writeOffMany(['1'], 'reason');
      expect(fromMock).toHaveBeenCalledWith('advances');
    });
  });

  describe('restoreWrittenOffMany', () => {
    it('restores written off advances', async () => {
      tableResults.advances = { data: null, error: null };
      await advanceService.restoreWrittenOffMany(['1']);
      expect(fromMock).toHaveBeenCalledWith('advances');
    });
  });

  describe('getInstallments', () => {
    it('returns installments', async () => {
      tableResults.advance_installments = { data: [{ id: 'i1' }], error: null };
      const res = await advanceService.getInstallments('a1');
      expect(res).toEqual([{ id: 'i1' }]);
    });
  });

  describe('createInstallments', () => {
    it('inserts installments', async () => {
      tableResults.advance_installments = { data: null, error: null };
      await advanceService.createInstallments([{}]);
      expect(fromMock).toHaveBeenCalledWith('advance_installments');
    });
  });

  describe('updateInstallment', () => {
    it('updates installment', async () => {
      tableResults.advance_installments = { data: null, error: null };
      await advanceService.updateInstallment('i1', { status: 'paid' });
      expect(fromMock).toHaveBeenCalledWith('advance_installments');
    });
  });

  describe('updateInstallmentNote', () => {
    it('updates note', async () => {
      tableResults.advance_installments = { data: null, error: null };
      await advanceService.updateInstallmentNote('i1', 'note');
      expect(fromMock).toHaveBeenCalledWith('advance_installments');
    });
  });

  describe('deleteInstallment', () => {
    it('deletes installment', async () => {
      tableResults.advance_installments = { data: null, error: null };
      await advanceService.deleteInstallment('i1');
      expect(fromMock).toHaveBeenCalledWith('advance_installments');
    });
  });

  describe('deletePendingInstallments', () => {
    it('deletes pending installments', async () => {
      tableResults.advance_installments = { data: null, error: null };
      await advanceService.deletePendingInstallments('a1');
      expect(fromMock).toHaveBeenCalledWith('advance_installments');
    });
  });

  describe('markInstallmentsDeducted', () => {
    it('marks installments deducted', async () => {
      tableResults.advance_installments = { data: null, error: null };
      await advanceService.markInstallmentsDeducted(['i1'], '2026-03-01T00:00:00Z');
      expect(fromMock).toHaveBeenCalledWith('advance_installments');
    });
  });

  describe('getInstallmentsByIds', () => {
    it('returns installments by ids', async () => {
      tableResults.advance_installments = { data: [{ id: 'i1' }], error: null };
      const res = await advanceService.getInstallmentsByIds(['i1']);
      expect(res).toEqual([{ id: 'i1' }]);
    });
  });

  describe('getAdvanceInstallmentStatuses', () => {
    it('returns statuses', async () => {
      tableResults.advance_installments = { data: [{ status: 'pending' }], error: null };
      const res = await advanceService.getAdvanceInstallmentStatuses('a1');
      expect(res).toEqual([{ status: 'pending' }]);
    });
  });

  describe('markAdvanceCompleted', () => {
    it('marks advance completed', async () => {
      tableResults.advances = { data: null, error: null };
      await advanceService.markAdvanceCompleted('a1');
      expect(fromMock).toHaveBeenCalledWith('advances');
    });
  });

  describe('getMonthInstallmentsForAdvances', () => {
    it('returns empty if no ids', async () => {
      const res = await advanceService.getMonthInstallmentsForAdvances('2026-03', []);
      expect(res).toEqual([]);
    });

    it('returns installments', async () => {
      tableResults.advance_installments = { data: [{ id: 'i1' }], error: null };
      const res = await advanceService.getMonthInstallmentsForAdvances('2026-03', ['a1']);
      expect(res).toEqual([{ id: 'i1' }]);
    });
  });

  describe('getPendingInstallmentsForAdvances', () => {
    it('returns empty if no ids', async () => {
      const res = await advanceService.getPendingInstallmentsForAdvances([]);
      expect(res).toEqual([]);
    });

    it('returns chunked installments', async () => {
      tableResults.advance_installments = { data: [{ advance_id: 'a1' }], error: null };
      const ids = Array.from({ length: 250 }, (_, i) => `a${i}`);
      const res = await advanceService.getPendingInstallmentsForAdvances(ids);
      expect(res.length).toBeGreaterThan(0);
    });
  });

  describe('getActiveByEmployee', () => {
    it('returns active advances', async () => {
      tableResults.advances = { data: [{ id: 'a1' }], error: null };
      const res = await advanceService.getActiveByEmployee('e1');
      expect(res).toEqual([{ id: 'a1' }]);
    });
  });

  describe('getActiveAndPausedForSalaryContext', () => {
    it('returns active and paused advances', async () => {
      tableResults.advances = { data: [{ id: 'a1' }], error: null };
      const res = await advanceService.getActiveAndPausedForSalaryContext();
      expect(res).toEqual([{ id: 'a1' }]);
    });
  });

  describe('getEmployees', () => {
    it('returns active employees', async () => {
      tableResults.employees = { data: [{ id: 'e1', name: 'John' }], error: null };
      const res = await advanceService.getEmployees();
      expect(res).toEqual([{ id: 'e1', name: 'John' }]);
    });
  });
});
