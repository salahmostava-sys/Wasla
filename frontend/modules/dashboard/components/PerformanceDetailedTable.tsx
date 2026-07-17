/**
 * PerformanceDetailedTable — Sortable, filterable table showing all riders
 * with scores, growth indicators, and consistency bars.
 */

import { useState, useMemo } from 'react';
import { Search, ArrowUp, ArrowDown } from 'lucide-react';
import {
  type RiderPerformanceProfile,
  type PerformanceTier,
} from '@modules/dashboard/lib/performanceEngine';
import { ScoreRing } from './PerformanceScoreBadge';

interface PerformanceDetailedTableProps {
  riders: RiderPerformanceProfile[];
  onRiderClick?: (employeeId: string) => void;
}

type SortKey = 'rank' | 'employeeName' | 'totalOrders' | 'avgOrdersPerDay' | 'performanceScore' | 'growthPct' | 'consistencyRatio';
type SortDir = 'asc' | 'desc';
type TierFilter = PerformanceTier | 'all';

function ConsistencyBar({ ratio }: Readonly<{ ratio: number }>) {
  const pct = Math.min(100, Math.round(ratio * 100));
  const color = (() => {
    if (pct >= 70) return 'bg-emerald-500';
    if (pct >= 50) return 'bg-amber-500';
    return 'bg-rose-500';
  })();
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[11px] font-medium text-muted-foreground">{pct}%</span>
    </div>
  );
}

function GrowthBadge({ pct }: Readonly<{ pct: number }>) {
  const isUp = pct > 2;
  const isDown = pct < -2;
  const color = (() => {
    if (isUp) return 'text-emerald-600';
    if (isDown) return 'text-rose-500';
    return 'text-muted-foreground';
  })();
  const sign = pct > 0 ? '+' : '';
  const Icon = (() => {
    if (isUp) return ArrowUp;
    if (isDown) return ArrowDown;
    return null;
  })();

  return (
    <span className={`flex items-center gap-0.5 text-xs font-bold ${color}`}>
      {Icon && <Icon size={12} />}
      {sign}{pct.toFixed(1)}%
    </span>
  );
}

function SortIcon({ colKey, sortKey, sortDir }: Readonly<{ colKey: SortKey; sortKey: SortKey; sortDir: SortDir }>) {
  if (sortKey !== colKey) return <span className="size-3" aria-hidden />;
  return sortDir === 'asc' ? (
    <ArrowUp size={12} className="text-foreground" />
  ) : (
    <ArrowDown size={12} className="text-foreground" />
  );
}

export function PerformanceDetailedTable({
  riders,
  onRiderClick,
}: Readonly<PerformanceDetailedTableProps>) {
  const [search, setSearch] = useState('');
  const [tierFilter, setTierFilter] = useState<TierFilter>('all');
  const [sortKey, setSortKey] = useState<SortKey>('rank');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const filtered = useMemo(() => {
    let result = [...riders];
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter(
        (r) => r.employeeName.toLowerCase().includes(q) || r.city?.toLowerCase().includes(q),
      );
    }
    if (tierFilter !== 'all') result = result.filter((r) => r.tier === tierFilter);
    result.sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDir === 'asc' ? aVal.localeCompare(bVal, 'ar') : bVal.localeCompare(aVal, 'ar');
      }
      const diff = (aVal as number) - (bVal as number);
      return sortDir === 'asc' ? diff : -diff;
    });
    return result;
  }, [riders, search, tierFilter, sortKey, sortDir]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir(key === 'employeeName' ? 'asc' : 'desc'); }
  };

  const tiers: { value: TierFilter; label: string }[] = [
    { value: 'all', label: 'الكل' },
    { value: 'excellent', label: 'ممتاز' },
    { value: 'good', label: 'جيد' },
    { value: 'average', label: 'متوسط' },
    { value: 'weak', label: 'ضعيف' },
  ];

  return (
    <div className="bg-card -2xl shadow-card overflow-hidden rounded-2xl">
      {/* Header */}
      <div className="px-5 py-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-foreground">جدول الأداء التفصيلي</h3>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {filtered.length} مندوب من أصل {riders.length}
          </p>
        </div>
        <div className="flex items-center gap-2 w-full md:w-auto">
          {/* Search */}
          <div className="relative flex-1 md:w-52">
            <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="بحث بالاسم..."
              className="w-full ps-3 pe-9 py-2 rounded-xl bg-muted/40 border border-border/50
                         text-xs text-foreground placeholder:text-muted-foreground
                         focus:outline-none focus:ring-2 focus:ring-primary/20"
              dir="rtl"
            />
          </div>
          {/* Tier filter */}
          <div className="flex gap-1 bg-muted/30 rounded-xl p-0.5">
            {tiers.map((t) => (
              <button type="button"
                key={t.value}
                onClick={() => setTierFilter(t.value)}
                className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-colors ${
                  tierFilter === t.value
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-t border-b border-border/50 bg-muted/20">
              {[
                { key: 'rank' as SortKey, label: '#' },
                { key: 'employeeName' as SortKey, label: 'المندوب' },
                { key: 'totalOrders' as SortKey, label: 'الطلبات' },
                { key: 'avgOrdersPerDay' as SortKey, label: 'المتوسط/يوم' },
                { key: 'performanceScore' as SortKey, label: 'التقييم' },
                { key: 'growthPct' as SortKey, label: 'النمو' },
                { key: 'consistencyRatio' as SortKey, label: 'الانتظام' },
              ].map((col) => (
                <th
                  key={col.key}
                  onClick={() => handleSort(col.key)}
                  className="px-3 py-2.5 text-[11px] font-bold text-muted-foreground text-start
                             cursor-pointer hover:text-foreground select-none whitespace-nowrap"
                >
                  <span className="flex items-center gap-1">
                    {col.label}
                    <SortIcon colKey={col.key} sortKey={sortKey} sortDir={sortDir} />
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="ta-td text-muted-foreground">
                  لا توجد نتائج
                </td>
              </tr>
            ) : (
              filtered.map((rider) => (
                <tr
                  key={rider.employeeId}
                  onClick={() => onRiderClick?.(rider.employeeId)}
                  className="border-b border-border/30 hover:bg-muted/20 cursor-pointer transition-colors"
                >
                  <td className="ta-td font-bold text-muted-foreground w-10">
                    {rider.rank}
                  </td>
                  <td className="ta-td">
                    <div>
                      <p className="text-xs font-bold text-foreground">{rider.employeeName}</p>
                      {rider.city && (
                        <p className="text-[10px] text-muted-foreground">{rider.city}</p>
                      )}
                    </div>
                  </td>
                  <td className="ta-td font-bold text-foreground">
                    {rider.totalOrders.toLocaleString('en-US')}
                  </td>
                  <td className="ta-td text-foreground">
                    {rider.avgOrdersPerDay.toFixed(1)}
                  </td>
                  <td className="ta-td">
                    <ScoreRing score={rider.performanceScore} />
                  </td>
                  <td className="ta-td">
                    <GrowthBadge pct={rider.growthPct} />
                  </td>
                  <td className="ta-td">
                    <ConsistencyBar ratio={rider.consistencyRatio} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
