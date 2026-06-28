/**
 * EnrichedStatCard — Stat card that displays a value WITH its comparison delta.
 */

import type { LucideIcon } from 'lucide-react';
import {
  type ComparisonResult,
  type PerformanceTier,
  tierColorClass,
  tierBgClass,
} from '@modules/dashboard/lib/performanceEngine';

interface EnrichedStatCardProps {
  label: string;
  value: string;
  delta?: ComparisonResult | null;
  sub?: string;
  icon: LucideIcon;
  tier?: PerformanceTier | null;
}

const tierBorderColor: Record<PerformanceTier, string> = {
  excellent: '#10b981',
  good: '#3b82f6',
  average: '#f59e0b',
  weak: '#ef4444',
};

export function EnrichedStatCard({
  label,
  value,
  delta,
  sub,
  icon: Icon,
  tier,
}: Readonly<EnrichedStatCardProps>) {
  const iconBg = tier ? tierBgClass(tier) : 'bg-muted/40';
  const iconColor = tier ? tierColorClass(tier) : 'text-foreground';

  let deltaClass = 'text-muted-foreground';
  if (delta?.direction === '↑') deltaClass = 'text-emerald-600';
  else if (delta?.direction === '↓') deltaClass = 'text-rose-500';

  const borderAccent = tier ? tierBorderColor[tier] : undefined;

  return (
    <div
      className="bg-card -2xl p-4 shadow-card hover:shadow-card-hover transition-all duration-300 relative overflow-hidden group rounded-2xl"
      style={borderAccent ? { borderBottom: `3px solid ${borderAccent}` } : undefined}
    >
      {/* Subtle background shimmer on hover */}
      <div className="absolute inset-0 bg-gradient-to-br from-transparent via-primary/[0.02] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none rounded-2xl" />

      <div className="flex items-start justify-between gap-2">
        <div
          className={`w-10 h-10 rounded-xl flex items-center justify-center ${iconBg} ${iconColor} transition-transform duration-200 group-hover:scale-110`}
        >
          <Icon size={18} />
        </div>
        {delta && (
          <span className={`text-[11px] font-bold ${deltaClass} whitespace-nowrap bg-muted/50 px-1.5 py-0.5 rounded-lg`}>
            {delta.formattedDelta}
          </span>
        )}
      </div>
      <div className="mt-3">
        <p className="text-xl font-black text-foreground leading-tight">{value}</p>
        <p className="text-xs font-semibold text-foreground/75 mt-2">{label}</p>
        {sub && <p className="text-[11px] text-muted-foreground mt-1">{sub}</p>}
      </div>
    </div>
  );
}
