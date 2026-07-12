import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useMonthlyActiveEmployeeIds } from '@shared/hooks/useMonthlyActiveEmployeeIds';
import { usePermissions } from '@shared/hooks/usePermissions';
import { toast } from '@shared/components/ui/sonner';
import { TOAST_ERROR_GENERIC } from '@shared/lib/toastMessages';
import { authQueryUserId, useAuthQueryGate } from '@shared/hooks/useAuthQueryGate';
import { orderService } from '@services/orderService';
import { performanceService } from '@services/performanceService';
import { bulkDeleteService } from '@services/bulkDeleteService';
import type { DailyData } from '@modules/orders/types';
import type { OrdersPopoverState } from '@shared/components/orders/OrdersCellPopover';
import type { UnmatchedEmployeeName } from '@shared/lib/nameMatching';
import { useSpreadsheetQueries } from '@modules/orders/hooks/useSpreadsheetQueries';
import { buildDailyDataMap, calculatePlatformTotals, collectEmployeeIdsWithOrdersOnApp } from '@modules/orders/utils/gridHelpers';
import { getErrorMessage } from '@services/serviceError';
import { exportSpreadsheetExcel, runSpreadsheetImport, downloadSpreadsheetTemplate, printSpreadsheetTable, saveSpreadsheetMonth } from '@modules/orders/utils/spreadsheetFileOps';
import { getDaysInMonth, monthYear, shiftMonth, isPastMonth } from '@modules/orders/utils/dateMonth';
import { useTemporalContext } from '@app/providers/TemporalContext';

export function useSpreadsheetGrid() {
  const queryClient = useQueryClient();
  const { enabled, userId } = useAuthQueryGate();
  const uid = authQueryUserId(userId);
  const { permissions } = usePermissions('orders');
  const { selectedMonth: globalMonth, setSelectedMonth: setGlobalMonth } = useTemporalContext();

  // Derived from Global Temporal Context (YYYY-MM)
  const [yearStr, monthStr] = globalMonth.split('-');
  const year = Number(yearStr);
  const month = Number(monthStr);
  const [search, setSearch] = useState('');
  const importRef = useRef<HTMLInputElement>(null);
  const tableRef = useRef<HTMLTableElement>(null);

  const [data, setData] = useState<DailyData>({});
  const [saving, setSaving] = useState(false);
  const [expandedEmp, setExpandedEmp] = useState<Set<string>>(new Set());
  const [cellPopover, setCellPopover] = useState<OrdersPopoverState | null>(null);
  const [platformFilter, setPlatformFilter] = useState('all');
  const [isMonthLocked, setIsMonthLocked] = useState(false);
  const [lockingMonth, setLockingMonth] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [pendingImportFile, setPendingImportFile] = useState<File | null>(null);
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false);
  const [showNameMappingDialog, setShowNameMappingDialog] = useState(false);
  const [unmatchedNames, setUnmatchedNames] = useState<UnmatchedEmployeeName[]>([]);
  const [nameMappingCallback, setNameMappingCallback] = useState<((mapping: Map<string, string>) => void) | null>(null);

  const monthKey = monthYear(year, month);
  const importHistoryQueryKey = useMemo(
    () => ['orders', uid, 'import-history', monthKey] as const,
    [monthKey, uid],
  );
  const { data: activeIdsData } = useMonthlyActiveEmployeeIds(monthKey);
  const activeEmployeeIdsInMonth = activeIdsData?.orderEmployeeIds;

  const sq = useSpreadsheetQueries(uid, enabled, year, month, activeEmployeeIdsInMonth);
  const canEditMonth = permissions.can_edit && !isMonthLocked;
  const { data: importHistory = [] } = useQuery({
    queryKey: importHistoryQueryKey,
    enabled,
    staleTime: 60_000,
    queryFn: () => performanceService.getImportHistory(monthKey),
  });

  const invalidateMonthDependencies = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['orders', uid] }),
      queryClient.invalidateQueries({ queryKey: ['employees', uid, 'active-ids', monthKey] }),
      queryClient.invalidateQueries({ queryKey: ['salaries', uid, 'base-context', monthKey] }),
      queryClient.invalidateQueries({ queryKey: importHistoryQueryKey }),
    ]);
  }, [importHistoryQueryKey, monthKey, queryClient, uid]);

  useEffect(() => {
    setData(sq.spreadsheetMonthData);
  }, [sq.spreadsheetMonthData]);

  useEffect(() => {
    setIsMonthLocked(sq.spreadsheetMonthLock);
  }, [sq.spreadsheetMonthLock, year, month]);

  useEffect(() => {
    const error = sq.spreadsheetBaseError || sq.spreadsheetMonthError || sq.spreadsheetLockError;
    if (!error) return;
    const message = getErrorMessage(error, 'فشل تحميل بيانات الطلبات');
    toast.error(TOAST_ERROR_GENERIC, { description: message });
  }, [sq.spreadsheetBaseError, sq.spreadsheetMonthError, sq.spreadsheetLockError]);

  const employeeIdsWithOrdersOnFilteredPlatform = useMemo(() => {
    if (platformFilter === 'all') return new Set<string>();
    return collectEmployeeIdsWithOrdersOnApp(data, platformFilter);
  }, [data, platformFilter]);

  // Pre-compute set of employee IDs that have any order data — O(keys) instead of O(employees × keys)
  const employeeIdsWithAnyOrders = useMemo(() => {
    const ids = new Set<string>();
    for (const key of Object.keys(data)) {
      const sep = key.indexOf('::');
      if (sep > 0) ids.add(key.slice(0, sep));
    }
    return ids;
  }, [data]);

  const allEmployeesWithAssignmentsOrOrders = useMemo(
    () =>
      sq.employees.filter((employee) => {
        if (employeeIdsWithAnyOrders.has(employee.id)) return true;
        return Object.values(sq.appEmployeeIds).some((appSet) => appSet?.has(employee.id));
      }),
    [sq.employees, sq.appEmployeeIds, employeeIdsWithAnyOrders],
  );

  const baseEmployees = useMemo(() => {
    if (platformFilter === 'all') return allEmployeesWithAssignmentsOrOrders;
    const assigned = sq.appEmployeeIds[platformFilter];
    const withOrders = employeeIdsWithOrdersOnFilteredPlatform;
    return allEmployeesWithAssignmentsOrOrders.filter(
      (employee) => Boolean(assigned?.has(employee.id)) || withOrders.has(employee.id),
    );
  }, [
    allEmployeesWithAssignmentsOrOrders,
    platformFilter,
    sq.appEmployeeIds,
    employeeIdsWithOrdersOnFilteredPlatform,
  ]);

  const filteredEmployees = useMemo(
    () => baseEmployees.filter((emp) => emp.name.includes(search)),
    [baseEmployees, search],
  );
  const searchMatchedEmployees = useMemo(
    () => allEmployeesWithAssignmentsOrOrders.filter((emp) => emp.name.includes(search)),
    [allEmployeesWithAssignmentsOrOrders, search],
  );
  const visibleApps = platformFilter === 'all' ? sq.apps : sq.apps.filter((a) => a.id === platformFilter);
  const now = new Date();
  const days = getDaysInMonth(year, month);
  const dayArr = Array.from({ length: days }, (_, i) => i + 1);
  const today = now.getFullYear() === year && now.getMonth() + 1 === month ? now.getDate() : -1;

  const getVal = useCallback(
    (empId: string, appId: string, day: number) => data[`${empId}::${appId}::${day}`] ?? 0,
    [data],
  );
  const getActiveApps = useCallback(
    (empId: string) => visibleApps.filter((app) => dayArr.some((d) => getVal(empId, app.id, d) > 0)),
    [visibleApps, dayArr, getVal],
  );
  const empDayTotal = useCallback(
    (empId: string, day: number) => visibleApps.reduce((s, a) => s + getVal(empId, a.id, day), 0),
    [visibleApps, getVal],
  );
  const empMonthTotal = useCallback(
    (empId: string) => dayArr.reduce((s, d) => s + empDayTotal(empId, d), 0),
    [dayArr, empDayTotal],
  );
  const empAppMonthTotal = useCallback(
    (empId: string, appId: string) => dayArr.reduce((s, d) => s + getVal(empId, appId, d), 0),
    [dayArr, getVal],
  );

  const monthGrandTotal = useMemo(
    () => filteredEmployees.reduce((s, e) => s + empMonthTotal(e.id), 0),
    [filteredEmployees, empMonthTotal],
  );
  // O(data keys) instead of O(employees × days × apps)
  const allPlatformsGrandTotal = useMemo(() => {
    if (!search) {
      // No search filter — sum all values directly from data map
      let total = 0;
      for (const val of Object.values(data)) total += val;
      return total;
    }
    // With search — only sum matched employees
    const matchedIds = new Set(searchMatchedEmployees.map((e) => e.id));
    let total = 0;
    for (const [key, val] of Object.entries(data)) {
      const sep = key.indexOf('::');
      if (sep > 0 && matchedIds.has(key.slice(0, sep))) total += val;
    }
    return total;
  }, [data, search, searchMatchedEmployees]);
  const monthDailyAvg = days > 0 ? Math.round(monthGrandTotal / days) : 0;
  const platformOrderTotals = useMemo(
    () => calculatePlatformTotals(sq.apps, searchMatchedEmployees, dayArr, data),
    [sq.apps, searchMatchedEmployees, dayArr, data],
  );

  const prevMonth = () => {
    const n = shiftMonth(year, month, -1);
    setGlobalMonth(`${n.y}-${String(n.m).padStart(2, '0')}`);
  };
  const nextMonth = () => {
    const n = shiftMonth(year, month, 1);
    setGlobalMonth(`${n.y}-${String(n.m).padStart(2, '0')}`);
  };

  const toggleExpand = (empId: string) => {
    setExpandedEmp((prev) => {
      const next = new Set(prev);
      if (next.has(empId)) next.delete(empId);
      else next.add(empId);
      return next;
    });
  };

  const handleCellClick = useCallback(
    (e: React.MouseEvent, empId: string, day: number) => {
      if (!canEditMonth) return;
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      setCellPopover({ empId, day, x: rect.left + rect.width / 2, y: rect.bottom });
    },
    [canEditMonth],
  );

  const handlePopoverApply = useCallback((empId: string, day: number, vals: Record<string, number>) => {
    setData((prev) => {
      const next = { ...prev };
      Object.entries(vals).forEach(([appId, count]) => {
        const key = `${empId}::${appId}::${day}`;
        if (count > 0) next[key] = count;
        else delete next[key];
      });
      return next;
    });
  }, []);

  const exportExcel = () =>
    exportSpreadsheetExcel({
      year,
      month,
      dayArr,
      filteredEmployees,
      empDayTotal,
      empMonthTotal,
    });

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPendingImportFile(file);
    setShowImportDialog(true);
    e.target.value = '';
  };

  const persistSpreadsheetData = useCallback(
    async (
      nextData: DailyData,
      saveMeta?: {
        sourceType?: 'manual' | 'excel' | 'api';
        fileName?: string | null;
        targetAppId?: string | null;
      },
    ) => {
      const saved = await saveSpreadsheetMonth({
        isMonthLocked,
        year,
        month,
        days,
        data: nextData,
        originalData: sq.spreadsheetMonthData,
        setSaving,
        employees: sq.employees,
        apps: sq.apps,
        saveMeta,
      });
      if (saved) {
        await invalidateMonthDependencies();
      }
    },
    [days, invalidateMonthDependencies, isMonthLocked, month, sq.apps, sq.employees, sq.spreadsheetMonthData, year],
  );

  const handleImportConfirm = async (targetAppId: string | undefined) => {
    setShowImportDialog(false);
    if (!pendingImportFile) return;
    const importResult = await runSpreadsheetImport({
      file: pendingImportFile,
      dayArr,
      employees: sq.employees,
      apps: sq.apps,
      appEmployeeIds: sq.appEmployeeIds,
      data,
      onApplyData: setData,
      targetAppId,
      onShowNameMapping: (unmatched, callback) => {
        setUnmatchedNames(unmatched);
        setNameMappingCallback(() => callback);
        setShowNameMappingDialog(true);
      },
    });
    if (importResult?.appliedData && importResult.imported > 0) {
      await persistSpreadsheetData(importResult.appliedData, {
        sourceType: 'excel',
        fileName: pendingImportFile.name,
        targetAppId: targetAppId ?? null,
      });
      // Force reload data from DB to ensure grid matches actual saved state
      const freshRows = await orderService.getMonthRaw(year, month);
      const freshData = buildDailyDataMap(freshRows);
      setData(freshData);
    }
    setPendingImportFile(null);
  };

  const handleNameMappingConfirm = (mapping: Map<string, string>) => {
    setShowNameMappingDialog(false);
    if (nameMappingCallback) {
      nameMappingCallback(mapping);
      setNameMappingCallback(null);
    }
    setUnmatchedNames([]);
  };

  const handleNameMappingCancel = () => {
    setShowNameMappingDialog(false);
    setUnmatchedNames([]);
    setNameMappingCallback(null);
  };

  const handleImportCancel = () => {
    setShowImportDialog(false);
    setPendingImportFile(null);
  };

  const handleTemplate = () => { downloadSpreadsheetTemplate(dayArr); };

  const handlePrint = () =>
    printSpreadsheetTable({
      tableEl: tableRef.current,
      year,
      month,
      filteredEmployeeCount: filteredEmployees.length,
    });

  const handleSave = () =>
    persistSpreadsheetData(data, {
      sourceType: 'manual',
    }).catch(() => {});

  const handleLockMonth = async () => {
    const my = monthYear(year, month);
    setLockingMonth(true);
    try {
      if (isMonthLocked) {
        await orderService.unlockMonth(my);
        setIsMonthLocked(false);
        queryClient.invalidateQueries({ queryKey: sq.qk.spreadsheetMonthLock(year, month) });
        toast.success('تم فتح الشهر بنجاح');
      } else {
        if (!isPastMonth(year, month)) {
          toast.error('لا يمكن قفل الشهر الحالي أو المستقبلي');
          setLockingMonth(false);
          return;
        }
        await orderService.lockMonth(my);
        setIsMonthLocked(true);
        setCellPopover(null);
        queryClient.invalidateQueries({ queryKey: sq.qk.spreadsheetMonthLock(year, month) });
        toast.success('تم قفل الشهر بنجاح');
      }
    } catch (e: unknown) {
      const message = getErrorMessage(e, 'فشل العملية');
      toast.error(TOAST_ERROR_GENERIC, { description: message });
    } finally {
      setLockingMonth(false);
    }
  };

  const handleBulkDelete = async (
    scope: 'employee_month' | 'employee_app_month' | 'app_month' | 'day',
    filters: { employeeId?: string; appId?: string; day?: number }
  ) => {
    try {
      const my = monthYear(year, month);
      let count = 0;

      if (scope === 'employee_month' && filters.employeeId) {
        count = await bulkDeleteService.deleteEmployeeMonth(filters.employeeId, my);
      } else if (scope === 'employee_app_month' && filters.employeeId && filters.appId) {
        count = await bulkDeleteService.deleteEmployeeAppMonth(filters.employeeId, filters.appId, my);
      } else if (scope === 'app_month' && filters.appId) {
        count = await bulkDeleteService.deleteAppMonth(filters.appId, my);
      } else if (scope === 'day' && filters.day) {
        const date = `${year}-${String(month).padStart(2, '0')}-${String(filters.day).padStart(2, '0')}`;
        count = await bulkDeleteService.deleteDay(date);
      }

      toast.success(`تم حذف ${count} طلب بنجاح`);
      await invalidateMonthDependencies();
    } catch (e: unknown) {
      const message = getErrorMessage(e, 'فشل الحذف');
      toast.error(TOAST_ERROR_GENERIC, { description: message });
      throw e;
    }
  };

  const handleDeleteImportBatch = useCallback(async (batchId: string) => {
    try {
      await performanceService.deleteImportBatch(batchId);
      toast.success('تم حذف سجل الاستيراد');
      await queryClient.invalidateQueries({ queryKey: importHistoryQueryKey });
    } catch (e: unknown) {
      const message = getErrorMessage(e, 'فشل حذف السجل');
      toast.error(TOAST_ERROR_GENERIC, { description: message });
    }
  }, [importHistoryQueryKey, queryClient]);

  const seqColMin = 36;
  const repColMin = 132;

  return {
    uid,
    loading: sq.loading,
    apps: sq.apps,
    employees: sq.employees,
    data,
    setData,
    year,
    month,
    search,
    setSearch,
    importRef,
    tableRef,
    saving,
    expandedEmp,
    cellPopover,
    setCellPopover,
    platformFilter,
    setPlatformFilter,
    isMonthLocked,
    lockingMonth,
    permissions,
    canEditMonth,
    filteredEmployees,
    allPlatformsGrandTotal,
    visibleApps,
    days,
    dayArr,
    today,
    getVal,
    getActiveApps,
    empDayTotal,
    empMonthTotal,
    empAppMonthTotal,
    monthGrandTotal,
    monthDailyAvg,
    platformOrderTotals,
    prevMonth,
    nextMonth,
    toggleExpand,
    handleCellClick,
    handlePopoverApply,
    exportExcel,
    handleImport,
    handleImportConfirm,
    handleImportCancel,
    showImportDialog,
    importHistory,
    handleTemplate,
    handlePrint,
    handleSave,
    handleLockMonth,
    handleBulkDelete,
    showBulkDeleteDialog,
    setShowBulkDeleteDialog,
    showNameMappingDialog,
    unmatchedNames,
    handleNameMappingConfirm,
    handleNameMappingCancel,
    handleDeleteImportBatch,
    seqColMin,
    repColMin,
  };
}
