import type React from 'react';
import { Suspense, lazy, useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { AlertTriangle, Settings2, Clock } from 'lucide-react';
import { useToast } from '@shared/hooks/use-toast';
import { useAppColors } from '@shared/hooks/useAppColors';
import { useAuth } from '@app/providers/AuthContext';
import { authQueryUserId, useAuthQueryGate } from '@shared/hooks/useAuthQueryGate';
import { usePermissions } from '@shared/hooks/usePermissions';
import { useNavigate } from 'react-router-dom';
import { useSystemSettings } from '@app/providers/SystemSettingsContext';
import type { PricingRule } from '@services/salaryService';
import { useQueryClient } from '@tanstack/react-query';
import Loading from '@shared/components/Loading';
import { CardErrorBoundary } from '@shared/components/CardErrorBoundary';
import { toast as sonnerToast } from '@shared/components/ui/sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@shared/components/ui/dialog';

import { SalarySchemeSelector } from '@modules/salaries/components/SalarySchemeSelector';
import { useSalaryFilteredRows } from '@modules/salaries/hooks/useSalaryTable';
import { useSalaryActions } from '@modules/salaries/hooks/useSalaryActions';
import { useBatchPdfExport } from '@modules/salaries/hooks/useBatchPdfExport';
import { SalaryMonthSelector, SalarySummaryCards } from '@modules/salaries/components/SalaryMonthSelector';
import { SalaryActionsBar, BatchProgressBar } from '@modules/salaries/components/SalaryActionsBar';
import { SalaryTable } from '@modules/salaries/components/SalaryTable';

// Phase-5 extracted hooks
import { useSalaryData } from '@modules/salaries/hooks/useSalaryData';
import { useSalaryDraft } from '@modules/salaries/hooks/useSalaryDraft';

import { months } from '@modules/salaries/lib/salaryMonths';
import type { SalaryRow, SchemeData, SortDir } from '@modules/salaries/types/salary.types';
import type JSZip from 'jszip';
import { useTemporalContext } from '@app/providers/TemporalContext';

const PayslipModal = lazy(() =>
  import('@modules/salaries/components/PayslipModal').then((module) => ({
    default: module.PayslipModal,
  })),
);
const SalaryCardsView = lazy(() =>
  import('@modules/salaries/components/SalaryCardsView').then((module) => ({
    default: module.SalaryCardsView,
  })),
);
const SalaryDetailDialog = lazy(() =>
  import('@modules/salaries/components/SalarySlipModal').then((module) => ({
    default: module.SalaryDetailDialog,
  })),
);
const SalarySlipTemplateEditor = lazy(() =>
  import('@modules/salaries/components/SalarySlipTemplateEditor').then((module) => ({
    default: module.SalarySlipTemplateEditor,
  })),
);

const InlineLoader = ({ minHeightClassName = 'min-h-[220px]' }: Readonly<{ minHeightClassName?: string }>) => (
  <Loading minHeightClassName={minHeightClassName} />
);

// ─────────────────────────────────────────────────────────────────────────────
const Salaries = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const { enabled: _enabled, userId } = useAuthQueryGate();
  const uid = authQueryUserId(userId);
  const navigate = useNavigate();
  const { permissions } = usePermissions('salaries');
  const { projectName } = useSystemSettings();
  const { apps: appColorsList } = useAppColors();
  const { selectedMonth } = useTemporalContext();
  const queryClient = useQueryClient();

  // ── UI-only state (local to the page) ────────────────────────────────────
  const [rows, setRows] = useState<SalaryRow[]>([]);
  const [empPlatformScheme, setEmpPlatformScheme] = useState<Record<string, Record<string, SchemeData | null>>>({});
  const [salaryMeta, setSalaryMeta] = useState<{
    appsWithoutScheme: string[];
    appsWithoutPricingRules: string[];
    appIdByName: Record<string, string>;
    pricingRulesByAppId: Record<string, PricingRule[]>;
  }>({ appsWithoutScheme: [], appsWithoutPricingRules: [], appIdByName: {}, pricingRulesByAppId: {} });

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  // cityFilter is not exposed in the UI yet — kept as constant for future use
  const cityFilter = 'all';
  const [payslipRow, setPayslipRow] = useState<SalaryRow | null>(null);
  const [salaryActionLoading, setSalaryActionLoading] = useState(false);
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>(null);
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
  const [markingPaid, setMarkingPaid] = useState<string | null>(null);
  const [editingCell, setEditingCell] = useState<{ rowId: string; platform: string } | null>(null);
  const [employeeFieldSaving, setEmployeeFieldSaving] = useState<string | null>(null);
  const [detailRow, setDetailRow] = useState<SalaryRow | null>(null);
  const [showTemplateEditor, setShowTemplateEditor] = useState(false);

  // Batch PDF state — grouped to reduce individual useState calls
  const [batch, setBatch] = useState<{ queue: SalaryRow[]; index: number; zip: JSZip | null; month: string }>({
    queue: [], index: 0, zip: null, month: '',
  });
  const batchQueue = batch.queue;
  const batchIndex = batch.index;
  const batchZip = batch.zip;
  const batchMonth = batch.month;
  // Stable setters — useCallback with [] deps so children don't re-render on every page render
  const setBatchQueue = useCallback((v: React.SetStateAction<SalaryRow[]>) =>
    setBatch((b) => ({ ...b, queue: typeof v === 'function' ? v(b.queue) : v })), []);
  const setBatchIndex = useCallback((v: React.SetStateAction<number>) =>
    setBatch((b) => ({ ...b, index: typeof v === 'function' ? v(b.index) : v })), []);
  const setBatchZip = useCallback((v: React.SetStateAction<JSZip | null>) =>
    setBatch((b) => ({ ...b, zip: typeof v === 'function' ? v(b.zip) : v })), []);
  const setBatchMonth = useCallback((v: string) => setBatch((b) => ({ ...b, month: v })), []);

  const salaryToolbarImportRef = useRef<HTMLInputElement | null>(null);

  // ── Draft key ─────────────────────────────────────────────────────────────
  const salariesDraftKey = useMemo(
    () => `salaries:draft:${user?.id || 'anon'}:${selectedMonth}`,
    [user?.id, selectedMonth],
  );

  // ── Data fetching (Two-phase React Query + placeholder cache) ────────────
  // Phase 1 (~1-2s): fetches context data → table appears
  // Phase 2 (~2-3s): fetches preview RPC in background → numbers update silently
  // Placeholder: when switching months, previous month rows show instantly
  const {
    hydratedRows,
    appNameToId,
    rulesMap: pricingRulesByAppId,
    appsWithoutScheme,
    appsWithoutPricingRules,
    builtEmpPlatformScheme,
    previewBackendError,
    isLoading: loadingData,
    isShowingPlaceholder,
    isRefreshingPreview,
    error: salaryDataError,
  } = useSalaryData({ selectedMonth, salariesDraftKey });

  // Sync fetched data into local state when React Query resolves.
  // Runs on phase1 finish AND phase2 finish (rows update silently with preview).
  // rows lives in local state so useSalaryActions can mutate it (dirty/approve/etc.)
  //
  // NOTE (ISSUE #7): rows in local state is intentional — useSalaryActions needs
  // setRows for optimistic order-entry and approve mutations. A full migration to
  // queryClient.setQueryData would require threading the fullDataKey through every
  // action hook. For now the ref guard below keeps the stale-data window minimal,
  // and dirty-row preservation prevents query refreshes from overwriting in-progress edits.
  const lastHydratedRowsRef = useRef<typeof hydratedRows | null>(null);
  useEffect(() => {
    if (!loadingData && hydratedRows !== lastHydratedRowsRef.current) {
      lastHydratedRowsRef.current = hydratedRows;

      // Preserve any rows the user has already edited (isDirty=true).
      // When a realtime or phase-2 refresh arrives, non-dirty rows update
      // immediately; dirty rows keep the user's local edits until they approve.
      setRows((prev) => {
        const dirtyById = new Map(
          prev.filter((r) => r.isDirty).map((r) => [r.id, r]),
        );
        if (dirtyById.size === 0) return hydratedRows;
        return hydratedRows.map((fresh) => dirtyById.get(fresh.id) ?? fresh);
      });

      setEmpPlatformScheme(builtEmpPlatformScheme);
      setSalaryMeta({
        appIdByName: appNameToId,
        pricingRulesByAppId,
        appsWithoutPricingRules,
        appsWithoutScheme,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadingData, hydratedRows]);

  // Show fetch error inline (phase 1 errors only — phase 2 errors show inline already)
  // Toast removed — inline error card is more reliable and visible
  const showSalaryDataError = !!salaryDataError && !loadingData;

  // ── Draft auto-save (extracted hook) ─────────────────────────────────────
  useSalaryDraft({
    rows,
    loadingData,
    selectedMonth,
    salariesDraftKey,
    userId: user?.id,
  });

  // ── Platform colors & metadata ────────────────────────────────────────────
  const platformMeta = useMemo(() => {
    const newColors: Record<string, { header: string; headerText: string; cellBg: string; valueColor: string; focusBorder: string }> = {};
    const newPlatforms: string[] = [];
    const newCustomCols: Record<string, import('@shared/hooks/useAppColors').CustomColumn[]> = {};
    appColorsList
      .filter((a) => a.is_active)
      .forEach((app) => {
        newPlatforms.push(app.name);
        newColors[app.name] = {
          header: app.brand_color,
          headerText: app.text_color,
          cellBg: `${app.brand_color}18`,
          valueColor: app.brand_color,
          focusBorder: app.brand_color,
        };
        newCustomCols[app.name] = app.custom_columns || [];
      });
    return { platforms: newPlatforms, platformColors: newColors, appCustomColumns: newCustomCols };
  }, [appColorsList]);
  const platforms = platformMeta.platforms;
  const platformColors = platformMeta.platformColors;
  const appCustomColumns = platformMeta.appCustomColumns;

  // Convenience destructures from salaryMeta
  const appIdByName = salaryMeta.appIdByName;
  const appsWithoutPricingRulesDeduped = useMemo(
    () => salaryMeta.appsWithoutPricingRules.filter((n) => !salaryMeta.appsWithoutScheme.includes(n)),
    [salaryMeta.appsWithoutPricingRules, salaryMeta.appsWithoutScheme],
  );

  // ── Filtered rows + computed columns ─────────────────────────────────────
  const { filtered, computeRow } = useSalaryFilteredRows(
    rows, search, statusFilter, cityFilter, sortField, sortDir, platforms,
  );

  // ── Actions ───────────────────────────────────────────────────────────────
  const actions = useSalaryActions({
    rows, setRows, filtered, computeRow, selectedMonth, platforms, platformColors,
    toast: sonnerToast, user, uid, queryClient, projectName,
    payslipRow, setPayslipRow,
    sortField, setSortField, sortDir, setSortDir,
    salaryActionLoading, setSalaryActionLoading,
    setMarkingPaid, setBatchQueue, setBatchIndex, setBatchZip, setBatchMonth,
    salaryToolbarImportRef, employeeFieldSaving, setEmployeeFieldSaving,
    appIdByName, pricingRulesByAppId: salaryMeta.pricingRulesByAppId, empPlatformScheme,
    setDetailRow,
  });

  // FIX M5: useMemo so totalNet isn't recomputed on every render cycle
  const totalNet = useMemo(
    () => filtered.reduce((s, r) => s + computeRow(r).netSalary, 0),
    [filtered, computeRow],
  );
  // Memoized — avoids re-filtering on every render when nothing changed
  const pendingCount = useMemo(
    () => filtered.filter((r) => r.status === 'pending' || r.isDirty).length,
    [filtered],
  );

  // ── Batch ZIP export ──────────────────────────────────────────────────────
  useBatchPdfExport({
    batchQueue, batchIndex, batchZip, selectedMonth, projectName,
    setBatchQueue, setBatchIndex, setBatchZip, toast,
  });

  const monthLabel = months.find((m) => m.v === selectedMonth)?.l || selectedMonth;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4" dir="rtl">
      {/* Breadcrumb is rendered inside SalaryMonthSelector — no duplicate here */}

      <CardErrorBoundary title="فشل تحميل محدد الشهر">
        <SalaryMonthSelector
          loadingData={loadingData}
          previewBackendError={previewBackendError}
          isRefreshingPreview={isRefreshingPreview}
        />
      </CardErrorBoundary>

      {/* Phase 1 load failure — inline error card */}
      <CardErrorBoundary title="فشل تحميل الرواتب الأساسية">
        {showSalaryDataError && (
          <div className="flex items-center gap-3 bg-destructive/10 border border-destructive/30 rounded-xl px-4 py-3">
            <AlertTriangle size={18} className="text-destructive flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground">تعذر تحميل بيانات الرواتب</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {salaryDataError?.message || 'حدث خطأ غير متوقع أثناء تحميل الرواتب'}
              </p>
            </div>
            <button
              type="button"
              className="flex-shrink-0 text-xs font-medium text-destructive hover:underline px-3 py-1.5 rounded-lg border border-destructive/30 hover:bg-destructive/10 transition-colors"
              onClick={() => {
                queryClient.invalidateQueries({ queryKey: ['salaries', uid, 'context', selectedMonth] });
              }}
            >
              إعادة المحاولة
            </button>
          </div>
        )}
      </CardErrorBoundary>

      {/* Placeholder banner — shown when previous month's data is displayed while new month loads */}
      {isShowingPlaceholder && (
        <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 dark:bg-amber-950/30 dark:border-amber-800/40">
          <Clock size={16} className="text-amber-600 dark:text-amber-400 flex-shrink-0 animate-pulse" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
              جارٍ تحميل بيانات شهر {monthLabel}…
            </p>
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
              الأرقام المعروضة حالياً من شهر سابق — لا تُجري أي إجراء حتى تكتمل البيانات
            </p>
          </div>
          <div className="flex-shrink-0">
            <span className="inline-flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-400">
              <span className="h-2 w-2 rounded-full bg-amber-400 animate-ping" />{' '}
              جارٍ التحميل
            </span>
          </div>
        </div>
      )}

      <SalarySummaryCards
        totalNet={totalNet}
        platforms={platforms}
        platformColors={platformColors}
        filtered={filtered}
        computeRow={computeRow}
      />

      <CardErrorBoundary title="فشل تحميل معاينة الرواتب">
        {previewBackendError && (
          <div className="flex items-center gap-3 bg-destructive/10 border border-destructive/30 rounded-xl px-4 py-3">
            <AlertTriangle size={18} className="text-destructive flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground">تعذّر تحميل معاينة الرواتب</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                فشل كلٌّ من محرك الرواتب وقاعدة البيانات. {previewBackendError}
              </p>
            </div>
            {/* FIX #8: retry button for phase 2 preview failures */}
            <button
              type="button"
              className="flex-shrink-0 text-xs font-medium text-destructive hover:underline px-3 py-1.5 rounded-lg border border-destructive/30 hover:bg-destructive/10 transition-colors"
              onClick={() => {
                queryClient.invalidateQueries({
                  queryKey: ['salaries', uid, 'preview', selectedMonth],
                });
              }}
            >
              إعادة المحاولة
            </button>
          </div>
        )}
      </CardErrorBoundary>

      <SalarySchemeSelector
        appsWithoutScheme={salaryMeta.appsWithoutScheme}
        appsWithoutPricingRulesDeduped={appsWithoutPricingRulesDeduped}
        onOpenSettings={() => navigate('/salary-schemes')}
      />

      <SalaryActionsBar
        search={search}
        setSearch={setSearch}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        viewMode={viewMode}
        setViewMode={setViewMode}
        pendingCount={pendingCount}
        canEdit={permissions.can_edit}
        approveAll={actions.approveAll}
        salaryActionLoading={salaryActionLoading}
        salaryToolbarImportRef={salaryToolbarImportRef}
        onSalaryToolbarImportChange={actions.onSalaryToolbarImportChange}
        runExportExcel={actions.runExportExcel}
        downloadSalaryTemplate={actions.downloadSalaryTemplate}
        openSalaryToolbarImport={actions.openSalaryToolbarImport}
        runPrintTable={actions.runPrintTable}
        startBatchZipExport={actions.startBatchZipExport}
        exportMergedPDF={actions.exportMergedPDF}
        batchQueue={batchQueue}
        batchIndex={batchIndex}
        openTemplateEditor={() => setShowTemplateEditor(true)}
      />

      <BatchProgressBar
        batchQueue={batchQueue}
        batchIndex={batchIndex}
        batchMonth={batchMonth}
      />

      {viewMode === 'cards' && (
        <Suspense fallback={<InlineLoader />}>
          <SalaryCardsView
            loadingData={loadingData}
            filtered={filtered}
            computeRow={computeRow}
            approveRow={actions.approveRow}
            approvingRowId={actions.approvingRowId}
            markAsPaid={actions.markAsPaid}
            markingPaid={markingPaid}
            setPayslipRow={setPayslipRow}
            canEdit={permissions.can_edit}
          />
        </Suspense>
      )}

      {viewMode === 'table' && (
        <SalaryTable
          loadingData={loadingData}
          rows={rows}
          filtered={filtered}
          computeRow={computeRow}
          platforms={platforms}
          platformColors={platformColors}
          appCustomColumns={appCustomColumns}
          empPlatformScheme={empPlatformScheme}
          sortField={sortField}
          sortDir={sortDir}
          handleSort={actions.handleSort}
          updateRow={actions.updateRow}
          updatePlatformOrders={actions.updatePlatformOrders}
          approveRow={actions.approveRow}
          unapproveRow={actions.unapproveRow}
          approvingRowId={actions.approvingRowId}
          markAsPaid={actions.markAsPaid}
          markingPaid={markingPaid}
          editingCell={editingCell}
          setEditingCell={setEditingCell}
          setPayslipRow={setPayslipRow}
          persistEmployeeCity={actions.persistEmployeeCity}
          persistEmployeePaymentMethod={actions.persistEmployeePaymentMethod}
          employeeFieldSaving={employeeFieldSaving}
          openEmployeeDetail={actions.openEmployeeDetail}
          canEdit={permissions.can_edit}
        />
      )}

      {payslipRow && (
        <Suspense fallback={<InlineLoader />}>
          <PayslipModal
            row={payslipRow}
            selectedMonth={selectedMonth}
            companyName={projectName}
            onClose={() => setPayslipRow(null)}
            onApprove={() => { actions.approveRow(payslipRow.id); setPayslipRow(null); }}
          />
        </Suspense>
      )}

      {detailRow && (
        <Suspense fallback={<InlineLoader />}>
          <SalaryDetailDialog
            detailRow={detailRow}
            computeRow={computeRow}
            platforms={platforms}
            platformColors={platformColors}
            appCustomColumns={appCustomColumns}
            selectedMonth={selectedMonth}
            monthLabel={monthLabel}
            setDetailRow={setDetailRow}
            setPayslipRow={setPayslipRow}
          />
        </Suspense>
      )}

      <Dialog open={showTemplateEditor} onOpenChange={setShowTemplateEditor}>
        <DialogContent className="max-w-[95vw] w-[1400px] max-h-[95vh] overflow-y-auto p-0 border-none bg-muted/20">
          <DialogHeader className="p-6 bg-white border-b sticky top-0 z-10">
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <Settings2 className="text-primary" /> إعدادات قوالب كشوف الرواتب
            </DialogTitle>
          </DialogHeader>
          <div className="p-2">
            {showTemplateEditor && (
              <Suspense fallback={<InlineLoader minHeightClassName="min-h-[480px]" />}>
                <SalarySlipTemplateEditor />
              </Suspense>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Salaries;
