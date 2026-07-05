import type React from 'react';
import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import { CalendarIcon, UserCheck, Save, CheckSquare, Square } from "lucide-react";
import { Button } from "@shared/components/ui/button";
import { Input } from "@shared/components/ui/input";
import { Calendar } from "@shared/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@shared/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@shared/components/ui/select";
import { cn } from "@shared/lib/utils";
import { toast } from "@shared/components/ui/sonner";
import { TOAST_SUCCESS_ACTION, TOAST_SUCCESS_EDIT } from "@shared/lib/toastMessages";
import { Skeleton } from '@shared/components/ui/skeleton';
import { useLanguage } from "@app/providers/LanguageContext";
import { usePermissions } from "@shared/hooks/usePermissions";
import { authQueryUserId, useAuthQueryGate } from "@shared/hooks/useAuthQueryGate";
import { useQueryErrorToast } from "@shared/hooks/useQueryErrorToast";
import attendanceService from "@services/attendanceService";
import { logError } from "@shared/lib/logger";
import { filterAttendanceRosterEmployees } from "@shared/lib/employeeVisibility";
import {
  BUILT_IN_STATUSES,
  DEFAULT_COLOR,
  STATUS_COLORS,
  STATUS_LABELS_AR,
  mapAttendanceData,
  toShortEmployeeName,
  type AttendanceRecord,
  type AttendanceStatus,
  type DailyAttendanceEmployee as Employee,
} from "@shared/lib/attendanceDailyModel";
type App = { id: string; name: string; logo_url?: string | null };

interface Props {
  selectedMonth: number;
  selectedYear: number;
}

const DailyAttendance = ({ selectedMonth, selectedYear }: Readonly<Props>) => {
  const { isRTL } = useLanguage();
  const { permissions } = usePermissions("attendance");
  const { enabled, userId } = useAuthQueryGate();
  const uid = authQueryUserId(userId);
  const dateLocale = ar;
  const statusLabels = STATUS_LABELS_AR;

  const [date, setDate] = useState<Date>(() => {
    const d = new Date();
    d.setMonth(selectedMonth);
    d.setFullYear(selectedYear);
    const lastDay = new Date(selectedYear, selectedMonth + 1, 0).getDate();
    if (d.getDate() > lastDay) d.setDate(lastDay);
    return d;
  });

  const [employeeSource, setEmployeeSource] = useState<Employee[]>([]);
  const [apps, setApps]                 = useState<App[]>([]);
  const [selectedAppId, setSelectedAppId] = useState<string | null>(null);
  // Map: appId → Set of employee IDs registered in that app
  const [appEmployeeIds, setAppEmployeeIds] = useState<Record<string, Set<string>>>({});

  const [records, setRecords] = useState<Record<string, AttendanceRecord>>({});
  const [saving, setSaving]   = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<Set<string>>(new Set());
  const [bulkStatus, setBulkStatus] = useState<string>("");

  // Custom statuses from Supabase (with localStorage fallback)
  const queryClient = useQueryClient();
  const { data: customStatuses = [] } = useQuery({
    queryKey: ['attendance-status-configs'],
    enabled,
    queryFn: async () => {
      const rows = await attendanceService.getStatusConfigs();
      return rows.map((r) => r.name);
    },
    staleTime: 5 * 60_000,
    placeholderData: () => {
      try { return JSON.parse(localStorage.getItem("custom_attendance_statuses") || "[]"); }
      catch { return []; }
    },
  });

  const addStatusMutation = useMutation({
    mutationFn: async (name: string) => {
      await attendanceService.addStatusConfig(name);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance-status-configs'] }).catch(() => {});
    },
    onError: (e) => {
      logError('[DailyAttendance] failed to save custom status to server', e, { level: 'warn' });
    },
  });

  const [addingCustomFor, setAddingCustomFor] = useState<string | null>(null);
  const [customInput, setCustomInput]         = useState("");

  // ── Sync date when month/year props change ──
  useEffect(() => {
    setDate(prev => {
      const d = new Date(prev);
      d.setFullYear(selectedYear);
      d.setMonth(selectedMonth);
      const lastDay = new Date(selectedYear, selectedMonth + 1, 0).getDate();
      if (d.getDate() > lastDay) d.setDate(lastDay);
      return d;
    });
  }, [selectedMonth, selectedYear]);

  // ── Fetch employees + apps (تصفية هروب/إنهاء خدمة حسب يوم التسجيل المختار) ──
  useEffect(() => {
    const fetchBase = async () => {
      setLoading(true);
      try {
        const baseData = await attendanceService.getDailyAttendanceBase();

        setEmployeeSource((baseData.employees as Employee[]) ?? []);

        setApps((baseData.apps) ?? []);

        // Build map: appId → Set<employeeId>
        const map: Record<string, Set<string>> = {};
        for (const row of baseData.employeeApps ?? []) {
          if (!map[row.app_id]) map[row.app_id] = new Set();
          map[row.app_id].add(row.employee_id);
        }
        setAppEmployeeIds(map);
      } catch (e) {
        logError('[DailyAttendance] fetchBase failed', e);
      } finally {
        setLoading(false);
      }
    };
    fetchBase();
  }, [selectedMonth, selectedYear]);

  const allEmployees = useMemo(
    () => filterAttendanceRosterEmployees(employeeSource, date),
    [employeeSource, date],
  );

  // ── Derive displayed employees based on platform filter ──
  const employees = selectedAppId
    ? allEmployees.filter(e => appEmployeeIds[selectedAppId]?.has(e.id))
    : allEmployees;

  const dateStr = format(date, "yyyy-MM-dd");

  const recordsQuery = useQuery({
    queryKey: ["attendance", uid, "daily-records", dateStr] as const,
    enabled: enabled && allEmployees.length > 0,
    staleTime: 0,
    queryFn: () => attendanceService.getDailyAttendanceRecords(dateStr),
  });

  useQueryErrorToast(recordsQuery.isError, recordsQuery.error, undefined, recordsQuery.refetch);

  // ── Load attendance records for selected date ──
  useEffect(() => {
    if (allEmployees.length === 0) {
      setRecords({});
      return;
    }

    setRecords(
      mapAttendanceData(
        allEmployees,
        (recordsQuery.data) ?? [],
      ),
    );
  }, [allEmployees, recordsQuery.data]);

  const updateRecord = (empId: string, field: keyof AttendanceRecord, value: string | null) => {
    setRecords(prev => ({ ...prev, [empId]: { ...prev[empId], [field]: value } }));
  };

  const markAllPresent = () => {
    setRecords(prev => {
      const updated = { ...prev };
      // Mark all currently displayed employees as present
      employees.forEach(emp => {
        updated[emp.id] = { ...updated[emp.id], status: "present" };
      });
      return updated;
    });
    toast.success(TOAST_SUCCESS_ACTION);
  };

  const toggleSelectAll = () => {
    if (selectedEmployeeIds.size === employees.length) {
      setSelectedEmployeeIds(new Set());
    } else {
      setSelectedEmployeeIds(new Set(employees.map(e => e.id)));
    }
  };

  const toggleSelectEmployee = (empId: string) => {
    setSelectedEmployeeIds(prev => {
      const next = new Set(prev);
      if (next.has(empId)) {
        next.delete(empId);
      } else {
        next.add(empId);
      }
      return next;
    });
  };

  const applyBulkStatus = () => {
    if (!bulkStatus || selectedEmployeeIds.size === 0) return;
    setRecords(prev => {
      const updated = { ...prev };
      selectedEmployeeIds.forEach(empId => {
        updated[empId] = { ...updated[empId], status: bulkStatus as AttendanceStatus };
      });
      return updated;
    });
    toast.success(`تم تحديث حالة ${selectedEmployeeIds.size} مندوب`);
    setBulkStatus("");
    setSelectedEmployeeIds(new Set());
  };

  const addCustomStatus = (empId: string) => {
    const trimmed = customInput.trim();
    if (!trimmed) return;
    if (!customStatuses.includes(trimmed)) {
      addStatusMutation.mutate(trimmed);
      // Also write to localStorage as offline backup
      try {
        const updated = [...customStatuses, trimmed];
        localStorage.setItem("custom_attendance_statuses", JSON.stringify(updated));
      } catch { /* ignore */ }
    }
    updateRecord(empId, "status", trimmed);
    setAddingCustomFor(null);
    setCustomInput("");
  };

  const VALID_DB_STATUSES = new Set<AttendanceStatus>(["present", "absent", "leave", "sick", "late"]);

  // Clears an existing DB record for an employee with no status selected. Returns whether it saved.
  const clearAttendanceRecord = async (dbId: string | undefined): Promise<boolean> => {
    if (!dbId) return false;
    try {
      await attendanceService.deleteDailyAttendance(dbId);
      return true;
    } catch {
      /* row failed; continue */
      return false;
    }
  };

  // Upserts a single employee's attendance record for the given date. Returns whether it saved.
  const saveAttendanceRecord = async (r: AttendanceRecord, dateStr: string): Promise<boolean> => {
    const dbStatus: AttendanceStatus = VALID_DB_STATUSES.has(r.status as AttendanceStatus)
      ? (r.status as AttendanceStatus)
      : "present";
    const noteText =
      [r.note, VALID_DB_STATUSES.has(r.status as AttendanceStatus) ? "" : r.status]
        .filter(Boolean).join(" | ") || null;

    const payload = {
      employee_id: r.employeeId,
      date:        dateStr,
      status:      dbStatus,
      check_in:    r.checkIn  || null,
      check_out:   r.checkOut || null,
      note:        noteText,
    };
    try {
      await attendanceService.upsertDailyAttendance(payload);
      return true;
    } catch {
      /* row failed; continue */
      return false;
    }
  };

  const handleSave = async () => {
    setSaving(true);
    const dateStr = format(date, "yyyy-MM-dd");
    let saved = 0;

    const currentDbRecords = recordsQuery.data || [];
    const dbRecordMap = new Map(currentDbRecords.map(r => [r.employee_id, r.id]));

    for (const r of Object.values(records)) {
      const didSave = r.status === null
        ? await clearAttendanceRecord(dbRecordMap.get(r.employeeId))
        : await saveAttendanceRecord(r, dateStr);
      if (didSave) saved++;
    }

    queryClient.invalidateQueries({ queryKey: ["attendance", uid, "daily-records", dateStr] });

    setSaving(false);
    toast.success(TOAST_SUCCESS_EDIT, {
      description: `${saved} سجل تم تحديثه — ${format(date, "dd MMMM yyyy", { locale: dateLocale })}`,
    });
  };

  // ── Summary (of displayed employees only) ──
  const summary = employees.reduce((acc, emp) => {
    const r = records[emp.id];
    if (r?.status) acc[r.status] = (acc[r.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const savedCount = Object.values(records).filter(r => r.status !== null).length;

  const allStatuses = [
    ...BUILT_IN_STATUSES.map(k => ({ value: k, label: statusLabels[k] })),
    ...customStatuses.map(s => ({ value: s, label: s })),
  ];
  let tableBodyRows: React.ReactNode;
  if (loading) {
    const skeletonData = [
      { id: 'skeleton-row-1', cells: ['skeleton-cell-1-1', 'skeleton-cell-1-2', 'skeleton-cell-1-3', 'skeleton-cell-1-4', 'skeleton-cell-1-5'] },
      { id: 'skeleton-row-2', cells: ['skeleton-cell-2-1', 'skeleton-cell-2-2', 'skeleton-cell-2-3', 'skeleton-cell-2-4', 'skeleton-cell-2-5'] },
      { id: 'skeleton-row-3', cells: ['skeleton-cell-3-1', 'skeleton-cell-3-2', 'skeleton-cell-3-3', 'skeleton-cell-3-4', 'skeleton-cell-3-5'] },
      { id: 'skeleton-row-4', cells: ['skeleton-cell-4-1', 'skeleton-cell-4-2', 'skeleton-cell-4-3', 'skeleton-cell-4-4', 'skeleton-cell-4-5'] },
      { id: 'skeleton-row-5', cells: ['skeleton-cell-5-1', 'skeleton-cell-5-2', 'skeleton-cell-5-3', 'skeleton-cell-5-4', 'skeleton-cell-5-5'] },
    ];
    tableBodyRows = skeletonData.map((row) => (
      <tr key={row.id} className="ta-tr">
        {row.cells.map((cellId) => (
          <td key={cellId} className="ta-td">
            <Skeleton className="h-4 w-full bg-muted/60" />
          </td>
        ))}
      </tr>
    ));
  } else if (employees.length === 0) {
    tableBodyRows = (
      <tr>
        <td colSpan={5} className="ta-td text-muted-foreground">
          {selectedAppId ? 'لا يوجد مناديب مسجّلون في هذه المنصة' : 'لا يوجد مناديب نشطون'}
        </td>
      </tr>
    );
  } else {
    tableBodyRows = employees.map(emp => {
      const record = records[emp.id] ?? {
        status: null, checkIn: "", checkOut: "", note: "", employeeId: emp.id,
      };
      const currentStatus = record.status;
      const selectColor = currentStatus ? STATUS_COLORS[currentStatus] || DEFAULT_COLOR : "";
      const isAddingCustom = addingCustomFor === emp.id;

      return (
        <tr key={emp.id} className="ta-tr">
          {/* Checkbox */}
          <td className="ta-td w-10">
            <button
              type="button"
              onClick={() => toggleSelectEmployee(emp.id)}
              className="p-1 hover:bg-muted rounded transition-colors"
              title="تحديد المندوب"
            >
              {selectedEmployeeIds.has(emp.id) ? (
                <CheckSquare size={18} className="text-primary" />
              ) : (
                <Square size={18} className="text-muted-foreground" />
              )}
            </button>
          </td>

          {/* Name */}
          <td className={`ta-td sticky ${isRTL ? "right-0" : "left-0"} bg-card max-w-[130px]`}>
            <div className="flex items-center gap-2">
              <div>
                <p className="text-sm font-medium text-foreground whitespace-nowrap truncate" title={emp.name}>
                  {toShortEmployeeName(emp.name)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {emp.job_title || (emp.salary_type === "orders" ? "طلبات" : "دوام")}
                </p>
              </div>
            </div>
          </td>

          {/* Status dropdown */}
          <td className="ta-td">
            <div className="flex items-center gap-2">
              {isAddingCustom ? (
                <div className="flex items-center gap-1.5">
                  <Input
                    autoFocus
                    value={customInput}
                    onChange={e => setCustomInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === "Enter") addCustomStatus(emp.id);
                      if (e.key === "Escape") { setAddingCustomFor(null); setCustomInput(""); }
                    }}
                    placeholder="اسم الحالة..."
                    className="h-8 text-xs w-32"
                  />
                  <Button size="sm" className="h-8 text-xs px-2" onClick={() => addCustomStatus(emp.id)}>
                    إضافة
                  </Button>
                  <Button
                    size="sm" variant="ghost" className="h-8 text-xs px-2"
                    onClick={() => { setAddingCustomFor(null); setCustomInput(""); }}
                  >
                    ✕
                  </Button>
                </div>
              ) : (
                <Select
                  value={currentStatus || "__clear__"}
                  disabled={!permissions.can_edit}
                  onValueChange={v => {
                    if (v === "__add_custom__") {
                      setAddingCustomFor(emp.id);
                      setCustomInput("");
                    } else if (v === "__clear__") {
                      updateRecord(emp.id, "status", null);
                    } else {
                      updateRecord(emp.id, "status", v || null);
                    }
                  }}
                >
                  <SelectTrigger
                    className={cn(
                      "h-8 text-xs w-40 border",
                      currentStatus && currentStatus !== "__clear__" ? selectColor : "text-muted-foreground",
                    )}
                  >
                    <SelectValue placeholder="اختر الحالة..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__clear__" className="text-muted-foreground italic">
                      -- تفريغ الحالة --
                    </SelectItem>
                    {allStatuses.map(s => (
                      <SelectItem key={s.value} value={s.value}>
                        <span className={`inline-block px-1.5 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[s.value] || DEFAULT_COLOR}`}>
                          {s.label}
                        </span>
                      </SelectItem>
                    ))}
                    <SelectItem value="__add_custom__" className="text-primary font-medium border-t mt-1">
                      + إضافة حالة جديدة...
                    </SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>
          </td>

          {/* Check in */}
          <td className="ta-td-center">
            <Input
              type="time"
              disabled={!permissions.can_edit}
              value={record.checkIn}
              onChange={e => updateRecord(emp.id, "checkIn", e.target.value)}
              className="w-28 text-sm"
              dir="ltr"
            />
          </td>

          {/* Check out */}
          <td className="ta-td-center">
            <Input
              type="time"
              disabled={!permissions.can_edit}
              value={record.checkOut}
              onChange={e => updateRecord(emp.id, "checkOut", e.target.value)}
              className="w-28 text-sm"
              dir="ltr"
            />
          </td>

          {/* Note */}
          <td className="ta-td">
            <Input
              disabled={!permissions.can_edit}
              placeholder="ملاحظة اختيارية..."
              value={record.note}
              onChange={e => updateRecord(emp.id, "note", e.target.value)}
              className="text-sm min-w-[160px]"
            />
          </td>
        </tr>
      );
    });
  }

  return (
    <div className="space-y-4">
      {/* ── Sub-header: التاريخ اليومي + المندوبين + المنصات + أزرار الحفظ ── */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2 flex-wrap min-w-0 flex-1">
          <span className="text-xs font-medium text-muted-foreground shrink-0">التاريخ اليومي</span>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn("h-9 min-w-[160px] max-w-[200px] justify-start gap-2 font-normal text-sm px-2")}>
                <CalendarIcon size={15} className="shrink-0" />
                <span className="truncate">{format(date, "dd MMMM yyyy", { locale: dateLocale })}</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={date}
                onSelect={d => d && setDate(d)}
                initialFocus
                className="p-3 pointer-events-auto"
                fromDate={new Date(selectedYear, selectedMonth, 1)}
                toDate={new Date(selectedYear, selectedMonth + 1, 0)}
              />
            </PopoverContent>
          </Popover>
          <span className="text-xs text-muted-foreground shrink-0">
            · {employees.length} مندوب{selectedAppId ? ' (مصفّى بالمنصة)' : ' نشط'}
          </span>
          {apps.length > 0 && (
            <>
              <span className="hidden sm:inline text-border mx-0.5 select-none">|</span>
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => setSelectedAppId(null)}
                  className={cn(
                    "px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors leading-tight",
                    selectedAppId === null
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-card text-muted-foreground border-border hover:border-primary/50 hover:text-foreground"
                  )}
                >
                  الكل ({allEmployees.length})
                </button>
                {apps.map(app => {
                  const count = appEmployeeIds[app.id]
                    ? allEmployees.filter(e => appEmployeeIds[app.id]?.has(e.id)).length
                    : 0;
                  const isSelected = selectedAppId === app.id;
                  return (
                    <button
                      type="button"
                      key={app.id}
                      onClick={() => setSelectedAppId(isSelected ? null : app.id)}
                      className={cn(
                        "flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors max-w-[140px] leading-tight",
                        isSelected
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-card text-muted-foreground border-border hover:border-primary/50 hover:text-foreground"
                      )}
                      title={app.name}
                    >
                      {app.logo_url && (
                        <img src={app.logo_url} className="w-3.5 h-3.5 rounded-full object-cover shrink-0" alt="" />
                      )}
                      <span className="truncate">{app.name}</span>
                      <span className="shrink-0">({count})</span>
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
        <div className="flex gap-2 shrink-0">
          {selectedEmployeeIds.size > 0 && permissions.can_edit && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">
                {selectedEmployeeIds.size} محدد
              </span>
              <Select value={bulkStatus} onValueChange={setBulkStatus}>
                <SelectTrigger className="h-9 w-40 text-sm">
                  <SelectValue placeholder="تطبيق حالة..." />
                </SelectTrigger>
                <SelectContent>
                  {allStatuses.map(s => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                onClick={applyBulkStatus}
                disabled={!bulkStatus}
                className="h-9 text-sm"
              >
                تطبيق
              </Button>
              <Button
                variant="ghost"
                onClick={() => setSelectedEmployeeIds(new Set())}
                className="h-9 text-sm"
              >
                إلغاء
              </Button>
            </div>
          )}
          {permissions.can_edit && (
            <Button variant="outline" onClick={markAllPresent} className="gap-2 h-9 text-sm">
              <UserCheck size={16} />
              تسجيل الكل حاضرين
            </Button>
          )}
          {permissions.can_edit && (
            <Button onClick={handleSave} disabled={saving || savedCount === 0} className="gap-2 h-9 text-sm">
              <Save size={16} />
              {saving ? "جاري الحفظ..." : `حفظ (${savedCount})`}
            </Button>
          )}
        </div>
      </div>

      {/* ── Summary pills ── */}
      <div className="flex gap-2 flex-wrap">
        {Object.entries(summary).map(([key, count]) =>
          count > 0 ? (
            <span
              key={key}
              className={`px-3 py-1 rounded-full text-xs font-medium border ${STATUS_COLORS[key] || DEFAULT_COLOR}`}
            >
              {statusLabels[key] || key}: {count}
            </span>
          ) : null,
        )}
        {Object.values(summary).every(v => v === 0) && (
          <span className="text-xs text-muted-foreground">لم يُحدَّد أي حضور بعد</span>
        )}
      </div>

      {/* ── Table ── */}
      <div className="ta-table-wrap shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full" dir={isRTL ? "rtl" : "ltr"}>
            <thead className="ta-thead">
              <tr>
                <th className="ta-th w-10">
                  <button
                    type="button"
                    onClick={toggleSelectAll}
                    className="p-1 hover:bg-muted rounded transition-colors"
                    title="تحديد الكل"
                  >
                    {selectedEmployeeIds.size === employees.length && employees.length > 0 ? (
                      <CheckSquare size={18} className="text-primary" />
                    ) : (
                      <Square size={18} className="text-muted-foreground" />
                    )}
                  </button>
                </th>
                <th className={`ta-th sticky ${isRTL ? "right-0" : "left-0"} bg-muted/40 min-w-[88px] max-w-[130px] text-start`}>
                  المندوب
                </th>
                <th className="ta-th min-w-[200px]">الحالة</th>
                <th className="ta-th-center">وقت الحضور</th>
                <th className="ta-th-center">وقت الانصراف</th>
                <th className="ta-th min-w-[180px]">ملاحظة</th>
              </tr>
            </thead>
            <tbody>
              {tableBodyRows}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default DailyAttendance;
