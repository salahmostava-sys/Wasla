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

import { alertsService } from './alertsService';

describe('alertsService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    for (const k of Object.keys(tableResults)) delete tableResults[k];
  });

  describe('resolveAlert', () => {
    it('resolves an alert successfully', async () => {
      tableResults.alerts = {
        data: { id: 'alert-1' },
        error: null,
      };

      const result = await alertsService.resolveAlert('alert-1', 'user-1');
      expect(result.id).toBe('alert-1');
      expect(fromMock).toHaveBeenCalledWith('alerts');
    });

    it('throws when alert not found', async () => {
      tableResults.alerts = {
        data: null,
        error: null,
      };

      await expect(alertsService.resolveAlert('missing', 'user-1')).rejects.toThrow(
        'alertsService.resolveAlert: alert not found',
      );
    });

    it('throws on Supabase error', async () => {
      tableResults.alerts = {
        data: null,
        error: new Error('update failed'),
      };

      await expect(alertsService.resolveAlert('alert-1', 'user-1')).rejects.toThrow('update failed');
    });
  });

  describe('deferAlert', () => {
    it('defers an alert successfully', async () => {
      tableResults.alerts = {
        data: { id: 'alert-2' },
        error: null,
      };

      const result = await alertsService.deferAlert('alert-2', '2026-04-15');
      expect(result.id).toBe('alert-2');
    });

    it('throws when alert not found', async () => {
      tableResults.alerts = {
        data: null,
        error: null,
      };

      await expect(alertsService.deferAlert('missing', '2026-04-15')).rejects.toThrow(
        'alertsService.deferAlert: alert not found',
      );
    });

    it('throws on Supabase error', async () => {
      tableResults.alerts = {
        data: null,
        error: new Error('db connection lost'),
      };

      await expect(alertsService.deferAlert('alert-1', '2026-04-15')).rejects.toThrow(
        'db connection lost',
      );
    });
  });
});
