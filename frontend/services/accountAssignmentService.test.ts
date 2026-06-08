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


import { accountAssignmentService } from './accountAssignmentService';

describe('accountAssignmentService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetMockTableResults(tableResults);
  });

  describe('getActiveAssignments', () => {
    it('returns active assignments', async () => {
      tableResults.account_assignments = { data: [{ id: '1' }], error: null };
      const res = await accountAssignmentService.getActiveAssignments();
      expect(fromMock).toHaveBeenCalledWith('account_assignments');
      expect(res).toEqual([{ id: '1' }]);
    });
  });

  describe('getAssignmentsForMonthYear', () => {
    it('returns assignments for month', async () => {
      tableResults.account_assignments = { data: [{ id: '1' }], error: null };
      const res = await accountAssignmentService.getAssignmentsForMonthYear('2026-04');
      expect(fromMock).toHaveBeenCalledWith('account_assignments');
      expect(res).toEqual([{ id: '1' }]);
    });
  });

  describe('getHistoryByAccountId', () => {
    it('returns history', async () => {
      tableResults.account_assignments = { data: [{ id: '1' }], error: null };
      const res = await accountAssignmentService.getHistoryByAccountId('acc-1');
      expect(fromMock).toHaveBeenCalledWith('account_assignments');
      expect(res).toEqual([{ id: '1' }]);
    });
  });

  describe('getOpenAssignmentIdsByAccount', () => {
    it('returns open assignment ids', async () => {
      tableResults.account_assignments = { data: [{ id: '1' }], error: null };
      const res = await accountAssignmentService.getOpenAssignmentIdsByAccount('acc-1');
      expect(fromMock).toHaveBeenCalledWith('account_assignments');
      expect(res).toEqual([{ id: '1' }]);
    });
  });

  describe('closeAssignmentsByIds', () => {
    it('closes assignments', async () => {
      tableResults.account_assignments = { data: [{ id: '1' }], error: null };
      await accountAssignmentService.closeAssignmentsByIds(['1'], '2026-04-02');
      expect(fromMock).toHaveBeenCalledWith('account_assignments');
    });
  });

  describe('createAssignment', () => {
    it('creates assignment', async () => {
      tableResults.account_assignments = { data: [{ id: '1' }], error: null };
      await accountAssignmentService.createAssignment({} as any);
      expect(fromMock).toHaveBeenCalledWith('account_assignments');
    });
  });

  describe('assignPlatformAccount', () => {
    it('calls the atomic assignment rpc and returns its row', async () => {
      rpcMock.mockResolvedValueOnce({
        data: {
          id: 'assignment-1',
          account_id: 'account-1',
          employee_id: 'employee-1',
          start_date: '2026-04-02',
          end_date: null,
          month_year: '2026-04',
          notes: 'handover',
          created_at: '2026-04-02T00:00:00Z',
        },
        error: null,
      });

      const result = await accountAssignmentService.assignPlatformAccount({
        account_id: 'account-1',
        employee_id: 'employee-1',
        start_date: '2026-04-02',
        notes: 'handover',
        created_by: 'user-1',
      });

      expect(rpcMock).toHaveBeenCalledWith('assign_platform_account', {
        p_account_id: 'account-1',
        p_employee_id: 'employee-1',
        p_start_date: '2026-04-02',
        p_notes: 'handover',
        p_created_by: 'user-1',
      });
      expect(result.id).toBe('assignment-1');
      expect(result.employee_id).toBe('employee-1');
    });

    it('throws when the rpc fails', async () => {
      rpcMock.mockResolvedValueOnce({
        data: null,
        error: new Error('rpc failed'),
      });

      await expect(
        accountAssignmentService.assignPlatformAccount({
          account_id: 'account-1',
          employee_id: 'employee-1',
          start_date: '2026-04-02',
          notes: null,
          created_by: null,
        }),
      ).rejects.toThrow('rpc failed');
    });
  });
});
