import type { ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Activity,
  BarChart2,
  ChevronDown,
  ChevronUp,
  Minus,
  Target,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  endOfMonth,
  format,
  getDate,
  getDaysInMonth,
  startOfMonth,
  subMonths,
} from 'date-fns';

import { authQueryUserId, useAuthQueryGate } from '@shared/hooks/useAuthQueryGate';
import { QueryErrorRetry } from '@shared/components/QueryErrorRetry';
import { dashboardService } from '@services/dashboardService';

const MONTHS_BACK = 6;

type RiderMonthly = {
  id: string;
  name: string;
  months: number[];
  avg: number;
  trend: 'up' | 'down' | 'stable';
  lastMonth: number;
  thisMonth: number;
};

type AnalyticsMonth = {
  label: string;
  ym: string;
  start: string;
  end: string;
};

type AnalyticsTrendRow = {
  month: string;
  orders: number;
  riders: number;
  avg: number;
};

type AnalyticsAppBreakdownRow = {
  name: string;
  brand_color: string;
  thisMonth: number;
  lastMonth: number;
  growth: number;
};

type AnalyticsOrderRow = {
  employee_id: string;
  app_id: string;
  orders_count: number;
};

type AnalyticsResponse = {
  monthlyTrend: AnalyticsTrendRow[];
  riderMetrics: RiderMonthly[];
  projectedOrders: number;
  currentOrders: number;
  appBreakdown: AnalyticsAppBreakdownRow[];
};

type DashboardAnalyticsCardProps = {
  title: string;
  subtitle?: string;
  children: ReactNode;
};

function DashboardAnalyticsCard({
  title,
  subtitle,
  children,
}: Readonly<DashboardAnalyticsCardProps>) {
  return (
    <div className="bg-card -2xl shadow-card overflow-hidden rounded-2xl">
      <div
        className="flex items-center justify-between px-5 py-4"
        style={{ borderBottom: '1px solid hsl(var(--border))' }}
      >
        <div>
          <h3 className="text-sm font-bold text-foreground">{title}</h3>
          {subtitle ? (
            <p className="text-[11px] text-muted-foreground/80 mt-0.5">{subtitle}</p>
          ) : null}
        </div>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function buildHistoricalMonths(): AnalyticsMonth[] {
  return Array.from({ length: MONTHS_BACK }, (_, index) => {
    const monthDate = subMonths(new Date(), MONTHS_BACK - 1 - index);

    return {
      label: format(monthDate, 'MMM yy'),
      ym: format(monthDate, 'yyyy-MM'),
      start: format(startOfMonth(monthDate), 'yyyy-MM-dd'),
      end: format(endOfMonth(monthDate), 'yyyy-MM-dd'),
    };
  });
}

function sumOrders(rows: AnalyticsOrderRow[]) {
  return rows.reduce((sum, row) => sum + row.orders_count, 0);
}

function countUniqueRiders(rows: AnalyticsOrderRow[]) {
  return new Set(rows.map((row) => row.employee_id)).size;
}

function buildMonthlyTrend(
  months: AnalyticsMonth[],
  monthOrdersResults: Array<AnalyticsOrderRow[] | null>,
): AnalyticsTrendRow[] {
  return months.map((month, index) => {
    const rows = monthOrdersResults[index] || [];
    const totalOrders = sumOrders(rows);
    const activeRiders = countUniqueRiders(rows);

    return {
      month: month.label,
      orders: totalOrders,
      riders: activeRiders,
      avg: activeRiders > 0 ? Math.round(totalOrders / activeRiders) : 0,
    };
  });
}

function buildAppBreakdown(
  apps: Array<{ id: string; name: string; brand_color: string }>,
  currentOrders: AnalyticsOrderRow[],
  lastMonthOrders: AnalyticsOrderRow[],
): AnalyticsAppBreakdownRow[] {
  return apps
    .map((app) => {
      const thisMonth = currentOrders
        .filter((row) => row.app_id === app.id)
        .reduce((sum, row) => sum + row.orders_count, 0);
      const lastMonth = lastMonthOrders
        .filter((row) => row.app_id === app.id)
        .reduce((sum, row) => sum + row.orders_count, 0);
      const growth = lastMonth > 0 ? Math.round(((thisMonth - lastMonth) / lastMonth) * 100) : 0;

      return {
        name: app.name,
        brand_color: app.brand_color,
        thisMonth,
        lastMonth,
        growth,
      };
    })
    .sort((left, right) => right.thisMonth - left.thisMonth);
}

function accumulateRiderOrders(results: Array<AnalyticsOrderRow[] | null>) {
  const riderData: Record<string, number[]> = {};

  results.forEach((rows, monthIndex) => {
    (rows || []).forEach((row) => {
      if (!riderData[row.employee_id]) {
        riderData[row.employee_id] = Array.from({ length: results.length }, () => 0);
      }

      riderData[row.employee_id][monthIndex] += row.orders_count;
    });
  });

  return riderData;
}

function getRiderTrend(lastMonth: number, thisMonth: number): RiderMonthly['trend'] {
  if (thisMonth > lastMonth * 1.05) return 'up';
  if (thisMonth < lastMonth * 0.95) return 'down';
  return 'stable';
}

function getGrowthBadgeClass(growth: number) {
  if (growth > 0) return 'bg-emerald-50 text-emerald-700';
  if (growth < 0) return 'bg-rose-50 text-rose-600';
  return 'bg-muted/40 text-muted-foreground';
}

function buildRiderMetrics(
  riderData: Record<string, number[]>,
  employeeMap: Record<string, string>,
) {
  return Object.entries(riderData)
    .filter(([employeeId]) => employeeMap[employeeId])
    .map(([employeeId, monthlyOrders]) => {
      const totalOrders = monthlyOrders.reduce((sum, orders) => sum + orders, 0);
      const avg = Math.round(totalOrders / Math.max(monthlyOrders.length, 1));
      const lastMonth = monthlyOrders.at(-2) ?? 0;
      const thisMonth = monthlyOrders.at(-1) ?? 0;

      const riderMonthly: RiderMonthly = {
        id: employeeId,
        name: employeeMap[employeeId] || '—',
        months: monthlyOrders,
        avg,
        trend: getRiderTrend(lastMonth, thisMonth),
        lastMonth,
        thisMonth,
      };

      return riderMonthly;
    });
}

function AnalyticsLoadingState() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="text-center space-y-3">
        <BarChart2 size={40} className="mx-auto text-primary animate-pulse" />
        <p className="text-muted-foreground text-sm">جارٍ تحميل التحليلات...</p>
      </div>
    </div>
  );
}

export function DashboardAnalyticsTab() {
  const { enabled, userId } = useAuthQueryGate();
  const uid = authQueryUserId(userId);
  const daysInMonth = getDaysInMonth(new Date());
  const daysPassed = getDate(new Date());

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['dashboard-analytics', uid],
    enabled,
    queryFn: async (): Promise<AnalyticsResponse> => {
      const months = buildHistoricalMonths();
      const { apps, employees, monthOrders } = await dashboardService.fetchHistoricalData(months);
      const employeeMap = Object.fromEntries((employees || []).map((employee) => [employee.id, employee.name]));
      const monthlyTrend = buildMonthlyTrend(months, monthOrders);
      const currentOrdersRows = monthOrders[MONTHS_BACK - 1] || [];
      const currentOrders = sumOrders(currentOrdersRows);
      const projectedOrders = daysPassed > 0 ? Math.round((currentOrders / daysPassed) * daysInMonth) : 0;
      const lastMonthOrders = monthOrders[MONTHS_BACK - 2] || [];
      const appBreakdown = buildAppBreakdown(apps, currentOrdersRows, lastMonthOrders);
      const recentMonths = monthOrders.slice(MONTHS_BACK - 4);
      const riderData = accumulateRiderOrders(recentMonths);
      const riderMetrics = buildRiderMetrics(riderData, employeeMap);

      return {
        monthlyTrend,
        riderMetrics,
        projectedOrders,
        currentOrders,
        appBreakdown,
      };
    },
    staleTime: 5 * 60 * 1000,
  });

  const monthlyTrend = data?.monthlyTrend ?? [];
  const riderMetrics = data?.riderMetrics ?? [];
  const projectedOrders = data?.projectedOrders ?? 0;
  const appBreakdown = data?.appBreakdown ?? [];

  const needsImprovement = riderMetrics
    .filter(
      (rider) =>
        rider.trend === 'down' ||
        (riderMetrics.length > 0 &&
          rider.thisMonth < (monthlyTrend[MONTHS_BACK - 1]?.avg || 0) * 0.7),
    )
    .sort((left, right) => left.thisMonth - right.thisMonth)
    .slice(0, 10);

  const improving = riderMetrics
    .filter((rider) => rider.trend === 'up')
    .sort((left, right) => right.thisMonth - left.thisMonth)
    .slice(0, 5);

  const stable = riderMetrics.filter((rider) => rider.trend === 'stable').length;
  const overallAvg = monthlyTrend[MONTHS_BACK - 1]?.avg || 0;
  const previousMonthOrders = monthlyTrend[MONTHS_BACK - 2]?.orders || 0;
  const projectedGrowth =
    previousMonthOrders > 0
      ? Math.round(((projectedOrders - previousMonthOrders) / previousMonthOrders) * 100)
      : 0;

  if (isLoading) return <AnalyticsLoadingState />;

  if (isError) {
    return (
      <div className="flex items-center justify-center min-h-[280px] px-4">
        <QueryErrorRetry
          error={error}
          onRetry={() => { refetch(); }}
          isFetching={isFetching}
          title="تعذر تحميل التحليلات"
          hint="إذا استمر الخطأ: تأكد من الاتصال، ثم أعد المحاولة. قد تكون هناك ضغوط مؤقتة على الخادم."
          className="w-full max-w-lg"
        />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-blue-600 to-blue-700 text-white -2xl p-5 shadow-card rounded-2xl">
          <div className="flex items-center gap-2 mb-2">
            <Target size={16} />
            <span className="text-xs font-semibold opacity-80">الإسقاط المتوقع للشهر</span>
          </div>
          <p className="text-3xl font-black">{projectedOrders.toLocaleString('en-US')}</p>
          <p className="text-xs opacity-70 mt-1">
            بناءً على {daysPassed} يوم منقضي من {daysInMonth}
          </p>
          <div className={`mt-2 text-xs font-bold ${projectedGrowth >= 0 ? 'text-green-300' : 'text-red-300'}`}>
            {projectedGrowth >= 0 ? '↑' : '↓'} {Math.abs(projectedGrowth)}% عن الشهر السابق
          </div>
        </div>

        <div className="bg-card -2xl p-5 shadow-card rounded-2xl">
          <div className="flex items-center gap-2 mb-2 text-muted-foreground/80">
            <BarChart2 size={16} />
            <span className="text-xs font-semibold">متوسط الطلبات/مندوب</span>
          </div>
          <p className="text-3xl font-black text-foreground">{overallAvg.toLocaleString('en-US')}</p>
          <p className="text-xs text-muted-foreground/80 mt-1">هذا الشهر</p>
          <div className="mt-2 text-xs text-muted-foreground">
            {riderMetrics.filter((rider) => rider.thisMonth >= overallAvg).length} مندوب فوق المتوسط
          </div>
        </div>

        <div className="bg-card -2xl p-5 shadow-card rounded-2xl">
          <div className="flex items-center gap-2 mb-2 text-muted-foreground/80">
            <Activity size={16} />
            <span className="text-xs font-semibold">حالة الأداء</span>
          </div>
          <div className="space-y-2 mt-1">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-1.5 text-emerald-600 text-xs font-semibold">
                <ChevronUp size={13} />
                في تحسّن
              </div>
              <span className="font-black text-foreground">{improving.length}</span>
            </div>
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-1.5 text-muted-foreground/80 text-xs font-semibold">
                <Minus size={13} />
                مستقر
              </div>
              <span className="font-black text-foreground">{stable}</span>
            </div>
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-1.5 text-rose-500 text-xs font-semibold">
                <ChevronDown size={13} />
                يحتاج تحسين
              </div>
              <span className="font-black text-foreground">
                {riderMetrics.filter((rider) => rider.trend === 'down').length}
              </span>
            </div>
          </div>
        </div>
      </div>

      <DashboardAnalyticsCard
        title="اتجاه الطلبات والمتوسط — آخر 6 أشهر"
        subtitle="إجمالي الطلبات ومتوسط الطلبات لكل مندوب"
      >
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={monthlyTrend} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
            <XAxis
              dataKey="month"
              tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              yAxisId="left"
              tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '12px',
                fontSize: 12,
                color: 'hsl(var(--card-foreground))',
              }}
            />
            <Bar
              yAxisId="left"
              dataKey="orders"
              name="إجمالي الطلبات"
              fill="hsl(var(--primary))"
              radius={[6, 6, 0, 0]}
              opacity={0.85}
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="avg"
              name="متوسط/مندوب"
              stroke="#f59e0b"
              strokeWidth={2.5}
              dot={{ fill: '#f59e0b', r: 3 }}
            />
            <Legend />
          </BarChart>
        </ResponsiveContainer>
      </DashboardAnalyticsCard>

      <DashboardAnalyticsCard title="مقارنة أداء المنصات" subtitle="هذا الشهر مقارنة بالشهر السابق">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {appBreakdown.map((app) => (
            <div key={app.name} className="rounded-xl border border-border/50 p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-bold text-foreground">{app.name}</span>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${getGrowthBadgeClass(app.growth)}`}>
                  {app.growth > 0 ? '+' : ''}
                  {app.growth}%
                </span>
              </div>
              <p className="text-2xl font-black text-foreground">{app.thisMonth.toLocaleString('en-US')}</p>
              <p className="text-[11px] text-muted-foreground/80 mt-1">
                الشهر السابق: {app.lastMonth.toLocaleString('en-US')}
              </p>
              <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${app.lastMonth > 0 ? Math.min((app.thisMonth / app.lastMonth) * 100, 150) : 0}%`,
                    backgroundColor: app.brand_color,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </DashboardAnalyticsCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <DashboardAnalyticsCard title="يحتاجون تحسين" subtitle="أداء منخفض أو في تراجع هذا الشهر">
          <div className="space-y-1">
            {needsImprovement.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">لا توجد حالات تحتاج تحسين</p>
            ) : (
              needsImprovement.map((rider, index) => (
                <div
                  key={rider.id}
                  className="flex items-center gap-3 rounded-xl px-3 py-2.5 bg-rose-50/50 hover:bg-rose-50 transition-colors"
                >
                  <div className="w-7 h-7 rounded-lg bg-rose-100 text-rose-600 flex items-center justify-center text-xs font-bold flex-shrink-0">
                    {index + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{rider.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] text-muted-foreground/80">الشهر الماضي: {rider.lastMonth}</span>
                      <span className="text-[10px] text-rose-500 font-semibold">هذا الشهر: {rider.thisMonth}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 text-rose-500">
                    <ChevronDown size={14} />
                    {rider.lastMonth > 0 ? (
                      <span className="text-xs font-bold">
                        {Math.round(((rider.thisMonth - rider.lastMonth) / rider.lastMonth) * 100)}%
                      </span>
                    ) : null}
                  </div>
                </div>
              ))
            )}
          </div>
        </DashboardAnalyticsCard>

        <DashboardAnalyticsCard title="في تحسّن مستمر" subtitle="أداء متصاعد مقارنة بالشهر السابق">
          <div className="space-y-1">
            {improving.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">لا توجد بيانات كافية</p>
            ) : (
              improving.map((rider, index) => (
                <div
                  key={rider.id}
                  className="flex items-center gap-3 rounded-xl px-3 py-2.5 bg-emerald-50/50 hover:bg-emerald-50 transition-colors"
                >
                  <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs font-bold flex-shrink-0">
                    {index + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{rider.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] text-muted-foreground/80">الشهر الماضي: {rider.lastMonth}</span>
                      <span className="text-[10px] text-emerald-600 font-semibold">هذا الشهر: {rider.thisMonth}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 text-emerald-600">
                    <ChevronUp size={14} />
                    {rider.lastMonth > 0 ? (
                      <span className="text-xs font-bold">
                        +{Math.round(((rider.thisMonth - rider.lastMonth) / rider.lastMonth) * 100)}%
                      </span>
                    ) : null}
                  </div>
                </div>
              ))
            )}
          </div>
        </DashboardAnalyticsCard>
      </div>

      {overallAvg > 0 ? (
        <DashboardAnalyticsCard
          title="مناديب تحت المتوسط"
          subtitle={`المتوسط العام هذا الشهر: ${overallAvg} طلب`}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {riderMetrics
              .filter((rider) => rider.thisMonth > 0 && rider.thisMonth < overallAvg)
              .sort((left, right) => left.thisMonth - right.thisMonth)
              .slice(0, 12)
              .map((rider) => {
                const percentOfAverage = Math.round((rider.thisMonth / overallAvg) * 100);

                return (
                  <div
                    key={rider.id}
                    className="flex items-center gap-3 rounded-xl px-3 py-2.5 border border-amber-100 bg-amber-50/30"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-sm font-semibold text-foreground truncate">{rider.name}</p>
                        <span className="text-xs font-bold text-amber-700">{rider.thisMonth} طلب</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full bg-amber-400 transition-all"
                          style={{ width: `${percentOfAverage}%` }}
                        />
                      </div>
                      <p className="text-[10px] text-muted-foreground/80 mt-0.5">
                        {percentOfAverage}% من المتوسط
                      </p>
                    </div>
                  </div>
                );
              })}
          </div>
        </DashboardAnalyticsCard>
      ) : null}
    </div>
  );
}
