/**
 * AIRecommendationsSection — Displays AI-powered recommendations with actionable items.
 */

import { Lightbulb, ChevronLeft } from 'lucide-react';
import type { AIRecommendation } from '@modules/dashboard/lib/aiInsightsEngine';

interface AIRecommendationsSectionProps {
  recommendations: AIRecommendation[];
  onRiderClick?: (employeeId: string) => void;
}

const typeStyles: Record<string, { border: string; bg: string; accent: string }> = {
  reward: {
    border: 'border-emerald-200',
    bg: 'bg-gradient-to-br from-emerald-50 to-teal-50/50',
    accent: 'text-emerald-700',
  },
  follow_up: {
    border: 'border-amber-200',
    bg: 'bg-gradient-to-br from-amber-50 to-orange-50/50',
    accent: 'text-amber-700',
  },
  warning: {
    border: 'border-rose-200',
    bg: 'bg-gradient-to-br from-rose-50 to-pink-50/50',
    accent: 'text-rose-700',
  },
  improve: {
    border: 'border-blue-200',
    bg: 'bg-gradient-to-br from-blue-50 to-indigo-50/50',
    accent: 'text-blue-700',
  },
};

function RecommendationCard({
  rec,
  onRiderClick,
}: Readonly<{
  rec: AIRecommendation;
  onRiderClick?: (employeeId: string) => void;
}>) {
  const style = typeStyles[rec.type] || typeStyles.follow_up;

  return (
    <div className={`rounded-2xl border ${style.border} ${style.bg} p-4 space-y-3`}>
      <div className="flex items-start gap-2.5">
        <span className="text-xl">{rec.icon}</span>
        <div className="flex-1 min-w-0">
          <h4 className={`text-sm font-bold ${style.accent}`}>{rec.title}</h4>
          <p className="text-[11px] text-muted-foreground mt-0.5">{rec.description}</p>
        </div>
      </div>

      <div className="space-y-1.5">
        {rec.riders.map((rider) => (
          <button
            key={rider.employeeId}
            onClick={() => onRiderClick?.(rider.employeeId)}
            className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl
                       bg-white/60 hover:bg-white/90 border border-white/50
                       transition-all duration-200 group text-start"
          >
            <div className="min-w-0">
              <p className="text-xs font-bold text-foreground truncate">{rider.employeeName}</p>
              <p className="text-[10px] text-muted-foreground truncate">{rider.reason}</p>
            </div>
            <ChevronLeft
              size={14}
              className="text-muted-foreground/50 group-hover:text-foreground/70 shrink-0 transition-colors"
            />
          </button>
        ))}
      </div>
    </div>
  );
}

export function AIRecommendationsSection({
  recommendations,
  onRiderClick,
}: Readonly<AIRecommendationsSectionProps>) {
  if (recommendations.length === 0) return null;

  return (
    <div className="bg-card -2xl p-5 shadow-card rounded-2xl">
      <div className="flex items-center gap-2.5 mb-4">
        <div className="w-9 h-9 bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white shadow-card shadow-card rounded-2xl">
          <Lightbulb size={18} />
        </div>
        <div>
          <h3 className="text-sm font-bold text-foreground">توصيات ذكية</h3>
          <p className="text-[11px] text-muted-foreground">
            اقتراحات مبنية على تحليل الأداء
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {recommendations.map((rec) => (
          <RecommendationCard
            key={rec.id}
            rec={rec}
            onRiderClick={onRiderClick}
          />
        ))}
      </div>
    </div>
  );
}
