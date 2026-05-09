import React, { type RefObject } from 'react';
import { Edit2, Trash2 } from 'lucide-react';
import { Input } from '@shared/components/ui/input';
import { Button } from '@shared/components/ui/button';
import type { FilterState } from '@shared/hooks/useAdvancedFilter';
import type { Advance, EmployeeSummary } from '@modules/advances/types/advance.types';

const SortIcon = ({ field, sortField, sortDir }: Readonly<{ field: string; sortField: string | null; sortDir: 'asc' | 'desc' }>) => {
  if (sortField !== field) return <span className="text-muted-foreground/40 text-[10px] ms-0.5">⇅</span>;
  return <span className="text-[10px] ms-0.5">{sortDir === 'asc' ? '↑' : '↓'}</span>;
};

export interface AdvanceTableProps {
  loading: boolean;
  filtered: EmployeeSummary[];
  grandTotals: { count: number; totalDebt: number; totalPaid: number; remaining: number };
  permissions: { can_edit: boolean };
  sortField: string | null;
  sortDir: 'asc' | 'desc';
  handleSort: (field: string) => void;
  tableRef: RefObject<HTMLTableElement | null>;
  filters: FilterState;
  setFilter: (key: string, values: string[]) => void;
  resetFilters: () => void;
  activeCount: number;
  setTransactionsEmployee: (v: {
    id: string;
    name: string;
    nationalId: string;
    totalDebt: number;
    totalPaid: number;
    remaining: number;
    isWrittenOff?: boolean;
    allAdvances: Advance[];
  } | null) => void;
  setDeleteEmployeeAdvancesId: (id: string | null) => void;
}

export const AdvanceTable = ({
  loading,
  filtered,
  grandTotals,
  permissions,
  sortField,
  sortDir,
  handleSort,
  tableRef,
  filters,
  setFilter,
  resetFilters,
  activeCount,
  setTransactionsEmployee,
  setDeleteEmployeeAdvancesId,
}: Readonly<AdvanceTableProps>) => {
  if (loading) {
    return <div className="bg-card rounded-xl border border-border/50 p-8 text-center text-muted-foreground animate-pulse">جارٍ التحميل...</div>;
  }
  if (filtered.length === 0) {
    return <div className="text-center py-16 text-muted-foreground bg-card rounded-xl border border-border/50">لا توجد سلف مطابقة</div>;
  }
  const colCount = permissions.can_edit ? 7 : 6;
  const dr = filters.date_range ?? ['', ''];
  return (
    <div className="bg-card rounded-xl shadow-card overflow-hidden">
      <div className="overflow-x-auto">
        <table ref={tableRef} className="w-full text-sm">
          <thead>
            <tr className="bg-muted/50 border-b border-border/60">
              <th className="px-3 py-3 text-center text-xs font-semibold text-muted-foreground w-12">#</th>
              <th className="px-3 py-3 text-center text-xs font-semibold text-muted-foreground cursor-pointer hover:text-foreground select-none" onClick={() => handleSort('employeeName')}>
                اسم المندوب <SortIcon field="employeeName" sortField={sortField} sortDir={sortDir} />
              </th>
              <th className="px-3 py-3 text-center text-xs font-semibold text-muted-foreground cursor-pointer hover:text-foreground select-none" onClick={() => handleSort('nationalId')}>
                رقم الإقامة <SortIcon field="nationalId" sortField={sortField} sortDir={sortDir} />
              </th>
              <th className="px-3 py-3 text-center text-xs font-semibold text-info cursor-pointer hover:text-foreground select-none" onClick={() => handleSort('totalDebt')}>
                المديونية <SortIcon field="totalDebt" sortField={sortField} sortDir={sortDir} />
              </th>
              <th className="px-3 py-3 text-center text-xs font-semibold text-success cursor-pointer hover:text-foreground select-none" onClick={() => handleSort('totalPaid')}>
                المسدّد <SortIcon field="totalPaid" sortField={sortField} sortDir={sortDir} />
              </th>
              <th className="px-3 py-3 text-center text-xs font-semibold text-destructive cursor-pointer hover:text-foreground select-none" onClick={() => handleSort('remaining')}>
                المتبقي <SortIcon field="remaining" sortField={sortField} sortDir={sortDir} />
              </th>
              {permissions.can_edit && <th className="w-20 px-2 py-3 text-center text-xs font-semibold text-muted-foreground">إجراء</th>}
            </tr>
            <tr className="no-print-table-export bg-muted/25 border-b border-border/50">
              <td colSpan={colCount} className="px-3 py-2.5">
                <div className="flex flex-wrap items-center gap-3 justify-end">
                  <span className="text-xs text-muted-foreground font-medium">فلتر تاريخ الصرف (آخر صرف للمندوب):</span>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[11px] text-muted-foreground shrink-0">من</span>
                    <Input
                      type="date"
                      className="h-8 w-[148px] text-xs"
                      dir="ltr"
                      value={dr[0] || ''}
                      onChange={e => setFilter('date_range', [e.target.value, dr[1] || ''])}
                      aria-label="من تاريخ الصرف"
                    />
                    <span className="text-[11px] text-muted-foreground shrink-0">إلى</span>
                    <Input
                      type="date"
                      className="h-8 w-[148px] text-xs"
                      dir="ltr"
                      value={dr[1] || ''}
                      onChange={e => setFilter('date_range', [dr[0] || '', e.target.value])}
                      aria-label="إلى تاريخ الصرف"
                    />
                    {activeCount > 0 && (
                      <Button type="button" variant="ghost" size="sm" className="h-8 text-xs" onClick={resetFilters}>
                        مسح الفلتر
                      </Button>
                    )}
                  </div>
                </div>
              </td>
            </tr>
          </thead>
          <tbody>
            {filtered.map((s, idx) => (
              <React.Fragment key={s.employeeId}>
                <tr className={`border-b border-border/30 hover:bg-muted/20 transition-colors cursor-pointer ${s.isWrittenOff ? 'opacity-60' : ''}`}
                  onClick={() => setTransactionsEmployee({ id: s.employeeId, name: s.employeeName, nationalId: s.nationalId, totalDebt: s.totalDebt, totalPaid: s.totalPaid, remaining: s.remaining, isWrittenOff: s.isWrittenOff, allAdvances: s.allAdvances })}>
                  <td className="px-3 py-3 text-center text-xs text-muted-foreground font-mono">{idx + 1}</td>
                  <td className="px-3 py-3 text-center">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-primary text-sm">{s.employeeName}</span>
                      {s.isWrittenOff && <span className="text-[10px] bg-destructive/10 text-destructive px-1.5 py-0.5 rounded-full font-semibold">معدوم</span>}
                    </div>
                  </td>
                  <td className="px-3 py-3 text-center text-sm font-mono text-foreground" dir="ltr">{s.nationalId}</td>
                  <td className="px-3 py-3 text-center">
                    <span className="font-bold text-info text-sm">{s.totalDebt.toLocaleString('en-US')}</span>
                    <span className="text-[10px] text-muted-foreground ms-0.5">ر.س</span>
                  </td>
                  <td className="px-3 py-3 text-center">
                    <span className="font-bold text-success text-sm">{s.totalPaid.toLocaleString('en-US')}</span>
                    <span className="text-[10px] text-muted-foreground ms-0.5">ر.س</span>
                  </td>
                  <td className="px-3 py-3 text-center">
                    <span className={`font-bold text-sm ${s.remaining > 0 ? 'text-destructive' : 'text-success'}`}>{s.remaining.toLocaleString('en-US')}</span>
                    <span className="text-[10px] text-muted-foreground ms-0.5">ر.س</span>
                  </td>
                  {permissions.can_edit && (
                    <td className="px-2 py-3 text-center" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => setTransactionsEmployee({ id: s.employeeId, name: s.employeeName, nationalId: s.nationalId, totalDebt: s.totalDebt, totalPaid: s.totalPaid, remaining: s.remaining, isWrittenOff: s.isWrittenOff, allAdvances: s.allAdvances })}
                          className="p-1.5 rounded hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors"
                          title="عرض وتعديل السلف"
                        >
                          <Edit2 size={13} />
                        </button>
                        <button
                          onClick={() => setDeleteEmployeeAdvancesId(s.employeeId)}
                          className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                          title="حذف جميع سلف هذا المندوب"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              </React.Fragment>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-muted/70 border-t-2 border-border/60">
              <td colSpan={2} className="px-3 py-3 text-center text-xs font-bold text-muted-foreground">
                الإجمالي ({grandTotals.count} مندوب)
              </td>
              <td className="px-3 py-3 text-center text-xs text-muted-foreground">—</td>
              <td className="px-3 py-3 text-center">
                <span className="font-bold text-info text-sm">{grandTotals.totalDebt.toLocaleString('en-US')}</span>
                <span className="text-[10px] text-muted-foreground ms-0.5">ر.س</span>
              </td>
              <td className="px-3 py-3 text-center">
                <span className="font-bold text-success text-sm">{grandTotals.totalPaid.toLocaleString('en-US')}</span>
                <span className="text-[10px] text-muted-foreground ms-0.5">ر.س</span>
              </td>
              <td className="px-3 py-3 text-center">
                <span className="font-bold text-destructive text-sm">{grandTotals.remaining.toLocaleString('en-US')}</span>
                <span className="text-[10px] text-muted-foreground ms-0.5">ر.س</span>
              </td>
              {permissions.can_edit && <td />}
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
};
