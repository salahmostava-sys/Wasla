import { beforeEach, describe, expect, it, vi } from 'vitest';

type QueryResult = {
  data?: unknown;
  error?: unknown;
};

function createTrackedBuilder(result: QueryResult) {
  const settled = Promise.resolve(result);
  const p: any = Promise.resolve(result);
    p.select = vi.fn(() => puilder);
    p.upsert = vi.fn(() => puilder);
    p.delete = vi.fn(() => puilder);
    p.eq = vi.fn(() => puilder);
    p.in = vi.fn(() => puilder);
    return p;
}

const { fromMock, getUserMock, channelMock } = vi.hoisted(() => {
  const channel = {
    on: vi.fn(() => channel),
    subscribe: vi.fn(),
  };
  return {
    fromMock: vi.fn(),
    getUserMock: vi.fn(),
    channelMock: vi.fn(() => channel),
  };
});

vi.mock('./supabase/client', () => ({
  supabase: {
    from: fromMock,
    channel: channelMock,
    auth: {
      getUser: getUserMock,
    },
  },
}));

vi.mock('./serviceError', () => ({
  throwIfError: vi.fn((error: unknown, context: string) => {
    if (!error) return;
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`${context}: ${message}`);
  }),
}));

import { salaryDraftService } from './salaryDraftService';

describe('salaryDraftService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getUserMock.mockResolvedValue({ data: { user: { id: 'user-42' } }, error: null });
  });

  describe('getDraftsForMonth', () => {
    it('scopes getDraftsForMonth to the authenticated user', async () => {
      const builder = createTrackedBuilder({
        data: [
          {
            employee_id: 'emp-1',
            draft_data: { incentives: 25 },
          },
        ],
        error: null,
      });
      fromMock.mockReturnValue(builder);

      const result = await salaryDraftService.getDraftsForMonth('2026-04');

      expect(fromMock).toHaveBeenCalledWith('salary_drafts');
      expect(builder.select).toHaveBeenCalledWith('employee_id, draft_data');
      expect(builder.eq).toHaveBeenNthCalledWith(1, 'month_year', '2026-04');
      expect(builder.eq).toHaveBeenNthCalledWith(2, 'user_id', 'user-42');
      expect(result).toEqual({
        'emp-1-2026-04': { incentives: 25 },
      });
    });

    it('returns no drafts when there is no authenticated user', async () => {
      getUserMock.mockResolvedValue({ data: { user: null }, error: null });

      const result = await salaryDraftService.getDraftsForMonth('2026-04');

      expect(result).toEqual({});
      expect(fromMock).not.toHaveBeenCalled();
    });

    it('throws if getUser fails for required calls', async () => {
      getUserMock.mockResolvedValue({ data: { user: null }, error: new Error('auth') });
      await expect(salaryDraftService.saveDraft('2026-04', 'e1', {})).rejects.toThrow('salaryDraftService.saveDraft.getUser: auth');
    });

    it('throws if user is null for required calls', async () => {
      getUserMock.mockResolvedValue({ data: { user: null }, error: null });
      await expect(salaryDraftService.saveDraft('2026-04', 'e1', {})).rejects.toThrow('User not authenticated');
    });
  });

  describe('saveDraft', () => {
    it('saves draft successfully', async () => {
      const builder = createTrackedBuilder({ data: null, error: null });
      fromMock.mockReturnValue(builder);

      await salaryDraftService.saveDraft('2026-04', 'e1', { incentives: 100 });

      expect(builder.upsert).toHaveBeenCalledWith(
        { month_year: '2026-04', employee_id: 'e1', draft_data: { incentives: 100 }, user_id: 'user-42' },
        { onConflict: 'user_id,month_year,employee_id' }
      );
    });
  });

  describe('saveDraftsBatch', () => {
    it('returns early if drafts is empty', async () => {
      await salaryDraftService.saveDraftsBatch('2026-04', {});
      expect(fromMock).not.toHaveBeenCalled();
    });

    it('saves multiple drafts', async () => {
      const builder = createTrackedBuilder({ data: null, error: null });
      fromMock.mockReturnValue(builder);

      await salaryDraftService.saveDraftsBatch('2026-04', { 'e1-2026-04': { incentives: 100 } });

      expect(builder.upsert).toHaveBeenCalledWith(
        [
          { user_id: 'user-42', month_year: '2026-04', employee_id: 'e1', draft_data: { incentives: 100 } }
        ],
        { onConflict: 'user_id,month_year,employee_id' }
      );
    });
  });

  describe('syncDraftsForMonth', () => {
    it('limits stale-draft cleanup in syncDraftsForMonth to the authenticated user', async () => {
      const selectBuilder = createTrackedBuilder({
        data: [{ employee_id: 'emp-stale' }],
        error: null,
      });
      const deleteBuilder = createTrackedBuilder({ data: null, error: null });
      fromMock.mockReturnValueOnce(selectBuilder).mockReturnValueOnce(deleteBuilder);

      await salaryDraftService.syncDraftsForMonth('2026-04', {});

      expect(selectBuilder.select).toHaveBeenCalledWith('employee_id');
      expect(selectBuilder.eq).toHaveBeenNthCalledWith(1, 'month_year', '2026-04');
      expect(selectBuilder.eq).toHaveBeenNthCalledWith(2, 'user_id', 'user-42');
      expect(deleteBuilder.delete).toHaveBeenCalledTimes(1);
      expect(deleteBuilder.eq).toHaveBeenNthCalledWith(1, 'month_year', '2026-04');
      expect(deleteBuilder.eq).toHaveBeenNthCalledWith(2, 'user_id', 'user-42');
      expect(deleteBuilder.in).toHaveBeenCalledWith('employee_id', ['emp-stale']);
    });

    it('upserts desired drafts and deletes nothing if no stale ids', async () => {
      const selectBuilder = createTrackedBuilder({
        data: [{ employee_id: 'e1' }],
        error: null,
      });
      const upsertBuilder = createTrackedBuilder({ data: null, error: null });
      fromMock.mockReturnValueOnce(selectBuilder).mockReturnValueOnce(upsertBuilder);

      await salaryDraftService.syncDraftsForMonth('2026-04', { 'e1-2026-04': {} });

      expect(upsertBuilder.upsert).toHaveBeenCalled();
    });
  });

  describe('deleteDraft', () => {
    it('scopes deleteDraft to the authenticated user', async () => {
      const builder = createTrackedBuilder({ data: null, error: null });
      fromMock.mockReturnValue(builder);

      await salaryDraftService.deleteDraft('2026-04', 'emp-7');

      expect(builder.delete).toHaveBeenCalledTimes(1);
      expect(builder.eq).toHaveBeenNthCalledWith(1, 'month_year', '2026-04');
      expect(builder.eq).toHaveBeenNthCalledWith(2, 'user_id', 'user-42');
      expect(builder.eq).toHaveBeenNthCalledWith(3, 'employee_id', 'emp-7');
    });
  });

  describe('clearDraftsForMonth', () => {
    it('clears drafts', async () => {
      const builder = createTrackedBuilder({ data: null, error: null });
      fromMock.mockReturnValue(builder);

      await salaryDraftService.clearDraftsForMonth('2026-04');

      expect(builder.delete).toHaveBeenCalledTimes(1);
      expect(builder.eq).toHaveBeenNthCalledWith(1, 'month_year', '2026-04');
      expect(builder.eq).toHaveBeenNthCalledWith(2, 'user_id', 'user-42');
    });
  });

  describe('subscribeToDraftChanges', () => {
    it('subscribes to draft changes', () => {
      const cb = vi.fn();
      salaryDraftService.subscribeToDraftChanges('2026-04', cb);
      expect(channelMock).toHaveBeenCalledWith('salary_drafts:2026-04');
      
      // Call the callback to cover that code path
      const channelObj = channelMock();
      const onCall = (channelObj.on as any).mock.calls[0];
      const callbackArg = onCall[2];
      
      callbackArg({ new: { employee_id: 'e1', draft_data: {}, user_id: 'user-42' } });
      expect(cb).toHaveBeenCalled();
    });
  });
});
