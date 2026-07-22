/**
 * DashboardPerformanceOverviewTab — لوحة تحكم موحدة ونقية ذات استجابة فائقة
 */

import { useMemo } from 'react';
import {
  Activity,
  Target,
  Trophy,
  Zap,
} from 'lucide-react';

import type {
  PerformanceDashboardResponse,
} from '@services/performanceService';
import {
  buildFleetSummary,
  buildRiderProfiles,
  type RiderPerformanceProfile,
} from '@modules/dashboard/lib/performanceEngine';
import { EnrichedStatCard } from './EnrichedStatCard';
import { PerformanceDetailedTable } from './PerformanceDetailedTable';
import { DashboardWeeklyBestDaysCard } from './DashboardWeeklyBestDaysCard';
import { Skeleton } from '@shared/components/ui/skeleton';

function targetTier(pct: number): 'excellent' | 'good' | 'average' {
  if (pct >= 100) return 'excellent';
  if (pct >= 70) return 'good';
  return 'average';
}

function scoreTier(score: number): 'good' | 'average' | 'weak' {
  if (score >= 70) return 'good';
  if (score >= 50) return 'average';
  return 'weak';
}

function AppCard(props: Readonly<{
  appName: string;
  orders: number;
  riders: number;
  targetOrders: number;
  targetAchievementPct: number;
  growthPct: number;
  brandColor: string;
  textColor: string;
}>) {
  const { appName, orders, riders, targetOrders, targetAchievementPct, growthPct, brandColor, textColor } = props;
  const growthSign = growthPct >= 0 ? '+' : '';
  return (
    <div className="bg-card p-4 shadow-card rounded-2xl border border-border/40 hover:border-border/80 transition-colors">
      <div className="flex items-center justify-between gap-2 mb-3">
        <span
          className="text-xs font-bold px-2.5 py-1 rounded-lg"
          style={{ backgroundColor: brandColor, color: textColor }}
        >
          {appName}
        </span>
        <span className={`text-xs font-bold ${growthPct >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'}`}>
          {growthSign}{growthPct.toFixed(1)}%
        </span>
      </div>
      <p className="text-2xl font-black text-foreground">{orders.toLocaleString('en-US')}</p>
      <p className="text-[11px] text-muted-foreground mt-1">
        {riders} مندوب • الهدف {targetOrders.toLocaleString('en-US')} • {targetAchievementPct.toFixed(0)}%
      </p>
    </div>
  );
}

export function DashboardPerformanceOverviewTab(props: Readonly<{
  loading: boolean;
  dashboard: PerformanceDashboardResponse | null;
  onRiderClick?: (riderId: string) => void;
}>) {
  const { loading, dashboard, onRiderClick } = props;

  // Compute Fleet summary & rider profiles
  const { fleetSummary, allProfiles } = useMemo(() => {
    if (!dashboard) {
      return {
        fleetSummary: null,
        allProfiles: [] as RiderPerformanceProfile[],
      };
    }

    const summary = buildFleetSummary(dashboard);

    const allEntries = [
      ...dashboard.rankings.topPerformers,
      ...dashboard.rankings.lowPerformers,
      ...dashboard.rankings.mostImproved,
      ...dashboard.rankings.mostDeclined,
    ];
    const seen = new Set<string>();
    const unique = allEntries.filter((e) => {
      if (seen.has(e.employeeId)) return false;
      seen.add(e.employeeId);
      return true;
    });
    const profiles = buildRiderProfiles(unique);

    return { fleetSummary: summary, allProfiles: profiles };
  }, [dashboard]);

  if (loading || !dashboard || !fleetSummary) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 8 }, (_, index) => (
          <Skeleton key={index} className="bg-card h-32 shadow-card rounded-2xl" />
        ))}
      </div>
    );
  }

  const { summary, distribution, ordersByApp, ordersByCity, targets, dailyTrend } = dashboard;

  let projectedText = '';
  if (fleetSummary.projectedOrders !== null) {
    const icon = fleetSummary.targetHitProjected ? '✅' : '⚠️';
    projectedText = ` • متوقع: ${fleetSummary.projectedOrders.toLocaleString('en-US')} ${icon}`;
  }

  return (
    <div className="space-y-6">
      {/* ── 1. Executive KPIs Row ───────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <EnrichedStatCard
          label="إجمالي الطلبات"
          value={summary.totalOrders.toLocaleString('en-US')}
          sub="طلبات مكتملة"
          icon={Target}
          tier="excellent"
        />
        <EnrichedStatCard
          label="تحقيق الهدف"
          value={`${targets.targetAchievementPct.toFixed(0)}%`}
          sub={`الهدف: ${targets.totalTargetOrders.toLocaleString('en-US')} طلب${projectedText}`}
          icon={Trophy}
          tier={targetTier(targets.targetAchievementPct)}
        />
        <EnrichedStatCard
          label="المتوسط اليومي للطلبات"
          value={fleetSummary.dailyRunRate.toFixed(1)}
          delta={fleetSummary.dailyRunRateDelta}
          sub={`${dashboard.comparison.month.currentActiveDays || 0} إجمالي أيام العمل`}
          icon={Activity}
        />
        <EnrichedStatCard
          label="متوسط التقييم"
          value={`${fleetSummary.avgPerformanceScore}/100`}
          sub={`${distribution.excellent} ممتاز • ${distribution.weak} ضعيف`}
          icon={Zap}
          tier={scoreTier(fleetSummary.avgPerformanceScore)}
        />
      </div>

      {/* ── 2. Weekly Breakdown (W1-W5) & Best Days Analysis ─────────────── */}
      <DashboardWeeklyBestDaysCard dailyTrend={dailyTrend} />

      {/* ── 3. Platforms Grid & City / Distribution Performance ──────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-[1.4fr,0.8fr] gap-4">
        <div className="bg-card p-5 shadow-card rounded-2xl border border-border/40">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div>
              <h3 className="text-sm font-bold text-foreground">أداء المنصات</h3>
              <p className="text-[11px] text-muted-foreground mt-1">طلبات الشهر مع نسبة التغيّر والهدف</p>
            </div>
            <span className="text-xs font-semibold text-muted-foreground">{ordersByApp.length} منصة</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {ordersByApp.map((app) => (
              <AppCard key={app.appId} {...app} />
            ))}
          </div>
        </div>

        <div className="space-y-4">
          {/* Team Distribution Card */}
          <div className="bg-card p-5 shadow-card rounded-2xl border border-border/40">
            <div>
              <h3 className="text-sm font-bold text-foreground">توزيع أداء الفريق</h3>
              <p className="text-[11px] text-muted-foreground mt-1">تقسيم الموظفين حسب الفئات التشغيلية</p>
            </div>
            <div className="space-y-3 mt-4">
              {[
                { key: 'excellent', label: 'ممتاز', value: distribution.excellent, color: 'bg-emerald-500', text: 'text-emerald-600 dark:text-emerald-400' },
                { key: 'good', label: 'جيد', value: distribution.good, color: 'bg-blue-500', text: 'text-blue-600 dark:text-blue-400' },
                { key: 'average', label: 'متوسط', value: distribution.average, color: 'bg-amber-500', text: 'text-amber-600 dark:text-amber-400' },
                { key: 'weak', label: 'ضعيف', value: distribution.weak, color: 'bg-rose-500', text: 'text-rose-500' },
              ].map((row) => {
                const total = distribution.excellent + distribution.good + distribution.average + distribution.weak;
                const pct = total > 0 ? Math.round((row.value / total) * 100) : 0;
                return (
                  <div key={row.key} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-foreground">{row.label}</span>
                      <span className={`font-black ${row.text}`}>{row.value} ({pct}%)</span>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div className={`h-full rounded-full ${row.color}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* City Performance Card */}
          <div className="bg-card p-5 shadow-card rounded-2xl border border-border/40">
            <h3 className="text-sm font-bold text-foreground mb-4">حسب المدينة</h3>
            <div className="space-y-3">
              {ordersByCity.map((row) => (
                <div key={row.city} className="rounded-xl bg-muted/30 px-4 py-3 flex items-center justify-between">
                  <span className="text-sm font-medium text-foreground">{row.city}</span>
                  <span className="text-lg font-black text-foreground">{row.orders.toLocaleString('en-US')}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── 4. Detailed Rider Performance Table ──────────────────────────── */}
      {allProfiles.length > 0 && (
        <PerformanceDetailedTable riders={allProfiles} onRiderClick={onRiderClick} />
      )}
    </div>
  );
}
