import { Suspense, lazy, startTransition, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { performanceService } from '@services/performanceService';

import { useAuth } from '@app/providers/AuthContext';
import { useTemporalContext } from '@app/providers/TemporalContext';
import { QueryErrorRetry } from '@shared/components/QueryErrorRetry';
import { authQueryUserId, useAuthQueryGate } from '@shared/hooks/useAuthQueryGate';
import { REALTIME_TABLES_DASHBOARD, useRealtimePostgresChanges } from '@shared/hooks/useRealtimePostgresChanges';
import {
  DashboardPerformanceHeader,
  type DashboardPerformanceTabKey,
} from '@modules/dashboard/components/DashboardPerformanceHeader';
import { DashboardPerformanceOverviewTab } from '@modules/dashboard/components/DashboardPerformanceOverviewTab';
import { DashboardRiderProfileModal } from '@modules/dashboard/components/DashboardRiderProfileModal';
import { Skeleton } from '@shared/components/ui/skeleton';

const loadAnalyticsTab = () =>
  import('@modules/dashboard/components/DashboardPerformanceAnalyticsTab').then((module) => ({
    default: module.DashboardPerformanceAnalyticsTab,
  }));

const loadRankingTab = () =>
  import('@modules/dashboard/components/DashboardRankingTab').then((module) => ({
    default: module.DashboardRankingTab,
  }));

const loadPlatformsTab = () =>
  import('@modules/dashboard/components/DashboardPlatformsTab').then((module) => ({
    default: module.DashboardPlatformsTab,
  }));

const LazyDashboardPerformanceAnalyticsTab = lazy(loadAnalyticsTab);
const LazyDashboardRankingTab = lazy(loadRankingTab);
const LazyDashboardPlatformsTab = lazy(loadPlatformsTab);

const REALTIME_TABLES_PERFORMANCE_PAGE = [
  ...REALTIME_TABLES_DASHBOARD,
  'employee_apps',
  'vehicle_assignments',
] as const;

function TabFallback() {
  return <Skeleton  className="bg-card h-80 shadow-card rounded-2xl" />;
}

export default function DashboardPerformancePage() {
  const { user } = useAuth();
  const { enabled, userId } = useAuthQueryGate();
  const uid = authQueryUserId(userId);
  const queryClient = useQueryClient();
  const { selectedMonth: currentMonth } = useTemporalContext();
  const [activeTab, setActiveTab] = useState<DashboardPerformanceTabKey>('overview');
  const [selectedRiderId, setSelectedRiderId] = useState<string | null>(null);

  useRealtimePostgresChanges('performance-dashboard-realtime', REALTIME_TABLES_PERFORMANCE_PAGE, () => {
    if (!user?.id) return;
    queryClient.invalidateQueries({ queryKey: ['performance-dashboard', uid, currentMonth] });
  });

  const dashboardQuery = useQuery({
    queryKey: ['performance-dashboard', uid, currentMonth] as const,
    enabled,
    staleTime: 60_000,
    queryFn: () => performanceService.getDashboard(currentMonth),
  });

  const _chatEnabled = useMemo(() => {
    return !!dashboardQuery.data;
  }, [dashboardQuery.data]);

  const handleTabChange = (tab: DashboardPerformanceTabKey) => {
    if (tab === 'analytics_ranking') {
      loadAnalyticsTab();
      loadRankingTab();
      loadPlatformsTab();
    }
    startTransition(() => {
      setActiveTab(tab);
    });
  };

  return (
    <div className="space-y-5" dir="rtl">
      <DashboardPerformanceHeader
        activeTab={activeTab}
        onTabChange={handleTabChange}
        onPrefetchIntent={() => {
          loadAnalyticsTab();
          loadRankingTab();
          loadPlatformsTab();
        }}
      />

      {dashboardQuery.isError ? (
        <QueryErrorRetry
          error={dashboardQuery.error}
          onRetry={() => { dashboardQuery.refetch(); }}
          isFetching={dashboardQuery.isFetching}
          title="تعذر تحميل لوحة المعلومات"
          hint="تحقق من الاتصال أو من تطبيق أحدث migrations ثم أعد المحاولة."
        />
      ) : null}

      {!dashboardQuery.isError && activeTab === 'overview' ? (
        <div className="space-y-6">
          <DashboardPerformanceOverviewTab
            loading={dashboardQuery.isLoading}
            dashboard={dashboardQuery.data ?? null}
            onRiderClick={setSelectedRiderId}
          />
        </div>
      ) : null}

      {!dashboardQuery.isError && activeTab === 'analytics_ranking' ? (
        <div className="space-y-6">
          <Suspense fallback={<TabFallback />}>
            <LazyDashboardPerformanceAnalyticsTab dashboard={dashboardQuery.data ?? null} />
          </Suspense>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Suspense fallback={<TabFallback />}>
              <LazyDashboardRankingTab dashboard={dashboardQuery.data ?? null} />
            </Suspense>
            <Suspense fallback={<TabFallback />}>
              <LazyDashboardPlatformsTab dashboard={dashboardQuery.data ?? null} />
            </Suspense>
          </div>
        </div>
      ) : null}

      <DashboardRiderProfileModal riderId={selectedRiderId} onClose={() => setSelectedRiderId(null)} />
    </div>
  );
}
