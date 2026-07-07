import React from 'react';
import { Printer, FileSpreadsheet, FileText } from 'lucide-react';
import { OrdersMonthNavigator } from '@shared/components/orders/OrdersMonthNavigator';
import { monthLabel } from '@modules/orders/utils/dateMonth';
import { Button } from '@shared/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@shared/components/ui/select';
import { Label } from '@shared/components/ui/label';
import { useDailyAppReportTab } from '@modules/orders/hooks/useDailyAppReportTab';
import { cn } from '@shared/lib/utils';
import { ScrollArea, ScrollBar } from '@shared/components/ui/scroll-area';

export const DailyAppReportTab = React.memo(() => {
  const r = useDailyAppReportTab();

  if (r.loading) {
    return (
      <div className="flex h-40 items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-b-2 border-primary" />
      </div>
    );
  }

  const dayArr = Array.from({ length: r.endDay - r.startDay + 1 }, (_, i) => r.startDay + i);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex items-center gap-2 border border-border bg-card px-3 py-1.5 rounded-2xl shadow-sm">
          <FileText size={14} className="text-primary" />
          <span className="text-sm font-semibold text-foreground">تقرير منصة مخصص</span>
        </div>
        <div className="flex items-center gap-2">
          <OrdersMonthNavigator label={monthLabel(r.year, r.month)} onPrev={r.prevMonth} onNext={r.nextMonth} />
        </div>
      </div>

      <div className="bg-card shadow-card border border-border/50 rounded-2xl p-4 space-y-5">
        {/* Apps Selection */}
        <div className="space-y-2">
          <Label className="text-sm font-semibold text-muted-foreground block">اختر المنصة / التطبيق:</Label>
          <div className="flex flex-wrap gap-2">
            {r.apps.map(app => {
              const isSelected = r.selectedApp === app.id;
              const color = r.getAppColor(app.id);
              return (
                <button
                  key={app.id}
                  onClick={() => r.setSelectedApp(app.id)}
                  className={cn(
                    "px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 border border-transparent shadow-sm",
                    isSelected
                      ? "text-white"
                      : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                  style={isSelected ? { backgroundColor: color, boxShadow: `0 4px 12px -4px ${color}` } : undefined}
                >
                  {app.name}
                </button>
              );
            })}
          </div>
        </div>

        {/* Filters & Actions */}
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">من يوم</Label>
              <Select value={String(r.startDay)} onValueChange={(v) => r.setStartDay(Number(v))}>
                <SelectTrigger className="w-[100px] h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent dir="rtl" className="max-h-48">
                  {Array.from({ length: r.daysInMonth }, (_, i) => i + 1).map((d) => (
                    <SelectItem key={d} value={String(d)}>{d}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">إلى يوم</Label>
              <Select value={String(r.endDay)} onValueChange={(v) => r.setEndDay(Number(v))}>
                <SelectTrigger className="w-[100px] h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent dir="rtl" className="max-h-48">
                  {Array.from({ length: r.daysInMonth }, (_, i) => i + 1).map((d) => (
                    <SelectItem key={d} value={String(d)} disabled={d < r.startDay}>{d}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex gap-2">
            <Button onClick={r.printPdf} variant="outline" className="gap-2 border-slate-700 hover:bg-slate-800 hover:text-white" disabled={!r.selectedApp}>
              <Printer size={16} /> طباعة / PDF
            </Button>
            <Button onClick={r.exportExcel} className="gap-2 bg-green-600 hover:bg-green-700 text-white" disabled={!r.selectedApp}>
              <FileSpreadsheet size={16} /> تنزيل Excel
            </Button>
          </div>
        </div>
      </div>

      {/* Preview Table */}
      {r.selectedApp ? (
        <div className="bg-card shadow-card border border-border/50 rounded-2xl overflow-hidden">
          <ScrollArea className="w-full">
            <div className="min-w-max p-1">
              <table className="w-full text-right text-sm">
                <thead>
                  <tr className="border-b border-border/60 bg-muted/30">
                    <th className="p-3 font-semibold text-muted-foreground sticky right-0 bg-muted/95 z-10 w-48 shadow-[1px_0_0_0_hsl(var(--border))]">
                      اسم المندوب
                    </th>
                    {dayArr.map((d) => (
                      <th key={d} className="p-3 font-semibold text-muted-foreground text-center min-w-[36px]">
                        {d}
                      </th>
                    ))}
                    <th className="p-3 font-semibold text-primary text-center">الإجمالي</th>
                    <th className="p-3 font-semibold text-muted-foreground min-w-[200px]">الملاحظات (التوصيات)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {r.previewData.length > 0 ? (
                    r.previewData.map((row, idx) => (
                      <tr key={idx} className="hover:bg-muted/30 transition-colors">
                        <td className="p-3 font-medium text-foreground sticky right-0 bg-card z-10 shadow-[1px_0_0_0_hsl(var(--border)/0.4)]">
                          {row.empName}
                        </td>
                        {row.dailyVals.map((val, i) => (
                          <td key={i} className="p-3 text-center">
                            {val > 0 ? (
                              <span className="font-semibold text-primary">{val}</span>
                            ) : (
                              <span className="text-muted-foreground/30">-</span>
                            )}
                          </td>
                        ))}
                        <td className="p-3 text-center font-bold text-foreground">
                          {row.total}
                        </td>
                        <td className="p-3 text-muted-foreground">
                          {row.note || <span className="text-muted-foreground/30">--</span>}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={dayArr.length + 3} className="p-8 text-center text-muted-foreground">
                        لا توجد طلبات مسجلة لهذه المنصة في النطاق الزمني المحدد.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center p-12 bg-card rounded-2xl border border-dashed border-border/60 text-muted-foreground">
          <FileText size={32} className="mb-3 opacity-20" />
          <p>يرجى اختيار المنصة لاستعراض التقرير</p>
        </div>
      )}
    </div>
  );
});

DailyAppReportTab.displayName = 'DailyAppReportTab';
