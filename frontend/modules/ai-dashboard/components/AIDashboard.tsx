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
import { aiService, type BestEmployeeResponse, type SalaryForecastResponse } from '@services/aiService';
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
            {salaryForecast.predicted_monthly_salary.toLocaleString('ar-SA')} ر.س
          </div>
          <div className="text-xs text-muted-foreground">الراتب المتوقع لهذا الشهر</div>
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="rounded bg-muted p-2 text-center">
            <div className="font-medium">{salaryForecast.projected_monthly_orders.toLocaleString('ar-SA')}</div>
            <div className="text-muted-foreground">طلب متوقع</div>
          </div>
          <div className="rounded bg-muted p-2 text-center">
            <div className="font-medium">{salaryForecast.current_daily_avg.toLocaleString('ar-SA')}</div>
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
          متبقي {salaryForecast.days_remaining.toLocaleString('ar-SA')} يوم في الشهر
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
            <span className="w-12 text-left tabular-nums text-muted-foreground">
              {emp.total_orders.toLocaleString('ar-SA')}
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

  const refreshAll = useCallback(() => {
    loadSalaryForecast();
    loadBestEmployees();
  }, [loadSalaryForecast, loadBestEmployees]);

  useEffect(() => {
    loadSalaryForecast();
  }, [loadSalaryForecast]);

  useEffect(() => {
    loadBestEmployees();
  }, [loadBestEmployees]);

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

  const isLoading = loadingForecast || loadingBest;

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
                    <div className="text-lg font-semibold">{normalizedOrders.toLocaleString('ar-SA')}</div>
                    <div className="text-muted-foreground">طلبات الشهر الحالي</div>
                  </div>
                  <div className="rounded bg-muted p-3 text-center">
                    <div className="text-lg font-semibold">{normalizedDaysPassed.toLocaleString('ar-SA')}</div>
                    <div className="text-muted-foreground">أيام منقضية</div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded bg-muted p-3 text-center">
                    <div className="text-lg font-semibold">{topPerformers.length.toLocaleString('ar-SA')}</div>
                    <div className="text-muted-foreground">مناديب نشطون</div>
                  </div>
                  <div className="rounded bg-muted p-3 text-center">
                    <div className="text-lg font-semibold">{monthlyTrend.length.toLocaleString('ar-SA')}</div>
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

