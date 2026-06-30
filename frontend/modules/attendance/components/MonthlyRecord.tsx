import type React from 'react';
import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, FileText, Search } from "lucide-react";
import { useLanguage } from "@app/providers/LanguageContext";
import { authQueryUserId, useAuthQueryGate } from "@shared/hooks/useAuthQueryGate";
import attendanceService from "@services/attendanceService";
import { toast } from "@shared/components/ui/sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@shared/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@shared/components/ui/select";
import { Input } from "@shared/components/ui/input";
import { Label } from "@shared/components/ui/label";
import { Textarea } from "@shared/components/ui/textarea";
import { Button } from "@shared/components/ui/button";
import { cn } from "@shared/lib/utils";
import { buildAttendanceGridData } from "../lib/attendanceDomain";

export type AttendanceStatus = 'present' | 'absent' | 'leave' | 'sick' | 'late' | 'none';

export interface CellData {
  employee_id: string;
  status: AttendanceStatus;
  note: string | null;
  date: string;
  check_in: string | null;
  check_out: string | null;
}

export interface Employee {
  id: string;
  name: string;
}

interface MonthlyRecordProps {
  selectedMonth: number;
  selectedYear: number;
}

const STATUS_MAP: Record<AttendanceStatus, { color: string; label: string; char: string }> = {
  present: { color: 'text-green-700 bg-green-100/50', label: 'حضور', char: 'ح' },
  absent: { color: 'text-destructive bg-destructive/10', label: 'غياب', char: 'غ' },
  leave: { color: 'text-yellow-700 bg-yellow-100/50', label: 'إجازة', char: 'ج' },
  sick: { color: 'text-purple-700 bg-purple-100/50', label: 'مريض', char: 'م' },
  late: { color: 'text-orange-700 bg-orange-100/50', label: 'متأخر', char: 'ت' },
  none: { color: 'text-muted-foreground bg-transparent', label: 'غير محدد', char: '-' }
};

const CellEditorDialog = ({ 
  open, 
  onOpenChange, 
  employeeName, 
  dateStr, 
  initialData, 
  onSave,
  isSaving
}: { 
  open: boolean, 
  onOpenChange: (o: boolean) => void,
  employeeName: string,
  dateStr: string,
  initialData: CellData | null,
  onSave: (data: Partial<CellData>) => void,
  isSaving: boolean
}) => {
  const [status, setStatus] = useState<AttendanceStatus>(initialData?.status && initialData.status !== 'none' ? initialData.status : 'present');
  const [note, setNote] = useState(initialData?.note || '');
  const [checkIn, setCheckIn] = useState(initialData?.check_in || '');
  const [checkOut, setCheckOut] = useState(initialData?.check_out || '');
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-start leading-relaxed text-foreground">
            تعديل الحضور - {employeeName}
            <div className="text-sm font-normal text-muted-foreground mt-1" dir="ltr">{dateStr}</div>
          </DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <Label>الحالة</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as AttendanceStatus)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="present">✅ حضور</SelectItem>
                <SelectItem value="absent">❌ غياب</SelectItem>
                <SelectItem value="leave">🏝️ إجازة</SelectItem>
                <SelectItem value="sick">🤒 مريض</SelectItem>
                <SelectItem value="late">⏳ متأخر</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>وقت الحضور</Label>
              <Input type="time" value={checkIn} onChange={e => setCheckIn(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>وقت الانصراف</Label>
              <Input type="time" value={checkOut} onChange={e => setCheckOut(e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>ملاحظات</Label>
            <Textarea value={note} onChange={e => setNote(e.target.value)} placeholder="أضف ملاحظة (اختياري)..." />
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>إلغاء</Button>
          <Button onClick={() => onSave({ status, note, check_in: checkIn, check_out: checkOut })} disabled={isSaving}>
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin ms-2" /> : null}
            حفظ السجل
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

const MonthlyRecord = ({ selectedMonth, selectedYear }: Readonly<MonthlyRecordProps>) => {
  const { isRTL } = useLanguage();
  const { enabled, userId } = useAuthQueryGate();
  const uid = authQueryUserId(userId);
  const queryClient = useQueryClient();

  const monthStr = String(selectedMonth + 1).padStart(2, "0");
  const startDate = `${selectedYear}-${monthStr}-01`;
  const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
  const endDate = `${selectedYear}-${monthStr}-${String(daysInMonth).padStart(2, "0")}`;
  const daysArray = useMemo(() => Array.from({ length: daysInMonth }, (_, i) => i + 1), [daysInMonth]);

  const queryKey = ['attendance', 'monthly', uid, selectedYear, selectedMonth] as const;

  const { data, isLoading } = useQuery({
    queryKey,
    enabled,
    staleTime: 60_000,
    queryFn: async () => {
      const result = await attendanceService.getMonthlyEmployeesAndAttendance(startDate, endDate);
      return {
        employees: result.employees || [],
        attendanceRows: result.attendanceRows || [],
        apps: result.apps || [],
        employeeApps: result.employeeApps || [],
      };
    },
  });

  const [editingCell, setEditingCell] = useState<{
    empId: string;
    empName: string;
    day: number;
    record: CellData | null;
  } | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAppId, setSelectedAppId] = useState<string>('all');

  const mutation = useMutation({
    mutationFn: async (payload: {
      employee_id: string;
      date: string;
      status: 'present' | 'absent' | 'leave' | 'sick' | 'late';
      check_in: string | null;
      check_out: string | null;
      note: string | null;
    }) => {
      await attendanceService.upsertDailyAttendance(payload);
    },
    onSuccess: () => {
      toast.success("تم الحفظ بنجاح", { style: { background: "var(--ds-surface-container)", color: "var(--ds-on-surface)" } as React.CSSProperties });
      queryClient.invalidateQueries({ queryKey });
      setEditingCell(null);
    },
    onError: () => {
      toast.error("حدث خطأ أثناء الحفظ", { style: { background: "var(--destructive)", color: "white" } as React.CSSProperties });
    }
  });

  const gridData = useMemo(() => {
    const employees = (data?.employees ?? []) as Employee[];
    const attendanceRows = (data?.attendanceRows ?? []) as CellData[];
    return buildAttendanceGridData(employees, attendanceRows);
  }, [data]);

  const filteredGridData = useMemo(() => {
    let result = gridData;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(r => r.name.toLowerCase().includes(q));
    }
    if (selectedAppId !== 'all') {
      const empIdsWithApp = new Set(
        (data?.employeeApps ?? [])
          .filter((ea: unknown) => ea.app_id === selectedAppId)
          .map((ea: unknown) => ea.employee_id)
      );
      result = result.filter(r => empIdsWithApp.has(r.id));
    }
    return result;
  }, [gridData, searchQuery, selectedAppId, data?.employeeApps]);

  if (isLoading) {
    return <div className="flex items-center justify-center p-12 text-muted-foreground"><Loader2 className="animate-spin w-8 h-8" /></div>;
  }

  if (gridData.length === 0) {
    return (
      <div className="flex items-center justify-center p-12 text-muted-foreground bg-card rounded-xl border border-border">
        لا توجد بيانات لهذا الشهر
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <Input
            placeholder="ابحث باسم الموظف..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pr-9"
          />
        </div>
        <Select value={selectedAppId} onValueChange={setSelectedAppId}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="تصفية بالتطبيق" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل التطبيقات</SelectItem>
            {(data?.apps || []).map((app: unknown) => (
              <SelectItem key={app.id} value={app.id}>{app.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-xl border border-border shadow-sm overflow-hidden bg-card">
        <div className="overflow-x-auto custom-sidebar-scroll pb-2">
          <table className="w-full text-[13px] border-collapse" dir={isRTL ? "rtl" : "ltr"}>
            <thead>
              <tr>
                <th className="sticky right-0 z-20 bg-muted/90 p-3 min-w-[160px] text-start border-b border-l border-border backdrop-blur shadow-[1px_0_0_hsl(var(--border))] text-foreground">
                  الموظف
                </th>
                {daysArray.map(d => (
                  <th key={d} className="p-2 min-w-[36px] text-center border-b border-l border-border bg-muted/40 font-semibold text-muted-foreground">
                    {d}
                  </th>
                ))}
                <th className="p-3 min-w-[45px] text-center border-b border-border bg-green-500/10 text-green-700 dark:text-green-400 font-bold" title="حضور">ح</th>
                <th className="p-3 min-w-[45px] text-center border-b border-border bg-destructive/10 text-destructive font-bold" title="غياب">غ</th>
                <th className="p-3 min-w-[45px] text-center border-b border-border bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 font-bold" title="إجازة">ج</th>
                <th className="p-3 min-w-[45px] text-center border-b border-border bg-purple-500/10 text-purple-700 dark:text-purple-400 font-bold" title="مريض">م</th>
                <th className="p-3 min-w-[45px] text-center border-b border-border bg-orange-500/10 text-orange-700 dark:text-orange-400 font-bold" title="متأخر">ت</th>
              </tr>
            </thead>
            <tbody>
              {filteredGridData.length === 0 ? (
                <tr>
                  <td colSpan={daysArray.length + 6} className="p-8 text-center text-muted-foreground">
                    لا يوجد موظفين مطابقين للبحث
                  </td>
                </tr>
              ) : (
                filteredGridData.map(row => (
                  <tr key={row.id} className="hover:bg-muted/30 transition-colors">
                    <td className="sticky right-0 z-10 bg-card p-3 text-start border-b border-l border-border font-medium shadow-[1px_0_0_hsl(var(--border))] text-foreground">
                      <div className="truncate w-full max-w-[140px]" title={row.name}>{row.name}</div>
                    </td>
                    {daysArray.map(d => {
                      const record = row.recordByDay[d];
                      const status = record?.status || 'none';
                      const config = STATUS_MAP[status];
                      const hasNote = !!record?.note;

                      return (
                        <td key={d} className="p-0 border-b border-l border-border relative align-middle">
                          <button
                            onClick={() => setEditingCell({ empId: row.id, empName: row.name, day: d, record: record || null })}
                            className={cn(
                              "w-full h-[40px] flex items-center justify-center transition-colors relative hover:bg-muted/80 focus:outline-none",
                              config.color
                            )}
                            title={`${row.name} - يوم ${d} - ${config.label}`}
                          >
                            <span className={cn("font-bold text-xs", status === 'none' && "text-muted-foreground/30")}>
                              {config.char}
                            </span>
                            
                            {hasNote && (
                              <div className="absolute top-0.5 right-0.5 text-primary">
                                <FileText size={10} className="opacity-80" />
                              </div>
                            )}
                          </button>
                        </td>
                      );
                    })}
                    <td className="p-3 text-center border-b border-border font-bold text-green-600 bg-green-500/5">{row.summary.presentCount || '-'}</td>
                    <td className="p-3 text-center border-b border-border font-bold text-destructive bg-destructive/5">{row.summary.absentCount || '-'}</td>
                    <td className="p-3 text-center border-b border-border font-bold text-yellow-600 bg-yellow-500/5">{row.summary.leaveCount || '-'}</td>
                    <td className="p-3 text-center border-b border-border font-bold text-purple-600 bg-purple-500/5">{row.summary.sickCount || '-'}</td>
                    <td className="p-3 text-center border-b border-border font-bold text-orange-600 bg-orange-500/5">{row.summary.lateCount || '-'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {editingCell && (
        <CellEditorDialog 
          key={`${editingCell.empId}-${editingCell.day}`}
          open={!!editingCell} 
          onOpenChange={(open) => !open && setEditingCell(null)}
          employeeName={editingCell.empName}
          dateStr={`${selectedYear}-${monthStr}-${String(editingCell.day).padStart(2, "0")}`}
          initialData={editingCell.record}
          isSaving={mutation.isPending}
          onSave={(data) => {
             if (data.status === 'none') return; 
             mutation.mutate({
               employee_id: editingCell.empId,
               date: `${selectedYear}-${monthStr}-${String(editingCell.day).padStart(2, "0")}`,
               status: data.status as 'present' | 'absent' | 'leave' | 'sick' | 'late',
               check_in: data.check_in || null,
               check_out: data.check_out || null,
               note: data.note || null
             });
          }}
        />
      )}
    </div>
  );
};

export default MonthlyRecord;
