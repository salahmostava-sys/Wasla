import { formatStandardDateTime, formatCurrency } from '@shared/lib/formatters';

import type React from 'react';
import { Suspense, lazy, useEffect, useRef, useState, useCallback, type Dispatch, type SetStateAction } from 'react';
import { Search, Plus, FolderOpen, Edit, Trash2, Bike, FileText, ChevronDown, ChevronUp, Car } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Input } from '@shared/components/ui/input';
import { Button } from '@shared/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@shared/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@shared/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@shared/components/ui/alert-dialog';
import { vehicleService, VEHICLES_QUERY_MAX_ROWS } from '@services/vehicleService';
import { useToast } from '@shared/hooks/use-toast';
import { format, differenceInDays, parseISO } from 'date-fns';
import { usePermissions } from '@shared/hooks/usePermissions';
import { Skeleton } from '@shared/components/ui/skeleton';
import { useMotorcyclesData } from '@shared/hooks/useMotorcyclesData';
import { printHtmlTable } from '@shared/lib/printTable';
import { MOTORCYCLE_IO_COLUMNS } from '@shared/constants/excelSchemas';
import { logError } from '@shared/lib/logger';
import type { Vehicle, VehicleStatus } from '@modules/pages/motorcycles.shared';
import type { VehicleReportRow } from '@services/vehicleReportService';
import { getErrorMessage } from '@services/serviceError';

// ─── Types ────────────────────────────────────────────────────────────────────
import { loadXlsx } from '@modules/orders/utils/xlsx';

const loadVehicleFormModal = () => import('@modules/pages/MotorcyclesVehicleFormModal');

const LazyVehicleFormModal = lazy(() =>
  loadVehicleFormModal().then((module) => ({ default: module.VehicleFormModal })),
);

const prefetchVehicleFormModal = () => {
  loadVehicleFormModal();
};

const loadVehicleDetailsModal = () => import('@modules/pages/VehicleDetailsModal');

const LazyVehicleDetailsModal = lazy(() =>
  loadVehicleDetailsModal().then((module) => ({ default: module.VehicleDetailsModal })),
);



const prefetchXlsx = () => {
  loadXlsx();
};

const statusLabels: Record<string, string> = {
  active: 'نشطة',
  maintenance: 'صيانة',
  breakdown: 'خربان',
  rental: 'إيجار',
  ended: 'منتهي',
  inactive: 'غير نشطة',
};

// Smart status badge — considers current_rider for active vehicles
const SmartStatusBadge = ({ status, rider }: { status: VehicleStatus; rider?: string | null }) => {
  if (status === 'active') {
    return rider
      ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-primary/10 text-primary">🔑 متاح مع مندوب</span>
      : <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-success/10 text-success">✅ متاح بدون مندوب</span>;
  }
  if (status === 'maintenance') return <span className="badge-warning">🔧 صيانة</span>;
  if (status === 'breakdown') return <span className="badge-urgent">⚠️ خربان</span>;
  if (status === 'rental') return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">🚙 إيجار</span>;
  return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-muted text-muted-foreground">{statusLabels[status] || status}</span>;
};

const typeLabels: Record<string, string> = { motorcycle: 'دباب', car: 'سيارة' };

const ALL_STATUSES: VehicleStatus[] = ['active', 'maintenance', 'breakdown', 'rental', 'inactive', 'ended'];

const getDaysLeft = (date: string | null) => {
  if (!date) return null;
  return differenceInDays(parseISO(date), new Date());
};

const daysStyle = (days: number | null) => {
  if (days === null) return 'text-muted-foreground';
  if (days < 0) return 'text-destructive font-semibold';
  if (days <= 30) return 'text-destructive font-semibold';
  if (days <= 60) return 'text-yellow-600 dark:text-yellow-400 font-medium';
  return 'text-muted-foreground';
};

const daysLabel = (days: number | null) => {
  if (days === null) return '—';
  if (days < 0) return `منتهي منذ ${Math.abs(days)} يوم`;
  return `${days} يوم`;
};

const _authBadge = (date: string | null) => {
  if (!date) return null;
  const days = getDaysLeft(date);
  if (days === null) return null;
  if (days < 0) return <span className="badge-urgent">منتهي</span>;
  if (days <= 30) return <span className="badge-warning">ينتهي قريباً</span>;
  return <span className="badge-success">ساري</span>;
};




const VEHICLE_TEMPLATE_HEADERS = MOTORCYCLE_IO_COLUMNS.map((c) => c.label);

const toSafeText = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return '';
  }
};

const parseBool = (v: unknown): boolean => {
  if (typeof v === 'boolean') return v;
  const s = toSafeText(v).trim().toLowerCase();
  return s === '1' || s === 'true' || s === 'yes' || s === 'نعم' || s === 'y';
};

const parseVehicleType = (v: unknown): 'motorcycle' | 'car' => {
  const raw = toSafeText(v).trim();
  const s = raw.toLowerCase();
  if (s === 'car' || s === 'سيارة') return 'car';
  if (
    s === 'motorcycle'
    || raw === 'موتوسيكل'
    || raw === 'دباب'
    || raw === 'دراجة'
    || raw === 'موتور'
    || s === 'bike'
  ) return 'motorcycle';
  return 'motorcycle';
};

const parseVehicleStatus = (v: unknown): VehicleStatus => {
  const raw = toSafeText(v).trim();
  const s = raw.toLowerCase();
  const map: Record<string, VehicleStatus> = {
    active: 'active', نشطة: 'active', نشط: 'active',
    maintenance: 'maintenance', صيانة: 'maintenance',
    breakdown: 'breakdown', خربان: 'breakdown',
    rental: 'rental', إيجار: 'rental',
    ended: 'ended', منتهي: 'ended',
    inactive: 'inactive', 'غير نشطة': 'inactive',
  };
  if (map[s]) return map[s];
  if (ALL_STATUSES.includes(raw as VehicleStatus)) return raw as VehicleStatus;
  return 'active';
};

const cell = (row: Record<string, unknown>, ...keys: string[]) => {
  for (const k of keys) {
    const v = row[k];
    if (v !== undefined && v !== null && toSafeText(v).trim() !== '') return v;
  }
  return undefined;
};

const normalizeHeaderKey = (h: string) =>
  toSafeText(h)
    .trim()
    .replaceAll('\uFEFF', '')
    .replaceAll(/\s+/g, ' ')
    .toLowerCase();

function findColIndex(normToIdx: Map<string, number>, ...candidates: string[]): number {
  for (const c of candidates) {
    const idx = normToIdx.get(normalizeHeaderKey(c));
    if (idx !== undefined) return idx;
  }
  return -1;
}

/** مطابقة مرنة للرؤوس — لا يشترط ترتيب الأعمدة كما في القالب */
function buildMotorcycleImportColumnMap(
  headerRow: string[],
): { byKey: Record<string, number> } | { error: string } {
  const normToIdx = new Map<string, number>();
  headerRow.forEach((raw, i) => {
    const n = normalizeHeaderKey(raw);
    if (n && !normToIdx.has(n)) normToIdx.set(n, i);
  });
  const plateIdx = findColIndex(normToIdx, 'رقم اللوحة ar', 'رقم اللوحة', 'plate_number');
  if (plateIdx < 0) {
    return {
      error: 'الصف الأول يجب أن يضم عمود رقم اللوحة (مثل «رقم اللوحة ar» أو «رقم اللوحة»).',
    };
  }
  const byKey: Record<string, number> = {};
  for (const col of MOTORCYCLE_IO_COLUMNS) {
    if (col.key === 'plate_number') {
      byKey[col.key] = plateIdx;
      continue;
    }
    const extras: string[] = [];
    if (col.key === 'current_rider') {
      extras.push('المندوب الحالي', 'المندوب', 'current_rider', 'rider', 'المندوب الحالي للمركبة');
    }
    if (col.key === 'has_fuel_chip') {
      extras.push('شريحة البنزين', 'fuel chip', 'has fuel chip', 'has_fuel_chip');
    }
    if (col.key === 'type') extras.push('نوع المركبة', 'vehicle type');
    const idx = findColIndex(normToIdx, col.label, col.key.replaceAll('_', ' '), col.key, ...extras);
    byKey[col.key] = idx;
  }
  return { byKey };
}

const validateMotorcycleRow = (row: Record<string, unknown>): { isValid: boolean; plate: string | null } => {
  const plate = cell(row, 'plate_number', 'رقم اللوحة ar', 'رقم اللوحة');
  if (!plate) return { isValid: false, plate: null };
  const normalized = toSafeText(plate).trim();
  if (!normalized) return { isValid: false, plate: null };
  return { isValid: true, plate: normalized };
};

const mapRowToVehiclePayload = (row: Record<string, unknown>, plate: string) => {
  const y = cell(row, 'year', 'سنة الصنع');
  let yearNum = Number.NaN;
  if (y !== undefined) yearNum = Number.parseInt(toSafeText(y), 10);
  const plateEn = cell(row, 'plate_number_en', 'رقم اللوحة en', 'لوحة en');
  const toNullableText = (value: unknown, trim = false): string | null => {
    if (value === undefined || value === null) return null;
    const text = trim ? toSafeText(value).trim() : toSafeText(value);
    return text || null;
  };
  const brandValue = cell(row, 'brand', 'الماركة');
  const modelValue = cell(row, 'model', 'الموديل');
  const insuranceExpiryValue = cell(row, 'insurance_expiry', 'انتهاء التأمين');
  const registrationExpiryValue = cell(row, 'registration_expiry', 'انتهاء التسجيل');
  const authorizationExpiryValue = cell(row, 'authorization_expiry', 'انتهاء التفويض');
  const chassisValue = cell(row, 'chassis_number', 'رقم الهيكل');
  const serialValue = cell(row, 'serial_number', 'الرقم التسلسلي');
  const notesValue = cell(row, 'notes', 'ملاحظات');

  return {
    plate_number: plate,
    plate_number_en: toNullableText(plateEn, true),
    type: parseVehicleType(cell(row, 'type', 'النوع')),
    brand: toNullableText(brandValue),
    model: toNullableText(modelValue),
    year: Number.isFinite(yearNum) ? yearNum : null,
    status: parseVehicleStatus(cell(row, 'status', 'الحالة')),
    has_fuel_chip: parseBool(cell(row, 'has_fuel_chip', 'شريحة البنزين', 'fuel_chip')),
    insurance_expiry: toNullableText(insuranceExpiryValue),
    registration_expiry: toNullableText(registrationExpiryValue),
    authorization_expiry: toNullableText(authorizationExpiryValue),
    chassis_number: toNullableText(chassisValue, true),
    serial_number: toNullableText(serialValue, true),
    notes: toNullableText(notesValue),
  };
};

type MotorcycleColumnMap = { byKey: Record<string, number> };

function buildMotorcycleRowsFromMatrix(
  matrix: unknown[][],
  byKey: MotorcycleColumnMap['byKey'],
): Record<string, unknown>[] {
  return matrix.slice(1).map((line) => {
    const values = Array.isArray(line) ? line : [];
    const row: Record<string, unknown> = {};
    for (const col of MOTORCYCLE_IO_COLUMNS) {
      const i = byKey[col.key];
      row[col.key] = i >= 0 && i < values.length ? values[i] : '';
    }
    return row;
  });
}

function collectMotorcycleImportPayloads(rows: Record<string, unknown>[]): {
  payloads: ReturnType<typeof mapRowToVehiclePayload>[];
  skippedRows: number;
} {
  let skippedRows = 0;
  const payloads: ReturnType<typeof mapRowToVehiclePayload>[] = [];
  for (const row of rows) {
    const validation = validateMotorcycleRow(row);
    if (!validation.isValid || !validation.plate) {
      skippedRows++;
      continue;
    }
    payloads.push(mapRowToVehiclePayload(row, validation.plate));
  }
  return { payloads, skippedRows };
}

async function upsertMotorcyclePayloads(
  payloads: ReturnType<typeof mapRowToVehiclePayload>[],
): Promise<{ success: number; failed: number }> {
  let success = 0;
  let failed = 0;
  const results = await Promise.allSettled(payloads.map((payload) => vehicleService.upsert(payload)));
  for (const result of results) {
    if (result.status === 'fulfilled') success++;
    else failed++;
  }
  return { success, failed };
}

async function runMotorcycleXlsxImportFile(
  file: File,
  toast: ReturnType<typeof useToast>['toast'],
  setFileIoHint: Dispatch<SetStateAction<{ kind: 'ok' | 'err'; message: string } | null>>,
  refetchVehicles: () => Promise<unknown>,
): Promise<void> {
  try {
    const XLSX = await loadXlsx();
    const bytes = new Uint8Array(await file.arrayBuffer());
    const wb = XLSX.read(bytes, { type: 'array' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const matrix = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: '' });
    if (matrix.length < 2) {
      const msg = 'الملف لا يحتوي صف عناوين وصف بيانات.';
      toast({ title: 'ملف غير صالح', description: msg, variant: 'destructive' });
      setFileIoHint({ kind: 'err', message: msg });
      return;
    }
    const actualHeaders = (matrix[0] || []).map((h) => toSafeText(h).trim());
    const mapped = buildMotorcycleImportColumnMap(actualHeaders);
    if ('error' in mapped) {
      toast({
        title: 'تعذّر قراءة الأعمدة',
        description: mapped.error,
        variant: 'destructive',
      });
      setFileIoHint({ kind: 'err', message: mapped.error });
      return;
    }
    const { byKey } = mapped;
    const rows = buildMotorcycleRowsFromMatrix(matrix, byKey);
    const { payloads: validPayloads, skippedRows: skippedInvalid } = collectMotorcycleImportPayloads(rows);
    const { success, failed: upsertFailed } = await upsertMotorcyclePayloads(validPayloads);
    const skipped = skippedInvalid + upsertFailed;
    const okMsg = (() => {
      if (success > 0) {
        const skippedNote = skipped > 0 ? ` (تُرك ${skipped} صفاً بلا لوحة صالحة)` : '';
        return `تم استيراد ${success} مركبة بنجاح${skippedNote}.`;
      }
      return 'لم يُستورد أي صف — تأكد من وجود أرقام لوحات في العمود.';
    })();
    toast({ title: success > 0 ? `تم استيراد ${success} مركبة ✅` : 'لم يُستورد شيء', description: skipped > 0 || success === 0 ? okMsg : undefined });
    setFileIoHint({ kind: success > 0 ? 'ok' : 'err', message: okMsg });
    await refetchVehicles();
  } catch (err) {
    logError('[Motorcycles] import failed', err);
    const message = getErrorMessage(err, 'فشل قراءة الملف أو الاتصال بالخادم');
    toast({ title: 'فشل الاستيراد', description: message, variant: 'destructive' });
    setFileIoHint({ kind: 'err', message });
  }
}

// ─── Main Component ───────────────────────────────────────────────────────────
const Motorcycles = () => {
  const { toast } = useToast();
  const { permissions } = usePermissions('vehicles');
  const [data, setData] = useState<VehicleReportRow[]>([]);
  const {
    data: vehiclesData = [],
    isLoading: loading,
    error: vehiclesError,
    refetch: refetchVehicles,
  } = useMotorcyclesData();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [editVehicle, setEditVehicle] = useState<Vehicle | null>(null);
  const [fileIoHint, setFileIoHint] = useState<{ kind: 'ok' | 'err'; message: string } | null>(null);
  const [deleteVehicle, setDeleteVehicle] = useState<Vehicle | null>(null);
  const [deletingVehicle, setDeletingVehicle] = useState(false);
  const [detailsVehicle, setDetailsVehicle] = useState<Vehicle | null>(null);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const toggleRow = (id: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };


  const importRef = useRef<HTMLInputElement>(null);
  const tableRef = useRef<HTMLTableElement>(null);
  const closeForm = () => {
    setShowForm(false);
    setEditVehicle(null);
  };
  const openCreateForm = () => {
    prefetchVehicleFormModal();
    setEditVehicle(null);
    setShowForm(true);
  };
  const openEditForm = (vehicle: Vehicle) => {
    prefetchVehicleFormModal();
    setEditVehicle(vehicle);
    setShowForm(true);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileIoHint(null);
    runMotorcycleXlsxImportFile(file, toast, setFileIoHint, refetchVehicles).catch(() => {});
    e.target.value = '';
  };

  const handleTemplate = async () => {
    const XLSX = await loadXlsx();
    const ws = XLSX.utils.aoa_to_sheet([VEHICLE_TEMPLATE_HEADERS.slice()]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'vehicles');
    XLSX.writeFile(wb, 'template_vehicles.xlsx');
  };

  // Local state mirrors React Query — kept because filtered/stats derive from `data` and
  // removing it would require restructuring the component to use vehiclesData directly.
  useEffect(() => {
    setData(vehiclesData);
  }, [vehiclesData]);

  useEffect(() => {
    if (!vehiclesError) return;
    const message =
      vehiclesError instanceof Error
        ? vehiclesError.message
        : 'حدث خطأ غير متوقع أثناء تحميل المركبات';
    toast({ title: 'خطأ في التحميل', description: message, variant: 'destructive' });
  }, [vehiclesError, toast]);

  const filtered = data.filter(v => {
    const q = search.toLowerCase();
    const matchSearch = !q || v.plate_number.toLowerCase().includes(q) || (v.brand ?? '').toLowerCase().includes(q) || (v.model ?? '').toLowerCase().includes(q);
    const matchStatus = statusFilter === 'all' || v.status === statusFilter;
    const matchType = typeFilter === 'all' || v.type === typeFilter;
    return matchSearch && matchStatus && matchType;
  });

  // Summary stats
  const stats = {
    total: data.length,
    active: data.filter(v => v.status === 'active').length,
    maintenance: data.filter(v => v.status === 'maintenance').length,
    breakdown: data.filter(v => v.status === 'breakdown').length,
  };

  const exportCell = (v: Vehicle, key: (typeof MOTORCYCLE_IO_COLUMNS)[number]['key']): string | number => {
    switch (key) {
      case 'current_rider': return v.current_rider ?? '';
      case 'type': return typeLabels[v.type] ?? v.type;
      case 'status': return statusLabels[v.status] ?? v.status;
      case 'has_fuel_chip': return v.has_fuel_chip ? 'نعم' : 'لا';
      case 'plate_number': return v.plate_number;
      case 'plate_number_en': return v.plate_number_en ?? '';
      case 'brand': return v.brand ?? '';
      case 'model': return v.model ?? '';
      case 'year': return v.year ?? '';
      case 'serial_number': return v.serial_number ?? '';
      case 'chassis_number': return v.chassis_number ?? '';
      case 'notes': return v.notes ?? '';
      case 'insurance_expiry': return v.insurance_expiry ?? '';
      case 'registration_expiry': return v.registration_expiry ?? '';
      case 'authorization_expiry': return v.authorization_expiry ?? '';
      default: return '';
    }
  };

  const handleExport = async () => {
    const XLSX = await loadXlsx();
    const rows = filtered.map((v) => MOTORCYCLE_IO_COLUMNS.map((col) => exportCell(v, col.key)));
    const ws = XLSX.utils.aoa_to_sheet([VEHICLE_TEMPLATE_HEADERS, ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'المركبات');
    XLSX.writeFile(wb, `motorcycles_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
  };

  const handlePrint = () => {
    const table = tableRef.current;
    if (!table) return;
    printHtmlTable(table, {
      title: 'بيانات الدبابات',
      subtitle: `المجموع: ${filtered.length} مركبة — ${formatStandardDateTime()}`,
    });
  };

  const confirmDeleteVehicle = useCallback(async () => {
    if (!deleteVehicle) return;
    setDeletingVehicle(true);
    try {
      await vehicleService.delete(deleteVehicle.id);
      toast({ title: 'تم حذف المركبة' });
      refetchVehicles();
    } catch (e) {
      logError('[Motorcycles] delete failed', e);
      const message = getErrorMessage(e, 'حدث خطأ غير متوقع');
      toast({ title: 'خطأ في الحذف', description: message, variant: 'destructive' });
    } finally {
      setDeletingVehicle(false);
      setDeleteVehicle(null);
    }
  }, [deleteVehicle, toast, refetchVehicles]);

  return (
    <div className="space-y-4" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <nav className="page-breadcrumb">
            <span>العمليات</span>
            <span className="page-breadcrumb-sep">/</span>
            <span className="text-foreground font-medium">بيانات الدبابات</span>
          </nav>
          <h1 className="page-title">بيانات الدبابات</h1>
        </div>
        <div className="flex gap-2">
          <input ref={importRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleImport} />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 h-9"
                onMouseEnter={prefetchXlsx}
                onFocus={prefetchXlsx}
              ><FolderOpen size={14} /> ملفات</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => { handleExport(); }}>📊 تصدير Excel</DropdownMenuItem>
              <DropdownMenuItem onClick={() => { handleTemplate(); }}>📋 تحميل قالب الاستيراد</DropdownMenuItem>
              {permissions.can_edit && (
                <DropdownMenuItem onClick={() => { prefetchXlsx(); importRef.current?.click(); }}>
                  ⬆️ استيراد Excel
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handlePrint}>🖨️ طباعة الجدول</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          {permissions.can_edit && (
            <Button
              className="gap-2"
              onClick={openCreateForm}
              onMouseEnter={prefetchVehicleFormModal}
              onFocus={prefetchVehicleFormModal}
            >
              <Plus size={16} /> إضافة مركبة
            </Button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'إجمالي المركبات', value: stats.total, icon: '🏍️', cls: 'text-foreground' },
          { label: 'نشطة', value: stats.active, icon: '✅', cls: 'text-success' },
          { label: 'في الصيانة', value: stats.maintenance, icon: '🔧', cls: 'text-yellow-600' },
          { label: 'أعطال', value: stats.breakdown, icon: '⚠️', cls: 'text-destructive' },
        ].map(s => (
          <div key={s.label} className="bg-card border border-border p-4 rounded-2xl">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xl">{s.icon}</span>
              <span className="text-xs text-muted-foreground">{s.label}</span>
            </div>
            <p className={`text-2xl font-black ${s.cls}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[180px]">
          <Search size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="بحث برقم اللوحة، الماركة..." className="pr-9 h-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36 h-9"><SelectValue placeholder="الحالة" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">جميع الحالات</SelectItem>
            {ALL_STATUSES.map(s => <SelectItem key={s} value={s}>{statusLabels[s]}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-28 h-9"><SelectValue placeholder="النوع" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">الكل</SelectItem>
            <SelectItem value="motorcycle">دباب</SelectItem>
            <SelectItem value="car">سيارة</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground ms-auto">{filtered.length} مركبة</span>
      </div>

      {fileIoHint && (
        <output
          className={`rounded-xl border px-3 py-2.5 text-sm ${
            fileIoHint.kind === 'err'
              ? 'border-destructive/40 bg-destructive/10 text-destructive'
              : 'border-success/40 bg-success/10 text-success'
          }`}
        >
          {fileIoHint.kind === 'err' ? '⚠️ ' : '✓ '}
          {fileIoHint.message}
        </output>
      )}

      {data.length >= VEHICLES_QUERY_MAX_ROWS && (
        <p className="text-xs text-amber-700 dark:text-amber-400/90 bg-amber-500/10 border border-amber-500/25 rounded-lg px-3 py-2">
          يُحمّل حتى {VEHICLES_QUERY_MAX_ROWS.toLocaleString('en-US')} مركبة في الصفحة. إذا كان لديك أكثر، قسّم الاستيراد أو راجع تقارير أخرى.
        </p>
      )}

            {/* Table & Row-based View */}
      <div className="ta-table-wrap">
        {(() => {
          if (loading) {
            return (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, idx) => (
                  <Skeleton key={idx} className="h-16 w-full rounded-2xl" />
                ))}
              </div>
            );
          }
          if (filtered.length === 0) {
            return (
              <div className="text-center py-16 text-muted-foreground bg-card border border-border/60 rounded-xl">
                <Bike size={40} className="mx-auto mb-3 opacity-30" />
                <p className="font-semibold">لا توجد مركبات</p>
                <p className="text-xs">أضف مركبة جديدة للبدء</p>
              </div>
            );
          }
          return (
            <div className="space-y-3">
              {filtered.map((v, _idx) => {
                const isExpanded = expandedRows.has(v.id);
                const insDays = getDaysLeft(v.insurance_expiry);
                const regDays = getDaysLeft(v.registration_expiry);
                const authDays = getDaysLeft(v.authorization_expiry);
                const statusBadge = <SmartStatusBadge status={v.status} rider={v.current_rider} />;

                const uniqueTypes = Array.from(new Set((v.maintenance_logs ?? []).map((l) => l.type)));
                const typesText = uniqueTypes.join('، ') || 'لا توجد صيانات مسجلة';
                const totalCost = v.total_maintenance_cost ?? 0;

                return (
                  <div
                    key={v.id}
                    className="bg-card border border-border/60 rounded-xl overflow-hidden shadow-sm hover:border-border transition-colors text-right"
                  >
                    <div className="flex flex-col md:flex-row md:items-center justify-between w-full p-4 gap-4">
                      {/* 1. Vehicle info & Plate number */}
                      <button
                        type="button"
                        onClick={() => toggleRow(v.id)}
                        className="flex items-center gap-3 text-right min-w-[180px] shrink-0"
                      >
                        <div
                          className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                            v.type === 'motorcycle'
                              ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                              : 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400'
                          }`}
                        >
                          {v.type === 'motorcycle' ? <Bike size={20} /> : <Car size={20} />}
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="font-bold text-base leading-tight hover:text-primary transition-colors">
                            {v.plate_number}
                          </span>
                          <span className="text-xs text-muted-foreground mt-0.5">
                            {v.brand ? `${v.brand} ${v.model ?? ''}` : typeLabels[v.type]}
                          </span>
                        </div>
                      </button>

                      {/* 2. Repairs summary */}
                      <div className="flex-1 min-w-0 md:px-4">
                        <span className="text-[10px] text-muted-foreground block mb-0.5">التصليحات والصيانة</span>
                        <span className="text-sm font-semibold text-foreground truncate block" title={typesText}>
                          {typesText}
                        </span>
                      </div>

                      {/* 3. Rider & Badges */}
                      <div className="flex flex-wrap items-center gap-3 min-w-[200px] md:justify-end">
                        {v.current_rider ? (
                          <div className="text-xs">
                            <span className="text-muted-foreground">المندوب: </span>
                            <Link
                              to={`/vehicle-assignment?search=${encodeURIComponent(v.current_rider)}`}
                              className="font-semibold text-primary hover:underline"
                            >
                              {v.current_rider}
                            </Link>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground/50">بدون مندوب</span>
                        )}
                        {statusBadge}
                        {v.has_fuel_chip && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-success/10 text-success">
                            ⛽ شريحة
                          </span>
                        )}
                      </div>

                      {/* 4. Cost and Actions */}
                      <div className="flex items-center justify-between md:justify-end gap-4 shrink-0 border-t md:border-t-0 pt-3 md:pt-0 border-border/30">
                        <div className="text-right pl-2">
                          <span className="text-[10px] text-muted-foreground block">تكلفة الصيانة</span>
                          <span className="font-bold text-base text-rose-600 dark:text-rose-400">
                            {formatCurrency(totalCost)}
                          </span>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setDetailsVehicle(v)}
                            className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                            title="البيانات والمستندات"
                          >
                            <FileText size={15} />
                          </button>
                          {permissions.can_edit && (
                            <button
                              type="button"
                              onClick={() => openEditForm(v)}
                              className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                              title="تعديل"
                            >
                              <Edit size={15} />
                            </button>
                          )}
                          {permissions.can_delete && (
                            <button
                              type="button"
                              onClick={() => setDeleteVehicle(v)}
                              className="p-1.5 rounded-lg hover:bg-destructive/10 transition-colors text-muted-foreground hover:text-destructive"
                              title="حذف"
                            >
                              <Trash2 size={15} className="text-destructive" />
                            </button>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() => toggleRow(v.id)}
                          className="p-1 rounded-lg hover:bg-muted transition-colors text-muted-foreground shrink-0"
                        >
                          {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                        </button>
                      </div>
                    </div>

                    {/* Expanded details */}
                    {isExpanded && (
                      <div className="border-t border-border/40 bg-muted/15 p-4 space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          {/* Specifications */}
                          <div className="bg-card border border-border/50 rounded-xl p-3 space-y-2">
                            <h4 className="text-xs font-bold text-foreground border-b border-border/30 pb-1 flex items-center gap-1">
                              ⚙️ تفاصيل ومواصفات المركبة
                            </h4>
                            <div className="text-xs space-y-1.5 text-muted-foreground">
                              <div className="flex justify-between">
                                <span>الماركة والموديل:</span>
                                <span className="text-foreground font-semibold">
                                  {v.brand || '—'} / {v.model || '—'}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span>سنة الصنع:</span>
                                <span className="text-foreground font-semibold">{v.year || '—'}</span>
                              </div>
                              <div className="flex justify-between">
                                <span>الرقم التسلسلي:</span>
                                <span className="text-foreground font-mono" dir="ltr">
                                  {v.serial_number || '—'}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span>رقم الهيكل:</span>
                                <span className="text-foreground font-mono" dir="ltr">
                                  {v.chassis_number || '—'}
                                </span>
                              </div>
                              {v.notes && (
                                <div className="border-t border-border/30 pt-1.5 mt-1.5">
                                  <span className="block text-[10px] text-muted-foreground">ملاحظات المركبة:</span>
                                  <span className="text-foreground text-[11px] leading-relaxed block mt-0.5">
                                    {v.notes}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Documents Status */}
                          <div className="bg-card border border-border/50 rounded-xl p-3 space-y-2">
                            <h4 className="text-xs font-bold text-foreground border-b border-border/30 pb-1 flex items-center gap-1">
                              🛡️ صلاحية الوثائق
                            </h4>
                            <div className="space-y-2.5">
                              <div className="flex items-center justify-between text-xs">
                                <span className="text-muted-foreground">التأمين:</span>
                                {v.insurance_expiry ? (
                                  <div className={`text-left ${daysStyle(insDays)}`}>
                                    <div>{format(parseISO(v.insurance_expiry), 'yyyy/MM/dd')}</div>
                                    <div className="text-[10px] opacity-80">{daysLabel(insDays)}</div>
                                  </div>
                                ) : (
                                  <span className="text-muted-foreground/50">—</span>
                                )}
                              </div>
                              <div className="flex items-center justify-between text-xs">
                                <span className="text-muted-foreground">التسجيل (الاستمارة):</span>
                                {v.registration_expiry ? (
                                  <div className={`text-left ${daysStyle(regDays)}`}>
                                    <div>{format(parseISO(v.registration_expiry), 'yyyy/MM/dd')}</div>
                                    <div className="text-[10px] opacity-80">{daysLabel(regDays)}</div>
                                  </div>
                                ) : (
                                  <span className="text-muted-foreground/50">—</span>
                                )}
                              </div>
                              <div className="flex items-center justify-between text-xs">
                                <span className="text-muted-foreground">التفويض:</span>
                                {v.authorization_expiry ? (
                                  <div className={`text-left ${daysStyle(authDays)}`}>
                                    <div>{format(parseISO(v.authorization_expiry), 'yyyy/MM/dd')}</div>
                                    <div className="text-[10px] opacity-80">{daysLabel(authDays)}</div>
                                  </div>
                                ) : (
                                  <span className="text-muted-foreground/50">—</span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Maintenance History */}
                          <div className="bg-card border border-border/50 rounded-xl p-3 space-y-2">
                            <h4 className="text-xs font-bold text-foreground border-b border-border/30 pb-1 flex items-center gap-1">
                              🔧 سجل الصيانات الأخيرة
                            </h4>
                            <div className="max-h-36 overflow-y-auto space-y-2 pr-1">
                              {v.maintenance_logs && v.maintenance_logs.length > 0 ? (
                                v.maintenance_logs.slice(0, 5).map((log) => (
                                  <div
                                    key={log.id}
                                    className="text-xs border-b border-border/30 pb-1.5 last:border-0 last:pb-0"
                                  >
                                    <div className="flex justify-between items-center mb-0.5">
                                      <span className="font-semibold text-foreground">{log.type}</span>
                                      <span className="text-rose-600 font-bold">
                                        {formatCurrency(log.total_cost)}
                                      </span>
                                    </div>
                                    <div className="flex justify-between text-[10px] text-muted-foreground">
                                      <span>
                                        {new Date(log.maintenance_date).toLocaleDateString('ar-SA')}
                                      </span>
                                      {log.notes && (
                                        <span className="truncate max-w-[120px]">{log.notes}</span>
                                      )}
                                    </div>
                                  </div>
                                ))
                              ) : (
                                <span className="text-xs text-muted-foreground/50 block text-center py-4">
                                  لا توجد سجلات صيانة سابقة
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })()}

        {/* Hidden Table for Printing */}
        <div className="hidden">
          <table ref={tableRef} className="w-full min-w-[2200px] table-fixed">
            <colgroup>
              <col style={{ width: 40 }} />
              <col style={{ width: 108 }} />
              <col style={{ width: 108 }} />
              <col style={{ width: 92 }} />
              <col style={{ width: 100 }} />
              <col style={{ width: 100 }} />
              <col style={{ width: 72 }} />
              <col style={{ width: 132 }} />
              <col style={{ width: 140 }} />
              <col style={{ width: 300 }} />
              <col style={{ width: 240 }} />
              <col style={{ width: 168 }} />
              <col style={{ width: 104 }} />
              <col style={{ width: 118 }} />
              <col style={{ width: 118 }} />
              <col style={{ width: 118 }} />
              <col style={{ width: 88 }} />
            </colgroup>
            <thead className="ta-thead">
              <tr>
                <th className="ta-th">#</th>
                <th className="ta-th">رقم اللوحة ar</th>
                <th className="ta-th">رقم اللوحة en</th>
                <th className="ta-th">النوع</th>
                <th className="ta-th">الماركة</th>
                <th className="ta-th">الموديل</th>
                <th className="ta-th">سنة الصنع</th>
                <th className="ta-th">الرقم التسلسلي</th>
                <th className="ta-th">رقم الهيكل</th>
                <th className="ta-th min-w-[18rem]">ملاحظات</th>
                <th className="ta-th min-w-[14rem]">المندوب الحالي</th>
                <th className="ta-th">الحالة</th>
                <th className="ta-th">⛽ شريحة البنزين</th>
                <th className="ta-th">انتهاء التأمين</th>
                <th className="ta-th">انتهاء التسجيل</th>
                <th className="ta-th">انتهاء التفويض</th>
                <th className="ta-th">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((v, idx) => {
                return (
                  <tr key={v.id} className="border-b border-border/30">
                    <td>{idx + 1}</td>
                    <td>{v.plate_number}</td>
                    <td>{v.plate_number_en || '—'}</td>
                    <td>{typeLabels[v.type]}</td>
                    <td>{v.brand || '—'}</td>
                    <td>{v.model || '—'}</td>
                    <td>{v.year ?? '—'}</td>
                    <td>{v.serial_number || '—'}</td>
                    <td>{v.chassis_number || '—'}</td>
                    <td>{v.notes || '—'}</td>
                    <td>{v.current_rider || '—'}</td>
                    <td>{statusLabels[v.status]}</td>
                    <td>{v.has_fuel_chip ? 'نعم' : 'لا'}</td>
                    <td>{v.insurance_expiry || '—'}</td>
                    <td>{v.registration_expiry || '—'}</td>
                    <td>{v.authorization_expiry || '—'}</td>
                    <td>—</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {showForm && (
        <Suspense fallback={null}>
          <LazyVehicleFormModal
            open={showForm}
            onClose={closeForm}
            onSaved={() => refetchVehicles().catch(() => {})}
            editVehicle={editVehicle}
          />
        </Suspense>
      )}

      {detailsVehicle && (
        <Suspense fallback={null}>
          <LazyVehicleDetailsModal
            vehicle={detailsVehicle}
            canEdit={permissions.can_edit}
            canDelete={permissions.can_delete}
            onClose={() => setDetailsVehicle(null)}
          />
        </Suspense>
      )}

      <AlertDialog open={!!deleteVehicle} onOpenChange={(open) => { if (!open) setDeleteVehicle(null); }}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>تأكيد الحذف</AlertDialogTitle>
            <AlertDialogDescription>
              هل أنت متأكد من حذف المركبة <span className="font-semibold text-foreground font-mono">{deleteVehicle?.plate_number}</span>؟
              {' '}لا يمكن التراجع عن هذا الإجراء.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteVehicle}
              disabled={deletingVehicle}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletingVehicle ? '⏳ جاري الحذف...' : 'حذف'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Motorcycles;


