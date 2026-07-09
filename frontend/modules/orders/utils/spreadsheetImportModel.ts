import type { App, DailyData } from '@modules/orders/types';
import { toCellText } from '@modules/orders/utils/text';
export type AppEmployeeIdsMap = Record<string, ReadonlySet<string>>;
import { ImportFactory } from './import/importFactory';
import { MatrixImportStrategy } from './import/matrixStrategy';

export type SpreadsheetMergeResult = {
  newData: DailyData;
  imported: number;
  skipped: number;
  errors: string[];
};

export type ImportTargetResolution = {
  targetApps: App[];
  error?: string;
};

export function getEmployeeAssignedApps(
  empId: string,
  apps: App[],
  appEmployeeIds: AppEmployeeIdsMap,
): App[] {
  return apps.filter((app) => appEmployeeIds[app.id]?.has(empId));
}

export function clearEmployeeAppMonthData(
  nextData: DailyData,
  empId: string,
  appId: string,
  dayArr: number[],
) {
  for (const day of dayArr) {
    delete nextData[`${empId}::${appId}::${day}`];
  }
}

export function resolveImportTargetAppsForEmployee(params: {
  empId: string;
  apps: App[];
  targetAppId?: string;
  appEmployeeIds: AppEmployeeIdsMap;
}): ImportTargetResolution {
  const { empId, apps, targetAppId, appEmployeeIds } = params;

  if (targetAppId) {
    const targetApp = apps.find((app) => app.id === targetAppId);
    if (!targetApp) {
      return {
        targetApps: [],
        error: 'المنصة المحددة غير متاحة للاستيراد',
      };
    }

    // Allow import even if employee is not assigned to the platform
    // The assignment check was blocking valid imports
    return { targetApps: [targetApp] };
  }

  const assignedApps = getEmployeeAssignedApps(empId, apps, appEmployeeIds);

  if (assignedApps.length === 0) {
    // No assigned apps — if there's only one app total, use it
    if (apps.length === 1) {
      return { targetApps: [apps[0]] };
    }
    return {
      targetApps: [],
      error: 'لا توجد منصة مربوطة بهذا الموظف — اختر منصة محددة عند الاستيراد',
    };
  }

  if (assignedApps.length > 1) {
    return {
      targetApps: [],
      error: 'الموظف مسجل على أكثر من منصة — اختر منصة محددة عند الاستيراد',
    };
  }

  return { targetApps: assignedApps };
}

export function validateCellValue(cellValue: unknown, rowIdx: number, day: number): { valid: boolean; value: number; error?: string } {
  const val = Number(cellValue);

  if (Number.isNaN(val)) {
    if (cellValue !== '' && cellValue !== null && cellValue !== undefined) {
      const displayValue = toCellText(cellValue);
      return { valid: false, value: 0, error: `صف ${rowIdx + 2}, يوم ${day}: قيمة غير صحيحة "${displayValue}"` };
    }
    return { valid: false, value: 0 };
  }

  if (val <= 0) return { valid: false, value: 0 };

  if (val > 10000) {
    return { valid: false, value: 0, error: `صف ${rowIdx + 2}, يوم ${day}: عدد الطلبات ${val} كبير جدا` };
  }

  return { valid: true, value: val };
}



export function mergeImportedOrdersFromMatrixWithMapping(params: {
  headerRow?: string[];
  matrixRows: unknown[][];
  dayArr: number[];
  apps: App[];
  prev: DailyData;
  targetAppId?: string;
  nameMapping: Map<string, string>;
  appEmployeeIds: AppEmployeeIdsMap;
}): SpreadsheetMergeResult {
  const { headerRow = [], matrixRows, dayArr, apps, prev, targetAppId, nameMapping, appEmployeeIds } = params;

  const imported = 0;
  const skipped = 0;
  const errors: string[] = [];
  const newData = { ...prev };

  if (apps.length === 0) {
    errors.push('لا توجد منصات طلبات نشطة');
    return { newData, imported, skipped, errors };
  }

  // If we don't have headerRow (e.g. from old code calling without it), we assume Matrix
  // Otherwise we let Factory detect it, fallback to Matrix if undetected for backward compatibility
  let strategy = ImportFactory.detectStrategy(headerRow);
  strategy ??= new MatrixImportStrategy();

  return strategy.parse({
    matrixRows,
    dayArr,
    apps,
    prev,
    targetAppId,
    nameMapping,
    appEmployeeIds,
  });
}
