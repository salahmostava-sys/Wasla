import { Suspense, lazy, useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Loader2, CalendarDays, BarChart2, Table2 } from 'lucide-react';
import { Input } from '@shared/components/ui/input';
import { Button } from '@shared/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@shared/components/ui/dialog';
import { Label } from '@shared/components/ui/label';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@shared/components/ui/alert-dialog';
import { useToast } from '@shared/hooks/use-toast';
import { todayISO, normalizeArabicDigits } from '@shared/lib/formatters';
import { useSystemSettings } from '@app/providers/SystemSettingsContext';
import { usePermissions } from '@shared/hooks/usePermissions';
import { usePagePresence } from '@shared/hooks/usePagePresence';
import { PresenceAvatars } from '@shared/components/PresenceAvatars';
import { useAuthQueryGate } from '@shared/hooks/useAuthQueryGate';
import { QueryErrorRetry } from '@shared/components/QueryErrorRetry';
import { isEmployeeVisibleInMonth } from '@shared/lib/employeeVisibility';
import { getEmployeeCities, applyEmployeeFilters, sortEmployees } from '@modules/employees/model/employeeUtils';
import { useEmployeesData } from '@modules/employees/hooks/useEmployees';
import { EmployeeActionsBar } from '@modules/employees/components/EmployeeActionsBar';
import { EmployeeDetailedTable } from '@modules/employees/components/EmployeeTable';
import { useEmployeeActions } from '@modules/employees/hooks/useEmployeeTable';
import Loading from '@shared/components/Loading';
import { CommercialRecordsManager } from '@shared/components/employees/CommercialRecordsManager';
import { EmployeeKPIs } from '@modules/employees/components/EmployeeKPIs';
import {
  ALL_COLUMNS, DEFAULT_HIDDEN_COLS,
  type Employee, type SortDir, type ColKey,
  type UploadReport, type UploadLiveStats,
} from '@modules/employees/types/employee.types';

const EmployeeProfile = lazy(() => import('@shared/components/employees/EmployeeProfile'));
const EmployeeFormModal = lazy(() =>
  import('@modules/employees/components/EmployeeFormModal').then((module) => ({
    default: module.EmployeeFormModal,
  })),
);

/** Minimum time (ms) the page must be hidden before triggering a background refetch. */
const VISIBILITY_REFETCH_DELAY_MS = 90_000;

const InlineLoader = ({ minHeightClassName = 'min-h-[260px]' }: Readonly<{ minHeightClassName?: string }>) => (
  <Loading minHeightClassName={minHeightClassName} />
);

const Employees = () => {
  useAuthQueryGate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  useSystemSettings();
  const { permissions } = usePermissions('employees');
  const presence = usePagePresence('employees');
  const [data, setData] = useState<Employee[]>([]);
  const {
    employees: employeesData,
    allEmployees: allEmployeesData,
    activeEmployeeIdsInMonth,
    isLoading: loading,
    error: employeesError,
    refetch: refetchEmployees,
  } = useEmployeesData();
  const [activeTab, setActiveTab] = useState<'table' | 'kpi'>('table');
  const [sortField, setSortField] = useState<string | null>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [visibleCols, setVisibleCols] = useState<Set<ColKey>>(() => {
    try {
      const saved = localStorage.getItem('employees_visible_cols');
      if (saved) {
        const parsed = JSON.parse(saved) as string[];
        const validKeys = new Set<string>(ALL_COLUMNS.map(c => c.key));
        if (Array.isArray(parsed)) {
          const filtered = parsed.filter(k => validKeys.has(k));
          if (filtered.length > 0) return new Set(filtered as ColKey[]);
        }
      }
    } catch { /* ignore */ }
    return new Set(ALL_COLUMNS.map(c => c.key).filter(k => !DEFAULT_HIDDEN_COLS.has(k)));
  });
  // Persist column visibility to localStorage
  useEffect(() => {
    localStorage.setItem('employees_visible_cols', JSON.stringify([...visibleCols]));
  }, [visibleCols]);

  const [colFilters, setColFilters] = useState<Record<string, string>>({});
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [selectedEmployee, setSelectedEmployee] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showCommercialRecordsManager, setShowCommercialRecordsManager] = useState(false);
  const [editEmployee, setEditEmployee] = useState<Employee | null>(null);
  const [deleteEmployee, setDeleteEmployee] = useState<Employee | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const uploadIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [uploadReport, setUploadReport] = useState<UploadReport | null>(null);
  const [uploadLiveStats, setUploadLiveStats] = useState<UploadLiveStats>({
    processedNames: 0, totalNames: 0, currentName: '',
  });
  const [statusDateDialog, setStatusDateDialog] = useState<{
    emp: Employee; newStatus: string; label: string;
  } | null>(null);
  const [statusDate, setStatusDate] = useState<string>(todayISO());
  const [statusDateSaving, setStatusDateSaving] = useState(false);
  const tableRef = useRef<HTMLTableElement>(null);

  const syncSystemAfterEmployeeImport = useCallback(async () => {
    const shouldRefresh = (value: string) =>
      value.includes('employee') || value.includes('dashboard') || value.includes('order')
      || value.includes('attendance') || value.includes('advance') || value.includes('salary')
      || value.includes('fuel') || value.includes('vehicle') || value.includes('platform')
      || value.includes('alert') || value.includes('tier') || value.includes('app');
    const predicate = (query: { queryKey: readonly unknown[] }) => {
      const keyText = query.queryKey.map((part) => String(part).toLowerCase()).join(' ');
      return shouldRefresh(keyText);
    };
    await queryClient.invalidateQueries({ predicate });
    await queryClient.refetchQueries({ predicate, type: 'active' });
  }, [queryClient]);

  // Local state mirrors React Query data — kept intentionally because useEmployeeActions
  // receives data/setData for optimistic inline edits (saveField, handleDelete, etc.)
  // When filtering by absconded/terminated/ended statuses, show ALL employees (including hidden)
  useEffect(() => {
    const showHidden = colFilters.status === 'ended' ||
      colFilters.sponsorship_status === 'absconded' ||
      colFilters.sponsorship_status === 'terminated';
    const source = showHidden ? (allEmployeesData) : (employeesData);
    setData(source ?? []);
  }, [employeesData, allEmployeesData, colFilters.status, colFilters.sponsorship_status]);

  useEffect(() => {
    if (!employeesError) return;
    const message =
      employeesError instanceof Error
        ? employeesError.message
        : 'حدث خطأ غير متوقع أثناء تحميل الموظفين';
    toast({ title: 'خطأ في تحميل البيانات', description: message, variant: 'destructive' });
  }, [employeesError, toast]);

  useEffect(() => {
    let hiddenAt: number | null = null;
    const minAwayMs = VISIBILITY_REFETCH_DELAY_MS;
    const onVis = () => {
      if (document.visibilityState === 'hidden') { hiddenAt = Date.now(); return; }
      if (document.visibilityState !== 'visible' || hiddenAt === null) return;
      const away = Date.now() - hiddenAt;
      hiddenAt = null;
      if (away >= minAwayMs) refetchEmployees().catch(() => {});
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [refetchEmployees]);

  useEffect(() => { setPage(1); }, [colFilters, sortField, sortDir]);

  useEffect(() => {
    return () => {
      if (uploadIntervalRef.current) {
        clearInterval(uploadIntervalRef.current);
        uploadIntervalRef.current = null;
      }
    };
  }, []);

  const uniqueVals = useMemo(() => ({
    city:               [...new Set(data.flatMap((e) => getEmployeeCities(e)).filter(Boolean))] as string[],
    nationality:        [...new Set(data.map(e => e.nationality).filter(Boolean))] as string[],
    sponsorship_status: ['sponsored', 'not_sponsored', 'absconded', 'terminated'],
    license_status:     ['has_license', 'no_license', 'applied'],
    job_title:          [...new Set(data.map(e => e.job_title).filter(Boolean))] as string[],
    status:             ['active', 'inactive', 'ended'],
  }), [data]);

  const filtered = useMemo(() => {
    const filteredRows = applyEmployeeFilters(data, colFilters);
    return sortEmployees(filteredRows, sortField, sortDir);
  }, [data, colFilters, sortField, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginated  = useMemo(
    () => filtered.slice((page - 1) * pageSize, page * pageSize),
    [filtered, page, pageSize]
  );

  const {
    handleSort, saveField, handleSaveStatusWithDate, handleDelete,
    setColFilter, runExportDetailed, runTemplateDownload, runPrintDetailed,
    runImportFile,
  } = useEmployeeActions({
    data, setData, filtered, sortField, setSortField, sortDir, setSortDir,
    toast, permissions, deleteEmployee, setDeleteEmployee, setDeleting,
    setActionLoading, setIsUploading, setUploadProgress, setUploadReport,
    setUploadLiveStats, uploadIntervalRef, refetchEmployees,
    syncSystemAfterEmployeeImport,
    statusDateDialog, statusDate, setStatusDateSaving, setStatusDateDialog,
    tableRef, colFilters, setColFilters,
  });

  const activeCols = useMemo(
    () => ALL_COLUMNS.filter(c => visibleCols.has(c.key)),
    [visibleCols],
  );
  const hasActiveFilters = Object.keys(colFilters).length > 0;
  const isTableLoading = loading;
  const hasNoPaginatedRows = paginated.length === 0;

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const handleRowEditStart = useCallback((rowId: string) => { presence.trackRow(rowId); }, [presence.trackRow]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const handleRowEditEnd = useCallback(() => { presence.trackRow(null); }, [presence.trackRow]);

  // ── Clear selectedEmployee if no longer visible in current month ──
  // (moved out of render body into an effect to avoid setState during render)
  const selectedEmp = selectedEmployee
    ? ((employeesData).find(e => e.id === selectedEmployee) ?? data.find(e => e.id === selectedEmployee))
    : undefined;
  const selectedEmpVisible = selectedEmp
    ? isEmployeeVisibleInMonth(selectedEmp, activeEmployeeIdsInMonth)
    : false;

  useEffect(() => {
    if (selectedEmployee && selectedEmp && !selectedEmpVisible) {
      setSelectedEmployee(null);
    }
  }, [selectedEmployee, selectedEmp, selectedEmpVisible]);

  // ── profile view ──
  if (selectedEmployee && selectedEmp && selectedEmpVisible) {
    return (
      <Suspense fallback={<InlineLoader minHeightClassName="min-h-[420px]" />}>
        <EmployeeProfile
          employee={selectedEmp}
          onBack={() => setSelectedEmployee(null)}
        />
      </Suspense>
    );
  }

  if (employeesError && !loading) {
    return (
      <div className="space-y-4" dir="rtl">
      <div>
        <nav className="page-breadcrumb"><span>الرئيسية</span><span className="page-breadcrumb-sep">/</span><span>الموظفون</span></nav>
      </div>
        <QueryErrorRetry
          error={employeesError}
          onRetry={() => { refetchEmployees(); }}
          title="تعذر تحميل بيانات الموظفين"
          hint="تحقق من الاتصال وصلاحياتك ثم أعد المحاولة."
        />
      </div>
    );
  }

  return (
    <div className="space-y-4" dir="rtl">
      <nav className="page-breadcrumb"><span>الرئيسية</span><span className="page-breadcrumb-sep">/</span><span>الموظفون</span></nav>
      {/* Real-time presence — who else is on this page */}
      {presence.onlineUsers.length > 0 && (
        <div className="flex items-center justify-end gap-2">
          <span className="text-[10px] text-muted-foreground">متصل الآن:</span>
          <PresenceAvatars users={presence.onlineUsers} />
        </div>
      )}

      {/* ── Tab switcher ── */}
      <div className="flex gap-1 p-1 bg-muted rounded-lg w-fit">
        <button
          type="button"
          onClick={() => setActiveTab('table')}
          className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
            activeTab === 'table'
              ? 'bg-background shadow-sm text-foreground'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Table2 size={15} />
          جدول الموظفين
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('kpi')}
          className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
            activeTab === 'kpi'
              ? 'bg-background shadow-sm text-foreground'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <BarChart2 size={15} />
          مؤشرات الأداء
        </button>
      </div>

      {/* ── KPI tab ── */}
      {activeTab === 'kpi' && (
        <EmployeeKPIs allEmployees={allEmployeesData} />
      )}

      {/* ── Table tab ── */}
      {activeTab === 'table' && (
        <>
      <EmployeeActionsBar
        actionLoading={actionLoading}
        permissions={permissions}
        onExport={runExportDetailed}
        onDownloadTemplate={runTemplateDownload}
        onPrint={runPrintDetailed}
        onImportFile={runImportFile}
        visibleCols={visibleCols}
        setVisibleCols={setVisibleCols}
        onAddEmployee={() => { setEditEmployee(null); setShowAddModal(true); }}
        onManageCommercialRecords={() => setShowCommercialRecordsManager(true)}
        isUploading={isUploading}
        uploadReport={uploadReport}
        setUploadReport={setUploadReport}
        uploadProgress={uploadProgress}
        uploadLiveStats={uploadLiveStats}
        hasActiveFilters={hasActiveFilters}
        colFilters={colFilters}
        setColFilter={setColFilter}
        setColFilters={setColFilters}
        filteredCount={filtered.length}
        totalCount={data.length}
      />

      <EmployeeDetailedTable
        activeCols={activeCols}
        colFilters={colFilters}
        sortField={sortField}
        sortDir={sortDir}
        handleSort={handleSort}
        paginated={paginated}
        filteredCount={filtered.length}
        loading={isTableLoading}
        hasNoPaginatedRows={hasNoPaginatedRows}
        page={page}
        setPage={setPage}
        pageSize={pageSize}
        setPageSize={setPageSize}
        totalPages={totalPages}
        saveField={saveField}
        setSelectedEmployee={setSelectedEmployee}
        setEditEmployee={setEditEmployee}
        setShowAddModal={setShowAddModal}
        setDeleteEmployee={setDeleteEmployee}
        setStatusDateDialog={setStatusDateDialog}
        setStatusDate={setStatusDate}
        permissions={permissions}
        uniqueVals={uniqueVals}
        setColFilter={setColFilter}
        tableRef={tableRef}
        refetchEmployees={refetchEmployees}
        presenceActiveRows={presence.activeRows}
        onRowEditStart={handleRowEditStart}
        onRowEditEnd={handleRowEditEnd}
      />

      {/* Modals */}
      {showAddModal && (
        <Suspense fallback={<InlineLoader />} >
          <EmployeeFormModal
            open={showAddModal}
            editEmployee={editEmployee}
            onClose={() => { setShowAddModal(false); setEditEmployee(null); }}
            onSuccess={() => { refetchEmployees().catch(() => {}); setShowAddModal(false); setEditEmployee(null); }}
          />
        </Suspense>
      )}

      <CommercialRecordsManager
        open={showCommercialRecordsManager}
        onClose={() => setShowCommercialRecordsManager(false)}
      />

      <AlertDialog open={!!deleteEmployee} onOpenChange={open => !open && setDeleteEmployee(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>تأكيد الحذف</AlertDialogTitle>
            <AlertDialogDescription>
              هل أنت متأكد من حذف الموظف <span className="font-semibold text-foreground">{deleteEmployee?.name}</span>؟
              {' '}لا يمكن التراجع عن هذا الإجراء.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? <Loader2 size={14} className="animate-spin me-1" /> : null}
              حذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!statusDateDialog} onOpenChange={open => !open && setStatusDateDialog(null)}>
        <DialogContent dir="rtl" className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarDays size={16} className="text-destructive" />
              تحديد تاريخ — {statusDateDialog?.label}
            </DialogTitle>
            <DialogDescription className="sr-only">
              أدخل تاريخ {statusDateDialog?.label} للمندوب {statusDateDialog?.emp.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              أدخل تاريخ <strong>{statusDateDialog?.label}</strong> للمندوب{' '}
              <strong className="text-foreground">{statusDateDialog?.emp.name}</strong>
            </p>
            <div>
              <Label className="mb-1.5 block">
                {statusDateDialog?.newStatus === 'absconded' ? 'تاريخ الهروب' : 'تاريخ انتهاء الخدمة'}
              </Label>
              <Input
                type="date"
                value={statusDate}
                onChange={e => setStatusDate(normalizeArabicDigits(e.target.value))}
                max={todayISO()}
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setStatusDateDialog(null)}>إلغاء</Button>
            <Button
              variant="destructive"
              onClick={handleSaveStatusWithDate}
              disabled={!statusDate || statusDateSaving}
            >
              {statusDateSaving && <Loader2 size={14} className="animate-spin me-1" />}
              حفظ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
        </>
      )}

    </div>
  );
};

export default Employees;
