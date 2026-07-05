import type React from 'react';
import { Loader2, TrendingUp } from 'lucide-react';
import { getAppColor, type AppColorData } from '@shared/hooks/useAppColors';
import type { App } from '@modules/orders/types';

type Props = Readonly<{
  loading: boolean;
  apps: App[];
  appColorsList: AppColorData[];
  employeesCount: number;
  grandTotal: number;
  targets: Record<string, string>;
  setTargets: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  appGrandTotal: (appId: string) => number;
  saveTarget: (appId: string, value: string) => void | Promise<void>;
  savingTarget: string | null;
  canEdit: boolean;
  isMonthLocked: boolean;
}>;

export function MonthSummaryStats(props: Readonly<Props>) {
  const {
    loading,
    apps,
    appColorsList,
    employeesCount,
    grandTotal,
    targets,
    setTargets,
    appGrandTotal,
    saveTarget,
    savingTarget,
    canEdit,
    isMonthLocked,
  } = props;

  if (loading || apps.length === 0) return null;

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        <div className="bg-card border border-primary/30 px-3 py-2 flex items-center gap-3 rounded-2xl">
          <TrendingUp size={14} className="text-primary shrink-0" />
          <div>
            <p className="text-sm font-bold text-foreground leading-tight">{grandTotal.toLocaleString('en-US')} <span className="text-xs font-normal text-muted-foreground">طلب</span></p>
            <p className="text-[10px] text-muted-foreground">{employeesCount} مندوب</p>
          </div>
        </div>

        {apps.map((app) => {
          const c = getAppColor(appColorsList, app.name);
          const total = appGrandTotal(app.id);
          const targetVal = Number.parseInt(targets[app.id] || '0', 10) || 0;
          const overTarget = targetVal > 0 && total >= targetVal;
          const isSaving = savingTarget === app.id;

          return (
            <div
              key={app.id}
              className="bg-card border border-border/50 px-3 py-2 flex items-center gap-3 hover:border-border transition-colors rounded-2xl"
            >
              <span
                className="text-[10px] px-2 py-0.5 rounded-full font-bold shrink-0"
                style={{ backgroundColor: c.bg, color: c.text }}
              >
                {app.name}
              </span>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold" style={{ color: c.solid }}>{total.toLocaleString('en-US')}</span>
                {targetVal > 0 && (
                  <span className="text-[10px] text-muted-foreground">/ {targetVal.toLocaleString('en-US')}</span>
                )}
                {overTarget && <span className="text-[9px] text-success font-bold">✓</span>}
              </div>
              <div className="flex items-center gap-1">
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="هدف"
                  value={targets[app.id] ?? ''}
                  onChange={(e) => {
                    const val = e.target.value.replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString()).replace(/\D/g, '');
                    setTargets((prev) => ({ ...prev, [app.id]: val }));
                  }}
                  onBlur={(e) => { saveTarget(app.id, e.target.value); }}
                  onKeyDown={(e) => { if (e.key === 'Enter') { saveTarget(app.id, targets[app.id] || '0'); } }}
                  disabled={!canEdit || isMonthLocked}
                  className="w-16 h-6 text-[10px] rounded border border-border bg-muted/30 px-1 focus:outline-none focus:border-primary text-center"
                />
                {isSaving && <Loader2 size={10} className="animate-spin text-muted-foreground" />}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
