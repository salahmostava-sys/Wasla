/**
 * SalaryTable — Virtualized salary table.
 *
 * Uses @tanstack/react-virtual to render only visible rows (~15-20 at a time),
 * instead of all rows at once. This reduces DOM nodes from 1200+ to ~150-200.
 *
 * ── What stays the same ──────────────────────────────────────────────────────
 * - Sticky columns (رقم, اسم, مسمى, هوية) — implemented via CSS position:sticky
 * - Totals footer row — rendered outside the virtual list, always visible
 * - All cell editing, approve, mark-paid, payslip actions
 * - PDF/print export — reads from `filtered` array directly (not DOM)
 * - Sorting, filtering — unchanged (handled by parent)
 *
 * ── What changes ─────────────────────────────────────────────────────────────
 * - tbody uses a fixed total height with absolutely positioned rows
 * - Only rows within the scroll viewport are in the DOM
 * - Ctrl+F browser search won't find off-screen rows (acceptable trade-off)
 */
import type React from 'react';
import { useMemo, useRef, memo, useCallback } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Button } from '@shared/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@shared/components/ui/tooltip';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@shared/components/ui/select';
import { CheckCircle, Printer, AlertTriangle, Loader2, Undo } from 'lucide-react';
import type { CustomColumn } from '@shared/hooks/useAppColors';
import { SalarySortIcon } from '@modules/salaries/components/SalarySortIcon';
import {
  EditableCell,
  PlatformOrderCell,
  CustomDeductionCell,
} from '@modules/salaries/components/SalaryTableCells';
import { OrderDetailsModal } from '@modules/salaries/components/OrderDetailsModal';
import { shortEmployeeName } from '@modules/salaries/lib/salaryConstants';
import type { SalaryRow, SchemeData, SortDir } from '@modules/salaries/types/salary.types';
import { getSalaryRowActivityTotals, hasPlatformActivity } from '@modules/salaries/model/salaryUtils';
import { Skeleton } from '@shared/components/ui/skeleton';

// ── Style constants ───────────────────────────────────────────────────────────
const thFrozenBase = "px-3 py-2 text-xs font-semibold text-muted-foreground whitespace-nowrap border border-border/40 bg-card text-start sticky z-20";
const thBase = "px-3 py-2 text-xs font-semibold text-muted-foreground whitespace-nowrap border border-border/40 bg-card text-center";
const tdClass = "px-3 py-2 text-[13px] font-medium whitespace-nowrap text-center border border-border/40 text-foreground";
const tfClass = "px-3 py-2 text-[13px] font-bold whitespace-nowrap text-center border border-border/40 bg-muted/60 text-foreground";
const stickyLeft = (offset: number) => ({ left: offset });

/** Height of each row in pixels — must be fixed for virtual list to work correctly */
const ROW_HEIGHT = 48;

// ── Props ─────────────────────────────────────────────────────────────────────
interface SalaryTableProps {
  loadingData: boolean;
  rows: SalaryRow[];
  filtered: SalaryRow[];
  computeRow: (r: SalaryRow) => { totalPlatformSalary: number; totalAdditions: number; totalWithSalary: number; totalDeductions: number; netSalary: number; remaining: number };
  platforms: string[];
  platformColors: Record<string, { header: string; headerText: string; cellBg: string; valueColor: string; focusBorder: string }>;
  appCustomColumns: Record<string, CustomColumn[]>;
  empPlatformScheme: Record<string, Record<string, SchemeData | null>>;
  sortField: string | null;
  sortDir: SortDir;
  handleSort: (field: string) => void;
  updateRow: (id: string, patch: Partial<SalaryRow>) => void;
  updatePlatformOrders: (id: string, platform: string, value: number) => void;
  approveRow: (id: string) => void;
  unapproveRow: (id: string) => void;
  approvingRowId: string | null;
  markAsPaid: (row: SalaryRow) => void;
  markingPaid: string | null;
  editingCell: { rowId: string; platform: string } | null;
  setEditingCell: React.Dispatch<React.SetStateAction<{ rowId: string; platform: string } | null>>;
  setPayslipRow: React.Dispatch<React.SetStateAction<SalaryRow | null>>;
  persistEmployeeCity: (row: SalaryRow, nextCity: 'makkah' | 'jeddah') => void;
  persistEmployeePaymentMethod: (row: SalaryRow, next: 'bank' | 'cash') => void;
  employeeFieldSaving: string | null;
  openEmployeeDetail: (row: SalaryRow) => void;
  /** FIX #6: gate approve/pay actions behind permission */
  canEdit: boolean;
}

// ── Row renderer — memoized to prevent re-renders on scroll ──────────────────
// Wrapped in React.memo so a row only re-renders when its own data changes,
// not when a sibling row scrolls into/out of view.
const SalaryRowCells = memo(function SalaryRowCells({
  r,
  rowIdx,
  c,
  platforms,
  platformColors,
  appCustomColumns: _appCustomColumns,
  allCustomCols,
  empPlatformScheme,
  editingCell,
  setEditingCell,
  updateRow,
  updatePlatformOrders,
  approveRow,
  unapproveRow,
  approvingRowId,
  markAsPaid,
  markingPaid,
  setPayslipRow,
  persistEmployeeCity,
  persistEmployeePaymentMethod,
  employeeFieldSaving,
  openEmployeeDetail,
  canEdit,
}: {
  r: SalaryRow;
  rowIdx: number;
  c: ReturnType<SalaryTableProps['computeRow']>;
  platforms: string[];
  platformColors: SalaryTableProps['platformColors'];
  appCustomColumns: SalaryTableProps['appCustomColumns'];
  allCustomCols: { appName: string; key: string; label: string; fullKey: string }[];
  empPlatformScheme: SalaryTableProps['empPlatformScheme'];
  editingCell: SalaryTableProps['editingCell'];
  setEditingCell: SalaryTableProps['setEditingCell'];
  updateRow: SalaryTableProps['updateRow'];
  updatePlatformOrders: SalaryTableProps['updatePlatformOrders'];
  approveRow: SalaryTableProps['approveRow'];
  unapproveRow: SalaryTableProps['unapproveRow'];
  approvingRowId: SalaryTableProps['approvingRowId'];
  markAsPaid: SalaryTableProps['markAsPaid'];
  markingPaid: SalaryTableProps['markingPaid'];
  setPayslipRow: SalaryTableProps['setPayslipRow'];
  persistEmployeeCity: SalaryTableProps['persistEmployeeCity'];
  persistEmployeePaymentMethod: SalaryTableProps['persistEmployeePaymentMethod'];
  employeeFieldSaving: SalaryTableProps['employeeFieldSaving'];
  openEmployeeDetail: SalaryTableProps['openEmployeeDetail'];
  canEdit: boolean;
}) {
  const canEditManualBaseSalary = !Object.values(r.platformMetrics || {}).some((metric) => hasPlatformActivity(metric));
  const needsApproval = r.status === 'pending' || !!r.isDirty;

  return (
    <>
      <td className={`${tdClass} sticky text-center text-muted-foreground font-mono`} style={{ left: 0, zIndex: 10, background: 'hsl(var(--card))' }}>{rowIdx + 1}</td>
      <td className={`${tdClass} sticky font-medium whitespace-nowrap`} style={{ left: 40, zIndex: 10, background: 'hsl(var(--card))' }}>
        <div className="flex items-center gap-1.5">
          <button className="whitespace-nowrap text-primary hover:underline font-medium text-start" onClick={() => openEmployeeDetail(r)}>
            {shortEmployeeName(r.employeeName)}
          </button>
          {r.isDirty && (
            <TooltipProvider delayDuration={120}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-warning/20 text-warning border border-warning/40 cursor-help">
                    <AlertTriangle size={11} />
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top">يحتاج إعادة الاعتماد</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      </td>
      <td className={`${tdClass} whitespace-nowrap`} style={{ position: 'sticky', left: 168, zIndex: 10, background: 'hsl(var(--card))' }}>{r.jobTitle}</td>
      <td className={`${tdClass} border-l border-border/40 text-muted-foreground whitespace-nowrap`} style={{ position: 'sticky', left: 264, zIndex: 10, background: 'hsl(var(--card))' }}>{r.nationalId}</td>
      <td className="ta-td border border-border/40 bg-info/5">
        <EditableCell value={r.platformIncome} onChange={v => updateRow(r.id, { platformIncome: v })} className="text-foreground" />
      </td>
      <td className="ta-td border border-border/40 bg-info/5">
        {r.workDays > 0 ? <span className="font-semibold text-foreground">{r.workDays}</span> : <span className="text-muted-foreground/30">—</span>}
      </td>
      <td className="ta-td border border-border/40 bg-info/5">
        {r.fuelCost > 0 ? <span className="font-semibold text-foreground">{r.fuelCost.toLocaleString('en-US')}</span> : <span className="text-muted-foreground/30">—</span>}
      </td>
      {platforms.map(p => {
        const pc = platformColors[p];
        const salary = r.platformSalaries[p] || 0;
        const scheme = empPlatformScheme?.[r.employeeId]?.[p];
        return (
          <PlatformOrderCell
            key={`${p}-col`}
            rowId={r.id}
            platformName={p}
            tdClass={tdClass}
            pc={pc}
            metric={r.platformMetrics[p]}
            salary={salary}
            scheme={scheme}
            editingCell={editingCell}
            setEditingCell={setEditingCell}
            updatePlatformOrders={updatePlatformOrders}
          />
        );
      })}
      <td className={`${tdClass} text-center font-bold text-foreground border-l border-border/20 bg-primary/[0.04]`}>
        {(() => {
          const totalOrders = Object.values(r.platformOrders).reduce((s, v) => s + v, 0);
          const totalSalary = Object.values(r.platformSalaries).reduce((s, v) => s + v, 0);
          return totalOrders > 0 || totalSalary > 0
            ? <OrderDetailsModal row={r} empPlatformScheme={empPlatformScheme} />
            : <span className="text-muted-foreground/30">—</span>;
        })()}
      </td>
      <td className={`${tdClass} font-bold text-foreground border-l border-border/20 bg-primary/[0.06]`}>
        {canEditManualBaseSalary
          ? <EditableCell value={Number(r.engineBaseSalary || 0)} onChange={(value) => updateRow(r.id, { engineBaseSalary: value })} className="text-foreground" />
          : c.totalPlatformSalary.toLocaleString('en-US')}
      </td>
      <td className={`${tdClass} bg-success/[0.04] border-l border-border/40`}><EditableCell value={r.incentives} onChange={v => updateRow(r.id, { incentives: v })} className="text-foreground" /></td>
      <td className={`${tdClass} bg-success/[0.04]`}><EditableCell value={r.sickAllowance} onChange={v => updateRow(r.id, { sickAllowance: v })} className="text-foreground" /></td>
      <td className={`${tdClass} font-bold text-foreground border-l border-border/40 bg-success/[0.06]`}>{c.totalWithSalary.toLocaleString('en-US')}</td>
      <td className={`${tdClass} border-l border-border/40 bg-destructive/[0.04]`}>
        <EditableCell value={r.advanceDeduction} onChange={v => updateRow(r.id, { advanceDeduction: v })} className="text-foreground" />
      </td>
      <td className={tdClass}><EditableCell value={r.violations} onChange={v => updateRow(r.id, { violations: v })} className="text-foreground" /></td>
      {allCustomCols.map(col => (
        <CustomDeductionCell key={col.fullKey} row={r} fullKey={col.fullKey} tdClass={tdClass} updateRow={updateRow} />
      ))}
      <td className={`${tdClass} font-bold text-foreground border-l border-border/20 bg-destructive/[0.06]`}>
        {c.totalDeductions > 0 ? c.totalDeductions.toLocaleString('en-US') : <span className="text-muted-foreground/30">—</span>}
      </td>
      <td className={`${tdClass} font-black text-foreground text-base ${c.netSalary < 0 ? 'text-destructive' : ''}`}>{c.netSalary.toLocaleString('en-US')}</td>
      <td className={tdClass}>
        <EditableCell value={r.transfer} onChange={v => updateRow(r.id, { transfer: Math.max(0, Math.min(v, Math.max(0, c.netSalary))) })} />
      </td>
      <td className={`${tdClass} border-l border-border/20`}>{c.remaining.toLocaleString('en-US')}</td>
      <td className={`${tdClass} text-center align-middle`}>
        <Select
          value={r.cityKey ?? '_none'}
          onValueChange={(v) => { if (v !== '_none') { persistEmployeeCity(r, v as 'makkah' | 'jeddah'); } }}
          disabled={employeeFieldSaving === `${r.employeeId}:city`}
        >
          <SelectTrigger className="h-8 w-[104px] text-xs mx-auto" dir="rtl">
            {employeeFieldSaving === `${r.employeeId}:city`
              ? <span className="flex w-full justify-center"><Loader2 className="h-4 w-4 animate-spin" /></span>
              : <SelectValue placeholder="الفرع" />}
          </SelectTrigger>
          <SelectContent dir="rtl">
            <SelectItem value="_none" className="text-muted-foreground">—</SelectItem>
            <SelectItem value="makkah">مكة</SelectItem>
            <SelectItem value="jeddah">جدة</SelectItem>
          </SelectContent>
        </Select>
      </td>
      <td className={`${tdClass} border-l border-border/40 text-center align-middle`}>
        <Select
          value={r.paymentMethod}
          onValueChange={(v) => { persistEmployeePaymentMethod(r, v as 'bank' | 'cash'); }}
          disabled={employeeFieldSaving === `${r.employeeId}:payment`}
        >
          <SelectTrigger className="h-8 w-[100px] text-xs mx-auto" dir="rtl">
            {employeeFieldSaving === `${r.employeeId}:payment`
              ? <span className="flex w-full justify-center"><Loader2 className="h-4 w-4 animate-spin" /></span>
              : <SelectValue />}
          </SelectTrigger>
          <SelectContent dir="rtl">
            <SelectItem value="cash">💵 كاش</SelectItem>
            <SelectItem value="bank">🏦 بنك</SelectItem>
          </SelectContent>
        </Select>
      </td>
      <td className={`${tdClass} border-l border-border`}>
        <div className="flex items-center justify-center gap-1.5">
          {needsApproval && canEdit && (
            <Button size="sm" variant="outline" className="h-7 text-[11px] gap-1 text-success border-success/40 hover:bg-success/10" onClick={() => approveRow(r.id)} disabled={approvingRowId === r.id}>
              {approvingRowId === r.id ? <Loader2 size={11} className="animate-spin" /> : <><CheckCircle size={11} /> اعتماد</>}
            </Button>
          )}
          {r.status === 'approved' && !r.isDirty && canEdit && (
            <>
              <Button size="sm" variant="outline" className="h-7 text-[11px] gap-1 text-primary border-primary/40 hover:bg-primary/10" onClick={() => { markAsPaid(r); }} disabled={markingPaid === r.id || approvingRowId === r.id}>
                {markingPaid === r.id ? <Loader2 size={11} className="animate-spin" /> : <>✅ تم الصرف</>}
              </Button>
              <Button size="sm" variant="outline" className="h-7 text-[11px] gap-1 text-warning border-warning/40 hover:bg-warning/10 px-2" onClick={() => unapproveRow(r.id)} disabled={approvingRowId === r.id || markingPaid === r.id} title="إلغاء الاعتماد">
                {approvingRowId === r.id ? <Loader2 size={11} className="animate-spin" /> : <><Undo size={11} /> إلغاء الاعتماد</>}
              </Button>
            </>
          )}
          <Button size="sm" variant="outline" className="h-7 text-[11px] gap-1" onClick={() => setPayslipRow(r)}>
            <Printer size={11} /> كشف
          </Button>
        </div>
      </td>
    </>
  );
});

// ── Main component ────────────────────────────────────────────────────────────
export const SalaryTable = memo(function SalaryTable(props: Readonly<SalaryTableProps>) {
  const {
    loadingData, rows, filtered, computeRow, platforms, platformColors,
    appCustomColumns, empPlatformScheme, sortField, sortDir, handleSort,
    updateRow, updatePlatformOrders, approveRow, unapproveRow, approvingRowId,
    markAsPaid, markingPaid, editingCell, setEditingCell, setPayslipRow,
    persistEmployeeCity, persistEmployeePaymentMethod, employeeFieldSaving,
    openEmployeeDetail,
  } = props;

  // ── Scroll container ref — required by useVirtualizer ─────────────────────
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // ── Stable callbacks for SalaryRowCells.memo ─────────────────────────────
  // React.memo only skips re-renders when ALL props are reference-equal.
  //
  // FIX W5: handleSort MUST NOT be frozen — it closes over sortField/sortDir
  // state and needs a fresh reference on every render to see current state.
  // Freezing it caused sort clicks to operate on stale sortField/sortDir values.
  // handleSort is passed only to the header <th> elements, not to SalaryRowCells,
  // so it does NOT affect memo effectiveness.
  //
  // FIX W6: the original useCallback(fn, []) pattern froze callbacks at mount,
  // causing stale closures when rows/selectedMonth/user changed. Now we use a
  // ref-forwarding pattern: the ref always holds the latest function, while the
  // stable wrapper has a fixed identity for React.memo.
  const setEditingCellRef = useRef(setEditingCell); setEditingCellRef.current = setEditingCell;
  const setPayslipRowRef = useRef(setPayslipRow); setPayslipRowRef.current = setPayslipRow;
  const updateRowRef = useRef(updateRow); updateRowRef.current = updateRow;
  const updatePlatformOrdersRef = useRef(updatePlatformOrders); updatePlatformOrdersRef.current = updatePlatformOrders;
  const openEmployeeDetailRef = useRef(openEmployeeDetail); openEmployeeDetailRef.current = openEmployeeDetail;
  const persistCityRef = useRef(persistEmployeeCity); persistCityRef.current = persistEmployeeCity;
  const persistPaymentRef = useRef(persistEmployeePaymentMethod); persistPaymentRef.current = persistEmployeePaymentMethod;
  const approveRowRef = useRef(approveRow); approveRowRef.current = approveRow;
  const unapproveRowRef = useRef(unapproveRow); unapproveRowRef.current = unapproveRow;
  const markAsPaidRef = useRef(markAsPaid); markAsPaidRef.current = markAsPaid;

  const stableSetEditingCell = useCallback((...args: Parameters<typeof setEditingCell>) => setEditingCellRef.current(...args), []);
  const stableSetPayslipRow = useCallback((...args: Parameters<typeof setPayslipRow>) => setPayslipRowRef.current(...args), []);
  const stableUpdateRow = useCallback((...args: Parameters<typeof updateRow>) => updateRowRef.current(...args), []);
  const stableUpdatePlatformOrders = useCallback((...args: Parameters<typeof updatePlatformOrders>) => updatePlatformOrdersRef.current(...args), []);
  const stableOpenEmployeeDetail = useCallback((...args: Parameters<typeof openEmployeeDetail>) => openEmployeeDetailRef.current(...args), []);
  const stablePersistCity = useCallback((...args: Parameters<typeof persistEmployeeCity>) => persistCityRef.current(...args), []);
  const stablePersistPayment = useCallback((...args: Parameters<typeof persistEmployeePaymentMethod>) => persistPaymentRef.current(...args), []);
  const stableApproveRow = useCallback((...args: Parameters<typeof approveRow>) => approveRowRef.current(...args), []);
  const stableUnapproveRow = useCallback((...args: Parameters<typeof unapproveRow>) => unapproveRowRef.current(...args), []);
  const stableMarkAsPaid = useCallback((...args: Parameters<typeof markAsPaid>) => markAsPaidRef.current(...args), []);

  // ── Custom columns ────────────────────────────────────────────────────────
  const allCustomCols = useMemo(() => {
    const cols: { appName: string; key: string; label: string; fullKey: string }[] = [];
    platforms.forEach(p => {
      (appCustomColumns[p] || []).forEach(col => {
        cols.push({ appName: p, key: col.key, label: col.label, fullKey: `${p}___${col.key}` });
      });
    });
    return cols;
  }, [platforms, appCustomColumns]);

  const dedColCount = 2 + allCustomCols.length + 1;

  // ── Precompute all row results once — shared between virtual rows and totals ──
  // Avoids calling computeRow twice per row (once in the map, once in reduce).
  const computedRows = useMemo(
    () => new Map(filtered.map((r) => [r.id, computeRow(r)])),
    [filtered, computeRow],
  );

  // ── Totals (computed from all filtered rows, not just visible ones) ────────
  const totals = useMemo(() => filtered.reduce((acc, r) => {
    const c = computedRows.get(r.id);
    const activityTotals = getSalaryRowActivityTotals(r);
    platforms.forEach(p => {
      acc.platformOrders[p] = (acc.platformOrders[p] || 0) + (r.platformMetrics[p]?.ordersCount || 0);
      acc.platformShiftDays[p] = (acc.platformShiftDays[p] || 0) + (r.platformMetrics[p]?.shiftDays || 0);
      acc.platformSalariesTotals[p] = (acc.platformSalariesTotals[p] || 0) + (r.platformSalaries[p] || 0);
    });
    // Accumulate custom column deduction totals here — avoids per-column reduce in footer JSX
    Object.keys(r.customDeductions || {}).forEach(key => {
      acc.customColTotals[key] = (acc.customColTotals[key] || 0) + (r.customDeductions?.[key] || 0);
    });
    acc.totalOrders += activityTotals.orders;
    acc.totalShiftDays += activityTotals.shiftDays;
    acc.platformSalaries += c?.totalPlatformSalary || 0;
    acc.platformIncome += r.platformIncome;
    acc.workDaysSum += r.workDays;
    acc.fuelCost += r.fuelCost;
    acc.incentives += r.incentives;
    acc.sickAllowance += r.sickAllowance;
    acc.totalAdditions += c?.totalAdditions || 0;
    acc.totalWithSalary += c?.totalWithSalary || 0;
    acc.advance += r.advanceDeduction;
    acc.externalDed += r.externalDeduction;
    acc.violations += r.violations;
    acc.totalDed += c?.totalDeductions || 0;
    acc.net += c?.netSalary || 0;
    acc.transfer += r.transfer;
    acc.remaining += c?.remaining || 0;
    return acc;
  }, {
    platformOrders: {},
    platformShiftDays: {},
    platformSalariesTotals: {},
    customColTotals: {},
    totalOrders: 0, totalShiftDays: 0,
    platformSalaries: 0, platformIncome: 0, workDaysSum: 0, fuelCost: 0,
    incentives: 0, sickAllowance: 0,
    totalAdditions: 0, totalWithSalary: 0,
    advance: 0, externalDed: 0, violations: 0,
    totalDed: 0, net: 0, transfer: 0, remaining: 0,
  }), [filtered, computedRows, platforms]);

  // ── Virtual rows — only renders rows visible in the scroll container ───────
  const rowVirtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 5,           // 5 rows above/below — enough for smooth scroll, less DOM work
  });

  const virtualRows = rowVirtualizer.getVirtualItems();
  const totalVirtualHeight = rowVirtualizer.getTotalSize();

  // ── Empty / loading states ────────────────────────────────────────────────
  if (loadingData) {
    // Skeleton — shows column structure while loading so the page doesn't feel empty
    return (
      <div className="shadow-card bg-card overflow-hidden rounded-2xl">
        <div className="flex items-center gap-3 px-6 py-4 border-b border-border/40">
          <Skeleton  className="h-3 w-32 rounded bg-muted" />
          <Skeleton  className="h-3 w-24 rounded bg-muted" />
          <Skeleton  className="h-3 w-20 rounded bg-muted" />
        </div>
        <div className="divide-y divide-border/30">
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="flex items-center gap-3 px-6 py-3">
              <Skeleton  className="h-3 w-6 rounded bg-muted/60" />
              <Skeleton  className="h-3 w-28 rounded bg-muted/60" />
              <Skeleton  className="h-3 w-20 rounded bg-muted/50" />
              <Skeleton  className="h-3 w-16 rounded bg-muted/50" />
              <Skeleton  className="h-3 w-16 rounded bg-muted/40 flex-1" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // rows = local state that persists across month switches.
  // Use filtered.length (not rows.length) to detect truly empty data,
  // because rows may still hold the previous month's data while new month loads.
  if (!loadingData && filtered.length === 0) {
    const isEmpty = rows.length === 0;
    return (
      <div className="shadow-card bg-card h-48 flex flex-col items-center justify-center gap-2 text-muted-foreground rounded-2xl">
        <span className="text-2xl">{isEmpty ? '📭' : '🔍'}</span>
        <p className="text-sm">
          {isEmpty
            ? 'لا يوجد موظفون نشطون أو بيانات لهذا الشهر'
            : 'لا توجد نتائج تطابق البحث أو الفلتر'}
        </p>
      </div>
    );
  }

  return (
    <div className="shadow-card bg-card overflow-hidden rounded-2xl">
      {/* Scroll container — useVirtualizer reads its scrollTop */}
      {/* contain:layout paint — isolates repaints without breaking sticky positioning */}
      <div ref={scrollContainerRef} className="overflow-auto custom-scrollbar" style={{ maxHeight: '75vh', contain: 'layout paint' }}>
        <table className="text-sm border-collapse w-full min-w-max">
          {/* ── Header — sticky at top ── */}
          {/* bg-card is solid (not opacity-based) so it covers rows scrolling beneath */}
          <thead className="sticky top-0 z-30" style={{ backgroundColor: 'hsl(var(--card))' }}>
            <tr className="border-b border-border/50" style={{ backgroundColor: 'hsl(var(--card))' }}>
              <th className={`${thFrozenBase} w-10 text-center`} style={stickyLeft(0)}>#</th>
              <th colSpan={3} className={`${thFrozenBase} border-l border-border/50`} style={stickyLeft(40)}>بيانات المندوب</th>
              <th colSpan={3} className="ta-th text-info border-b border-border/40 bg-info/10 border-l">📊 بيانات المندوب الشهرية</th>
              {platforms.length > 0 && (
                <th colSpan={platforms.length} className="ta-th text-primary border-b border-border/50 border-l" style={{ backgroundColor: 'hsl(var(--card))' }}>
                  المنصات (طلبات أو دوام / راتب، ونقر مزدوج لتعديل الطلبات في منصات الطلب فقط)
                </th>
              )}
              <th colSpan={2} className="ta-th text-primary border-b border-border/40 bg-primary/10 border-l">إجمالي الطلبات + الراتب الأساسي</th>
              <th colSpan={3} className="ta-th text-success border-b border-border/40 bg-success/10 border-l">✅ الإضافات</th>
              <th colSpan={dedColCount} className="ta-th text-destructive border-b border-border/40 bg-destructive/10 border-l">🔻 المستقطعات</th>
              <th colSpan={1} className="ta-th text-success border-b border-border/40 border-l" style={{ backgroundColor: 'hsl(var(--card))' }}>المستحق</th>
              <th colSpan={2} className="ta-th border-b border-border/40 border-l" style={{ backgroundColor: 'hsl(var(--card))' }}>معلومات الصرف</th>
              <th colSpan={2} className="ta-th border-b border-border/40 border-l" style={{ backgroundColor: 'hsl(var(--card))' }}>الفرع وطريقة الصرف</th>
              <th colSpan={1} className="ta-th border-b border-border/40 border-l" style={{ backgroundColor: 'hsl(var(--card))' }}>الإجراءات</th>
            </tr>
            <tr style={{ backgroundColor: 'hsl(var(--card))' }}>
              {/* FIX I1: was duplicating # header — second row just needs spacer */}
              <th className={`${thFrozenBase} w-10 text-center`} style={stickyLeft(0)} aria-hidden="true"></th>
              <th className={`${thFrozenBase} w-32 cursor-pointer hover:text-foreground select-none`} style={stickyLeft(40)} onClick={() => handleSort('employeeName')}>
                الاسم <SalarySortIcon field="employeeName" sortField={sortField} sortDir={sortDir} />
              </th>
              <th className={`${thFrozenBase} w-24 cursor-pointer hover:text-foreground select-none`} style={stickyLeft(168)} onClick={() => handleSort('jobTitle')}>
                المسمى الوظيفي <SalarySortIcon field="jobTitle" sortField={sortField} sortDir={sortDir} />
              </th>
              <th className={`${thFrozenBase} w-28 cursor-pointer hover:text-foreground select-none`} style={stickyLeft(264)} onClick={() => handleSort('nationalId')}>
                رقم الهوية <SalarySortIcon field="nationalId" sortField={sortField} sortDir={sortDir} />
              </th>
              <th className="ta-th text-info border border-border/40 bg-info/10 cursor-pointer select-none hover:brightness-95" onClick={() => handleSort('platformIncome')}>
                دخل <SalarySortIcon field="platformIncome" sortField={sortField} sortDir={sortDir} />
              </th>
              <th className="ta-th text-info border border-border/40 bg-info/10 cursor-pointer select-none hover:brightness-95" onClick={() => handleSort('workDays')}>
                أيام العمل <SalarySortIcon field="workDays" sortField={sortField} sortDir={sortDir} />
              </th>
              <th className="ta-th text-info border border-border/40 bg-info/10 cursor-pointer select-none hover:brightness-95" onClick={() => handleSort('fuelCost')}>
                البنزين <SalarySortIcon field="fuelCost" sortField={sortField} sortDir={sortDir} />
              </th>
              {platforms.map(p => {
                const pc = platformColors[p];
                return (
                  <th key={`${p}-col`}
                    className="ta-th border-b border-l border-border/30 cursor-pointer select-none hover:opacity-90 transition-opacity"
                    style={{ backgroundColor: pc?.header, color: pc?.headerText }}
                    onClick={() => handleSort(p)}>
                    <div className="flex flex-col items-center gap-0">
                      <span>{p}</span>
                      <span className="text-[9px] opacity-80 font-normal">طلبات/دوام / راتب <SalarySortIcon field={p} sortField={sortField} sortDir={sortDir} /></span>
                    </div>
                  </th>
                );
              })}
              <th className="ta-th text-foreground border border-border/30 bg-primary/10 cursor-pointer select-none hover:brightness-95" onClick={() => handleSort('totalPlatformOrders')}>
                إجمالي الطلبات <SalarySortIcon field="totalPlatformOrders" sortField={sortField} sortDir={sortDir} />
              </th>
              <th className={`${thBase} bg-primary/10`}>الراتب الأساسي</th>
              <th className={`${thBase} bg-success/5`}>حوافز</th>
              <th className={`${thBase} bg-success/5`}>إجازة مرضية</th>
              <th className={`${thBase} bg-success/10 border-l border-border/40`}>الإجمالي مع الراتب</th>
              <th className={`${thBase} bg-destructive/5`}>سلف</th>
              <th className={`${thBase} bg-destructive/5`}>مخالفات</th>
              {allCustomCols.map(col => (
                <th key={col.fullKey} className={`${thBase} bg-destructive/5`}>{col.label}</th>
              ))}
              <th className={`${thBase} bg-destructive/10 border-l border-border/40`}>إجمالي المستقطعات</th>
              <th className={thBase}>المستحق</th>
              <th className={thBase}>المحوّل</th>
              <th className={`${thBase} border-l border-border/40`}>المتبقي</th>
              <th className={`${thBase} cursor-pointer hover:text-foreground select-none`} onClick={() => handleSort('city')}>
                الفرع <SalarySortIcon field="city" sortField={sortField} sortDir={sortDir} />
              </th>
              <th className={`${thBase} border-l border-border/40 cursor-pointer hover:text-foreground select-none`} onClick={() => handleSort('paymentMethod')}>
                طريقة الصرف <SalarySortIcon field="paymentMethod" sortField={sortField} sortDir={sortDir} />
              </th>
              <th className={`${thBase} border-l border-border/50`}>الإجراءات</th>
            </tr>
          </thead>

          {/* ── Virtualized tbody ── */}
          {/* paddingTop/Bottom technique: rows stay in flow (no absolute positioning),
              so position:sticky on td cells continues to work correctly.
              We push spacer rows at the top and bottom to represent off-screen rows. */}
          <tbody>
            {/* Top spacer: represents rows above the visible window */}
            {virtualRows.length > 0 && virtualRows[0].start > 0 && (
              <tr style={{ height: virtualRows[0].start }} aria-hidden="true">
                <td colSpan={999} />
              </tr>
            )}
            {virtualRows.map((virtualRow) => {
              const r = filtered[virtualRow.index];
              const c = computedRows.get(r.id);
              if (!c) return null;

              return (
                <tr
                  key={r.id}
                  data-index={virtualRow.index}
                  className="border-b border-border hover:bg-muted/25 transition-colors"
                  style={{ height: `${ROW_HEIGHT}px` }}
                >
                  <SalaryRowCells
                    r={r}
                    rowIdx={virtualRow.index}
                    c={c}
                    platforms={platforms}
                    platformColors={platformColors}
                    appCustomColumns={appCustomColumns}
                    allCustomCols={allCustomCols}
                    empPlatformScheme={empPlatformScheme}
                    editingCell={editingCell}
                    setEditingCell={stableSetEditingCell}
                    updateRow={stableUpdateRow}
                    updatePlatformOrders={stableUpdatePlatformOrders}
                    approveRow={stableApproveRow}
                    unapproveRow={stableUnapproveRow}
                    approvingRowId={approvingRowId}
                    markAsPaid={stableMarkAsPaid}
                    markingPaid={markingPaid}
                    setPayslipRow={stableSetPayslipRow}
                    persistEmployeeCity={stablePersistCity}
                    persistEmployeePaymentMethod={stablePersistPayment}
                    employeeFieldSaving={employeeFieldSaving}
                    openEmployeeDetail={stableOpenEmployeeDetail}
                    canEdit={props.canEdit}
                  />
                </tr>
              );
            })}
            {/* Bottom spacer: represents rows below the visible window */}
            {virtualRows.length > 0 && (() => {
              const lastRow = virtualRows[virtualRows.length - 1];
              const bottomPad = totalVirtualHeight - lastRow.end;
              return bottomPad > 0 ? (
                <tr style={{ height: bottomPad }} aria-hidden="true">
                  <td colSpan={999} />
                </tr>
              ) : null;
            })()}
          </tbody>

          {/* ── Totals footer — always rendered, outside virtual list ── */}
          {/* FIX M1: bg-muted/60 is semi-transparent and lets rows show through when sticky.
               Use a solid inline background so rows scrolling behind the footer are hidden. */}
          <tfoot className="sticky bottom-0 z-20" style={{ backgroundColor: 'hsl(var(--muted))' }}>
            <tr className="border-t-2 border-border">
              <td className={`${tfClass} sticky text-center`} style={{ left: 0, zIndex: 20, backgroundColor: 'hsl(var(--muted))' }}>—</td>
              <td className={`${tfClass} sticky text-center border-l border-border/30`} style={{ left: 40, zIndex: 20, backgroundColor: 'hsl(var(--muted))' }}>الإجمالي</td>
              <td className={tfClass} style={{ position: 'sticky', left: 168, zIndex: 20, backgroundColor: 'hsl(var(--muted))' }}></td>
              <td className={`${tfClass} border-l border-border/30`} style={{ position: 'sticky', left: 264, zIndex: 20, backgroundColor: 'hsl(var(--muted))' }}></td>
              <td className="ta-td font-bold border border-border/40 bg-info/10 text-foreground">
                {totals.platformIncome.toLocaleString('en-US')}
              </td>
              <td className="ta-td font-bold border border-border/40 bg-info/10 text-foreground">
                {Math.round(totals.workDaysSum / Math.max(filtered.length, 1))}
              </td>
              <td className="ta-td font-bold border border-border/40 bg-info/10 text-foreground">
                {totals.fuelCost.toLocaleString('en-US')}
              </td>
              {platforms.map(p => {
                const totalOrders = totals.platformOrders[p] || 0;
                const totalShiftDays = totals.platformShiftDays[p] || 0;
                const totalSal = totals.platformSalariesTotals[p] || 0;
                return (
                  <td key={`${p}-col`} className={`${tfClass} border-l border-border/20 text-foreground`}>
                    <div className="flex flex-col items-center leading-tight">
                      <span>{totalOrders.toLocaleString('en-US')} طلب</span>
                      {totalShiftDays > 0 && <span className="text-[10px] opacity-75 font-normal">{totalShiftDays.toLocaleString('en-US')} دوام</span>}
                      <span className="text-[10px] opacity-75 font-normal">{totalSal.toLocaleString('en-US')} ر.س</span>
                    </div>
                  </td>
                );
              })}
              <td className={`${tfClass} text-center font-bold text-foreground border-l border-border/20`}>
                <div className="flex flex-col items-center leading-tight">
                  <span>{totals.totalOrders.toLocaleString('en-US')} طلب</span>
                  {totals.totalShiftDays > 0 && <span className="text-[10px] opacity-75 font-normal">{totals.totalShiftDays.toLocaleString('en-US')} دوام</span>}
                </div>
              </td>
              <td className={`${tfClass} text-foreground border-l border-border/30`}>{totals.platformSalaries.toLocaleString('en-US')}</td>
              <td className={`${tfClass} text-foreground`}>{totals.incentives.toLocaleString('en-US')}</td>
              <td className={`${tfClass} text-foreground`}>{totals.sickAllowance.toLocaleString('en-US')}</td>
              <td className={`${tfClass} text-foreground border-l border-border/30`}>{totals.totalWithSalary.toLocaleString('en-US')}</td>
              <td className={`${tfClass} text-foreground`}>{totals.advance.toLocaleString('en-US')}</td>
              <td className={`${tfClass} text-foreground`}>{totals.violations.toLocaleString('en-US')}</td>
              {allCustomCols.map(col => {
                const colTotal = totals.customColTotals[col.fullKey] || 0;
                return <td key={col.fullKey} className={`${tfClass} text-foreground`}>{colTotal > 0 ? colTotal.toLocaleString('en-US') : '—'}</td>;
              })}
              <td className={`${tfClass} text-foreground border-l border-border/30`}>{totals.totalDed.toLocaleString('en-US')}</td>
              <td className={`${tfClass} text-foreground text-base ${totals.net < 0 ? 'text-destructive' : ''}`}>{totals.net.toLocaleString('en-US')}</td>
              <td className={tfClass}>{totals.transfer.toLocaleString('en-US')}</td>
              <td className={`${tfClass} border-l border-border/30`}>{totals.remaining.toLocaleString('en-US')}</td>
              <td className={tfClass} />
              <td className={`${tfClass} border-l border-border/30`} />
              <td className={tfClass} />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
});
