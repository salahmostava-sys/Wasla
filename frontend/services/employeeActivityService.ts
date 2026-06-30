import { format } from 'date-fns';
import { supabase } from '@services/supabase/client';
import { handleSupabaseError } from '@services/serviceError';

export type MonthlyActiveEmployeeIdsResult = {
  monthKey: string;
  employeeIds: Set<string>;
  orderEmployeeIds: Set<string>;
};

export function toMonthKey(date: Date): string {
  return format(date, 'yyyy-MM');
}

export function monthStartEnd(monthKey: string): { start: string; end: string } {
  const [yearText, monthText] = monthKey.split('-');
  const year = Number(yearText);
  const monthIndex = Number(monthText) - 1;
  const start = format(new Date(year, monthIndex, 1), 'yyyy-MM-dd');
  const end = format(new Date(year, monthIndex + 1, 0), 'yyyy-MM-dd');
  return { start, end };
}

export const employeeActivityService = {
  getMonthlyActiveEmployeeIds: async (monthKey: string): Promise<MonthlyActiveEmployeeIdsResult> => {
    const { start, end } = monthStartEnd(monthKey);

    const PAGE_SIZE = 1000;

    const fetchAllIds = async (table: string, dateCol: string, isEq = false) => {
      const allRows: { employee_id: string }[] = [];
      let offset = 0;
      let hasMore = true;
      while (hasMore) {
        let q = supabase.from(table).select('employee_id');
        if (isEq) q = q.eq(dateCol, monthKey);
        else q = q.gte(dateCol, start).lte(dateCol, end);
        
        const { data, error } = await q.range(offset, offset + PAGE_SIZE - 1);
        if (error) handleSupabaseError(error, `employeeActivityService.getMonthlyActiveEmployeeIds.${table}`);
        const rows = data ?? [];
        allRows.push(...rows);
        if (rows.length < PAGE_SIZE) hasMore = false;
        else offset += PAGE_SIZE;
      }
      return allRows;
    };

    const [ordersData, shiftsData, attendanceData, salariesData] = await Promise.all([
      fetchAllIds('daily_orders', 'date'),
      fetchAllIds('daily_shifts', 'date'),
      fetchAllIds('attendance', 'date'),
      fetchAllIds('salary_records', 'month_year', true),
    ]);

    const employeeIds = new Set<string>();
    const orderEmployeeIds = new Set<string>();

    ordersData.forEach((row) => {
      if (!row.employee_id) return;
      employeeIds.add(row.employee_id);
      orderEmployeeIds.add(row.employee_id);
    });

    shiftsData.forEach((row) => {
      if (row.employee_id) employeeIds.add(row.employee_id);
    });

    attendanceData.forEach((row) => {
      if (row.employee_id) employeeIds.add(row.employee_id);
    });

    salariesData.forEach((row) => {
      if (row.employee_id) employeeIds.add(row.employee_id);
    });

    return {
      monthKey,
      employeeIds,
      orderEmployeeIds,
    };
  },
};
