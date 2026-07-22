import { useMemo } from 'react';
import { CalendarDays, CalendarCheck, Crown, TrendingUp, TrendingDown, Award } from 'lucide-react';
import {
  computeBestDaysAnalytics,
  computeWeeklyBreakdown,
} from '@modules/dashboard/lib/performanceEngine';

interface Props {
  readonly dailyTrend?: Array<{ date: string; orders: number }>;
}

export function DashboardWeeklyBestDaysCard({ dailyTrend = [] }: Props) {
  const weeklyData = useMemo(() => computeWeeklyBreakdown(dailyTrend), [dailyTrend]);
  const bestDaysData = useMemo(() => computeBestDaysAnalytics(dailyTrend), [dailyTrend]);

  if (!dailyTrend || dailyTrend.length === 0) {
    return null;
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* 1. Weekly Breakdown Card */}
      <div className="lg:col-span-7 bg-card shadow-card rounded-2xl p-5 border border-border/50 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-border/40">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-primary/10 text-primary">
              <CalendarDays className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-foreground">مقارنة الأسابيع خلال الشهر</h3>
              <p className="text-xs text-muted-foreground">توزيع حجم الطلبات والمعدل اليومي أسبوعياً</p>
            </div>
          </div>
          <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-secondary text-secondary-foreground">
            {weeklyData.length} أسابيع
          </span>
        </div>

        <div className="space-y-3">
          {weeklyData.map((week) => {
            const hasGrowth = week.growthVsPrevWeekPct !== null;
            const isPositive = (week.growthVsPrevWeekPct ?? 0) >= 0;

            return (
              <div
                key={week.weekNumber}
                className="p-3.5 rounded-xl bg-muted/30 border border-border/30 hover:bg-muted/50 transition-colors space-y-2"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black px-2 py-0.5 rounded-md bg-primary/10 text-primary">
                      W{week.weekNumber}
                    </span>
                    <span className="text-sm font-bold text-foreground">{week.label}</span>
                    <span className="text-xs text-muted-foreground">({week.dayRangeLabel})</span>
                  </div>

                  <div className="flex items-center gap-3">
                    {hasGrowth && (
                      <span
                        className={`inline-flex items-center text-xs font-bold px-2 py-0.5 rounded-full ${
                          isPositive
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                            : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                        }`}
                      >
                        {isPositive ? (
                          <TrendingUp className="w-3 h-3 me-1" />
                        ) : (
                          <TrendingDown className="w-3 h-3 me-1" />
                        )}
                        {isPositive ? '+' : ''}
                        {week.growthVsPrevWeekPct}%
                      </span>
                    )}

                    <span className="text-sm font-black text-foreground">
                      {week.totalOrders.toLocaleString('en-US')}{' '}
                      <span className="text-xs font-normal text-muted-foreground">طلب</span>
                    </span>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="flex items-center gap-3 text-xs text-muted-foreground pt-1">
                  <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-primary h-full rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(100, Math.max(5, week.shareOfTotalPct))}%` }}
                    />
                  </div>
                  <span className="font-semibold text-foreground min-w-[45px] text-end">
                    {week.shareOfTotalPct}% من الشهر
                  </span>
                </div>

                <div className="text-[11px] text-muted-foreground flex justify-between pt-0.5">
                  <span>أيام النشاط: {week.activeDaysCount} أيام</span>
                  <span>المعدل اليومي: {week.avgDailyOrders.toLocaleString('en-US')} طلب/يوم</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 2. Best Days Analysis Card */}
      <div className="lg:col-span-5 bg-card shadow-card rounded-2xl p-5 border border-border/50 space-y-4 flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between pb-3 border-b border-border/40 mb-4">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
                <Crown className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-foreground">أفضل الأيام خلال الشهر</h3>
                <p className="text-xs text-muted-foreground">أعلى الأيام واليوم الأكثر إنتاجية</p>
              </div>
            </div>
          </div>

          {/* Golden Day of the Week Highlight */}
          {bestDaysData.bestDayOfWeek && (
            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-foreground mb-4 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Award className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                  <span className="text-xs font-bold text-amber-700 dark:text-amber-300">
                    اليوم الذهبي في الأسبوع
                  </span>
                </div>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-300">
                  أعلى معدل يومي
                </span>
              </div>
              <div className="flex items-baseline justify-between pt-1">
                <span className="text-xl font-black text-amber-900 dark:text-amber-100">
                  يوم {bestDaysData.bestDayOfWeek.dayName}
                </span>
                <span className="text-sm font-extrabold text-amber-800 dark:text-amber-200">
                  بمتوسط {bestDaysData.bestDayOfWeek.avgOrders.toLocaleString('en-US')} طلب/يوم
                </span>
              </div>
            </div>
          )}

          {/* Top Peak Dates */}
          <div className="space-y-2.5">
            <h4 className="text-xs font-bold text-muted-foreground flex items-center gap-1.5">
              <CalendarCheck className="w-3.5 h-3.5" />
              أعلى 3 أيام في إجمالي الطلبات:
            </h4>

            {bestDaysData.topPeakDays.map((peak, idx) => (
              <div
                key={peak.date}
                className="flex items-center justify-between p-3 rounded-xl bg-muted/40 border border-border/30"
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                      idx === 0
                        ? 'bg-amber-500 text-white'
                        : idx === 1
                        ? 'bg-slate-300 text-slate-800'
                        : 'bg-amber-700/30 text-amber-900 dark:text-amber-200'
                    }`}
                  >
                    {idx + 1}
                  </span>
                  <div>
                    <p className="text-sm font-bold text-foreground">
                      {peak.dayName} - {peak.date}
                    </p>
                  </div>
                </div>

                <span className="text-sm font-black text-foreground">
                  {peak.orders.toLocaleString('en-US')}{' '}
                  <span className="text-xs font-normal text-muted-foreground">طلب</span>
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Highest Single Day Record */}
        {bestDaysData.highestSingleDayOrders > 0 && (
          <div className="pt-3 border-t border-border/40 flex items-center justify-between text-xs text-muted-foreground">
            <span>أعلى رقم قياسي في يوم واحد:</span>
            <span className="font-bold text-foreground">
              {bestDaysData.highestSingleDayOrders.toLocaleString('en-US')} طلب
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
