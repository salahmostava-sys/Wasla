import * as XLSX from 'xlsx';
import type { WorkBook } from 'xlsx';
import { parseExcelDate } from '@shared/lib/excelDateParse';
import { employeeService } from '@services/employeeService';
import { EMPLOYEE_IMPORT_COLUMNS } from '@shared/constants/excelSchemas';
import { normalizeEmployeeCities } from '@modules/employees/model/employeeCity';

type DbKey =
  | 'name'
  | 'name_en'
  | 'national_id'
  | 'phone'
  | 'email'
  | 'cities'
  | 'nationality'
  | 'job_title'
  | 'join_date'
  | 'birth_date'
  | 'probation_end_date'
  | 'residency_expiry'
  | 'health_insurance_expiry'
  | 'license_expiry'
  | 'license_status'
  | 'sponsorship_status'
  | 'bank_account_number'
  | 'iban'
  | 'commercial_record'
  | 'salary_type'
  | 'status'
  | 'base_salary';

const HEADER_TO_DB: Record<string, DbKey> = Object.fromEntries(
  EMPLOYEE_IMPORT_COLUMNS.map((c) => [c.label, c.key])
);
export const EMPLOYEE_TEMPLATE_AR_HEADERS = EMPLOYEE_IMPORT_COLUMNS.map((column) => column.label) as readonly string[];

function toSafeText(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return '';
  }
}

function normalizeHeaderCell(raw: unknown): string {
  return toSafeText(raw)
    .replaceAll('\uFEFF', '')
    .replaceAll(/\s+/g, ' ')
    .trim();
}

function strVal(v: unknown): string | undefined {
  if (v === undefined || v === null || v === '') return undefined;
  const s = toSafeText(v).trim();
  return s === '' ? undefined : s;
}

export type EmployeeArabicCell = string | number | string[] | null;
export type EmployeeArabicRow = Partial<Record<DbKey, EmployeeArabicCell>>;

const DATE_DB_KEYS = new Set<DbKey>([
  'join_date',
  'birth_date',
  'probation_end_date',
  'residency_expiry',
  'health_insurance_expiry',
  'license_expiry',
]);

function isDateDbKey(key: DbKey): boolean {
  return DATE_DB_KEYS.has(key);
}

function parseEnumValue(key: DbKey, raw: unknown): string | undefined {
  const v = toSafeText(raw).trim().toLowerCase();
  if (key === 'salary_type') return v === 'orders' || v === 'shift' ? v : undefined;
  if (key === 'status') return v === 'active' || v === 'inactive' || v === 'ended' ? v : undefined;
  if (key === 'license_status') return v === 'has_license' || v === 'no_license' || v === 'applied' ? v : undefined;
  if (key === 'sponsorship_status') {
    return ['sponsored', 'not_sponsored', 'absconded', 'terminated'].includes(v) ? v : undefined;
  }
  return undefined;
}

function parseCellByDbKey(key: DbKey, raw: unknown): EmployeeArabicCell | undefined {
  if (isDateDbKey(key)) return parseExcelDate(raw) ?? undefined;
  if (key === 'cities') {
    const parsed = normalizeEmployeeCities([strVal(raw)]);
    return parsed.length > 0 ? parsed : undefined;
  }
  const enumValue = parseEnumValue(key, raw);
  if (enumValue !== undefined) return enumValue;
  return strVal(raw);
}

async function resolveEmployeeIdByKeys(
  row: EmployeeArabicRow,
  svc: typeof employeeService
): Promise<string | null> {
  const nid = strVal(row.national_id);
  if (!nid) return null;
  const existingByNid = await svc.findByNationalId(nid);
  return existingByNid?.id ?? null;
}

function isMatrixRowEmpty(line: unknown[] | undefined): boolean {
  if (!line) return true;
  return line.every((cell) => cell === '' || cell === null || cell === undefined);
}

function mapHeadersToDbKeysStrict(
  headerRow: string[],
  headerErrors: string[]
): (DbKey | null)[] {
  if (headerRow.length !== EMPLOYEE_IMPORT_COLUMNS.length) {
    headerErrors.push(`??? ??????? ??? ????: ??????? ${EMPLOYEE_IMPORT_COLUMNS.length}? ???????? ${headerRow.length}`);
    return [];
  }
  return headerRow.map((h, idx) => {
    const expected = EMPLOYEE_IMPORT_COLUMNS[idx].label;
    if (h !== expected) {
      headerErrors.push(`?????? ??? ${idx + 1} ??? ????: ??????? "${expected}" ???????? "${h || '????'}"`);
      return null;
    }
    return HEADER_TO_DB[h] ?? null;
  });
}

function parseEmployeeDataRow(
  line: unknown[],
  colIndexToKey: (DbKey | null)[]
): EmployeeArabicRow | null {
  const obj: EmployeeArabicRow = {};
  let hasAny = false;
  for (let c = 0; c < colIndexToKey.length; c++) {
    const key = colIndexToKey[c];
    if (!key) continue;
    const raw = line[c];
    if (raw === '' || raw === null || raw === undefined) continue;
    hasAny = true;
    const parsed = parseCellByDbKey(key, raw);
    if (parsed !== undefined) obj[key] = parsed;
  }
  return hasAny ? obj : null;
}

/**
 * Read first sheet: row 0 = headers (Arabic), following rows = data.
 * Maps Arabic headers to DB field keys.
 */
export function parseEmployeeArabicWorkbook(buffer: ArrayBuffer): {
  rows: EmployeeArabicRow[];
  headerErrors: string[];
} {
  const headerErrors: string[] = [];
  let wb: WorkBook;
  try {
    wb = XLSX.read(buffer, { type: 'array', cellDates: false });
  } catch {
    return { rows: [], headerErrors: ['???? ????? ??? Excel'] };
  }
  const sheetName = wb.SheetNames[0];
  if (!sheetName) return { rows: [], headerErrors: ['????? ?? ????? ??? ????? ???'] };

  const ws = wb.Sheets[sheetName];
  const matrix: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

  if (matrix.length < 2) return { rows: [], headerErrors: ['?? ???? ???? ??????'] };

  const headerRow = matrix[0].map(normalizeHeaderCell);
  const colIndexToKey = mapHeadersToDbKeysStrict(headerRow, headerErrors);
  if (headerErrors.length > 0 || !colIndexToKey.every(Boolean)) {
    return { rows: [], headerErrors: headerErrors.length > 0 ? headerErrors : ['???? ??????? ??? ????? ??????'] };
  }

  const rows: EmployeeArabicRow[] = [];
  for (let r = 1; r < matrix.length; r++) {
    const line = matrix[r];
    if (isMatrixRowEmpty(line)) continue;
    const parsedRow = parseEmployeeDataRow(line, colIndexToKey);
    if (!parsedRow) continue;
    rows.push(parsedRow);
  }

  return { rows, headerErrors: [...new Set(headerErrors)] };
}

function extractCities(row: EmployeeArabicRow): string[] {
  const raw = row.cities;
  if (Array.isArray(raw)) return normalizeEmployeeCities(raw);
  return normalizeEmployeeCities([strVal(raw)]);
}

function buildPayload(row: EmployeeArabicRow): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const keys: Array<Exclude<DbKey, 'cities' | 'base_salary'>> = [
    'name',
    'name_en',
    'national_id',
    'phone',
    'email',
    'nationality',
    'job_title',
    'join_date',
    'birth_date',
    'probation_end_date',
    'residency_expiry',
    'health_insurance_expiry',
    'license_expiry',
    'license_status',
    'sponsorship_status',
    'bank_account_number',
    'iban',
    'commercial_record',
    'salary_type',
    'status',
  ];
  for (const k of keys) {
    const v = row[k];
    if (v !== undefined && v !== null && v !== '') out[k] = v;
  }

  const cities = extractCities(row);
  out.cities = cities;
  out.city = cities[0] ?? null;

  const st = row.salary_type;
  if (typeof st === 'string' && (st === 'orders' || st === 'shift')) out.salary_type = st;
  else out.salary_type = 'shift';

  const baseSalary = Number(row.base_salary ?? 0);
  out.base_salary = Number.isFinite(baseSalary) ? baseSalary : 0;
  if (!out.status) out.status = 'active';
  if (!out.sponsorship_status) out.sponsorship_status = 'not_sponsored';
  return out;
}

/**
 * Upsert rows: match by national_id; otherwise insert.
 */
export async function upsertEmployeeArabicRows(
  rows: EmployeeArabicRow[],
  svc: typeof employeeService = employeeService
): Promise<{ processed: number; failures: { name: string; error: string }[] }> {
  const failures: { name: string; error: string }[] = [];
  let processed = 0;

  for (const row of rows) {
    const nameHint = strVal(row.name) ?? strVal(row.national_id) ?? '-';
    try {
      const nm = strVal(row.name);
      if (!nm) {
        failures.push({ name: nameHint, error: '????? ?????' });
        continue;
      }

      const payload = buildPayload({ ...row, name: nm });
      const empId = await resolveEmployeeIdByKeys(row, svc);

      if (empId) {
        await svc.updateEmployee(empId, payload);
      } else {
        await svc.createEmployee(payload);
      }
      processed++;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      failures.push({ name: nameHint, error: msg });
    }
  }

  return { processed, failures };
}