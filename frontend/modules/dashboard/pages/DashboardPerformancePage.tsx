import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { performanceService } from '@services/performanceService';

import { useAuth } from '@app/providers/AuthContext';
import { useTemporalContext } from '@app/providers/TemporalContext';
import { QueryErrorRetry } from '@shared/components/QueryErrorRetry';
import { authQueryUserId, useAuthQueryGate } from '@shared/hooks/useAuthQueryGate';
import { REALTIME_TABLES_DASHBOARD, useRealtimePostgresChanges } from '@shared/hooks/useRealtimePostgresChanges';
import { DashboardPerformanceHeader } from '@modules/dashboard/components/DashboardPerformanceHeader';
import { DashboardPerformanceOverviewTab } from '@modules/dashboard/components/DashboardPerformanceOverviewTab';
import { DashboardRiderProfileModal } from '@modules/dashboard/components/DashboardRiderProfileModal';
import { exportExecutivePerformanceReport } from '@modules/dashboard/lib/executiveReportExport';
import { useSystemSettings } from '@app/providers/SystemSettingsContext';
import { toast } from '@shared/components/ui/sonner';
import { getErrorMessage } from '@services/serviceError';

const REALTIME_TABLES_PERFORMANCE_PAGE = [
  ...REALTIME_TABLES_DASHBOARD,
] as const;

const MONTH_SCOPED_REALTIME_TABLES = new Set(['attendance', 'daily_orders', 'app_targets']);

export default function DashboardPerformancePage() {
  const { user } = useAuth();
  const { enabled, userId } = useAuthQueryGate();
  const uid = authQueryUserId(userId);
  const queryClient = useQueryClient();
  const { selectedMonth: currentMonth } = useTemporalContext();
  const { projectName } = useSystemSettings();
  const [selectedRiderId, setSelectedRiderId] = useState<string | null>(null);

  useRealtimePostgresChanges(
    'performance-dashboard-realtime',
    REALTIME_TABLES_PERFORMANCE_PAGE,
    () => {
      if (!user?.id) return;
      queryClient.invalidateQueries({ queryKey: ['performance-dashboard', uid, currentMonth] });
    },
    {
      shouldHandle: (change) => {
        if (!MONTH_SCOPED_REALTIME_TABLES.has(change.table)) return true;
        if (change.eventType === 'DELETE') return true;
        const changedMonth = change.new.month_year ?? change.old.month_year;
        const changedDate = change.new.date ?? change.old.date;
        return changedMonth === currentMonth
          || (typeof changedDate === 'string' && changedDate.startsWith(currentMonth));
      },
    },
  );

  const dashboardQuery = useQuery({
    queryKey: ['performance-dashboard', uid, currentMonth] as const,
    enabled,
    staleTime: 60_000,
    queryFn: () => performanceService.getDashboard(currentMonth),
  });

  const exportExecutiveReport = async () => {
    if (!dashboardQuery.data) return;
    try {
      await exportExecutivePerformanceReport(dashboardQuery.data, projectName);
      toast.success('تم تصدير التقرير التنفيذي');
    } catch (error) {
      toast.error(getErrorMessage(error, 'تعذر تصدير التقرير التنفيذي'));
    }
  };

  return (
    <div className="space-y-5" dir="rtl">
      <DashboardPerformanceHeader
        onExportReport={dashboardQuery.data ? exportExecutiveReport : undefined}
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

      {!dashboardQuery.isError ? (
        <div className="space-y-6">
          <DashboardPerformanceOverviewTab
            loading={dashboardQuery.isLoading}
            dashboard={dashboardQuery.data ?? null}
            onRiderClick={setSelectedRiderId}
          />
        </div>
      ) : null}

      <DashboardRiderProfileModal riderId={selectedRiderId} onClose={() => setSelectedRiderId(null)} />
    </div>
  );
}
