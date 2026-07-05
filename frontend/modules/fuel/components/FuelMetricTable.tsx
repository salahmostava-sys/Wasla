import { useState } from 'react';
import type { DailyRow, Employee } from '@modules/fuel/types/fuel.types';

type Metric = 'km' | 'fuel';

type Props = Readonly<{
  metric: Metric;
  employees: Employee[];
  dailyRows: DailyRow[];
  year: number;
  month: number;
  search: string;
  canEdit: boolean;
  onSaveCell: (employeeId: string, date: string, metric: Metric, value: number) => Promise<void>;
}>;

const METRIC_UNIT: Record<Metric, string> = { km: 'كم', fuel: 'ر.س' };

function EditableCell({
  value,
  disabled,
  onSave,
}: Readonly<{ value: number; disabled: boolean; onSave: (v: number) => Promise<void> }>) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value || ''));
  const [saving, setSaving] = useState(false);

  if (!editing) {
    return (
      <button
        type="button"
        disabled={disabled}
        className="w-full h-full min-h-[28px] text-center font-mono hover:bg-primary/5 rounded disabled:cursor-default"
        onClick={() => { setDraft(String(value || '')); setEditing(true); }}
      >
        {value > 0 ? <span className="font-medium">{value}</span> : <span className="text-muted-foreground/30">·</span>}
      </button>
    );
  }

  const commit = async () => {
    const parsed = Number.parseFloat(draft);
    setSaving(true);
    try {
      await onSave(Number.isNaN(parsed) || parsed < 0 ? 0 : parsed);
    } finally {
      setSaving(false);
      setEditing(false);
    }
  };

  return (
    <input
      autoFocus
      type="number"
      min={0}
      step="0.01"
      className="w-full min-w-[50px] text-center font-mono bg-background border border-primary/40 rounded text-[11px] py-0.5"
      value={draft}
      disabled={saving}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        if (e.key === 'Escape') setEditing(false);
      }}
    />
  );
}

/** Single-metric (fuel-only or km-only) editable monthly spreadsheet, per employee/day. */
export function FuelMetricTable({ metric, employees, dailyRows, year, month, search, canEdit, onSaveCell }: Props) {
  const daysInMonth = new Date(year, month, 0).getDate();
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  const byEmpDay: Record<string, Record<number, number>> = {};
  dailyRows.forEach((r) => {
    const d = new Date(`${r.date}T12:00:00`).getDate();
    if (!byEmpDay[r.employee_id]) byEmpDay[r.employee_id] = {};
    byEmpDay[r.employee_id][d] = (byEmpDay[r.employee_id][d] || 0) + (metric === 'km' ? r.km_total : r.fuel_cost);
  });

  const q = search.trim().toLowerCase();
  const rows = q ? employees.filter((e) => e.name.toLowerCase().includes(q)) : employees;
  const sorted = [...rows].sort((a, b) => a.name.localeCompare(b.name, 'ar'));

  if (sorted.length === 0) {
    return <div className="text-center py-16 text-muted-foreground text-sm">لا يوجد مناديب لعرضهم</div>;
  }

  return (
    <div className="overflow-x-auto relative scrollbar-thin pb-4">
      <table className="w-full text-[11px] border-collapse" style={{ minWidth: `${daysInMonth * 50 + 220}px` }}>
        <thead className="sticky top-0 z-30">
          <tr className="bg-muted border-b-2 border-border/60">
            <th className="ta-th text-start font-medium sticky right-0 bg-muted z-30 min-w-[150px] border-l-2 border-border/50">
              المندوب
            </th>
            {days.map((d) => (
              <th key={d} className="ta-th px-1 py-1.5 font-medium text-center border-l border-border/20 min-w-[45px]">
                {d}
              </th>
            ))}
            <th className="ta-th px-1 py-1.5 font-bold text-center bg-primary/5 min-w-[60px] text-primary">
              الإجمالي ({METRIC_UNIT[metric]})
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/30">
          {sorted.map((emp, idx) => {
            const total = days.reduce((sum, d) => sum + (byEmpDay[emp.id]?.[d] || 0), 0);
            return (
              <tr key={emp.id} className={`hover:bg-muted/30 transition-colors ${idx % 2 === 1 ? 'bg-muted/10' : ''}`}>
                <td className={`ta-td font-semibold sticky right-0 border-l-2 border-border/50 z-10 whitespace-nowrap ${idx % 2 === 1 ? 'bg-muted/10 backdrop-blur-sm' : 'bg-card'}`}>
                  {emp.name}
                </td>
                {days.map((d) => {
                  const value = byEmpDay[emp.id]?.[d] || 0;
                  const date = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                  return (
                    <td key={d} className="ta-td text-center border-l border-border/20 p-0.5">
                      <EditableCell
                        value={value}
                        disabled={!canEdit}
                        onSave={(v) => onSaveCell(emp.id, date, metric, v)}
                      />
                    </td>
                  );
                })}
                <td className="ta-td text-center font-mono font-bold bg-primary/5 text-primary">
                  {total.toLocaleString('en-US')}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
