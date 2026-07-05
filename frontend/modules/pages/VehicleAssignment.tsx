import { useState, useEffect, useRef } from 'react';
import { Search, Plus, RotateCcw, ClipboardList, CheckCircle, Clock, FolderOpen, AlertCircle } from 'lucide-react';
import { Input } from '@shared/components/ui/input';
import { Button } from '@shared/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@shared/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@shared/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@shared/components/ui/dropdown-menu';
import { vehicleService, VEHICLES_QUERY_MAX_ROWS } from '@services/vehicleService';
import { useToast } from '@shared/hooks/use-toast';
import { loadXlsx } from '@modules/orders/utils/xlsx';
import { format } from 'date-fns';
import { usePermissions } from '@shared/hooks/usePermissions';
import { Skeleton } from '@shared/components/ui/skeleton';
import { useVehicleAssignmentData } from '@shared/hooks/useVehicleAssignmentData';
import { logError } from '@shared/lib/logger';
import { printHtmlTable } from '@shared/lib/printTable';
import { getErrorMessage } from '@services/serviceError';

type Vehicle = {
  id: string;
  plate_number: string;
  type: 'motorcycle' | 'car';
  brand: string | null;
  model: string | null;
  status: string;
};

type Employee = { id: string; name: string };

type Assignment = {
  id: string;
  vehicle_id: string;
  employee_id: string;
  start_date: string;
  start_at: string | null;
  end_date: string | null;
  returned_at: string | null;
  notes: string | null;
  reason: string | null;
  vehicles?: { plate_number: string; type: string } | null;
  employees?: { name: string } | null;
};

const calcDuration = (start: string | null, end: string | null) => {
  if (!start) return '—';
  const s = new Date(start);
  const e = end ? new Date(end) : new Date();
  const diffMs = e.getTime() - s.getTime();
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  if (days > 0) return `${days} يوم ${hours} ساعة`;
  return `${hours} ساعة`;
};

// ─── Assignment Form Modal ─────────────────────────────────────────────────────
const AssignmentFormModal = ({
  open, onClose, onSaved, freeVehicles, employees,
}: {
  open: boolean; onClose: () => void; onSaved: () => void;
  freeVehicles: Vehicle[]; employees: Employee[];
}) => {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const nowStr = () => {
    const d = new Date();
    return `${format(d, 'yyyy-MM-dd')}T${format(d, 'HH:mm')}`;
  };
  const [form, setForm] = useState({ vehicle_id: '', employee_id: '', start_at: nowStr(), notes: '', reason: '' });

  useEffect(() => { if (open) setForm({ vehicle_id: '', employee_id: '', start_at: nowStr(), notes: '', reason: '' }); }, [open]);

  const handleSave = async () => {
    if (!form.vehicle_id || !form.employee_id)
      return toast({ title: 'يرجى اختيار المركبة والمندوب', variant: 'destructive' });
    setSaving(true);
    try {
      const startAt = new Date(form.start_at);
      await vehicleService.createAssignment({
        vehicle_id: form.vehicle_id,
        employee_id: form.employee_id,
        start_date: format(startAt, 'yyyy-MM-dd'),
        start_at: startAt.toISOString(),
        notes: form.notes || null,
        reason: form.reason || null,
      });
      toast({ title: '✅ تم تسجيل التسليم بنجاح' });
      onSaved(); onClose();
    } catch (e) {
      logError('[VehicleAssignment] load failed', e);
      const message = getErrorMessage(e, 'حدث خطأ غير متوقع');
      toast({ title: 'حدث خطأ', description: message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardList size={18} className="text-primary" />
            تسجيل تسليم مركبة
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {/* Vehicle selector — ONLY free (active + no current assignment) vehicles */}
          <div>
            {freeVehicles.length === 0 ? (
              <>
                <div className="text-sm font-medium mb-1 block">
                  المركبة *{' '}
                  <span className="text-xs text-muted-foreground font-normal ms-2">
                    (المركبات الفاضية فقط — 0 متاحة)
                  </span>
                </div>
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive flex items-center gap-2">
                  <AlertCircle size={16} />
                  لا توجد مركبات متاحة — كل المركبات النشطة مرتبطة بمناديب أو في صيانة/إيجار
                </div>
              </>
            ) : (
              <>
                <label htmlFor="vehicle-select" className="text-sm font-medium mb-1 block">
                  المركبة *{' '}
                  <span className="text-xs text-muted-foreground font-normal ms-2">
                    (المركبات الفاضية فقط — {freeVehicles.length} متاحة)
                  </span>
                </label>
                <Select value={form.vehicle_id} onValueChange={v => setForm(p => ({ ...p, vehicle_id: v }))}>
                  <SelectTrigger id="vehicle-select"><SelectValue placeholder="اختر المركبة الفاضية" /></SelectTrigger>
                  <SelectContent>
                    {freeVehicles.map(v => (
                      <SelectItem key={v.id} value={v.id}>
                        <span className="flex items-center gap-2">
                          <span>{v.type === 'motorcycle' ? '🏍️' : '🚗'}</span>
                          <span className="font-mono font-bold">{v.plate_number}</span>
                          {(v.brand || v.model) && (
                            <span className="text-muted-foreground text-xs">— {v.brand} {v.model}</span>
                          )}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </>
            )}
          </div>

          {/* Employee */}
          <div>
            <label htmlFor="assign-employee" className="text-sm font-medium mb-1 block">المندوب *</label>
            <Select value={form.employee_id} onValueChange={v => setForm(p => ({ ...p, employee_id: v }))}>
              <SelectTrigger id="assign-employee"><SelectValue placeholder="اختر المندوب" /></SelectTrigger>
              <SelectContent>
                {employees.map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Date/time */}
          <div>
            <label htmlFor="assign-date" className="text-sm font-medium mb-1 block">تاريخ ووقت الاستلام</label>
            <Input id="assign-date" type="datetime-local" value={form.start_at} onChange={e => setForm(p => ({ ...p, start_at: e.target.value }))} />
          </div>

          {/* Reason */}
          <div>
            <label htmlFor="assign-reason" className="text-sm font-medium mb-1 block">سبب التسليم</label>
            <Input id="assign-reason" value={form.reason} onChange={e => setForm(p => ({ ...p, reason: e.target.value }))} placeholder="مثال: توصيل شيفت صباحي..." />
          </div>

          {/* Notes */}
          <div>
            <label htmlFor="assign-notes" className="text-sm font-medium mb-1 block">ملاحظات</label>
            <Input id="assign-notes" value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} placeholder="أي ملاحظات إضافية..." />
          </div>
        </div>
        <DialogFooter className="mt-4 gap-2">
          <Button variant="outline" onClick={onClose}>إلغاء</Button>
          <Button onClick={handleSave} disabled={saving || freeVehicles.length === 0}>
            {saving ? 'جاري الحفظ...' : 'تسجيل التسليم'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// ─── Return Modal ─────────────────────────────────────────────────────────────
const ReturnModal = ({
  open, onClose, onSaved, assignment,
}: {
  open: boolean; onClose: () => void; onSaved: () => void; assignment: Assignment | null;
}) => {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const nowStr = () => {
    const d = new Date();
    return `${format(d, 'yyyy-MM-dd')}T${format(d, 'HH:mm')}`;
  };
  const [returnedAt, setReturnedAt] = useState(nowStr());

  useEffect(() => { if (open) setReturnedAt(nowStr()); }, [open]);

  const handleSave = async () => {
    if (!assignment) return;
    setSaving(true);
    try {
      const rt = new Date(returnedAt);
      await vehicleService.updateAssignment(assignment.id, {
        returned_at: rt.toISOString(),
        end_date: format(rt, 'yyyy-MM-dd'),
      });
      toast({ title: '✅ تم تسجيل الإعادة بنجاح' });
      onSaved(); onClose();
    } catch (e) {
      logError('[VehicleAssignment] save failed', e);
      const message = getErrorMessage(e, 'حدث خطأ غير متوقع');
      toast({ title: 'حدث خطأ', description: message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-sm" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RotateCcw size={18} className="text-success" />
            تسجيل إعادة المركبة
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="bg-muted/40 rounded-lg p-3 text-sm">
            <div><span className="text-muted-foreground">المركبة: </span><span className="font-bold">{assignment?.vehicles?.plate_number}</span></div>
            <div><span className="text-muted-foreground">المندوب: </span><span className="font-bold">{assignment?.employees?.name}</span></div>
            <div><span className="text-muted-foreground">مدة الاستخدام: </span><span className="font-bold text-primary">{calcDuration(assignment?.start_at || null, null)}</span></div>
          </div>
          <div>
            <label htmlFor="return-date" className="text-sm font-medium mb-1 block">تاريخ ووقت الإعادة</label>
            <Input id="return-date" type="datetime-local" value={returnedAt} onChange={e => setReturnedAt(e.target.value)} />
          </div>
        </div>
        <DialogFooter className="mt-4 gap-2">
          <Button variant="outline" onClick={onClose}>إلغاء</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? 'جاري الحفظ...' : 'تسجيل الإعادة'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// ─── Skeleton Row ─────────────────────────────────────────────────────────────
const SkeletonRow = () => (
  <tr className="border-b border-border/30">
    {['assignment-skeleton-cell-1', 'assignment-skeleton-cell-2', 'assignment-skeleton-cell-3', 'assignment-skeleton-cell-4', 'assignment-skeleton-cell-5', 'assignment-skeleton-cell-6', 'assignment-skeleton-cell-7'].map((cellKey) => (
      <td key={cellKey} className="ta-td"><Skeleton className="h-4 w-full" /></td>
    ))}
  </tr>
);

import { useTemporalContext } from '@app/providers/TemporalContext';

// ─── Main Component ───────────────────────────────────────────────────────────
const VehicleAssignment = () => {
  const { toast } = useToast();
  const { permissions } = usePermissions('vehicle_assignment');
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const { selectedMonth } = useTemporalContext();
  const {
    data: assignmentData,
    isLoading: loading,
    error: assignmentError,
    refetch: refetchAssignmentData,
  } = useVehicleAssignmentData(selectedMonth);
  const [search, setSearch] = useState('');
  const [showActive, setShowActive] = useState<'all' | 'active' | 'returned'>('all');
  const isShowActiveKey = (v: string): v is 'all' | 'active' | 'returned' =>
    v === 'all' || v === 'active' || v === 'returned';
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [returnAssignment, setReturnAssignment] = useState<Assignment | null>(null);
  const tableRef = useRef<HTMLTableElement>(null);

  // Local state mirrors React Query data — kept because freeVehicles, stats, and filtered
  // derive from these arrays, and the assignment/return modals use them for display.
  useEffect(() => {
    if (!assignmentData) return;
    setAssignments(assignmentData.assignments);
    setVehicles(assignmentData.vehicles);
    setEmployees(assignmentData.employees);
  }, [assignmentData]);

  useEffect(() => {
    if (!assignmentError) return;
    const message =
      assignmentError instanceof Error
        ? assignmentError.message
        : 'حدث خطأ غير متوقع أثناء تحميل البيانات';
    toast({ title: 'خطأ في تحميل البيانات', description: message, variant: 'destructive' });
  }, [assignmentError, toast]);

  // Vehicles that are TRULY free:
  // 1. Status must be 'active'
  // 2. Must NOT have any active (non-returned) assignment
  const assignedVehicleIds = new Set(
    assignments.filter(a => !a.returned_at).map(a => a.vehicle_id)
  );

  const freeVehicles = vehicles.filter(
    v => v.status === 'active' && !assignedVehicleIds.has(v.id)
  );

  // All vehicles grouped by availability for the stats
  const stats = {
    total: assignments.length,
    active: assignments.filter(a => !a.returned_at).length,
    returned: assignments.filter(a => !!a.returned_at).length,
    free: freeVehicles.length,
  };

  const filtered = assignments.filter(a => {
    const q = search.toLowerCase();
    const matchSearch = !q
      || (a.vehicles?.plate_number ?? '').toLowerCase().includes(q)
      || (a.employees?.name ?? '').toLowerCase().includes(q);
    const isReturned = !!a.returned_at;
    const matchStatus = showActive === 'all' || (showActive === 'active' && !isReturned) || (showActive === 'returned' && isReturned);
    return matchSearch && matchStatus;
  });

  const handlePrint = () => {
    const table = tableRef.current;
    if (!table) return;
    // Use printHtmlTable utility for safe printing instead of writing raw HTML to a new window
    // This avoids XSS potential from string-interpolating data into document.write
    printHtmlTable(table, {
      title: 'سجل تسليم المركبات',
      subtitle: `المجموع: ${filtered.length} سجل — ${new Date().toLocaleDateString('ar-SA')}`,
    });
  };

  const handleTemplate = async () => {
    const XLSX = await loadXlsx();
    const headers = [['رقم اللوحة', 'نوع المركبة', 'اسم المندوب', 'تاريخ الاستلام', 'تاريخ الإعادة', 'السبب', 'ملاحظات']];
    const ws = XLSX.utils.aoa_to_sheet(headers);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'قالب');
    XLSX.writeFile(wb, 'template_vehicle_assignment.xlsx');
  };

  return (
    <div className="space-y-4" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <nav className="page-breadcrumb">
            <span>العمليات</span>
            <span className="page-breadcrumb-sep">/</span>
            <span className="text-foreground font-medium">سجل تسليم المركبات</span>
          </nav>
          <h1 className="page-title">سجل تسليم المركبات</h1>
        </div>
        <div className="flex gap-2">
          {permissions.can_edit && (
            <Button className="gap-2" onClick={() => setShowAssignModal(true)}>
              <Plus size={16} /> تسجيل تسليم جديد
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5 h-9"><FolderOpen size={14} /> ملفات</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={async () => {
                const rows = filtered.map(a => ({
                  'المركبة': a.vehicles?.plate_number ?? '',
                  'النوع': a.vehicles?.type === 'motorcycle' ? 'دباب' : 'سيارة',
                  'المندوب': a.employees?.name ?? '',
                  'تاريخ الاستلام': a.start_at ? format(new Date(a.start_at), 'yyyy-MM-dd HH:mm') : '',
                  'تاريخ الإعادة': a.returned_at ? format(new Date(a.returned_at), 'yyyy-MM-dd HH:mm') : '',
                  'الحالة': a.returned_at ? 'تم الإعادة' : 'قيد الاستخدام',
                  'السبب': a.reason ?? '',
                  'ملاحظات': a.notes ?? '',
                }));
                const XLSX = await loadXlsx();
                const ws = XLSX.utils.json_to_sheet(rows);
                const wb = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(wb, ws, 'سجل تسليم المركبات');
                XLSX.writeFile(wb, `سجل_تسليم_المركبات_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
              }}>📊 تصدير Excel</DropdownMenuItem>
              <DropdownMenuItem onClick={handleTemplate}>📋 تحميل قالب الاستيراد</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handlePrint}>🖨️ طباعة الجدول</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'إجمالي السجلات',    value: stats.total,    icon: '📋', cls: 'text-foreground' },
          { label: 'قيد الاستخدام',     value: stats.active,   icon: '🔑', cls: 'text-primary'    },
          { label: 'تم الإعادة',        value: stats.returned, icon: '✅', cls: 'text-success'    },
          { label: 'مركبات فاضية',      value: stats.free,     icon: '🏍️', cls: 'text-success'    },
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

      {(assignments.length >= VEHICLES_QUERY_MAX_ROWS || vehicles.length >= VEHICLES_QUERY_MAX_ROWS) && (
        <p className="text-xs text-amber-800 dark:text-amber-300/95 bg-amber-500/12 border border-amber-500/30 rounded-lg px-3 py-2">
          يُعرض حتى {VEHICLES_QUERY_MAX_ROWS.toLocaleString('ar-SA')} سجلّ تسليم و{VEHICLES_QUERY_MAX_ROWS.toLocaleString('ar-SA')} مركبة كحد أقصى في الصفحة. إذا كان العدد أكبر في النظام قد لا تظهر كل المركبات أو السجلات — راجع تقارير أخرى أو زد الحد من إعدادات الخادم لاحقاً.
        </p>
      )}

      {/* Free vehicles rule banner */}
      <div className="flex items-center gap-2 p-3 bg-primary/5 border border-primary/20 rounded-xl text-sm">
        <CheckCircle size={16} className="text-primary flex-shrink-0" />
        <span className="text-muted-foreground">
          يُسمح بالتسليم فقط للمركبات <span className="font-bold text-success">الفاضية</span> — 
          المركبات في صيانة أو إيجار أو خربان أو مع مندوب آخر <span className="font-bold text-destructive">لا تظهر</span>. يجب تسجيل الإعادة أولاً لتصبح متاحة.
        </span>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[180px]">
          <Search size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="بحث برقم اللوحة أو اسم المندوب..." className="pr-9 h-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="flex gap-1 bg-muted/50 rounded-lg p-1">
          {[
            { key: 'all',      label: 'الكل' },
            { key: 'active',   label: 'قيد الاستخدام' },
            { key: 'returned', label: 'تم الإعادة' },
          ].map(opt => (
            <button
              key={opt.key}
              onClick={() => { if (isShowActiveKey(opt.key)) setShowActive(opt.key); }}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${showActive === opt.key ? 'bg-card shadow text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <span className="text-xs text-muted-foreground ms-auto">{filtered.length} سجل</span>
      </div>

      {/* Table */}
      <div className="ta-table-wrap">
        <div className="overflow-x-auto">
          <table ref={tableRef} className="w-full min-w-[800px]">
            <thead className="ta-thead">
              <tr>
                <th className="ta-th">المركبة</th>
                <th className="ta-th">المندوب</th>
                <th className="ta-th">تاريخ الاستلام</th> {/* NOSONAR */}
                <th className="ta-th">تاريخ الإعادة</th>
                <th className="ta-th">مدة الاستخدام</th>
                <th className="ta-th">الحالة</th>
                <th className="ta-th">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {(() => {
                if (loading) {
                  return Array.from({ length: 5 }, (_, i) => `assignment-skeleton-row-${i}`).map((key) => <SkeletonRow key={key} />);
                }
                if (filtered.length === 0) {
                  return (
                    <tr>
                      <td colSpan={7} className="ta-td">
                        <div className="flex flex-col items-center gap-2 text-muted-foreground">
                          <ClipboardList size={40} className="opacity-30" />
                          <p className="font-medium">لا توجد سجلات</p>
                        </div>
                      </td>
                    </tr>
                  );
                }
                return filtered.map(a => {
                const isActive = !a.returned_at;
                return (
                  <tr key={a.id} className={`border-b border-border/30 hover:bg-muted/20 transition-colors ${isActive ? 'bg-primary/2' : ''}`}>
                    <td className="ta-td">
                      <span className="font-bold font-mono text-foreground whitespace-nowrap">
                        {a.vehicles?.type === 'motorcycle' ? '🏍️' : '🚗'} {a.vehicles?.plate_number || '—'}
                      </span>
                    </td>
                    <td className="ta-td">
                      <span className="text-sm font-medium text-foreground whitespace-nowrap">{a.employees?.name || '—'}</span>
                    </td>
                    <td className="ta-td text-muted-foreground">
                      {a.start_at ? (
                        <div>
                          <div>{format(new Date(a.start_at), 'yyyy/MM/dd')}</div>
                          <div className="text-muted-foreground/60">{format(new Date(a.start_at), 'HH:mm')}</div>
                        </div>
                      ) : (a.start_date || '—')}
                    </td>
                    <td className="ta-td text-muted-foreground">
                      {a.returned_at ? (
                        <div>
                          <div>{format(new Date(a.returned_at), 'yyyy/MM/dd')}</div>
                          <div className="text-muted-foreground/60">{format(new Date(a.returned_at), 'HH:mm')}</div>
                        </div>
                      ) : <span className="text-primary font-medium flex items-center gap-1"><Clock size={11} /> جارٍ</span>}
                    </td>
                    <td className="ta-td text-muted-foreground">
                      {calcDuration(a.start_at, a.returned_at)}
                    </td>
                    <td className="ta-td">
                      {isActive
                        ? <span className="badge-warning">قيد الاستخدام</span>
                        : <span className="badge-success">تم الإعادة</span>
                      }
                    </td>
                    <td className="ta-td">
                      {isActive && permissions.can_edit && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1 h-7 text-xs"
                          onClick={() => setReturnAssignment(a)}
                        >
                          <RotateCcw size={12} /> تسجيل إعادة
                        </Button>
                      )}
                    </td>
                  </tr>
                );
                });
              })()}
            </tbody>
          </table>
        </div>
      </div>

      <AssignmentFormModal
        open={showAssignModal}
        onClose={() => setShowAssignModal(false)}
        onSaved={() => refetchAssignmentData().catch(() => {})}
        freeVehicles={freeVehicles}
        employees={employees}
      />
      <ReturnModal
        open={!!returnAssignment}
        onClose={() => setReturnAssignment(null)}
        onSaved={() => refetchAssignmentData().catch(() => {})}
        assignment={returnAssignment}
      />
    </div>
  );
};

export default VehicleAssignment;
