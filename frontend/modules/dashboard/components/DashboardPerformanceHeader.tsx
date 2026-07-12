import { LayoutDashboard, Medal } from 'lucide-react';

import { useTemporalContext } from '@app/providers/TemporalContext';
import {
  DashboardBreadcrumbTitle,
  SelectedMonthBadge,
  dashboardTabButtonClass,
} from '@modules/dashboard/components/DashboardHeaderShared';

export type DashboardPerformanceTabKey = 'overview' | 'analytics_ranking';

type DashboardPerformanceHeaderProps = {
  activeTab: DashboardPerformanceTabKey;
  onTabChange: (tab: DashboardPerformanceTabKey) => void;
  onPrefetchIntent?: () => void;
};

const TAB_LABELS: Record<DashboardPerformanceTabKey, string> = {
  overview: 'النظرة العامة',
  analytics_ranking: 'التحليلات والمراكز',
};

const DASHBOARD_TABS: readonly DashboardPerformanceTabKey[] = [
  'overview',
  'analytics_ranking',
];

export function DashboardPerformanceHeader({
  activeTab,
  onTabChange,
  onPrefetchIntent,
}: Readonly<DashboardPerformanceHeaderProps>) {
  const { selectedMonth } = useTemporalContext();

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <DashboardBreadcrumbTitle />

        <div className="flex items-center bg-muted rounded-xl p-1 gap-1 overflow-x-auto">
          {DASHBOARD_TABS.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => onTabChange(tab)}
              onFocus={tab !== 'overview' ? onPrefetchIntent : undefined}
              onMouseEnter={tab !== 'overview' ? onPrefetchIntent : undefined}
              onTouchStart={tab !== 'overview' ? onPrefetchIntent : undefined}
              className={dashboardTabButtonClass(activeTab === tab)}
            >
              {tab === 'overview' ? <LayoutDashboard size={13} /> : null}
              {tab === 'analytics_ranking' ? <Medal size={13} /> : null}
              {TAB_LABELS[tab]}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <SelectedMonthBadge selectedMonth={selectedMonth} />
      </div>
    </div>
  );
}
