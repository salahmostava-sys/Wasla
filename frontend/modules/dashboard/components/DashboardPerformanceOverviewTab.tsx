/**
 * DashboardPerformanceOverviewTab — نظرة عامة على الأداء مع تحليلات ذكية
 * وتوصيات ودرجات أداء وجدول تفصيلي.
 */

import { useMemo } from 'react';
import {
  AlertTriangle,
  Target,
  TrendingDown,
  TrendingUp,
  Trophy,
  Users,
  Zap,
} from 'lucide-react';

import type {
  PerformanceAlert,
  PerformanceDashboardResponse,
} from '@services/performanceService';
import {
  buildFleetSummary,
  buildRiderProfiles,
  type RiderPerformanceProfile,
} from '@modules/dashboard/lib/performanceEngine';
import {
  generateFleetInsights,
  type FleetAIInsights,
} from '@modules/dashboard/lib/aiInsightsEngine';
import { EnrichedStatCard } from './EnrichedStatCard';
import { AIInsightsPanel } from './AIInsightsPanel';
import { AIRecommendationsSection } from './AIRecommendationsSection';
import { PerformanceDetailedTable } from './PerformanceDetailedTable';

function formatPercent(value: number) {
  const rounded = Number.isFinite(value) ? value : 0;
  return `${rounded > 0 ? '+' : ''}${rounded.toFixed(1)}%`;
}

function getFirstTwoNames(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  return parts.slice(0, 2).join(' ');
}

function alertLabel(alert: PerformanceAlert) {
  switch (alert.alertType) {
    case 'declining':
      return 'انخفاض واضح عن الشهر السابق';
    case 'inactive_recently':
      return 'اختفى في آخر 3 أيام';
    case 'below_target':
      return 'أقل من الهدف الشهري';
    case 'low_consistency':
      return 'أداء غير مستقر';
    default:
      return alert.alertType;
  }
}

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

function alertsTier(count: number): 'weak' | 'average' | 'excellent' {
  if (count > 3) return 'weak';
  if (count > 0) return 'average';
  return 'excellent';
}

function ComparisonCard(props: Readonly<{
  title: string;
  currentValue: string;
  previousValue: string;
  change: number;
  hint: string;
}>) {
  const { title, currentValue, previousValue, change, hint } = props;
  const positive = change >= 0;
  return (
    <div className="bg-card rounded-2xl p-4 shadow-card space-y-3">
      <div>
        <p className="text-sm font-bold text-foreground">{title}</p>
        <p className="text-[11px] text-muted-foreground mt-1">{hint}</p>
      </div>
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-2xl font-black text-foreground">{currentValue}</p>
          <p className="text-[11px] text-muted-foreground">السابق: {previousValue}</p>
        </div>
        <div className={`text-sm font-bold ${positive ? 'text-emerald-600' : 'text-rose-500'}`}>
          {positive ? <TrendingUp size={14} className="inline me-1" /> : <TrendingDown size={14} className="inline me-1" />}
          {formatPercent(change)}
        </div>
      </div>
    </div>
  );
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
  return (
    <div className="bg-card rounded-2xl p-4 shadow-card">
      <div className="flex items-center justify-between gap-2 mb-3">
        <span
          className="text-xs font-bold px-2.5 py-1 rounded-lg"
          style={{ backgroundColor: brandColor, color: textColor }}
        >
          {appName}
        </span>
        <span className={`text-xs font-bold ${growthPct >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
          {formatPercent(growthPct)}
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
}>) {
  const { loading, dashboard } = props;

  // Compute AI insights
  const { fleetSummary, aiInsights, allProfiles } = useMemo(() => {
    if (!dashboard) {
      return {
        fleetSummary: null,
        aiInsights: null as FleetAIInsights | null,
        allProfiles: [] as RiderPerformanceProfile[],
      };
    }

    const summary = buildFleetSummary(dashboard);

    // Build all profiles from top + low + improved + declined
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

    const insights = generateFleetInsights(profiles, summary);

    return { fleetSummary: summary, aiInsights: insights, allProfiles: profiles };
  }, [dashboard]);

  if (loading || !dashboard || !fleetSummary || !aiInsights) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {Array.from({ length: 8 }, (_, index) => (
          <div key={index} className="bg-card rounded-2xl h-32 animate-pulse shadow-card" />
        ))}
      </div>
    );
  }

  const { summary, comparison, distribution, ordersByApp, ordersByCity, rankings, alerts, targets } = dashboard;
  const bestToday = summary.topPerformerToday?.employeeName ? getFirstTwoNames(summary.topPerformerToday.employeeName) : 'لا يوجد';
  const bestTodayOrders = summary.topPerformerToday?.totalOrders ?? 0;

  return (
    <div className="space-y-6">
      {/* ── Top KPIs Row (Enriched) ───────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-6 gap-4">
        <EnrichedStatCard
          label="إجمالي الطلبات"
          value={summary.totalOrders.toLocaleString('en-US')}
          delta={fleetSummary.totalOrdersDelta}
          sub={`${summary.activeRiders} مندوب نشط`}
          icon={Target}
        />
        <EnrichedStatCard
          label="متوسط الطلبات/مندوب"
          value={summary.avgOrdersPerRider.toFixed(1)}
          delta={fleetSummary.avgOrdersDelta}
          sub={`${summary.activeEmployees} موظف مسجل`}
          icon={Users}
        />
        <EnrichedStatCard
          label="تحقيق الهدف"
          value={`${targets.targetAchievementPct.toFixed(0)}%`}
          sub={`الهدف: ${targets.totalTargetOrders.toLocaleString('en-US')} طلب`}
          icon={Trophy}
          tier={targetTier(targets.targetAchievementPct)}
        />
        <EnrichedStatCard
          label="أفضل مندوب اليوم"
          value={bestToday}
          sub={`${bestTodayOrders.toLocaleString('en-US')} طلب`}
          icon={TrendingUp}
          tier="excellent"
        />
        <EnrichedStatCard
          label="متوسط التقييم"
          value={`${fleetSummary.avgPerformanceScore}/100`}
          sub={`${distribution.excellent} ممتاز • ${distribution.weak} ضعيف`}
          icon={Zap}
          tier={scoreTier(fleetSummary.avgPerformanceScore)}
        />
        <EnrichedStatCard
          label="تنبيهات ذكية"
          value={`${alerts.length + aiInsights.alerts.length}`}
          sub={alerts[0] ? alertLabel(alerts[0]) : 'لا تنبيهات'}
          icon={AlertTriangle}
          tier={alertsTier(alerts.length)}
        />
      </div>

      {/* ── AI Insights + Comparison ─────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.3fr,0.7fr] gap-4">
        <AIInsightsPanel insights={aiInsights} />

        <div className="space-y-4">
          <ComparisonCard
            title="الشهر الحالي vs السابق"
            currentValue={comparison.month.currentOrders.toLocaleString('en-US')}
            previousValue={comparison.month.previousOrders.toLocaleString('en-US')}
            change={comparison.month.growthPct}
            hint={`أيام العمل: ${comparison.month.currentActiveDays} مقابل ${comparison.month.previousActiveDays}`}
          />
          <ComparisonCard
            title="الأسبوع الحالي vs السابق"
            currentValue={comparison.week.currentOrders.toLocaleString('en-US')}
            previousValue={comparison.week.previousOrders.toLocaleString('en-US')}
            change={comparison.week.growthPct}
            hint="قراءة سريعة لتغيّر الزخم"
          />
          <div className="bg-card rounded-2xl p-4 shadow-card">
            <p className="text-sm font-bold text-foreground">توزيع الأداء</p>
            <div className="space-y-3 mt-4">
              {(['excellent', 'good', 'average', 'weak'] as const).map((tier) => {
                const labels: Record<string, { ar: string; color: string }> = {
                  excellent: { ar: 'ممتاز', color: 'text-emerald-600' },
                  good: { ar: 'جيد', color: 'text-blue-600' },
                  average: { ar: 'متوسط', color: 'text-amber-600' },
                  weak: { ar: 'ضعيف', color: 'text-rose-500' },
                };
                const l = labels[tier];
                const val = distribution[tier];
                return (
                  <div key={tier} className="flex items-center justify-between text-sm">
                    <span>{l.ar}</span>
                    <span className={`font-black ${l.color}`}>{val}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ── Platform Performance ──────────────────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-[1.4fr,0.8fr] gap-4">
        <div className="bg-card rounded-2xl p-5 shadow-card">
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
          <div className="bg-card rounded-2xl p-5 shadow-card">
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

          <div className="bg-card rounded-2xl p-5 shadow-card">
            <h3 className="text-sm font-bold text-foreground mb-4">ملخص سريع</h3>
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span>أفضل مندوب</span>
                <span className="font-bold text-foreground">
                  {rankings.topPerformers[0]?.employeeName ?? 'لا يوجد'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>أكبر تحسّن</span>
                <span className="font-bold text-foreground">
                  {rankings.mostImproved[0]?.employeeName ?? 'لا يوجد'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>أكبر انخفاض</span>
                <span className="font-bold text-foreground">
                  {rankings.mostDeclined[0]?.employeeName ?? 'لا يوجد'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── AI Recommendations ───────────────────────────────────────────── */}
      <AIRecommendationsSection recommendations={aiInsights.recommendations} />

      {/* ── Smart Alerts ─────────────────────────────────────────────────── */}
      <div className="bg-card rounded-2xl p-5 shadow-card">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="text-sm font-bold text-foreground">التنبيهات الذكية</h3>
            <p className="text-[11px] text-muted-foreground mt-1">حالات تحتاج متابعة الآن</p>
          </div>
          <span className="text-xs font-semibold text-muted-foreground">{alerts.length} تنبيه</span>
        </div>
        {alerts.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">لا توجد تنبيهات حالياً ✅</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {alerts.map((alert) => (
              <div
                key={alert.employeeId}
                className="rounded-xl border border-border/60 bg-muted/20 px-4 py-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-bold text-foreground">{alert.employeeName ?? 'فريق التشغيل'}</p>
                  <span className={`text-[11px] font-bold ${alert.severity === 'high' ? 'text-rose-500' : 'text-amber-600'}`}>  
                    {alert.severity === 'high' ? 'عالي' : 'متوسط'}
                  </span>
                </div>
                <p className="text-[12px] text-muted-foreground mt-2">{alertLabel(alert)}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Detailed Table ───────────────────────────────────────────────── */}
      {allProfiles.length > 0 && (
        <PerformanceDetailedTable riders={allProfiles} />
      )}
    </div>
  );
}
