import { escapeHtml } from '@shared/lib/security';
import { getManualDeductionTotal } from '@modules/salaries/lib/salaryDomain';
import { getStatusStyleForPrint } from '@modules/salaries/lib/salaryConstants';
import type { SalaryRow } from '@modules/salaries/types/salary.types';
import type { computeSalaryRow } from '@modules/salaries/hooks/useSalaryTable';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface PrintTableParams {
  rows: SalaryRow[];
  platforms: string[];
  platformColors: Record<string, { header: string; headerText: string }>;
  monthLabel: string;
  projectName: string;
  computeRow: (r: SalaryRow) => ReturnType<typeof computeSalaryRow>;
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const PRINT_STYLES = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Noto Naskh Arabic', 'Segoe UI', Tahoma, sans-serif; padding: 24px; color: #111; background: #fff; font-size: 12px; }
  .header { display: flex; align-items: flex-start; justify-content: space-between; border-bottom: 3px solid #4f46e5; padding-bottom: 14px; margin-bottom: 20px; }
  .company-name { font-size: 22px; font-weight: 900; color: #4f46e5; }
  .report-title { font-size: 15px; font-weight: 700; color: #333; margin-top: 4px; }
  .report-meta { font-size: 11px; color: #777; margin-top: 2px; }
  .summary { display: flex; gap: 16px; margin-bottom: 18px; }
  .summary-card { flex: 1; background: #f8f9ff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 10px 14px; }
  .summary-label { font-size: 10px; color: #888; }
  .summary-value { font-size: 18px; font-weight: 800; color: #4f46e5; margin-top: 2px; }
  table { width: 100%; border-collapse: collapse; margin-top: 8px; }
  th { padding: 8px 10px; background: #f3f4f6; color: #555; font-size: 10px; text-align: center; border: 1px solid #ddd; white-space: normal; max-width: 88px; }
  th:first-child { text-align: right; max-width: 140px; }
  td { padding: 7px 10px; border: 1px solid #e5e7eb; font-size: 11px; white-space: normal; vertical-align: middle; }
  tr:nth-child(even) { background: #f9f9ff; }
  tr:hover { background: #f0f0ff; }
  .tfoot td { background: #eff6ff; font-weight: 800; border-top: 2px solid #4f46e5; }
  .footer { margin-top: 32px; display: flex; justify-content: space-between; font-size: 11px; color: #777; border-top: 1px solid #ddd; padding-top: 14px; }
  @media print {
    body { padding: 8px; }
    .no-print { display: none; }
    @page { margin: 10mm; size: landscape; }
  }
`;

// ─── Row builder ─────────────────────────────────────────────────────────────

function buildRowHtml(
  r: SalaryRow,
  platforms: string[],
  computeRow: PrintTableParams['computeRow'],
): string {
  const c = computeRow(r);
  const manual = getManualDeductionTotal(r);

  const platformCols = platforms
    .map((p) =>
      r.registeredApps.includes(p)
        ? `<td style="text-align:center">${r.platformOrders[p] || 0}</td>`
        : `<td style="text-align:center;color:#ccc">—</td>`,
    )
    .join('');

  const statusStyle = getStatusStyleForPrint(r.status);
  const statusLabel = { pending: 'معلّق', approved: 'معتمد', paid: 'مصروف' }[r.status];
  const payLabel = r.paymentMethod === 'bank' ? 'تحويل بنكي' : 'نقدي';
  const ibanDisp =
    r.paymentMethod === 'bank' && r.hasIban ? escapeHtml(r.bankAccount || '—') : '—';

  return `<tr>
    <td>${escapeHtml(r.employeeName)}</td>
    <td style="text-align:center;color:#555;font-size:11px">${escapeHtml(r.nationalId || '—')}</td>
    <td style="text-align:center;font-size:11px">${escapeHtml(r.jobTitle || '—')}</td>
    <td style="text-align:center">${escapeHtml(r.city || '—')}</td>
    <td style="text-align:center" dir="ltr">${escapeHtml(r.phone || '—')}</td>
    <td style="text-align:center">${payLabel}</td>
    <td style="text-align:center;font-size:10px;word-break:break-all" dir="ltr">${ibanDisp}</td>
    <td style="text-align:center">${Number(r.workDays ?? 0)}</td>
    <td style="text-align:center">${Number(r.fuelCost ?? 0).toLocaleString('en-US')}</td>
    <td style="text-align:center">${Number(r.platformIncome ?? 0).toLocaleString('en-US')}</td>
    <td style="text-align:center">${manual > 0 ? manual.toLocaleString('en-US') : '—'}</td>
    ${platformCols}
    <td style="text-align:center;font-weight:700;color:#1d4ed8">${c.totalPlatformSalary.toLocaleString('en-US')}</td>
    <td style="text-align:center">${c.totalAdditions > 0 ? `+${c.totalAdditions.toLocaleString('en-US')}` : '—'}</td>
    <td style="text-align:center;color:#dc2626">${c.totalDeductions > 0 ? `-${c.totalDeductions.toLocaleString('en-US')}` : '—'}</td>
    <td style="text-align:center;font-weight:800;font-size:14px;color:#15803d">${c.netSalary.toLocaleString('en-US')} ر.س</td>
    <td style="text-align:center">${r.transfer > 0 ? r.transfer.toLocaleString('en-US') : '—'}</td>
    <td style="text-align:center"><span style="padding:2px 8px;border-radius:10px;font-size:10px;font-weight:700;${statusStyle}">${statusLabel}</span></td>
  </tr>`;
}

// ─── Full page builder ───────────────────────────────────────────────────────

/**
 * Builds complete print-ready HTML for the salary table report.
 * This was extracted from `useSalaryActions.handlePrintTable` so that the
 * template lives in its own file and the hook stays focused on logic.
 */
export function buildSalaryTablePrintHtml(params: PrintTableParams): string {
  const { rows, platforms, monthLabel, projectName, computeRow } = params;

  const staticLeadColCount = 11;

  const rowsHtml = rows.map((r) => buildRowHtml(r, platforms, computeRow)).join('');

  const platformHeaders = platforms
    .map((p) => `<th style="background:#4f46e5;color:#fff">${escapeHtml(p)}</th>`)
    .join('');

  const totalNet = rows.reduce((s, r) => s + computeRow(r).netSalary, 0);
  const totalPlatformSalary = rows.reduce((s, r) => s + computeRow(r).totalPlatformSalary, 0);
  const totalDeductions = rows.reduce((s, r) => s + computeRow(r).totalDeductions, 0);

  return `<!DOCTYPE html><html dir="rtl"><head>
    <meta charset="utf-8">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link href="https://fonts.googleapis.com/css2?family=Noto+Naskh+Arabic:wght@400;600;700&display=swap" rel="stylesheet">
    <title>تقرير رواتب — ${monthLabel}</title>
    <style>${PRINT_STYLES}</style>
  </head><body>
    <div class="header">
      <div>
        <div class="company-name">${escapeHtml(projectName || 'مهمة التوصيل')}</div>
        <div class="report-title">تقرير الرواتب الشهرية</div>
        <div class="report-meta">${monthLabel} • تاريخ الطباعة: ${new Date().toLocaleDateString('ar-SA')} • عدد الموظفين: ${rows.length}</div>
      </div>
      <div style="text-align:left">
        <div style="font-size:11px;color:#888">إجمالي صافي الرواتب</div>
        <div style="font-size:24px;font-weight:900;color:#15803d">${totalNet.toLocaleString('en-US')} ر.س</div>
      </div>
    </div>

    <div class="summary">
      <div class="summary-card">
        <div class="summary-label">إجمالي الرواتب الأساسية</div>
        <div class="summary-value" style="color:#1d4ed8">${totalPlatformSalary.toLocaleString('en-US')} ر.س</div>
      </div>
      <div class="summary-card">
        <div class="summary-label">إجمالي المستقطعات</div>
        <div class="summary-value" style="color:#dc2626">${totalDeductions.toLocaleString('en-US')} ر.س</div>
      </div>
      <div class="summary-card">
        <div class="summary-label">صافي الرواتب</div>
        <div class="summary-value" style="color:#15803d">${totalNet.toLocaleString('en-US')} ر.س</div>
      </div>
      <div class="summary-card">
        <div class="summary-label">عدد الموظفين</div>
        <div class="summary-value">${rows.length}</div>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th style="text-align:right">اسم الموظف</th>
          <th>رقم الهوية</th>
          <th>المسمى</th>
          <th>الفرع</th>
          <th>الجوال</th>
          <th>الصرف</th>
          <th>آيبان / حساب</th>
          <th>أيام العمل</th>
          <th>البنزين</th>
          <th>دخل المنصات</th>
          <th>خصومات يدوية</th>
          ${platformHeaders}
          <th>الراتب الأساسي</th>
          <th>الإضافات</th>
          <th>المستقطعات</th>
          <th style="background:#dcfce7;color:#15803d">الصافي</th>
          <th>التحويل</th>
          <th>الحالة</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml}
      </tbody>
      <tfoot>
        <tr class="tfoot">
          <td colspan="${staticLeadColCount}"><strong>الإجمالي (${rows.length} موظف)</strong></td>
          ${platforms.map(() => '<td></td>').join('')}
          <td style="text-align:center;color:#1d4ed8">${totalPlatformSalary.toLocaleString('en-US')}</td>
          <td></td>
          <td style="text-align:center;color:#dc2626">-${totalDeductions.toLocaleString('en-US')}</td>
          <td style="text-align:center;color:#15803d;font-size:15px">${totalNet.toLocaleString('en-US')} ر.س</td>
          <td></td>
          <td></td>
        </tr>
      </tfoot>
    </table>

    <div class="footer">
      <span>توقيع المدير المالي: _______________________</span>
      <span>توقيع المدير العام: _______________________</span>
      <span>تاريخ الاعتماد: _______________________</span>
    </div>
  </body></html>`;
}
