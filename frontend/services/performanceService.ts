import { supabase } from '@services/supabase/client';
import { toServiceError } from '@services/serviceError';

export type PerformanceTrendCode = 'up' | 'down' | 'stable';
export type PerformanceAlertType =
  | 'declining'
  | 'inactive_recently'
  | 'below_target'
  | 'low_consistency';

export type PerformanceSeverity = 'high' | 'medium' | 'low';

export interface PerformanceRankingEntry {
  employeeId: string;
  employeeName: string;
  city: string | null;
  totalOrders: number;
  activeDays: number;
  avgOrdersPerDay: number;
  consistencyRatio: number;
  growthPct: number;
  targetAchievementPct: number;
  rank: number;
  trendCode: PerformanceTrendCode;
}

export interface PerformanceAlert {
  employeeId?: string;
  employeeName?: string;
  alertType: PerformanceAlertType;
  severity: PerformanceSeverity;
  totalOrders?: number;
  activeDays?: number;
  growthPct?: number;
  lastActiveDate?: string | null;
  targetAchievementPct?: number;
  consistencyRatio?: number;
}

export interface PerformanceDashboardResponse {
  monthYear: string;
  effectiveEndDate: string;
  leaderboardDate: string;
  summary: {
    totalOrders: number;
    activeRiders: number;
    activeEmployees: number;
    avgOrdersPerRider: number;
    topPerformerToday: { employeeId: string; employeeName: string; totalOrders: number } | null;
    lowPerformerToday: { employeeId: string; employeeName: string; totalOrders: number } | null;
    topPerformerMonth: { employeeId: string; employeeName: string; totalOrders: number; rank: number } | null;
    lowPerformerMonth: { employeeId: string; employeeName: string; totalOrders: number } | null;
  };
  comparison: {
    month: {
      currentOrders: number;
      previousOrders: number;
      growthPct: number;
      currentActiveDays: number;
      previousActiveDays: number;
      activeDaysDelta: number;
    };
    week: {
      currentOrders: number;
      previousOrders: number;
      growthPct: number;
    };
  };
  targets: {
    totalTargetOrders: number;
    targetAchievementPct: number;
  };
  distribution: {
    excellent: number;
    good: number;
    average: number;
    weak: number;
  };
  ordersByApp: Array<{
    appId: string;
    appName: string;
    brandColor: string;
    textColor: string;
    orders: number;
    riders: number;
    targetOrders: number;
    targetAchievementPct: number;
    previousOrders: number;
    growthPct: number;
  }>;
  ordersByCity: Array<{
    city: string;
    orders: number;
  }>;
  dailyTrend: Array<{
    date: string;
    orders: number;
  }>;
  monthlyTrend: Array<{
    monthYear: string;
    totalOrders: number;
    activeRiders: number;
    avgOrdersPerRider: number;
  }>;
  rankings: {
    topPerformers: PerformanceRankingEntry[];
    lowPerformers: PerformanceRankingEntry[];
    mostImproved: PerformanceRankingEntry[];
    mostDeclined: PerformanceRankingEntry[];
  };
  alerts: PerformanceAlert[];
}

export interface RiderProfilePerformanceResponse {
  monthYear: string;
  effectiveEndDate: string;
  employee: {
    employeeId: string;
    employeeName: string;
    phone?: string | null;
    city?: string | null;
    joinDate?: string | null;
  } | null;
  summary: {
    totalOrders: number;
    avgOrdersPerDay: number;
    activeDays: number;
    consistencyRatio: number;
    monthlyTargetOrders: number;
    dailyTargetOrders: number;
    targetAchievementPct: number;
    rank: number;
    rankOutOf: number;
    lastActiveDate?: string | null;
  };
  comparison: {
    month: {
      currentOrders: number;
      previousOrders: number;
      growthPct: number;
      currentAvgOrdersPerDay: number;
      previousAvgOrdersPerDay: number;
      avgGrowthPct: number;
      currentActiveDays: number;
      previousActiveDays: number;
      activeDaysDelta: number;
    };
    week: {
      currentOrders: number;
      previousOrders: number;
      growthPct: number;
    };
  };
  platforms: Array<{
    appId: string;
    appName: string;
    brandColor: string;
    status: string;
  }>;
  platformBreakdown: Array<{
    appId: string;
    appName: string;
    brandColor: string;
    orders: number;
  }>;
  recentDailyOrders: Array<{
    date: string;
    orders: number;
  }>;
  lastThreeMonths: Array<{
    monthYear: string;
    totalOrders: number;
    avgOrdersPerDay: number;
    activeDays: number;
    consistencyRatio: number;
    targetAchievementPct: number;
  }>;
  trend: {
    trendCode: PerformanceTrendCode;
    judgmentCode:
      | 'inactive'
      | 'excellent_stable'
      | 'declining'
      | 'below_target'
      | 'stable'
      | 'average';
  };
  alerts: Array<{
    alertType: PerformanceAlertType;
    severity: PerformanceSeverity;
  }>;
  salary:
    | {
        baseSalary: number;
        allowances: number;
        attendanceDeduction: number;
        advanceDeduction: number;
        externalDeduction: number;
        manualDeduction: number;
        netSalary: number;
        isApproved: boolean;
        paymentMethod?: string | null;
      }
    | null;
}

export interface OrderImportBatch {
  id: string;
  month_year: string;
  source_type: 'manual' | 'excel' | 'api';
  file_name: string | null;
  status: 'pending' | 'completed' | 'failed';
  total_rows: number;
  imported_rows: number;
  skipped_rows: number;
  error_count: number;
  error_summary: Array<{ row?: number; reason: string; details?: string }> | null;
  started_at: string;
  completed_at: string | null;
}

// ─── RPC Response Mapper ─────────────────────────────────────────────────────
// The RPC returns snake_case / differently-named keys. This mapper converts the
// raw JSON to the typed `PerformanceDashboardResponse` shape so the frontend
// never touches raw DB keys.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapRpcToDashboardResponse(raw: any): PerformanceDashboardResponse {
  if (!raw || typeof raw !== 'object') {
    return buildEmptyDashboardResponse();
  }

  // ── riderLeaderboard → rankings ──────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const leaderboard: any[] = Array.isArray(raw.riderLeaderboard) ? raw.riderLeaderboard : [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapEntry = (entry: any, rank: number): PerformanceRankingEntry => ({
    employeeId: entry.employeeId ?? entry.employee_id ?? '',
    employeeName: entry.employeeName ?? entry.employee_name ?? '',
    city: entry.city ?? null,
    totalOrders: Number(entry.totalOrders ?? entry.total_orders ?? 0),
    activeDays: Number(entry.activeDays ?? entry.active_days ?? 0),
    avgOrdersPerDay: Number(entry.avgOrdersPerDay ?? entry.avg_orders_per_day ?? 0),
    consistencyRatio: Number(entry.consistencyRatio ?? entry.consistency_ratio ?? 0),
    growthPct: Number(entry.growthPct ?? entry.growth_pct ?? 0),
    targetAchievementPct: Number(entry.targetAchievementPct ?? entry.target_achievement_pct ?? 0),
    rank: Number(entry.rankPosition ?? entry.rank_position ?? entry.rank ?? rank + 1),
    trendCode: (entry.trendCode ?? entry.trend_code ?? 'stable') as PerformanceTrendCode,
  });

  const sorted = [...leaderboard].sort(
    (a, b) => Number(b.totalOrders ?? b.total_orders ?? 0) - Number(a.totalOrders ?? a.total_orders ?? 0),
  );
  const topPerformers = sorted.slice(0, 20).map((entry, index) => mapEntry(entry, index));
  const lowPerformers = [...sorted].reverse().slice(0, 20).map((entry, index) => mapEntry(entry, index));
  const mostImproved = [...leaderboard]
    .sort((a, b) => Number(b.growthPct ?? b.growth_pct ?? 0) - Number(a.growthPct ?? a.growth_pct ?? 0))
    .slice(0, 10)
    .map((entry, index) => mapEntry(entry, index));
  const mostDeclined = [...leaderboard]
    .sort((a, b) => Number(a.growthPct ?? a.growth_pct ?? 0) - Number(b.growthPct ?? b.growth_pct ?? 0))
    .slice(0, 10)
    .map((entry, index) => mapEntry(entry, index));

  // ── monthComparison / weekComparison → comparison ────────────────────────
  const mc = raw.monthComparison ?? raw.month_comparison ?? {};
  const wc = raw.weekComparison ?? raw.week_comparison ?? {};
  const currentOrders = Number(mc.current_orders ?? mc.currentOrders ?? 0);
  const previousOrders = Number(mc.previous_orders ?? mc.previousOrders ?? 0);
  const currentActiveDays = Number(mc.current_active_days ?? mc.currentActiveDays ?? 0);
  const previousActiveDays = Number(mc.previous_active_days ?? mc.previousActiveDays ?? 0);
  const weekCurrent = Number(wc.current_orders ?? wc.currentOrders ?? 0);
  const weekPrevious = Number(wc.previous_orders ?? wc.previousOrders ?? 0);

  // ── summary ──────────────────────────────────────────────────────────────
  const s = raw.summary ?? {};
  const topRiderToday = raw.topRiderToday ?? raw.top_rider_today ?? null;
  const lowestRiderToday = raw.lowestRiderToday ?? raw.lowest_rider_today ?? null;
  const topRiderMonth = topPerformers[0] ?? null;
  const lowRiderMonth = topPerformers.at(-1) ?? null;

  // ── distribution ─────────────────────────────────────────────────────────
  const dist = raw.performanceDistribution ?? raw.performance_distribution ?? {};

  // ── appComparison → ordersByApp ──────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ordersByApp = (Array.isArray(raw.appComparison) ? raw.appComparison : []).map((ac: any) => ({
    appId: ac.appId ?? ac.app_id ?? '',
    appName: ac.appName ?? ac.app_name ?? '',
    brandColor: ac.brandColor ?? ac.brand_color ?? '#2563eb',
    textColor: ac.textColor ?? ac.text_color ?? '#ffffff',
    orders: Number(ac.totalOrders ?? ac.total_orders ?? 0),
    riders: Number(ac.riderCount ?? ac.rider_count ?? 0),
    targetOrders: Number(ac.targetOrders ?? ac.target_orders ?? 0),
    targetAchievementPct: Number(ac.targetAchievementPct ?? ac.target_achievement_pct ?? 0),
    previousOrders: Number(ac.previousOrders ?? ac.previous_orders ?? 0),
    growthPct: Number(ac.growthPct ?? ac.growth_pct ?? 0),
  }));

  // ── alerts ───────────────────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const alerts: PerformanceAlert[] = (Array.isArray(raw.alerts) ? raw.alerts : []).map((a: any) => ({
    employeeId: a.employeeId ?? a.employee_id,
    employeeName: a.employeeName ?? a.employee_name,
    alertType: normaliseAlertType(a.alertType ?? a.alert_type),
    severity: normaliseSeverity(a.severity),
    totalOrders: a.totalOrders ?? a.total_orders,
    activeDays: a.activeDays ?? a.active_days,
    growthPct: a.growthPct ?? a.growth_pct,
    lastActiveDate: a.lastActiveDate ?? a.last_active_date ?? null,
    targetAchievementPct: a.targetAchievementPct ?? a.target_achievement_pct,
    consistencyRatio: a.consistencyRatio ?? a.consistency_ratio,
  }));

  // ── targets ──────────────────────────────────────────────────────────────
  const targets = raw.targets ?? {};

  return {
    monthYear: raw.summary?.monthYear ?? raw.monthYear ?? '',
    effectiveEndDate: raw.summary?.effectiveEndDate ?? raw.effectiveEndDate ?? '',
    leaderboardDate: raw.leaderboardDate ?? raw.summary?.today ?? '',
    summary: {
      totalOrders: Number(s.totalOrders ?? s.total_orders ?? 0),
      activeRiders: Number(s.activeRiders ?? s.active_riders ?? 0),
      activeEmployees: Number(s.totalRiders ?? s.total_riders ?? s.activeRiders ?? 0),
      avgOrdersPerRider: Number(s.avgOrdersPerRider ?? s.avg_orders_per_rider ?? 0),
      topPerformerToday: topRiderToday
        ? {
            employeeId: topRiderToday.employeeId ?? topRiderToday.employee_id ?? '',
            employeeName: topRiderToday.employeeName ?? topRiderToday.employee_name ?? '',
            totalOrders: Number(topRiderToday.totalOrders ?? topRiderToday.total_orders ?? 0),
          }
        : null,
      lowPerformerToday: lowestRiderToday
        ? {
            employeeId: lowestRiderToday.employeeId ?? lowestRiderToday.employee_id ?? '',
            employeeName: lowestRiderToday.employeeName ?? lowestRiderToday.employee_name ?? '',
            totalOrders: Number(lowestRiderToday.totalOrders ?? lowestRiderToday.total_orders ?? 0),
          }
        : null,
      topPerformerMonth: topRiderMonth
        ? {
            employeeId: topRiderMonth.employeeId,
            employeeName: topRiderMonth.employeeName,
            totalOrders: topRiderMonth.totalOrders,
            rank: topRiderMonth.rank,
          }
        : null,
      lowPerformerMonth: lowRiderMonth
        ? {
            employeeId: lowRiderMonth.employeeId,
            employeeName: lowRiderMonth.employeeName,
            totalOrders: lowRiderMonth.totalOrders,
          }
        : null,
    },
    comparison: {
      month: {
        currentOrders,
        previousOrders,
        growthPct:
          previousOrders > 0
            ? Math.round(((currentOrders - previousOrders) / previousOrders) * 1000) / 10
            : 0,
        currentActiveDays,
        previousActiveDays,
        activeDaysDelta: currentActiveDays - previousActiveDays,
      },
      week: {
        currentOrders: weekCurrent,
        previousOrders: weekPrevious,
        growthPct:
          weekPrevious > 0
            ? Math.round(((weekCurrent - weekPrevious) / weekPrevious) * 1000) / 10
            : 0,
      },
    },
    targets: {
      totalTargetOrders: Number(targets.totalTargetOrders ?? 0),
      targetAchievementPct: Number(targets.targetAchievementPct ?? 0),
    },
    distribution: {
      excellent: Number(dist.excellent ?? 0),
      good: Number(dist.good ?? 0),
      average: Number(dist.average ?? 0),
      weak: Number(dist.weak ?? 0),
    },
    ordersByApp,
    ordersByCity: Array.isArray(raw.ordersByCity) ? raw.ordersByCity : [],
    dailyTrend: Array.isArray(raw.dailyTrend) ? raw.dailyTrend : [],
    monthlyTrend: Array.isArray(raw.monthlyTrend)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ? raw.monthlyTrend.map((m: any) => ({
          monthYear: m.monthYear ?? m.month_year ?? '',
          totalOrders: Number(m.totalOrders ?? m.total_orders ?? 0),
          activeRiders: Number(m.activeRiders ?? m.active_riders ?? 0),
          avgOrdersPerRider: Number(m.avgOrdersPerRider ?? m.avg_orders_per_rider ?? 0),
        }))
      : [],
    rankings: {
      topPerformers,
      lowPerformers,
      mostImproved,
      mostDeclined,
    },
    alerts,
  };
}

function buildEmptyDashboardResponse(): PerformanceDashboardResponse {
  return {
    monthYear: '',
    effectiveEndDate: '',
    leaderboardDate: '',
    summary: {
      totalOrders: 0,
      activeRiders: 0,
      activeEmployees: 0,
      avgOrdersPerRider: 0,
      topPerformerToday: null,
      lowPerformerToday: null,
      topPerformerMonth: null,
      lowPerformerMonth: null,
    },
    comparison: {
      month: { currentOrders: 0, previousOrders: 0, growthPct: 0, currentActiveDays: 0, previousActiveDays: 0, activeDaysDelta: 0 },
      week: { currentOrders: 0, previousOrders: 0, growthPct: 0 },
    },
    targets: { totalTargetOrders: 0, targetAchievementPct: 0 },
    distribution: { excellent: 0, good: 0, average: 0, weak: 0 },
    ordersByApp: [],
    ordersByCity: [],
    dailyTrend: [],
    monthlyTrend: [],
    rankings: { topPerformers: [], lowPerformers: [], mostImproved: [], mostDeclined: [] },
    alerts: [],
  };
}

function normaliseAlertType(raw: string | undefined): PerformanceAlertType {
  if (raw === 'declining' || raw === 'inactive_recently' || raw === 'below_target' || raw === 'low_consistency') {
    return raw;
  }
  return 'below_target';
}

function normaliseSeverity(raw: string | undefined): PerformanceSeverity {
  if (raw === 'critical') return 'high';
  if (raw === 'warning') return 'medium';
  if (raw === 'high' || raw === 'medium' || raw === 'low') return raw;
  return 'low';
}

type GenericTableClient = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from: (table: string) => any;
};

const sb = supabase as unknown as GenericTableClient & typeof supabase;

// ─── Service ─────────────────────────────────────────────────────────────────

export const performanceService = {

  getDashboard: async (monthYear: string): Promise<PerformanceDashboardResponse> => {
    const { data, error } = await supabase.rpc('performance_dashboard_rpc', {
      p_month_year: monthYear,
    });

    if (error) {
      throw toServiceError(error, 'performanceService.getDashboard');
    }

    return mapRpcToDashboardResponse(data);
  },

  getRiderProfile: async (
    employeeId: string,
    monthYear: string,
  ): Promise<RiderProfilePerformanceResponse> => {
    const { data, error } = await supabase.rpc('rider_profile_performance_rpc', {
      p_employee_id: employeeId,
      p_month_year: monthYear,
    });

    if (error) {
      throw toServiceError(error, 'performanceService.getRiderProfile');
    }

    return (data ?? {}) as unknown as RiderProfilePerformanceResponse;
  },

  upsertEmployeeTarget: async (params: {
    employeeId: string;
    monthYear: string;
    monthlyTargetOrders: number;
    dailyTargetOrders: number;
  }) => {
    const { data, error } = await sb
      .from('employee_targets')
      .upsert(
        {
          employee_id: params.employeeId,
          month_year: params.monthYear,
          monthly_target_orders: params.monthlyTargetOrders,
          daily_target_orders: params.dailyTargetOrders,
        },
        { onConflict: 'employee_id,month_year' },
      )
      .select()
      .single();

    if (error) {
      throw toServiceError(error, 'performanceService.upsertEmployeeTarget');
    }

    return data;
  },

  getImportHistory: async (monthYear: string): Promise<OrderImportBatch[]> => {
    const { data, error } = await sb
      .from('order_import_batches')
      .select(
        'id, month_year, source_type, file_name, status, total_rows, imported_rows, skipped_rows, error_count, error_summary, started_at, completed_at',
      )
      .eq('month_year', monthYear)
      .order('started_at', { ascending: false })
      .limit(8);

    if (error) {
      const message = error.message ?? '';
      if (message.includes('order_import_batches')) {
        return [];
      }
      throw toServiceError(error, 'performanceService.getImportHistory');
    }

    return (data ?? []) as OrderImportBatch[];
  },

  deleteImportBatch: async (batchId: string) => {
    const { error } = await sb
      .from('order_import_batches')
      .delete()
      .eq('id', batchId);

    if (error) {
      throw toServiceError(error, 'performanceService.deleteImportBatch');
    }
  },

  captureSalaryMonthSnapshot: async (monthYear: string) => {
    const { data, error } = await supabase.rpc('capture_salary_month_snapshot', {
      p_month_year: monthYear,
    });

    if (error) {
      throw toServiceError(error, 'performanceService.captureSalaryMonthSnapshot');
    }

    return data;
  },
};
