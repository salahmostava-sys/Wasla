import type React from 'react';
import { ChevronDown } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@shared/components/ui/popover";
import { useLanguage } from "@app/providers/LanguageContext";
import attendanceService from "@services/attendanceService";
import { useQuery } from "@tanstack/react-query";
import { useAuthQueryGate, authQueryUserId } from "@shared/hooks/useAuthQueryGate";

const MONTHS_AR = [
  "يناير",
  "فبراير",
  "مارس",
  "أبريل",
  "مايو",
  "يونيو",
  "يوليو",
  "أغسطس",
  "سبتمبر",
  "أكتوبر",
  "نوفمبر",
  "ديسمبر",
];
const _MONTHS_EN = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const SKELETON_ROW_IDS = ["r1", "r2", "r3", "r4", "r5"];
const SKELETON_CELL_IDS = ["c1", "c2", "c3", "c4", "c5", "c6", "c7", "c8"];


interface Props {
  selectedMonth: number;
  selectedYear: number;
}

const MonthlyRecord = ({ selectedMonth, selectedYear }: Readonly<Props>) => {
  const { isRTL } = useLanguage();
  const MONTHS = MONTHS_AR;
  const { enabled, userId } = useAuthQueryGate();
  const uid = authQueryUserId(userId);

  const monthStr = String(selectedMonth + 1).padStart(2, "0");
  const startDate = `${selectedYear}-${monthStr}-01`;
  const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
  const endDate = `${selectedYear}-${monthStr}-${String(daysInMonth).padStart(2, "0")}`;

  const { data, isLoading: loading } = useQuery({
    queryKey: ['attendance', 'monthly', uid, selectedYear, selectedMonth] as const,
    enabled,
    staleTime: 60_000,
    retry: 1,
    queryFn: async () => {
      const result = await attendanceService.getMonthlyEmployeesAndAttendance(startDate, endDate);
      return {
        employees: (result.employees || []),
        attendanceRows: (result.attendanceRows || []),
      };
    },
  });

  const employees = data?.employees ?? [];
  const attendanceRows = data?.attendanceRows ?? [];

  const tableData = employees.map((emp) => {
    const rows = attendanceRows.filter((r) => r.employee_id === emp.id);
    const presentDays = rows.filter((r) => r.status === "present").length;
    const absentDays = rows.filter((r) => r.status === "absent").length;
    const leaveDays = rows.filter((r) => r.status === "leave").length;
    const sickDays = rows.filter((r) => r.status === "sick").length;
    const lateDays = rows.filter((r) => r.status === "late").length;
    const totalHours = (presentDays + lateDays) * 8;
    const notes = rows
      .filter((r) => r.note?.trim())
      .map((r) => ({ date: r.date ?? '', note: r.note ?? '' }))
      .sort((a, b) => a.date.localeCompare(b.date));
    return { ...emp, presentDays, absentDays, leaveDays, sickDays, lateDays, totalHours, notes };
  });

  const totals = tableData.reduce(
    (acc, d) => ({
      presentDays: acc.presentDays + d.presentDays,
      absentDays: acc.absentDays + d.absentDays,
      leaveDays: acc.leaveDays + d.leaveDays,
      sickDays: acc.sickDays + d.sickDays,
      lateDays: acc.lateDays + d.lateDays,
      totalHours: acc.totalHours + d.totalHours,
    }),
    { presentDays: 0, absentDays: 0, leaveDays: 0, sickDays: 0, lateDays: 0, totalHours: 0 },
  );

  const monthPeriod = `${MONTHS[selectedMonth]} ${selectedYear}`;
  const t = {
    employee: "المندوب",
    nationalId: "رقم الهوية",
    present: "حضور",
    absent: "غياب",
    leave: "إجازة",
    sick: "مريض",
    late: "متأخر",
    hours: "ساعات العمل",
    total: "الإجمالي",
    noData: "لا توجد بيانات لهذا الشهر",
    hoursUnit: "س",
    monthPeriod,
  };
  const stickySideClass = isRTL ? "right-0" : "left-0";
  const stickyAlignClass = isRTL ? "text-right" : "text-left";
  let tableBodyRows: React.ReactNode;
  if (loading) {
    tableBodyRows = SKELETON_ROW_IDS.map((rowId) => (
      <tr key={`row-skeleton-${rowId}`} className="ta-tr">
        {SKELETON_CELL_IDS.map((cellId) => (
          <td key={`cell-skeleton-${rowId}-${cellId}`} className="ta-td">
            <div className="h-4 bg-muted rounded animate-pulse" />
          </td>
        ))}
      </tr>
    ));
  } else if (tableData.length === 0) {
    tableBodyRows = (
      <tr>
        <td colSpan={9} className="p-10 text-center text-muted-foreground">
          {t.noData}
        </td>
      </tr>
    );
  } else {
    tableBodyRows = tableData.map((row) => (
      <tr key={row.id} className="ta-tr">
        <td className={`ta-td sticky ${stickySideClass} bg-card`}>
          <div className="flex items-center gap-2">
            <span className="font-medium text-foreground whitespace-nowrap">{row.name}</span>
          </div>
        </td>
        <td className="ta-td text-muted-foreground font-mono text-xs" dir="ltr">
          {row.national_id || "—"}
        </td>
        <td className="ta-td-center font-semibold text-green-600 dark:text-green-400">{row.presentDays}</td>
        <td className="ta-td-center font-semibold text-destructive">{row.absentDays}</td>
        <td className="ta-td-center font-semibold text-yellow-600 dark:text-yellow-400">{row.leaveDays}</td>
        <td className="ta-td-center font-semibold text-purple-600 dark:text-purple-400">{row.sickDays}</td>
        <td className="ta-td-center text-orange-600 dark:text-orange-400">{row.lateDays}</td>
        <td className="ta-td-center text-muted-foreground">
          {row.totalHours} {t.hoursUnit}
        </td>
        <td className="ta-td-center">
          {row.notes.length > 0 ? (
            <Popover>
              <PopoverTrigger asChild>
                <button className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                  📝 {row.notes.length} ملاحظة
                  <ChevronDown size={10} />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-72 max-h-60 overflow-y-auto p-3" align="center">
                <p className="text-xs font-semibold text-foreground mb-2">ملاحظات {row.name}</p>
                <div className="space-y-2">
                  {row.notes.map((n) => (
                    <div key={`${n.date}-${n.note}`} className="flex gap-2 text-xs border-b border-border/30 pb-1.5 last:border-0">
                      <span className="text-muted-foreground font-mono whitespace-nowrap">{n.date.slice(5)}</span>
                      <span className="text-foreground">{n.note}</span>
                    </div>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          ) : (
            <span className="text-muted-foreground/30">—</span>
          )}
        </td>
      </tr>
    ));
  }

  return (
    <div className="space-y-5">
      <div className="ta-table-wrap shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm" dir={isRTL ? "rtl" : "ltr"}>
            <thead className="ta-thead">
              <tr>
                <th
                  className={`ta-th sticky ${stickySideClass} ${stickyAlignClass} bg-muted/40`}
                >
                  {t.employee}
                </th>
                <th className="ta-th">{t.nationalId}</th>
                <th className="ta-th-center">
                  <span className="badge-success">{t.present}</span>
                </th>
                <th className="ta-th-center">
                  <span className="badge-urgent">{t.absent}</span>
                </th>
                <th className="ta-th-center">
                  <span className="badge-warning">{t.leave}</span>
                </th>
                <th className="ta-th-center">
                  <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
                    {t.sick}
                  </span>
                </th>
                <th className="ta-th-center">
                  <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
                    {t.late}
                  </span>
                </th>
                <th className="ta-th-center">ساعات العمل</th>
                <th className="ta-th-center">الملاحظات</th>
              </tr>
            </thead>
            <tbody>
              {tableBodyRows}
            </tbody>
            {!loading && tableData.length > 0 && (
              <tfoot>
                <tr className="bg-muted/40 font-semibold border-t-2 border-border">
                  <td className={`ta-td sticky ${stickySideClass} bg-muted/40 text-foreground`}>
                    {t.total}
                  </td>
                  <td className="ta-td" />
                  <td className="ta-td-center text-green-600 dark:text-green-400">{totals.presentDays}</td>
                  <td className="ta-td-center text-destructive">{totals.absentDays}</td>
                  <td className="ta-td-center text-yellow-600 dark:text-yellow-400">{totals.leaveDays}</td>
                  <td className="ta-td-center text-purple-600 dark:text-purple-400">{totals.sickDays}</td>
                  <td className="ta-td-center text-orange-600 dark:text-orange-400">{totals.lateDays}</td>
                  <td className="ta-td-center text-muted-foreground">
                    {totals.totalHours} {t.hoursUnit}
                  </td>
                  <td className="ta-td" />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
};

export default MonthlyRecord;
