import { Link } from 'react-router-dom';
import { Calendar, Medal, TrendingUp } from 'lucide-react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';

import { useTemporalContext } from '@app/providers/TemporalContext';
import { cn } from '@shared/lib/utils';

export type DashboardTabKey = 'overview' | 'analytics' | 'ranking';

const DASHBOARD_SHORTCUTS = [
  { to: '/orders', label: 'الطلبات' },
  { to: '/attendance', label: 'الحضور' },
  { to: '/alerts', label: 'التنبيهات' },
  { to: '/fuel', label: 'الوقود' },
] as const;

type DashboardHeaderProps = {
  activeTab: DashboardTabKey;
  onTabChange: (tab: DashboardTabKey) => void;
  onAnalyticsIntent?: () => void;
};

export function DashboardHeader({
  activeTab,
  onTabChange,
  onAnalyticsIntent,
}: Readonly<DashboardHeaderProps>) {
  const { selectedMonth } = useTemporalContext();

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <nav className="flex items-center gap-1 text-xs text-muted-foreground/80 mb-1">
            <span>الرئيسية</span>
            <span>/</span>
            <span className="text-muted-foreground font-medium">لوحة التحكم</span>
          </nav>
          <h1 className="text-xl font-black text-foreground">لوحة التحكم</h1>
          <p className="text-xs text-muted-foreground/80 mt-0.5">
            {format(new Date(), 'EEEE، d MMMM yyyy', { locale: ar })}
          </p>
        </div>

        <div className="flex items-center bg-muted rounded-xl p-1 gap-1 overflow-x-auto">
          {(['overview', 'analytics', 'ranking'] as const).map((tab) => {
            const isAnalyticsTab = tab === 'analytics';
            const isRankingTab = tab === 'ranking';

            const tabLabels = {
              overview: 'النظرة العامة',
              analytics: 'التحليلات والتوقعات',
              ranking: 'التصنيفات',
            };
            const tabLabel = tabLabels[tab];

            return (
              <button
                key={tab}
                type="button"
                onClick={() => onTabChange(tab)}
                onFocus={isAnalyticsTab || isRankingTab ? onAnalyticsIntent : undefined}
                onMouseEnter={isAnalyticsTab || isRankingTab ? onAnalyticsIntent : undefined}
                onTouchStart={isAnalyticsTab || isRankingTab ? onAnalyticsIntent : undefined}
                className={cn(
                  'px-4 py-1.5 rounded-lg text-sm font-semibold transition-all flex items-center gap-1.5 whitespace-nowrap',
                  activeTab === tab ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground/75',
                )}
              >
                {isAnalyticsTab && <TrendingUp size={13} />}
                {isRankingTab && <Medal size={13} />}
                {tabLabel}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground bg-muted/30 px-3 py-1.5 rounded-lg border border-border/50">
          <Calendar size={14} className="text-primary/70" />
          <span>بيانات شهر:</span>
          <span className="text-foreground font-bold">
            {format(new Date(`${selectedMonth}-01`), 'MMMM yyyy', { locale: ar })}
          </span>
        </div>

        <nav className="flex flex-wrap items-center gap-2" aria-label="اختصارات تشغيلية">
          {DASHBOARD_SHORTCUTS.map((shortcut) => (
            <Link
              key={shortcut.to}
              to={shortcut.to}
              className="border border-border/70 bg-card px-3 py-1.5 text-xs font-semibold text-foreground shadow-sm transition-colors hover:bg-muted/60 rounded-2xl"
            >
              {shortcut.label}
            </Link>
          ))}
        </nav>
      </div>
    </div>
  );
}
