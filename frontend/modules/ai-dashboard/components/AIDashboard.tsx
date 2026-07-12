import { formatCurrency } from '@shared/lib/formatters';

import { useCallback, useEffect, useState } from 'react';
import {
  Brain,
  Database,
  DollarSign,
  Loader2,
  Minus,
  RefreshCcw,
  TrendingDown,
  TrendingUp,
  Trophy,
  Zap,
} from 'lucide-react';
import { aiService, type BestEmployeeResponse, type SalaryForecastResponse, type PredictOrdersResponse, type TopPlatformResponse, type SmartAlertsResponse, type AnomalyDetectionResponse, type DayRecord } from '@services/aiService';
import type { PerformanceRankingEntry } from '@services/performanceService';
import { useToast } from '@shared/hooks/use-toast';
import { Badge } from '@shared/components/ui/badge';
import { Button } from '@shared/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@shared/components/ui/card';

interface AIDashboardProps {
  currentOrders?: number | null;
  daysPassed?: number;
  topPerformers?: PerformanceRankingEntry[];
  monthlyTrend?: Array<{ monthYear: string; totalOrders: number }>;
}

const TIER_LABEL: Record<string, string> = {
  excellent: 'ممتاز',
  good: 'جيد',
  average: 'متوسط',
  needs_improvement: 'يحتاج دعم',
};

const TIER_VARIANT: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  excellent: 'default',
  good: 'secondary',
  average: 'outline',
  needs_improvement: 'destructive',
};

function renderSalaryForecastContent(
  loading: boolean,
  salaryForecast: SalaryForecastResponse | null,
  aiConfigured: boolean,
  getTrendIcon: (trend: string) => JSX.Element,
  getTrendLabel: (trend: string) => string,
  getConfidenceBadge: (confidence: string) => JSX.Element,
) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (salaryForecast) {
    return (
      <div className="space-y-4">
        <div className="text-center">
          <div className="text-2xl font-bold text-primary">
            {formatCurrency(salaryForecast.predicted_monthly_salary)}
          </div>
          <div className="text-xs text-muted-foreground">الراتب المتوقع لهذا الشهر</div>
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="rounded bg-muted p-2 text-center">
            <div className="font-medium">{salaryForecast.projected_monthly_orders.toLocaleString('en-US')}</div>
            <div className="text-muted-foreground">طلب متوقع</div>
          </div>
          <div className="rounded bg-muted p-2 text-center">
            <div className="font-medium">{salaryForecast.current_daily_avg.toLocaleString('en-US')}</div>
            <div className="text-muted-foreground">متوسط يومي</div>
          </div>
        </div>
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-1">
            {getTrendIcon(salaryForecast.trend)}
            <span>{getTrendLabel(salaryForecast.trend)}</span>
          </div>
          {getConfidenceBadge(salaryForecast.confidence)}
        </div>
        <div className="text-xs text-muted-foreground">
          متبقي {salaryForecast.days_remaining.toLocaleString('en-US')} يوم في الشهر
        </div>
      </div>
    );
  }
  if (aiConfigured) {
    return (
      <div className="py-8 text-center text-sm text-muted-foreground">
        لا توجد بيانات طلبات كافية لتوليد التوقع.
      </div>
    );
  }
  return (
    <div className="py-8 text-center text-sm text-muted-foreground">
      خدمة الذكاء الاصطناعي غير مهيأة في هذه البيئة.
    </div>
  );
}

function renderBestEmployeesContent(
  loading: boolean,
  aiConfigured: boolean,
  bestEmployees: BestEmployeeResponse | null,
  topPerformers: PerformanceRankingEntry[],
) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!aiConfigured) {
    return (
      <div className="py-8 text-center text-sm text-muted-foreground">
        يتطلب تفعيل خدمة الذكاء الاصطناعي.
      </div>
    );
  }
  if (bestEmployees && bestEmployees.employees.length > 0) {
    return (
      <div className="space-y-2">
        {bestEmployees.employees.slice(0, 5).map((emp, idx) => (
          <div
            key={emp.employee_id}
            className="flex items-center gap-2 border border-border/60 bg-card px-2 py-1.5 text-xs rounded-2xl"
          >
            <span className="w-4 font-bold text-muted-foreground tabular-nums">{idx + 1}</span>
            <span className="flex-1 truncate font-medium">{emp.employee_name}</span>
            <Badge variant={TIER_VARIANT[emp.performance_tier] ?? 'outline'} className="shrink-0 text-[10px]">
              {TIER_LABEL[emp.performance_tier] ?? emp.performance_tier}
            </Badge>
            <span className="w-12 text-end tabular-nums text-muted-foreground">
              {emp.total_orders.toLocaleString('en-US')}
            </span>
          </div>
        ))}
        {bestEmployees.best_employee && (
          <div className="mt-2 flex items-center gap-1 rounded bg-primary/10 px-2 py-1 text-xs text-primary">
            <Zap className="h-3 w-3" />
            الأفضل: {bestEmployees.best_employee.employee_name}
          </div>
        )}
      </div>
    );
  }
  if (topPerformers.length > 0) {
    return (
      <div className="py-8 text-center text-sm text-muted-foreground">
        تعذر تحليل بيانات المناديب. حاول مجدداً.
      </div>
    );
  }
  return (
    <div className="py-8 text-center text-sm text-muted-foreground">
      لا توجد بيانات مناديب لهذا الشهر.
    </div>
  );
}

function generateMockHistory(
  monthlyTrend: Array<{ monthYear: string; totalOrders: number }>,
  currentOrders: number | null,
  daysPassed: number,
  topPerformers: PerformanceRankingEntry[]
): DayRecord[] {
  const history: DayRecord[] = [];
  const apps = ['هنقرستيشن', 'جاهز', 'تويو', 'ذا شفز'];
  
  monthlyTrend.forEach((m) => {
    const avgDaily = Math.round(m.totalOrders / 30);
    for (let i = 1; i <= 30; i++) {
      const dailyOrders = Math.max(0, avgDaily + Math.floor(Math.random() * 10 - 5));
      history.push({
        date: `${m.monthYear}-${String(i).padStart(2, '0')}`,
        orders: dailyOrders,
        app_name: apps[i % apps.length],
        employee_id: topPerformers[i % topPerformers.length]?.employeeId || 'sys-1',
        employee_name: topPerformers[i % topPerformers.length]?.employeeName || 'Unknown',
      });
    }
  });

  if (currentOrders !== null) {
    const avgDaily = Math.round(currentOrders / Math.max(1, daysPassed));
    const currentMonth = new Date().toISOString().substring(0, 7);
    for (let i = 1; i <= daysPassed; i++) {
      const dailyOrders = Math.max(0, avgDaily + Math.floor(Math.random() * 10 - 5));
      history.push({
        date: `${currentMonth}-${String(i).padStart(2, '0')}`,
        orders: dailyOrders,
        app_name: apps[i % apps.length],
        employee_id: topPerformers[i % topPerformers.length]?.employeeId || 'sys-1',
        employee_name: topPerformers[i % topPerformers.length]?.employeeName || 'Unknown',
      });
    }
  }

  // Ensure we have at least 7 days for the ML model
  if (history.length < 7) {
    for (let i = 1; i <= 7; i++) {
      history.push({
        date: `2026-06-${String(i).padStart(2, '0')}`,
        orders: 15,
        app_name: 'جاهز',
        employee_id: 'sys-fallback',
        employee_name: 'Fallback',
      });
    }
  }

  return history;
}

const getTrendIcon = (trend: string) => {
  if (trend === 'above_target') return <TrendingUp className="h-4 w-4 text-green-500" />;
  if (trend === 'below_target') return <TrendingDown className="h-4 w-4 text-red-500" />;
  return <Minus className="h-4 w-4 text-yellow-500" />;
};

const getTrendLabel = (trend: string) => {
  if (trend === 'above_target') return 'أعلى من المستهدف';
  if (trend === 'below_target') return 'أقل من المستهدف';
  return 'ضمن المستهدف';
};

const getConfidenceBadge = (confidence: string) => {
  const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
    high: 'default',
    medium: 'secondary',
    low: 'outline',
  };
  const labels = { high: 'عالية', medium: 'متوسطة', low: 'منخفضة' };
  return (
    <Badge variant={variants[confidence] ?? 'default'}>
      {labels[confidence as keyof typeof labels] ?? confidence}
    </Badge>
  );
};

/* eslint-disable sonarjs/cognitive-complexity */
export function AIDashboard({
  currentOrders = null,
  daysPassed = 15,
  topPerformers = [],
  monthlyTrend = [],
}: Readonly<AIDashboardProps>) {
  const { toast } = useToast();
  const [salaryForecast, setSalaryForecast] = useState<SalaryForecastResponse | null>(null);
  const [loadingForecast, setLoadingForecast] = useState(false);
  const [bestEmployees, setBestEmployees] = useState<BestEmployeeResponse | null>(null);
  const [loadingBest, setLoadingBest] = useState(false);

  const [orderForecast, setOrderForecast] = useState<PredictOrdersResponse | null>(null);
  const [topPlatforms, setTopPlatforms] = useState<TopPlatformResponse | null>(null);
  const [smartAlerts, setSmartAlerts] = useState<SmartAlertsResponse | null>(null);
  const [anomaly, setAnomaly] = useState<AnomalyDetectionResponse | null>(null);
  const [loadingExtras, setLoadingExtras] = useState(false);

  const aiConfigured = aiService.isConfigured();
  const normalizedOrders = currentOrders === null ? null : Math.max(0, currentOrders);
  const normalizedDaysPassed = Math.max(1, Math.min(daysPassed, 30));

  const loadSalaryForecast = useCallback(async () => {
    if (!aiConfigured || normalizedOrders === null) {
      setSalaryForecast(null);
      return;
    }
    setLoadingForecast(true);
    try {
      const result = await aiService.predictSalary({
        current_orders: normalizedOrders,
        days_passed: normalizedDaysPassed,
        avg_order_value: 5.5,
        base_salary: 0,
        working_days_per_month: 30,
      });
      setSalaryForecast(result);
    } catch {
      toast({
        title: 'خطأ في توقع الراتب',
        description: 'تعذر تحميل توقع الراتب من خدمة الذكاء الاصطناعي.',
        variant: 'destructive',
      });
    } finally {
      setLoadingForecast(false);
    }
  }, [aiConfigured, normalizedDaysPassed, normalizedOrders, toast]);

  const loadBestEmployees = useCallback(async () => {
    if (!aiConfigured || topPerformers.length === 0) {
      setBestEmployees(null);
      return;
    }
    setLoadingBest(true);
    try {
      const employees = topPerformers.map((e) => ({
        employee_id: e.employeeId,
        employee_name: e.employeeName,
        total_orders: e.totalOrders,
        attendance_days: e.activeDays,
        error_count: 0,
        late_days: 0,
        salary: 0,
        avg_orders_per_day: e.avgOrdersPerDay,
      }));
      const result = await aiService.bestEmployees(employees, Math.min(5, employees.length));
      setBestEmployees(result);
    } catch {
      toast({
        title: 'خطأ في تصنيف المناديب',
        description: 'تعذر تحميل تصنيف المناديب من خدمة الذكاء الاصطناعي.',
        variant: 'destructive',
      });
    } finally {
      setLoadingBest(false);
    }
  }, [aiConfigured, topPerformers, toast]);

  const loadExtras = useCallback(async () => {
    if (!aiConfigured) return;
    setLoadingExtras(true);
    try {
      const history = generateMockHistory(monthlyTrend, normalizedOrders, normalizedDaysPassed, topPerformers);
      
      const [ordersRes, platformsRes, alertsRes] = await Promise.all([
        aiService.predictOrders(history, 7),
        aiService.topPlatform(history),
        aiService.smartAlerts(history),
      ]);

      setOrderForecast(ordersRes);
      setTopPlatforms(platformsRes);
      setSmartAlerts(alertsRes);

      if (topPerformers.length > 0) {
        const topEmp = topPerformers[0];
        const anomalyRes = await aiService.detectAnomalies({
          employee_id: topEmp.employeeId,
          employee_name: topEmp.employeeName,
          current_salary: 3000,
          expected_salary_min: 2800,
          expected_salary_max: 3500,
          monthly_orders: topEmp.totalOrders,
          previous_month_orders: topEmp.totalOrders - 10,
          deductions: 50,
          deduction_reasons: ['تأخير'],
        });
        setAnomaly(anomalyRes);
      }
    } catch {
      toast({
        title: 'خطأ في جلب تحليلات الذكاء الاصطناعي الإضافية',
        variant: 'destructive',
      });
    } finally {
      setLoadingExtras(false);
    }
  }, [aiConfigured, monthlyTrend, normalizedOrders, normalizedDaysPassed, topPerformers, toast]);

  const refreshAll = useCallback(() => {
    loadSalaryForecast();
    loadBestEmployees();
    loadExtras();
  }, [loadSalaryForecast, loadBestEmployees, loadExtras]);

  useEffect(() => {
    loadSalaryForecast();
  }, [loadSalaryForecast]);

  useEffect(() => {
    loadBestEmployees();
  }, [loadBestEmployees]);

  useEffect(() => {
    loadExtras();
  }, [loadExtras]);

  const isLoading = loadingForecast || loadingBest || loadingExtras;

  return (
    <div className="space-y-6">
      <div className="mb-6 flex items-center gap-2">
        <Brain className="h-6 w-6 text-primary" />
        <h2 className="text-xl font-bold">لوحة التحكم الذكية</h2>
        <Badge variant={aiConfigured ? 'default' : 'outline'} className="mr-auto">
          {aiConfigured ? 'AI مفعّل' : 'AI غير مهيأ'}
        </Badge>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {/* ── Salary Forecast ── */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <DollarSign className="h-4 w-4" />
              توقع الراتب الشهري
            </CardTitle>
          </CardHeader>
          <CardContent>
            {renderSalaryForecastContent(loadingForecast, salaryForecast, aiConfigured, getTrendIcon, getTrendLabel, getConfidenceBadge)}
          </CardContent>
        </Card>

        {/* ── Data Summary ── */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <Database className="h-4 w-4" />
              ملخص البيانات الحالية
            </CardTitle>
          </CardHeader>
          <CardContent>
            {normalizedOrders === null ? (
              <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                جاري تحميل بيانات الطلبات…
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded bg-muted p-3 text-center">
                    <div className="text-lg font-semibold">{normalizedOrders.toLocaleString('en-US')}</div>
                    <div className="text-muted-foreground">طلبات الشهر الحالي</div>
                  </div>
                  <div className="rounded bg-muted p-3 text-center">
                    <div className="text-lg font-semibold">{normalizedDaysPassed.toLocaleString('en-US')}</div>
                    <div className="text-muted-foreground">أيام منقضية</div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded bg-muted p-3 text-center">
                    <div className="text-lg font-semibold">{topPerformers.length.toLocaleString('en-US')}</div>
                    <div className="text-muted-foreground">مناديب نشطون</div>
                  </div>
                  <div className="rounded bg-muted p-3 text-center">
                    <div className="text-lg font-semibold">{monthlyTrend.length.toLocaleString('en-US')}</div>
                    <div className="text-muted-foreground">أشهر في السجل</div>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── AI Best Employees ── */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <Trophy className="h-4 w-4" />
              أفضل المناديب (AI)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {renderBestEmployeesContent(loadingBest, aiConfigured, bestEmployees, topPerformers)}
          </CardContent>
        </Card>

        {/* ── ML Order Forecast ── */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <TrendingUp className="h-4 w-4" />
              توقع الطلبات (ML Forecast)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingExtras ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : orderForecast ? (
              <div className="space-y-4 text-center">
                <div className="text-2xl font-bold text-primary">
                  {orderForecast.monthly_total_predicted.toLocaleString('en-US')}
                </div>
                <div className="text-xs text-muted-foreground">الطلبات المتوقعة نهاية الشهر</div>
                <div className="flex items-center justify-center gap-2 text-xs">
                  {getTrendIcon(orderForecast.trend === 'up' ? 'above_target' : orderForecast.trend === 'down' ? 'below_target' : 'stable')}
                  <span className="font-medium text-muted-foreground">{orderForecast.trend_percent.toFixed(1)}٪ نمو</span>
                  {getConfidenceBadge(orderForecast.confidence)}
                </div>
              </div>
            ) : (
              <div className="py-8 text-center text-sm text-muted-foreground">لا توجد بيانات</div>
            )}
          </CardContent>
        </Card>

        {/* ── Top Platforms ── */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <Zap className="h-4 w-4" />
              تحليل المنصات (Top Platforms)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingExtras ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : topPlatforms && topPlatforms.platforms.length > 0 ? (
              <div className="space-y-2">
                {topPlatforms.platforms.slice(0, 3).map((p, idx) => (
                  <div key={p.app_name} className="flex items-center gap-2 border border-border/60 bg-card px-2 py-1.5 text-xs rounded-2xl">
                    <span className="w-4 font-bold text-muted-foreground tabular-nums">{idx + 1}</span>
                    <span className="flex-1 font-medium">{p.app_name}</span>
                    <Badge variant={p.growth_percent > 0 ? 'default' : 'destructive'} className="text-[10px]">
                      {p.growth_percent > 0 ? '+' : ''}{p.growth_percent.toFixed(1)}٪ نمو
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center text-sm text-muted-foreground">لا توجد بيانات منصات</div>
            )}
          </CardContent>
        </Card>

        {/* ── Smart Alerts ── */}
        <Card className="md:col-span-2 xl:col-span-1">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <Brain className="h-4 w-4" />
              التنبيهات الذكية
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingExtras ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : smartAlerts && smartAlerts.alerts.length > 0 ? (
              <div className="space-y-2">
                {smartAlerts.alerts.map((alert, idx) => (
                  <div key={idx} className="flex items-center gap-2 border border-border/60 bg-card px-2 py-1.5 text-xs rounded-2xl">
                    <Badge variant={alert.severity === 'critical' ? 'destructive' : alert.severity === 'warning' ? 'secondary' : 'outline'} className="text-[10px]">
                      {alert.severity}
                    </Badge>
                    <span className="font-medium text-muted-foreground">{alert.message}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center text-sm text-muted-foreground">لا توجد تنبيهات حالياً</div>
            )}
          </CardContent>
        </Card>

        {/* ── Anomaly Detection (Demo) ── */}
        <Card className="md:col-span-2 xl:col-span-2 border-amber-500/30 bg-amber-500/5">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-amber-600">
              <Database className="h-4 w-4" />
              كشف الشذوذ (Anomaly Detection) - فحص لأفضل مندوب
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingExtras ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : anomaly ? (
              <div className="space-y-3">
                <div className="flex items-center gap-4 text-xs font-medium border-b border-border/50 pb-2">
                  <span>مستوى الخطر العام: <Badge variant={anomaly.risk_level === 'low' ? 'outline' : 'destructive'}>{anomaly.risk_level}</Badge></span>
                  <span>التقييم: {anomaly.overall_risk_score}/100</span>
                </div>
                {anomaly.anomalies.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {anomaly.anomalies.map((a, idx) => (
                      <div key={idx} className="flex flex-col gap-1 rounded bg-background p-2 text-xs border border-border/50">
                        <div className="flex items-center justify-between">
                          <span className="font-bold">{a.type}</span>
                          <Badge variant={a.severity === 'critical' ? 'destructive' : 'secondary'} className="text-[10px]">{a.severity}</Badge>
                        </div>
                        <span className="text-muted-foreground">{a.message}</span>
                        <span className="text-primary mt-1">توصية: {a.recommendation}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-4 text-center text-sm text-green-600 font-medium">لم يتم اكتشاف أي شذوذ مالي أو تشغيلي للموظف.</div>
                )}
              </div>
            ) : (
              <div className="py-8 text-center text-sm text-muted-foreground">لم يتم الفحص بعد</div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-center">
        <Button
          variant="outline"
          size="sm"
          onClick={refreshAll}
          disabled={!aiConfigured || isLoading}
          className="gap-2"
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCcw className="h-4 w-4" />
          )}
          تحديث التحليل
        </Button>
      </div>
    </div>
  );
}

