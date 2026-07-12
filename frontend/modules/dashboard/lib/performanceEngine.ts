/**
 * Performance Engine — Pure computation layer for rider performance metrics.
 *
 * All functions are side-effect free and operate on data already fetched
 * by performanceService or dashboardService.
 *
 * Data Strategy Layers:
 *   Raw       → daily_orders, attendance (DB)
 *   Calculated → total_orders, avg_orders_per_day (DB views)
 *   Derived   → growth_rate, consistency, performance_score (this file)
 *   AI        → insights, recommendations (aiInsightsEngine.ts)
 */

import type {
  PerformanceDashboardResponse,
  PerformanceRankingEntry,
  RiderProfilePerformanceResponse,
} from '@services/performanceService';

// ─── Types ───────────────────────────────────────────────────────────────────

export type TrendDirection = '↑' | '↓' | '→';
export type PerformanceTier = 'excellent' | 'good' | 'average' | 'weak';

export interface GrowthResult {
  rate: number;
  direction: TrendDirection;
  label: string;
}

export interface ComparisonResult {
  currentValue: number;
  previousValue: number;
  delta: number;
  deltaPct: number;
  direction: TrendDirection;
  formattedDelta: string;
}

export interface EnrichedValue {
  value: number;
  formatted: string;
  delta: string | null;
  enrichedText: string;
}

export interface RiderPerformanceProfile {
  employeeId: string;
  employeeName: string;
  city: string | null;
  totalOrders: number;
  activeDays: number;
  avgOrdersPerDay: number;
  consistencyRatio: number;
  growthPct: number;
  growthDirection: TrendDirection;
  targetAchievementPct: number;
  performanceScore: number;
  tier: PerformanceTier;
  rank: number;
  trendCode: 'up' | 'down' | 'stable';
}

export interface FleetPerformanceSummary {
  totalOrders: number;
  totalOrdersDelta: ComparisonResult;
  activeRiders: number;
  avgOrdersPerRider: number;
  avgOrdersPerActiveDay: number;
  projectedOrders: number | null;
  targetHitProjected: boolean | null;
  dailyRunRate: number;
  dailyRunRateDelta: ComparisonResult;
  avgOrdersDelta: ComparisonResult;
  avgPerformanceScore: number;
  topPerformer: RiderPerformanceProfile | null;
  weakestPerformer: RiderPerformanceProfile | null;
  mostImproved: RiderPerformanceProfile | null;
  mostDeclined: RiderPerformanceProfile | null;
  distribution: { excellent: number; good: number; average: number; weak: number };
}

// ─── Weights for Performance Score ───────────────────────────────────────────

const SCORE_WEIGHTS = {
  orders: 0.35,
  consistency: 0.25,
  growth: 0.15,
  attendance: 0.15,
  target: 0.1,
} as const;

// ─── Core Computations ──────────────────────────────────────────────────────

/**
 * Compute growth rate between two values.
 * Returns growth percentage, direction arrow, and Arabic label.
 */
export function computeGrowthRate(current: number, previous: number): GrowthResult {
  if (previous <= 0 && current <= 0) {
    return { rate: 0, direction: '→', label: 'لا يوجد بيانات سابقة' };
  }
  if (previous <= 0) {
    return { rate: 100, direction: '↑', label: 'جديد هذا الشهر' };
  }

  const rate = ((current - previous) / previous) * 100;
  const rounded = Math.round(rate * 10) / 10;

  if (rounded > 2) {
    return { rate: rounded, direction: '↑', label: `تحسّن ${rounded}%` };
  }
  if (rounded < -2) {
    return { rate: rounded, direction: '↓', label: `انخفاض ${Math.abs(rounded)}%` };
  }
  return { rate: rounded, direction: '→', label: 'مستقر' };
}

/**
 * Compute a unified Performance Score (0-100) for a rider.
 *
 * Formula:
 *   score = orders_score * 0.35
 *         + consistency   * 0.25
 *         + growth_bonus  * 0.15
 *         + attendance    * 0.15
 *         + target_bonus  * 0.10
 */
export function computePerformanceScore(entry: {
  totalOrders: number;
  avgOrdersPerDay: number;
  activeDays: number;
  consistencyRatio: number;
  growthPct: number;
  targetAchievementPct: number;
  medianOrders?: number;
  workingDaysInMonth?: number;
}): number {
  const {
    totalOrders,
    activeDays,
    consistencyRatio,
    growthPct,
    targetAchievementPct,
    medianOrders = 300,
    workingDaysInMonth = 30,
  } = entry;

  // Orders score: normalize against median (cap at 100)
  const ordersScore = Math.min(100, (totalOrders / Math.max(medianOrders, 1)) * 100);

  // Consistency: ratio is already 0-1, convert to 0-100
  const consistencyScore = Math.min(100, consistencyRatio * 100);

  // Growth bonus: growth% mapped to 0-100 (−50% → 0, 0% → 50, +50% → 100)
  const growthScore = Math.max(0, Math.min(100, growthPct + 50));

  // Attendance: active days / working days * 100
  const attendanceScore = Math.min(100, (activeDays / Math.max(workingDaysInMonth, 1)) * 100);

  // Target achievement: cap at 100
  const targetScore = Math.min(100, targetAchievementPct);

  const raw =
    ordersScore * SCORE_WEIGHTS.orders +
    consistencyScore * SCORE_WEIGHTS.consistency +
    growthScore * SCORE_WEIGHTS.growth +
    attendanceScore * SCORE_WEIGHTS.attendance +
    targetScore * SCORE_WEIGHTS.target;

  return Math.round(Math.max(0, Math.min(100, raw)));
}

/**
 * Classify a performance score into a named tier.
 */
export function classifyPerformance(score: number): PerformanceTier {
  if (score >= 85) return 'excellent';
  if (score >= 70) return 'good';
  if (score >= 50) return 'average';
  return 'weak';
}

/**
 * Arabic label for a performance tier.
 */
export function tierLabel(tier: PerformanceTier): string {
  switch (tier) {
    case 'excellent': return 'ممتاز';
    case 'good': return 'جيد';
    case 'average': return 'متوسط';
    case 'weak': return 'ضعيف';
  }
}

/**
 * Tailwind color class for a performance tier.
 */
export function tierColorClass(tier: PerformanceTier): string {
  switch (tier) {
    case 'excellent': return 'text-emerald-600';
    case 'good': return 'text-blue-600';
    case 'average': return 'text-amber-600';
    case 'weak': return 'text-rose-600';
  }
}

/**
 * Background color class for a performance tier.
 */
export function tierBgClass(tier: PerformanceTier): string {
  switch (tier) {
    case 'excellent': return 'bg-emerald-50';
    case 'good': return 'bg-blue-50';
    case 'average': return 'bg-amber-50';
    case 'weak': return 'bg-rose-50';
  }
}

// ─── Comparison ─────────────────────────────────────────────────────────────

/**
 * Compare two values and produce a rich comparison result.
 */
export function compareValues(current: number, previous: number): ComparisonResult {
  const delta = current - previous;
  const growth = computeGrowthRate(current, previous);

  const sign = delta > 0 ? '+' : '';
  const formattedDelta = previous > 0
    ? `${growth.direction} ${sign}${growth.rate}%`
    : growth.label;

  return {
    currentValue: current,
    previousValue: previous,
    delta,
    deltaPct: growth.rate,
    direction: growth.direction,
    formattedDelta,
  };
}

// ─── Enrichment ─────────────────────────────────────────────────────────────

/**
 * Enrich a value with comparison delta for display.
 * "300" → "300 (↑ +15%)"
 */
export function enrichWithDelta(
  value: number,
  previous: number | null | undefined,
  unit = '',
): EnrichedValue {
  const formatted = value.toLocaleString('en-US') + (unit ? ` ${unit}` : '');

  if (previous === null || previous === 0) {
    return { value, formatted, delta: null, enrichedText: formatted };
  }

  const comparison = compareValues(value, previous);
  const delta = comparison.formattedDelta;
  const enrichedText = `${formatted} (${delta})`;

  return { value, formatted, delta, enrichedText };
}

/**
 * Format a percentage with direction arrow.
 */
export function formatGrowthPct(pct: number): string {
  const growth = computeGrowthRate(100 + pct, 100);
  const sign = pct > 0 ? '+' : '';
  return `${growth.direction} ${sign}${pct.toFixed(1)}%`;
}

// ─── Ranking & Profiles ─────────────────────────────────────────────────────

/**
 * Transform ranking entries into full performance profiles with scores.
 */
export function buildRiderProfiles(
  entries: PerformanceRankingEntry[],
  medianOrders?: number,
): RiderPerformanceProfile[] {
  const median = medianOrders ?? computeMedian(entries.map((e) => e.totalOrders));

  return entries.map((entry) => {
    const score = computePerformanceScore({
      totalOrders: entry.totalOrders,
      avgOrdersPerDay: entry.avgOrdersPerDay,
      activeDays: entry.activeDays,
      consistencyRatio: entry.consistencyRatio,
      growthPct: entry.growthPct,
      targetAchievementPct: entry.targetAchievementPct,
      medianOrders: median,
    });

    const growth = computeGrowthRate(100 + entry.growthPct, 100);

    return {
      employeeId: entry.employeeId,
      employeeName: entry.employeeName,
      city: entry.city,
      totalOrders: entry.totalOrders,
      activeDays: entry.activeDays,
      avgOrdersPerDay: entry.avgOrdersPerDay,
      consistencyRatio: entry.consistencyRatio,
      growthPct: entry.growthPct,
      growthDirection: growth.direction,
      targetAchievementPct: entry.targetAchievementPct,
      performanceScore: score,
      tier: classifyPerformance(score),
      rank: entry.rank,
      trendCode: entry.trendCode,
    };
  });
}

function calculateTargetProjections(dashboard: PerformanceDashboardResponse): { projectedOrders: number | null; targetHitProjected: boolean | null; dailyRunRate: number; previousDailyRunRate: number } {
  let projectedOrders: number | null = null;
  let targetHitProjected: boolean | null = null;
  let dailyRunRate = 0;
  let previousDailyRunRate = 0;
  if (!dashboard.monthYear) {
    return { projectedOrders, targetHitProjected, dailyRunRate, previousDailyRunRate };
  }

  const parts = dashboard.monthYear.split('-');
  if (parts.length !== 2) {
    return { projectedOrders, targetHitProjected };
  }

  const year = Number.parseInt(parts[0], 10);
  const month = Number.parseInt(parts[1], 10);
  const now = new Date();
  const isCurrentMonth = now.getFullYear() === year && now.getMonth() + 1 === month;
  
  const totalDays = new Date(year, month, 0).getDate();
  let elapsedDays = totalDays;
  if (isCurrentMonth) {
    elapsedDays = Math.max(1, now.getDate());
  }
  
  dailyRunRate = elapsedDays > 0 ? dashboard.summary.totalOrders / elapsedDays : 0;
  projectedOrders = Math.round(dailyRunRate * totalDays);
  
  if (dashboard.targets.totalTargetOrders > 0) {
    targetHitProjected = projectedOrders >= dashboard.targets.totalTargetOrders;
  }
  
  const previousYear = month === 1 ? year - 1 : year;
  const previousMonth = month === 1 ? 12 : month - 1;
  const totalDaysPrev = new Date(previousYear, previousMonth, 0).getDate();
  previousDailyRunRate = totalDaysPrev > 0 ? dashboard.comparison.month.previousOrders / totalDaysPrev : 0;

  return { projectedOrders, targetHitProjected, dailyRunRate, previousDailyRunRate };
}

/**
 * Build a comprehensive fleet summary from dashboard data.
 */
export function buildFleetSummary(
  dashboard: PerformanceDashboardResponse,
): FleetPerformanceSummary {
  const { summary, comparison, distribution, rankings } = dashboard;

  // Build profiles for all performers
  const allEntries = [
    ...rankings.topPerformers,
    ...rankings.lowPerformers,
  ];
  // Deduplicate by employeeId
  const seen = new Set<string>();
  const uniqueEntries = allEntries.filter((e) => {
    if (seen.has(e.employeeId)) return false;
    seen.add(e.employeeId);
    return true;
  });

  const profiles = buildRiderProfiles(uniqueEntries);
  const avgScore =
    profiles.length > 0
      ? Math.round(profiles.reduce((s, p) => s + p.performanceScore, 0) / profiles.length)
      : 0;

  // Find notable performers
  const topProfile = profiles.length > 0
    ? profiles.reduce((a, b) => (a.performanceScore >= b.performanceScore ? a : b), profiles[0])
    : null;
  const weakProfile = profiles.length > 0
    ? profiles.reduce((a, b) => (a.performanceScore <= b.performanceScore ? a : b), profiles[0])
    : null;

  const improvedProfiles = buildRiderProfiles(rankings.mostImproved);
  const declinedProfiles = buildRiderProfiles(rankings.mostDeclined);

  const currentActiveDays = comparison.month.currentActiveDays || 0;
  const avgOrdersPerActiveDay = currentActiveDays > 0 ? summary.totalOrders / currentActiveDays : 0;

  const { projectedOrders, targetHitProjected, dailyRunRate, previousDailyRunRate } = calculateTargetProjections(dashboard);

  const previousActiveDays = comparison.month.previousActiveDays || 0;
  const previousAvgOrdersPerActiveDay = previousActiveDays > 0 ? comparison.month.previousOrders / previousActiveDays : 0;

  return {
    totalOrders: summary.totalOrders,
    totalOrdersDelta: compareValues(
      comparison.month.currentOrders,
      comparison.month.previousOrders,
    ),
    activeRiders: summary.activeRiders,
    avgOrdersPerRider: summary.avgOrdersPerRider,
    avgOrdersPerActiveDay,
    projectedOrders,
    targetHitProjected,
    dailyRunRate,
    dailyRunRateDelta: compareValues(dailyRunRate, previousDailyRunRate),
    avgOrdersDelta: compareValues(
      avgOrdersPerActiveDay,
      previousAvgOrdersPerActiveDay
    ),
    avgPerformanceScore: avgScore,
    topPerformer: topProfile,
    weakestPerformer: weakProfile,
    mostImproved: improvedProfiles[0] ?? null,
    mostDeclined: declinedProfiles[0] ?? null,
    distribution,
  };
}

/**
 * Build a rider performance profile from the rider detail API response.
 */
export function buildRiderDetailProfile(
  response: RiderProfilePerformanceResponse,
): RiderPerformanceProfile | null {
  if (!response.employee) return null;

  const { summary: s, comparison: c, trend } = response;

  const score = computePerformanceScore({
    totalOrders: s.totalOrders,
    avgOrdersPerDay: s.avgOrdersPerDay,
    activeDays: s.activeDays,
    consistencyRatio: s.consistencyRatio,
    growthPct: c.month.growthPct,
    targetAchievementPct: s.targetAchievementPct,
  });

  const growth = computeGrowthRate(
    c.month.currentOrders,
    c.month.previousOrders,
  );

  return {
    employeeId: response.employee.employeeId,
    employeeName: response.employee.employeeName,
    city: response.employee.city ?? null,
    totalOrders: s.totalOrders,
    activeDays: s.activeDays,
    avgOrdersPerDay: s.avgOrdersPerDay,
    consistencyRatio: s.consistencyRatio,
    growthPct: c.month.growthPct,
    growthDirection: growth.direction,
    targetAchievementPct: s.targetAchievementPct,
    performanceScore: score,
    tier: classifyPerformance(score),
    rank: s.rank,
    trendCode: trend.trendCode,
  };
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function computeMedian(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? Math.round((sorted[mid - 1] + sorted[mid]) / 2)
    : sorted[mid];
}
