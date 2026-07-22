import { Download } from 'lucide-react';

import { useTemporalContext } from '@app/providers/TemporalContext';
import {
  DashboardBreadcrumbTitle,
  SelectedMonthBadge,
} from '@modules/dashboard/components/DashboardHeaderShared';
import { Button } from '@shared/components/ui/button';

export type DashboardPerformanceTabKey = 'overview';

type DashboardPerformanceHeaderProps = {
  activeTab?: DashboardPerformanceTabKey;
  onTabChange?: (tab: DashboardPerformanceTabKey) => void;
  onPrefetchIntent?: () => void;
  onExportReport?: () => void | Promise<void>;
};

export function DashboardPerformanceHeader({
  onExportReport,
}: Readonly<DashboardPerformanceHeaderProps>) {
  const { selectedMonth } = useTemporalContext();

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <DashboardBreadcrumbTitle />
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <SelectedMonthBadge selectedMonth={selectedMonth} />
        {onExportReport && (
          <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => void onExportReport()}>
            <Download size={14} /> التقرير التنفيذي
          </Button>
        )}
      </div>
    </div>
  );
}
