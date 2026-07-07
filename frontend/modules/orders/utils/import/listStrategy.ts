import type { SpreadsheetImportStrategy } from './strategy';
import { toCellText } from '@modules/orders/utils/text';
import {
  type SpreadsheetMergeResult,
  resolveImportTargetAppsForEmployee,
  validateCellValue,
} from '../spreadsheetImportModel';

export class ListImportStrategy implements SpreadsheetImportStrategy {
  private extractDay(cellValue: unknown): number | null {
    const text = toCellText(cellValue).trim();
    if (!text) return null;

    // Try parsing as number first
    const num = Number(text);
    if (!Number.isNaN(num) && num >= 1 && num <= 31) {
      return num;
    }

    // Try parsing as Date
    const date = new Date(text);
    if (!Number.isNaN(date.getTime())) {
      return date.getDate();
    }

    return null;
  }

  parse(params: Parameters<SpreadsheetImportStrategy['parse']>[0]): SpreadsheetMergeResult {
    const { matrixRows, apps, prev, targetAppId, nameMapping, appEmployeeIds } = params;

    let imported = 0;
    let skipped = 0;
    const errors: string[] = [];
    const newData = { ...prev };

    if (apps.length === 0) {
      errors.push('لا توجد منصات طلبات نشطة');
      return { newData, imported, skipped, errors };
    }

    // Assuming columns are: [Employee Name, Date/Day, Orders Count]
    for (let rowIdx = 0; rowIdx < matrixRows.length; rowIdx++) {
      const row = matrixRows[rowIdx];
      const line = Array.isArray(row) ? row : [];
      
      const empName = toCellText(line[0]).trim();
      const dayCell = line[1];
      const countCell = line[2];

      if (!empName && !dayCell && !countCell) {
        skipped++;
        continue;
      }

      if (!empName) {
        skipped++;
        errors.push(`صف ${rowIdx + 2}: اسم الموظف مفقود`);
        continue;
      }

      const empId = nameMapping.get(empName);
      if (!empId) {
        skipped++;
        errors.push(`صف ${rowIdx + 2}: الموظف "${empName}" غير موجود`);
        continue;
      }

      const { targetApps, error } = resolveImportTargetAppsForEmployee({
        empId,
        apps,
        targetAppId,
        appEmployeeIds,
      });

      if (error) {
        skipped++;
        errors.push(`صف ${rowIdx + 2}: ${error}`);
        continue;
      }

      const day = this.extractDay(dayCell);
      if (day === null) {
        skipped++;
        errors.push(`صف ${rowIdx + 2}: تعذر استخراج اليوم من "${toCellText(dayCell)}"`);
        continue;
      }

      const result = validateCellValue(countCell, rowIdx, day);
      if (result.error) {
        errors.push(result.error);
      }
      
      if (!result.valid) {
        skipped++;
        continue;
      }

      // For List strategy, we might have multiple rows for the same employee+app+day
      // The current logic overwrites. We could add them up, but let's stick to overwrite or sum.
      // Usually list means each entry is the total for the day, or we should sum them.
      // Let's sum them in case an employee has multiple entries for the same day.
      for (const app of targetApps) {
        const key = `${empId}::${app.id}::${day}`;
        const prevValue = newData[key] || 0;
        newData[key] = prevValue + result.value;
        imported++;
      }
    }

    return { newData, imported, skipped, errors };
  }
}
