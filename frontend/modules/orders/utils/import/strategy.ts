import type { App, DailyData } from '@modules/orders/types';
import type { AppEmployeeIdsMap, SpreadsheetMergeResult } from '../spreadsheetImportModel';

export interface SpreadsheetImportStrategy {
  parse(params: {
    matrixRows: unknown[][];
    dayArr: number[];
    apps: App[];
    prev: DailyData;
    targetAppId?: string;
    nameMapping: Map<string, string>;
    appEmployeeIds: AppEmployeeIdsMap;
  }): SpreadsheetMergeResult;
}
