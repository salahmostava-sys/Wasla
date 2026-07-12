import { formatStandardDateTime } from '@shared/lib/formatters';

import { toast } from '@shared/components/ui/sonner';
import {
  TOAST_SUCCESS_ACTION,
  TOAST_SUCCESS_OPERATION,
} from '@shared/lib/toastMessages';
import { getErrorMessage } from '@services/serviceError';
import { buildOrdersIoHeaders } from '@shared/constants/excelSchemas';
import { logError, logger } from '@shared/lib/logger';
import { orderService, type ReplaceMonthDataMeta } from '@services/orderService';
import type { App, DailyData, Employee } from '@modules/orders/types';

/** Maximum orders per cell — values above this are rejected during import/save. */
const MAX_ORDERS_PER_CELL = 10_000;
/** Chunk size for batch-saving month data to the server.
 * Smaller chunks = more reliable (less chance of timeout/payload limits). */
const SAVE_CHUNK_SIZE = 100;
import { dateStr, monthLabel, monthYear } from '@modules/orders/utils/dateMonth';
import {
  mergeImportedOrdersFromMatrixWithMapping,
  type AppEmployeeIdsMap,
} from '@modules/orders/utils/spreadsheetImportModel';
import { ImportFactory } from '@modules/orders/utils/import/importFactory';
import { loadXlsx } from '@modules/orders/utils/xlsx';
import { matchEmployeeNames, type UnmatchedEmployeeName } from '@shared/lib/nameMatching';

function summarizeMessages(messages: string[], limit = 3): string {
  if (messages.length === 0) return '';
  const preview = messages.slice(0, limit).join('، ');
  return messages.length > limit ? `${preview}، و${messages.length - limit} أخرى` : preview;
}

function buildOrderIdentityLabel(
  row: { employee_id: string; app_id: string; date: string },
  employeeNames: Map<string, string>,
  appNames: Map<string, string>,
): string {
  const employeeName = employeeNames.get(row.employee_id) ?? row.employee_id;
  const appName = appNames.get(row.app_id) ?? row.app_id;
  return `${employeeName} - ${appName} - ${row.date}`;
}

export type SpreadsheetImportResult = {
  appliedData: DailyData | null;
  imported: number;
  skipped: number;
  errors: string[];
};

/**
 * يطبّق مطابقة الأسماء النهائية، يدمج بيانات الاستيراد، ويعرض إشعار النتيجة
 * (نجاح/تحذيرات/مسح شامل) — منطق مشترك بين مسار الاستيراد التلقائي ومسار
 * التأكيد اليدوي لمطابقة الأسماء.
 */
function applyMatrixMappingAndNotify(params: {
  headerRow: string[];
  matrix: unknown[][];
  dayArr: number[];
  apps: App[];
  data: DailyData;
  targetAppId?: string;
  appEmployeeIds: AppEmployeeIdsMap;
  onApplyData: (next: DailyData) => void;
  nameMapping: Map<string, string>;
  isClearAll: boolean;
}): SpreadsheetImportResult {
  const { headerRow, matrix, dayArr, apps, data, targetAppId, appEmployeeIds, onApplyData, nameMapping, isClearAll } = params;

  const { newData, imported, skipped, errors } = mergeImportedOrdersFromMatrixWithMapping({
    headerRow,
    matrixRows: matrix.slice(1),
    dayArr,
    apps,
    prev: data,
    targetAppId,
    nameMapping,
    appEmployeeIds,
  });
  onApplyData(newData);
  const appName = targetAppId
    ? apps.find((a) => a.id === targetAppId)?.name
    : 'التوزيع الذكي حسب تعيين الموظف';

  if (errors.length > 0) {
    toast.warning(`تم الاستيراد مع تحذيرات`, {
      description: `✅ نجح: ${imported} إدخال | ⚠️ تخطي: ${skipped} صف\n${errors.slice(0, 5).join('\n')}` + (errors.length > 5 ? `\n... و${errors.length - 5} أخطاء أخرى` : ''),
      duration: 10000,
    });
  } else if (isClearAll) {
    toast.success(TOAST_SUCCESS_OPERATION, {
      description: `تم مسح جميع طلبات الشهر - ${monthLabel(0, 0)}`
    });
  } else {
    toast.success(TOAST_SUCCESS_ACTION, {
      description: `تم استيراد ${imported} إدخال إلى ${appName}`
    });
  }

  return { appliedData: newData, imported, skipped, errors };
}

export async function exportSpreadsheetExcel(params: {
  year: number;
  month: number;
  dayArr: number[];
  filteredEmployees: Employee[];
  empDayTotal: (empId: string, day: number) => number;
  empMonthTotal: (empId: string) => number;
}): Promise<void> {
  const XLSX = await loadXlsx();
  const { year, month, dayArr, filteredEmployees, empDayTotal, empMonthTotal } = params;
  const headers = buildOrdersIoHeaders(dayArr);
  const rows = filteredEmployees.map((emp) => {
    const values: Array<string | number> = [emp.name];
    dayArr.forEach((d) => values.push(empDayTotal(emp.id, d) || ''));
    values.push(empMonthTotal(emp.id));
    return values;
  });
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'الطلبات');
  XLSX.writeFile(wb, `طلبات_${month}_${year}.xlsx`);
  toast.success(TOAST_SUCCESS_ACTION);
}

export async function exportDailyAppReportExcel(params: {
  year: number;
  month: number;
  startDay: number;
  endDay: number;
  appId: string;
  employees: Employee[];
  data: DailyData;
  apps: App[];
}): Promise<void> {
  const XLSX = await loadXlsx();
  const { year, month, startDay, endDay, appId, employees, data, apps } = params;

  const appName = apps.find(a => a.id === appId)?.name || 'غير معروف';

  const my = monthYear(year, month);
  const targets = await orderService.getMonthTargets(my);
  const targetRow = targets.find((t) => t.app_id === appId);
  const appTarget = targetRow?.target_orders ?? 0;
  const empTarget = targetRow?.employee_target_orders ?? null;

  const results = employees.map(emp => {
    let total = 0;
    for (let d = startDay; d <= endDay; d++) {
      const key = `${emp.id}::${appId}::${d}`;
      total += data[key] || 0;
    }
    return { name: emp.name, total, appTarget, empTarget };
  }).filter(r => r.total > 0).sort((a, b) => b.total - a.total);

  const titleText = `تقرير تطبيق ${appName} من يوم ${startDay} إلى ${endDay} (${year}-${String(month).padStart(2, '0')})`;
  
  const rows: Array<Array<string | number>> = [
    [titleText],
    [],
    ['اسم المندوب', 'إجمالي الطلبات', 'تارجت المندوب', 'المتبقي للوصول للتارجت', 'التوصيات']
  ];

  results.forEach(r => {
    const remaining = r.empTarget != null ? r.empTarget - r.total : '—';
    const displayEmpTarget = r.empTarget ?? 'بدون هدف';
    rows.push([r.name, r.total, displayEmpTarget, remaining, '']);
  });

  const ws = XLSX.utils.aoa_to_sheet(rows);
  if (!ws['!merges']) ws['!merges'] = [];
  ws['!merges'].push({ s: { r: 0, c: 0 }, e: { r: 0, c: 4 } });

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'التقرير');
  XLSX.writeFile(wb, `تقرير_${appName}_${startDay}_إلى_${endDay}.xlsx`);
  toast.success(TOAST_SUCCESS_ACTION);
}

export async function printDailyAppReportTable(params: {
  year: number;
  month: number;
  startDay: number;
  endDay: number;
  appId: string;
  employees: Employee[];
  data: DailyData;
  apps: App[];
}) {
  const { year, month, startDay, endDay, appId, employees, data, apps } = params;
  const appName = apps.find(a => a.id === appId)?.name || 'غير معروف';

  const my = monthYear(year, month);
  const targets = await orderService.getMonthTargets(my);
  const targetRow = targets.find((t) => t.app_id === appId);
  const appTarget = targetRow?.target_orders ?? 0;
  const empTarget = targetRow?.employee_target_orders ?? null;

  const results = employees.map(emp => {
    let total = 0;
    for (let d = startDay; d <= endDay; d++) {
      const key = `${emp.id}::${appId}::${d}`;
      total += data[key] || 0;
    }
    return { name: emp.name, total, appTarget, empTarget };
  }).filter(r => r.total > 0).sort((a, b) => b.total - a.total);

  const titleText = `تقرير تطبيق ${appName} من يوم ${startDay} إلى ${endDay} (${year}-${String(month).padStart(2, '0')})`;

  const newWin = window.open('', '_blank');
  if (!newWin) {
    toast.error('يرجى السماح بالنوافذ المنبثقة (Pop-ups) للطباعة');
    return;
  }

  const doc = newWin.document;
  const htmlEl = doc.documentElement;
  const head = doc.head;
  const body = doc.body;
  if (!htmlEl || !head || !body) return;

  htmlEl.setAttribute('dir', 'rtl');

  const titleEl = doc.createElement('title');
  titleEl.textContent = titleText;
  head.appendChild(titleEl);

  const styleEl = doc.createElement('style');
  styleEl.textContent = `
    body { font-family: system-ui, -apple-system, sans-serif; padding: 20px; }
    h1 { text-align: center; margin-bottom: 20px; }
    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
    th, td { border: 1px solid #ccc; padding: 8px; text-align: right; }
    th { background-color: #f1f5f9; }
    @media print {
      button { display: none; }
    }
  `;
  head.appendChild(styleEl);

  const h1 = doc.createElement('h1');
  h1.textContent = titleText;
  body.appendChild(h1);

  const table = doc.createElement('table');
  const thead = doc.createElement('thead');
  thead.innerHTML = `
    <tr>
      <th>اسم المندوب</th>
      <th>إجمالي الطلبات</th>
      <th>تارجت المندوب</th>
      <th>المتبقي</th>
      <th>التوصيات</th>
    </tr>
  `;
  table.appendChild(thead);

  const tbody = doc.createElement('tbody');
  results.forEach(r => {
    const remaining = r.empTarget != null ? r.empTarget - r.total : '—';
    const displayEmpTarget = r.empTarget ?? 'بدون هدف';
    const tr = doc.createElement('tr');
    tr.innerHTML = `
      <td>${r.name}</td>
      <td>${r.total}</td>
      <td>${displayEmpTarget}</td>
      <td dir="ltr" style="text-align: right;">${remaining}</td>
      <td></td>
    `;
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  body.appendChild(table);

  setTimeout(() => {
    newWin.print();
  }, 500);
}

export async function runSpreadsheetImport(params: {
  file: File;
  dayArr: number[];
  employees: Employee[];
  apps: App[];
  appEmployeeIds: AppEmployeeIdsMap;
  data: DailyData;
  onApplyData: (next: DailyData) => void;
  targetAppId?: string;
  onShowNameMapping?: (unmatched: UnmatchedEmployeeName[], onConfirm: (mapping: Map<string, string>) => void) => void;
}): Promise<SpreadsheetImportResult | null> {
  const { file, dayArr, employees, apps, appEmployeeIds, data, onApplyData, targetAppId, onShowNameMapping } = params;
  try {
    // التحقق من نوع الملف
    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      toast.error('نوع الملف غير صحيح', {
        description: 'يرجى رفع ملف Excel بصيغة .xlsx أو .xls فقط'
      });
      return null;
    }

    const XLSX = await loadXlsx();
    const arrayBuffer = await file.arrayBuffer();
    const wb = XLSX.read(arrayBuffer, { type: 'array' });

    // التحقق من وجود ورقة عمل
    if (!wb.SheetNames || wb.SheetNames.length === 0) {
      toast.error('ملف فارغ', {
        description: 'الملف لا يحتوي على أي ورقة عمل'
      });
      return null;
    }

    const ws = wb.Sheets[wb.SheetNames[0]];
    const matrix = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: '' });

    if (matrix.length < 2) {
      toast.error('ملف فارغ', {
        description: 'الملف لا يحتوي على بيانات. يجب أن يحتوي على صف العناوين وصف واحد على الأقل من البيانات'
      });
      return null;
    }

    const actualHeaders = (matrix[0] || []).map((h) => String(h ?? '').trim());

    const strategy = ImportFactory.detectStrategy(actualHeaders);

    if (!strategy) {
      toast.error('هيكل الملف غير صحيح', {
        description: `لم يتم التعرف على التنسيق. استخدم تنسيق الشبكة (المندوب + الأيام) أو تنسيق القائمة الطولية (الاسم، اليوم، العدد).`
      });
      return null;
    }

    // استخراج الأسماء من الملف
    const importedNames = matrix.slice(1).map((row, idx) => {
      const line = Array.isArray(row) ? row : [];
      const name = String(line[0] ?? '').trim();
      return { name, rowIndex: idx + 2 }; // +2 لأن الصف الأول هو العناوين والـ index يبدأ من 0
    }).filter(item => item.name);

    if (importedNames.length === 0) {
      toast.error('لا توجد بيانات للاستيراد', {
        description: 'الملف لا يحتوي على أسماء موظفين في العمود الأول'
      });
      return null;
    }

    // مطابقة الأسماء
    const rowsByImportedName = new Map<string, number[]>();
    importedNames.forEach(({ name, rowIndex }) => {
      rowsByImportedName.set(name, [...(rowsByImportedName.get(name) ?? []), rowIndex]);
    });

    const { matched, unmatched } = matchEmployeeNames(
      importedNames.map(item => item.name),
      employees,
    );
    const unmatchedWithRows: UnmatchedEmployeeName[] = unmatched.map((item) => ({
      ...item,
      rowIndexes: rowsByImportedName.get(item.name) ?? [],
    }));

    // إذا كان هناك أسماء غير مطابقة وتم توفير callback
    if (unmatchedWithRows.length > 0 && onShowNameMapping) {
      return new Promise((resolve) => {
        onShowNameMapping(unmatchedWithRows, (nameMapping) => {
          // دمج المطابقات التلقائية مع المطابقات اليدوية
          const finalMapping = new Map<string, string>();
          matched.forEach((match, name) => finalMapping.set(name, match.id));
          nameMapping.forEach((id, name) => finalMapping.set(name, id));

          const result = applyMatrixMappingAndNotify({
            headerRow: actualHeaders,
            matrix, dayArr, apps, data, targetAppId, appEmployeeIds, onApplyData,
            nameMapping: finalMapping,
            isClearAll: false,
          });
          resolve(result);
        });
      });
    }

    // إذا كانت كل الأسماء مطابقة
    const finalMapping = new Map<string, string>();
    matched.forEach((match, name) => finalMapping.set(name, match.id));

    return applyMatrixMappingAndNotify({
      headerRow: actualHeaders,
      matrix, dayArr, apps, data, targetAppId, appEmployeeIds, onApplyData,
      nameMapping: finalMapping,
      isClearAll: file.name === '__never__',
    });
  } catch (err) {
    logError('[Orders] import spreadsheet failed', err);
    const errorMsg = getErrorMessage(err, 'خطأ غير معروف');
    toast.error('فشل استيراد الملف', {
      description: `حدث خطأ أثناء قراءة الملف: ${errorMsg}`
    });
    return null;
  }
}

export async function downloadSpreadsheetTemplate(dayArr: number[]): Promise<void> {
  const XLSX = await loadXlsx();
  const ws = XLSX.utils.aoa_to_sheet([buildOrdersIoHeaders(dayArr)]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'قالب الطلبات');
  XLSX.writeFile(wb, 'template_orders.xlsx');
}

export function printSpreadsheetTable(params: {
  tableEl: HTMLTableElement | null;
  year: number;
  month: number;
  filteredEmployeeCount: number;
}): void {
  const { tableEl, year, month, filteredEmployeeCount } = params;
  if (!tableEl) return;
  const printWindow = globalThis.open('', '_blank');
  if (!printWindow) return;
  const doc = printWindow.document;
  const html = doc.documentElement;
  const head = doc.head;
  const body = doc.body;
  if (!html || !head || !body) return;
  html.setAttribute('dir', 'rtl');
  html.setAttribute('lang', 'ar');
  const metaCharset = doc.createElement('meta');
  metaCharset.setAttribute('charset', 'UTF-8');
  head.appendChild(metaCharset);
  const docTitle = doc.createElement('title');
  docTitle.textContent = `طلبات ${month}/${year}`;
  head.appendChild(docTitle);
  const styleEl = doc.createElement('style');
  styleEl.textContent =
    '*{box-sizing:border-box;margin:0;padding:0}body{font-family:Arial,sans-serif;font-size:10px;direction:rtl;color:#111;background:#fff}h2{text-align:center;margin-bottom:8px;font-size:14px}p.sub{text-align:center;color:#666;font-size:10px;margin-bottom:10px}table{width:100%;border-collapse:collapse}th{background:#1e3a5f;color:#fff;padding:5px 6px;text-align:right;font-size:9px;white-space:nowrap}td{padding:4px 6px;border-bottom:1px solid #e0e0e0;text-align:right;white-space:nowrap}tr:nth-child(even) td{background:#f9f9f9}@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}';
  head.appendChild(styleEl);
  const title = doc.createElement('h2');
  title.textContent = `طلبات شهر ${month}/${year}`;
  const subtitle = doc.createElement('p');
  subtitle.className = 'sub';
  subtitle.textContent = `المجموع: ${filteredEmployeeCount} مندوب - ${formatStandardDateTime(new Date())}`;
  body.replaceChildren();
  body.appendChild(title);
  body.appendChild(subtitle);
  body.appendChild(tableEl.cloneNode(true));
  printWindow.onload = () => {
    printWindow.print();
    printWindow.onafterprint = () => printWindow.close();
  };
}

function buildRows(
  data: DailyData,
  year: number,
  month: number,
  days: number,
  employeeNames: Map<string, string>,
  appNames: Map<string, string>
) {
  const rows: { employee_id: string; app_id: string; date: string; orders_count: number }[] = [];
  const invalidRows: string[] = [];

  Object.entries(data).forEach(([key, count]) => {
    const [empId, appId, dayStr] = key.split('::');
    const day = Number.parseInt(dayStr, 10);

    if (!empId || !appId || !dayStr) {
      invalidRows.push(`مفتاح غير صحيح: ${key}`);
      return;
    }

    const rowIdentity = `${employeeNames.get(empId) ?? empId} - ${appNames.get(appId) ?? appId}`;

    if (Number.isNaN(day) || day < 1 || day > days) {
      invalidRows.push(`${rowIdentity}: يوم غير صحيح (${dayStr})`);
      return;
    }

    if (count <= 0 || count > MAX_ORDERS_PER_CELL) {
      invalidRows.push(`${rowIdentity} - ${dateStr(year, month, day)}: عدد طلبات غير صحيح (${count})`);
      return;
    }

    rows.push({
      employee_id: empId,
      app_id: appId,
      date: dateStr(year, month, day),
      orders_count: count,
    });
  });

  return { rows, invalidRows };
}

function getDeletedKeys(data: DailyData, originalData: DailyData, year: number, month: number) {
  const deletedKeys: { employeeId: string; appId: string; date: string }[] = [];
  for (const key of Object.keys(originalData)) {
    if (!data[key] || data[key] <= 0) {
      const [empId, appId, dayStr] = key.split('::');
      const day = Number.parseInt(dayStr, 10);
      if (empId && appId && !Number.isNaN(day)) {
        deletedKeys.push({
          employeeId: empId,
          appId,
          date: dateStr(year, month, day),
        });
      }
    }
  }
  return deletedKeys;
}


export async function saveSpreadsheetMonth(params: {
  isMonthLocked: boolean;
  year: number;
  month: number;
  days: number;
  data: DailyData;
  originalData?: DailyData;
  setSaving: (v: boolean) => void;
  employees: Employee[];
  apps: App[];
  saveMeta?: ReplaceMonthDataMeta;
}): Promise<boolean> {
  const { isMonthLocked, year, month, days, data, originalData, setSaving, employees, apps, saveMeta: _saveMeta } = params;
  if (isMonthLocked) {
    toast.error('الشهر مقفل', {
      description: 'لا يمكن حفظ التغييرات في شهر مقفل'
    });
    return false;
  }

  setSaving(true);
  const employeeNames = new Map(employees.map((employee) => [employee.id, employee.name]));
  const appNames = new Map(apps.map((app) => [app.id, app.name]));
  
  const { rows, invalidRows } = buildRows(data, year, month, days, employeeNames, appNames);
  
  const _monthKey = monthYear(year, month);
  const isClearingMonth = Object.keys(data).length === 0;

  if (invalidRows.length > 0) {
    logger.warn('تم تجاهل بيانات غير صحيحة', { meta: { invalidRows } });
    toast.warning('تم تجاهل بعض البيانات قبل الحفظ', {
      description: summarizeMessages(invalidRows)
    });
  }

  if (rows.length === 0 && !isClearingMonth) {
    toast.error('لا توجد بيانات للحفظ', {
      description: 'لم يتم العثور على أي طلبات صحيحة للحفظ'
    });
    setSaving(false);
    return false;
  }

  try {
    // ALWAYS use bulkUpsert — replaceMonthData calls an RPC that deletes ALL
    // orders for the entire month (not filtered by app), which causes data loss
    // when the grid state doesn't contain every platform's data.
    const { saved, failed } = await orderService.bulkUpsert(rows, SAVE_CHUNK_SIZE);

    let deletedCount = 0;
    if (originalData) {
      const deletedKeys = getDeletedKeys(data, originalData, year, month);
      if (deletedKeys.length > 0) {
        await orderService.deleteDailyOrders(deletedKeys);
        deletedCount = deletedKeys.length;
      }
    }

    if (failed.length > 0) {
      logger.error('فشل حفظ بعض السجلات', { meta: { failed: failed.slice(0, 10) } });
      const failedMessages = failed.map((failure) => (
        `${buildOrderIdentityLabel(failure.row, employeeNames, appNames)}: ${failure.error}`
      ));
      toast.error('حفظ جزئي', {
        description: `تم حفظ ${saved} إدخال بنجاح، وتعذر حفظ ${failed.length} إدخال. ${summarizeMessages(failedMessages)}`
      });
    } else {
      let desc = `تم حفظ ${saved} إدخال`;
      if (deletedCount > 0) desc += ` ومسح ${deletedCount} إدخال`;
      desc += ` - ${monthLabel(year, month)}`;
      toast.success(TOAST_SUCCESS_OPERATION, {
        description: desc
      });
    }
    return isClearingMonth || saved > 0 || deletedCount > 0;
  } catch (e: unknown) {
    const errorMsg = getErrorMessage(e, 'خطأ غير معروف');
    toast.error('فشل عملية الحفظ', {
      description: `حدث خطأ: ${errorMsg}`
    });
    logError('Orders.handleSave', e);
    return false;
  } finally {
    setSaving(false);
  }
}
