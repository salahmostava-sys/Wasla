import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { addMonths, endOfMonth, format, parse, subMonths } from 'date-fns';
import { ar } from 'date-fns/locale';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { TrendingUp, Brain, MessageCircle, Users, Target, AlertTriangle } from 'lucide-react';
import { PageSection } from '@shared/components/layout/PageScaffold';
import { dashboardService } from '@services/dashboardService';
import { performanceService, type PerformanceAlert, type PerformanceDashboardResponse } from '@services/performanceService';
import { authQueryUserId, useAuthQueryGate } from '@shared/hooks/useAuthQueryGate';
import { useAuth } from '@app/providers/AuthContext';
import { useTemporalContext } from '@app/providers/TemporalContext';
import { defaultQueryRetry } from '@shared/lib/query';
import { QueryErrorRetry } from '@shared/components/QueryErrorRetry';
import { Skeleton } from '@shared/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle } from '@shared/components/ui/card';
import { Badge } from '@shared/components/ui/badge';
import { predictOrders } from '@shared/lib/predictOrders';
import { AIDashboard } from '@modules/ai-dashboard';

const MONTHS_BACK = 8;

const DIST_LABELS: Record<string, string> = {
  excellent: 'ممتاز',
  good: 'جيد',
  average: 'متوسط',
  weak: 'يحتاج دعم',
};

const ALERT_TYPE_LABELS: Record<PerformanceAlert['alertType'], string> = {
  declining: 'تراجع في الأداء',
  inactive_recently: 'خمول حديث',
  below_target: 'أقل من المستهدف',
  low_consistency: 'تذبذب في الإنتاجية',
};

const SEVERITY_BADGE: Record<PerformanceAlert['severity'], 'destructive' | 'secondary' | 'outline'> = {
  high: 'destructive',
  medium: 'secondary',
  low: 'outline',
};

const SEVERITY_LABELS: Record<PerformanceAlert['severity'], string> = {
  high: 'عالٍ',
  medium: 'متوسط',
  low: 'منخفض',
};

const PIE_COLORS = ['hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))'];

type ChartRow = {
  month: string;
  actual: number | null;
  forecast: number | null;
};

/* ── Extracted sub-components to reduce cognitive complexity ─── */

function PerformanceSummaryCards({ perf, growthPct, targetPct }: Readonly<{
  perf: PerformanceDashboardResponse | undefined;
  growthPct: number | undefined;
  targetPct: number | undefined;
}>) {
  let growthText = '—';
  if (growthPct !== undefined && !Number.isNaN(growthPct)) {
    const sign = growthPct >= 0 ? '+' : '';
    growthText = `${sign}${growthPct.toFixed(1)}٪`;
  }

  let targetText = '—';
  if (targetPct !== undefined && !Number.isNaN(targetPct)) {
    targetText = `${targetPct.toFixed(1)}٪`;
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            إجمالي الطلبات
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold tabular-nums">
            {(perf?.summary?.totalOrders ?? 0).toLocaleString('ar-SA')}
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-2">
            <Users className="h-4 w-4" />
            مناديب نشطون
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold tabular-nums">
            {(perf?.summary?.activeRiders ?? 0).toLocaleString('ar-SA')}
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-xs font-medium text-muted-foreground">نمو الطلبات (شهر)</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold tabular-nums">
            {growthText}
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-2">
            <Target className="h-4 w-4" />
            تحقيق المستهدف
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold tabular-nums">
            {targetText}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function PerformanceAlerts({ alerts }: Readonly<{ alerts: PerformanceAlert[] }>) {
  if (alerts.length === 0) return null;
  return (
    <Card className="border-amber-500/30 bg-amber-500/5">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          تنبيهات ذكية من النظام
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {alerts.slice(0, 8).map((a) => (
          <div
            key={a.id}
            className="flex flex-wrap items-center gap-2 rounded-lg border border-border/60 bg-card px-3 py-2 text-sm"
          >
            <Badge variant={SEVERITY_BADGE[a.severity]}>
              {SEVERITY_LABELS[a.severity]}
            </Badge>
            <span className="text-muted-foreground">{ALERT_TYPE_LABELS[a.alertType]}</span>
            {a.employeeName && (
              <span className="font-medium text-foreground">{a.employeeName}</span>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function DistributionPieChart({ pieData }: Readonly<{ pieData: { name: string; value: number }[] }>) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">توزيع أداء المناديب</CardTitle>
      </CardHeader>
      <CardContent className="h-[280px]">
        {pieData.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-12">لا توجد بيانات توزيع لهذا الشهر.</p>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={pieData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={90}
                label={({ name, percent }) =>
                  `${name} ${((percent ?? 0) * 100).toFixed(0)}٪`
                }
              >
                {pieData.map((entry, i) => (
                  <Cell key={entry.name} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                formatter={(v: number) => v.toLocaleString('ar-SA')}
                contentStyle={{ direction: 'rtl' }}
              />
            </PieChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}

function OrdersByAppChart({ barData }: Readonly<{ barData: { name: string; orders: number; fill: string }[] }>) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">الطلبات حسب التطبيق (أعلى 10)</CardTitle>
      </CardHeader>
      <CardContent className="h-[280px]">
        {barData.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-12">لا توجد بيانات تطبيقات.</p>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={barData} layout="vertical" margin={{ left: 8, right: 16 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => Number(v).toLocaleString('ar-SA')} />
              <YAxis
                type="category"
                dataKey="name"
                width={100}
                tick={{ fontSize: 10 }}
              />
              <Tooltip
                formatter={(v: number) => [v.toLocaleString('ar-SA'), 'طلبات']}
                contentStyle={{ direction: 'rtl' }}
              />
              <Bar dataKey="orders" radius={[0, 4, 4, 0]}>
                {barData.map((entry, i) => (
                  <Cell key={entry.name + String(i)} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}

function AiAnalyticsForecastSection({
  isLoading,
  isError,
  error,
  refetch,
  isFetching,
  forecast,
}: Readonly<{
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  refetch: () => unknown;
  isFetching: boolean;
  forecast: { next: number; lastGrowth: number } | null;
}>) {
  if (isLoading) {
    return <Skeleton className="h-24 w-full rounded-xl" />;
  }
  if (isError) {
    return (
      <QueryErrorRetry
        error={error}
        onRetry={() => refetch().catch(() => {})}
        isFetching={isFetching}
        title="تعذر تحميل بيانات التحليلات"
        hint="تحقق من الاتصال ثم أعد المحاولة."
      />
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 text-foreground">
        <TrendingUp className="h-5 w-5 text-primary" />
        <span className="font-semibold">تنبؤ الطلبات للشهر القادم:</span>
        <span className="text-2xl font-bold tabular-nums">
          {forecast !== null ? forecast.next.toLocaleString('ar-SA') : '—'}
        </span>
      </div>
      {forecast !== null && (
        <span className="text-xs text-muted-foreground">
          التغيّر بين آخر شهرين: {forecast.lastGrowth >= 0 ? '+' : ''}
          {Math.round(forecast.lastGrowth).toLocaleString('ar-SA')} طلب
        </span>
      )}
    </div>
  );
}

function AiAnalyticsOrdersLineChartSection({
  isLoading,
  isError,
  error,
  refetch,
  isFetching,
  chartData,
}: Readonly<{
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  refetch: () => unknown;
  isFetching: boolean;
  chartData: ChartRow[];
}>) {
  if (isLoading) {
    return <Skeleton className="h-full w-full rounded-xl" />;
  }
  if (isError) {
    return (
      <QueryErrorRetry
        error={error}
        onRetry={() => refetch().catch(() => {})}
        isFetching={isFetching}
        title="تعذر تحميل بيانات التحليلات"
        hint="تحقق من الاتصال ثم أعد المحاولة."
      />
    );
  }
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={chartData} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis dataKey="month" tick={{ fontSize: 11 }} interval={0} angle={-22} textAnchor="end" height={72} />
        <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => Number(v).toLocaleString('ar-SA')} />
        <Tooltip
          formatter={(value: number | undefined, name: string) => {
            const label = name === 'actual' ? 'فعلي' : 'تنبؤ';
            return [value !== null && value !== undefined ? value.toLocaleString('ar-SA') : '—', label];
          }}
          contentStyle={{ direction: 'rtl' }}
        />
        <Legend formatter={(value) => (value === 'actual' ? 'فعلي' : 'تنبؤ')} />
        <Line
          type="monotone"
          dataKey="actual"
          name="actual"
          stroke="hsl(var(--primary))"
          strokeWidth={2}
          dot={{ r: 3 }}
          connectNulls
        />
        <Line
          type="monotone"
          dataKey="forecast"
          name="forecast"
          stroke="hsl(var(--chart-2))"
          strokeWidth={2}
          strokeDasharray="6 4"
          dot={{ r: 4 }}
          connectNulls
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

const AiAnalyticsPage = () => {
  const { user } = useAuth();
  const { selectedMonth } = useTemporalContext();
  const { enabled, userId } = useAuthQueryGate();
  const uid = authQueryUserId(user?.id ?? userId);

  const selectedMonthDate = useMemo(
    () => parse(`${selectedMonth}-01`, 'yyyy-MM-dd', new Date()),
    [selectedMonth],
  );
  const selectedMonthLabel = useMemo(
    () => format(selectedMonthDate, 'MMMM yyyy', { locale: ar }),
    [selectedMonthDate],
  );
  const isViewingCurrentMonth = selectedMonth === format(new Date(), 'yyyy-MM');
  const daysPassedForForecast = isViewingCurrentMonth
    ? new Date().getDate()
    : endOfMonth(selectedMonthDate).getDate();

  const monthKeys = useMemo(() => {
    const keys: string[] = [];
    for (let i = MONTHS_BACK - 1; i >= 0; i--) {
      keys.push(format(subMonths(selectedMonthDate, i), 'yyyy-MM'));
    }
    return keys;
  }, [selectedMonthDate]);

  const q = useQuery({
    queryKey: ['ai-analytics', 'orders-trend', uid, monthKeys],
    enabled,
    retry: defaultQueryRetry,
    queryFn: async () => {
      const totals = await Promise.all(
        monthKeys.map((my) => dashboardService.getMonthOrdersCount(my)),
      );
      return { totals, monthKeys };
    },
  });

  const perfQ = useQuery({
    queryKey: ['ai-analytics', 'performance-dashboard', uid, selectedMonth],
    enabled,
    retry: defaultQueryRetry,
    queryFn: () => performanceService.getDashboard(selectedMonth),
  });

  const { isLoading, isError, error, refetch, isFetching, data: queryData } = q;
  const currentMonthOrders = queryData?.totals[queryData.totals.length - 1] ?? null;
  const perf = perfQ.data;

  const pieData = useMemo(() => {
    const d = perf?.distribution;
    if (!d) return [];
    return (
      [
        { key: 'excellent', value: d.excellent },
        { key: 'good', value: d.good },
        { key: 'average', value: d.average },
        { key: 'weak', value: d.weak },
      ] as const
    )
      .filter((row) => row.value > 0)
      .map((row) => ({
        name: DIST_LABELS[row.key] ?? row.key,
        value: row.value,
      }));
  }, [perf?.distribution]);

  const barData = useMemo(() => {
    const rows = perf?.ordersByApp ?? [];
    return [...rows]
      .sort((a, b) => b.orders - a.orders)
      .slice(0, 10)
      .map((r) => ({
        name: r.appName || '—',
        orders: r.orders,
        fill: r.brandColor?.startsWith('#') ? r.brandColor : 'hsl(var(--primary))',
      }));
  }, [perf?.ordersByApp]);

  const alerts = perf?.alerts ?? [];

  const { chartData, forecast } = useMemo(() => {
    if (!queryData?.totals.length) {
      return {
        chartData: [] as ChartRow[],
        forecast: null as { next: number; lastGrowth: number } | null,
      };
    }
    const { totals, monthKeys: keys } = queryData;
    const next = Math.max(0, predictOrders(totals));
    const lastGrowth =
      totals.length >= 2 ? totals[totals.length - 1] - totals[totals.length - 2] : 0;
    const fc = { next, lastGrowth };
    const rows: ChartRow[] = keys.map((k, i) => ({
      month: format(parse(`${k}-01`, 'yyyy-MM-dd', new Date()), 'MMM yyyy', { locale: ar }),
      actual: totals[i],
      forecast: null,
    }));
    const lastIdx = rows.length - 1;
    if (lastIdx >= 0) {
      rows[lastIdx] = {
        ...rows[lastIdx],
        forecast: totals[lastIdx],
      };
    }
    const lastKey = keys[keys.length - 1];
    const nextMonthDate = addMonths(parse(`${lastKey}-01`, 'yyyy-MM-dd', new Date()), 1);
    const nextLabel = format(nextMonthDate, 'MMM yyyy', { locale: ar });
    rows.push({
      month: `${nextLabel} (تنبؤ)`,
      actual: null,
      forecast: next,
    });
    return { chartData: rows, forecast: fc };
  }, [queryData]);

  const growthPct = perf?.comparison?.month?.growthPct;
  const targetPct = perf?.targets?.targetAchievementPct;

  return (
    <div className="space-y-4" dir="rtl">
      <nav className="page-breadcrumb">
        <span>الرئيسية</span>
        <span className="page-breadcrumb-sep">/</span>
        <span>تحليلات ذكية</span>
      </nav>

      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="flex flex-wrap items-start gap-3 py-4">
          <MessageCircle className="h-5 w-5 shrink-0 text-primary mt-0.5" />
          <div className="space-y-1 text-sm">
            <p className="font-medium text-foreground">مساعد الذكاء الاصطناعي</p>
            <p className="text-muted-foreground leading-relaxed">
              يمكنك طرح أسئلة على البيانات من أيقونة الدردشة في الشريط الجانبي بعد تسجيل الدخول — نفس السياق
              يدعم تحليلات هذه الصفحة.
            </p>
          </div>
        </CardContent>
      </Card>

      <PageSection title="لوحة القرارات الذكية">
        <div className="flex items-center gap-2 mb-4">
          <Brain className="h-5 w-5 text-primary" />
          <span className="text-sm font-semibold text-muted-foreground">تحليلات الذكاء الاصطناعي</span>
          <Badge variant="outline" className="mr-auto text-xs">
            {selectedMonthLabel}
          </Badge>
        </div>
        <AIDashboard
          currentOrders={currentMonthOrders}
          daysPassed={daysPassedForForecast}
          topPerformers={perf?.rankings?.topPerformers ?? []}
          monthlyTrend={perf?.monthlyTrend ?? []}
        />
      </PageSection>

      <PageSection title={`مؤشرات الأداء — ${selectedMonthLabel}`}>
        {perfQ.isLoading && (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {[1, 2, 3, 4].map((id) => (
              <Skeleton key={id} className="h-24 w-full rounded-xl" />
            ))}
          </div>
        )}
        {!perfQ.isLoading && perfQ.isError && (
          <QueryErrorRetry
            error={perfQ.error}
            onRetry={() => perfQ.refetch().catch(() => {})}
            isFetching={perfQ.isFetching}
            title="تعذر تحميل لوحة الأداء"
            hint="تأكد من صلاحياتك والاتصال ثم أعد المحاولة."
          />
        )}
        {!perfQ.isLoading && !perfQ.isError && (
          <div className="space-y-6">
            <PerformanceSummaryCards perf={perf} growthPct={growthPct} targetPct={targetPct} />
            <PerformanceAlerts alerts={alerts} />
            <div className="grid gap-6 lg:grid-cols-2">
              <DistributionPieChart pieData={pieData} />
              <OrdersByAppChart barData={barData} />
            </div>
          </div>
        )}
      </PageSection>

      <PageSection title="ملخص التنبؤ">
        <AiAnalyticsForecastSection
          isLoading={isLoading}
          isError={isError}
          error={error}
          refetch={refetch}
          isFetching={isFetching}
          forecast={forecast}
        />
      </PageSection>

      <PageSection title="الطلبات — فعلي مقابل تنبؤ">
        <div className="h-[380px] w-full min-h-[320px]">
          <AiAnalyticsOrdersLineChartSection
            isLoading={isLoading}
            isError={isError}
            error={error}
            refetch={refetch}
            isFetching={isFetching}
            chartData={chartData}
          />
        </div>
      </PageSection>
    </div>
  );
};

export default AiAnalyticsPage;
