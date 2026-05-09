import { escapeHtml } from '@shared/lib/security';
import { getManualDeductionTotal } from '@modules/salaries/lib/salaryDomain';
import { getPlatformActivitySummary } from '@modules/salaries/model/salaryUtils';
import type { MergedPdfComputed, SalaryRow } from '@modules/salaries/types/salary.types';

export const MERGED_PDF_STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Noto+Naskh+Arabic:wght@400;600;700&display=swap');
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Noto Naskh Arabic','Segoe UI',Tahoma,sans-serif;padding:0;color:#1a1a1a;font-size:13px;background:#fff}
  .page-break{max-width:700px;margin:0 auto;padding:24px}
  .break-before{page-break-before:always}
  .header{display:flex;align-items:center;justify-content:space-between;border-bottom:3px solid #4f46e5;padding-bottom:12px;margin-bottom:16px}
  .title{font-size:20px;font-weight:800;color:#4f46e5}
  .subtitle{font-size:11px;color:#666;margin-top:2px}
  .badge{display:inline-block;padding:2px 10px;border-radius:12px;font-size:11px;font-weight:700}
  .badge-paid{background:#dcfce7;color:#15803d}
  .badge-approved{background:#dbeafe;color:#1d4ed8}
  .badge-pending{background:#fef9c3;color:#b45309}
  .info-grid{display:grid;grid-template-columns:1fr 1fr;gap:6px;background:#f8f8ff;border-radius:8px;padding:12px;margin-bottom:14px}
  .info-row{display:flex;flex-direction:column}
  .info-label{font-size:10px;color:#888;margin-bottom:1px}
  .info-value{font-size:12px;font-weight:600;color:#111}
  h3{font-size:12px;font-weight:700;color:#4f46e5;margin:12px 0 6px;text-transform:uppercase;letter-spacing:.5px}
  table{width:100%;border-collapse:collapse;margin-bottom:10px}
  td{padding:7px 10px;border:1px solid #e5e7eb;font-size:12px}
  .label{background:#f3f4f6;font-weight:600;width:55%}
  .val-blue{color:#2563eb;font-weight:700}
  .val-green{color:#16a34a;font-weight:700}
  .val-red{color:#dc2626;font-weight:700}
  .val-orange{color:#ea580c;font-weight:600}
  .total-row td{background:#eff6ff;font-weight:700;font-size:13px}
  .deduction-total td{background:#fff1f2;font-weight:700}
  .net-row td{background:#f0fdf4;font-size:15px;font-weight:800}
  .footer{display:flex;justify-content:space-between;margin-top:28px;border-top:1px solid #ddd;padding-top:16px;font-size:11px;color:#555}
  @media print{body{padding:0}.page-break{padding:20px;max-width:100%}}
`;

export function buildMergedPlatformsRowsHtml(row: SalaryRow): string {
  if (row.registeredApps.length === 0) {
    return `<tr><td colspan="3" style="text-align:center;color:#999">لا توجد منصات مسجلة</td></tr>`;
  }
  // FIX #13: use getPlatformActivitySummary so shift-based platforms show
  // "X دوام" instead of showing 0 orders under a misleading "طلبات" column.
  return row.registeredApps
    .map((app) => {
      const metric = row.platformMetrics[app];
      const activityLabel = getPlatformActivitySummary(metric);
      const salary = row.platformSalaries[app] || 0;
      return `<tr><td class="label">${escapeHtml(app)}</td><td style="text-align:center">${activityLabel}</td><td class="val-blue" style="text-align:center">${salary.toLocaleString('en-US')} ر.س</td></tr>`;
    })
    .join('');
}

export function buildMergedAdditionsSectionHtml(row: SalaryRow, c: MergedPdfComputed): string {
  if (c.totalAdditions <= 0) return '';
  const incentivesRow = row.incentives > 0 ? `<tr><td class="label">الحوافز</td><td class="val-green">+ ${row.incentives.toLocaleString('en-US')} ر.س</td></tr>` : '';
  const sickAllowanceRow = row.sickAllowance > 0 ? `<tr><td class="label">بدل مرضي</td><td class="val-green">+ ${row.sickAllowance.toLocaleString('en-US')} ر.س</td></tr>` : '';
  return `
    <h3>الإضافات</h3>
    <table>
      ${incentivesRow}
      ${sickAllowanceRow}
      <tr class="total-row"><td class="label">المجموع مع الراتب</td><td class="val-blue">${c.totalWithSalary.toLocaleString('en-US')} ر.س</td></tr>
    </table>
  `;
}

export function buildMergedDeductionsSectionHtml(row: SalaryRow, c: MergedPdfComputed): string {
  if (c.totalDeductions <= 0) return '';
  const advanceRow = row.advanceDeduction > 0 ? `<tr><td class="label">قسط سلفة</td><td class="val-red">- ${row.advanceDeduction.toLocaleString('en-US')} ر.س</td></tr>` : '';
  const remainingAdvanceRow = row.advanceRemaining > 0 ? `<tr><td class="label">رصيد السلفة المتبقي</td><td class="val-orange">${row.advanceRemaining.toLocaleString('en-US')} ر.س</td></tr>` : '';
  const externalRow = row.externalDeduction > 0 ? `<tr><td class="label">خصومات خارجية</td><td class="val-red">- ${row.externalDeduction.toLocaleString('en-US')} ر.س</td></tr>` : '';
  const violationsRow = row.violations > 0 ? `<tr><td class="label">مخالفات</td><td class="val-red">- ${row.violations.toLocaleString('en-US')} ر.س</td></tr>` : '';
  const manual = getManualDeductionTotal(row);
  const manualRow = manual > 0 ? `<tr><td class="label">خصومات يدوية</td><td class="val-red">- ${manual.toLocaleString('en-US')} ر.س</td></tr>` : '';
  return `
    <h3>المستقطعات</h3>
    <table>
      ${advanceRow}
      ${remainingAdvanceRow}
      ${externalRow}
      ${violationsRow}
      ${manualRow}
      <tr class="deduction-total"><td class="label">إجمالي المستقطعات</td><td class="val-red">- ${c.totalDeductions.toLocaleString('en-US')} ر.س</td></tr>
    </table>
  `;
}

export function buildMergedSalaryPageHtml({
  row,
  computed,
  index,
  monthLabel,
}: {
  row: SalaryRow;
  computed: MergedPdfComputed;
  index: number;
  monthLabel: string;
}): string {
  const statusLabel = { pending: 'معلّق', approved: 'معتمد', paid: 'مصروف' }[row.status];
  const paymentMethodLabel = row.paymentMethod === 'bank' ? '🏦 تحويل بنكي' : '💵 نقدي';
  const ibanLine = row.paymentMethod === 'bank' && row.hasIban
    ? escapeHtml(row.bankAccount || '')
    : (row.paymentMethod === 'bank' ? '—' : 'لا يُصرف تحويلاً');
  const transferRows =
    row.transfer > 0
      ? `<tr><td class="label">المبلغ المحوّل</td><td>${row.transfer.toLocaleString('en-US')} ر.س</td></tr>
       <tr><td class="label">المتبقي نقداً</td><td class="val-orange">${computed.remaining.toLocaleString('en-US')} ر.س</td></tr>`
      : '';

  return `
    <div class="page-break${index > 0 ? ' break-before' : ''}">
      <div class="header">
        <div>
          <div class="title">🚀 كشف راتب شهري</div>
          <div class="subtitle">${monthLabel}</div>
        </div>
        <span class="badge badge-${row.status}">${statusLabel}</span>
      </div>
      <div class="info-grid">
        <div class="info-row"><span class="info-label">الاسم الكامل</span><span class="info-value">${escapeHtml(row.employeeName)}</span></div>
        <div class="info-row"><span class="info-label">رقم الهوية</span><span class="info-value">${escapeHtml(row.nationalId)}</span></div>
        <div class="info-row"><span class="info-label">المسمى الوظيفي</span><span class="info-value">${escapeHtml(row.jobTitle || '—')}</span></div>
        <div class="info-row"><span class="info-label">الفرع / المدينة</span><span class="info-value">${escapeHtml(row.city)}</span></div>
        <div class="info-row"><span class="info-label">الجوال</span><span class="info-value">${escapeHtml(row.phone || '—')}</span></div>
        <div class="info-row"><span class="info-label">طريقة الصرف</span><span class="info-value">${paymentMethodLabel}</span></div>
        <div class="info-row"><span class="info-label">الآيبان / الحساب</span><span class="info-value">${ibanLine}</span></div>
        <div class="info-row"><span class="info-label">أيام العمل</span><span class="info-value">${Number(row.workDays ?? 0).toLocaleString('en-US')}</span></div>
        <div class="info-row"><span class="info-label">تكلفة البنزين</span><span class="info-value">${Number(row.fuelCost ?? 0).toLocaleString('en-US')} ر.س</span></div>
        <div class="info-row"><span class="info-label">دخل المنصات</span><span class="info-value">${Number(row.platformIncome ?? 0).toLocaleString('en-US')} ر.س</span></div>
      </div>
      <h3>النشاط والراتب حسب المنصة</h3>
      <table>
        <tr><td class="label" style="background:#e0e7ff;color:#4338ca;font-weight:700">المنصة</td>
            <td style="background:#e0e7ff;color:#4338ca;font-weight:700;text-align:center">النشاط</td>
            <td style="background:#e0e7ff;color:#4338ca;font-weight:700;text-align:center">الراتب</td></tr>
        ${buildMergedPlatformsRowsHtml(row)}
        <tr class="total-row"><td class="label">إجمالي الراتب الأساسي</td><td></td><td class="val-blue" style="text-align:center">${computed.totalPlatformSalary.toLocaleString('en-US')} ر.س</td></tr>
      </table>
      ${buildMergedAdditionsSectionHtml(row, computed)}
      ${buildMergedDeductionsSectionHtml(row, computed)}
      <h3>الصافي</h3>
      <table>
        <tr class="net-row"><td class="label">إجمالي الراتب الصافي</td><td class="val-green">${computed.netSalary.toLocaleString('en-US')} ر.س</td></tr>
        ${transferRows}
      </table>
      <div class="footer">
        <div>توقيع المندوب: _______________________</div>
        <div>اعتماد المدير: _______________________</div>
        <div>التاريخ: ${new Date().toLocaleDateString('ar-SA')}</div>
      </div>
    </div>`;
}
