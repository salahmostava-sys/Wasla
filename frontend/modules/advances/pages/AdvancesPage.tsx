import { Suspense, lazy, useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CreditCard, FolderOpen, UserPlus, AlertTriangle } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@shared/components/ui/dropdown-menu';
import { Button } from '@shared/components/ui/button';
import { advanceService } from '@services/advanceService';
import { useToast } from '@shared/hooks/use-toast';
import { usePermissions } from '@shared/hooks/usePermissions';
import { authQueryUserId, useAuthQueryGate } from '@shared/hooks/useAuthQueryGate';
import { defaultQueryRetry } from '@shared/lib/query';
import { QueryErrorRetry } from '@shared/components/QueryErrorRetry';
import { useAdvancedFilter } from '@shared/hooks/useAdvancedFilter';
import { ADVANCES_FILTERS } from '@shared/config/filterConfigs';
import type { Advance } from '@modules/advances/types/advance.types';
import { useAdvanceTable } from '@modules/advances/hooks/useAdvanceTable';
import { AdvanceFilters } from '@modules/advances/components/AdvanceFilters';
import { AdvanceTable } from '@modules/advances/components/AdvanceTable';
const loadAdvanceDialogs = () => import('@modules/advances/components/AddAdvanceModal');

const EditAdvanceModal = lazy(() =>
  loadAdvanceDialogs().then((module) => ({ default: module.EditAdvanceModal }))
);
const TransactionsModal = lazy(() =>
  loadAdvanceDialogs().then((module) => ({ default: module.TransactionsModal }))
);
const WriteOffDialog = lazy(() =>
  loadAdvanceDialogs().then((module) => ({ default: module.WriteOffDialog }))
);
const RestoreWriteOffDialog = lazy(() =>
  loadAdvanceDialogs().then((module) => ({ default: module.RestoreWriteOffDialog }))
);
const AddEmployeeAdvanceDialog = lazy(() =>
  loadAdvanceDialogs().then((module) => ({ default: module.AddEmployeeAdvanceDialog }))
);
const DeleteAllEmployeeAdvancesDialog = lazy(() =>
  loadAdvanceDialogs().then((module) => ({ default: module.DeleteAllEmployeeAdvancesDialog }))
);

const prefetchAdvanceDialogs = () => {
  loadAdvanceDialogs();
};
const Advances = () => {
  const { toast } = useToast();
  const { enabled, userId } = useAuthQueryGate();
  const uid = authQueryUserId(userId);
  const { permissions } = usePermissions('advances');
  const [advances, setAdvances] = useState<Advance[]>([]);
  const [employees, setEmployees] = useState<{ id: string; name: string; national_id?: string | null; sponsorship_status?: string | null }[]>([]);
  const {
    data: advancesPageData,
    isLoading: loading,
    error: advancesPageError,
    refetch: refetchAdvancesData,
  } = useQuery({
    queryKey: ['advances', uid, 'page-data'],
    enabled,
    queryFn: async () => {
      const [advRows, empRows] = await Promise.all([
        advanceService.getAll(),
        advanceService.getEmployees(),
      ]);
      return {
        advances: (advRows || []) as Advance[],
        employees: (empRows || []) as { id: string; name: string; national_id?: string | null; sponsorship_status?: string | null }[],
      };
    },
    retry: defaultQueryRetry,
    staleTime: 60_000,
  });
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const { filters, setFilter, resetFilters, activeCount } = useAdvancedFilter(ADVANCES_FILTERS);
  const [showWrittenOff, setShowWrittenOff] = useState(false);
  const [editAdvance, setEditAdvance] = useState<Advance | null>(null);
  const [transactionsEmployee, setTransactionsEmployee] = useState<{ id: string; name: string; nationalId: string; totalDebt: number; totalPaid: number; remaining: number; isWrittenOff?: boolean; allAdvances: Advance[] } | null>(null);
  const [writeOffEmployee, setWriteOffEmployee] = useState<{ name: string; remaining: number; advanceIds: string[] } | null>(null);
  const [restoreWriteOffEmployee, setRestoreWriteOffEmployee] = useState<{ name: string; advanceIds: string[] } | null>(null);
  const [showAddEmployee, setShowAddEmployee] = useState(false);
  const [addEmployeePickerOpen, setAddEmployeePickerOpen] = useState(false);
  const [deleteEmployeeAdvancesId, setDeleteEmployeeAdvancesId] = useState<string | null>(null);
  const [deletingEmployeeAdvances, setDeletingEmployeeAdvances] = useState(false);

  const {
    importRef,
    tableRef,
    sortField,
    sortDir,
    handleSort,
    abscondedWithDebt,
    employeeSummaries,
    filtered,
    grandTotals,
    writtenOffTotals,
    fetchAll,
    handleImportAdvances,
    handleExport,
    handleTemplate,
    handlePrintTable,
    handleDeleteEmployeeAllAdvances,
  } = useAdvanceTable(
    advances,
    employees,
    search,
    statusFilter,
    showWrittenOff,
    filters,
    refetchAdvancesData,
    deleteEmployeeAdvancesId,
    setDeleteEmployeeAdvancesId,
    setDeletingEmployeeAdvances
  );

  // Local state mirrors React Query data — kept intentionally because useAdvanceTable
  // receives these arrays and may trigger optimistic updates via fetchAll/refetchAdvancesData.
  // Removing local state would require refactoring useAdvanceTable to work directly with query data.
  useEffect(() => {
    if (!advancesPageData) return;
    setAdvances(advancesPageData.advances);
    setEmployees(advancesPageData.employees);
  }, [advancesPageData]);

  // Track whether we already showed an error toast for this error instance
  // to avoid re-firing on every re-render (e.g. tab switch back)
  const lastErrorToastedRef = useRef<unknown>(null);
  useEffect(() => {
    if (!advancesPageError) {
      lastErrorToastedRef.current = null;
      return;
    }
    if (lastErrorToastedRef.current === advancesPageError) return;
    lastErrorToastedRef.current = advancesPageError;
    const message =
      advancesPageError instanceof Error
        ? advancesPageError.message
        : 'تعذر تحميل بيانات السلف';
    toast({ title: 'خطأ في التحميل', description: message, variant: 'destructive' });
  }, [advancesPageError, toast]);

  if (advancesPageError && !loading) {
    return (
      <div className="space-y-4" dir="rtl">
        <QueryErrorRetry
          error={advancesPageError}
          onRetry={() => refetchAdvancesData()}
          title="تعذر تحميل بيانات السلف"
          hint="تحقق من الاتصال وصلاحياتك ثم أعد المحاولة."
        />
      </div>
    );
  }

  return (
    <div className="space-y-4" dir="rtl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <nav className="page-breadcrumb">
            <span>الرئيسية</span>
            <span className="page-breadcrumb-sep">/</span>
            <span>السلف</span>
          </nav>
          <h1 className="page-title flex items-center gap-2"><CreditCard size={20} /> السلف</h1>
        </div>
        <div className="flex gap-2">
          <input ref={importRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleImportAdvances} />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5 h-9"><FolderOpen size={14} /> ملفات</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleExport}>📊 تصدير Excel</DropdownMenuItem>
              <DropdownMenuItem onClick={handleTemplate}>📋 تحميل قالب الاستيراد</DropdownMenuItem>
              <DropdownMenuItem onClick={() => importRef.current?.click()}>⬆️ استيراد Excel</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handlePrintTable}>🖨️ طباعة الجدول</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          {permissions.can_edit && !showWrittenOff && (
            <Button
              size="sm"
              className="gap-2 h-8"
              onClick={() => {
                prefetchAdvanceDialogs();
                setShowAddEmployee(true);
              }}
              onFocus={prefetchAdvanceDialogs}
              onMouseEnter={prefetchAdvanceDialogs}
            >
              <UserPlus size={14} /> مندوب جديد
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'عدد المندوبين', value: grandTotals.count, color: 'text-primary' },
          { label: 'إجمالي المديونية', value: `${grandTotals.totalDebt.toLocaleString('en-US')} ر.س`, color: 'text-info' },
          { label: 'إجمالي المسدّد', value: `${grandTotals.totalPaid.toLocaleString('en-US')} ر.س`, color: 'text-success' },
          { label: 'إجمالي المتبقي', value: `${grandTotals.remaining.toLocaleString('en-US')} ر.س`, color: 'text-destructive' },
        ].map(s => (
          <div key={s.label} className="bg-card rounded-xl border border-border/50 p-4">
            <p className="text-xs text-muted-foreground">{s.label}</p>
            <p className={`text-xl font-bold mt-1 ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      <AdvanceFilters
        writtenOffTotals={writtenOffTotals}
        showWrittenOff={showWrittenOff}
        setShowWrittenOff={setShowWrittenOff}
        search={search}
        setSearch={setSearch}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
      />

      {!showWrittenOff && abscondedWithDebt.length > 0 && (
        <div className="bg-destructive/10 border border-destructive/30 rounded-xl p-4 space-y-2">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle size={16} className="text-destructive flex-shrink-0" />
            <span className="text-sm font-semibold text-destructive">
              تنبيه: {abscondedWithDebt.length} مندوب هارب لديه ديون غير معدومة
            </span>
          </div>
          <div className="space-y-2">
            {abscondedWithDebt.map(emp => (
              <div key={emp.id} className="flex items-center justify-between gap-3 bg-card rounded-lg px-3 py-2 border border-border/50">
                <div className="flex items-center gap-2">
                  <span className="badge-urgent text-xs">هارب</span>
                  <span className="text-sm font-medium text-foreground">{emp.name}</span>
                  <span className="text-xs text-destructive font-bold">{emp.remaining.toLocaleString('en-US')} ر.س</span>
                </div>
                <Button
                  size="sm"
                  variant="destructive"
                  className="h-7 text-xs gap-1"
                  onClick={() => {
                    prefetchAdvanceDialogs();
                    setWriteOffEmployee({
                      name: emp.name,
                      remaining: emp.remaining,
                      advanceIds: emp.activeIds,
                    });
                  }}
                >
                  <AlertTriangle size={12} /> إعدام الديون
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      <AdvanceTable
        loading={loading}
        filtered={filtered}
        grandTotals={grandTotals}
        permissions={permissions}
        sortField={sortField}
        sortDir={sortDir}
        handleSort={handleSort}
        tableRef={tableRef}
        filters={filters}
        setFilter={setFilter}
        resetFilters={resetFilters}
        activeCount={activeCount}
        setTransactionsEmployee={(value) => {
          prefetchAdvanceDialogs();
          setTransactionsEmployee(value);
        }}
        setDeleteEmployeeAdvancesId={(value) => {
          if (value) prefetchAdvanceDialogs();
          setDeleteEmployeeAdvancesId(value);
        }}
      />

      <Suspense fallback={null}>
        {editAdvance && (
          <EditAdvanceModal advance={editAdvance} onClose={() => setEditAdvance(null)} onSaved={fetchAll} />
        )}

        {transactionsEmployee && (
          <TransactionsModal
            employeeId={transactionsEmployee.id}
            employeeName={transactionsEmployee.name}
            nationalId={transactionsEmployee.nationalId}
            totalDebt={transactionsEmployee.totalDebt}
            totalPaid={transactionsEmployee.totalPaid}
            remaining={transactionsEmployee.remaining}
            advances={advances}
            allAdvances={advances}
            isWrittenOff={transactionsEmployee.isWrittenOff}
            canEdit={permissions.can_edit}
            onClose={() => setTransactionsEmployee(null)}
            onRefresh={fetchAll}
            onEditAdvance={(adv) => { setTransactionsEmployee(null); setEditAdvance(adv); }}
            onWriteOff={() => {
              const s = filtered.find(x => x.employeeId === transactionsEmployee.id);
              if (s) setWriteOffEmployee({ name: s.employeeName, remaining: s.remaining, advanceIds: s.allAdvances.map(a => a.id) });
              setTransactionsEmployee(null);
            }}
            onRestore={() => {
              const s = filtered.find(x => x.employeeId === transactionsEmployee.id);
              if (s) setRestoreWriteOffEmployee({ name: s.employeeName, advanceIds: s.allAdvances.map(a => a.id) });
              setTransactionsEmployee(null);
            }}
          />
        )}

        {writeOffEmployee && (
          <WriteOffDialog
            employeeName={writeOffEmployee.name}
            remaining={writeOffEmployee.remaining}
            advanceIds={writeOffEmployee.advanceIds}
            onClose={() => setWriteOffEmployee(null)}
            onDone={fetchAll}
          />
        )}

        {restoreWriteOffEmployee && (
          <RestoreWriteOffDialog
            employeeName={restoreWriteOffEmployee.name}
            advanceIds={restoreWriteOffEmployee.advanceIds}
            onClose={() => setRestoreWriteOffEmployee(null)}
            onDone={fetchAll}
          />
        )}

        {showAddEmployee && (
          <AddEmployeeAdvanceDialog
            open={showAddEmployee}
            onOpenChange={(v) => { if (!v) setShowAddEmployee(false); }}
            addEmployeePickerOpen={addEmployeePickerOpen}
            setAddEmployeePickerOpen={setAddEmployeePickerOpen}
            employees={employees}
            employeeSummaries={employeeSummaries}
            onPickEmployee={(e) => {
              setTransactionsEmployee({
                id: e.id,
                name: e.name,
                nationalId: '',
                totalDebt: 0,
                totalPaid: 0,
                remaining: 0,
                isWrittenOff: false,
                allAdvances: [],
              });
            }}
          />
        )}

        {!!deleteEmployeeAdvancesId && (
          <DeleteAllEmployeeAdvancesDialog
            open={!!deleteEmployeeAdvancesId}
            onOpenChange={(v) => { if (!v) setDeleteEmployeeAdvancesId(null); }}
            deleting={deletingEmployeeAdvances}
            onConfirm={handleDeleteEmployeeAllAdvances}
          />
        )}
      </Suspense>
    </div>
  );
};

export default Advances;
