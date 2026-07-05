import type React from 'react';
import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { Loader2, Save, Clock, Download, Upload, Printer } from 'lucide-react';
import { toast } from '@shared/components/ui/sonner';
import { Button } from '@shared/components/ui/button';
import { Input } from '@shared/components/ui/input';
import { loadXlsx } from '@modules/orders/utils/xlsx';
import { OrdersMonthNavigator } from '@shared/components/orders/OrdersMonthNavigator';
import { isShiftCapableApp } from '@shared/lib/workType';
import { monthLabel } from '@modules/orders/utils/dateMonth';
import type { App, Employee } from '@modules/orders/types';
import { getErrorMessage } from '@services/serviceError';

function getShiftDayHeaderClass(isToday: boolean, isWeekend: boolean): string {
  if (isToday) return 'bg-primary/20 text-primary font-bold';
  if (isWeekend) return 'text-muted-foreground/50 bg-muted/40';
  return 'text-muted-foreground';
}

export type ShiftRow = {
  id?: string;
  employee_id: string;
  app_id: string;
  date: string;
  hours_worked: number;
  notes?: string | null;
  employee?: { name: string };
  app?: { name: string };
};

/**
 * key = `${empId}::${day}`
 * value:
 *   1   = حاضر
 *   0   = غائب (explicit, stored locally — not persisted to DB)
 *  -1   = إجازة براتب
 *  -2   = إجازة مرضى
 * (key absent) = لم يُحدد
 */
type ShiftGrid = Record<string, number>;

/** Human label for a grid value */
const ATTENDANCE_LABELS: Record<number, string> = {
  1: 'حاضر',
  0: 'غائب',
  [-1]: 'إجازة براتب',
  [-2]: 'إجازة مرضى',
};

type Props = {
  year: number;
  month: number;
  shifts: ShiftRow[];
  employees: Employee[];
  allEmployees?: Employee[];
  apps: App[];
  loading: boolean;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onSave: (shifts: ShiftRow[]) => Promise<void>;
  canEdit: boolean;
};

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

function buildNameMap(employees: Employee[]): Map<string, string> {
  const nameMap = new Map<string, string>();
  employees.forEach((emp) => {
    nameMap.set(emp.name.trim(), emp.id);
    nameMap.set(emp.name.trim().replaceAll(/\s+/g, ' '), emp.id);
  });
  return nameMap;
}

function parseCellToAttendance(cellValue: string): number | null {
  if (cellValue === 'حاضر' || cellValue === '1' || cellValue === 'present') return 1;
  if (cellValue === 'غائب' || cellValue === '0' || cellValue === 'absent') return 0;
  if (cellValue === 'إجازة براتب' || cellValue === 'paid_leave' || cellValue === '-1' || cellValue === 'إجازة') return -1;
  if (cellValue === 'إجازة مرضى' || cellValue === 'sick_leave' || cellValue === '-2' || cellValue === 'مرضى') return -2;
  return null;
}

function resolveEmployeeId(empName: string, nameMap: Map<string, string>): string | null {
  return nameMap.get(empName) ?? nameMap.get(empName.replaceAll(/\s+/g, ' ')) ?? null;
}

function processImportRows(
  matrix: unknown[][],
  dayArr: number[],
  nameMap: Map<string, string>,
  setGrid: React.Dispatch<React.SetStateAction<ShiftGrid>>,
): { imported: number; skipped: number; errors: string[] } {
  let imported = 0;
  let skipped = 0;
  const errors: string[] = [];
  for (let rowIdx = 1; rowIdx < matrix.length; rowIdx++) {
    const row = Array.isArray(matrix[rowIdx]) ? matrix[rowIdx] : [];
    const empName = String((row as string[])[0] ?? '').trim();
    if (!empName) { skipped++; continue; }
    const empId = resolveEmployeeId(empName, nameMap);
    if (!empId) {
      skipped++;
      errors.push(`صف ${rowIdx + 1}: "${empName}" غير موجود`);
      continue;
    }
    for (let idx = 0; idx < dayArr.length; idx++) {
      const d = dayArr[idx];
      const cellValue = String((row as string[])[idx + 1] ?? '').trim();
      const key = `${empId}::${d}`;
      const attendance = parseCellToAttendance(cellValue);
      if (attendance !== null) {
        setGrid(prev => ({ ...prev, [key]: attendance }));
        imported++;
      }
    }
  }
  return { imported, skipped, errors };
}

function getSelectValue(val: number, isAbsent: boolean): string {
  if (val === -1) return '-1';
  if (val === -2) return '-2';
  if (val > 0) return '1';
  if (isAbsent) return '0';
  return '';
}

type CellDisplay = { label: string; colorClass: string } | null;

function getShiftCellDisplay(val: number, isAbsent: boolean): CellDisplay {
  if (val === -1) return { label: 'إجازة', colorClass: 'text-sky-600 dark:text-sky-400' };
  if (val === -2) return { label: 'مرضى', colorClass: 'text-amber-600 dark:text-amber-400' };
  if (val > 0) return { label: 'حاضر', colorClass: 'text-emerald-600 dark:text-emerald-400' };
  if (isAbsent) return { label: 'غائب', colorClass: 'text-rose-500 dark:text-rose-400' };
  return null;
}

function getShiftCellClassName(isToday: boolean, isWeekend: boolean, isEditing: boolean, canEdit: boolean): string {
  const base = ['text-center', 'p-0', 'border-l', 'border-border/30', 'transition-colors'];
  
  let bg: string[] = [];
  if (isToday) {
    bg = ['bg-primary/10'];
  } else if (isWeekend) {
    bg = ['bg-muted/20'];
  }
  
  let interactive: string[] = [];
  if (isEditing) {
    interactive = ['ring-2', 'ring-inset', 'ring-primary'];
  } else if (canEdit) {
    interactive = ['cursor-pointer', 'hover:bg-primary/5'];
  }
  
  return [...base, ...bg, ...interactive].join(' ');
}function getAttendanceExportLabel(value: number, hasExplicitValue: boolean): string {
  if (value > 0) return 'حاضر';
  if (value === -1) return 'إجازة براتب';
  if (value === -2) return 'إجازة مرضى';
  if (hasExplicitValue) return 'غائب';
  return '';
}

function buildGridFromShifts(shifts: ShiftRow[]): ShiftGrid {
  const grid: ShiftGrid = {};
  for (const s of shifts) {
    if (!s.date || !s.employee_id) continue;
    const day = Number.parseInt(s.date.slice(8, 10), 10);
    if (Number.isNaN(day)) continue;
    const key = `${s.employee_id}::${day}`;
    // Include all non-zero values: present (>0) and leave statuses (<0)
    // hours_worked === 0 should never be saved to DB, but skip it for safety
    if (s.hours_worked !== 0) {
      grid[key] = s.hours_worked;
    }
  }
  return grid;
}

function gridToShiftRows(
  grid: ShiftGrid,
  year: number,
  month: number,
  shiftAppId: string,
): ShiftRow[] {
  const rows: ShiftRow[] = [];
  for (const [key, hours] of Object.entries(grid)) {
    // Skip absent (0) — only save present (1) and leave types (-1, -2)
    if (hours === 0) continue;
    const [empId, dayStr] = key.split('::');
    const day = Number.parseInt(dayStr, 10);
    if (!empId || Number.isNaN(day)) continue;
    rows.push({
      employee_id: empId,
      app_id: shiftAppId,
      date: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
      hours_worked: hours,
    });
  }
  return rows;
}

export function ShiftsTab({
  year,
  month,
  shifts,
  employees,
  allEmployees,
  apps,
  loading,
  onPrevMonth,
  onNextMonth,
  onSave,
  canEdit,
}: Readonly<Props>) {
  const shiftApps = useMemo(() => apps.filter(isShiftCapableApp), [apps]);
  const shiftAppId = shiftApps[0]?.id ?? '';

  const allShiftEmployees = useMemo(() => {
    const empIds = new Set(employees.map((e) => e.id));
    const extras: typeof employees = [];
    shifts.forEach((s) => {
      if (!empIds.has(s.employee_id)) {
        empIds.add(s.employee_id);
        extras.push({
          id: s.employee_id,
          name: s.employee?.name ?? s.employee_id,
          salary_type: 'shift',
          status: 'active',
          sponsorship_status: null,
        });
      }
    });
    return [...employees, ...extras];
  }, [employees, shifts]);

  const [grid, setGrid] = useState<ShiftGrid>(() => buildGridFromShifts(shifts));
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [editingCell, setEditingCell] = useState<string | null>(null);

  useEffect(() => {
    setGrid(buildGridFromShifts(shifts));
  }, [shifts]);

  const days = getDaysInMonth(year, month);
  const dayArr = useMemo(() => Array.from({ length: days }, (_, i) => i + 1), [days]);

  const filteredEmployees = useMemo(
    () => (search ? allShiftEmployees.filter((e) => e.name.includes(search)) : allShiftEmployees),
    [allShiftEmployees, search],
  );

  const getVal = useCallback(
    (empId: string, day: number) => grid[`${empId}::${day}`] ?? 0,
    [grid],
  );

  /** Count of days where employee was PRESENT (hours > 0) */
  const empPresentTotal = useCallback(
    (empId: string) => dayArr.reduce((s, d) => s + (getVal(empId, d) > 0 ? 1 : 0), 0),
    [dayArr, getVal],
  );

  /** Count of days where employee was on LEAVE (hours < 0) */
  const empLeaveTotal = useCallback(
    (empId: string) => dayArr.reduce((s, d) => s + (getVal(empId, d) < 0 ? 1 : 0), 0),
    [dayArr, getVal],
  );

  // Keep backward compat — total = حاضر days only
  const _empMonthTotal = empPresentTotal;

  const handleCellClick = (empId: string, day: number) => {
    if (!canEdit) return;
    const key = `${empId}::${day}`;
    if (editingCell === key) {
      setEditingCell(null);
      return;
    }
    setEditingCell(key);
  };

  /** Set an explicit attendance value; pass null to clear the cell entirely */
  const commitAttendance = (key: string, value: number | null) => {
    setGrid((prev) => {
      const next = { ...prev };
      if (value === null) {
        delete next[key]; // "فاضي" — remove from grid
      } else {
        next[key] = value; // 0=غائب, 1=حاضر, -1=إجازة براتب, -2=إجازة مرضى
      }
      return next;
    });
    setEditingCell(null);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const rows = gridToShiftRows(grid, year, month, shiftAppId);
      await onSave(rows);
    } finally {
      setSaving(false);
    }
  };

  const tableRef = useRef<HTMLTableElement>(null);

  const exportExcel = async () => {
    const XLSX = await loadXlsx();
    const headers = ['الموظف', ...dayArr.map(String), 'الحاضر', 'الإجازة'];
    const rows = filteredEmployees.map((emp) => {
      const values: Array<string | number> = [emp.name];
      dayArr.forEach((d) => {
        const v = getVal(emp.id, d);
        const key = `${emp.id}::${d}`;
        values.push(getAttendanceExportLabel(v, grid[key] !== undefined));
      });
      values.push(empPresentTotal(emp.id), empLeaveTotal(emp.id));
      return values;
    });
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'الدوام');
    XLSX.writeFile(wb, `دوام_${month}_${year}.xlsx`);
  };

  const importRef = useRef<HTMLInputElement>(null);

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    try {
      const XLSX = await loadXlsx();
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const matrix = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: '' });

      if (matrix.length < 2) {
        toast.error('الملف فارغ', { description: 'يجب أن يحتوي على صف عناوين + بيانات' });
        return;
      }

      const importEmployeeList = allEmployees && allEmployees.length > 0 ? allEmployees : allShiftEmployees;
      const nameMap = buildNameMap(importEmployeeList);
      const { imported, skipped, errors } = processImportRows(matrix, dayArr, nameMap, setGrid);
      const totalRows = matrix.length - 1;

      if (errors.length > 0) {
        toast.warning('تم الاستيراد مع تحذيرات', {
          description: `✅ نجح: ${imported} خلية | ⚠️ تخطي: ${skipped} صف\n${errors.slice(0, 5).join('\n')}`,
          duration: 10000,
        });
      } else {
        toast.success('تم الاستيراد', { description: `${imported} خلية من ${totalRows} صف` });
      }
    } catch (err) {
      toast.error('فشل الاستيراد', { description: getErrorMessage(err, 'خطأ في قراءة الملف') });
    }
  };

  const downloadTemplate = async () => {
    const XLSX = await loadXlsx();
    const headers = ['الموظف', ...dayArr.map(String)];
    const rows = filteredEmployees.map(emp => [emp.name, ...dayArr.map(() => '')]);
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'قالب الدوام');
    XLSX.writeFile(wb, `قالب_دوام_${month}_${year}.xlsx`);
    toast.success('تم تنزيل القالب', {
      description: 'القيم المقبولة: حاضر / غائب / إجازة براتب / إجازة مرضى',
    });
  };

  const handlePrint = () => {
    const table = tableRef.current;
    if (!table) return;
    const win = globalThis.open('', '_blank');
    if (!win) return;
    const doc = win.document;
    doc.documentElement.setAttribute('dir', 'rtl');
    doc.documentElement.setAttribute('lang', 'ar');
    const meta = doc.createElement('meta'); meta.setAttribute('charset', 'UTF-8'); doc.head.appendChild(meta);
    doc.title = `دوام ${month}/${year}`;
    const style = doc.createElement('style');
    style.textContent = '*{box-sizing:border-box;margin:0;padding:0}body{font-family:Arial,sans-serif;font-size:10px;direction:rtl}h2{text-align:center;margin:8px 0}table{width:100%;border-collapse:collapse}th{background:#1e3a5f;color:#fff;padding:4px;text-align:center;font-size:9px}td{padding:3px;border:1px solid #ddd;text-align:center}@media print{body{print-color-adjust:exact}}';
    doc.head.appendChild(style);
    const h2 = doc.createElement('h2');
    h2.textContent = `دوام شهر ${month}/${year} — ${filteredEmployees.length} موظف`;
    doc.body.appendChild(h2);
    doc.body.appendChild(table.cloneNode(true));
    win.onload = () => { win.print(); win.onafterprint = () => win.close(); };
  };

  const now = new Date();
  const today = now.getFullYear() === year && now.getMonth() + 1 === month ? now.getDate() : -1;

  const grandTotal = useMemo(
    () => filteredEmployees.reduce((s, e) => s + empPresentTotal(e.id), 0),
    [filteredEmployees, empPresentTotal],
  );

  if (shiftApps.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <Clock size={36} className="mx-auto mb-3 text-muted-foreground/30" />
        <p className="font-medium">لا توجد منصات دوام</p>
        <p className="text-xs mt-1">أضف منصة بنوع "دوام" أو "مختلط" من إعدادات التطبيقات</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <OrdersMonthNavigator
          compact
          label={monthLabel(year, month)}
          onPrev={onPrevMonth}
          onNext={onNextMonth}
        />

        <div className="flex items-center gap-2">
          <Input
            placeholder="بحث عن موظف..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 w-48 text-xs"
          />
          <span className="text-xs text-muted-foreground">
            {filteredEmployees.length} موظف
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <Button size="sm" variant="outline" onClick={() => { exportExcel(); }} className="gap-1.5 h-8 text-xs">
            <Download size={13} /> تصدير
          </Button>
          <Button size="sm" variant="outline" onClick={() => { downloadTemplate(); }} className="gap-1.5 h-8 text-xs">
            <Download size={13} /> قالب
          </Button>
          {canEdit && (
            <>
              <input ref={importRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleImport} />
              <Button size="sm" variant="outline" onClick={() => importRef.current?.click()} className="gap-1.5 h-8 text-xs">
                <Upload size={13} /> استيراد
              </Button>
            </>
          )}
          <Button size="sm" variant="outline" onClick={handlePrint} className="gap-1.5 h-8 text-xs">
            <Printer size={13} /> طباعة
          </Button>
          {canEdit && (
            <Button size="sm" onClick={handleSave} disabled={saving} className="gap-1.5">
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              حفظ
            </Button>
          )}
        </div>
      </div>

      {/* Grid */}
      <div className="bg-card shadow-card overflow-x-auto w-full rounded-2xl">
        {loading ? (
          <div className="flex items-center justify-center py-20 gap-2 text-muted-foreground">
            <Loader2 size={20} className="animate-spin" /> جاري التحميل...
          </div>
        ) : (
          <table ref={tableRef} className="border-collapse text-[11px] leading-tight w-full" style={{ minWidth: `${36 + 132 + days * 44 + 80}px` }}>
            <thead className="sticky top-0 z-20">
              <tr className="bg-muted border-b-2 border-border">
                <th className="ta-th sticky right-0 z-40 bg-muted px-0.5 border-l border-border" style={{ minWidth: 36, width: 36 }}>
                  #
                </th>
                <th className="ta-th sticky z-30 bg-muted text-start px-1.5 text-foreground border-l-2 border-border" style={{ right: 36, minWidth: 132 }}>
                  الموظف
                </th>
                {dayArr.map((d) => {
                  const dow = new Date(year, month - 1, d).getDay();
                  const isWeekend = dow === 5 || dow === 6;
                  const isToday = d === today;
                  return (
                    <th
                      key={d}
                      className={`text-center px-0.5 py-1.5 font-medium border-l border-border/50
                        ${getShiftDayHeaderClass(isToday, isWeekend)}`}
                      style={{ minWidth: 44 }}
                    >
                      {d}
                    </th>
                  );
                })}
                <th className="ta-th sticky left-0 z-30 font-bold text-primary bg-muted border-r-2 border-border" style={{ minWidth: 80 }}>
                  الملخص
                </th>
              </tr>
            </thead>

            <tbody>
              {filteredEmployees.length === 0 ? (
                <tr>
                  <td colSpan={days + 3} className="ta-td text-muted-foreground">
                    لا يوجد موظفين دوام
                  </td>
                </tr>
              ) : (
                filteredEmployees.map((emp, idx) => {
                  const presentTotal = empPresentTotal(emp.id);
                  const leaveTotal = empLeaveTotal(emp.id);
                  const rowBg = idx % 2 === 0 ? 'hsl(var(--card))' : 'hsl(var(--muted))';

                  return (
                    <tr key={emp.id} className="border-b border-border/40">
                      <td
                        className="ta-td sticky right-0 z-20 px-0.5 border-l border-border tabular-nums text-muted-foreground font-medium"
                        style={{ backgroundColor: rowBg, minWidth: 36, width: 36 }}
                      >
                        {idx + 1}
                      </td>
                      <td
                        className="ta-td sticky z-10 px-1.5 border-l-2 border-border"
                        style={{ backgroundColor: rowBg, right: 36, minWidth: 132 }}
                      >
                        <span className="font-medium text-foreground truncate max-w-[7.5rem] block" title={emp.name}>
                          {emp.name}
                        </span>
                      </td>

                      {dayArr.map((d) => {
                        const val = getVal(emp.id, d);
                        const cellKey = `${emp.id}::${d}`;
                        const isEditing = editingCell === cellKey;
                        const dow = new Date(year, month - 1, d).getDay();
                        const isWeekend = dow === 5 || dow === 6;
                        const isToday = d === today;
                        const isAbsent = val === 0 && grid[cellKey] !== undefined;
                        const display = getShiftCellDisplay(val, isAbsent);

                        return (
                          <td
                            key={d}
                            className={getShiftCellClassName(isToday, isWeekend, isEditing, canEdit)}
                            style={{ minWidth: 44 }}
                          >
                            {isEditing ? (
                              <select
                                autoFocus
                                value={getSelectValue(val, isAbsent)}
                                onChange={(e) => {
                                  const v = e.target.value;
                                  if (v === '') {
                                    commitAttendance(cellKey, null);
                                  } else {
                                    commitAttendance(cellKey, Number.parseInt(v, 10));
                                  }
                                }}
                                onBlur={() => setEditingCell(null)}
                                className="h-7 w-full text-center text-[10px] border-0 bg-transparent cursor-pointer focus:outline-none font-bold"
                              >
                                <option value="">— فاضي —</option>
                                <option value="1">حاضر</option>
                                <option value="0">غائب</option>
                                <option value="-1">إجازة براتب</option>
                                <option value="-2">إجازة مرضى</option>
                              </select>
                            ) : (
                              <button
                                type="button"
                                disabled={!canEdit}
                                onClick={() => handleCellClick(emp.id, d)}
                                className="h-7 w-full flex items-center justify-center bg-transparent"
                              >
                                {display ? (
                                  <span className={`font-bold text-[10px] leading-none ${display.colorClass}`}>{display.label}</span>
                                ) : (
                                  <span className="text-muted-foreground/20">·</span>
                                )}
                              </button>
                            )}
                          </td>
                        );
                      })}

                      {/* Summary column */}
                      <td
                        className="ta-td sticky left-0 z-10 border-r-2 border-border bg-muted"
                        style={{ minWidth: 80 }}
                      >
                        <div className="flex flex-col items-center leading-tight">
                          <div className="flex items-center gap-0.5 tabular-nums">
                            <span className="text-emerald-600 font-bold text-[10px]">{presentTotal}</span>
                            {leaveTotal > 0 && (
                              <>
                                <span className="text-muted-foreground/40 text-[9px]">+</span>
                                <span className="text-sky-600 font-bold text-[10px]">{leaveTotal}ج</span>
                              </>
                            )}
                            <span className="text-muted-foreground/50 text-[9px]">/{days}</span>
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}

              {/* Totals row */}
              {filteredEmployees.length > 0 && (
                <tr className="border-t-2 border-border font-semibold">
                  <td className="ta-td sticky right-0 z-20 px-0.5 border-l border-border text-muted-foreground bg-muted" style={{ minWidth: 36, width: 36 }}>
                    —
                  </td>
                  <td className="ta-td sticky z-10 px-1.5 font-bold border-l-2 border-border text-foreground bg-muted" style={{ right: 36, minWidth: 132 }}>
                    الإجمالي
                  </td>
                  {dayArr.map((d) => {
                    const presentCount = filteredEmployees.reduce((s, e) => s + (getVal(e.id, d) > 0 ? 1 : 0), 0);
                    const leaveCount  = filteredEmployees.reduce((s, e) => s + (getVal(e.id, d) < 0 ? 1 : 0), 0);
                    const isToday = d === today;
                    return (
                      <td
                        key={d}
                        className={`text-center px-0.5 py-1.5 border-l border-border/40 ${isToday ? 'bg-primary/10' : ''}`}
                        style={{ minWidth: 44, backgroundColor: isToday ? undefined : 'hsl(var(--muted) / 0.4)' }}
                      >
                        <div className="flex flex-col items-center leading-tight">
                          {presentCount > 0 ? (
                            <span className="font-bold text-emerald-600 text-[10px]">{presentCount}</span>
                          ) : (
                            <span className="text-muted-foreground/30 text-[10px]">0</span>
                          )}
                          {leaveCount > 0 && (
                            <span className="text-sky-500 text-[9px]">{leaveCount}ج</span>
                          )}
                        </div>
                      </td>
                    );
                  })}
                  <td className="ta-td sticky left-0 z-10 px-1.5 font-bold text-primary border-r-2 border-border bg-muted" style={{ minWidth: 80 }}>
                    {grandTotal}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-muted-foreground px-1">
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" /> حاضر
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block" /> غائب
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-full bg-sky-500 inline-block" /> إجازة براتب
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" /> إجازة مرضى
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-full bg-muted-foreground/20 inline-block" /> لم يُحدد
        </span>
        <span className="text-muted-foreground/60">• ج = أيام إجازة (لا تُحسب في الحاضر)</span>
        <span className="text-muted-foreground/60">• اضغط على الخلية لتغيير الحالة</span>
      </div>
    </div>
  );
}

export { ATTENDANCE_LABELS };
