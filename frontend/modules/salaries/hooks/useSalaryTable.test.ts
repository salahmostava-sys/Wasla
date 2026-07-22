import { describe, expect, it } from 'vitest';
import { computeSalaryRow } from './useSalaryTable';
import type { SalaryRow } from '@modules/salaries/types/salary.types';

const buildRow = (overrides: Partial<SalaryRow> = {}): SalaryRow => ({
  id: 'row-1',
  dbId: null,
  dbVersion: null,
  employeeId: 'emp-1',
  employeeName: 'Employee One',
  jobTitle: 'Driver',
  nationalId: '1234567890',
  city: 'Makkah',
  cityKey: 'makkah',
  bankAccount: '123456789',
  hasIban: true,
  paymentMethod: 'bank',
  registeredApps: ['Keeta', 'Talabat'],
  platformOrders: { Keeta: 210, Talabat: 332 },
  platformSalaries: { Keeta: 1200, Talabat: 1710 },
  platformMetrics: {},
  incentives: 50,
  sickAllowance: 40,
  violations: 30,
  customDeductions: { manual: 10 },
  transfer: 500,
  advanceDeduction: 100,
  advanceInstallmentIds: [],
  advanceRemaining: 0,
  externalDeduction: 20,
  status: 'pending',
  preferredLanguage: 'ar',
  phone: null,
  workDays: 26,
  fuelCost: 0,
  kilometers: 0,
  platformIncome: 0,
  engineBaseSalary: 542,
  ...overrides,
});

describe('computeSalaryRow', () => {
  it('uses summed platform salaries when they are available', () => {
    const result = computeSalaryRow(buildRow());

    expect(result.totalPlatformSalary).toBe(2910);
    expect(result.totalAdditions).toBe(90);
    expect(result.totalDeductions).toBe(160);
    expect(result.netSalary).toBe(2840);
    expect(result.remaining).toBe(2340);
  });

  it('falls back to engineBaseSalary when no platform salary entries exist', () => {
    const result = computeSalaryRow(
      buildRow({
        platformSalaries: {},
        engineBaseSalary: 1800,
      }),
    );

    expect(result.totalPlatformSalary).toBe(1800);
  });

  it('falls back to engineBaseSalary when platform salary entries are present but all zero', () => {
    const result = computeSalaryRow(
      buildRow({
        platformSalaries: { Keeta: 0, Talabat: 0 },
        engineBaseSalary: 2100,
      }),
    );

    expect(result.totalPlatformSalary).toBe(2100);
  });
});
