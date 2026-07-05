import React, { useState } from 'react';
import { Loader2, ShieldAlert, UploadCloud } from 'lucide-react';
import { useFuelPage } from '@modules/fuel/hooks/useFuelPage';
import { FuelPageHeader } from '@modules/fuel/components/FuelPageHeader';
import { FuelFiltersToolbar, FuelPlatformTabs } from '@modules/fuel/components/FuelFilters';
import { FuelMonthlyStats } from '@modules/fuel/components/FuelStats';
import { FuelMetricTable } from '@modules/fuel/components/FuelMetricTable';
import { FuelImportDialog } from '@modules/fuel/components/FuelImportDialog';
import { Card, CardContent } from '@shared/components/ui/card';
import { Button } from '@shared/components/ui/button';
import type { DailyRow, MonthlyRow } from '@modules/fuel/types/fuel.types';
import { useAuthQueryGate } from '@shared/hooks/useAuthQueryGate';

type PageTab = 'summary' | 'fuel' | 'km';

const PAGE_TABS: { key: PageTab; label: string }[] = [
  { key: 'summary', label: 'الملخص' },
  { key: 'fuel', label: 'البنزين' },
  { key: 'km', label: 'الكيلومترات' },
];

function FuelPageTabs({ pageTab, setPageTab }: Readonly<{ pageTab: PageTab; setPageTab: (v: PageTab) => void }>) {
  return (
    <div className="flex flex-wrap gap-2 items-center border-b border-border/50 pb-2">
      {PAGE_TABS.map((t) => (
        <button
          key={t.key}
          type="button"
          onClick={() => setPageTab(t.key)}
          className={`px-4 py-1.5 rounded-lg text-sm font-semibold border transition-colors ${pageTab === t.key ? 'bg-primary text-primary-foreground border-primary' : 'bg-card border-border hover:bg-muted/50'}`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

/* ─── Mega Spreadsheet Table ──────────────────────────────────────── */
function MegaSpreadsheetTable({
  monthly,
  daily,
  dailyOrderRows,
  monthYear,
}: Readonly<{
  monthly: MonthlyRow[];
  daily: DailyRow[];
  dailyOrderRows: { employee_id: string; date: string; orders_count: number }[];
  monthYear: string;
}>) {
  const [year, month] = monthYear.split('-').map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  // Group daily records by employee -> day
  const dailyDataByEmpDay: Record<string, Record<number, { km: number; fuel: number }>> = {};
  daily.forEach((r) => {
    const d = new Date(`${r.date}T12:00:00`).getDate();
    if (!dailyDataByEmpDay[r.employee_id]) dailyDataByEmpDay[r.employee_id] = {};
    const existing = dailyDataByEmpDay[r.employee_id][d] || { km: 0, fuel: 0 };
    dailyDataByEmpDay[r.employee_id][d] = {
      km: existing.km + r.km_total,
      fuel: existing.fuel + r.fuel_cost,
    };
  });

  // Group orders by employee -> day
  const ordersByEmpDay: Record<string, Record<number, number>> = {};
  dailyOrderRows.forEach((r) => {
    const d = new Date(`${r.date}T12:00:00`).getDate();
    if (!ordersByEmpDay[r.employee_id]) ordersByEmpDay[r.employee_id] = {};
    ordersByEmpDay[r.employee_id][d] = (ordersByEmpDay[r.employee_id][d] || 0) + Number(r.orders_count);
  });

  if (monthly.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground text-sm">
        لا توجد بيانات لهذا الشهر
      </div>
    );
  }

  return (
    <div className="overflow-x-auto relative scrollbar-thin pb-4">
      <table className="w-full text-[11px] border-collapse" style={{ minWidth: `${daysInMonth * 120 + 200}px` }}>
        <thead className="sticky top-0 z-30">
          <tr className="bg-muted border-b border-border/40">
            <th rowSpan={2} className="ta-th text-start font-medium sticky right-0 bg-muted z-30 min-w-[150px] border-l-2 border-border/50">
              المندوب
            </th>
            {days.map((d) => (
              <th key={d} colSpan={3} className="text-center py-1.5 border-l-2 border-border/40 font-bold bg-muted">
                اليوم {d}
              </th>
            ))}
            <th colSpan={3} className="text-center py-1.5 border-border/40 font-bold bg-primary/10 text-primary shadow-sm">
              الإجمالي
            </th>
          </tr>
          <tr className="bg-muted border-b-2 border-border/60">
            {days.map((d) => (
              <React.Fragment key={`sub-${d}`}>
                <th className="ta-th px-1 py-1.5 font-medium text-center border-l border-border/20 min-w-[40px] text-orange-600 dark:text-orange-400">بنزين</th>
                <th className="ta-th px-1 py-1.5 font-medium text-center border-l border-border/20 min-w-[40px] text-info">طلبات</th>
                <th className="ta-th px-1 py-1.5 font-medium text-center border-l-2 border-border/40 min-w-[40px] text-foreground">كم</th>
              </React.Fragment>
            ))}
            {/* Totals */}
            <th className="ta-th px-1 py-1.5 font-bold text-center border-l border-primary/20 bg-primary/5 min-w-[50px] text-primary">بنزين</th>
            <th className="ta-th px-1 py-1.5 font-bold text-center border-l border-primary/20 bg-primary/5 min-w-[50px] text-primary">طلبات</th>
            <th className="ta-th px-1 py-1.5 font-bold text-center bg-primary/5 min-w-[50px] text-primary">كم</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/30">
          {monthly.map((row, idx) => (
            <tr key={row.employee_id} className={`hover:bg-muted/30 transition-colors ${idx % 2 === 1 ? 'bg-muted/10' : ''}`}>
              <td className={`ta-td font-semibold sticky right-0 border-l-2 border-border/50 z-10 whitespace-nowrap ${idx % 2 === 1 ? 'bg-muted/10 backdrop-blur-sm' : 'bg-card'}`}>
                {row.employee_name}
              </td>
              {days.map((d) => {
                const fuel = dailyDataByEmpDay[row.employee_id]?.[d]?.fuel || 0;
                const orders = ordersByEmpDay[row.employee_id]?.[d] || 0;
                const km = dailyDataByEmpDay[row.employee_id]?.[d]?.km || 0;
                const isWeekend = new Date(year, month - 1, d).getDay() === 5 || new Date(year, month - 1, d).getDay() === 6;
                const bgClass = isWeekend ? 'bg-muted/30' : '';
                return (
                  <React.Fragment key={d}>
                    <td className={`ta-td text-center border-l border-border/20 font-mono ${bgClass}`}>
                      {fuel > 0 ? <span className="font-medium text-orange-600 dark:text-orange-400">{fuel}</span> : <span className="text-muted-foreground/30">·</span>}
                    </td>
                    <td className={`ta-td text-center border-l border-border/20 font-mono ${bgClass}`}>
                      {orders > 0 ? <span className="font-medium text-info">{orders}</span> : <span className="text-muted-foreground/30">·</span>}
                    </td>
                    <td className={`ta-td text-center border-l-2 border-border/40 font-mono ${bgClass}`}>
                      {km > 0 ? <span className="font-medium text-foreground">{km}</span> : <span className="text-muted-foreground/30">·</span>}
                    </td>
                  </React.Fragment>
                );
              })}
              {/* Row Totals */}
              <td className="ta-td text-center border-l border-border/20 font-mono font-bold bg-primary/5 text-primary">{row.fuel_cost.toLocaleString('en-US')}</td>
              <td className="ta-td text-center border-l border-border/20 font-mono font-bold bg-primary/5 text-primary">{row.orders_count.toLocaleString('en-US')}</td>
              <td className="ta-td text-center font-mono font-bold bg-primary/5 text-primary">{row.km_total.toLocaleString('en-US')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ─── Main Page ──────────────────────────────────────────────── */
export default function FuelPage() {
  const { authLoading } = useAuthQueryGate();
  const page = useFuelPage();
  const [pageTab, setPageTab] = useState<PageTab>('summary');
  const [importOpen, setImportOpen] = useState(false);

  if (authLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={28} className="animate-spin text-primary" />
      </div>
    );
  }

  if (!page.permissions.can_view) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
        <ShieldAlert size={40} className="text-destructive" />
        <p className="text-lg font-semibold">غير مصرح بالوصول</p>
        <p className="text-sm text-muted-foreground">ليس لديك صلاحية الوصول لصفحة استهلاك الوقود</p>
      </div>
    );
  }

  const {
    view, setView,
    selectedMonth,
    selectedYear,
    search, setSearch,
    platformTab, setPlatformTab,
    apps,
    employees,
    monthYear,
    loading,
    filteredMonthly, filteredDaily,
    dailyRows,
    totalKm, totalFuel, totalOrders, avgCostPerKm,
    handleExportMonthly, handleExportDaily,
    dailyOrderRows,
    saveMetricCell,
    bulkUpsertDailyMileage,
    permissions,
  } = page;

  const [year, month] = monthYear.split('-').map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();
  const dayArr = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const activeMetric: 'km' | 'fuel' = pageTab === 'km' ? 'km' : 'fuel';

  return (
    <div className="flex flex-col gap-4 w-full max-w-[1600px] overflow-hidden" dir="rtl">
      <FuelPageHeader
        view={view}
        onViewChange={setView}
        selectedMonth={selectedMonth}
        selectedYear={selectedYear}
        toolbarEnd={
          <div className="flex items-center gap-2">
            {pageTab !== 'summary' && permissions.can_edit && (
              <Button variant="outline" size="sm" className="gap-1.5 h-8 text-xs" onClick={() => setImportOpen(true)}>
                <UploadCloud size={14} /> رفع ملف كامل
              </Button>
            )}
            <FuelFiltersToolbar
              search={search}
              setSearch={setSearch}
              view={view}
              handleExportMonthly={handleExportMonthly}
              handleExportDaily={handleExportDaily}
              onOpenImport={() => page.setShowImport(true)}
            />
          </div>
        }
      />

      <FuelPageTabs pageTab={pageTab} setPageTab={setPageTab} />

      {pageTab === 'summary' && apps.length > 1 && (
        <FuelPlatformTabs
          platformTab={platformTab}
          setPlatformTab={setPlatformTab}
          apps={apps}
        />
      )}

      {/* Top Stats: Totals for the month */}
      <FuelMonthlyStats
        totalKm={totalKm}
        totalFuel={totalFuel}
        avgCostPerKm={avgCostPerKm}
        totalOrders={totalOrders}
      />

      <Card className="border-border/60 shadow-sm overflow-hidden">
        <CardContent className="p-0">
          {loading && (
            <div className="flex items-center justify-center py-20">
              <Loader2 size={24} className="animate-spin text-primary" />
            </div>
          )}
          {!loading && pageTab === 'summary' && (
            <MegaSpreadsheetTable
              monthly={filteredMonthly}
              daily={filteredDaily}
              dailyOrderRows={dailyOrderRows}
              monthYear={monthYear}
            />
          )}
          {!loading && pageTab !== 'summary' && (
            <FuelMetricTable
              metric={activeMetric}
              employees={employees}
              dailyRows={dailyRows}
              year={year}
              month={month}
              search={search}
              canEdit={permissions.can_edit}
              onSaveCell={saveMetricCell}
            />
          )}
        </CardContent>
      </Card>

      <FuelImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        metric={activeMetric}
        dayArr={dayArr}
        year={year}
        month={month}
        employees={employees}
        dailyRows={dailyRows}
        bulkUpsertDailyMileage={bulkUpsertDailyMileage}
        onImported={() => page.refetch()}
      />
    </div>
  );
}
