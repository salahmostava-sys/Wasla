/**
 * Saudi WPS / Mudad wage-file builders (pure, framework-free — unit tested).
 *
 * IMPORTANT: the exact column layout differs by bank and by Mudad version.
 * These builders emit the standard SAMA/Mudad field set; the final column
 * order/labels must be verified against your bank's or Mudad's own template
 * before the file is submitted. The file keys on the numeric bank code, which
 * is derived reliably from each IBAN.
 *
 * Design note: housing allowance is not tracked in this system, so it is
 * emitted as 0 and all additions go to "other allowances". Basic = base salary.
 */
import { deriveSaudiBankCode, isValidSaudiIban, normalizeIban } from '@shared/lib/saudiBank';

export interface WpsEmployeeInput {
  employeeId: string;
  name: string;
  nationalId: string;
  iban: string;
  paymentMethod: 'bank' | 'cash';
  basicSalary: number;
  otherAllowances: number;
  deductions: number;
  netSalary: number;
}

export interface WpsEstablishment {
  companyName: string;
  molEstablishmentNumber: string;
  employerIban: string;
  employerBankCode: string | null;
}

export interface WpsRow {
  name: string;
  nationalId: string;
  iban: string;
  bankCode: string;
  basicSalary: number;
  housingAllowance: number;
  otherAllowances: number;
  deductions: number;
  netSalary: number;
}

export interface WpsNotice {
  name: string;
  reason: string;
}

export interface WpsBuildResult {
  included: WpsRow[];
  excluded: WpsNotice[];
  warnings: WpsNotice[];
}

/** Minimum net-to-gross ratio the labor system requires (Mudad rejects below this). */
export const WPS_MIN_NET_RATIO = 0.5;

const round2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

export function buildWpsExport(inputs: WpsEmployeeInput[]): WpsBuildResult {
  const included: WpsRow[] = [];
  const excluded: WpsNotice[] = [];
  const warnings: WpsNotice[] = [];

  for (const emp of inputs) {
    const iban = normalizeIban(emp.iban);

    if (emp.paymentMethod !== 'bank') {
      excluded.push({ name: emp.name, reason: 'payment_method_cash' });
      continue;
    }
    if (!isValidSaudiIban(iban)) {
      excluded.push({ name: emp.name, reason: 'invalid_iban' });
      continue;
    }

    const basicSalary = round2(emp.basicSalary);
    const otherAllowances = round2(emp.otherAllowances);
    const deductions = round2(emp.deductions);
    const netSalary = round2(emp.netSalary);
    const gross = basicSalary + otherAllowances; // housing is 0

    if (gross > 0 && netSalary < WPS_MIN_NET_RATIO * gross) {
      warnings.push({ name: emp.name, reason: 'net_below_half_gross' });
    }

    included.push({
      name: emp.name,
      nationalId: emp.nationalId,
      iban,
      bankCode: deriveSaudiBankCode(iban) ?? '',
      basicSalary,
      housingAllowance: 0,
      otherAllowances,
      deductions,
      netSalary,
    });
  }

  return { included, excluded, warnings };
}

// Standard column set (Arabic labels). Order is easy to adjust to match a bank
// or Mudad template.
export const WPS_COLUMNS: ReadonlyArray<{ key: keyof WpsRow; label: string }> = [
  { key: 'nationalId', label: 'رقم الهوية/الإقامة' },
  { key: 'name', label: 'اسم الموظف' },
  { key: 'iban', label: 'الآيبان' },
  { key: 'bankCode', label: 'كود البنك' },
  { key: 'basicSalary', label: 'الراتب الأساسي' },
  { key: 'housingAllowance', label: 'بدل السكن' },
  { key: 'otherAllowances', label: 'بدلات أخرى' },
  { key: 'deductions', label: 'الاستقطاعات' },
  { key: 'netSalary', label: 'صافي الراتب' },
];

const csvCell = (value: string | number): string => {
  const s = String(value ?? '');
  return /[",\r\n]/u.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
};

/** Mudad-style CSV: header row + one row per included employee. */
export function toMudadCsv(rows: WpsRow[], monthYear: string): string {
  const header = [...WPS_COLUMNS.map((c) => c.label), 'الشهر'];
  const lines = [header.map(csvCell).join(',')];
  for (const row of rows) {
    const cells = WPS_COLUMNS.map((c) => row[c.key]);
    lines.push([...cells, monthYear].map(csvCell).join(','));
  }
  return lines.join('\r\n');
}

/**
 * Bank-file worksheet as an array-of-arrays (fed to SheetJS by the caller):
 * establishment header block, then the employee table.
 */
export function toBankWpsAoa(
  rows: WpsRow[],
  establishment: WpsEstablishment,
  monthYear: string,
): (string | number)[][] {
  return [
    ['ملف حماية الأجور (WPS)'],
    ['المنشأة', establishment.companyName],
    ['رقم المنشأة (مكتب العمل)', establishment.molEstablishmentNumber],
    ['آيبان المنشأة', establishment.employerIban],
    ['كود بنك المنشأة', establishment.employerBankCode ?? ''],
    ['الشهر', monthYear],
    [],
    WPS_COLUMNS.map((c) => c.label),
    ...rows.map((row) => WPS_COLUMNS.map((c) => row[c.key])),
  ];
}
