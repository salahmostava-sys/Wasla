/**
 * AIInsightsPanel — بطاقة تحليلات ذكية لأداء الأسطول.
 */

import { Brain, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';
import type { AIInsight, FleetAIInsights } from '@modules/dashboard/lib/aiInsightsEngine';

interface AIInsightsPanelProps {
  insights: FleetAIInsights;
}

const severityStyles: Record<string, string> = {
  success: 'border-emerald-200 bg-emerald-50/50 text-emerald-800',
  info: 'border-blue-200 bg-blue-50/50 text-blue-800',
  warning: 'border-amber-200 bg-amber-50/50 text-amber-800',
  critical: 'border-rose-200 bg-rose-50/50 text-rose-800',
};

function InsightRow({ insight }: Readonly<{ insight: AIInsight }>) {
  const style = severityStyles[insight.severity] || severityStyles.info;
  return (
    <div className={`rounded-xl border px-4 py-3 ${style}`}>
      <div className="flex items-start gap-2.5">
        <span className="text-base mt-0.5 shrink-0">{insight.icon}</span>
        <p className="text-sm font-medium leading-relaxed">{insight.text}</p>
      </div>
    </div>
  );
}

export function AIInsightsPanel({ insights }: Readonly<AIInsightsPanelProps>) {
  const [expanded, setExpanded] = useState(false);
  const visibleInsights = expanded
    ? insights.insights
    : insights.insights.slice(0, 4);

  return (
    <div className="bg-card -2xl shadow-card overflow-hidden rounded-2xl">
      {/* Header */}
      <div className="px-5 pt-5 pb-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white shadow-card shadow-card rounded-2xl">
            <Brain size={18} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">تحليل ذكي</h3>
            <p className="text-[11px] text-muted-foreground">مبني على بيانات الأداء الحقيقية</p>
          </div>
        </div>
        <span className="text-[11px] font-bold text-violet-600 bg-violet-50 px-2.5 py-1 rounded-lg">
          AI
        </span>
      </div>

      {/* Summary line */}
      <div className="px-5 pb-3">
        <p className="text-xs text-muted-foreground leading-relaxed bg-muted/30 rounded-xl px-3.5 py-2.5">
          {insights.summaryText}
        </p>
      </div>

      {/* Insight items */}
      <div className="px-5 pb-4 space-y-2">
        {visibleInsights.map((insight) => (
          <InsightRow key={insight.id} insight={insight} />
        ))}
      </div>

      {/* Expand/collapse */}
      {insights.insights.length > 4 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full py-2.5 text-xs font-bold text-muted-foreground hover:text-foreground
                     flex items-center justify-center gap-1 border-t border-border/50
                     transition-colors duration-200"
        >
          {expanded ? (
            <>
              عرض أقل <ChevronUp size={14} />
            </>
          ) : (
            <>
              عرض الكل ({insights.insights.length}) <ChevronDown size={14} />
            </>
          )}
        </button>
      )}
    </div>
  );
}
