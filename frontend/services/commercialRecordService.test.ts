import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createQueryBuilder, type MockQueryResult } from '@shared/test/mocks/supabaseClientMock';

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


import { commercialRecordService, COMMERCIAL_RECORDS_MIGRATION_REQUIRED_MESSAGE } from './commercialRecordService';

describe('commercialRecordService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    for (const k of Object.keys(tableResults)) delete tableResults[k];
  });

  describe('listCatalog', () => {
    it('merges managed and legacy commercial records with usage counts', async () => {
      tableResults.commercial_records = {
        data: [{
          id: 'cr-1',
          name: 'سجل مكة',
          registration_number: '1010',
          residency_renewal_monthly_cost: 650,
        }],
        error: null,
      };
      tableResults.employees = {
        data: [
          { commercial_record: 'سجل مكة' },
          { commercial_record: 'سجل مكة' },
          { commercial_record: 'سجل جدة' },
        ],
        error: null,
      };

      const result = await commercialRecordService.listCatalog();

      expect(result.tableAvailable).toBe(true);
      expect(result.records).toEqual([
        {
          id: 'cr-1',
          name: 'سجل مكة',
          registration_number: '1010',
          residency_renewal_monthly_cost: 650,
          usage_count: 2,
          source: 'managed',
        },
        {
          id: null,
          name: 'سجل جدة',
          registration_number: null,
          residency_renewal_monthly_cost: null,
          usage_count: 1,
          source: 'legacy',
        },
      ]);
    });

    it('falls back to legacy values when managed table is missing', async () => {
      tableResults.commercial_records = {
        data: null,
        error: new Error('relation "public.commercial_records" does not exist'),
      };
      tableResults.employees = {
        data: [{ commercial_record: 'سجل رئيسي' }],
        error: null,
      };

      const result = await commercialRecordService.listCatalog();

      expect(result.tableAvailable).toBe(false);
      expect(result.records).toEqual([
        {
          id: null,
          name: 'سجل رئيسي',
          registration_number: null,
          residency_renewal_monthly_cost: null,
          usage_count: 1,
          source: 'legacy',
        },
      ]);
    });

    it('throws when getting employees fails', async () => {
      tableResults.employees = { data: null, error: new Error('rls') };
      await expect(commercialRecordService.listCatalog()).rejects.toThrow('rls');
    });

    it('throws when getting records fails with non-missing error', async () => {
      tableResults.employees = { data: [], error: null };
      tableResults.commercial_records = { data: null, error: new Error('connection refused') };
      await expect(commercialRecordService.listCatalog()).rejects.toThrow('connection refused');
    });
  });

  describe('createRecord', () => {
    it('creates record successfully', async () => {
      tableResults.commercial_records = {
        data: {
          id: 'cr-1',
          name: 'New',
          registration_number: '123',
          residency_renewal_monthly_cost: 900,
        },
        error: null,
      };
      const res = await commercialRecordService.createRecord({
        name: 'New',
        registration_number: '123',
        residency_renewal_monthly_cost: 900,
      });
      expect(res).toEqual({
        id: 'cr-1',
        name: 'New',
        registration_number: '123',
        residency_renewal_monthly_cost: 900,
      });
    });

    it('throws when name is empty', async () => {
      await expect(commercialRecordService.createRecord({ name: '   ' })).rejects.toThrow('اسم السجل التجاري مطلوب');
    });

    it('throws when residency renewal cost is negative', async () => {
      await expect(commercialRecordService.createRecord({
        name: 'New',
        residency_renewal_monthly_cost: -1,
      })).rejects.toThrow('تكلفة تجديد الإقامة الشهرية يجب أن تكون رقماً موجباً أو صفراً');
    });

    it('throws migration error when table is missing', async () => {
      tableResults.commercial_records = { data: null, error: new Error('commercial_records does not exist') };
      await expect(commercialRecordService.createRecord({ name: 'New' })).rejects.toThrow(COMMERCIAL_RECORDS_MIGRATION_REQUIRED_MESSAGE);
    });

    it('throws normal error when db fails', async () => {
      tableResults.commercial_records = { data: null, error: new Error('db error') };
      await expect(commercialRecordService.createRecord({ name: 'New' })).rejects.toThrow('db error');
    });
  });

  describe('updateRecord', () => {
    it('updates record successfully', async () => {
      tableResults.commercial_records = { data: null, error: null };
      tableResults.employees = { data: null, error: null };
      await commercialRecordService.updateRecord(
        'cr-1',
        { name: 'New Name', registration_number: '222', residency_renewal_monthly_cost: 800 },
        { name: 'Old Name', registration_number: '111', residency_renewal_monthly_cost: 600 },
      );
      expect(fromMock).toHaveBeenCalledWith('commercial_records');
      expect(fromMock).toHaveBeenCalledWith('employees');
    });

    it('updates without sync if name is unchanged', async () => {
      tableResults.commercial_records = { data: null, error: null };
      await commercialRecordService.updateRecord(
        'cr-1',
        { name: 'Old Name', registration_number: '222', residency_renewal_monthly_cost: 800 },
        { name: 'Old Name', registration_number: '111', residency_renewal_monthly_cost: 600 },
      );
      expect(fromMock).toHaveBeenCalledWith('commercial_records');
      expect(fromMock).not.toHaveBeenCalledWith('employees');
    });

    it('throws when name is empty', async () => {
      await expect(commercialRecordService.updateRecord('cr-1', { name: '  ' }, { name: 'Old' })).rejects.toThrow('اسم السجل التجاري مطلوب');
    });

    it('throws migration error when table is missing', async () => {
      tableResults.commercial_records = { data: null, error: new Error('commercial_records does not exist') };
      await expect(commercialRecordService.updateRecord('cr-1', { name: 'New' }, { name: 'Old' })).rejects.toThrow(COMMERCIAL_RECORDS_MIGRATION_REQUIRED_MESSAGE);
    });

    it('throws when record update fails', async () => {
      tableResults.commercial_records = { data: null, error: new Error('db error') };
      await expect(commercialRecordService.updateRecord('cr-1', { name: 'New' }, { name: 'Old' })).rejects.toThrow('db error');
    });

    it('throws and rolls back when employee sync fails', async () => {
      // It calls update on commercial_records (success), then update on employees (fails),
      // then update on commercial_records again (rollback).
      const mockUpdate = vi.fn()
        .mockReturnValueOnce({ eq: vi.fn().mockResolvedValue({ error: null }) }) // commercial_records success
        .mockReturnValueOnce({ eq: vi.fn().mockResolvedValue({ error: new Error('sync fail') }) }) // employees fail
        .mockReturnValueOnce({ eq: vi.fn().mockResolvedValue({ error: null }) }); // rollback

      const originalImpl = fromMock.getMockImplementation();
      fromMock.mockImplementation((table) => {
        if (table === 'commercial_records' || table === 'employees') {
          return { update: mockUpdate } as any;
        }
        return createQueryBuilder({ data: null, error: null });
      });

      await expect(commercialRecordService.updateRecord(
        'cr-1',
        { name: 'New', registration_number: '222', residency_renewal_monthly_cost: 800 },
        { name: 'Old', registration_number: '111', residency_renewal_monthly_cost: 600 },
      )).rejects.toThrow('sync fail');
      expect(mockUpdate).toHaveBeenCalledTimes(3);
      fromMock.mockImplementation(originalImpl as any);
    });
  });

  describe('deleteRecord', () => {
    it('deletes record successfully', async () => {
      tableResults.commercial_records = { data: null, error: null };
      await commercialRecordService.deleteRecord('cr-1');
      expect(fromMock).toHaveBeenCalledWith('commercial_records');
    });

    it('throws migration error when table is missing', async () => {
      tableResults.commercial_records = { data: null, error: new Error('commercial_records does not exist') };
      await expect(commercialRecordService.deleteRecord('cr-1')).rejects.toThrow(COMMERCIAL_RECORDS_MIGRATION_REQUIRED_MESSAGE);
    });

    it('throws when delete fails', async () => {
      tableResults.commercial_records = { data: null, error: new Error('db error') };
      await expect(commercialRecordService.deleteRecord('cr-1')).rejects.toThrow('db error');
    });
  });
});

