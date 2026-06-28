import { useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { createDefaultGlobalFilters } from '@shared/components/table/GlobalTableFilters';
import type { DailyRow, MonthlyRow } from '@modules/fuel/types/fuel.types';
import { DAY_NAMES } from '@modules/fuel/types/fuel.types';

export function useFuelTable(args: {
  view: 'monthly' | 'daily' | 'spreadsheet';
  filteredMonthly: MonthlyRow[];
  filteredDaily: DailyRow[];
  selectedMonth: string;
  selectedYear: string;
}) {
  const {
    filteredMonthly,
    filteredDaily,
    selectedMonth,
    selectedYear,
  } = args;

  const tableRef = useRef<HTMLTableElement>(null);
  const [fastDailyPage, setFastDailyPage] = useState(1);
  const [fastDailyPageSize] = useState(50);
  const [fastDailyFilters, setFastDailyFilters] = useState(() => createDefaultGlobalFilters());

  const handleExportMonthly = () => {
    const data = filteredMonthly.map(r => ({
      'الاسم': r.employee_name,
      'أيام مسجلة': r.daily_count,
      'الكيلومترات': r.km_total,
      'تكلفة البنزين (ر.س)': r.fuel_cost,
      'تكلفة/كم (ر.س)': r.km_total > 0 ? (r.fuel_cost / r.km_total).toFixed(3) : '',
      'عدد الطلبات': r.orders_count,
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'ملخص شهري');
    XLSX.writeFile(wb, `ملخص_الاستهلاك_${selectedMonth}_${selectedYear}.xlsx`);
  };

  const handleExportDaily = () => {
    const data = filteredDaily.map(r => ({
      'التاريخ': r.date,
      'اليوم': DAY_NAMES[new Date(r.date + 'T12:00:00').getDay()],
      'الاسم': r.employee?.name ?? '',
      'الكيلومترات': r.km_total,
      'تكلفة البنزين (ر.س)': r.fuel_cost,
      'ملاحظات': r.notes ?? '',
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'إدخالات يومية');
    XLSX.writeFile(wb, `إدخالات_يومية_${selectedMonth}_${selectedYear}.xlsx`);
  };

  return {
    tableRef,
    handleExportMonthly,
    handleExportDaily,
    fastDailyPage,
    setFastDailyPage,
    fastDailyPageSize,
    fastDailyFilters,
    setFastDailyFilters,
  };
}
