import { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, endOfMonth } from 'date-fns';
import { useToast } from '@shared/hooks/use-toast';
import { usePermissions } from '@shared/hooks/usePermissions';
import { authQueryUserId, useAuthQueryGate } from '@shared/hooks/useAuthQueryGate';
import { defaultQueryRetry } from '@shared/lib/query';
import { logError } from '@shared/lib/logger';
import { getErrorMessage } from '@services/serviceError';
import { orderService } from '@services/orderService';
import { useFuel } from '@modules/fuel/hooks/useFuel';
import {
  calcDailyStats,
  calcMonthlyStats,
  filterDailyRows,
  filterMonthlyRows,
} from '@modules/fuel/model/fuelCalculations';
import type {
  DailyRow,
  Employee,
  AppRow,
} from '@modules/fuel/types/fuel.types';
import {
  getErrorMessageOrFallback,
  buildOrdersMap,
  buildVehicleMap,
  buildMonthlyAggMap,
  buildMonthlyRows,
  mapDailyRows,
  applyDailyFilters,
  saveVehicleMileageDaily,
} from '@modules/fuel/types/fuel.types';
import { useFuelTable } from '@modules/fuel/hooks/useFuelTable';
import { useTemporalContext } from '@app/providers/TemporalContext';

const ISO_DATE_FORMAT = 'yyyy-MM-dd';

export function useFuelPage() { // NOSONAR: page data layer with many independent handlers
  const { toast } = useToast();
  const fuelApi = useFuel();
  const { enabled, userId } = useAuthQueryGate();
  const uid = authQueryUserId(userId);
  const { permissions } = usePermissions('fuel');
  const { selectedMonth: globalMonth } = useTemporalContext();
  const now = new Date();
  const [view, setView] = useState<'monthly' | 'daily' | 'spreadsheet'>('spreadsheet');

  const [yearStr, monthStr] = globalMonth.split('-');
  const selectedMonth = monthStr;
  const selectedYear = yearStr;
  const setSelectedMonth = () => { /* No-op, managed globally */ };
  const setSelectedYear = () => { /* No-op, managed globally */ };
  const [search, setSearch] = useState('');
  const [selectedEmployee, setSelectedEmployee] = useState<string>('_all_');
  const [platformTab, setPlatformTab] = useState('all');

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [apps, setApps] = useState<AppRow[]>([]);
  const [employeeAppLinks, setEmployeeAppLinks] = useState<{ employee_id: string; app_id: string }[]>([]);
  const [monthOrdersMap, setMonthOrdersMap] = useState<Record<string, number>>({});
  const [showImport, setShowImport] = useState(false);
  const [expandedRider, setExpandedRider] = useState<string | null>(null);
  const [savingEntry, setSavingEntry] = useState(false);
  const [newEntry, setNewEntry] = useState({ employee_id: '', date: '', km_total: '', fuel_cost: '', notes: '' });
  const [editingDaily, setEditingDaily] = useState<{ id: string; km_total: string; fuel_cost: string; notes: string } | null>(null);

  const monthYear = `${selectedYear}-${selectedMonth}`;
  const monthStart = `${monthYear}-01`;
  const monthEnd = format(endOfMonth(new Date(`${monthYear}-01`)), ISO_DATE_FORMAT);
  const todayStr = format(now, ISO_DATE_FORMAT);
  const defaultEntryDate = todayStr >= monthStart && todayStr <= monthEnd ? todayStr : monthStart;

  const employeeIdsOnPlatform = useMemo(() => {
    if (platformTab === 'all') return null;
    const set = new Set<string>();
    employeeAppLinks.forEach(l => {
      if (l.app_id === platformTab) set.add(l.employee_id);
    });
    return set;
  }, [platformTab, employeeAppLinks]);

  const ridersForTab = useMemo(() => {
    const byId = new Map<string, Employee>();
    employees.forEach((e) => {
      if (!employeeIdsOnPlatform || employeeIdsOnPlatform.has(e.id)) byId.set(e.id, e);
    });

    // Ensure riders with monthly orders are visible so fuel/km can be recorded.
    Object.entries(monthOrdersMap).forEach(([empId, orders]) => {
      if (orders <= 0) return;
      if (employeeIdsOnPlatform && !employeeIdsOnPlatform.has(empId)) return;
      const emp = employees.find(e => e.id === empId);
      if (emp) byId.set(empId, emp);
    });

    let list = Array.from(byId.values());
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(e => e.name.toLowerCase().includes(q));
    }
    return list.sort((a, b) => a.name.localeCompare(b.name, 'ar'));
  }, [employees, employeeIdsOnPlatform, monthOrdersMap, search]);

  const { data: fuelBaseData, error: fuelBaseError } = useQuery({
    queryKey: ['fuel', uid, 'base-data'],
    enabled,
    queryFn: async () => {
      const [empRows, appRows, linkRows, assignmentRows] = await Promise.all([
        fuelApi.getActiveEmployees(),
        fuelApi.getActiveApps(),
        fuelApi.getActiveEmployeeAppLinks(),
        fuelApi.getActiveVehicleAssignments(),
      ]);
      const vehicleMap = buildVehicleMap((assignmentRows || []));
      const employeesWithVehicles = (empRows || []).map((emp: Employee) => ({
        ...emp,
        vehicle: vehicleMap[emp.id] || null,
      }));
      return {
        employees: employeesWithVehicles,
        apps: (appRows || []),
        links: (linkRows || []),
      };
    },
    retry: defaultQueryRetry,
    staleTime: 60_000,
  });

  useEffect(() => {
    if (!fuelBaseData) return;
    // For fuel page, show all active employees regardless of monthly activity
    // This ensures couriers with vehicles are visible even if they have no orders/attendance in the month
    setEmployees(fuelBaseData.employees.filter(e => e.status === 'active'));
    setApps(fuelBaseData.apps);
    setEmployeeAppLinks(fuelBaseData.links);
  }, [fuelBaseData]);

  useEffect(() => {
    if (!fuelBaseError) return;
    const message = getErrorMessage(fuelBaseError, 'تعذر تحميل البيانات الأساسية');
    toast({ title: 'خطأ في تحميل البيانات', description: message, variant: 'destructive' });
  }, [fuelBaseError, toast]);

  const { data: monthlyOrdersData = [] } = useQuery({
    queryKey: ['fuel', uid, 'monthly-orders', monthYear],
    enabled,
    queryFn: async () => {
      const ms = `${monthYear}-01`;
      const me = format(endOfMonth(new Date(`${monthYear}-01`)), ISO_DATE_FORMAT);
      const rows = await fuelApi.getMonthlyOrders(ms, me);
      return (rows || []);
    },
    retry: defaultQueryRetry,
    staleTime: 30_000,
  });

  /** Daily orders with date — used by spreadsheet view for per-day orders */
  const { data: dailyOrderRows = [] } = useQuery({
    queryKey: ['fuel', uid, 'daily-orders-by-date', monthYear],
    enabled: enabled,
    queryFn: async () => {
      const [y, m] = monthYear.split('-').map(Number);
      const rows = await orderService.getMonthRaw(y, m);
      return (rows ?? []).map(r => ({ employee_id: r.employee_id, date: r.date, orders_count: r.orders_count }));
    },
    retry: defaultQueryRetry,
    staleTime: 30_000,
  });

  useEffect(() => {
    const map: Record<string, number> = {};
    monthlyOrdersData.forEach((o) => {
      map[o.employee_id] = (map[o.employee_id] || 0) + (Number(o.orders_count) || 0);
    });
    setMonthOrdersMap(map);
  }, [monthlyOrdersData]);

  useEffect(() => {
    setNewEntry(ne => ({ ...ne, date: defaultEntryDate }));
  }, [monthYear, defaultEntryDate]);

  const {
    data: monthlyRows = [],
    isLoading: monthlyLoading,
    error: monthlyError,
    refetch: refetchMonthly,
  } = useQuery({
    queryKey: ['fuel', uid, 'monthly', monthYear, platformTab, employees.map((e) => e.id).join(',')],
    enabled: enabled,
    queryFn: async () => {
      const ms = `${monthYear}-01`;
      const me = format(endOfMonth(new Date(`${monthYear}-01`)), ISO_DATE_FORMAT);
      const [dailyRowsRaw, orderRows, assignmentRows] = await Promise.all([
        fuelApi.getMonthlyDailyMileage(ms, me),
        fuelApi.getMonthlyOrders(ms, me),
        fuelApi.getActiveVehicleAssignments(),
      ]);
      const ordersMap = buildOrdersMap((orderRows || []));
      const vehicleMap = buildVehicleMap((assignmentRows || []));
      const aggMap = buildMonthlyAggMap((dailyRowsRaw || []), employeeIdsOnPlatform);
      return buildMonthlyRows(aggMap, ordersMap, vehicleMap, employees, employeeIdsOnPlatform);
    },
    retry: defaultQueryRetry,
    staleTime: 30_000,
  });

  const {
    data: dailyRows = [],
    isLoading: dailyLoading,
    error: dailyError,
    refetch: refetchDaily,
  } = useQuery({
    queryKey: ['fuel', uid, 'daily', monthYear, selectedEmployee, platformTab],
    enabled: enabled,
    queryFn: async () => {
      const ms = `${monthYear}-01`;
      const me = format(endOfMonth(new Date(`${monthYear}-01`)), ISO_DATE_FORMAT);
      const dailyData = await fuelApi.getDailyMileageByMonth(ms, me);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mappedRows = mapDailyRows((dailyData || []) as any);
      return applyDailyFilters(mappedRows, selectedEmployee, employeeIdsOnPlatform);
    },
    retry: defaultQueryRetry,
    staleTime: 30_000,
  });

  useEffect(() => {
    if (!monthlyError) return;
    logError('[Fuel] monthly query failed', monthlyError);
    toast({ title: 'خطأ في جلب البيانات', description: getErrorMessageOrFallback(monthlyError, 'تعذر جلب البيانات الشهرية'), variant: 'destructive' });
  }, [monthlyError, toast]);

  useEffect(() => {
    if (!dailyError) return;
    logError('[Fuel] daily query failed', dailyError);
    toast({ title: 'خطأ في جلب البيانات', description: getErrorMessageOrFallback(dailyError, 'تعذر جلب البيانات اليومية'), variant: 'destructive' });
  }, [dailyError, toast]);

  const refresh = () => {
    refetchMonthly().catch(() => {});
    refetchDaily().catch(() => {});
  };
  const getLoadingStatus = () => {
    return monthlyLoading || dailyLoading;
  };
  const loading = getLoadingStatus();

  const handleDeleteDaily = async (id: string) => {
    if (!confirm('هل تريد حذف هذا السجل؟')) return;
    try {
      await fuelApi.deleteDailyMileage(id);
      toast({ title: 'تم الحذف' });
      refresh();
    } catch (e) {
      logError('[Fuel] delete daily failed', e);
      const message = getErrorMessage(e);
      toast({ title: 'خطأ في الحذف', description: message, variant: 'destructive' });
    }
  };

  const submitNewEntry = async () => {
    if (!permissions.can_edit) return;
    if (!newEntry.employee_id) { toast({ title: 'اختر المندوب', variant: 'destructive' }); return; }
    if (!newEntry.date) { toast({ title: 'اختر التاريخ', variant: 'destructive' }); return; }
    const km = Number.parseFloat(newEntry.km_total) || 0;
    const fuel = Number.parseFloat(newEntry.fuel_cost) || 0;
    if (!km && !fuel) { toast({ title: 'أدخل الكيلومترات أو تكلفة البنزين', variant: 'destructive' }); return; }
    if (employeeIdsOnPlatform && !employeeIdsOnPlatform.has(newEntry.employee_id)) {
      toast({ title: 'المندوب غير مسجّل على هذه المنصة', variant: 'destructive' }); return;
    }
    setSavingEntry(true);
    try {
      await saveVehicleMileageDaily({
        employee_id: newEntry.employee_id,
        date: newEntry.date,
        km_total: km,
        fuel_cost: fuel,
        notes: newEntry.notes.trim() || null,
      }, fuelApi.upsertDailyMileage);
      toast({ title: 'تم الحفظ بنجاح' });
      setNewEntry(ne => ({ ...ne, km_total: '', fuel_cost: '', notes: '' }));
      refresh();
    } catch (e) {
      logError('[Fuel] save daily failed', e);
      const message = getErrorMessage(e);
      toast({ title: 'خطأ في الحفظ', description: message, variant: 'destructive' });
    } finally {
      setSavingEntry(false);
    }
  };

  const saveEditedDaily = async (row: DailyRow) => {
    if (!permissions.can_edit || !editingDaily) return;
    const km = Number.parseFloat(editingDaily.km_total) || 0;
    const fuel = Number.parseFloat(editingDaily.fuel_cost) || 0;
    if (!km && !fuel) {
      toast({ title: 'أدخل الكيلومترات أو تكلفة البنزين', variant: 'destructive' });
      return;
    }
    setSavingEntry(true);
    try {
      await saveVehicleMileageDaily(
        {
          employee_id: row.employee_id,
          date: row.date,
          km_total: km,
          fuel_cost: fuel,
          notes: editingDaily.notes.trim() || null,
        },
        fuelApi.upsertDailyMileage,
        row.id
      );
      toast({ title: 'تم تحديث السجل' });
      setEditingDaily(null);
      refresh();
    } catch (e) {
      logError('[Fuel] update daily failed', e);
      const message = getErrorMessage(e);
      toast({ title: 'خطأ في الحفظ', description: message, variant: 'destructive' });
    } finally {
      setSavingEntry(false);
    }
  };

  const filteredMonthly = filterMonthlyRows(monthlyRows, search);
  const filteredDaily = filterDailyRows(dailyRows, search);
  const { totalKm, totalFuel, totalOrders, avgCostPerKm } = calcMonthlyStats(filteredMonthly);
  const { dailyTotalKm, dailyTotalFuel } = calcDailyStats(filteredDaily);

  const years = Array.from({ length: 5 }, (_, i) => String(now.getFullYear() - 2 + i));

  const {
    tableRef,
    handleExportMonthly,
    handleExportDaily,
  } = useFuelTable({
    view,
    filteredMonthly,
    filteredDaily,
    selectedMonth,
    selectedYear,
  });

  const updateEditingDaily = (field: 'km_total' | 'fuel_cost' | 'notes', value: string) => {
    setEditingDaily((current) => {
      if (!current) return null;
      return { ...current, [field]: value };
    });
  };

  return {
    view,
    setView,
    selectedMonth,
    setSelectedMonth,
    selectedYear,
    setSelectedYear,
    search,
    setSearch,
    selectedEmployee,
    setSelectedEmployee,
    platformTab,
    setPlatformTab,
    years,
    employees,
    apps,
    monthYear,
    ridersForTab,
    loading,
    filteredMonthly,
    filteredDaily,
    totalKm,
    totalFuel,
    totalOrders,
    avgCostPerKm,
    dailyTotalKm,
    dailyTotalFuel,
    tableRef,
    handleExportMonthly,
    handleExportDaily,
    showImport,
    setShowImport,
    expandedRider,
    setExpandedRider,
    newEntry,
    setNewEntry,
    editingDaily,
    setEditingDaily,
    defaultEntryDate,
    savingEntry,
    submitNewEntry,
    updateEditingDaily,
    saveEditedDaily,
    handleDeleteDaily,
    permissions,
    refetchMonthly,
    monthOrdersMap,
    dailyOrderRows,
    error: fuelBaseError || monthlyError || dailyError,
    refetch: async () => { await refetchMonthly(); await refetchDaily(); },
  };
}
