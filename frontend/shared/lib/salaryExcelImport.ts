import * as XLSX from 'xlsx';
import type { WorkBook } from 'xlsx';
import { isEmployeeIdUuid, isValidSalaryMonthYear, parseSalaryAmount } from '@shared/lib/salaryValidation';

export const SALARY_IO_COLUMNS = [
  { key: 'employee_id', label: 'معرف الموظف' },
  { key: 'month_year', label: 'الشهر والسنة' },
  { key: 'base_salary', label: 'الراتب الأساسي' },
  { key: 'allowances', label: 'البدلات' },
  { key: 'attendance_deduction', label: 'خصم الحضور' },
  { key: 'advance_deduction', label: 'خصم السلفة' },
  { key: 'external_deduction', label: 'خصم خارجي' },
  { key: 'manual_deduction', label: 'خصم يدوي' },
  { key: 'net_salary', label: 'صافي الراتب' },
  { key: 'is_approved', label: 'معتمد' },
] as const;

export type SalaryIoKey = typeof SALARY_IO_COLUMNS[number]['key'];

export type SalaryIoRecord = {
  employee_id: string;
  month_year: string;
  base_salary: number;
  allowances: number;
  attendance_deduction: number;
  advance_deduction: number;
  external_deduction: number;
  manual_deduction: number;
  net_salary: number;
  is_approved: boolean;
};

export const SALARY_IMPORT_TEMPLATE_HEADERS = SALARY_IO_COLUMNS.map((c) => c.label);

const HEADER_LABEL_TO_KEY: Record<string, SalaryIoKey> = Object.fromEntries(
  SALARY_IO_COLUMNS.map((c) => [c.label, c.key])
);

type SalaryImportMapped = Partial<SalaryIoRecord>;
const NUMERIC_KEYS = new Set<keyof SalaryImportMapped>([
  'base_salary',
  'allowances',
  'attendance_deduction',
  'advance_deduction',
  'external_deduction',
  'manual_deduction',
  'net_salary',
]);

function normalizeHeader(raw: unknown): string {
  return String(raw ?? '')
    .replaceAll('\uFEFF', '')
    .replaceAll(/\s+/g, ' ')
    .trim();
}

function parseApproved(val: unknown): boolean {
  if (typeof val === 'boolean') return val;
  const s = String(val ?? '').trim().toLowerCase();
  if (s === '1' || s === 'true' || s === 'yes' || s === 'نعم' || s === 'معتمد') return true;
  return false;
}

function parseMappedCell(
  key: keyof SalaryImportMapped,
  cell: unknown,
  raw: Partial<SalaryImportMapped>
): void {
  if (key === 'employee_id') {
    raw.employee_id = String(cell).trim();
    return;
  }
  if (key === 'month_year') {
    raw.month_year = String(cell).trim();
    return;
  }
  if (key === 'is_approved') {
    raw.is_approved = parseApproved(cell);
    return;
  }
  if (NUMERIC_KEYS.has(key)) {
    raw[key] = parseSalaryAmount(cell);
  }
}

function mapHeadersToKeysStrict(headerRow: string[], parseErrors: string[]): (SalaryIoKey | null)[] {
  const expected = SALARY_IMPORT_TEMPLATE_HEADERS;
  if (headerRow.length !== expected.length) {
    parseErrors.push(`عدد الأعمدة غير صحيح: المتوقع ${expected.length}، والموجود ${headerRow.length}`);
    return [];
  }

  return headerRow.map((h, idx) => {
    const expectedLabel = expected[idx];
    if (h !== expectedLabel) {
      parseErrors.push(`العمود رقم ${idx + 1} غير صحيح: المتوقع "${expectedLabel}" والموجود "${h || 'فارغ'}"`);
      return null;
    }
    return HEADER_LABEL_TO_KEY[h] ?? null;
  });
}

function isEmptyLine(line: unknown[] | undefined): boolean {
  if (!line) return true;
  return line.every((cell) => cell === '' || cell === null || cell === undefined);
}

function parseRawRow(line: unknown[], colToKey: (SalaryIoKey | null)[]): Partial<SalaryImportMapped> {
  const raw: Partial<SalaryImportMapped> = {};
  for (let c = 0; c < colToKey.length; c++) {
    const key = colToKey[c];
    if (!key) continue;
    const cell = line[c];
    if (cell === '' || cell === null || cell === undefined) continue;
    parseMappedCell(key, cell, raw);
  }
  return raw;
}

function resolveMonthYear(raw: Partial<SalaryImportMapped>, defaultMy?: string): string | undefined {
  const direct = raw.month_year?.trim();
  if (direct && isValidSalaryMonthYear(direct)) return direct;
  if (defaultMy && isValidSalaryMonthYear(defaultMy)) return defaultMy;
  return direct;
}

function formatPayload(raw: Partial<SalaryImportMapped>, employeeId: string, monthYear: string): Record<string, unknown> {
  return {
    employee_id: employeeId,
    month_year: monthYear,
    base_salary: Number(raw.base_salary ?? 0),
    allowances: Number(raw.allowances ?? 0),
    attendance_deduction: Number(raw.attendance_deduction ?? 0),
    advance_deduction: Number(raw.advance_deduction ?? 0),
    external_deduction: Number(raw.external_deduction ?? 0),
    manual_deduction: Number(raw.manual_deduction ?? 0),
    net_salary: Number(raw.net_salary ?? 0),
    is_approved: raw.is_approved ?? false,
    payment_method: 'cash',
  };
}

export type SalaryImportRowResult = {
  record: Record<string, unknown>;
  rowIndex: number;
};

/**
 * Parse first sheet using strict header order from `SALARY_IO_COLUMNS`.
 * `defaultMonthYear` applies only when `month_year` cell is empty.
 */
export function parseSalaryImportWorkbook(
  buffer: ArrayBuffer,
  options: { defaultMonthYear?: string }
): { rows: SalaryImportRowResult[]; parseErrors: string[] } {
  const parseErrors: string[] = [];
  let wb: WorkBook;
  try {
    wb = XLSX.read(buffer, { type: 'array', cellDates: false });
  } catch {
    return { rows: [], parseErrors: ['تعذر قراءة ملف Excel'] };
  }
  const sheetName = wb.SheetNames[0];
  if (!sheetName) return { rows: [], parseErrors: ['الملف لا يحتوي على أوراق عمل'] };

  const ws = wb.Sheets[sheetName];
  const matrix: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
  if (matrix.length < 2) return { rows: [], parseErrors: ['لا توجد صفوف بيانات'] };

  const headerRow = matrix[0].map(normalizeHeader);
  const colToKey = mapHeadersToKeysStrict(headerRow, parseErrors);
  if (parseErrors.length > 0 || !colToKey.every(Boolean)) {
    return { rows: [], parseErrors: parseErrors.length > 0 ? parseErrors : ['هيكل الأعمدة غير مطابق للقالب'] };
  }

  const defaultMy = options.defaultMonthYear?.trim();
  const rows: SalaryImportRowResult[] = [];

  for (let r = 1; r < matrix.length; r++) {
    const line = matrix[r];
    if (isEmptyLine(line)) continue;
    const raw = parseRawRow(line, colToKey);

    const monthYear = resolveMonthYear(raw, defaultMy);

    const employeeId = raw.employee_id?.trim();
    if (!employeeId || !isEmployeeIdUuid(employeeId)) {
      parseErrors.push(`صف ${r + 1}: معرف موظف غير صالح`);
      continue;
    }
    if (!monthYear || !isValidSalaryMonthYear(monthYear)) {
      parseErrors.push(`صف ${r + 1}: الشهر والسنة غير صالحين`);
      continue;
    }

    const record = formatPayload(raw, employeeId, monthYear);

    rows.push({ record, rowIndex: r + 1 });
  }

  return { rows, parseErrors: [...new Set(parseErrors)] };
}
