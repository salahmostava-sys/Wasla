/**
 * buildSalarySlipFields — Transforms a SalaryRow into SlipField[].
 *
 * This is the bridge between the data layer (SalaryRow) and the HTML builder.
 * All labels come from the translation dictionary. All values are computed dynamically.
 * To make fields DB-driven in the future, replace this function with one that reads config.
 */

import type { SalaryRow, MergedPdfComputed } from '@modules/salaries/types/salary.types';
import type { SlipTranslations } from '@shared/lib/salarySlipTranslations';
import type { SlipField, SlipPlatformRow, SlipEmployeeInfo } from './buildSalarySlipHTML';

// ─── Field Builder ───────────────────────────────────────────────────────────

function getStatusLabel(status: string, t: SlipTranslations): string {
  if (status === 'approved') return t.statusApproved;
  if (status === 'paid') return t.statusPaid;
  return t.statusPending;
}

export function buildSlipFieldsFromRow(
  row: SalaryRow,
  computed: MergedPdfComputed,
  t: SlipTranslations,
): SlipField[] {
  const fields: SlipField[] = [];

  // ── Info fields ───────────────────────────────────────────────────────────
  fields.push(
    { key: 'name', label: t.name, value: row.employeeName, type: 'info' },
    { key: 'nationalId', label: t.nationalId, value: row.nationalId || '—', type: 'info' },
    { key: 'jobTitle', label: 'المسمى الوظيفي', value: row.jobTitle || '—', type: 'info' },
    { key: 'city', label: t.city, value: row.city || '—', type: 'info' },
    { key: 'month', label: t.month, value: '—', type: 'info' },
    { key: 'status', label: t.status, value: getStatusLabel(row.status, t), type: 'info' },
    { key: 'paymentMethod', label: t.paymentMethod, value: row.paymentMethod === 'bank' ? t.payBank : t.payCash, type: 'info' },
  );

  if (row.phone) {
    fields.push({ key: 'phone', label: 'الجوال', value: row.phone, type: 'info' });
  }

  if (row.paymentMethod === 'bank' && row.bankAccount) {
    fields.push({ key: 'bankAccount', label: 'الآيبان / الحساب', value: row.bankAccount, type: 'info' });
  }

  // ── Earning fields ────────────────────────────────────────────────────────
  fields.push(
    { key: 'workDays', label: 'أيام العمل', value: row.workDays ?? 0, type: 'info' },
    { key: 'fuelCost', label: 'تكلفة البنزين', value: `${(row.fuelCost ?? 0).toLocaleString('en-US')} ${t.currency}`, type: 'info' },
    { key: 'platformIncome', label: 'دخل المنصات', value: `${(row.platformIncome ?? 0).toLocaleString('en-US')} ${t.currency}`, type: 'info' },
    { key: 'baseSalary', label: t.platformTotal, value: computed.totalPlatformSalary, type: 'earning', color: 'blue' },
    ...(row.incentives > 0 ? [{ key: 'incentives', label: t.incentives, value: row.incentives, type: 'earning' as const, color: 'green' as const }] : []),
    ...(row.sickAllowance > 0 ? [{ key: 'sickAllowance', label: t.sickAllowance, value: row.sickAllowance, type: 'earning' as const, color: 'green' as const }] : []),
    // ── Earning total ───────────────────────────────────────────────────────
    { key: 'totalEarnings', label: t.totalWithSalary, value: computed.totalWithSalary, type: 'total', color: 'blue' },
  );

  // ── Deduction fields ──────────────────────────────────────────────────────
  if (row.advanceDeduction > 0) {
    fields.push({ key: 'advanceDeduction', label: t.advanceInstallment, value: row.advanceDeduction, type: 'deduction', color: 'red' });
  }

  if (row.externalDeduction > 0) {
    fields.push({ key: 'externalDeduction', label: t.externalDeductions, value: row.externalDeduction, type: 'deduction', color: 'red' });
  }

  if (row.violations > 0) {
    fields.push({ key: 'violations', label: t.violations, value: row.violations, type: 'deduction', color: 'red' });
  }

  // Custom columns (dynamic from DB — can be deductions or earnings)
  if (row.customDeductions) {
    Object.entries(row.customDeductions).forEach(([key, val]) => {
      if (val > 0) {
        const label = key.split('___').slice(1).join('___') || key;
        fields.push({ key: `custom_${key}`, label, value: val, type: 'deduction', color: 'red' });
      }
    });
  }
  // NOTE: customEarnings is not part of SalaryRow type yet.
  // When this feature is implemented, add customEarnings to SalaryRow type
  // and remove the unsafe cast. See ISSUE #12 in the salary audit report.

  if (row.advanceRemaining > 0) {
    fields.push({ key: 'advanceRemaining', label: t.advanceBalance, value: row.advanceRemaining, type: 'deduction', color: 'orange' });
  }

  // ── Deduction total ───────────────────────────────────────────────────────
  if (computed.totalDeductions > 0) {
    fields.push({
      key: 'totalDeductions',
      label: t.totalDeductions,
      value: computed.totalDeductions,
      type: 'total',
      color: 'red',
    });
  }

  // ── Net salary ────────────────────────────────────────────────────────────
  fields.push({
    key: 'netSalary',
    label: t.netSalary,
    value: computed.netSalary,
    type: 'net',
    color: 'green',
  });

  // ── Transfer & remaining ──────────────────────────────────────────────────
  if (row.transfer > 0) {
    fields.push(
      { key: 'transfer', label: t.transfer, value: row.transfer, type: 'total', color: 'blue' },
      { key: 'remaining', label: t.remaining, value: computed.remaining, type: 'total', color: 'orange' },
    );
  }

  return fields;
}

// ─── Platform Rows Builder ───────────────────────────────────────────────────

export function buildSlipPlatformRows(row: SalaryRow): SlipPlatformRow[] {
  return row.registeredApps
    .filter(app => (row.platformOrders[app] || 0) > 0)
    .map(app => ({
      name: app,
      orders: row.platformOrders[app] || 0,
      salary: row.platformSalaries[app] || 0,
    }));
}

// ─── Employee Info Builder ───────────────────────────────────────────────────

export function buildSlipEmployeeInfo(
  row: SalaryRow,
  monthLabel: string,
  companyName?: string,
): SlipEmployeeInfo {
  return {
    name: row.employeeName,
    nationalId: row.nationalId || '—',
    jobTitle: row.jobTitle || '—',
    city: row.city || '—',
    month: monthLabel,
    status: row.status,
    paymentMethod: row.paymentMethod === 'bank' ? '🏦 تحويل بنكي' : '💵 نقدي',
    phone: row.phone,
    bankAccount: row.bankAccount,
    companyName,
  };
}
