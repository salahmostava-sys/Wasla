import { useCallback, useRef, useEffect } from 'react';
import { todayISO } from '@shared/lib/formatters';
import { cycleSortState } from '@shared/lib/sortTableIndicators';
import { employeeService, EMPLOYEE_DELETE_BLOCKED_MESSAGE } from '@services/employeeService';
import { getErrorMessage } from '@services/serviceError';
import { auditService } from '@services/auditService';
import { EMPLOYEE_IMPORT_COLUMNS } from '@shared/constants/excelSchemas';
import { EMPLOYEE_TEMPLATE_AR_HEADERS } from '@shared/lib/employeeArabicTemplateImport';
import { printHtmlTable } from '@shared/lib/printTable';
import { getEmployeeCities } from '@modules/employees/model/employeeUtils';
import { cityLabel } from '@modules/employees/model/employeeCity';
import {
  employeeCitySummary,
  processBulkImportRows,
  type Employee,
  type SortDir,
  type UploadReport,
  type UploadLiveStats,
} from '@modules/employees/types/employee.types';

import { loadXlsx } from '@modules/orders/utils/xlsx';
import { useUndo } from '@shared/context/UndoContext';

export function useEmployeeActions(params: {
  data: Employee[];
  setData: React.Dispatch<React.SetStateAction<Employee[]>>;
  filtered: Employee[];
  sortField: string | null;
  setSortField: React.Dispatch<React.SetStateAction<string | null>>;
  sortDir: SortDir;
  setSortDir: React.Dispatch<React.SetStateAction<SortDir>>;
  toast: (opts: { title: string; description?: string; variant?: "default" | "destructive" }) => unknown;
  permissions: { can_view: boolean; can_edit: boolean; can_delete: boolean };
  deleteEmployee: Employee | null;
  setDeleteEmployee: React.Dispatch<React.SetStateAction<Employee | null>>;
  setDeleting: React.Dispatch<React.SetStateAction<boolean>>;
  setActionLoading: React.Dispatch<React.SetStateAction<boolean>>;
  setIsUploading: React.Dispatch<React.SetStateAction<boolean>>;
  setUploadProgress: React.Dispatch<React.SetStateAction<number>>;
  setUploadReport: React.Dispatch<React.SetStateAction<UploadReport | null>>;
  setUploadLiveStats: React.Dispatch<React.SetStateAction<UploadLiveStats>>;
  uploadIntervalRef: React.MutableRefObject<ReturnType<typeof setInterval> | null>;
  refetchEmployees: () => Promise<unknown>;
  syncSystemAfterEmployeeImport: () => Promise<void>;
  statusDateDialog: { emp: Employee; newStatus: string; label: string } | null;
  statusDate: string;
  setStatusDateSaving: React.Dispatch<React.SetStateAction<boolean>>;
  setStatusDateDialog: React.Dispatch<React.SetStateAction<{ emp: Employee; newStatus: string; label: string } | null>>;
  tableRef: React.RefObject<HTMLTableElement | null>;
  colFilters: Record<string, string>;
  setColFilters: React.Dispatch<React.SetStateAction<Record<string, string>>>;
}) {
  const {
    data, setData, filtered, sortField, setSortField, sortDir, setSortDir,
    toast, permissions, deleteEmployee, setDeleteEmployee, setDeleting,
    setActionLoading, setIsUploading, setUploadProgress, setUploadReport,
    setUploadLiveStats, uploadIntervalRef, refetchEmployees,
    syncSystemAfterEmployeeImport,
    statusDateDialog, statusDate, setStatusDateSaving, setStatusDateDialog,
    tableRef, setColFilters,
  } = params;

  const { registerAction } = useUndo();

  // Keep a stable ref to data so saveField doesn't need data as a dep
  const dataRef = useRef(data);
  useEffect(() => { dataRef.current = data; }, [data]);

  const handleSort = useCallback((field: string) => {
    const next = cycleSortState(sortField, sortDir, field);
    setSortField(next.sortField);
    setSortDir(next.sortDir);
  }, [sortField, sortDir, setSortField, setSortDir]);

  // Reverts a single employee row to its previous field values (used by the undo stack).
  const buildRevertPatch = (
    prev: Record<string, unknown>,
    field: string,
    prevValue: string | null,
    extraFields?: Record<string, unknown>,
  ): Record<string, unknown> => {
    const revertPatch: Record<string, unknown> = { [field]: prevValue };
    if (!extraFields) return revertPatch;
    for (const key of Object.keys(extraFields)) {
      revertPatch[key] = prev[key] ?? null;
    }
    return revertPatch;
  };

  const saveField = useCallback(async (id: string, field: string, value: string | null, extraFields?: Record<string, unknown>) => {
    const prev = dataRef.current.find(e => e.id === id);
    const prevValue = prev ? (prev as Record<string, unknown>)[field] as string | null : null;
    const coerced = value === '' ? null : value;
    const updatePatch = { [field]: coerced, ...(extraFields) };
    setData(d => d.map(e => e.id === id ? { ...e, ...updatePatch } : e));
    try {
      await employeeService.updateEmployee(id, updatePatch);
      // Register undo action after successful save
      if (prev) {
        const revertRow = async () => {
          const revertPatch = buildRevertPatch(prev as Record<string, unknown>, field, prevValue, extraFields);
          setData(d => d.map(e => e.id === id ? { ...e, ...revertPatch } : e));
          await employeeService.updateEmployee(id, revertPatch);
        };
        registerAction({
          description: `تعديل ${prev.name} — حقل "${field}"`,
          undoCommand: revertRow,
        });
      }
    } catch (err: unknown) {
      const message = getErrorMessage(err, 'تعذر حفظ التعديل');
      setData(d => d.map(e => e.id === id ? (prev ?? e) : e));
      toast({ title: 'خطأ في الحفظ', description: message, variant: 'destructive' });
    }
  }, [setData, toast, registerAction]);


  const handleSaveStatusWithDate = async () => {
    if (!statusDateDialog) return;
    setStatusDateSaving(true);
    const extraFields =
      statusDateDialog.newStatus === 'absconded' || statusDateDialog.newStatus === 'terminated'
        ? { probation_end_date: statusDate }
        : undefined;
    await saveField(
      statusDateDialog.emp.id,
      'sponsorship_status',
      statusDateDialog.newStatus,
      extraFields,
    );
    toast({
      title: `✅ تم تحديث الحالة إلى "${statusDateDialog.label}"`,
      description: `التاريخ: ${statusDate}`,
    });
    setStatusDateSaving(false);
    setStatusDateDialog(null);
  };

  const handleDelete = useCallback(async () => {
    if (!deleteEmployee) return;
    setDeleting(true);
    try {
      await employeeService.deleteById(deleteEmployee.id);
      setData(d => d.filter(e => e.id !== deleteEmployee.id));
      toast({ title: 'تم الحذف', description: deleteEmployee.name });
    } catch (err: unknown) {
      const message = getErrorMessage(err, 'تعذر حذف المندوب');
      const blocked = message === EMPLOYEE_DELETE_BLOCKED_MESSAGE;
      toast({
        title: blocked ? 'لا يمكن الحذف' : 'خطأ في الحذف',
        description: message,
        variant: 'destructive',
      });
    }
    setDeleting(false);
    setDeleteEmployee(null);
  }, [deleteEmployee, setData, setDeleteEmployee, setDeleting, toast]);

  const setColFilter = useCallback((key: string, value: string) => {
    setColFilters(prev => {
      const next = { ...prev };
      if (!value || value === 'all') delete next[key];
      else next[key] = value;
      return next;
    });
  }, [setColFilters]);

  const handleExport = async () => {
    const XLSX = await loadXlsx();
    const rows = filtered.map((e) => ({
      name: e.name ?? '',
      name_en: e.name_en ?? '',
      national_id: e.national_id ?? '',
      phone: e.phone ?? '',
      email: e.email ?? '',
      cities: employeeCitySummary(e, ''),
      nationality: e.nationality ?? '',
      job_title: e.job_title ?? '',
      join_date: e.join_date ?? '',
      birth_date: e.birth_date ?? '',
      probation_end_date: e.probation_end_date ?? '',
      residency_expiry: e.residency_expiry ?? '',
      health_insurance_expiry: e.health_insurance_expiry ?? '',
      license_expiry: e.license_expiry ?? '',
      license_status: e.license_status ?? '',
      sponsorship_status: e.sponsorship_status ?? '',
      bank_account_number: e.bank_account_number ?? '',
      iban: e.iban ?? '',
      commercial_record: e.commercial_record ?? '',
      salary_type: e.salary_type || 'shift',
      status: e.status || 'active',
    }));
    const headerRow = EMPLOYEE_IMPORT_COLUMNS.map((column) => column.label);
    const aoaRows = rows.map((row) => EMPLOYEE_IMPORT_COLUMNS.map((column) => row[column.key]));
    const ws = XLSX.utils.aoa_to_sheet([headerRow, ...aoaRows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'بيانات الموظفين');
    XLSX.writeFile(wb, `بيانات_المناديب_${todayISO()}.xlsx`);
  };

  const handleFastExport = async () => {
    const XLSX = await loadXlsx();
    const branch = undefined;
    const search = undefined;
    const status = undefined;

    let out: Array<{
      name: string;
      national_id: string | null;
      phone: string | null;
      city: string | null;
      cities?: string[] | null;
      status: string;
      sponsorship_status: string | null;
      license_status: string | null;
      residency_expiry: string | null;
      join_date: string | null;
      job_title: string | null;
    }>;
    try {
      out = (await employeeService.exportEmployees({ filters: { branch, search, status } })) as typeof out;
    } catch (e: unknown) {
      const message = getErrorMessage(e, 'تعذر التصدير');
      toast({ title: 'خطأ', description: message, variant: 'destructive' });
      return;
    }

    const rows = out.map((e, i) => ({
      '#': i + 1,
      'الاسم': e.name ?? '',
      'رقم الهوية': e.national_id ?? '',
      'رقم الهاتف': e.phone ?? '',
      'المدن': getEmployeeCities(e).map((city) => cityLabel(city, city)).join('، '),
      'الحالة': e.status ?? '',
      'حالة الكفالة': e.sponsorship_status ?? '',
      'حالة الرخصة': e.license_status ?? '',
      'انتهاء الإقامة': e.residency_expiry ?? '',
      'تاريخ الانضمام': e.join_date ?? '',
      'المسمى الوظيفي': e.job_title ?? '',
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Employees');
    XLSX.writeFile(wb, `employees_fast_${todayISO()}.xlsx`);

    await auditService.logAdminAction({
      action: 'employees.export',
      table_name: 'employees',
      record_id: null,
      meta: { total: out.length, branch: branch ?? null, status: status ?? null, search: search ?? null },
    });
      toast({ title: 'تم التصدير', description: `تمت معالجة ${out.length} صف` });
  };

  const handleTemplate = async () => {
    const XLSX = await loadXlsx();
    const headers = [Array.from(EMPLOYEE_TEMPLATE_AR_HEADERS)];
    const ws = XLSX.utils.aoa_to_sheet(headers);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'القالب');
    XLSX.writeFile(wb, 'import_template.xlsx');
  };

  const handlePrint = () => {
    const table = tableRef.current;
    if (!table) return;
    printHtmlTable(table, {
      title: 'بيانات الموظفين',
      subtitle: `المجموع: ${filtered.length} موظف — ${new Date().toLocaleDateString('ar-SA')}`,
    });
  };

  const runExportDetailed = async () => {
    setActionLoading(true);
    try {
      await handleExport();
      toast({ title: `تم التصدير`, description: `عُالج ${filtered.length} صفاً` });
    } catch (e: unknown) {
      toast({
        title: 'تعذر التصدير',
        description: getErrorMessage(e, 'صيغة الملف أو البيانات غير صالحة'),
        variant: 'destructive',
      });
    } finally {
      setActionLoading(false);
    }
  };

  const runTemplateDownload = async () => {
    setActionLoading(true);
    try {
      await handleTemplate();
      toast({ title: 'تم التنزيل', description: 'تم تنزيل قالب الاستيراد' });
    } catch (e: unknown) {
      toast({
        title: 'تعذر التنزيل',
        description: getErrorMessage(e, 'فشل إنشاء ملف القالب'),
        variant: 'destructive',
      });
    } finally {
      setActionLoading(false);
    }
  };

  const runPrintDetailed = async () => {
    setActionLoading(true);
    try {
      handlePrint();
    } finally {
      setActionLoading(false);
    }
  };

  const runImportFile = async (file: File) => {
    if (!permissions.can_edit) {
      toast({
        title: 'غير مسموح',
        description: 'لا تملك صلاحية استيراد بيانات الموظفين',
        variant: 'destructive',
      });
      return;
    }
    setActionLoading(true);
    setIsUploading(true);
    setUploadProgress(0);
    setUploadReport(null);
    setUploadLiveStats({ processedNames: 0, totalNames: 0, currentName: '' });
    if (uploadIntervalRef.current) {
      clearInterval(uploadIntervalRef.current);
      uploadIntervalRef.current = null;
    }

    try {
      const buf = await file.arrayBuffer();
      const { report, headerWarnings } = await processBulkImportRows(buf, setUploadProgress, setUploadLiveStats);
      setUploadReport(report);
      if (report.totalProcessed === 0) {
        const firstIssue = report.errors[0]?.issue;
        toast({
          title: 'تعذر المعالجة',
          description: firstIssue || 'الملف لا يحتوي على بيانات صالحة',
          variant: 'destructive',
        });
        setIsUploading(false);
        setUploadProgress(0);
        setUploadLiveStats({ processedNames: 0, totalNames: 0, currentName: '' });
        return;
      }
      await refetchEmployees();
      if (report.successfulRows > 0) {
        await syncSystemAfterEmployeeImport();
      }
      await auditService.logAdminAction({
        action: 'employees.import_arabic_template',
        table_name: 'employees',
        record_id: null,
        meta: { processed: report.successfulRows, failed: report.failedRows, headerWarnings },
      });
      const hasFailures = report.failedRows > 0;
      if (report.successfulRows === 0) {
        const topIssues = report.errors.slice(0, 3).map((error) => `سطر ${error.rowIndex}: ${error.issue}`);
        toast({
          title: 'فشل الاستيراد',
          description: topIssues.join(' • ') || 'تعذر استيراد أي سطر من الملف',
          variant: 'destructive',
        });
      } else {
        toast({
          title: hasFailures ? 'اكتملت المعالجة مع أخطاء' : 'اكتملت المعالجة بنجاح',
          description: hasFailures
            ? `تمت معالجة ${report.totalProcessed} سطر، نجح ${report.successfulRows} وفشل ${report.failedRows}`
            : `تمت معالجة ${report.totalProcessed} سطر بنجاح`,
          variant: hasFailures ? 'destructive' : undefined,
        });
      }
      setUploadProgress(100);
      setTimeout(() => {
        setIsUploading(false);
        setUploadProgress(0);
        setUploadLiveStats({ processedNames: 0, totalNames: 0, currentName: '' });
      }, 900);
    } catch (e: unknown) {
      toast({
        title: 'تعذر معالجة الملف',
        description: getErrorMessage(e, 'حدث خطأ أثناء معالجة الملف'),
        variant: 'destructive',
      });
      if (uploadIntervalRef.current) {
        clearInterval(uploadIntervalRef.current);
        uploadIntervalRef.current = null;
      }
      setIsUploading(false);
      setUploadProgress(0);
      setUploadLiveStats({ processedNames: 0, totalNames: 0, currentName: '' });
    } finally {
      setActionLoading(false);
    }
  };

  const runFastExportWrapped = async () => {
    setActionLoading(true);
    try {
      await handleFastExport();
    } finally {
      setActionLoading(false);
    }
  };

  return {
    handleSort, saveField, handleSaveStatusWithDate, handleDelete,
    setColFilter, handleExport, handleFastExport, handleTemplate,
    handlePrint, runExportDetailed, runTemplateDownload, runPrintDetailed,
    runImportFile, runFastExportWrapped,
  };
}
