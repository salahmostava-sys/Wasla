/**
 * محرك التحليلات الذكية — ينتج رؤى وتوصيات وتحليلات أداء المناديب
 * من بيانات الأداء الفعلية.
 *
 * طبقة البيانات: خام → محسوب → مشتق → تحليلات (هذا الملف)
 *
 * جميع الدوال صافية (pure) وبلا حالة (stateless).
 */

import {
  type RiderPerformanceProfile,
  type FleetPerformanceSummary,
  type PerformanceTier,
  tierLabel,
  classifyPerformance,
} from './performanceEngine';

// ─── Types ───────────────────────────────────────────────────────────────────

export type InsightSeverity = 'success' | 'info' | 'warning' | 'critical';
export type AlertCategory = 'sudden_drop' | 'absence' | 'weak_performance' | 'exceptional';
export type RecommendationType = 'reward' | 'follow_up' | 'warning' | 'improve';
export type PerformanceTrend = 'improving' | 'declining' | 'stable';

export interface AIInsight {
  id: string;
  text: string;
  severity: InsightSeverity;
  icon: string;
}

export interface AIAlert {
  id: string;
  employeeId: string;
  employeeName: string;
  category: AlertCategory;
  severity: InsightSeverity;
  message: string;
  detail: string;
  value: number;
}

export interface AIRecommendation {
  id: string;
  type: RecommendationType;
  title: string;
  description: string;
  riders: Array<{ employeeId: string; employeeName: string; reason: string }>;
  severity: InsightSeverity;
  icon: string;
}


export interface RiderAIAnalysis {
  performanceTrend: PerformanceTrend;
  isConsistent: boolean;
  needsFollowUp: boolean;
  performanceScore: number;
  tier: PerformanceTier;
  judgmentText: string;
  details: string[];
}

export interface FleetAIInsights {
  insights: AIInsight[];
  alerts: AIAlert[];
  recommendations: AIRecommendation[];
  summaryText: string;
}

// ─── Fleet-Level Insights ───────────────────────────────────────────────────

/**
 * Generate comprehensive AI insights from fleet performance data.
 */
export function generateFleetInsights(
  riders: RiderPerformanceProfile[],
  summary: FleetPerformanceSummary,
): FleetAIInsights {
  const insights = buildInsights(riders, summary);
  const alerts = generateAlerts(riders);
  const recommendations = generateRecommendations(riders);
  const summaryText = buildSummaryText(riders, summary);

  return { insights, alerts, recommendations, summaryText };
}

function buildInsights(
  riders: RiderPerformanceProfile[],
  summary: FleetPerformanceSummary,
): AIInsight[] {
  const insights: AIInsight[] = [];

  // 1. Overall performance trend
  const growthDir = summary.totalOrdersDelta.direction;
  const growthPct = Math.abs(summary.totalOrdersDelta.deltaPct);
  if (growthDir === '↑') {
    insights.push({
      id: 'fleet-growth',
      text: `إجمالي الطلبات ارتفع بنسبة ${growthPct.toFixed(1)}% مقارنة بالشهر الماضي — أداء ممتاز للفريق`,
      severity: 'success',
      icon: '📈',
    });
  } else if (growthDir === '↓') {
    insights.push({
      id: 'fleet-decline',
      text: `إجمالي الطلبات انخفض بنسبة ${growthPct.toFixed(1)}% — يحتاج متابعة عاجلة`,
      severity: 'warning',
      icon: '📉',
    });
  } else {
    insights.push({
      id: 'fleet-stable',
      text: 'أداء الفريق مستقر مقارنة بالشهر الماضي',
      severity: 'info',
      icon: '➡️',
    });
  }

  // 2. Top performer highlight
  if (summary.topPerformer) {
    insights.push({
      id: 'top-performer',
      text: `أفضل مندوب: ${getFirstTwoNames(summary.topPerformer.employeeName)} — ${summary.topPerformer.totalOrders.toLocaleString('ar-SA')} طلب (${tierLabel(summary.topPerformer.tier)})`,
      severity: 'success',
      icon: '🏆',
    });
  }

  // 3. Weakest performer
  if (summary.weakestPerformer && summary.weakestPerformer.performanceScore < 50) {
    insights.push({
      id: 'weakest-performer',
      text: `أضعف أداء: ${getFirstTwoNames(summary.weakestPerformer.employeeName)} — يحتاج متابعة وتحفيز`,
      severity: 'warning',
      icon: '⚠️',
    });
  }

  // 4. Distribution insight
  const { excellent, good, average, weak } = summary.distribution;
  const total = excellent + good + average + weak;
  if (total > 0) {
    const excellentPct = Math.round((excellent / total) * 100);
    const weakPct = Math.round((weak / total) * 100);

    if (weakPct > 25) {
      insights.push({
        id: 'high-weak-ratio',
        text: `${weakPct}% من المناديب في الفئة الضعيفة — نسبة مقلقة تحتاج خطة تطوير`,
        severity: 'critical',
        icon: '🚨',
      });
    } else if (excellentPct > 40) {
      insights.push({
        id: 'strong-team',
        text: `${excellentPct}% من المناديب في الفئة الممتازة — فريق قوي`,
        severity: 'success',
        icon: '💪',
      });
    }
  }

  // 5. Most improved
  if (summary.mostImproved && summary.mostImproved.growthPct > 10) {
    insights.push({
      id: 'most-improved',
      text: `أكبر تحسّن: ${getFirstTwoNames(summary.mostImproved.employeeName)} — ارتفع أداؤه ${summary.mostImproved.growthPct.toFixed(0)}%`,
      severity: 'success',
      icon: '🚀',
    });
  }

  // 6. Most declined
  if (summary.mostDeclined && summary.mostDeclined.growthPct < -15) {
    insights.push({
      id: 'most-declined',
      text: `أكبر انخفاض: ${getFirstTwoNames(summary.mostDeclined.employeeName)} — انخفض أداؤه ${Math.abs(summary.mostDeclined.growthPct).toFixed(0)}%`,
      severity: 'warning',
      icon: '📉',
    });
  }

  // 7. Inactive riders
  const inactive = riders.filter((r) => r.activeDays <= 2);
  if (inactive.length > 0) {
    insights.push({
      id: 'inactive-riders',
      text: `${inactive.length} مندوب غير نشط (أقل من 3 أيام عمل) — تحقق من حالتهم`,
      severity: 'warning',
      icon: '😴',
    });
  }

  return insights;
}

// ─── Alerts ─────────────────────────────────────────────────────────────────

function buildSuddenDropAlert(rider: RiderPerformanceProfile): AIAlert | null {
  // Ignore drops if the performance score is still good or total orders is very small
  if (rider.growthPct >= -20 || rider.performanceScore >= 75 || rider.totalOrders < 15) return null;
  const name = getFirstTwoNames(rider.employeeName);
  return {
    id: `drop-${rider.employeeId}`,
    employeeId: rider.employeeId,
    employeeName: name,
    category: 'sudden_drop',
    severity: rider.growthPct < -40 && rider.performanceScore < 50 ? 'critical' : 'warning',
    message: `انخفاض مفاجئ في أداء ${name}`,
    detail: `انخفض بنسبة ${Math.abs(rider.growthPct).toFixed(0)}% عن الشهر الماضي`,
    value: rider.growthPct,
  };
}

function buildAbsenceAlert(rider: RiderPerformanceProfile): AIAlert | null {
  if (rider.activeDays > 3 || rider.totalOrders >= 20) return null;
  const name = getFirstTwoNames(rider.employeeName);
  return {
    id: `absent-${rider.employeeId}`,
    employeeId: rider.employeeId,
    employeeName: name,
    category: 'absence',
    severity: rider.activeDays === 0 ? 'critical' : 'warning',
    message: `${name} شبه غائب`,
    detail: `عمل ${rider.activeDays} أيام فقط مع ${rider.totalOrders} طلب`,
    value: rider.activeDays,
  };
}

function buildWeakPerformanceAlert(rider: RiderPerformanceProfile): AIAlert | null {
  if (rider.performanceScore >= 35 || rider.activeDays <= 5) return null;
  const name = getFirstTwoNames(rider.employeeName);
  return {
    id: `weak-${rider.employeeId}`,
    employeeId: rider.employeeId,
    employeeName: name,
    category: 'weak_performance',
    severity: rider.performanceScore < 20 ? 'critical' : 'warning',
    message: `أداء ${name} ضعيف مستمر`,
    detail: `تقييم ${rider.performanceScore}/100 — ${tierLabel(rider.tier)}`,
    value: rider.performanceScore,
  };
}

function buildExceptionalAlert(rider: RiderPerformanceProfile): AIAlert | null {
  // Require both high performance and significant volume to be "exceptional"
  if (rider.performanceScore < 90 || rider.growthPct <= 5 || rider.totalOrders < 50) return null;
  const name = getFirstTwoNames(rider.employeeName);
  return {
    id: `exceptional-${rider.employeeId}`,
    employeeId: rider.employeeId,
    employeeName: name,
    category: 'exceptional',
    severity: 'success',
    message: `أداء استثنائي من ${name}`,
    detail: `تقييم ${rider.performanceScore}/100 مع تحسّن ${rider.growthPct.toFixed(0)}%`,
    value: rider.performanceScore,
  };
}

const ALERT_BUILDERS = [
  buildSuddenDropAlert,
  buildAbsenceAlert,
  buildWeakPerformanceAlert,
  buildExceptionalAlert,
];

/**
 * Generate AI-powered alerts for individual riders.
 */
export function generateAlerts(riders: RiderPerformanceProfile[]): AIAlert[] {
  const alerts: AIAlert[] = [];

  for (const rider of riders) {
    for (const builder of ALERT_BUILDERS) {
      const alert = builder(rider);
      if (alert) alerts.push(alert);
    }
  }

  // Sort: critical first
  const severityOrder: Record<InsightSeverity, number> = {
    critical: 0,
    warning: 1,
    info: 2,
    success: 3,
  };
  alerts.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  return alerts;
}

// ─── Recommendations ────────────────────────────────────────────────────────

/**
 * Generate AI recommendations based on rider performance data.
 */
export function generateRecommendations(
  riders: RiderPerformanceProfile[],
): AIRecommendation[] {
  const recommendations: AIRecommendation[] = [];

  // 1. Reward candidates (high score + positive growth, or consistently excellent)
  const rewardCandidates = riders.filter(
    (r) => (r.performanceScore >= 85 && r.totalOrders >= 40) || (r.performanceScore >= 80 && r.growthPct > 5 && r.totalOrders >= 40),
  );
  if (rewardCandidates.length > 0) {
    recommendations.push({
      id: 'reward',
      type: 'reward',
      title: 'مناديب يستحقون مكافأة',
      description: `${rewardCandidates.length} مندوب أدائهم استثنائي ومستمر`,
      riders: rewardCandidates.slice(0, 5).map((r) => ({
        employeeId: r.employeeId,
        employeeName: getFirstTwoNames(r.employeeName),
        reason: `تقييم ${r.performanceScore}/100 — طلبات ${r.totalOrders}`,
      })),
      severity: 'success',
      icon: '🏆',
    });
  }

  // 2. Follow-up needed (low score or declining)
  const followUpCandidates = riders.filter(
    (r) => r.performanceScore < 40 || (r.growthPct < -15 && r.activeDays > 5),
  );
  if (followUpCandidates.length > 0) {
    recommendations.push({
      id: 'follow-up',
      type: 'follow_up',
      title: 'مناديب يحتاجون متابعة',
      description: `${followUpCandidates.length} مندوب أداؤهم منخفض أو يتراجع`,
      riders: followUpCandidates.slice(0, 5).map((r) => ({
        employeeId: r.employeeId,
        employeeName: getFirstTwoNames(r.employeeName),
        reason: r.performanceScore < 40
          ? `تقييم ${r.performanceScore}/100`
          : `انخفض ${Math.abs(r.growthPct).toFixed(0)}%`,
      })),
      severity: 'warning',
      icon: '👀',
    });
  }

  // 3. Warning (inactive/absent)
  const absentRiders = riders.filter((r) => r.activeDays <= 3);
  if (absentRiders.length > 0) {
    recommendations.push({
      id: 'warning',
      type: 'warning',
      title: 'مناديب غائبون أو غير نشطين',
      description: `${absentRiders.length} مندوب عملوا أقل من 3 أيام`,
      riders: absentRiders.slice(0, 5).map((r) => ({
        employeeId: r.employeeId,
        employeeName: getFirstTwoNames(r.employeeName),
        reason: `${r.activeDays} أيام عمل — ${r.totalOrders} طلب`,
      })),
      severity: 'critical',
      icon: '🚨',
    });
  }

  // 4. Improvement plan (inconsistent performers)
  const inconsistent = riders.filter(
    (r) => r.consistencyRatio < 0.5 && r.activeDays >= 10 && r.performanceScore < 60,
  );
  if (inconsistent.length > 0) {
    recommendations.push({
      id: 'improve',
      type: 'improve',
      title: 'مناديب يحتاجون خطة تحسين',
      description: `${inconsistent.length} مندوب أداؤهم غير مستقر — يمكن تحسينهم`,
      riders: inconsistent.slice(0, 5).map((r) => ({
        employeeId: r.employeeId,
        employeeName: getFirstTwoNames(r.employeeName),
        reason: `انتظام ${Math.round(r.consistencyRatio * 100)}% — تقييم ${r.performanceScore}/100`,
      })),
      severity: 'info',
      icon: '📈',
    });
  }

  return recommendations;
}

// ─── Per-Rider AI Analysis ──────────────────────────────────────────────────

function determinePerformanceTrend(growthPct: number): PerformanceTrend {
  // Use a wider margin (e.g. 10%) so small natural fluctuations aren't marked as declining/improving
  if (growthPct > 10) return 'improving';
  if (growthPct < -10) return 'declining';
  return 'stable';
}

function buildTrendDetail(growthPct: number): string {
  if (growthPct > 5) return `أداؤه يتحسّن بنسبة ${growthPct.toFixed(1)}%`;
  if (growthPct < -5) return `أداؤه يتراجع بنسبة ${Math.abs(growthPct).toFixed(1)}%`;
  return 'أداؤه مستقر مقارنة بالشهر السابق';
}

function buildTargetDetail(achievementPct: number): string | null {
  if (achievementPct >= 100) return `حقق الهدف الشهري (${achievementPct.toFixed(0)}%)`;
  if (achievementPct >= 75) return `قريب من تحقيق الهدف (${achievementPct.toFixed(0)}%)`;
  if (achievementPct > 0) return `بعيد عن الهدف (${achievementPct.toFixed(0)}%)`;
  return null;
}

function buildExcellentJudgment(trend: PerformanceTrend, isConsistent: boolean): string[] {
  const parts: string[] = ['أداء ممتاز'];
  if (trend === 'improving') parts.push('ويتحسّن');
  if (isConsistent) parts.push('ومنتظم');
  parts.push('— يستحق تقدير');
  return parts;
}

function buildGoodJudgment(trend: PerformanceTrend, isConsistent: boolean): string[] {
  const parts: string[] = ['أداء جيد'];
  if (trend === 'declining') parts.push('لكنه يتراجع');
  else if (isConsistent) parts.push('ومنتظم');
  return parts;
}

function buildAverageJudgment(trend: PerformanceTrend, isConsistent: boolean): string[] {
  const parts: string[] = ['أداء متوسط'];
  if (trend === 'improving') parts.push('لكنه يتحسّن');
  else if (isConsistent === false) parts.push('وغير مستقر');
  parts.push('— يحتاج تحفيز');
  return parts;
}

function buildWeakJudgment(trend: PerformanceTrend): string[] {
  const parts: string[] = ['أداء ضعيف'];
  if (trend === 'declining') parts.push('ومتراجع');
  parts.push('— يحتاج متابعة عاجلة');
  return parts;
}

const TIER_JUDGMENT_BUILDERS: Record<PerformanceTier, (trend: PerformanceTrend, isConsistent: boolean) => string[]> = {
  excellent: buildExcellentJudgment,
  good: buildGoodJudgment,
  average: buildAverageJudgment,
  weak: buildWeakJudgment,
};

function buildJudgmentText(
  tier: PerformanceTier,
  trend: PerformanceTrend,
  isConsistent: boolean,
): string {
  return TIER_JUDGMENT_BUILDERS[tier](trend, isConsistent).join(' ');
}

/**
 * Generate an AI analysis for a single rider.
 */
export function analyzeRider(rider: RiderPerformanceProfile): RiderAIAnalysis {
  const details: string[] = [];

  // Determine trend
  const performanceTrend = determinePerformanceTrend(rider.growthPct);
  details.push(buildTrendDetail(rider.growthPct));

  // Consistency check
  const isConsistent = rider.consistencyRatio >= 0.6;
  if (isConsistent) {
    details.push('منتظم في العمل والإنتاجية');
  } else {
    details.push(`غير منتظم (${Math.round(rider.consistencyRatio * 100)}% انتظام)`);
  }

  // Target achievement
  const targetDetail = buildTargetDetail(rider.targetAchievementPct);
  if (targetDetail) details.push(targetDetail);

  // Average orders per day
  details.push(`متوسط ${rider.avgOrdersPerDay.toFixed(1)} طلب/يوم — ${rider.activeDays} يوم عمل`);

  // Follow-up need
  // Only flag for follow-up if their score is truly low, or they dropped significantly and are underperforming.
  const needsFollowUp =
    (rider.performanceScore < 40 && rider.activeDays > 0) ||
    (rider.growthPct < -25 && rider.performanceScore < 60) ||
    rider.activeDays <= 3 ||
    (rider.consistencyRatio < 0.4 && rider.activeDays > 10 && rider.performanceScore < 60);

  // Build judgment text
  const tier = classifyPerformance(rider.performanceScore);
  const judgmentText = buildJudgmentText(tier, performanceTrend, isConsistent);

  return {
    performanceTrend,
    isConsistent,
    needsFollowUp,
    performanceScore: rider.performanceScore,
    tier,
    judgmentText,
    details,
  };
}

// ─── Summary Text Builder ───────────────────────────────────────────────────

function buildSummaryText(
  riders: RiderPerformanceProfile[],
  summary: FleetPerformanceSummary,
): string {
  const parts: string[] = [];

  // Fleet size
  const delta = summary.totalOrdersDelta;
  parts.push(
    `الفريق يضم ${summary.activeRiders} مندوب نشط`,
    `بإجمالي ${summary.totalOrders.toLocaleString('ar-SA')} طلب (${delta.formattedDelta})`,
    `متوسط التقييم: ${summary.avgPerformanceScore}/100`,
  );

  // Distribution
  const { excellent, weak } = summary.distribution;
  if (excellent > 0) parts.push(`${excellent} مندوب ممتاز`);
  if (weak > 0) parts.push(`${weak} مندوب ضعيف`);

  // Alerts count
  const alertRiders = riders.filter(
    (r) => r.performanceScore < 35 || r.growthPct < -20 || r.activeDays <= 3,
  );
  if (alertRiders.length > 0) {
    parts.push(`${alertRiders.length} تنبيه يحتاج متابعة`);
  }

  return parts.join(' • ');
}

// ─── AI Chat System Prompt Builder ──────────────────────────────────────────

// ─── Helpers ────────────────────────────────────────────────────────────────

function getFirstTwoNames(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  return parts.slice(0, 2).join(' ');
}
