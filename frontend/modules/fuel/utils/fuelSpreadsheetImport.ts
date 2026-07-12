import { toast } from '@shared/components/ui/sonner';
import { getErrorMessage } from '@services/serviceError';
import { logError } from '@shared/lib/logger';
import { loadXlsx } from '@modules/orders/utils/xlsx';
import { matchEmployeeNames, type UnmatchedEmployeeName } from '@shared/lib/nameMatching';
import type { Employee, DailyRow } from '@modules/fuel/types/fuel.types';

export type FuelMetric = 'km' | 'fuel';

/** Builds the strict header row for the fuel/km bulk-import template & validation. */
function buildFuelIoHeaders(dayArr: number[]): string[] {
  return ['اسم المندوب', ...dayArr.map((d) => `اليوم ${d}`)];
}

export async function downloadFuelMetricTemplate(dayArr: number[], metric: FuelMetric): Promise<void> {
  const XLSX = await loadXlsx();
  const headers = buildFuelIoHeaders(dayArr);
  const ws = XLSX.utils.aoa_to_sheet([headers]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'قالب');
  const fileName = metric === 'km' ? 'template_km.xlsx' : 'template_fuel.xlsx';
  XLSX.writeFile(wb, fileName);
}

export type FuelImportRowPayload = {
  employee_id: string;
  date: string;
  km_total: number;
  fuel_cost: number;
  notes: string | null;
};

/** Builds an employee_id::date -> {km,fuel} lookup from already-loaded daily rows, used to merge the untouched metric so we never zero it out during a single-metric import. */
export function buildDailyLookup(dailyRows: DailyRow[]): Map<string, { km: number; fuel: number }> {
  const map = new Map<string, { km: number; fuel: number }>();
  dailyRows.forEach((row) => {
    map.set(`${row.employee_id}::${row.date}`, { km: row.km_total, fuel: row.fuel_cost });
  });
  return map;
}

function parseNumericCell(cell: unknown): number {
  if (cell === '' || cell === null || cell === undefined) return Number.NaN;
  const val = Number(cell);
  return val;
}

export type ParsedFuelImport = {
  rows: FuelImportRowPayload[];
  unmatched: UnmatchedEmployeeName[];
  matched: Map<string, { id: string; name: string; similarity: number }>;
  matrixByName: Map<string, { day: number; value: number }[]>;
  errors: string[];
};

/** Parses an uploaded workbook into per-employee/day cell values, without resolving unmatched names yet. */
export async function parseFuelImportFile(params: {
  file: File;
  dayArr: number[];
  employees: Employee[];
}): Promise<ParsedFuelImport | null> {
  const { file, dayArr, employees } = params;

  if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
    toast.error('نوع الملف غير صحيح', { description: 'يرجى رفع ملف Excel بصيغة .xlsx أو .xls فقط' });
    return null;
  }

  const XLSX = await loadXlsx();
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: 'array' });
  if (!wb.SheetNames || wb.SheetNames.length === 0) {
    toast.error('ملف فارغ', { description: 'الملف لا يحتوي على أي ورقة عمل' });
    return null;
  }

  const ws = wb.Sheets[wb.SheetNames[0]];
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: '' });
  if (matrix.length < 2) {
    toast.error('ملف فارغ', { description: 'يجب أن يحتوي الملف على صف عناوين وصف بيانات واحد على الأقل' });
    return null;
  }

  const expectedHeaders = buildFuelIoHeaders(dayArr);
  const actualHeaders = (matrix[0] || []).map((h) => String(h ?? '').trim());
  if (actualHeaders.length !== expectedHeaders.length) {
    toast.error('هيكل الملف غير صحيح', {
      description: `عدد الأعمدة المتوقع: ${expectedHeaders.length}، والموجود: ${actualHeaders.length}. استخدم القالب الصحيح لهذا الشهر`,
    });
    return null;
  }

  const errors: string[] = [];
  const matrixByName = new Map<string, { day: number; value: number }[]>();
  const importedNames: string[] = [];

  matrix.slice(1).forEach((rawRow, idx) => {
    const line = Array.isArray(rawRow) ? rawRow : [];
    const name = String(line[0] ?? '').trim();
    if (!name) return;
    importedNames.push(name);

    const cells: { day: number; value: number }[] = [];
    dayArr.forEach((day, colIdx) => {
      const raw = line[colIdx + 1];
      if (raw === '' || raw === null || raw === undefined) return;
      const val = parseNumericCell(raw);
      if (Number.isNaN(val)) {
        errors.push(`صف ${idx + 2}, اليوم ${day}: قيمة غير صحيحة "${String(raw)}"`);
        return;
      }
      if (val < 0) {
        errors.push(`صف ${idx + 2}, اليوم ${day}: القيمة لا يمكن أن تكون سالبة`);
        return;
      }
      cells.push({ day, value: val });
    });
    matrixByName.set(name, [...(matrixByName.get(name) ?? []), ...cells]);
  });

  if (importedNames.length === 0) {
    toast.error('لا توجد بيانات للاستيراد', { description: 'الملف لا يحتوي على أسماء مناديب في العمود الأول' });
    return null;
  }

  const { matched, unmatched } = matchEmployeeNames(importedNames, employees);

  return { rows: [], unmatched, matched, matrixByName, errors };
}

/** Builds the final upsert payloads once every imported name is resolved to an employee id. */
export function buildFuelImportRows(params: {
  matrixByName: Map<string, { day: number; value: number }[]>;
  nameMapping: Map<string, string>;
  metric: FuelMetric;
  year: number;
  month: number;
  dailyLookup: Map<string, { km: number; fuel: number }>;
}): FuelImportRowPayload[] {
  const { matrixByName, nameMapping, metric, year, month, dailyLookup } = params;
  const rows: FuelImportRowPayload[] = [];

  matrixByName.forEach((cells, name) => {
    const employeeId = nameMapping.get(name);
    if (!employeeId) return;
    cells.forEach(({ day, value }) => {
      const date = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const existing = dailyLookup.get(`${employeeId}::${date}`);
      rows.push({
        employee_id: employeeId,
        date,
        km_total: metric === 'km' ? value : existing?.km ?? 0,
        fuel_cost: metric === 'fuel' ? value : existing?.fuel ?? 0,
        notes: null,
      });
    });
  });

  return rows;
}

export async function runFuelImportUpload(params: {
  rows: FuelImportRowPayload[];
  bulkUpsertDailyMileage: (rows: FuelImportRowPayload[], chunkSize?: number) => Promise<{ saved: number; failed: { row: FuelImportRowPayload; error: string }[] }>;
}): Promise<{ saved: number; failed: number }> {
  const { rows, bulkUpsertDailyMileage } = params;
  if (rows.length === 0) {
    toast.error('لا توجد بيانات صالحة للاستيراد');
    return { saved: 0, failed: 0 };
  }
  try {
    const { saved, failed } = await bulkUpsertDailyMileage(rows);
    if (failed.length > 0) {
      toast.warning('تم الاستيراد مع تحذيرات', {
        description: `✅ نجح: ${saved} | ⚠️ فشل: ${failed.length}`,
        duration: 8000,
      });
    } else {
      toast.success('تم الاستيراد بنجاح', { description: `تم حفظ ${saved} إدخال` });
    }
    return { saved, failed: failed.length };
  } catch (err) {
    logError('[Fuel] bulk import failed', err);
    toast.error('فشل الاستيراد', { description: getErrorMessage(err) });
    return { saved: 0, failed: rows.length };
  }
}
