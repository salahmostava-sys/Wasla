import { beforeEach, describe, expect, it, vi } from 'vitest';
import { exportSpreadsheetExcel, runSpreadsheetImport, downloadSpreadsheetTemplate, printSpreadsheetTable, saveSpreadsheetMonth } from './spreadsheetFileOps';
import { orderService } from '@services/orderService';
import { buildOrdersIoHeaders } from '@shared/constants/excelSchemas';
import { mergeImportedOrdersFromMatrixWithMapping } from './spreadsheetImportModel';
import { matchEmployeeNames } from '@shared/lib/nameMatching';

const { toastSuccessMock, toastErrorMock, toastWarningMock, aoaToSheetMock, bookNewMock, bookAppendSheetMock, writeFileMock, readMock, sheetToJsonMock } = vi.hoisted(() => ({
  toastSuccessMock: vi.fn(),
  toastErrorMock: vi.fn(),
  toastWarningMock: vi.fn(),
  aoaToSheetMock: vi.fn(),
  bookNewMock: vi.fn(),
  bookAppendSheetMock: vi.fn(),
  writeFileMock: vi.fn(),
  readMock: vi.fn(),
  sheetToJsonMock: vi.fn(),
}));

vi.mock('@shared/components/ui/sonner', () => ({
  toast: {
    success: toastSuccessMock,
    error: toastErrorMock,
    warning: toastWarningMock,
  },
}));

vi.mock('@shared/lib/toastMessages', () => ({
  TOAST_SUCCESS_ACTION: 'Success Action',
  TOAST_SUCCESS_OPERATION: 'Success Op',
}));

vi.mock('@services/orderService', () => ({
  orderService: {
    bulkUpsert: vi.fn(),
    getMonthTargets: vi.fn(),
  },
}));


vi.mock('./spreadsheetImportModel', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./spreadsheetImportModel')>();
  return {
    ...actual,
    mergeImportedOrdersFromMatrixWithMapping: vi.fn(),
  };
});

vi.mock('@shared/lib/nameMatching', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@shared/lib/nameMatching')>();
  return {
    ...actual,
    matchEmployeeNames: vi.fn(),
  };
});

vi.mock('@modules/orders/utils/xlsx', () => ({
  loadXlsx: vi.fn().mockResolvedValue({
    utils: {
      aoa_to_sheet: aoaToSheetMock,
      book_new: bookNewMock,
      book_append_sheet: bookAppendSheetMock,
      sheet_to_json: sheetToJsonMock,
    },
    writeFile: writeFileMock,
    read: readMock,
  }),
}));

describe('spreadsheetFileOps', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    aoaToSheetMock.mockReturnValue({});
  });

  describe('exportSpreadsheetExcel', () => {
    it('generates and downloads an excel file', async () => {
      const filteredEmployees = [{ id: 'emp1', name: 'John', platform_accounts: [], identity_id: '', is_active: true, avatar_url: '', created_at: '', updated_at: '' }];
      const empDayTotal = vi.fn().mockReturnValue(5);
      const empMonthTotal = vi.fn().mockReturnValue(15);
      const dayArr = [1, 2, 3];

      await exportSpreadsheetExcel({
        year: 2026,
        month: 3,
        dayArr,
        filteredEmployees,
        empDayTotal,
        empMonthTotal,
      });

      expect(aoaToSheetMock).toHaveBeenCalled();
      expect(bookNewMock).toHaveBeenCalled();
      expect(bookAppendSheetMock).toHaveBeenCalled();
      expect(writeFileMock).toHaveBeenCalledWith(undefined, 'طلبات_3_2026.xlsx');
      expect(toastSuccessMock).toHaveBeenCalledWith('Success Action');
    });

    it('exports the daily app report with correct totals', async () => {
      vi.mocked(orderService.getMonthTargets).mockResolvedValue([{ app_id: 'app1', target_orders: 10, employee_target_orders: 10 }]);
      const employees = [
        { id: 'emp1', name: 'John', platform_accounts: [], identity_id: '', is_active: true, avatar_url: '', created_at: '', updated_at: '' },
        { id: 'emp2', name: 'Jane', platform_accounts: [], identity_id: '', is_active: true, avatar_url: '', created_at: '', updated_at: '' },
      ];
      const apps = [{ id: 'app1', name: 'App1', created_at: '', updated_at: '' }];
      const data = {
        'emp1::app1::1': 5,
        'emp2::app1::2': 3,
        'emp2::app1::3': 2,
      };

      await import('./spreadsheetFileOps').then(async ({ exportDailyAppReportExcel }) => {
        await exportDailyAppReportExcel({
          year: 2026,
          month: 3,
          startDay: 1,
          endDay: 3,
          appId: 'app1',
          employees,
          data,
          apps,
        });
      });

      expect(aoaToSheetMock).toHaveBeenCalled();
      const exportedRows = aoaToSheetMock.mock.calls[0][0] as Array<Array<string | number>>;
      expect(exportedRows[2]).toEqual(['اسم المندوب', 'إجمالي الطلبات', 'تارجت المندوب', 'نسبة الإنجاز', 'المتبقي للوصول للتارجت', 'متوقع تحقيق التارجت', 'التوصيات']);
      expect(exportedRows).toContainEqual(['John', 5, 10, '50.0%', 5, 'غير متوقع (5)', '']);
      expect(exportedRows).toContainEqual(['Jane', 5, 10, '50.0%', 5, 'غير متوقع (5)', '']);
      expect(writeFileMock).toHaveBeenCalledWith(undefined, 'تقرير_App1_1_إلى_3.xlsx');
    });
  });

  describe('downloadSpreadsheetTemplate', () => {
    it('downloads the template', async () => {
      await downloadSpreadsheetTemplate([1, 2, 3]);
      expect(aoaToSheetMock).toHaveBeenCalledWith([buildOrdersIoHeaders([1, 2, 3])]);
      expect(writeFileMock).toHaveBeenCalledWith(undefined, 'template_orders.xlsx');
    });
  });

  describe('printSpreadsheetTable', () => {
    it('handles print window', () => {
      const mockWindow = {
        document: {
          documentElement: { setAttribute: vi.fn() },
          head: { appendChild: vi.fn() },
          body: { replaceChildren: vi.fn(), appendChild: vi.fn() },
          createElement: vi.fn().mockReturnValue({ setAttribute: vi.fn() }),
        },
        onload: null as any,
        print: vi.fn(),
        onafterprint: null as any,
        close: vi.fn(),
      };
      vi.spyOn(globalThis, 'open').mockReturnValue(mockWindow as any);
      
      const tableEl = document.createElement('table');
      printSpreadsheetTable({ tableEl, year: 2026, month: 3, filteredEmployeeCount: 5 });

      expect(globalThis.open).toHaveBeenCalled();
      
      // trigger onload
      if (mockWindow.onload) mockWindow.onload(new Event('load'));
      expect(mockWindow.print).toHaveBeenCalled();
      
      if (mockWindow.onafterprint) mockWindow.onafterprint(new Event('afterprint'));
      expect(mockWindow.close).toHaveBeenCalled();
    });

    it('prints the daily app report with totals from data keys', async () => {
      vi.mocked(orderService.getMonthTargets).mockResolvedValue([{ app_id: 'app1', target_orders: 10 }]);
      vi.useFakeTimers();
      const appendChildMock = vi.fn();
      const mockWindow = {
        document: {
          documentElement: { setAttribute: vi.fn() },
          head: { appendChild: vi.fn() },
          body: { replaceChildren: vi.fn(), appendChild: appendChildMock },
          createElement: (tag: string) => document.createElement(tag),
        },
        print: vi.fn(),
      };
      vi.spyOn(globalThis, 'open').mockReturnValue(mockWindow as any);
      const { printDailyAppReportTable } = await import('./spreadsheetFileOps');

      await printDailyAppReportTable({
        year: 2026,
        month: 3,
        startDay: 1,
        endDay: 3,
        appId: 'app1',
        employees: [
          { id: 'emp1', name: '<img src=x onerror=alert(1)>', platform_accounts: [], identity_id: '', is_active: true, avatar_url: '', created_at: '', updated_at: '' },
          { id: 'emp2', name: 'Jane', platform_accounts: [], identity_id: '', is_active: true, avatar_url: '', created_at: '', updated_at: '' },
        ],
        data: {
          'emp1::app1::1': 5,
          'emp2::app1::2': 3,
          'emp2::app1::3': 2,
        },
        apps: [{ id: 'app1', name: 'App1', created_at: '', updated_at: '' }],
      });

      expect(globalThis.open).toHaveBeenCalled();
      
      const tableEl = appendChildMock.mock.calls.find(call => call[0]?.tagName === 'TABLE')?.[0] as HTMLTableElement;
      expect(tableEl).toBeDefined();
      expect(tableEl.textContent).toContain('<img src=x onerror=alert(1)>');
      expect(tableEl.querySelector('img')).toBeNull();
      expect(tableEl.innerHTML).toContain('Jane');
      expect(tableEl.innerHTML).toContain('5');

      vi.runAllTimers();
      expect(mockWindow.print).toHaveBeenCalled();
      
      vi.useRealTimers();
    });
  });

  describe('saveSpreadsheetMonth', () => {
    it('returns false if month is locked', async () => {
      const result = await saveSpreadsheetMonth({
        isMonthLocked: true,
        year: 2026, month: 3, days: 31,
        data: {}, setSaving: vi.fn(), employees: [], apps: []
      });
      expect(result).toBe(false);
      expect(toastErrorMock).toHaveBeenCalled();
    });

    it('returns false if no data to save', async () => {
      const setSaving = vi.fn();
      const result = await saveSpreadsheetMonth({
        isMonthLocked: false,
        year: 2026, month: 3, days: 31,
        data: {}, setSaving, employees: [], apps: []
      });
      expect(result).toBe(false);
      expect(setSaving).toHaveBeenCalledWith(false);
      expect(toastErrorMock).toHaveBeenCalled();
    });

    it('saves valid data', async () => {
      vi.mocked(orderService.bulkUpsert).mockResolvedValue({ saved: 1, failed: [] });
      const setSaving = vi.fn();
      const data = { 'emp1::app1::1': 5 };
      const employees = [{ id: 'emp1', name: 'John', platform_accounts: [], identity_id: '', is_active: true, avatar_url: '', created_at: '', updated_at: '' }];
      const apps = [{ id: 'app1', name: 'App1', created_at: '', updated_at: '' }];
      
      const result = await saveSpreadsheetMonth({
        isMonthLocked: false,
        year: 2026, month: 3, days: 31,
        data, setSaving, employees, apps
      });
      
      expect(result).toBe(true);
      expect(orderService.bulkUpsert).toHaveBeenCalled();
      expect(toastSuccessMock).toHaveBeenCalledWith('Success Op', expect.any(Object));
    });

    it('warns about invalid data', async () => {
      vi.mocked(orderService.bulkUpsert).mockResolvedValue({ saved: 0, failed: [] });
      const data = { 'emp1::app1::32': 5, 'emp1::app1::1': -5 };
      
      await saveSpreadsheetMonth({
        isMonthLocked: false,
        year: 2026, month: 3, days: 31,
        data, setSaving: vi.fn(), employees: [], apps: []
      });
      
      expect(toastWarningMock).toHaveBeenCalled();
    });
  });

  describe('runSpreadsheetImport', () => {
    it('errors on invalid file extension', async () => {
      const file = new File([''], 'test.csv');
      const result = await runSpreadsheetImport({
        file, dayArr: [], employees: [], apps: [], appEmployeeIds: {}, data: {}, onApplyData: vi.fn()
      });
      expect(result).toBeNull();
      expect(toastErrorMock).toHaveBeenCalled();
    });

    it('errors on empty sheet', async () => {
      const file = new File([''], 'test.xlsx');
      file.arrayBuffer = vi.fn().mockResolvedValue(new ArrayBuffer(0));
      readMock.mockReturnValue({ SheetNames: [] });
      
      const result = await runSpreadsheetImport({
        file, dayArr: [], employees: [], apps: [], appEmployeeIds: {}, data: {}, onApplyData: vi.fn()
      });
      expect(result).toBeNull();
    });

    it('successfully imports valid spreadsheet', async () => {
      const file = new File([''], 'test.xlsx');
      file.arrayBuffer = vi.fn().mockResolvedValue(new ArrayBuffer(0));
      readMock.mockReturnValue({ SheetNames: ['Sheet1'], Sheets: { Sheet1: {} } });
      const headers = buildOrdersIoHeaders([1, 2]);
      sheetToJsonMock.mockReturnValue([headers, ['John', 5, 10]]);
      
      vi.mocked(matchEmployeeNames).mockReturnValue({
        matched: new Map([['John', { id: 'emp1', name: 'John', platform_accounts: [], identity_id: '', is_active: true, avatar_url: '', created_at: '', updated_at: '' }]]),
        unmatched: []
      });
      
      vi.mocked(mergeImportedOrdersFromMatrixWithMapping).mockReturnValue({
        newData: { 'emp1::app1::1': 5 },
        imported: 1,
        skipped: 0,
        errors: []
      });
      
      const onApplyData = vi.fn();
      
      const result = await runSpreadsheetImport({
        file, dayArr: [1, 2], employees: [], apps: [], appEmployeeIds: {}, data: {}, onApplyData
      });
      
      expect(result).toBeTruthy();
      expect(result?.imported).toBe(1);
      expect(onApplyData).toHaveBeenCalledWith({ 'emp1::app1::1': 5 });
      expect(toastSuccessMock).toHaveBeenCalled();
    });
  });
});
