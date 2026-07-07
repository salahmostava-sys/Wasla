/**
 * useSalaryData — Two-phase data loading for the salaries page.
 *
 * ── Phase 1 (fast, ~1-2s) ─────────────────────────────────────────────────
 * Fetches all non-RPC data in parallel (employees, orders, apps, advances…).
 *
 * ── Phase 2 (slow, background, ~2-3s) ────────────────────────────────────
 * Calls preview_salary_for_month RPC after Phase 1 succeeds.
 * When it finishes, fullDataQuery rebuilds rows with preview.
 *
 * ── fullDataQuery ─────────────────────────────────────────────────────────
 * Merges phase1 + phase2 data into PreparedSalaryState (rows, schemes, rules).
 * Runs once after phase1, then once more after phase2 finishes.
 * prepareSalaryState is heavy — we avoid calling it more than necessary.
 *
 * ── Month-switch behaviour ────────────────────────────────────────────────
 * - isLoading = true while phase1 is in-flight (first load or new month).
 * - isShowingPlaceholder = true only when phase1 is loading AND the page
 *   has already shown data before (i.e. not the very first load).
 *   This prevents the amber banner from flashing on initial page open.
 * - No keepPreviousData — avoids isPlaceholderData blocking bugs.
 */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useRef } from 'react';
import { useAuth } from '@app/providers/AuthContext';
import { authQueryUserId, useAuthQueryGate } from '@shared/hooks/useAuthQueryGate';
import { isValidSalaryMonthYear } from '@shared/lib/salaryValidation';
import { defaultQueryRetry } from '@shared/lib/query';
import { salaryDataService } from '@services/salaryDataService';
import { prepareSalaryState } from '@modules/salaries/lib/salaryDomain';
import { useMonthlyActiveEmployeeIds } from '@shared/hooks/useMonthlyActiveEmployeeIds';
import { useRealtimePostgresChanges } from '@shared/hooks/useRealtimePostgresChanges';
import type { SalaryBaseContextData, PreparedSalaryState } from '@modules/salaries/types/salary.types';

interface UseSalaryDataParams {
  selectedMonth: string;
  salariesDraftKey: string;
}

export interface SalaryDataResult extends PreparedSalaryState {
  /** True while Phase 1 is loading (table not ready) */
  isLoading: boolean;
  /**
   * True when switching months and Phase 1 is in-flight,
   * but only after the very first load has completed.
   * Used to show the amber banner on month-switch (not on initial open).
   */
  isShowingPlaceholder: boolean;
  /** True while Phase 2 RPC or fullDataQuery rebuild is in-flight */
  isRefreshingPreview: boolean;
  error: Error | null;
  previewBackendError: string | null;
}

const PHASE1_TIMEOUT_MS = 45_000;

const EMPTY_STATE: PreparedSalaryState = {
  appNameToId: {},
  rulesMap: {},
  appsWithoutPricingRules: [],
  appsWithoutScheme: [],
  builtEmpPlatformScheme: {},
  hydratedRows: [],
};

export function useSalaryData({ selectedMonth, salariesDraftKey }: UseSalaryDataParams): SalaryDataResult {
  const { user } = useAuth();
  const { enabled, userId } = useAuthQueryGate();
  const uid = authQueryUserId(userId);
  const queryClient = useQueryClient();

  const { data: activeIdsData } = useMonthlyActiveEmployeeIds(selectedMonth);
  const activeEmployeeIdsInMonth = activeIdsData?.employeeIds;

  const isQueryEnabled = enabled && isValidSalaryMonthYear(selectedMonth) && !!user?.id;

  // Track whether we've ever finished loading (to distinguish first-load from month-switch)
  const hasEverLoadedRef = useRef(false);

  // ── Query keys ────────────────────────────────────────────────────────────
  const phase1Key = useMemo(
    () => ['salaries', uid, 'context', selectedMonth] as const,
    [uid, selectedMonth],
  );
  const phase2Key = useMemo(
    () => ['salaries', uid, 'preview', selectedMonth] as const,
    [uid, selectedMonth],
  );

  // ── Phase 1: fetch all non-RPC data ──────────────────────────────────────
  const phase1 = useQuery({
    queryKey: phase1Key,
    enabled: isQueryEnabled,
    staleTime: 20_000,
    retry: defaultQueryRetry,
    structuralSharing: false,
    queryFn: () => {
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(
          () => reject(new Error('انتهت مهلة تحميل بيانات الرواتب. حاول مرة أخرى.')),
          PHASE1_TIMEOUT_MS,
        );
      });
      return Promise.race([
        salaryDataService.getMonthlyContext(selectedMonth),
        timeoutPromise,
      ]);
    },
  });

  // ── Phase 2: preview RPC — runs after phase1, in background ──────────────
  const phase2 = useQuery({
    queryKey: phase2Key,
    enabled: isQueryEnabled && phase1.isSuccess,
    staleTime: 20_000,
    retry: 1,
    structuralSharing: false,
    queryFn: async () => {
      let previewData: Awaited<ReturnType<typeof salaryDataService.getSalaryPreviewForMonth>> = [];
      let previewBackendError: string | null = null;
      try {
        previewData = await salaryDataService.getSalaryPreviewForMonth(selectedMonth);
      } catch (err) {
        const raw = err instanceof Error ? err.message : String(err);
        const normalized = raw.startsWith('PREVIEW_BACKEND:')
          ? raw.replaceAll('PREVIEW_BACKEND:', '').trim()
          : raw;
        previewBackendError = normalized || 'تعذر تحميل معاينة الرواتب من الخادم';
      }
      return { previewData: previewData || [], previewBackendError };
    },
  });

  // ── Full state: build rows from phase1 + (optionally) phase2 ─────────────
  // Runs once after phase1 (with previewData=[]).
  // Runs again after phase2 finishes with real preview data.
  // prepareSalaryState is CPU-heavy — we avoid extra runs by tracking
  // phase2.dataUpdatedAt instead of depending on the previewData array itself.
  const fullDataKey = useMemo(
    () => ['salaries', uid, 'full-data', selectedMonth, phase1.dataUpdatedAt, phase2.dataUpdatedAt] as const,
    [uid, selectedMonth, phase1.dataUpdatedAt, phase2.dataUpdatedAt],
  );

  const fullDataQuery = useQuery<PreparedSalaryState, Error>({
    queryKey: fullDataKey,
    enabled: isQueryEnabled && phase1.isSuccess,
    staleTime: 0,
    gcTime: 5 * 60_000, // keep in memory 5 min after unmount
    retry: false,
    structuralSharing: false,
    queryFn: async () => {
      const monthlyContext = phase1.data ?? {};
      // Use current phase2 data if available, otherwise empty (phase1-only pass)
      const previewData = phase2.data?.previewData ?? [];

      const salaryBaseContext: SalaryBaseContextData = {
        monthlyContext,
        previewData,
      };

      const result = await prepareSalaryState({
        salaryBaseContext,
        selectedMonth,
        activeEmployeeIdsInMonth,
        salariesDraftKey,
      });

      // Mark that we've successfully loaded at least once
      hasEverLoadedRef.current = true;

      return result;
    },
  });

  // ── Realtime: invalidate on daily_orders or daily_shifts changes ─────────
  // Debounced 2s — avoids rapid re-fetches when multiple rows change at once
  const realtimeDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useRealtimePostgresChanges(
    `salaries-orders-sync-${uid}-${selectedMonth}`,
    ['daily_orders', 'daily_shifts'],
    () => {
      if (realtimeDebounceRef.current) clearTimeout(realtimeDebounceRef.current);
      realtimeDebounceRef.current = setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: phase1Key });
        queryClient.invalidateQueries({ queryKey: phase2Key });
      }, 2_000);
    },
  );

  // ── Derived flags ─────────────────────────────────────────────────────────
  const isLoading = phase1.isLoading;

  // Show placeholder banner only on month-switch (not on very first page open)
  const isShowingPlaceholder = phase1.isLoading && hasEverLoadedRef.current;

  // Refreshing = after table is visible, phase2 or fullData rebuild in progress
  const isRefreshingPreview =
    phase1.isSuccess && (phase2.isLoading || fullDataQuery.isFetching);

  return {
    ...(fullDataQuery.data ?? EMPTY_STATE),
    previewBackendError: phase2.data?.previewBackendError ?? null,
    isLoading,
    isShowingPlaceholder,
    isRefreshingPreview,
    error: phase1.error ? (phase1.error as Error) : null,
  };
}
