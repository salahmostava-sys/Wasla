import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useToast } from '@shared/hooks/use-toast';
import { usePermissions } from '@shared/hooks/usePermissions';
import { violationService } from '@services/violationService';
import { authQueryUserId, useAuthQueryGate } from '@shared/hooks/useAuthQueryGate';
import { defaultQueryRetry } from '@shared/lib/query';
import type {
  VehicleSuggestion,
  DeductionRow,
  ViolationDataRow,
  ResultRow,
  ViolationRecord,
  ViolationForm,
  ViolationSortFieldKey,
  VehicleAssignmentForViolation,
} from '@modules/violations/types/violation.types';
import { getErrorMessage } from '@services/serviceError';
import {
  assignmentStartMs,
  assignmentEndMs,
  formatViolationFormDateDisplay,
  getViolationSortValue,
} from '@modules/violations/lib/violationUtils';

const VIOLATION_DATE_REQUIRED_TITLE = 'أدخل تاريخ المخالفة';
const VIOLATION_DATE_REQUIRED_DESC = 'تاريخ المخالفة مطلوب';

export function useViolationTable() {
  const { toast } = useToast();
  const { enabled, userId } = useAuthQueryGate();
  const uid = authQueryUserId(userId);
  const { permissions: perms } = usePermissions('violation_resolver');
  const [form, setForm] = useState<ViolationForm>({
    plate_number: '',
    selected_vehicle_id: null,
    violation_datetime: '',
    violation_date_only: '',
    amount: '',
    note: '',
    place: '',
    use_time: true,
  });
  const [suggestions, setSuggestions] = useState<VehicleSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<ResultRow[] | null>(null);
  const [noVehicle, setNoVehicle] = useState(false);
  const [assigningEmployeeId, setAssigningEmployeeId] = useState<string | null>(null);
  const suggRef = useRef<HTMLDivElement>(null);

  // ── Violations management table ──
  const [violations, setViolations] = useState<ViolationRecord[]>([]);
  const {
    data: violationsData = [],
    isLoading: violationsLoading,
    error: violationsError,
    refetch: refetchViolations,
  } = useQuery({
    queryKey: ['violation-resolver', uid, 'violations'],
    enabled,
    queryFn: async () => {
      const rows: ViolationDataRow[] = await violationService.getViolations();
      return (rows || []).map((v) => ({
        id: v.id,
        employee_id: v.employee_id,
        employee_name: v.employees?.name || '—',
        national_id: v.employees?.national_id || null,
        violation_details: v.note || '—',
        incident_date: v.incident_date,
        amount: Number(v.amount) || 0,
        apply_month: v.apply_month,
        status: v.approval_status,
        linked_advance_id: v.linked_advance_id ?? null,
      }));
    },
    retry: defaultQueryRetry,
    staleTime: 60_000,
  });

  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editViolationId, setEditViolationId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    amount: '',
    incident_date: '',
    note: '',
    approval_status: 'pending',
  });
  const [editSaving, setEditSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deletingSearchDeductionId, setDeletingSearchDeductionId] = useState<string | null>(null);
  const [convertingId, setConvertingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'search' | 'saved'>('search');
  const [vSortField, setVSortField] = useState<ViolationSortFieldKey>('incident_date');
  const [vSortDir, setVSortDir] = useState<'asc' | 'desc'>('desc');
  const [savedSearch, setSavedSearch] = useState('');
  const [savedStatusFilter, setSavedStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');

  const isAdvanceLegacyNote = useCallback(
    (details: string) => /تم التحويل لسلفة|معرّف السلفة:/u.test(details || ''),
    []
  );

  const isViolationConvertedToAdvance = useCallback(
    (v: ViolationRecord) => Boolean(v.linked_advance_id) || isAdvanceLegacyNote(v.violation_details),
    [isAdvanceLegacyNote]
  );

  const fetchViolations = useCallback(() => {
    refetchViolations().catch(() => {});
  }, [refetchViolations]);

  useEffect(() => {
    setViolations(violationsData);
  }, [violationsData]);

  useEffect(() => {
    if (!violationsError) return;
    const message =
      violationsError instanceof Error
        ? violationsError.message
        : 'تعذر تحميل سجل المخالفات';
    toast({ title: 'خطأ في التحميل', description: message, variant: 'destructive' });
  }, [violationsError, toast]);


  // ── Vehicle autocomplete ──────────────────────────────────────────────────
  const fetchSuggestions = useCallback(async (q: string) => {
    if (!q.trim()) { setSuggestions([]); return; }
    const data = await violationService.findVehiclesByPlateQuery(q);
    setSuggestions(data || []);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      if (form.plate_number && !form.selected_vehicle_id) fetchSuggestions(form.plate_number);
    }, 200);
    return () => clearTimeout(t);
  }, [form.plate_number, form.selected_vehicle_id, fetchSuggestions]);

  // close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (suggRef.current && !suggRef.current.contains(e.target as Node)) setShowSuggestions(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const selectVehicle = (v: VehicleSuggestion) => {
    setForm(f => ({ ...f, plate_number: v.plate_number, selected_vehicle_id: v.id }));
    setSuggestions([]);
    setShowSuggestions(false);
    setResults(null);
    setNoVehicle(false);
    setAssigningEmployeeId(null);
  };

  // ── Search handler ────────────────────────────────────────────────────────
  const handleSearch = async () => {
    // التحقق من رقم اللوحة
    const plate = form.plate_number.trim();
    if (!plate) { 
      toast({ title: 'أدخل رقم اللوحة', description: 'رقم لوحة المركبة مطلوب', variant: 'destructive' }); 
      return; 
    }
    
    // التأكد من اختيار المركبة من القائمة
    const vehicleId = form.selected_vehicle_id;
    if (!vehicleId) {
      toast({ title: 'اختر المركبة من القائمة', description: 'يجب اختيار المركبة من القائمة المنسدلة لضمان مطابقة البيانات', variant: 'destructive' });
      return;
    }

    // التحقق من التاريخ
    const dateVal = form.use_time ? form.violation_datetime : form.violation_date_only;
    if (!dateVal) { 
      toast({ title: VIOLATION_DATE_REQUIRED_TITLE, description: VIOLATION_DATE_REQUIRED_DESC, variant: 'destructive' }); 
      return; 
    }

    const violationDate = form.use_time
      ? (form.violation_datetime.split('T')[0] || '')
      : form.violation_date_only;
    if (!violationDate) { 
      toast({ title: VIOLATION_DATE_REQUIRED_TITLE, description: VIOLATION_DATE_REQUIRED_DESC, variant: 'destructive' }); 
      return; 
    }

    // التحقق من المبلغ
    const enteredAmount = Number.parseFloat(form.amount);
    if (!enteredAmount || enteredAmount <= 0) {
      toast({ title: 'أدخل مبلغ المخالفة', description: 'مبلغ المخالفة مطلوب', variant: 'destructive' });
      return;
    }

    setSearching(true); setResults(null); setNoVehicle(false); setAssigningEmployeeId(null);

    // Find vehicle(s) - now we require selected_vehicle_id
    const vehicleIds = [vehicleId];

    // Find assignments at that time
    const violationTs = form.use_time
      ? new Date(dateVal).toISOString()
      : new Date(dateVal + 'T12:00:00').toISOString();

    const assignments = await violationService.getAssignmentsByVehicleIds(vehicleIds);

    if (!assignments?.length) { 
      setSearching(false); 
      setResults([]); 
      toast({ title: 'لا يوجد مندوب مسؤول', description: 'لم يتم تسليم المركبة لأي مندوب في هذا التاريخ', variant: 'destructive' });
      return; 
    }

    const violationTime = new Date(violationTs).getTime();

    const typedAssignments: VehicleAssignmentForViolation[] = assignments;
    let matched = typedAssignments.filter((a) => {
      const start = assignmentStartMs(a);
      const end = assignmentEndMs(a);
      return violationTime >= start && violationTime <= end;
    });

    // if no exact match by timestamp, fallback to same day
    if (!matched.length && !form.use_time) {
      const dayStart = new Date(dateVal + 'T00:00:00').getTime();
      const dayEnd = new Date(dateVal + 'T23:59:59').getTime();
      matched = typedAssignments.filter((a) => {
        const start = assignmentStartMs(a);
        const end = assignmentEndMs(a);
        return start <= dayEnd && end >= dayStart;
      });
    }

    if (!matched.length) { 
      setSearching(false); 
      setResults([]); 
      toast({ title: 'لا يوجد مندوب مسؤول', description: 'لم يتم تسليم المركبة لأي مندوب في هذا التوقيت المحدد', variant: 'destructive' });
      return; 
    }

    const empIds = [...new Set(matched.map(a => a.employee_id))];

    // Existing external_deductions for this employee/date/amount
    const applyMonth = violationDate.substring(0, 7);
    const existingDeduction = await violationService.getExistingFineDeductions(empIds, violationDate, applyMonth);

    const recordedByEmployee = new Map<string, { id: string; amount: number }>();
    (existingDeduction as unknown as DeductionRow[] || []).forEach((d) => {
      const amt = Number(d.amount) || 0;
      if (amt === enteredAmount && !recordedByEmployee.has(d.employee_id)) {
        recordedByEmployee.set(d.employee_id, { id: d.id, amount: amt });
      }
    });

    const rows: ResultRow[] = matched.map((a) => {
      const vehiclePlate = a.vehicles?.plate_number || plate;
      const violationDetails = [
        vehiclePlate ? `لوحة: ${vehiclePlate}` : null,
        form.place ? `مكان: ${form.place}` : null,
      ].filter(Boolean).join(' — ');

      const rec = recordedByEmployee.get(a.employee_id) || null;
      return {
      assignment_id: a.id,
      employee_id: a.employee_id,
      employee_name: a.employees?.name || '—',
      national_id: a.employees?.national_id || null,
      violation_details: violationDetails || '—',
      violation_date: violationDate,
      amount: enteredAmount,
      status: rec ? 'recorded' : 'not_recorded',
      external_deduction_id: rec?.id || null,
    };
    });

    setResults(rows);
    setSearching(false);
  };

  // ── Assign violation ──────────────────────────────────────────────────────
  const handleAssign = async (row: ResultRow) => {
    const amt = row.amount;
    if (!amt || amt <= 0) { toast({ title: 'أدخل مبلغ المخالفة', variant: 'destructive' }); return; }
    if (row.status === 'recorded' && row.external_deduction_id) return;
    setAssigningEmployeeId(row.employee_id);
    const violationDate = row.violation_date;
    const noteText = [
      'مخالفة مرورية',
      row.violation_details,
      form.note || null,
    ].filter(Boolean).join(' - ');

    let inserted: { id: string };
    try {
      inserted = await violationService.createFineDeduction({
        employee_id: row.employee_id,
        amount: amt,
        type: 'fine',
        apply_month: violationDate.substring(0, 7),
        incident_date: violationDate,
        note: noteText,
        approval_status: 'pending',
      });
    } catch (e: unknown) {
      setAssigningEmployeeId(null);
      const message = getErrorMessage(e, 'حدث خطأ');
      toast({ title: 'حدث خطأ', description: message, variant: 'destructive' });
      return;
    }

    setAssigningEmployeeId(null);

    setResults(prev => {
      if (!prev) return prev;
      return prev.map(r => r.employee_id === row.employee_id
        ? { ...r, status: 'recorded', external_deduction_id: inserted?.id || r.external_deduction_id }
        : r
      );
    });

    toast({ title: '✅ تم تسجيل المخالفة', description: `على ${row.employee_name}` });
    fetchViolations();
  };

  /** حذف مخالفة مُسجَّلة من نتائج الاستعلام (يعيد الصف إلى غير مسجّل) */
  const handleDeleteSearchResultRow = async (row: ResultRow) => {
    if (!row.external_deduction_id) return;
    if (!perms.can_delete) {
      toast({ title: 'صلاحية غير كافية', description: 'ليس لديك صلاحية الحذف', variant: 'destructive' });
      return;
    }
    if (!globalThis.confirm(`حذف مخالفة ${row.employee_name} من السجل؟ لا يمكن التراجع.`)) return;
    setDeletingSearchDeductionId(row.external_deduction_id);
    try {
      await violationService.deleteViolation(row.external_deduction_id);
    } catch (e: unknown) {
      setDeletingSearchDeductionId(null);
      const message = getErrorMessage(e, 'حدث خطأ');
      toast({ title: 'تعذر الحذف', description: message, variant: 'destructive' });
      return;
    }
    setDeletingSearchDeductionId(null);
    setResults((prev) => {
      if (!prev) return prev;
      return prev.map((r) =>
        r.assignment_id === row.assignment_id
          ? { ...r, status: 'not_recorded' as const, external_deduction_id: null }
          : r,
      );
    });
    fetchViolations();
    toast({ title: 'تم الحذف', description: 'يمكنك إعادة التسجيل من البند إن لزم.' });
  };

  /** الانتقال لتبويب المخالفات المرحلة مع تمييز البحث لمراجعة السجل */
  const handleTransferSearchRowToSaved = (row: ResultRow) => {
    if (row.status !== 'recorded') {
      toast({ title: 'سجّل المخالفة أولاً', description: 'اضغط «تأكيد ✓» ثم استخدم «ترحيل للمرحلة».', variant: 'destructive' });
      return;
    }
    setSavedSearch(row.employee_name);
    setSavedStatusFilter('all');
    setActiveTab('saved');
    fetchViolations();
    toast({ title: 'تم الترحيل للمراجعة', description: 'البيانات تظهر في تبويب «المخالفات المرحلة».' });
  };

  const openEditViolation = (v: ViolationRecord) => {
    setEditViolationId(v.id);
    setEditForm({
      amount: String(v.amount ?? ''),
      incident_date: v.incident_date ?? '',
      note: v.violation_details ?? '',
      approval_status: v.status || 'pending',
    });
    setEditDialogOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editViolationId) return;
    const amount = Number.parseFloat(editForm.amount);
    if (!amount || amount <= 0) { toast({ title: 'خطأ', description: 'أدخل مبلغ صحيح', variant: 'destructive' }); return; }
    if (!editForm.incident_date) { toast({ title: 'خطأ', description: VIOLATION_DATE_REQUIRED_TITLE, variant: 'destructive' }); return; }

    setEditSaving(true);
    try {
      await violationService.updateViolation(editViolationId, {
        amount,
        incident_date: editForm.incident_date,
        note: editForm.note,
        approval_status: editForm.approval_status,
      });
    } catch (e: unknown) {
      setEditSaving(false);
      const message = getErrorMessage(e, 'حدث خطأ');
      toast({ title: 'حدث خطأ', description: message, variant: 'destructive' });
      return;
    }

    setEditSaving(false);

    setEditDialogOpen(false);
    setEditViolationId(null);
    fetchViolations();
    toast({ title: 'تم الحفظ ✅' });
  };

  const handleDeleteViolation = async (id: string) => {
    if (!perms.can_delete) {
      toast({ title: 'صلاحية غير كافية', description: 'ليس لديك صلاحية الحذف', variant: 'destructive' });
      return;
    }
    setDeletingId(id);
    try {
      await violationService.deleteViolation(id);
    } catch (e: unknown) {
      setDeletingId(null);
      const message = getErrorMessage(e, 'حدث خطأ');
      toast({ title: 'حدث خطأ', description: message, variant: 'destructive' });
      return;
    }
    setDeletingId(null);
    fetchViolations();
    toast({ title: 'تم الحذف' });
  };

  const handleConvertToAdvance = async (v: ViolationRecord) => {
    if (!v.apply_month) { toast({ title: 'خطأ', description: 'بيانات القسط غير مكتملة', variant: 'destructive' }); return; }
    if (isViolationConvertedToAdvance(v)) {
      toast({ title: 'تم التحويل مسبقاً', description: 'هذه المخالفة مسجّلة كسلفة بالفعل.', variant: 'destructive' });
      return;
    }
    const today = new Date().toISOString().slice(0, 10);
    const violationDate = v.incident_date || today;
    const fullDetails = (v.violation_details ?? '').trim() || '—';

    const advanceNote = [
      `مخالفة مرورية بتاريخ ${violationDate}.`,
      `المبلغ: ${v.amount.toLocaleString('en-US')} ر.س — شهر الخصم: ${v.apply_month}`,
      '',
      'تفاصيل المخالفة (كاملة):',
      fullDetails,
      '',
      `تم إنشاء السلفة بتاريخ ${today}.`,
    ].join('\n');

    // Guard against converting the same fine multiple times
    const amountMin = v.amount - 0.01;
    const amountMax = v.amount + 0.01;
    const existingAdv = await violationService.findMatchingAdvanceForFine(v.employee_id, v.apply_month, amountMin, amountMax);

    if (existingAdv.length > 0) {
      toast({ title: 'تم التحويل مسبقاً', description: 'يوجد سلفة نشطة مطابقة لهذه المخالفة.' });
      return;
    }

    setConvertingId(v.id);
    let advInserted: { id: string };
    try {
      advInserted = await violationService.createAdvanceFromFine({
        employee_id: v.employee_id,
        amount: v.amount,
        disbursement_date: today,
        total_installments: 1,
        monthly_amount: v.amount,
        first_deduction_month: v.apply_month,
        note: advanceNote,
        status: 'active',
      });
    } catch (e: unknown) {
      setConvertingId(null);
      const message = getErrorMessage(e, 'تعذر إنشاء السلفة');
      toast({ title: 'حدث خطأ', description: message, variant: 'destructive' });
      return;
    }

    if (!advInserted?.id) {
      setConvertingId(null);
      toast({ title: 'حدث خطأ', description: 'تعذر إنشاء السلفة', variant: 'destructive' });
      return;
    }

    try {
      await violationService.createSingleInstallment({
        advance_id: advInserted.id,
        month_year: v.apply_month,
        amount: v.amount,
        status: 'pending',
      });
    } catch (e: unknown) {
      setConvertingId(null);
      const message = getErrorMessage(e, 'حدث خطأ');
      toast({ title: 'حدث خطأ', description: message, variant: 'destructive' });
      return;
    }

    const appended = [
      fullDetails,
      '',
      `[تم التحويل لسلفة بتاريخ ${today} — معرّف السلفة: ${advInserted.id}]`,
    ].join('\n');

    try {
      await violationService.updateViolation(v.id, {
        note: appended,
        linked_advance_id: advInserted.id,
      });
    } catch {
      toast({ title: 'تم إنشاء السلفة', description: 'تعذر ربط سجل المخالفة بالسلفة في النظام — راجع السجل يدوياً.' });
    }
    setConvertingId(null);

    fetchViolations();
    toast({ title: 'تم تحويل لسلفة ✅', description: `رقم السلفة: ${advInserted.id.slice(0, 8)}…` });
  };

  const sortedViolations = useMemo(() => {
    const rows = [...violations];
    rows.sort((a, b) => {
      const va = getViolationSortValue(a, vSortField, isViolationConvertedToAdvance);
      const vb = getViolationSortValue(b, vSortField, isViolationConvertedToAdvance);
      if (va < vb) return vSortDir === 'asc' ? -1 : 1;
      if (va > vb) return vSortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return rows;
  }, [isViolationConvertedToAdvance, violations, vSortDir, vSortField]);

  const filteredSortedViolations = useMemo(() => {
    const query = savedSearch.trim().toLowerCase();
    const baseFiltered = sortedViolations.filter((row) => {
      if (savedStatusFilter !== 'all' && row.status !== savedStatusFilter) return false;
      if (!query) return true;
      return row.employee_name.toLowerCase().includes(query)
        || row.violation_details.toLowerCase().includes(query);
    });
    return baseFiltered;
  }, [savedSearch, savedStatusFilter, sortedViolations]);

  const violationStats = useMemo(() => {
    const total = violations.length;
    const pending = violations.filter((v) => v.status === 'pending').length;
    const approved = violations.filter((v) => v.status === 'approved').length;
    const converted = violations.filter((v) => isViolationConvertedToAdvance(v)).length;
    return { total, pending, approved, converted };
  }, [isViolationConvertedToAdvance, violations]);

  const toggleVSort = (field: ViolationSortFieldKey) => {
    if (vSortField === field) setVSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setVSortField(field);
      setVSortDir('asc');
    }
  };

  const handleReset = () => {
    setForm({ plate_number: '', selected_vehicle_id: null, violation_datetime: '', violation_date_only: '', amount: '', note: '', place: '', use_time: true });
    setResults(null); setNoVehicle(false); setAssigningEmployeeId(null); setSuggestions([]);
  };

  const dateDisplay = formatViolationFormDateDisplay(form);

  return {
    perms,
    form,
    setForm,
    suggestions,
    setSuggestions,
    showSuggestions,
    setShowSuggestions,
    searching,
    results,
    setResults,
    noVehicle,
    setNoVehicle,
    assigningEmployeeId,
    setAssigningEmployeeId,
    suggRef,
    violations,
    violationsLoading,
    violationsError,
    refetchViolations,
    fetchViolations,
    editDialogOpen,
    setEditDialogOpen,
    editViolationId,
    setEditViolationId,
    editForm,
    setEditForm,
    editSaving,
    setEditSaving,
    deletingId,
    setDeletingId,
    deletingSearchDeductionId,
    setDeletingSearchDeductionId,
    convertingId,
    setConvertingId,
    activeTab,
    setActiveTab,
    vSortField,
    setVSortField,
    vSortDir,
    setVSortDir,
    savedSearch,
    setSavedSearch,
    savedStatusFilter,
    setSavedStatusFilter,
    isViolationConvertedToAdvance,
    selectVehicle,
    handleSearch,
    handleAssign,
    handleDeleteSearchResultRow,
    handleTransferSearchRowToSaved,
    openEditViolation,
    handleSaveEdit,
    handleDeleteViolation,
    handleConvertToAdvance,
    sortedViolations,
    filteredSortedViolations,
    violationStats,
    toggleVSort,
    handleReset,
    dateDisplay,
  };
}
