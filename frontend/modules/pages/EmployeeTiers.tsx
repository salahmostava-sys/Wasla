import { formatStandardDateTime } from '@shared/lib/formatters';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Plus, Trash2, Search, Loader2, AlertTriangle, CheckCircle2,
  Calendar, Layers, Check, X,
} from 'lucide-react';
import { getErrorMessage } from '@services/serviceError';
import { Button } from '@shared/components/ui/button';
import { Input } from '@shared/components/ui/input';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@shared/components/ui/alert-dialog';
import { useToast } from '@shared/hooks/use-toast';
import { usePermissions } from '@shared/hooks/usePermissions';
import { differenceInDays, parseISO } from 'date-fns';
import { employeeTierService } from '@services/employeeTierService';
import { isEmployeeExcluded } from '@shared/lib/employeeVisibility';

import { authQueryUserId, useAuthQueryGate } from '@shared/hooks/useAuthQueryGate';
import { defaultQueryRetry } from '@shared/lib/query';
import { printHtmlTable } from '@shared/lib/printTable';
import { logError } from '@shared/lib/logger';
import { TableActions } from '@shared/components/table/TableActions';
import {
  EMPLOYEE_TIER_IO_COLUMNS,
  EMPLOYEE_TIER_TEMPLATE_HEADERS,
  findEmployeeIdByName,
  isTierMatrixRowEmpty,
  mapPlatformNamesToIds,
  parseTierDeliveryStatus,
  parseTierRenewalDate,
  splitTierPlatformNames,
} from '@shared/lib/employeeTierExcel';

import { loadXlsx } from '@modules/orders/utils/xlsx';

import {
  Employee,
  AppRow,
  TierRow,
  TierSortField,
  SortDir,
  TierCreatePayload,
  STATUS_DELIVERED,
  STATUS_NOT_DELIVERED,
  statusLabel,
} from '../employees/types/tier.types';
import {
  AppMultiSelect,
  EmployeeSelect,
  ThSort,
} from '../employees/components/tiers/TierComponents';

const getTierFieldValue = (tier: TierRow, field: TierSortField): unknown => {
  return (tier as Record<string, unknown>)[field];
};

function toSafeText(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return '';
  }
}

/** Parses sheet matrix rows into validated tier payloads (Sonar: lowers cognitive complexity of import). */
function collectTierImportValidatedRows(
  matrix: unknown[][],
  apps: AppRow[],
  employees: Employee[],
): { validatedRows: Array<{ rowIndex: number; payload: TierCreatePayload }>; rowErrors: string[] } {
  const validatedRows: Array<{ rowIndex: number; payload: TierCreatePayload }> = [];
  const rowErrors: string[] = [];
  for (let i = 1; i < matrix.length; i++) {
    const line = matrix[i];
    const values = Array.isArray(line) ? line : [];
    if (isTierMatrixRowEmpty(values)) continue;
    const row: Record<string, unknown> = {};
    EMPLOYEE_TIER_IO_COLUMNS.forEach((col, idx) => {
      row[col.key] = values[idx];
    });
    const employeeName = toSafeText(row.employee_name).trim();
    const packageType = toSafeText(row.package_type).trim();
    if (!employeeName || !packageType) {
      rowErrors.push(`سطر ${i + 1}: اسم المندوب ونوع الباقة مطلوبان`);
      continue;
    }
    const empId = findEmployeeIdByName(employees, employeeName);
    if (!empId) {
      rowErrors.push(`سطر ${i + 1}: لم يُعثر على مندوب «${employeeName}»`);
      continue;
    }
    const renewal = parseTierRenewalDate(row.renewal_date);
    const delivery = parseTierDeliveryStatus(row.delivery_status);
    const platformNames = splitTierPlatformNames(row.platforms);
    const appIds = mapPlatformNamesToIds(platformNames, apps);
    const simRaw = row.sim_number;
    const simText = toSafeText(simRaw).trim();
    const simStr = simText === '' ? null : simText;
    validatedRows.push({
      rowIndex: i,
      payload: {
        sim_number: simStr,
        employee_id: empId,
        package_type: packageType,
        renewal_date: renewal,
        delivery_status: delivery,
        app_ids: appIds,
        start_date: new Date().toISOString().slice(0, 10),
      },
    });
  }
  return { validatedRows, rowErrors };
}

function tierRowsMatchFilters(
  tier: TierRow,
  search: string,
  statusFilter: string,
  empMap: Record<string, Employee>,
): boolean {
  const name = empMap[tier.employee_id]?.name ?? '';
  const matchSearch = !search || (tier.sim_number ?? '').includes(search) || name.includes(search);
  const matchStatus = statusFilter === 'all' || tier.delivery_status === statusFilter;
  return matchSearch && matchStatus;
}

function compareTierRowsForSort(
  a: TierRow,
  b: TierRow,
  sortField: TierSortField,
  sortDir: 'asc' | 'desc',
  empMap: Record<string, Employee>,
): number {
  const va = sortField === 'employee_name'
    ? (empMap[a.employee_id]?.name ?? '')
    : toSafeText(getTierFieldValue(a, sortField));
  const vb = sortField === 'employee_name'
    ? (empMap[b.employee_id]?.name ?? '')
    : toSafeText(getTierFieldValue(b, sortField));
  if (va < vb) return sortDir === 'asc' ? -1 : 1;
  if (va > vb) return sortDir === 'asc' ? 1 : -1;
  return 0;
}

function mergeTierImportFailures(
  results: PromiseSettledResult<unknown>[],
  validatedRows: Array<{ rowIndex: number; payload: TierCreatePayload }>,
  rowErrors: string[],
): number {
  let success = 0;
  results.forEach((result, idx) => {
    if (result.status === 'fulfilled') {
      success++;
    } else {
      const { rowIndex } = validatedRows[idx];
      logError('[EmployeeTiers] import row failed', result.reason, { level: 'warn' });
      rowErrors.push(`سطر ${rowIndex + 1}: ${getErrorMessage(result.reason, 'فشل الحفظ')}`);
    }
  });
  return success;
}

/* ═══════════════════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════════════════ */


const EmployeeTiers = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { enabled, userId } = useAuthQueryGate();
  const uid = authQueryUserId(userId);
  const { permissions: perms } = usePermissions('employee_tiers');
  const [fileActionsLoading, setFileActionsLoading] = useState(false);

  const [tiers, setTiers]       = useState<TierRow[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [apps, setApps]         = useState<AppRow[]>([]);
  const {
    data: tiersData,
    isLoading: loading,
    error: tiersError,
    refetch: refetchTiersData,
  } = useQuery({
    queryKey: ['employee-tiers', uid, 'page-data'],
    enabled,
    queryFn: async () => {
      const [tiersRows, employeeRows, appsRows] = await Promise.all([
        employeeTierService.getTiers(),
        employeeTierService.getEmployees(),
        employeeTierService.getActiveApps(),
      ]);

      return {
        employees: (employeeRows || []).filter(e => !isEmployeeExcluded(e)),
        apps: (appsRows || []),
        tiers: ((tiersRows || []) as TierRow[]).map((t) => {
          let parsedApps: string[] = [];
          if (Array.isArray(t.app_ids)) {
            parsedApps = t.app_ids;
          } else if (t.app_ids) {
            try { parsedApps = JSON.parse(t.app_ids); } catch { /* ignore */ }
          }
          return {
            ...t,
            app_ids: parsedApps,
          };
        }),
      };
    },
    retry: defaultQueryRetry,
    staleTime: 60_000,
  });
  const [search, setSearch]     = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortDir, setSortDir]   = useState<SortDir>(null);

  // Inline editing state — keyed by tier id
  const [editRows, setEditRows] = useState<Record<string, Partial<TierRow>>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  // Add new row
  const [addingRow, setAddingRow] = useState(false);
  const [newRow, setNewRow] = useState<Partial<TierRow>>({
    sim_number: '', employee_id: '', package_type: '', renewal_date: '', delivery_status: STATUS_DELIVERED, app_ids: [],
  });
  const [savingNew, setSavingNew] = useState(false);

  // Delete
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);

  // Absconded alert
  const [abscondedAlert, setAbscondedAlert] = useState<{
    name: string;
    simNumber: string;
    vehiclePlate: string;
    tierIds: string[];
    employeeId: string;
  } | null>(null);
  const processedAbscondedRef = useRef<Set<string>>(new Set());
  const [updatingAbsconded, setUpdatingAbsconded] = useState(false);

  /* ── Fetch — local state mirrors React Query data.
     Kept intentionally because inline editing (editRows, patchRow) and absconded checks
     rely on mutable local arrays. Optimistic updates modify local state directly. ── */
  useEffect(() => {
    if (!tiersData) return;
    setEmployees(tiersData.employees);
    setApps(tiersData.apps);
    setTiers(tiersData.tiers);
  }, [tiersData]);

  useEffect(() => {
    if (!tiersError) return;
    const message = getErrorMessage(tiersError, 'تعذر تحميل البيانات');
    toast({ title: 'خطأ', description: message, variant: 'destructive' });
  }, [tiersError, toast]);

  /* ── Watch for absconded employees and show confirmation alert ── */
  useEffect(() => {
    const checkAbsconded = async () => {
      const abscondedEmpIds = employees
        .filter(e => e.sponsorship_status === 'absconded')
        .map(e => e.id);

      if (abscondedEmpIds.length === 0) return;

      const newlyAbsconded = abscondedEmpIds.filter(id => !processedAbscondedRef.current.has(id));
      // Find tiers linked to absconded employees that are still "delivered"
      const affectedTiers = tiers.filter(
        t => abscondedEmpIds.includes(t.employee_id) && t.delivery_status === STATUS_DELIVERED
      );

      if (affectedTiers.length === 0) return;

      // Show alert for the first newly absconded employee only
      const firstAffected = affectedTiers[0];
      if (firstAffected && newlyAbsconded.includes(firstAffected.employee_id)) {
        const emp = employees.find(e => e.id === firstAffected.employee_id);
        const assignments = await employeeTierService.getActiveAssignmentWithVehicleByEmployee(firstAffected.employee_id);

        const firstAssignment = assignments?.[0] as { vehicles?: { plate_number?: string | null } } | undefined;
        const plate = firstAssignment?.vehicles?.plate_number || 'غير مسجلة';

        // Collect all tier IDs for this employee that need updating
        const employeeAffectedTierIds = affectedTiers
          .filter(t => t.employee_id === firstAffected.employee_id)
          .map(t => t.id);

        setAbscondedAlert({
          name: emp?.name || '—',
          simNumber: firstAffected.sim_number || '—',
          vehiclePlate: plate,
          tierIds: employeeAffectedTierIds,
          employeeId: firstAffected.employee_id,
        });
        processedAbscondedRef.current.add(firstAffected.employee_id);
      }
    };

    if (employees.length > 0 && tiers.length > 0) checkAbsconded();
  }, [employees, tiers]);

  /* ── Inline edit helpers ── */
  const getRow = (tier: TierRow) => editRows[tier.id] ? { ...tier, ...editRows[tier.id] } : tier;

  const patchRow = (id: string, patch: Partial<TierRow>) =>
    setEditRows(prev => ({ ...prev, [id]: { ...prev[id], ...patch } }));

  const isDirty = (tier: TierRow) => !!editRows[tier.id];

  const saveRow = async (tier: TierRow) => {
    if (!perms.can_edit) {
      toast({ title: 'صلاحية غير كافية', description: 'ليس لديك صلاحية التعديل', variant: 'destructive' });
      return;
    }
    const merged = { ...tier, ...editRows[tier.id] };
    setSavingId(tier.id);
    try {
      await employeeTierService.updateTier(tier.id, {
        sim_number: merged.sim_number || null,
        employee_id: merged.employee_id || null,
        package_type: merged.package_type,
        renewal_date: merged.renewal_date,
        delivery_status: merged.delivery_status,
        app_ids: merged.app_ids,
      });
      toast({ title: '✅ تم الحفظ' });
      setEditRows(prev => { const n = { ...prev }; delete n[tier.id]; return n; });
    } catch (err: unknown) {
      const message = getErrorMessage(err, 'تعذر حفظ التعديل');
      toast({ title: 'خطأ', description: message, variant: 'destructive' });
    }
    setSavingId(null);
    refetchTiersData().catch(() => {});
  };

  const cancelRow = (id: string) =>
    setEditRows(prev => { const n = { ...prev }; delete n[id]; return n; });

  /* ── Add new row ── */
  const saveNew = async () => {
    if (!perms.can_edit) {
      toast({ title: 'صلاحية غير كافية', description: 'ليس لديك صلاحية الإضافة', variant: 'destructive' });
      return;
    }
    setSavingNew(true);
    try {
      await employeeTierService.createTier({
        sim_number: newRow.sim_number || null,
        employee_id: newRow.employee_id || null,
        package_type: newRow.package_type ?? '',
        renewal_date: newRow.renewal_date || new Date().toISOString().slice(0, 10),
        delivery_status: newRow.delivery_status || STATUS_DELIVERED,
        app_ids: newRow.app_ids || [],
        start_date: new Date().toISOString().slice(0, 10),
      });
      toast({ title: '✅ تمت الإضافة' });
      setAddingRow(false);
      setNewRow({ sim_number: '', employee_id: '', package_type: '', renewal_date: '', delivery_status: STATUS_DELIVERED, app_ids: [] });
    } catch (err: unknown) {
      const message = getErrorMessage(err, 'تعذر إنشاء السجل');
      toast({ title: 'خطأ', description: message, variant: 'destructive' });
    }
    setSavingNew(false);
    refetchTiersData().catch(() => {});
  };

  /* ── Absconded confirmation ── */
  const handleConfirmAbsconded = async () => {
    if (!abscondedAlert) return;
    if (!perms.can_edit) {
      toast({ title: 'صلاحية غير كافية', description: 'ليس لديك صلاحية التعديل', variant: 'destructive' });
      setAbscondedAlert(null);
      return;
    }

    setUpdatingAbsconded(true);
    try {
      // Update all affected tiers for this employee
      for (const tierId of abscondedAlert.tierIds) {
        await employeeTierService.updateTier(tierId, { delivery_status: STATUS_NOT_DELIVERED });
      }
      toast({ title: 'تم التحديث', description: `تم تغيير حالة ${abscondedAlert.tierIds.length} شريحة إلى "غير مسلّمة"` });
      refetchTiersData().catch(() => {});
    } catch (e) {
      logError('[EmployeeTiers] failed to update absconded tiers', e);
      toast({ title: 'خطأ', description: 'فشل تحديث حالة الشرائح', variant: 'destructive' });
    } finally {
      setUpdatingAbsconded(false);
      setAbscondedAlert(null);
    }
  };

  const bulkDelete = async () => {
    if (!perms.can_delete || selectedIds.size === 0) return;
    if (!confirm(`هل أنت متأكد من مسح ${selectedIds.size} شريحة؟`)) return;
    setBulkDeleting(true);
    try {
      await employeeTierService.deleteTiers(Array.from(selectedIds));
      toast({ title: '✅ تم مسح الشرائح المحددة' });
      setSelectedIds(new Set());
      refetchTiersData().catch(() => {});
    } catch (err: unknown) {
      logError('EmployeeTiers: Bulk delete error', err);
      toast({ title: 'خطأ', description: getErrorMessage(err), variant: 'destructive' });
    } finally {
      setBulkDeleting(false);
    }
  };

  /* ── Print / Export ── */
  const handleSort = (field: string) => {
    if (sortField === field) {
      if (sortDir === 'asc') setSortDir('desc');
      else if (sortDir === 'desc') { setSortField(null); setSortDir(null); }
      else setSortDir('asc');
    } else { setSortField(field); setSortDir('asc'); }
  };

  /* ── Filter + sort ── */
  const empMap = useMemo(() => {
    const m: Record<string, Employee> = {};
    employees.forEach(e => { m[e.id] = e; });
    return m;
  }, [employees]);

  const filtered = useMemo(() => {
    let list = tiers.filter((r) => tierRowsMatchFilters(r, search, statusFilter, empMap));
    if (sortField && sortDir) {
      const field = sortField as TierSortField;
      list = [...list].sort((a, b) => compareTierRowsForSort(a, b, field, sortDir, empMap));
    }
    return list;
  }, [tiers, search, statusFilter, sortField, sortDir, empMap]);

  const downloadTierTemplate = async () => {
    setFileActionsLoading(true);
    try {
      const XLSX = await loadXlsx();
      const exampleRow = [
        '0555123456',
        'اسم المندوب كما في النظام',
        'باقة شهرية',
        '2026-12-31',
        'مسلّمة',
        'مرسول، جاهز',
      ];
      const ws = XLSX.utils.aoa_to_sheet([EMPLOYEE_TIER_TEMPLATE_HEADERS, exampleRow]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'شرائح');
      XLSX.writeFile(wb, 'قالب_استيراد_شرائح_الشركة.xlsx');
      toast({ title: 'تم تحميل القالب' });
    } catch (e) {
      logError('[EmployeeTiers] template download failed', e);
      toast({ title: 'تعذر إنشاء القالب', variant: 'destructive' });
    } finally {
      setFileActionsLoading(false);
    }
  };

  const exportTiersExcel = async () => {
    setFileActionsLoading(true);
    try {
      const XLSX = await loadXlsx();
      const rows = filtered.map((t) => {
        const platformLabel = apps.filter((a) => t.app_ids.includes(a.id)).map((a) => a.name).join('، ');
        return [
          t.sim_number ?? '',
          empMap[t.employee_id]?.name ?? '',
          t.package_type,
          t.renewal_date,
          statusLabel(t.delivery_status),
          platformLabel,
        ];
      });
      const ws = XLSX.utils.aoa_to_sheet([EMPLOYEE_TIER_TEMPLATE_HEADERS, ...rows]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'شرائح');
      XLSX.writeFile(wb, `شرائح_الشركة_${new Date().toISOString().slice(0, 10)}.xlsx`);
      toast({ title: 'تم تصدير Excel' });
    } catch (e) {
      logError('[EmployeeTiers] export failed', e);
      toast({ title: 'تعذر التصدير', variant: 'destructive' });
    } finally {
      setFileActionsLoading(false);
    }
  };

  const importTiersExcel = async (file: File) => {
    if (!perms.can_edit) {
      toast({ title: 'صلاحية غير كافية', description: 'ليس لديك صلاحية الاستيراد', variant: 'destructive' });
      return;
    }
    setFileActionsLoading(true);
    try {
      const buf = await file.arrayBuffer();
      const XLSX = await loadXlsx();
      const wb = XLSX.read(buf, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const matrix = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: '' });
      if (matrix.length < 2) {
        toast({ title: 'الملف فارغ أو لا يحتوي بيانات', variant: 'destructive' });
        return;
      }
      const actualHeaders = (matrix[0] || []).map((h) => toSafeText(h).trim());
      const headersMatch =
        actualHeaders.length === EMPLOYEE_TIER_TEMPLATE_HEADERS.length &&
        actualHeaders.every((h, i) => h === EMPLOYEE_TIER_TEMPLATE_HEADERS[i]);
      if (!headersMatch) {
        toast({
          title: 'هيكل الأعمدة غير مطابق للقالب',
          description: 'حمّل القالب من «ملفات» ولا تغيّر صف العناوين',
          variant: 'destructive',
        });
        return;
      }
      const { validatedRows, rowErrors } = collectTierImportValidatedRows(matrix, apps, employees);

      const results = await Promise.allSettled(
        validatedRows.map(({ payload }) => employeeTierService.createTier(payload))
      );
      const success = mergeTierImportFailures(results, validatedRows, rowErrors);
      await queryClient.invalidateQueries({ queryKey: ['employee-tiers', uid, 'page-data'] });
      toast({
        title: `تم استيراد ${success} شريحة`,
        description: rowErrors.length ? rowErrors.slice(0, 5).join(' · ') : undefined,
        variant: rowErrors.length && success === 0 ? 'destructive' : 'default',
      });
    } catch (e) {
      logError('[EmployeeTiers] import failed', e);
      toast({
        title: 'فشل الاستيراد',
        description: getErrorMessage(e, 'خطأ غير متوقع'),
        variant: 'destructive',
      });
    } finally {
      setFileActionsLoading(false);
    }
  };

  const printTiersTable = () => {
    if (filtered.length === 0) {
      toast({ title: 'لا يوجد بيانات للطباعة' });
      return;
    }
    const table = document.createElement('table');
    const thead = document.createElement('thead');
    const trh = document.createElement('tr');
    ['رقم الشريحة', 'المندوب', 'نوع الباقة', 'حالة التسليم', 'تاريخ التجديد', 'المنصات'].forEach((text) => {
      const th = document.createElement('th');
      th.textContent = text;
      trh.appendChild(th);
    });
    thead.appendChild(trh);
    table.appendChild(thead);
    const tbody = document.createElement('tbody');
    filtered.forEach((tier) => {
      const tr = document.createElement('tr');
      const platformLabel =
        apps.filter((a) => tier.app_ids.includes(a.id)).map((a) => a.name).join('، ') || '—';
      const cells = [
        tier.sim_number || '—',
        empMap[tier.employee_id]?.name || '—',
        tier.package_type,
        statusLabel(tier.delivery_status),
        tier.renewal_date,
        platformLabel,
      ];
      cells.forEach((text) => {
        const td = document.createElement('td');
        td.textContent = text;
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    printHtmlTable(table, {
      title: 'شرائح الشركة',
      subtitle: `${filtered.length} سجل — تاريخ الطباعة: ${formatStandardDateTime()}`,
    });
  };

  /* ── Stats ── */
  const total      = tiers.length;
  const delivered  = tiers.filter(r => r.delivery_status === STATUS_DELIVERED).length;
  const notDelivered = tiers.filter(r => r.delivery_status === STATUS_NOT_DELIVERED).length;
  const renewingSoon = tiers.filter(r => {
    const days = differenceInDays(parseISO(r.renewal_date), new Date());
    return days >= 0 && days <= 30;
  }).length;

  /* ── Stats ── */

  /* ══════════════ RENDER ══════════════ */
  return (
    <div className="flex flex-col flex-1 min-h-0 w-full gap-5" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <nav className="page-breadcrumb">
            <span>العمليات</span>
            <span className="page-breadcrumb-sep">/</span>
            <span>شرائح الشركة</span>
          </nav>
          <h1 className="page-title flex items-center gap-2"><Layers size={20} /> شرائح الشركة</h1>
        </div>
        <Button className="gap-2" onClick={() => setAddingRow(true)} disabled={addingRow || !perms.can_edit}>
          <Plus size={15} /> إضافة شريحة
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'إجمالي الشرائح', val: total, icon: <Layers size={17} className="text-primary" />, bg: 'bg-primary/10', color: 'text-foreground' },
          { label: 'مسلّمة', val: delivered, icon: <CheckCircle2 size={17} className="text-success" />, bg: 'bg-success/10', color: 'text-success' },
          { label: 'غير مسلّمة', val: notDelivered, icon: <AlertTriangle size={17} className="text-muted-foreground" />, bg: 'bg-muted', color: 'text-muted-foreground' },
          { label: 'تجديد قريب (≤30 يوم)', val: renewingSoon, icon: <Calendar size={17} className="text-warning" />, bg: 'bg-warning/10', color: 'text-warning' },
        ].map(s => (
          <div key={s.label} className="bg-card border border-border/50 p-4 flex items-center justify-between rounded-2xl">
            <div>
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className={`text-2xl font-bold mt-0.5 ${s.color}`}>{s.val}</p>
            </div>
            <div className={`w-9 h-9 rounded-lg ${s.bg} flex items-center justify-center`}>{s.icon}</div>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap w-full min-w-0">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="بحث بالاسم أو رقم الشريحة..." className="pr-9 h-9 w-full" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="flex gap-1">
          {selectedIds.size > 0 && (
            <Button variant="destructive" size="sm" onClick={bulkDelete} disabled={bulkDeleting || !perms.can_delete} className="h-9 px-3 gap-1">
              {bulkDeleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
              مسح ({selectedIds.size})
            </Button>
          )}
          {[{ v: 'all', l: 'الكل' }, { v: STATUS_DELIVERED, l: 'مسلّمة' }, { v: STATUS_NOT_DELIVERED, l: 'غير مسلّمة' }].map(s => (
            <button key={s.v} onClick={() => setStatusFilter(s.v)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${statusFilter === s.v ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-accent'}`}>
              {s.l}
            </button>
          ))}
        </div>
        <TableActions
          onDownloadTemplate={downloadTierTemplate}
          onImportFile={importTiersExcel}
          onExport={exportTiersExcel}
          onPrint={printTiersTable}
          loading={fileActionsLoading}
          disabled={loading}
          hideImport={!perms.can_edit}
          className="ms-auto shrink-0"
        />
        <span className="text-xs text-muted-foreground">السجلات: {filtered.length}</span>
      </div>

      {/* Table — يملأ المساحة المتبقية من ارتفاع الصفحة */}
      <div className="flex-1 flex flex-col min-h-0 w-full bg-card border border-border/50 shadow-sm rounded-2xl">
        {loading ? (
          <div className="flex-1 min-h-[12rem] flex items-center justify-center text-muted-foreground gap-2">
            <Loader2 size={18} className="animate-spin" /> جارٍ التحميل...
          </div>
        ) : (
          <div className="flex-1 min-h-0 overflow-x-auto w-full">
            <table className="w-full min-w-[920px] text-sm border-collapse table-fixed">
              <colgroup>
                <col className="w-[13%]" />
                <col className="w-[22%]" />
                <col className="w-[14%]" />
                <col className="w-[12%]" />
                <col className="w-[29%]" />
                <col className="w-[10%]" />
              </colgroup>
              <thead className="bg-muted/50">
                <tr>
                  <ThSort field="sim_number" label="رقم الشريحة" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
                  <ThSort field="employee_name" label="المندوب" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
                  <ThSort field="package_type" label="نوع الباقة" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
                  <ThSort field="delivery_status" label="الحالة" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
                  <th className="ta-th border-b border-border/50 min-w-0">المنصات</th>
                  <th className="ta-th border-b border-border/50">
                    <div className="flex items-center justify-center gap-2">
                      <input type="checkbox" className="rounded border-border" 
                             checked={filtered.length > 0 && selectedIds.size === filtered.length}
                             onChange={e => setSelectedIds(e.target.checked ? new Set(filtered.map(t => t.id)) : new Set())} />
                      <span>إجراءات</span>
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {/* ── Add new row ── */}
                {addingRow && (
                  <tr className="border-b border-border/30 bg-primary/5">
                    {/* sim_number */}
                    <td className="ta-td min-w-0 align-top">
                      <Input
                        value={newRow.sim_number ?? ''}
                        onChange={e => setNewRow(p => ({ ...p, sim_number: e.target.value }))}
                        placeholder="رقم الشريحة"
                        className="h-8 text-xs w-full min-w-0"
                        dir="ltr"
                      />
                    </td>
                    {/* employee */}
                    <td className="ta-td min-w-0 align-top">
                      <div className="w-full min-w-0">
                        <EmployeeSelect employees={employees} value={newRow.employee_id ?? ''} onChange={id => setNewRow(p => ({ ...p, employee_id: id }))} />
                      </div>
                    </td>
                    {/* package */}
                    <td className="ta-td min-w-0 align-top">
                      <Input
                        value={newRow.package_type ?? ''}
                        onChange={e => setNewRow(p => ({ ...p, package_type: e.target.value }))}
                        placeholder="نوع الباقة"
                        className="h-8 text-xs w-full min-w-0"
                      />
                    </td>
                    {/* status */}
                    <td className="ta-td min-w-0 align-top">
                      <select
                        value={newRow.delivery_status || STATUS_DELIVERED}
                        onChange={e => setNewRow(p => ({ ...p, delivery_status: e.target.value }))}
                        className="h-8 text-xs rounded-lg border border-border/50 bg-background px-2 w-full min-w-0 max-w-full"
                      >
                        <option value={STATUS_DELIVERED}>مسلّمة</option>
                          <option value={STATUS_NOT_DELIVERED}>غير مسلم</option>
                      </select>
                    </td>
                    {/* apps */}
                    <td className="ta-td min-w-0 align-top">
                      <AppMultiSelect apps={apps} selected={newRow.app_ids || []} onChange={ids => setNewRow(p => ({ ...p, app_ids: ids }))} />
                    </td>
                    {/* actions */}
                    <td className="ta-td align-top">
                      <div className="flex items-center justify-center gap-1">
                        <Button size="sm" onClick={saveNew} disabled={savingNew || !perms.can_edit} className="h-7 px-2 text-xs gap-1">
                          {savingNew ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                          حفظ
                        </Button>
                        <button aria-label="إلغاء الإضافة" onClick={() => setAddingRow(false)} className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-muted text-muted-foreground transition-colors">
                          <X size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )}

                {/* ── Data rows ── */}
                {filtered.length === 0 && !addingRow ? (
                  <tr>
                    <td colSpan={6} className="p-0 align-middle">
                      <div className="min-h-[min(48vh,26rem)] flex flex-col items-center justify-center gap-2 py-16 text-center text-muted-foreground">
                        <Layers size={32} className="opacity-20" />
                        <p className="text-sm">لا توجد شرائح — أضف شريحة جديدة</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filtered.map(tier => {
                    const row   = getRow(tier);
                    const dirty = isDirty(tier);

                    return (
                      <tr key={tier.id} className={`border-b border-border/30 hover:bg-muted/10 transition-colors ${dirty ? 'bg-primary/5' : ''}`}>
                        {/* sim_number */}
                        <td className="ta-td min-w-0 align-top">
                          <Input
                            value={row.sim_number ?? ''}
                            onChange={e => patchRow(tier.id, { sim_number: e.target.value })}
                            className="h-8 text-xs w-full min-w-0 font-mono"
                            dir="ltr"
                            placeholder="—"
                          />
                        </td>

                        {/* employee */}
                        <td className="ta-td min-w-0 align-top">
                          <div className="w-full min-w-0">
                            <EmployeeSelect
                              employees={employees}
                              value={row.employee_id}
                              onChange={id => {
                                const e = employees.find(x => x.id === id);
                                const newStatus = e?.sponsorship_status === 'absconded' ? STATUS_NOT_DELIVERED : row.delivery_status;
                                patchRow(tier.id, { employee_id: id, delivery_status: newStatus });
                              }}
                            />
                          </div>
                        </td>

                        {/* package_type */}
                        <td className="ta-td min-w-0 align-top">
                          <Input
                            value={row.package_type ?? ''}
                            onChange={e => patchRow(tier.id, { package_type: e.target.value })}
                            className="h-8 text-xs w-full min-w-0"
                            placeholder="نوع الباقة"
                          />
                        </td>


                        {/* status */}
                        <td className="ta-td min-w-0 align-top">
                          <select
                            value={row.delivery_status}
                            onChange={e => patchRow(tier.id, { delivery_status: e.target.value })}
                            className={`h-8 text-xs rounded-lg border px-2 w-full min-w-0 max-w-full font-medium ${row.delivery_status === STATUS_DELIVERED ? 'border-success/30 bg-success/5 text-success' : 'border-destructive/30 bg-destructive/10 text-destructive'}`}
                          >
                            <option value={STATUS_DELIVERED}>مسلّمة</option>
                            <option value={STATUS_NOT_DELIVERED}>غير مسلم</option>
                          </select>
                        </td>

                        {/* apps */}
                        <td className="ta-td min-w-0 align-top">
                          <AppMultiSelect
                            apps={apps}
                            selected={row.app_ids || []}
                            onChange={ids => patchRow(tier.id, { app_ids: ids })}
                          />
                        </td>

                        {/* actions */}
                        <td className="ta-td align-top">
                          <div className="flex items-center justify-center gap-1">
                            {dirty ? (
                              <>
                                <Button size="sm" onClick={() => saveRow(tier)} disabled={savingId === tier.id || !perms.can_edit} className="h-7 px-2 text-xs gap-1">
                                  {savingId === tier.id ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                                  حفظ
                                </Button>
                                <button aria-label="إلغاء التعديل" onClick={() => cancelRow(tier.id)} className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-muted text-muted-foreground transition-colors">
                                  <X size={13} />
                                </button>
                              </>
                            ) : (
                               <input type="checkbox" className="rounded border-border w-4 h-4 cursor-pointer" 
                                      checked={selectedIds.has(tier.id)}
                                      onChange={e => {
                                        const next = new Set(selectedIds);
                                        if (e.target.checked) next.add(tier.id); else next.delete(tier.id);
                                        setSelectedIds(next);
                                      }} />
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Absconded alert ── */}
      <AlertDialog open={!!abscondedAlert} onOpenChange={() => setAbscondedAlert(null)}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle size={18} /> تنبيه — مندوب هروب
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm leading-relaxed space-y-1.5">
              <p>المندوب <strong>{abscondedAlert?.name}</strong> تم تسجيله كـ <strong>هروب</strong>.</p>
              <div className="bg-muted rounded-lg p-3 mt-2 space-y-1 text-foreground">
                <p>🔢 رقم الشريحة: <span className="font-mono font-semibold">{abscondedAlert?.simNumber}</span></p>
                <p>🚗 رقم المركبة الأخيرة: <span className="font-semibold">{abscondedAlert?.vehiclePlate}</span></p>
              </div>
              <p className="text-muted-foreground text-xs mt-2">هل تريد تغيير حالة الشرائح المرتبطة إلى <strong>غير مسلّمة</strong>؟</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setAbscondedAlert(null)}>لاحقاً</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmAbsconded}
              disabled={!perms.can_edit || updatingAbsconded}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
            >
              {updatingAbsconded ? <Loader2 size={14} className="animate-spin ml-1" /> : null}
              تأكيد التغيير
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default EmployeeTiers;
