import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAlerts } from './useAlerts';
import { alertsService } from '@services/alertsService';
import { buildAlertsFromResponses } from '@shared/lib/alertsBuilder';
import { createQueryClientWrapper } from '@shared/test/authedQuerySetup';

vi.mock('@app/providers/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'user-1' }, session: { access_token: 'tok' } }),
}));

vi.mock('@shared/hooks/useAuthQueryGate', () => ({
  useAuthQueryGate: () => ({ userId: 'user-1', authReady: true }),
  authQueryUserId: (id: string) => id,
}));

vi.mock('@shared/hooks/useQueryErrorToast', () => ({
  useQueryErrorToast: vi.fn(),
}));

vi.mock('@app/providers/SystemSettingsContext', () => ({
  useSystemSettings: () => ({ settings: { iqama_alert_days: 90 } }),
}));

vi.mock('@shared/hooks/useMonthlyActiveEmployeeIds', () => ({
  useMonthlyActiveEmployeeIds: () => ({ data: { employeeIds: new Set(['emp-1']), orderEmployeeIds: new Set(['emp-1']) } }),
}));

vi.mock('@services/alertsService', () => ({
  alertsService: {
    fetchAlertsDataWithTimeout: vi.fn(),
  },
}));

vi.mock('@shared/lib/alertsBuilder', () => ({
  buildAlertsFromResponses: vi.fn(),
}));

describe('useAlerts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns alerts built from fetched responses', async () => {
    vi.mocked(alertsService.fetchAlertsDataWithTimeout).mockResolvedValue([
      { data: [{ id: 'emp-1', name: 'A', residency_expiry: '2026-01-10', probation_end_date: null }], error: null },
      { data: [], error: null },
      { data: [], error: null },
      { data: [], error: null },
      { data: [], error: null },
      { data: [], error: null },
      { data: [], error: null },
    ] as unknown as Awaited<ReturnType<typeof alertsService.fetchAlertsDataWithTimeout>>);
    vi.mocked(buildAlertsFromResponses).mockReturnValue([
      {
        id: 'res-emp-1',
        type: 'residency',
        entityName: 'A',
        dueDate: '2026-01-10',
        daysLeft: 5,
        severity: 'urgent',
        resolved: false,
      },
    ]);

    const { result } = renderHook(() => useAlerts(), { wrapper: createQueryClientWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.[0]?.id).toBe('res-emp-1');
    expect(alertsService.fetchAlertsDataWithTimeout).toHaveBeenCalledOnce();
    expect(buildAlertsFromResponses).toHaveBeenCalledOnce();
  });

  it('returns error when alerts service fails', async () => {
    vi.mocked(alertsService.fetchAlertsDataWithTimeout).mockRejectedValue(new Error('timeout'));

    const { result } = renderHook(() => useAlerts(), { wrapper: createQueryClientWrapper() });

    await waitFor(() => expect(result.current.isError).toBe(true), { timeout: 6000 });
    expect((result.current.error as Error | null)?.message).toContain('timeout');
  });
});

