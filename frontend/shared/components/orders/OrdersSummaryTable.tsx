import React from 'react';
import { getAppColor, type AppColorData } from '@shared/hooks/useAppColors';
import { ColorBadge } from '@shared/components/ui/ColorBadge';

/** Performance level based on daily average orders. */
type PerfLevel = { label: string; color: string; bg: string };

function getPerformanceLevel(dailyAvg: number): PerfLevel {
  if (dailyAvg >= 35) return { label: 'ممتاز', color: 'text-success', bg: 'bg-success/10' };
  if (dailyAvg >= 25) return { label: 'جيد جداً', color: 'text-primary', bg: 'bg-primary/10' };
  if (dailyAvg >= 18) return { label: 'جيد', color: 'text-info', bg: 'bg-info/10' };
  if (dailyAvg >= 10) return { label: 'متوسط', color: 'text-warning', bg: 'bg-warning/10' };
  if (dailyAvg >= 1) return { label: 'ضعيف', color: 'text-destructive', bg: 'bg-destructive/10' };
  return { label: '—', color: 'text-muted-foreground', bg: '' };
}

type Employee = { id: string; name: string };
type App = { id: string; name: string };
type DailyData = Record<string, number>;
type SortField = 'name' | 'total' | `app:${string}`;
type SortDir = 'asc' | 'desc';

type Props = {
  loading: boolean;
  apps: App[];
  appColorsList: AppColorData[];
  sortedEmployees: Employee[];
  employeesCount: number;
  data: DailyData;
  dayArr: number[];
  days: number;
  empTotal: (employeeId: string) => number;
  appGrandTotal: (appId: string) => number;
  grandTotal: number;
  shortName: (name: string) => string;
  sortField: SortField;
  sortDir: SortDir;
  onSort: (field: SortField) => void;
};

const SortIcon = ({ active, dir }: { active: boolean; dir: SortDir }) => {
  if (!active) return <span className="text-muted-foreground/40 text-[10px] mr-0.5">⇅</span>;
  return <span className="text-[10px] mr-0.5">{dir === 'asc' ? '↑' : '↓'}</span>;
};

export const OrdersSummaryTable = React.memo(({
  loading,
  apps,
  appColorsList,
  sortedEmployees,
  employeesCount,
  data,
  dayArr,
  days,
  empTotal,
  appGrandTotal,
  grandTotal,
  shortName,
  sortField,
  sortDir,
  onSort,
}: Readonly<Props>) => {
  return (
    <table className="w-full text-xs">
      <thead>
        <tr className="border-b-2 border-border bg-muted/40">
          <th className="ta-th p-3 w-10">#</th>
          <th className="ta-th p-3 text-foreground min-w-[110px] cursor-pointer" onClick={() => onSort('name')}>
            المندوب <SortIcon active={sortField === 'name'} dir={sortDir} />
          </th>
          {apps.map((app) => {
            const c = getAppColor(appColorsList, app.name);
            const appField = `app:${app.id}` as const;
            return (
              <th
                key={app.id}
                onClick={() => onSort(appField)}
                className="text-center p-3 font-semibold min-w-[90px] border-l border-border/50 cursor-pointer"
              >
                <div className="flex items-center justify-center gap-1.5">
                  <ColorBadge label={app.name} bg={c.bg} fg={c.text} />
                  <SortIcon active={sortField === appField} dir={sortDir} />
                </div>
              </th>
            );
          })}
          <th className="ta-th p-3 text-primary min-w-[80px] border-l border-border cursor-pointer" onClick={() => onSort('total')}>
            الإجمالي <SortIcon active={sortField === 'total'} dir={sortDir} />
          </th>
          <th className="ta-th p-3 min-w-[80px]">متوسط يومي</th>
          <th className="ta-th p-3 min-w-[80px]">المستوى</th>
        </tr>
      </thead>
      <tbody>
        {loading ? (
          Array.from({ length: 5 }, (_, i) => ({ id: `skeleton-row-${i}` }))
            .map((row) => (
              <tr key={row.id} className="border-b border-border/30">
                {Array.from({ length: apps.length + 5 }, (_, j) => ({ id: `skeleton-cell-${row.id}-${j}` }))
                  .map((cell) => (
                    <td key={cell.id} className="p-3">
                      <div className="h-4 bg-muted rounded animate-pulse" />
                    </td>
                  ))}
              </tr>
            ))
        ) : sortedEmployees.map((emp, idx) => {
          const total = empTotal(emp.id);
          const avg = total > 0 ? Math.round(total / days) : 0;
          return (
            <tr key={emp.id} className={`border-b border-border/30 hover:bg-muted/20 ${idx % 2 === 1 ? 'bg-muted/5' : ''}`}>
              <td className="ta-td p-3 text-muted-foreground font-medium">{idx + 1}</td>
              <td className="p-3">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-foreground whitespace-nowrap" title={emp.name}>
                    {shortName(emp.name)}
                  </span>
                </div>
              </td>
              {apps.map((app) => {
                const appTotal = dayArr.reduce((s, d) => s + (data[`${emp.id}::${app.id}::${d}`] ?? 0), 0);
                return (
                  <td key={app.id} className="ta-td p-3 font-semibold border-l border-border/30 text-foreground">
                    {appTotal > 0 ? appTotal : <span className="text-muted-foreground/30">—</span>}
                  </td>
                );
              })}
              <td className="ta-td p-3 font-bold text-foreground border-l border-border">{Math.max(total, 0)}</td>
              <td className="ta-td p-3 text-foreground">{avg}</td>
              <td className="ta-td p-3">
                {(() => {
                  const level = getPerformanceLevel(avg);
                  return level.bg ? (
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${level.color} ${level.bg}`}>
                      {level.label}
                    </span>
                  ) : (
                    <span className="text-muted-foreground/30">—</span>
                  );
                })()}
              </td>
            </tr>
          );
        })}
      </tbody>
      {!loading && employeesCount > 0 && (
        <tfoot>
          <tr className="bg-muted/40 font-semibold border-t-2 border-border">
            <td colSpan={2} className="p-3">
              <span className="text-sm font-bold text-foreground">الإجمالي</span>
            </td>
            {apps.map((app) => {
              const total = appGrandTotal(app.id);
              return (
                <td key={app.id} className="ta-td p-3 font-bold border-l border-border/40 text-foreground">
                  {total > 0 ? total : '—'}
                </td>
              );
            })}
            <td className="ta-td p-3 font-bold text-foreground border-l border-border">{grandTotal}</td>
            <td />
            <td />
          </tr>
        </tfoot>
      )}
    </table>
  );
});

OrdersSummaryTable.displayName = 'OrdersSummaryTable';
