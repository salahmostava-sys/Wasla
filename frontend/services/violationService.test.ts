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
  supabase: { from: fromMock },
}));


import { violationService } from './violationService';

describe('violationService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetMockTableResults(tableResults);
  });

  describe('getViolations', () => {
    it('returns rows on success', async () => {
      tableResults.external_deductions = {
        data: [{ id: 'd1', employee_id: 'e1', amount: 100, incident_date: '2026-03-01', apply_month: '2026-03', approval_status: 'pending', note: null }],
        error: null,
      };

      const rows = await violationService.getViolations();
      expect(rows).toHaveLength(1);
      expect(rows[0].id).toBe('d1');
      expect(fromMock).toHaveBeenCalledWith('external_deductions');
    });

    it('throws on Supabase error', async () => {
      tableResults.external_deductions = { data: null, error: new Error('rls') };
      await expect(violationService.getViolations()).rejects.toThrow('rls');
    });
  });

  describe('findVehiclesByPlateQuery', () => {
    it('returns matches on success', async () => {
      tableResults.vehicles = {
        data: [{ id: 'v1', plate_number: 'أ ب ج', plate_number_en: null, brand: 'X', type: 'car' }],
        error: null,
      };

      const rows = await violationService.findVehiclesByPlateQuery('أ');
      expect(rows).toHaveLength(1);
      expect(fromMock).toHaveBeenCalledWith('vehicles');
    });

    it('throws on Supabase error', async () => {
      tableResults.vehicles = { data: null, error: new Error('conn refused') };
      await expect(violationService.findVehiclesByPlateQuery('x')).rejects.toThrow('conn refused');
    });
  });

  describe('findVehicleIdsByPlate', () => {
    it('returns vehicle ids', async () => {
      tableResults.vehicles = { data: [{ id: 'v1' }], error: null };
      const res = await violationService.findVehicleIdsByPlate('123');
      expect(res).toEqual([{ id: 'v1' }]);
    });
  });

  describe('getAssignmentsByVehicleIds', () => {
    it('returns assignments', async () => {
      tableResults.vehicle_assignments = { data: [{ id: 'a1' }], error: null };
      const res = await violationService.getAssignmentsByVehicleIds(['v1']);
      expect(res).toEqual([{ id: 'a1' }]);
    });
  });

  describe('getExistingFineDeductions', () => {
    it('returns existing deductions', async () => {
      tableResults.external_deductions = { data: [{ id: 'd1' }], error: null };
      const res = await violationService.getExistingFineDeductions(['e1'], '2026-03-01', '2026-03');
      expect(res).toEqual([{ id: 'd1' }]);
    });
  });

  describe('createFineDeduction', () => {
    it('creates fine deduction', async () => {
      tableResults.external_deductions = { data: { id: 'd1' }, error: null };
      const res = await violationService.createFineDeduction({});
      expect(res).toEqual({ id: 'd1' });
    });
  });

  describe('updateViolation', () => {
    it('updates violation', async () => {
      tableResults.external_deductions = { data: null, error: null };
      await violationService.updateViolation('1', {});
      expect(fromMock).toHaveBeenCalledWith('external_deductions');
    });
  });

  describe('deleteViolation', () => {
    it('resolves when delete succeeds', async () => {
      tableResults.external_deductions = { data: null, error: null };
      await expect(violationService.deleteViolation('d1')).resolves.toBeUndefined();
    });

    it('throws on Supabase error', async () => {
      tableResults.external_deductions = { data: null, error: new Error('fk') };
      await expect(violationService.deleteViolation('d1')).rejects.toThrow('fk');
    });
  });

  describe('findMatchingAdvanceForFine', () => {
    it('returns matching advance', async () => {
      tableResults.advances = { data: [{ id: 'a1' }], error: null };
      const res = await violationService.findMatchingAdvanceForFine('e1', '2026-03', 10, 100);
      expect(res).toEqual([{ id: 'a1' }]);
    });
  });

  describe('createAdvanceFromFine', () => {
    it('creates advance', async () => {
      tableResults.advances = { data: { id: 'a1' }, error: null };
      const res = await violationService.createAdvanceFromFine({});
      expect(res).toEqual({ id: 'a1' });
    });
  });

  describe('createSingleInstallment', () => {
    it('creates single installment', async () => {
      tableResults.advance_installments = { data: null, error: null };
      await violationService.createSingleInstallment({});
      expect(fromMock).toHaveBeenCalledWith('advance_installments');
    });
  });
});
