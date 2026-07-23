/**
 * buildSalarySlipHTML — Dynamic HTML invoice generator.
 *
 * All rows are generated via map() from SlipField[].
 * No hardcoded fields inside HTML. Supports RTL Arabic layout.
 * Output is a standalone HTML string suitable for iframe, print, and PDF export.
 */

import { formatStandardDateTime } from '@shared/lib/formatters';

import DOMPurify, { type Config } from 'dompurify';
import { escapeHtml } from '@shared/lib/security';
import { buildCompanyFooterHtml, buildCompanyHeaderHtml, type CompanyBranding } from '@shared/lib/documentBranding';

// Restrictive allowlist: no inline styles or external URLs (prevents pixel-tracking exfiltration).
const SANITIZE_CONFIG: Config = {
  ALLOWED_TAGS: ['div', 'span', 'h1', 'h2', 'h3', 'p', 'br', 'strong', 'em', 'small', 'table', 'tr', 'td', 'th'],
  ALLOWED_ATTR: ['class', 'alt'],
  FORBID_ATTR: ['style', 'src', 'onerror', 'onload', 'onclick'],
  ALLOW_DATA_ATTR: false,
  ALLOW_UNKNOWN_PROTOCOLS: false,
};

const sanitizeTemplateHtml = (html?: string, section: 'header' | 'footer' = 'header'): string => {
  if (!html) return '';
  const trimmed = html.trim();
  if (!trimmed) return '';

  const hasHtmlTags = /<[a-z][\s\S]*>/i.test(trimmed);
  const content = hasHtmlTags
    ? String(DOMPurify.sanitize(trimmed, SANITIZE_CONFIG))
    : escapeHtml(trimmed).replace(/\n/g, '<br/>');

  return `
    <div class="custom-template-block custom-template-${section}" style="
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 10px 14px;
      margin: 10px 0;
      font-size: 12px;
      line-height: 1.6;
      color: #334155;
      font-weight: 500;
    ">
      ${content}
    </div>
  `;
};

// ─── Types ───────────────────────────────────────────────────────────────────

export interface SlipField {
  key: string;
  label: string;
  value: string | number;
  type: 'info' | 'earning' | 'deduction' | 'total' | 'net';
  /** Optional color hint for the value cell. */
  color?: 'green' | 'red' | 'blue' | 'orange';
}

export interface SlipPlatformRow {
  name: string;
  orders: number;
  salary: number;
}

export interface SlipEmployeeInfo {
  name: string;
  nationalId: string;
  jobTitle: string;
  city: string;
  month: string;
  status: 'pending' | 'approved' | 'paid';
  paymentMethod: string;
  phone?: string | null;
  bankAccount?: string | null;
  companyName?: string;
}

export interface BuildSalarySlipOptions {
  employee: SlipEmployeeInfo;
  fields: SlipField[];
  platforms: SlipPlatformRow[];
  /** Optional project name for header branding. */
  projectName?: string;
  /** Company branding (bilingual official header + footer address). */
  branding?: CompanyBranding;
  /** Template overrides from database. */
  template?: {
    header_html?: string;
    footer_html?: string;
    selected_columns?: string[];
  };
  /** AI Analysis results for UI highlighting. */
  analysis?: {
    expected_salary: number;
    risk: 'underpaid' | 'normal' | 'overpaid';
    diff_percent: number;
  };
}

// ─── Constants ───────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  pending: 'معلّق',
  approved: 'معتمد',
  paid: 'مصروف',
};

const STATUS_CLASSES: Record<string, string> = {
  pending: 'badge-pending',
  approved: 'badge-approved',
  paid: 'badge-paid',
};

const COLOR_MAP: Record<string, string> = {
  green: '#16a34a',
  red: '#dc2626',
  blue: '#1f54ad',
  orange: '#ea580c',
};

// ─── CSS ─────────────────────────────────────────────────────────────────────

const SLIP_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Noto+Naskh+Arabic:wght@400;600;700&display=swap');
*{box-sizing:border-box;margin:0;padding:0}
html,body{direction:rtl;font-family:'Droid Arabic Kufi','Tajawal','Segoe UI',Tahoma,sans-serif;font-size:13px;color:#061735;background:#fff;padding:0}
.slip-container{max-width:700px;margin:0 auto;padding:24px}
.header{display:flex;align-items:center;justify-content:space-between;border-bottom:3px solid #4f46e5;padding-bottom:12px;margin-bottom:16px}
.header-brand{font-size:20px;font-weight:800;color:#4f46e5}
.header-subtitle{font-size:11px;color:#666;margin-top:2px}
.badge{display:inline-block;padding:2px 10px;border-radius:12px;font-size:11px;font-weight:700}
.badge-pending{background:#fef9c3;color:#b45309}
.badge-approved{background:#dbeafe;color:#1d4ed8}
.badge-paid{background:#dcfce7;color:#15803d}
.info-grid{display:grid;grid-template-columns:1fr 1fr;gap:6px;background:#f8f8ff;border-radius:8px;padding:12px;margin-bottom:14px}
.info-row{display:flex;flex-direction:column}
.info-label{font-size:10px;color:#888;margin-bottom:1px}
.info-value{font-size:12px;font-weight:600;color:#111}
.section-title{font-size:12px;font-weight:700;color:#4f46e5;margin:14px 0 6px;text-transform:uppercase;letter-spacing:.5px}
table{width:100%;border-collapse:collapse;margin-bottom:10px}
td,th{padding:7px 10px;border:1px solid #e5e7eb;font-size:12px;text-align:right}
th{background:#e0e7ff;color:#4338ca;font-weight:700;text-align:center}
.label-cell{background:#f3f4f6;font-weight:600;width:55%}
.value-cell{font-weight:700;text-align:center}
.total-row td{background:#eff6ff;font-weight:700;font-size:13px}
.deduction-total td{background:#fff1f2;font-weight:700}
.net-row td{background:#f0fdf4;font-size:16px;font-weight:800}
.risk-banner{margin-bottom:16px;padding:10px;border-radius:6px;font-size:12px;font-weight:700;display:flex;align-items:center;gap:8px}
.risk-underpaid{background:#fff1f2;color:#be123c;border:1px solid #fda4af}
.risk-overpaid{background:#f0f9ff;color:#0369a1;border:1px solid #bae6fd}
.footer{display:flex;justify-content:space-between;margin-top:28px;border-top:1px solid #ddd;padding-top:16px;font-size:11px;color:#555}
.signature-box{text-align:center}
.signature-line{width:120px;border-bottom:1px solid #999;display:inline-block;margin-bottom:4px;height:24px}
@media print{
  body{padding:0}
  .slip-container{padding:16px;max-width:100%}
  .no-print{display:none!important}
}
`.trim();

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fmt = (n: number | string): string => {
  if (typeof n === 'number') return n.toLocaleString('en-US');
  return escapeHtml(String(n));
};

const colorStyle = (color?: string): string => {
  if (!color) return '';
  const c = COLOR_MAP[color];
  return c ? `color:${c}` : '';
};

// ─── Section Builders ────────────────────────────────────────────────────────

const buildHeader = (
  employee: SlipEmployeeInfo,
  projectName?: string,
  templateHeader?: string,
  branding?: CompanyBranding,
): string => {
  // The official bilingual company header (data-driven) always leads the slip.
  const companyHeader = branding ? buildCompanyHeaderHtml(branding) : '';
  const customHeader = templateHeader ? sanitizeTemplateHtml(templateHeader, 'header') : '';
  const standardHeader = `
    <div class="header">
      <div>
        <div class="header-brand">${escapeHtml(employee.companyName || projectName || 'شركة مهمة التوصيل')}</div>
        <div class="header-subtitle">كشف راتب شهر: ${escapeHtml(employee.month)}</div>
      </div>
      <span class="badge ${STATUS_CLASSES[employee.status] || 'badge-pending'}">${STATUS_LABELS[employee.status] || employee.status}</span>
    </div>`;

  return `${companyHeader}${standardHeader}${customHeader}`;
};

const buildRiskBanner = (analysis?: BuildSalarySlipOptions['analysis']): string => {
  if (!analysis || analysis.risk === 'normal') return '';
  const riskLabel = analysis.risk === 'underpaid' ? 'تنبيه: ملاحظة انخفاض في المستحقات' : 'تنبيه: ملاحظة زيادة في المستحقات';
  const riskClass = analysis.risk === 'underpaid' ? 'risk-underpaid' : 'risk-overpaid';
  return `<div class="risk-banner ${riskClass}">
    <span>⚠️</span>
    <span>${riskLabel} (${analysis.diff_percent}%) — الراتب المتوقع: ${analysis.expected_salary} ر.س</span>
  </div>`;
};

const buildInfoGrid = (infoFields: SlipField[]): string => {
  if (infoFields.length === 0) return '';
  return `
    <div class="info-grid">
      ${infoFields.map(f => `
        <div class="info-row">
          <span class="info-label">${escapeHtml(f.label)}</span>
          <span class="info-value">${fmt(f.value)}</span>
        </div>`).join('')}
    </div>`;
};

const buildPlatformsTable = (platforms: SlipPlatformRow[]): string => {
  if (platforms.length === 0) return '';
  const totalOrders = platforms.reduce((s, p) => s + p.orders, 0);
  const totalSalary = platforms.reduce((s, p) => s + p.salary, 0);

  return `
    <div class="section-title">تفاصيل منصات التوصيل</div>
    <table>
      <thead>
        <tr>
          <th>اسم المنصة</th>
          <th>عدد الطلبات</th>
          <th>مستحقات المنصة</th>
        </tr>
      </thead>
      <tbody>
        ${platforms.map(p => `
          <tr>
            <td>${escapeHtml(p.name)}</td>
            <td class="value-cell">${p.orders.toLocaleString('en-US')}</td>
            <td class="value-cell">${p.salary.toLocaleString('en-US')} ر.س</td>
          </tr>`).join('')}
        <tr class="total-row">
          <td>الإجمالي</td>
          <td class="value-cell">${totalOrders.toLocaleString('en-US')}</td>
          <td class="value-cell">${totalSalary.toLocaleString('en-US')} ر.س</td>
        </tr>
      </tbody>
    </table>`;
};

const buildEarningsTable = (earningFields: SlipField[], totalFields: SlipField[]): string => {
  if (earningFields.length === 0 && totalFields.length === 0) return '';
  return `
    <div class="section-title">الإضافات والمستحقات</div>
    <table>
      ${earningFields.map(f => `
        <tr>
          <td class="label-cell">${escapeHtml(f.label)}</td>
          <td class="value-cell" style="${colorStyle(f.color || 'green')}">+ ${fmt(f.value)} ر.س</td>
        </tr>`).join('')}
      ${totalFields.filter(f => !f.key.includes('deduction')).map(f => `
        <tr class="total-row">
          <td class="label-cell">${escapeHtml(f.label)}</td>
          <td class="value-cell" style="${colorStyle(f.color || 'blue')}">${fmt(f.value)} ر.س</td>
        </tr>`).join('')}
    </table>`;
};

const buildDeductionsTable = (deductionFields: SlipField[], totalFields: SlipField[]): string => {
  if (deductionFields.length === 0) return '';
  return `
    <div class="section-title">المستقطعات</div>
    <table>
      ${deductionFields.map(f => `
        <tr>
          <td class="label-cell">${escapeHtml(f.label)}</td>
          <td class="value-cell" style="${colorStyle(f.color || 'red')}">${typeof f.value === 'number' && f.value > 0 ? `- ${fmt(f.value)} ر.س` : fmt(f.value)}</td>
        </tr>`).join('')}
      ${totalFields.filter(f => f.key.includes('deduction')).map(f => `
        <tr class="deduction-total">
          <td class="label-cell">${escapeHtml(f.label)}</td>
          <td class="value-cell" style="${colorStyle(f.color || 'red')}">- ${fmt(f.value)} ر.س</td>
        </tr>`).join('')}
    </table>`;
};

const buildNetTable = (netFields: SlipField[]): string => {
  if (netFields.length === 0) return '';
  return `
    <div class="section-title">الصافي</div>
    <table>
      ${netFields.map(f => `
        <tr class="net-row">
          <td class="label-cell">${escapeHtml(f.label)}</td>
          <td class="value-cell" style="${colorStyle(f.color || 'green')}">${fmt(f.value)} ر.س</td>
        </tr>`).join('')}
    </table>`;
};

const buildMiscTable = (miscTotals: SlipField[]): string => {
  if (miscTotals.length === 0) return '';
  return `
    <table>
      ${miscTotals.map(f => `
        <tr>
          <td class="label-cell">${escapeHtml(f.label)}</td>
          <td class="value-cell" style="${colorStyle(f.color)}">${fmt(f.value)} ر.س</td>
        </tr>`).join('')}
    </table>`;
};

const buildFooter = (templateFooter?: string, branding?: CompanyBranding): string => {
  const addressFooter = branding ? buildCompanyFooterHtml(branding) : '';
  const customFooter = templateFooter ? sanitizeTemplateHtml(templateFooter, 'footer') : '';
  const standardSignatures = `
    <div class="footer">
      <div class="signature-box">
        <div class="signature-line"></div>
        <div>توقيع المندوب</div>
      </div>
      <div class="signature-box">
        <div class="signature-line"></div>
        <div>اعتماد الإدارة</div>
      </div>
      <div>التاريخ: ${formatStandardDateTime()}</div>
    </div>${addressFooter}`;
};

// ─── Builder ─────────────────────────────────────────────────────────────────

export function buildSalarySlipHTML(options: BuildSalarySlipOptions): string {
  const { employee, fields: allFields, platforms, projectName, branding, template, analysis } = options;

  // Filter fields based on template selection if provided
  const fields = template?.selected_columns && template.selected_columns.length > 0
    ? allFields.filter(f => template.selected_columns?.includes(f.key) || f.type === 'total' || f.type === 'net')
    : allFields;

  const infoFields = fields.filter(f => f.type === 'info');
  const earningFields = fields.filter(f => f.type === 'earning');
  const deductionFields = fields.filter(f => f.type === 'deduction');
  const totalFields = fields.filter(f => f.type === 'total');
  const netFields = fields.filter(f => f.type === 'net');
  const miscTotals = totalFields.filter(f => !f.key.includes('earning') && !f.key.includes('deduction'));

  // ── Full Document ─────────────────────────────────────────────────────────
  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>كشف راتب — ${escapeHtml(employee.name)}</title>
  <style>${SLIP_CSS}</style>
</head>
<body>
  <div class="slip-container">
    ${buildHeader(employee, projectName, template?.header_html, branding)}
    ${buildRiskBanner(analysis)}
    ${buildInfoGrid(infoFields)}
    ${buildPlatformsTable(platforms)}
    ${buildEarningsTable(earningFields, totalFields)}
    ${buildDeductionsTable(deductionFields, totalFields)}
    ${buildNetTable(netFields)}
    ${buildMiscTable(miscTotals)}
    ${buildFooter(template?.footer_html, branding)}
  </div>
</body>
</html>`;
}
