import { describe, expect, it } from 'vitest';
import {
  buildWpsExport,
  toBankWpsAoa,
  toMudadCsv,
  WPS_COLUMNS,
  type WpsEmployeeInput,
  type WpsEstablishment,
} from './wpsExport';

const VALID_IBAN = 'SA0380000000608010167519'; // 24 chars, bank code 80

const baseEmp = (over: Partial<WpsEmployeeInput> = {}): WpsEmployeeInput => ({
  employeeId: 'e1',
  name: 'أحمد السيد',
  nationalId: '1234567890',
  iban: VALID_IBAN,
  paymentMethod: 'bank',
  basicSalary: 3000,
  otherAllowances: 500,
  deductions: 200,
  netSalary: 3300,
  ...over,
});

describe('buildWpsExport', () => {
  it('includes a valid bank employee and derives the bank code from the IBAN', () => {
    const { included, excluded, warnings } = buildWpsExport([baseEmp()]);
    expect(excluded).toHaveLength(0);
    expect(warnings).toHaveLength(0);
    expect(included).toHaveLength(1);
    expect(included[0].bankCode).toBe('80');
    expect(included[0].housingAllowance).toBe(0);
    expect(included[0].netSalary).toBe(3300);
  });

  it('excludes cash-paid employees', () => {
    const { included, excluded } = buildWpsExport([baseEmp({ paymentMethod: 'cash' })]);
    expect(included).toHaveLength(0);
    expect(excluded).toEqual([{ name: 'أحمد السيد', reason: 'payment_method_cash' }]);
  });

  it('excludes employees with an invalid Saudi IBAN', () => {
    const { included, excluded } = buildWpsExport([baseEmp({ iban: 'SA123' })]);
    expect(included).toHaveLength(0);
    expect(excluded[0].reason).toBe('invalid_iban');
  });

  it('warns when net salary is below 50% of gross', () => {
    // gross = 3000 + 500 = 3500; net 1000 < 1750 → warning, still included
    const { included, warnings } = buildWpsExport([baseEmp({ deductions: 2500, netSalary: 1000 })]);
    expect(included).toHaveLength(1);
    expect(warnings).toEqual([{ name: 'أحمد السيد', reason: 'net_below_half_gross' }]);
  });
});

describe('toMudadCsv', () => {
  it('emits a header row plus one row per included employee with the month appended', () => {
    const { included } = buildWpsExport([baseEmp()]);
    const csv = toMudadCsv(included, '2026-07');
    const lines = csv.split('\r\n');
    expect(lines).toHaveLength(2);
    expect(lines[0]).toContain('الآيبان');
    expect(lines[0].endsWith('الشهر')).toBe(true);
    expect(lines[1]).toContain(VALID_IBAN);
    expect(lines[1].endsWith('2026-07')).toBe(true);
  });

  it('escapes cells containing commas', () => {
    const { included } = buildWpsExport([baseEmp({ name: 'محمد, علي' })]);
    const csv = toMudadCsv(included, '2026-07');
    expect(csv).toContain('"محمد, علي"');
  });
});

describe('toBankWpsAoa', () => {
  it('prepends the establishment header block before the employee table', () => {
    const est: WpsEstablishment = {
      companyName: 'شركة التوصيل',
      molEstablishmentNumber: '700123',
      employerIban: VALID_IBAN,
      employerBankCode: '80',
    };
    const { included } = buildWpsExport([baseEmp()]);
    const aoa = toBankWpsAoa(included, est, '2026-07');
    expect(aoa[1]).toEqual(['المنشأة', 'شركة التوصيل']);
    expect(aoa[2]).toEqual(['رقم المنشأة (مكتب العمل)', '700123']);
    // column header row followed by one data row
    const headerIdx = aoa.findIndex((r) => r[0] === WPS_COLUMNS[0].label);
    expect(headerIdx).toBeGreaterThan(0);
    expect(aoa[headerIdx + 1][0]).toBe('1234567890');
  });
});
