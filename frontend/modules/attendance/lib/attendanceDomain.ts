import type { Employee, CellData } from '../components/MonthlyRecord';

export type EmployeeGridRow = Employee & {
  recordByDay: Record<number, CellData>;
  summary: {
    presentCount: number;
    absentCount: number;
    leaveCount: number;
    sickCount: number;
    lateCount: number;
    totalHours: number;
  };
};

export function buildAttendanceGridData(
  employees: Employee[],
  attendanceRows: CellData[]
): EmployeeGridRow[] {
  return employees.map((emp) => {
    const empRows = attendanceRows.filter((r) => r.employee_id === emp.id);
    const recordByDay: Record<number, CellData> = {};
    let presentCount = 0, absentCount = 0, leaveCount = 0, sickCount = 0, lateCount = 0;
    
    empRows.forEach(r => {
      const day = Number.parseInt(r.date.split('-')[2], 10);
      recordByDay[day] = r;
      if (r.status === 'present') presentCount++;
      if (r.status === 'absent') absentCount++;
      if (r.status === 'leave') leaveCount++;
      if (r.status === 'sick') sickCount++;
      if (r.status === 'late') lateCount++;
    });
    
    return { 
      ...emp, 
      recordByDay, 
      summary: { 
        presentCount, 
        absentCount, 
        leaveCount, 
        sickCount, 
        lateCount, 
        totalHours: (presentCount + lateCount) * 8 
      } 
    };
  });
}
