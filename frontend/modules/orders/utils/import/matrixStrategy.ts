import type { App, DailyData } from '@modules/orders/types';
import { toCellText } from '@modules/orders/utils/text';
import {
  type SpreadsheetMergeResult,
  clearEmployeeAppMonthData,
  resolveImportTargetAppsForEmployee,
  validateCellValue,
} from '../spreadsheetImportModel';
import type { SpreadsheetImportStrategy } from './strategy';

export class MatrixImportStrategy implements SpreadsheetImportStrategy {
  private processRowCellsForMappedImport(
    line: unknown[],
    dayArr: number[],
    rowIdx: number,
    empId: string,
    targetApps: App[],
    newData: DailyData,
    clearedScopes: Set<string>,
  ): { imported: number; hasValidData: boolean; errors: string[] } {
    let imported = 0;
    let hasValidData = false;
    const errors: string[] = [];

    // Clear previous data for this employee+app scope
    for (const app of targetApps) {
      const scopeKey = `${empId}::${app.id}`;
      if (clearedScopes.has(scopeKey)) continue;
      clearEmployeeAppMonthData(newData, empId, app.id, dayArr);
      clearedScopes.add(scopeKey);
    }

    // Process each day cell
    for (let idx = 0; idx < dayArr.length; idx++) {
      const d = dayArr[idx];
      const cellValue = line[idx + 1];
      const result = validateCellValue(cellValue, rowIdx, d);

      if (result.error) errors.push(result.error);
      if (!result.valid) continue;

      hasValidData = true;
      for (const app of targetApps) {
        newData[`${empId}::${app.id}::${d}`] = result.value;
        imported++;
      }
    }

    return { imported, hasValidData, errors };
  }

  parse(params: Parameters<SpreadsheetImportStrategy['parse']>[0]): SpreadsheetMergeResult {
    const { matrixRows, dayArr, apps, prev, targetAppId, nameMapping, appEmployeeIds } = params;

    let imported = 0;
    let skipped = 0;
    const errors: string[] = [];
    const newData = { ...prev };
    const clearedScopes = new Set<string>();

    if (apps.length === 0) {
      errors.push('لا توجد منصات طلبات نشطة');
      return { newData, imported, skipped, errors };
    }

    for (let rowIdx = 0; rowIdx < matrixRows.length; rowIdx++) {
      const row = matrixRows[rowIdx];
      const line = Array.isArray(row) ? row : [];
      const empName = toCellText(line[0]).trim();

      if (!empName) {
        skipped++;
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

      const result = this.processRowCellsForMappedImport(line, dayArr, rowIdx, empId, targetApps, newData, clearedScopes);
      imported += result.imported;
      errors.push(...result.errors);

      if (!result.hasValidData) {
        skipped++;
      }
    }

    return { newData, imported, skipped, errors };
  }
}
