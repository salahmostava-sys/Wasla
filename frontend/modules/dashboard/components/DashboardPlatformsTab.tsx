/**
 * DashboardPlatformsTab — مقارنة أداء المنصات جنبًا إلى جنب
 * مع بطاقات، جدول مقارنة قابل للترتيب، ورسم بياني.
 */

import { useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
} from 'recharts';
import { ArrowUpRight, ArrowDownRight, Target, TrendingUp, Users, Package } from 'lucide-react';

import type { PerformanceDashboardResponse } from '@services/performanceService';
import { Skeleton } from '@shared/components/ui/skeleton';

type SortKey =
  | 'appName'
  | 'orders'
  | 'riders'
  | 'avgPerRider'
  | 'targetOrders'
  | 'targetAchievementPct'
  | 'growthPct'
  | 'previousOrders';

type SortDir = 'asc' | 'desc';

function formatPercent(value: number) {
  const rounded = Number.isFinite(value) ? value : 0;
  return `${rounded > 0 ? '+' : ''}${rounded.toFixed(1)}%`;
}

function achievementBarColor(pct: number): string {
  if (pct >= 100) return '#10b981';
  if (pct >= 70) return '#3b82f6';
  if (pct >= 40) return '#f59e0b';
  return '#ef4444';
}

function achievementTextClass(pct: number): string {
  if (pct >= 100) return 'text-emerald-600';
  if (pct >= 70) return 'text-blue-600';
  if (pct >= 40) return 'text-amber-600';
  return 'text-rose-500';
}

function PlatformCard(props: Readonly<{
  appName: string;
  brandColor: string;
  textColor: string;
  orders: number;
  riders: number;
  targetOrders: number;
  targetAchievementPct: number;
  growthPct: number;
}>) {
  const { appName, brandColor, textColor, orders, riders, targetOrders, targetAchievementPct, growthPct } = props;
  const positive = growthPct >= 0;
  const achievementCapped = Math.min(targetAchievementPct, 100);

  return (
    <div className="bg-card -2xl p-5 shadow-card hover:shadow-card-hover transition-shadow duration-200 border border-border/40 rounded-2xl">
      <div className="flex items-center justify-between gap-2 mb-4">
        <span
          className="text-sm font-bold px-3 py-1.5 rounded-xl"
          style={{ backgroundColor: brandColor, color: textColor }}
        >
          {appName}
        </span>
        <div className={`flex items-center gap-1 text-xs font-bold ${positive ? 'text-emerald-600' : 'text-rose-500'}`}>
          {positive ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
          {formatPercent(growthPct)}
        </div>
      </div>

      <p className="text-3xl font-black text-foreground">{orders.toLocaleString('en-US')}</p>
      <p className="text-xs text-muted-foreground mt-1">طلب هذا الشهر</p>

      <div className="mt-4 space-y-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground flex items-center gap-1.5">
            <Users size={13} /> المناديب
          </span>
          <span className="font-bold text-foreground">{riders}</span>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground flex items-center gap-1.5">
              <Target size={13} /> تحقيق الهدف
            </span>
            <span className="font-bold text-foreground">{targetAchievementPct.toFixed(0)}%</span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${achievementCapped}%`,
                backgroundColor: achievementBarColor(targetAchievementPct),
              }}
            />
          </div>
          <p className="text-[11px] text-muted-foreground">الهدف: {targetOrders.toLocaleString('en-US')} طلب</p>
        </div>
      </div>
    </div>
  );
}

function SortHeader(props: Readonly<{
  label: string;
  sortKey: SortKey;
  currentSort: SortKey;
  currentDir: SortDir;
  onSort: (key: SortKey) => void;
}>) {
  const { label, sortKey, currentSort, currentDir, onSort } = props;
  const active = currentSort === sortKey;
  return (
    <th
      className="ta-th cursor-pointer select-none hover:text-foreground transition-colors"
      onClick={() => onSort(sortKey)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {active && (
          <span className="text-primary text-[10px]">{currentDir === 'asc' ? '▲' : '▼'}</span>
        )}
      </span>
    </th>
  );
}

export function DashboardPlatformsTab(props: Readonly<{
  dashboard: PerformanceDashboardResponse | null;
}>) {
  const { dashboard } = props;
  const [sortKey, setSortKey] = useState<SortKey>('orders');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  const platforms = useMemo(() => {
    if (!dashboard) return [];
    return dashboard.ordersByApp.map((app) => ({
      ...app,
      avgPerRider: app.riders > 0 ? app.orders / app.riders : 0,
    }));
  }, [dashboard]);

  const sorted = useMemo(() => {
    const list = [...platforms];
    const dir = sortDir === 'asc' ? 1 : -1;
    list.sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return dir * aVal.localeCompare(bVal, 'ar');
      }
      return dir * ((aVal as number) - (bVal as number));
    });
    return list;
  }, [platforms, sortKey, sortDir]);

  const totals = useMemo(() => {
    if (platforms.length === 0) return { orders: 0, riders: 0, targetOrders: 0, previousOrders: 0, avgPerRider: 0 };
    const orders = platforms.reduce((s, p) => s + p.orders, 0);
    const riders = platforms.reduce((s, p) => s + p.riders, 0);
    const targetOrders = platforms.reduce((s, p) => s + p.targetOrders, 0);
    const previousOrders = platforms.reduce((s, p) => s + p.previousOrders, 0);
    return { orders, riders, targetOrders, previousOrders, avgPerRider: riders > 0 ? orders / riders : 0 };
  }, [platforms]);

  const chartData = useMemo(() => {
    return platforms.map((p) => ({
      name: p.appName,
      'الشهر الحالي': p.orders,
      'الشهر السابق': p.previousOrders,
    }));
  }, [platforms]);

  if (!dashboard) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index}  className="bg-card -2xl h-48 shadow-card rounded-2xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Summary Stats ────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-card -2xl p-4 shadow-card rounded-2xl">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              <Package size={16} />
            </div>
          </div>
          <p className="text-2xl font-black text-foreground">{platforms.length}</p>
          <p className="text-xs text-muted-foreground mt-1">منصة نشطة</p>
        </div>
        <div className="bg-card -2xl p-4 shadow-card rounded-2xl">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-600">
              <TrendingUp size={16} />
            </div>
          </div>
          <p className="text-2xl font-black text-foreground">{totals.orders.toLocaleString('en-US')}</p>
          <p className="text-xs text-muted-foreground mt-1">إجمالي الطلبات</p>
        </div>
        <div className="bg-card -2xl p-4 shadow-card rounded-2xl">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-9 h-9 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-600">
              <Users size={16} />
            </div>
          </div>
          <p className="text-2xl font-black text-foreground">{totals.riders.toLocaleString('en-US')}</p>
          <p className="text-xs text-muted-foreground mt-1">إجمالي المناديب</p>
        </div>
        <div className="bg-card -2xl p-4 shadow-card rounded-2xl">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-600">
              <Target size={16} />
            </div>
          </div>
          <p className="text-2xl font-black text-foreground">{totals.avgPerRider.toFixed(1)}</p>
          <p className="text-xs text-muted-foreground mt-1">متوسط طلبات/مندوب</p>
        </div>
      </div>

      {/* ── Platform Cards ───────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {platforms.map((app) => (
          <PlatformCard
            key={app.appId}
            appName={app.appName}
            brandColor={app.brandColor}
            textColor={app.textColor}
            orders={app.orders}
            riders={app.riders}
            targetOrders={app.targetOrders}
            targetAchievementPct={app.targetAchievementPct}
            growthPct={app.growthPct}
          />
        ))}
      </div>

      {/* ── Comparison Chart ─────────────────────────────────────────── */}
      {chartData.length > 0 && (
        <div className="bg-card -2xl p-5 shadow-card rounded-2xl">
          <div className="mb-4">
            <h3 className="text-sm font-bold text-foreground">مقارنة الشهر الحالي بالسابق</h3>
            <p className="text-[11px] text-muted-foreground mt-1">طلبات كل منصة مقارنة بالشهر الماضي</p>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData} barGap={4} barCategoryGap="20%">
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{
                  borderRadius: '12px',
                  border: '1px solid hsl(var(--border))',
                  backgroundColor: 'hsl(var(--card))',
                  fontSize: '12px',
                }}
              />
              <Legend wrapperStyle={{ fontSize: '12px' }} />
              <Bar dataKey="الشهر الحالي" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
              <Bar dataKey="الشهر السابق" fill="hsl(var(--muted-foreground))" opacity={0.4} radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── Comparison Table ──────────────────────────────────────────── */}
      <div className="bg-card -2xl shadow-card overflow-hidden rounded-2xl">
        <div className="px-5 py-4 border-b border-border/50">
          <h3 className="text-sm font-bold text-foreground">جدول مقارنة المنصات</h3>
          <p className="text-[11px] text-muted-foreground mt-1">اضغط على رأس العمود للترتيب</p>
        </div>
        <div className="overflow-x-auto">
          <table className="data-table w-full min-w-[800px] text-sm">
            <thead>
              <tr className="border-b border-border/50 bg-muted/30">
                <SortHeader label="المنصة" sortKey="appName" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
                <SortHeader label="الطلبات" sortKey="orders" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
                <SortHeader label="المناديب" sortKey="riders" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
                <SortHeader label="متوسط/مندوب" sortKey="avgPerRider" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
                <SortHeader label="الهدف" sortKey="targetOrders" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
                <SortHeader label="تحقيق %" sortKey="targetAchievementPct" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
                <SortHeader label="النمو %" sortKey="growthPct" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
                <SortHeader label="الشهر السابق" sortKey="previousOrders" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
              </tr>
            </thead>
            <tbody>
              {sorted.map((app) => (
                <tr key={app.appId} className="border-b border-border/30 hover:bg-muted/20 transition-colors">
                  <td className="ta-td">
                    <span
                      className="text-xs font-bold px-2.5 py-1 rounded-lg"
                      style={{ backgroundColor: app.brandColor, color: app.textColor }}
                    >
                      {app.appName}
                    </span>
                  </td>
                  <td className="ta-td font-bold text-foreground">{app.orders.toLocaleString('en-US')}</td>
                  <td className="ta-td">{app.riders}</td>
                  <td className="ta-td">{app.avgPerRider.toFixed(1)}</td>
                  <td className="ta-td">{app.targetOrders.toLocaleString('en-US')}</td>
                  <td className="ta-td">
                    <span className={`font-bold ${achievementTextClass(app.targetAchievementPct)}`}>
                      {app.targetAchievementPct.toFixed(0)}%
                    </span>
                  </td>
                  <td className="ta-td">
                    <span className={`font-bold ${app.growthPct >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
                      {formatPercent(app.growthPct)}
                    </span>
                  </td>
                  <td className="ta-td text-muted-foreground">{app.previousOrders.toLocaleString('en-US')}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-border bg-muted/20 font-semibold text-sm">
                <td className="ta-td font-bold text-foreground">الإجمالي</td>
                <td className="ta-td font-bold text-primary">{totals.orders.toLocaleString('en-US')}</td>
                <td className="ta-td">{totals.riders}</td>
                <td className="ta-td">{totals.avgPerRider.toFixed(1)}</td>
                <td className="ta-td">{totals.targetOrders.toLocaleString('en-US')}</td>
                <td className="ta-td">
                  {totals.targetOrders > 0 ? (
                    <span className="font-bold">
                      {((totals.orders / totals.targetOrders) * 100).toFixed(0)}%
                    </span>
                  ) : '—'}
                </td>
                <td className="ta-td">
                  {totals.previousOrders > 0 ? (
                    <span className={`font-bold ${totals.orders >= totals.previousOrders ? 'text-emerald-600' : 'text-rose-500'}`}>
                      {formatPercent(((totals.orders - totals.previousOrders) / totals.previousOrders) * 100)}
                    </span>
                  ) : '—'}
                </td>
                <td className="ta-td text-muted-foreground">{totals.previousOrders.toLocaleString('en-US')}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
