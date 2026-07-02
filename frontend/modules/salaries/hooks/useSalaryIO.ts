import { useCallback } from 'react';
import type React from 'react';
import { toast as sonnerToast } from '@shared/components/ui/sonner';
import { TABLE_ACTIONS_IMPORT_MAX_BYTES } from '@shared/components/table/TableActions';
import {
  SALARY_IMPORT_TEMPLATE_HEADERS,
  SALARY_IO_COLUMNS,
  type SalaryIoRecord,
  parseSalaryImportWorkbook,
} from '@shared/lib/salaryExcelImport';
import { auditService } from '@services/auditService';
import { salaryDataService } from '@services/salaryDataService';
import { getManualDeductionTotal } from '@modules/salaries/lib/salaryDomain';
import { loadXlsx } from '@modules/salaries/lib/salaryPdfLoaders';
import type { SalaryRow } from '@modules/salaries/types/salary.types';
import type { computeSalaryRow } from '@modules/salaries/hooks/useSalaryTable';
import { runSafe } from '@shared/lib/logger';
import { useSafeAction } from '@shared/hooks/useSafeAction';

// ─── Params ──────────────────────────────────────────────────────────────────

export interface UseSalaryIOParams {
  filtered: SalaryRow[];
  computeRow: (r: SalaryRow) => ReturnType<typeof computeSalaryRow>;
  selectedMonth: string;
  toast: typeof sonnerToast;
  uid: string;
  queryClient: ReturnType<typeof import('@tanstack/react-query').useQueryClient>;
  salaryToolbarImportRef: React.RefObject<HTMLInputElement | null>;
  salaryActionLoading: boolean;
  setSalaryActionLoading: React.Dispatch<React.SetStateAction<boolean>>;
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useSalaryIO(params: UseSalaryIOParams) {
  const {
    filtered,
    computeRow,
    selectedMonth,
    toast,
    uid,
    queryClient,
    salaryToolbarImportRef,
    salaryActionLoading,
    setSalaryActionLoading,
  } = params;

  const { run } = useSafeAction({ toast, errorTitle: 'فشل الاستيراد' });

  // ── Export Excel ──────────────────────────────────────────────────────────

  const exportExcel = useCallback(async () => {
    const XLSX = await loadXlsx();
    const records: SalaryIoRecord[] = filtered.map((r) => {
      const c = computeRow(r);
      return {
        employee_id: r.employeeId,
        month_year: selectedMonth,
        base_salary: Number(c.totalPlatformSalary || 0),
        allowances: Number(c.totalAdditions || 0),
        attendance_deduction: Number(r.violations || 0),
        advance_deduction: Number(r.advanceDeduction || 0),
        external_deduction: Number(r.externalDeduction || 0),
        manual_deduction: Number(getManualDeductionTotal(r) || 0),
        net_salary: Number(c.netSalary || 0),
        is_approved: r.status === 'approved' || r.status === 'paid',
      };
    });

    const headerRow = SALARY_IO_COLUMNS.map((column) => column.label);
    const dataRows = records.map((record) => SALARY_IO_COLUMNS.map((column) => record[column.key]));
    const ws = XLSX.utils.aoa_to_sheet([headerRow, ...dataRows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'الرواتب');
    const [year, month] = selectedMonth.split('-');
    XLSX.writeFile(wb, `رواتب_${month}_${year}.xlsx`);
    toast.success('📊 تم التصدير بنجاح');
  }, [filtered, computeRow, selectedMonth, toast]);

  // ── Download template ─────────────────────────────────────────────────────

  const downloadSalaryTemplate = useCallback(async () => {
    const XLSX = await loadXlsx();
    const ws = XLSX.utils.aoa_to_sheet([Array.from(SALARY_IMPORT_TEMPLATE_HEADERS)]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'رواتب');
    XLSX.writeFile(wb, 'قالب_استيراد_الرواتب.xlsx');
  }, []);

  // ── Import from file ──────────────────────────────────────────────────────

  const handleSalaryImportFile = useCallback(
    async (file: File) => {
      setSalaryActionLoading(true);
      try {
        await run(async () => {
          const buf = await file.arrayBuffer();
          const { rows: parsed, parseErrors } = await parseSalaryImportWorkbook(buf, {
            defaultMonthYear: selectedMonth,
          });
          if (parsed.length === 0) {
            toast.error('بيانات ناقصة في ملف الإكسيل', {
              description: parseErrors.slice(0, 5).join(' · ') || 'لا توجد صفوف صالحة',
            });
            return;
          }
          const records = parsed.map((p) => p.record);
          await salaryDataService.upsertSalaryRecords(records);
          await auditService.logAdminAction({
            action: 'salary_records.import_excel',
            table_name: 'salary_records',
            record_id: null,
            meta: { count: parsed.length, month: selectedMonth },
          });
          // FIX C3: correct query key — was 'base-context', now 'context' to match useSalaryData
          await queryClient.invalidateQueries({
            queryKey: ['salaries', uid, 'context', selectedMonth],
          });
          toast.success(`تم استيراد ${parsed.length} سجل بنجاح`);
        });
      } finally {
        setSalaryActionLoading(false);
      }
    },
    [run, selectedMonth, toast, uid, queryClient, setSalaryActionLoading],
  );

  // ── Toolbar wiring ────────────────────────────────────────────────────────

  const runExportExcel = useCallback(async () => {
    setSalaryActionLoading(true);
    try {
      await exportExcel();
    } finally {
      setSalaryActionLoading(false);
    }
  }, [exportExcel, setSalaryActionLoading]);

  const openSalaryToolbarImport = useCallback(() => {
    if (salaryActionLoading) return;
    salaryToolbarImportRef.current?.click();
  }, [salaryActionLoading, salaryToolbarImportRef]);

  const onSalaryToolbarImportChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = '';
      if (!file) return;
      if (file.size > TABLE_ACTIONS_IMPORT_MAX_BYTES) {
        toast.error('خطأ', { description: 'حجم الملف يتجاوز 5 ميجابايت' });
        return;
      }
      const isValidFormat = /\.xlsx?$/i.test(file.name);
      if (!isValidFormat) {
        toast.error('خطأ', { description: 'صيغة الملف غير مدعومة — استخدم xlsx أو xls' });
        return;
      }
      runSafe(handleSalaryImportFile(file), '[SalaryIO] import file failed');
    },
    [handleSalaryImportFile, toast],
  );

  return {
    exportExcel,
    downloadSalaryTemplate,
    handleSalaryImportFile,
    runExportExcel,
    openSalaryToolbarImport,
    onSalaryToolbarImportChange,
  };
}
