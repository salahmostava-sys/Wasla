/**
 * RiderProfilePerformanceCard — Comprehensive rider profile showing
 * performance, comparison, trends, AI analysis, finance, and targets.
 */

import { useMemo } from 'react';
import {
  Target,
  Calendar,
  Award,
  AlertTriangle,
  DollarSign,
} from 'lucide-react';

import type { RiderProfilePerformanceResponse } from '@services/performanceService';
import {
  buildRiderDetailProfile,
  enrichWithDelta,
} from '@modules/dashboard/lib/performanceEngine';
import {
  analyzeRider,
} from '@modules/dashboard/lib/aiInsightsEngine';
import { PerformanceScoreBadge } from './PerformanceScoreBadge';

interface RiderProfilePerformanceCardProps {
  data: RiderProfilePerformanceResponse;
}



function ProfileStatRow({
  label,
  value,
  sub,
}: Readonly<{
  label: string;
  value: string;
  sub?: string;
}>) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-border/30 last:border-b-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="text-end">
        <span className="text-sm font-bold text-foreground">{value}</span>
        {sub && <p className="text-[10px] text-muted-foreground">{sub}</p>}
      </div>
    </div>
  );
}

function ComparisonRow({
  label,
  current,
  previous,
  pct,
}: Readonly<{
  label: string;
  current: number;
  previous: number;
  pct: number;
}>) {
  const positive = pct >= 0;
  return (
    <div className="flex items-center justify-between py-2 border-b border-border/30 last:border-b-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="flex items-center gap-3">
        <span className="text-xs text-muted-foreground">{previous.toLocaleString('en-US')}</span>
        <span className="text-xs text-muted-foreground">→</span>
        <span className="text-sm font-bold text-foreground">{current.toLocaleString('en-US')}</span>
        <span className={`text-xs font-bold ${positive ? 'text-emerald-600' : 'text-rose-500'}`}>
          {positive ? '+' : ''}{pct.toFixed(1)}%
        </span>
      </div>
    </div>
  );
}

function TargetProgressBar({
  value,
  target,
  pct,
}: Readonly<{
  value: number;
  target: number;
  pct: number;
}>) {
  const clampedPct = Math.min(100, Math.max(0, pct));
  const color = (() => {
    if (clampedPct >= 100) return 'bg-emerald-500';
    if (clampedPct >= 70) return 'bg-blue-500';
    if (clampedPct >= 40) return 'bg-amber-500';
    return 'bg-rose-500';
  })();

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">الهدف: {target.toLocaleString('en-US')} طلب</span>
        <span className="font-bold text-foreground">{pct.toFixed(0)}%</span>
      </div>
      <div className="w-full h-2.5 bg-muted rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color} transition-all duration-500`} style={{ width: `${clampedPct}%` }} />
      </div>
      <p className="text-[10px] text-muted-foreground">
        {value.toLocaleString('en-US')} من {target.toLocaleString('en-US')} طلب
      </p>
    </div>
  );
}

function MonthRow({
  monthYear,
  totalOrders,
  avgOrdersPerDay,
  activeDays,
  targetPct,
}: Readonly<{
  monthYear: string;
  totalOrders: number;
  avgOrdersPerDay: number;
  activeDays: number;
  targetPct: number;
}>) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-border/30 last:border-b-0">
      <span className="text-xs font-medium text-foreground">{monthYear}</span>
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span>{totalOrders.toLocaleString('en-US')} طلب</span>
        <span>{avgOrdersPerDay.toFixed(1)}/يوم</span>
        <span>{activeDays} يوم</span>
        {targetPct > 0 && (
          <span className={targetPct >= 100 ? 'text-emerald-600 font-bold' : ''}>
            {targetPct.toFixed(0)}%
          </span>
        )}
      </div>
    </div>
  );
}

export function RiderProfilePerformanceCard({ data }: Readonly<RiderProfilePerformanceCardProps>) {
  const profile = useMemo(() => buildRiderDetailProfile(data), [data]);
  const analysis = useMemo(
    () => (profile ? analyzeRider(profile) : null),
    [profile],
  );

  if (!profile || !analysis) {
    return (
      <div className="bg-card -2xl p-6 shadow-card text-center text-sm text-muted-foreground rounded-2xl">
        لا توجد بيانات أداء كافية
      </div>
    );
  }

  const { summary, comparison, platforms, platformBreakdown, lastThreeMonths, salary } = data;

  return (
    <div className="space-y-4">
      {/* ── Header + Score ─────────────────────────────────────────── */}
      <div className="bg-card -2xl p-5 shadow-card rounded-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-black text-foreground">{profile.employeeName}</h2>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {platforms.map((p) => (
                <span
                  key={p.appId}
                  className="text-[10px] font-bold px-2 py-0.5 rounded-md"
                  style={{ backgroundColor: p.brandColor, color: '#fff' }}
                >
                  {p.appName}
                </span>
              ))}
              {profile.city && (
                <span className="text-[10px] text-muted-foreground">{profile.city}</span>
              )}
            </div>
          </div>
          <PerformanceScoreBadge score={profile.performanceScore} size="lg" />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* ── الأداء الحالي ──────────────────────────────────── */}
        <div className="bg-card -2xl p-5 shadow-card rounded-2xl">
          <div className="flex items-center gap-2 mb-3">
            <Target size={16} className="text-foreground" />
            <h3 className="text-sm font-bold text-foreground">الأداء الحالي</h3>
          </div>
          <ProfileStatRow
            label="إجمالي الطلبات"
            value={enrichWithDelta(summary.totalOrders, comparison.month.previousOrders).enrichedText}
          />
          <ProfileStatRow
            label="متوسط/يوم"
            value={summary.avgOrdersPerDay.toFixed(1)}
            sub={`${summary.activeDays} يوم عمل`}
          />
          <ProfileStatRow
            label="الانتظام"
            value={`${Math.round(summary.consistencyRatio * 100)}%`}
          />
          <ProfileStatRow
            label="الترتيب"
            value={`#${summary.rank}`}
            sub={`من أصل ${summary.rankOutOf}`}
          />
        </div>

        {/* ── المقارنة ──────────────────────────────────────── */}
        <div className="bg-card -2xl p-5 shadow-card rounded-2xl">
          <div className="flex items-center gap-2 mb-3">
            <Calendar size={16} className="text-foreground" />
            <h3 className="text-sm font-bold text-foreground">مقارنة الأداء</h3>
          </div>
          <ComparisonRow
            label="الشهر"
            current={comparison.month.currentOrders}
            previous={comparison.month.previousOrders}
            pct={comparison.month.growthPct}
          />
          <ComparisonRow
            label="المتوسط/يوم"
            current={comparison.month.currentAvgOrdersPerDay}
            previous={comparison.month.previousAvgOrdersPerDay}
            pct={comparison.month.avgGrowthPct}
          />
          <ComparisonRow
            label="الأسبوع"
            current={comparison.week.currentOrders}
            previous={comparison.week.previousOrders}
            pct={comparison.week.growthPct}
          />
          <ComparisonRow
            label="أيام العمل"
            current={comparison.month.currentActiveDays}
            previous={comparison.month.previousActiveDays}
            pct={0}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* ── تحليل AI ─────────────────────────────────────── */}
        <div className="bg-card -2xl p-5 shadow-card rounded-2xl">
          <div className="flex items-center gap-2 mb-3">
            <Award size={16} className="text-violet-600" />
            <h3 className="text-sm font-bold text-foreground">تحليل ذكي</h3>
            <span className="text-[10px] font-bold text-violet-600 bg-violet-50 px-2 py-0.5 rounded-md">AI</span>
          </div>
          <div className="rounded-xl bg-gradient-to-br from-violet-50 to-purple-50/50 border border-violet-100 px-4 py-3 mb-3">
            <p className="text-sm font-bold text-violet-900 leading-relaxed">
              {analysis.judgmentText}
            </p>
          </div>
          <div className="space-y-1.5">
            {analysis.details.map((detail) => (
              <div key={detail} className="flex items-start gap-2 text-xs text-muted-foreground">
                <span className="mt-1 w-1.5 h-1.5 rounded-full bg-violet-300 shrink-0" />
                <span>{detail}</span>
              </div>
            ))}
          </div>
          {analysis.needsFollowUp && (
            <div className="flex items-center gap-2 mt-4 px-3 py-2 rounded-xl bg-amber-50 border border-amber-200">
              <AlertTriangle size={14} className="text-amber-600 shrink-0" />
              <span className="text-xs font-bold text-amber-800">يحتاج متابعة</span>
            </div>
          )}
        </div>

        {/* ── Finance ──────────────────────────────────────── */}
        <div className="bg-card -2xl p-5 shadow-card rounded-2xl">
          <div className="flex items-center gap-2 mb-3">
            <DollarSign size={16} className="text-foreground" />
            <h3 className="text-sm font-bold text-foreground">المالية</h3>
          </div>
          {salary ? (
            <>
              <ProfileStatRow label="الراتب الأساسي" value={`${salary.baseSalary.toLocaleString('en-US')} ر.س`} />
              <ProfileStatRow label="البدلات" value={`+${salary.allowances.toLocaleString('en-US')} ر.س`} />
              <ProfileStatRow
                label="الاستقطاعات"
                value={`-${(salary.attendanceDeduction + salary.advanceDeduction + salary.externalDeduction + salary.manualDeduction).toLocaleString('en-US')} ر.س`}
              />
              <div className="flex items-center justify-between py-3 mt-1 border-t-2 border-foreground/10">
                <span className="text-sm font-bold text-foreground">صافي الراتب</span>
                <span className="text-lg font-black text-foreground">
                  {salary.netSalary.toLocaleString('en-US')} ر.س
                </span>
              </div>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                  salary.isApproved
                    ? 'bg-emerald-50 text-emerald-700'
                    : 'bg-amber-50 text-amber-700'
                }`}
              >
                {salary.isApproved ? 'معتمد' : 'غير معتمد'}
              </span>
            </>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">لا توجد بيانات رواتب</p>
          )}
        </div>
      </div>

      {/* ── Target Progress ──────────────────────────────────── */}
      {summary.monthlyTargetOrders > 0 && (
        <div className="bg-card -2xl p-5 shadow-card rounded-2xl">
          <div className="flex items-center gap-2 mb-3">
            <Target size={16} className="text-foreground" />
            <h3 className="text-sm font-bold text-foreground">تحقيق الهدف</h3>
          </div>
          <TargetProgressBar
            value={summary.totalOrders}
            target={summary.monthlyTargetOrders}
            pct={summary.targetAchievementPct}
          />
        </div>
      )}

      {/* ── Last 3 Months Trend ──────────────────────────────── */}
      {lastThreeMonths.length > 0 && (
        <div className="bg-card -2xl p-5 shadow-card rounded-2xl">
          <h3 className="text-sm font-bold text-foreground mb-3">آخر 3 شهور</h3>
          {lastThreeMonths.map((m) => (
            <MonthRow
              key={m.monthYear}
              monthYear={m.monthYear}
              totalOrders={m.totalOrders}
              avgOrdersPerDay={m.avgOrdersPerDay}
              activeDays={m.activeDays}
              targetPct={m.targetAchievementPct}
            />
          ))}
        </div>
      )}

      {/* ── Platform Breakdown ───────────────────────────────── */}
      {platformBreakdown.length > 0 && (
        <div className="bg-card -2xl p-5 shadow-card rounded-2xl">
          <h3 className="text-sm font-bold text-foreground mb-3">توزيع المنصات</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {platformBreakdown.map((pb) => (
              <div
                key={pb.appId}
                className="rounded-xl p-3 text-center"
                style={{ backgroundColor: `${pb.brandColor}15`, borderColor: `${pb.brandColor}30`, borderWidth: 1 }}
              >
                <p className="text-xs font-bold" style={{ color: pb.brandColor }}>
                  {pb.appName}
                </p>
                <p className="text-lg font-black text-foreground mt-1">
                  {pb.orders.toLocaleString('en-US')}
                </p>
                <p className="text-[10px] text-muted-foreground">طلب</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
