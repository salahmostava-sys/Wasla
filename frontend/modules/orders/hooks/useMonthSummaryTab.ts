import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from '@shared/components/ui/sonner';
import { TOAST_ERROR_GENERIC, TOAST_SUCCESS_EDIT } from '@shared/lib/toastMessages';
import { authQueryUserId, useAuthQueryGate } from '@shared/hooks/useAuthQueryGate';
import { usePermissions } from '@shared/hooks/usePermissions';
import { isOrderCapableApp } from '@shared/lib/workType';
import { defaultQueryRetry } from '@shared/lib/query';
import { orderService } from '@services/orderService';
import { filterRetainedEmployeesForMonth, filterVisibleEmployeesInMonth } from '@shared/lib/employeeVisibility';
import { useMonthlyActiveEmployeeIds } from '@shared/hooks/useMonthlyActiveEmployeeIds';
import type { App, DailyData, Employee, OrdersEmployeeSortField } from '@modules/orders/types';
import { buildDailyDataMap, filterDailyDataByAppIds, getOrdersEmployeeSortPair } from '@modules/orders/utils/gridHelpers';
import { getDaysInMonth, monthYear } from '@modules/orders/utils/dateMonth';
import { ordersQueryKeys } from '@modules/orders/hooks/ordersQueryKeys';
import { useTemporalContext } from '@app/providers/TemporalContext';
import { getErrorMessage } from '@services/serviceError';

export function useMonthSummaryTab() {
  const { enabled, userId } = useAuthQueryGate();
  const uid = authQueryUserId(userId);
  const { permissions } = usePermissions('orders');
  const { selectedMonth: globalMonth, setSelectedMonth: setGlobalMonth } = useTemporalContext();
  const qk = ordersQueryKeys(uid);

  // Derived from Global Temporal Context (YYYY-MM)
  const [yearStr, monthStr] = globalMonth.split('-');
  const year = Number(yearStr);
  const month = Number(monthStr);
  const [targets, setTargets] = useState<Record<string, string>>({});
  const [employeeTargets, setEmployeeTargets] = useState<Record<string, string>>({});
  const [data, setData] = useState<DailyData>({});
  const [savingTarget, setSavingTarget] = useState<string | null>(null);
  const [isMonthLocked, setIsMonthLocked] = useState(false);
  const [sortField, setSortField] = useState<OrdersEmployeeSortField>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const monthKey = monthYear(year, month);
  const { data: activeIdsData } = useMonthlyActiveEmployeeIds(monthKey);
  const activeEmployeeIdsInMonth = activeIdsData?.orderEmployeeIds;

  const {
    data: summaryBaseData,
    error: summaryBaseError,
    isLoading: summaryBaseLoading,
  } = useQuery({
    queryKey: qk.summaryBase,
    enabled,
    queryFn: async () => {
      const [employees, apps] = await Promise.all([
        orderService.getBaseEmployees(),
        orderService.getActiveApps(),
      ]);
      return {
        employees: (employees || []),
        apps: (apps || []),
      };
    },
    select: (base) => ({
      employees: base.employees,
      apps: base.apps.filter(isOrderCapableApp),
    }),
    retry: defaultQueryRetry,
    staleTime: 60_000,
  });

  const { data: summaryMonthMeta, error: summaryMonthMetaError } = useQuery({
    queryKey: ['orders', uid, 'summary', 'month-meta', year, month] as const,
    enabled,
    queryFn: async () => {
      const my = monthYear(year, month);
      const [targetsRows, lockRes] = await Promise.all([
        orderService.getAppTargets(my),
        orderService.getMonthLockStatus(my),
      ]);
      return {
        targets: (targetsRows || []),
        locked: lockRes.locked,
      };
    },
    retry: defaultQueryRetry,
    staleTime: 15_000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  const {
    data: summaryMonthRawData = {},
    error: summaryMonthError,
    isLoading: summaryMonthLoading,
  } = useQuery({
    queryKey: qk.summaryMonthRaw(year, month),
    enabled,
    queryFn: async () => {
      const rows = await orderService.getMonthRaw(year, month);
      return (rows || []);
    },
    select: (rows) => buildDailyDataMap(rows),
    retry: defaultQueryRetry,
    staleTime: 15_000,
  });

  const loading = summaryBaseLoading || summaryMonthLoading;

  const employees = useMemo<Employee[]>(
    () =>
      filterVisibleEmployeesInMonth(
        filterRetainedEmployeesForMonth(summaryBaseData?.employees ?? [], activeEmployeeIdsInMonth),
        activeEmployeeIdsInMonth,
      ),
    [summaryBaseData, activeEmployeeIdsInMonth],
  );
  const apps = useMemo<App[]>(() => summaryBaseData?.apps ?? [], [summaryBaseData]);
  const orderAppIds = useMemo(() => new Set(apps.map((app) => app.id)), [apps]);
  const filteredMonthData = useMemo(
    () => filterDailyDataByAppIds(summaryMonthRawData, orderAppIds),
    [orderAppIds, summaryMonthRawData],
  );

  useEffect(() => {
    const t: Record<string, string> = {};
    const et: Record<string, string> = {};
    (summaryMonthMeta?.targets || []).forEach((r) => {
      t[r.app_id] = String(r.target_orders);
      if (r.employee_target_orders != null) {
        et[r.app_id] = String(r.employee_target_orders);
      }
    });
    setTargets(t);
    setEmployeeTargets(et);
  }, [summaryMonthMeta?.targets]);

  useEffect(() => {
    setIsMonthLocked(summaryMonthMeta?.locked ?? false);
  }, [summaryMonthMeta?.locked]);

  useEffect(() => {
    setData(filteredMonthData);
  }, [filteredMonthData]);

  useEffect(() => {
    const error = summaryBaseError || summaryMonthMetaError || summaryMonthError;
    if (!error) return;
    const message = getErrorMessage(error, 'فشل تحميل ملخص الشهر');
    toast.error(TOAST_ERROR_GENERIC, { description: message });
  }, [summaryBaseError, summaryMonthMetaError, summaryMonthError]);

  const saveTargets = async (appId: string, appTargetValue: string, employeeTargetValue: string) => {
    if (isMonthLocked) return;
    const targetOrders = Number.parseInt(appTargetValue, 10) || 0;
    const employeeTargetOrders = employeeTargetValue ? Number.parseInt(employeeTargetValue, 10) || null : null;
    const my = monthYear(year, month);
    setSavingTarget(appId);
    try {
      await orderService.upsertAppTarget(appId, my, targetOrders, employeeTargetOrders);
      toast.success(TOAST_SUCCESS_EDIT);
    } catch {
      toast.error(TOAST_ERROR_GENERIC);
    } finally {
      setSavingTarget(null);
    }
  };

  const days = getDaysInMonth(year, month);
  const dayArr = Array.from({ length: days }, (_, i) => i + 1);

  // Pre-compute per-employee totals in a single pass — O(keys)
  const empTotalsMap = useMemo(() => {
    const totals: Record<string, number> = {};
    const appIds = new Set(apps.map((a) => a.id));
    for (const [key, val] of Object.entries(data)) {
      const parts = key.split('::');
      if (parts.length !== 3) continue;
      const [empId, appId] = parts;
      if (appIds.has(appId)) {
        totals[empId] = (totals[empId] ?? 0) + val;
      }
    }
    return totals;
  }, [apps, data]);

  const empTotal = useCallback(
    (empId: string) => empTotalsMap[empId] ?? 0,
    [empTotalsMap],
  );

  // Pre-compute all app totals in a single pass over data keys — O(keys) instead of O(apps × employees × days)
  const appGrandTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    const empIds = new Set(employees.map((e) => e.id));
    const appIds = new Set(apps.map((a) => a.id));
    for (const [key, val] of Object.entries(data)) {
      const parts = key.split('::');
      if (parts.length !== 3) continue;
      const [empId, appId] = parts;
      if (empIds.has(empId) && appIds.has(appId)) {
        totals[appId] = (totals[appId] ?? 0) + val;
      }
    }
    return totals;
  }, [employees, apps, data]);

  const appGrandTotal = useCallback(
    (appId: string) => appGrandTotals[appId] ?? 0,
    [appGrandTotals],
  );

  const grandTotal = useMemo(
    () => employees.reduce((s, e) => s + empTotal(e.id), 0),
    [employees, empTotal],
  );

  const sortedEmployees = useMemo(() => {
    const sorted = [...employees].sort((a, b) => {
      const [aVal, bVal] = getOrdersEmployeeSortPair(a, b, sortField, empTotal, dayArr, data);
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        const cmp = aVal.localeCompare(bVal, 'ar');
        return sortDir === 'asc' ? cmp : -cmp;
      }
      const cmp = Number(aVal) - Number(bVal);
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return sorted;
  }, [employees, sortField, sortDir, data, dayArr, empTotal]);

  const handleSort = (field: OrdersEmployeeSortField) => {
    if (sortField === field) setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const prevMonth = () => {
    let py = year, pm = month - 1;
    if (pm === 0) { pm = 12; py--; }
    setGlobalMonth(`${py}-${String(pm).padStart(2, '0')}`);
  };
  const nextMonth = () => {
    let ny = year, nm = month + 1;
    if (nm === 13) { nm = 1; ny++; }
    setGlobalMonth(`${ny}-${String(nm).padStart(2, '0')}`);
  };

  return {
    year,
    month,
    loading,
    apps,
    employees,
    data,
    targets,
    setTargets,
    employeeTargets,
    setEmployeeTargets,
    savingTarget,
    isMonthLocked,
    sortedEmployees,
    days,
    dayArr,
    grandTotal,
    empTotal,
    appGrandTotal,
    saveTargets,
    handleSort,
    sortField,
    sortDir,
    prevMonth,
    nextMonth,
    permissions,
  };
}
