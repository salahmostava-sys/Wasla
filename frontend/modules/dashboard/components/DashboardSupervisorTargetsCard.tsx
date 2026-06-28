import type { SupervisorPerformanceRow } from '@services/dashboardService';

type Props = {
  loading: boolean;
  rows: SupervisorPerformanceRow[];
};

const pctClass = (pct: number) => {
  if (pct >= 100) return 'text-emerald-600';
  if (pct >= 90) return 'text-amber-600';
  return 'text-rose-600';
};

export function DashboardSupervisorTargetsCard({ loading, rows }: Readonly<Props>) {
  const totalTarget = rows.reduce((s, r) => s + r.target_orders, 0);
  const totalActual = rows.reduce((s, r) => s + r.actual_orders, 0);
  const totalPct = totalTarget > 0 ? Math.round((totalActual / totalTarget) * 100) : 0;

  return (
    <div className="bg-card -2xl shadow-card overflow-hidden rounded-2xl">
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <div>
          <h3 className="text-sm font-bold text-foreground">أداء تارجت المشرفين</h3>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            الإجمالي: {totalActual.toLocaleString('en-US')} / {totalTarget.toLocaleString('en-US')} ({totalPct}%)
          </p>
        </div>
      </div>
      <div className="p-4">
        {loading && (
          <div className="space-y-2">
            {['r1', 'r2', 'r3'].map((k) => (
              <div key={k} className="h-10 rounded-lg bg-muted/40 animate-pulse" />
            ))}
          </div>
        )}
        {!loading && rows.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">
            لا توجد تارجتات مشرفين لهذا الشهر بعد.
          </p>
        )}
        {!loading && rows.length > 0 && (
          <div className="overflow-x-auto w-full">
            <table className="w-full text-sm min-w-[560px]" dir="rtl">
              <thead className="bg-muted/40">
                <tr>
                  <th className="ta-th text-right">المشرف</th>
                  <th className="ta-th text-right">التارجت</th>
                  <th className="ta-th text-right">الفعلي</th>
                  <th className="ta-th text-right">الفرق</th>
                  <th className="ta-th text-right">نسبة الإنجاز</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const gap = r.actual_orders - r.target_orders;
                  return (
                    <tr key={r.supervisor_id} className="border-b border-border/40">
                      <td className="ta-td font-semibold text-foreground">{r.supervisor_name}</td>
                      <td className="ta-td">{r.target_orders.toLocaleString('en-US')}</td>
                      <td className="ta-td">{r.actual_orders.toLocaleString('en-US')}</td>
                      <td className={`px-3 py-2 font-semibold ${gap >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {gap >= 0 ? '+' : ''}{gap.toLocaleString('en-US')}
                      </td>
                      <td className={`px-3 py-2 font-bold ${pctClass(r.achievement_percent)}`}>
                        {r.achievement_percent.toFixed(1)}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
