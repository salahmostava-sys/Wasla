import type { EmployeeArabicRow } from '@shared/lib/employeeArabicTemplateImport';
import { validateImportRow } from '@modules/employees/model/employeeValidation';
import type { UploadReport, UploadLiveStats } from '@modules/employees/types/employee.types';

const loadImportModule = () => import('@shared/lib/employeeArabicTemplateImport');

export const processBulkImportRows = async (
  buffer: ArrayBuffer,
  onProgress: (value: number) => void,
  onLiveStats: (stats: UploadLiveStats) => void,
): Promise<{ report: UploadReport; headerWarnings: number }> => {
  onProgress(10);
  const { parseEmployeeArabicWorkbook } = await loadImportModule();
  const { rows, headerErrors } = await parseEmployeeArabicWorkbook(buffer);
  if (rows.length === 0) {
    return {
      report: {
        totalProcessed: 0,
        successfulRows: 0,
        failedRows: 0,
        errors: [{ rowIndex: 1, issue: 'الملف لا يحتوي على بيانات صالحة للمعالجة' }],
      },
      headerWarnings: headerErrors.length,
    };
  }

  const validationErrors: Array<{ rowIndex: number; issue: string }> = [];
  const validRows: Array<{ rowIndex: number; row: EmployeeArabicRow }> = [];

  if (headerErrors.length > 0) {
    headerErrors.forEach((err) => validationErrors.push({ rowIndex: 1, issue: err }));
  }

  rows.forEach((row, idx) => {
    const rowIndex = idx + 2;
    const rowIssues = validateImportRow(row, rowIndex);
    if (rowIssues.length > 0) validationErrors.push(...rowIssues);
    else validRows.push({ rowIndex, row });
  });

  onProgress(25);

  let successfulRows = 0;
  const processingErrors: Array<{ rowIndex: number; issue: string }> = [];
  const totalToProcess = Math.max(validRows.length, 1);
  const BATCH_SIZE = 10;
  onLiveStats({ processedNames: 0, totalNames: validRows.length, currentName: '' });

  for (let batchStart = 0; batchStart < validRows.length; batchStart += BATCH_SIZE) {
    const batch = validRows.slice(batchStart, batchStart + BATCH_SIZE);
    const lastItem = batch.at(-1)!;
    const currentName = String(lastItem.row.name ?? '').trim() || `سطر ${lastItem.rowIndex}`;
    onLiveStats({ processedNames: batchStart, totalNames: validRows.length, currentName });

    const { upsertEmployeeArabicRows } = await loadImportModule();
    const { processed, failures } = await upsertEmployeeArabicRows(batch.map((item) => item.row));
    successfulRows += processed;

    if (failures.length > 0) {
      for (const failure of failures) {
        const failedItem = batch.find(
          (item) => String(item.row.name ?? '').trim() === (failure.name ?? '').trim(),
        );
        processingErrors.push({
          rowIndex: failedItem?.rowIndex ?? batch[0].rowIndex,
          issue: failure.error || 'تعذر حفظ السطر',
        });
      }
    }

    const batchEnd = Math.min(batchStart + BATCH_SIZE, validRows.length);
    const progress = 25 + Math.round((batchEnd / totalToProcess) * 70);
    onProgress(Math.min(progress, 95));
    onLiveStats({ processedNames: batchEnd, totalNames: validRows.length, currentName });
  }

  const report: UploadReport = {
    totalProcessed: rows.length,
    successfulRows,
    failedRows: rows.length - successfulRows,
    errors: [...validationErrors, ...processingErrors],
  };

  return { report, headerWarnings: headerErrors.length };
};
