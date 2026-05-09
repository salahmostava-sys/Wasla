import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import type { PerformanceDashboardResponse, PerformanceRankingEntry } from '@services/performanceService';

const MEDALS = ['🥇', '🥈', '🥉'];

function trendLabel(trendCode: PerformanceRankingEntry['trendCode']) {
  switch (trendCode) {
    case 'up':
      return { label: 'يتحسن', icon: <TrendingUp size={11} className="inline text-emerald-500" /> };
    case 'down':
      return { label: 'يتراجع', icon: <TrendingDown size={11} className="inline text-rose-500" /> };
    default:
      return { label: 'ثابت', icon: <Minus size={11} className="inline text-muted-foreground" /> };
  }
}

function RankingColumn(props: Readonly<{
  title: string;
  rows: PerformanceRankingEntry[];
  accentClass: string;
}>) {
  const { title, rows, accentClass } = props;

  return (
    <div className="bg-card rounded-2xl p-5 shadow-card">
      <h3 className="text-sm font-bold text-foreground mb-4">{title}</h3>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">لا توجد بيانات كافية</p>
      ) : (
        <div className="space-y-3">
          {rows.map((row, index) => {
            const trend = trendLabel(row.trendCode);
            return (
              <div key={`${title}-${row.employeeId}`} className="rounded-xl border border-border/60 px-4 py-3 hover:bg-muted/30 transition-colors">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      {index < 3 ? (
                        <span className="text-base leading-none">{MEDALS[index]}</span>
                      ) : (
                        <span className={`inline-flex w-6 h-6 rounded-lg items-center justify-center text-xs font-black ${accentClass}`}>
                          {index + 1}
                        </span>
                      )}
                      <p className="text-sm font-bold text-foreground truncate">{row.employeeName}</p>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-1.5 flex items-center gap-1">
                      {row.activeDays} يوم • متوسط {row.avgOrdersPerDay.toFixed(1)} • {trend.icon} {trend.label}
                    </p>
                  </div>
                  <div className="text-end shrink-0">
                    <p className="text-lg font-black text-foreground">{row.totalOrders.toLocaleString('en-US')}</p>
                    <p className={`text-[11px] font-bold ${row.growthPct >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
                      {row.growthPct >= 0 ? '+' : ''}{row.growthPct.toFixed(1)}%
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function DashboardRankingTab(props: Readonly<{
  dashboard: PerformanceDashboardResponse | null;
}>) {
  const { dashboard } = props;

  if (!dashboard) {
    return (
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="bg-card rounded-2xl h-96 animate-pulse shadow-card" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
      <RankingColumn
        title="🏆 الأفضل أداءً"
        rows={dashboard.rankings.topPerformers}
        accentClass="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
      />
      <RankingColumn
        title="⚠️ يحتاج متابعة"
        rows={dashboard.rankings.lowPerformers}
        accentClass="bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400"
      />
      <RankingColumn
        title="📈 الأكثر تحسناً"
        rows={dashboard.rankings.mostImproved}
        accentClass="bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400"
      />
      <RankingColumn
        title="📉 الأكثر تراجعاً"
        rows={dashboard.rankings.mostDeclined}
        accentClass="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
      />
    </div>
  );
}
