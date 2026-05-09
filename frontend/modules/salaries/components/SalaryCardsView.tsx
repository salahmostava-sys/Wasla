import type React from 'react';
import { Button } from '@shared/components/ui/button';
import { CheckCircle, Printer } from 'lucide-react';
import { statusLabels, statusStyles, SALARY_CARD_SKELETON_KEYS } from '@modules/salaries/lib/salaryConstants';
import type { SalaryRow } from '@modules/salaries/types/salary.types';

interface SalaryCardsViewProps {
  loadingData: boolean;
  filtered: SalaryRow[];
  computeRow: (r: SalaryRow) => { totalPlatformSalary: number; totalAdditions: number; totalWithSalary: number; totalDeductions: number; netSalary: number; remaining: number };
  approveRow: (id: string) => void;
  approvingRowId: string | null;
  markAsPaid: (row: SalaryRow) => void;
  markingPaid: string | null;
  setPayslipRow: React.Dispatch<React.SetStateAction<SalaryRow | null>>;
  /** FIX #6: gate approve/pay actions behind permission */
  canEdit: boolean;
}

export function SalaryCardsView(props: Readonly<SalaryCardsViewProps>) {
  const { loadingData, filtered, computeRow, approveRow, approvingRowId, markAsPaid, markingPaid, setPayslipRow, canEdit } = props;

  return (
    <div>
      {loadingData && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {SALARY_CARD_SKELETON_KEYS.map((skeletonKey) => (
            <div key={skeletonKey} className="bg-card border border-border/50 rounded-xl p-4 space-y-2 animate-pulse">
              <div className="h-4 bg-muted rounded w-3/4" />
              <div className="h-3 bg-muted rounded w-1/2" />
              <div className="h-8 bg-muted rounded mt-3" />
            </div>
          ))}
        </div>
      )}
      {!loadingData && filtered.length === 0 && (
        <div className="h-48 flex items-center justify-center text-muted-foreground rounded-xl border border-border/50">
          لا يوجد موظفون لهذا الشهر
        </div>
      )}
      {!loadingData && filtered.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {filtered.map(r => {
            const c = computeRow(r);
            const needsApproval = r.status === 'pending' || !!r.isDirty;
            return (
              <div key={r.id} className="bg-card border border-border/50 rounded-xl p-4 hover:shadow-md transition-shadow flex flex-col gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-bold flex-shrink-0">
                    {r.employeeName.slice(0, 1)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{r.employeeName}</p>
                    <p className="text-xs text-muted-foreground truncate">{r.jobTitle}</p>
                  </div>
                  <span className={statusStyles[r.status]}>{statusLabels[r.status]}</span>
                </div>
                {r.registeredApps.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {r.registeredApps.map(app => (
                      <span key={app} className="text-[10px] px-1.5 py-0.5 rounded-md font-medium bg-muted text-muted-foreground">
                        {app}: {r.platformOrders[app] || 0}
                      </span>
                    ))}
                  </div>
                )}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-muted/40 rounded-lg p-2">
                    <p className="text-muted-foreground">الراتب الأساسي</p>
                    <p className="font-bold text-primary">{c.totalPlatformSalary.toLocaleString('en-US')} ر.س</p>
                  </div>
                  <div className="bg-muted/40 rounded-lg p-2">
                    <p className="text-muted-foreground">المستقطعات</p>
                    <p className="font-bold text-destructive">{c.totalDeductions > 0 ? `-${c.totalDeductions.toLocaleString('en-US')}` : '—'} {c.totalDeductions > 0 ? 'ر.س' : ''}</p>
                  </div>
                </div>
                {r.advanceDeduction > 0 && (
                  <div className="text-[10px] bg-warning/10 rounded px-2 py-1 text-warning border border-warning/30">
                    💳 قسط سلفة: <span className="font-bold">{r.advanceDeduction.toLocaleString('en-US')} ر.س</span>
                  </div>
                )}
                <div className="flex items-center justify-between bg-success/10 rounded-lg px-3 py-2 mt-auto">
                  <span className="text-xs text-muted-foreground">الصافي</span>
                  <span className="text-base font-black text-success">{c.netSalary.toLocaleString('en-US')} ر.س</span>
                </div>
                <div className="flex gap-2">
                  {needsApproval && canEdit && (
                    <Button size="sm" variant="outline" className="flex-1 h-7 text-xs gap-1 text-success border-success/30 hover:bg-success/10" onClick={() => approveRow(r.id)} disabled={approvingRowId === r.id}>
                      {approvingRowId === r.id ? '...' : <><CheckCircle size={11} /> اعتماد</>}
                    </Button>
                  )}
                  {r.status === 'approved' && !r.isDirty && canEdit && (
                    <Button size="sm" variant="outline" className="flex-1 h-7 text-xs gap-1 text-primary border-primary/30 hover:bg-primary/10"
                      onClick={() => markAsPaid(r)} disabled={markingPaid === r.id}>
                      {markingPaid === r.id ? '...' : '✅ تم الصرف'}
                    </Button>
                  )}
                  <Button size="sm" variant="outline" className="flex-1 h-7 text-xs gap-1" onClick={() => setPayslipRow(r)}>
                    <Printer size={11} /> كشف راتب
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
