import { useMemo, useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthQueryGate, authQueryUserId } from '@shared/hooks/useAuthQueryGate';
import { useTemporalContext } from '@app/providers/TemporalContext';
import { useSpreadsheetQueries } from '@modules/orders/hooks/useSpreadsheetQueries';
import { useMonthlyActiveEmployeeIds } from '@shared/hooks/useMonthlyActiveEmployeeIds';
import { getDaysInMonth, monthYear } from '@modules/orders/utils/dateMonth';
import { exportDailyAppReportExcel, printDailyAppReportTable } from '@modules/orders/utils/spreadsheetFileOps';
import { toast } from '@shared/components/ui/sonner';
import { getErrorMessage } from '@services/serviceError';
import { useAppColors } from '@shared/hooks/useAppColors';
import { useQuery } from '@tanstack/react-query';
import { recommendationsService } from '@services/recommendationsService';

export function useDailyAppReportTab() {
  const { enabled, userId } = useAuthQueryGate();
  const uid = authQueryUserId(userId);
  const { selectedMonth: globalMonth, setSelectedMonth: setGlobalMonth } = useTemporalContext();
  const { getAppColor } = useAppColors();

  const [yearStr, monthStr] = globalMonth.split('-');
  const year = Number(yearStr);
  const month = Number(monthStr);

  const monthKey = monthYear(year, month);
  const { data: activeIdsData } = useMonthlyActiveEmployeeIds(monthKey);
  const activeEmployeeIdsInMonth = activeIdsData?.orderEmployeeIds;

  const sq = useSpreadsheetQueries(uid, enabled, year, month, activeEmployeeIdsInMonth);
  const daysInMonth = getDaysInMonth(year, month);

  const [selectedApp, setSelectedApp] = useState<string>('');
  const [startDay, setStartDay] = useState<number>(1);
  const [endDay, setEndDay] = useState<number>(daysInMonth);

  // Auto select first app if not selected
  useEffect(() => {
    if (sq.apps.length > 0 && !selectedApp) {
      setSelectedApp(sq.apps[0].id);
    }
  }, [sq.apps, selectedApp]);

  // Handle month change adjusting endDay if it exceeds days in new month
  useEffect(() => {
    if (endDay > daysInMonth) {
      setEndDay(daysInMonth);
    }
  }, [daysInMonth, endDay]);

  const { data: recommendationsMap = new Map<string, string>() } = useQuery({
    queryKey: ['recommendations', monthKey, selectedApp],
    enabled: enabled && !!selectedApp,
    queryFn: async () => {
      const recs = await recommendationsService.getByMonthApp(monthKey, selectedApp);
      const map = new Map<string, string>();
      for (const r of recs) {
        if (r.note && r.note.trim()) map.set(r.employee_id, r.note.trim());
      }
      return map;
    },
  });

  const exportExcel = async () => {
    if (!selectedApp) return;
    try {
      await exportDailyAppReportExcel({
        year, month, startDay, endDay, appId: selectedApp,
        employees: sq.employees,
        data: sq.spreadsheetMonthData,
        apps: sq.apps
      });
    } catch (e: unknown) {
      toast.error('حدث خطأ أثناء تصدير ملف الإكسل', { description: getErrorMessage(e) });
    }
  };

  const printPdf = async () => {
    if (!selectedApp) return;
    try {
      await printDailyAppReportTable({
        year, month, startDay, endDay, appId: selectedApp,
        employees: sq.employees,
        data: sq.spreadsheetMonthData,
        apps: sq.apps
      });
    } catch (e: unknown) {
      toast.error('حدث خطأ أثناء التجهيز للطباعة', { description: getErrorMessage(e) });
    }
  };

  const nextMonth = () => {
    const d = new Date(year, month, 1);
    const ny = d.getFullYear();
    const nm = d.getMonth() + 1;
    setGlobalMonth(`${ny}-${String(nm).padStart(2, '0')}`);
  };

  const prevMonth = () => {
    const d = new Date(year, month - 2, 1);
    const ny = d.getFullYear();
    const nm = d.getMonth() + 1;
    setGlobalMonth(`${ny}-${String(nm).padStart(2, '0')}`);
  };

  // Build report data to preview
  const previewData = useMemo(() => {
    if (!selectedApp || sq.loading) return [];
    const reportData = [];
    const dayArr = Array.from({ length: endDay - startDay + 1 }, (_, i) => startDay + i);

    for (const emp of sq.employees) {
      let total = 0;
      let hasAnyOrdersInPeriod = false;
      const dailyVals: number[] = [];

      for (const d of dayArr) {
        const val = sq.spreadsheetMonthData[`${emp.id}::${selectedApp}::${d}`] ?? 0;
        dailyVals.push(val);
        total += val;
        if (val > 0) hasAnyOrdersInPeriod = true;
      }

      const note = recommendationsMap.get(emp.id) || '';

      if (hasAnyOrdersInPeriod || note) {
        reportData.push({
          empName: emp.name,
          dailyVals,
          total,
          note,
        });
      }
    }

    // Sort descending by total
    reportData.sort((a, b) => b.total - a.total);
    return reportData;
  }, [selectedApp, sq.loading, sq.employees, sq.spreadsheetMonthData, startDay, endDay, recommendationsMap]);

  return {
    loading: sq.loading,
    apps: sq.apps,
    year,
    month,
    daysInMonth,
    selectedApp,
    setSelectedApp,
    startDay,
    setStartDay,
    endDay,
    setEndDay,
    exportExcel,
    printPdf,
    prevMonth,
    nextMonth,
    previewData,
    getAppColor,
  };
}
