/**
 * FuelSpreadsheetView — جدول بيانات استهلاك المناديب
 *
 * الصفوف = المناديب
 * الأعمدة = أيام الشهر مع التاريخ الكامل (يوم الأسبوع + الرقم)
 * كل خلية تعرض: 📦 طلبات + ⛽ بنزين + 🛣️ مسافة
 */

import type React from 'react';
import { useMemo, useState } from 'react';
import { getDaysInMonth, format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { Users, Calendar, TrendingUp, Fuel, BarChart3, Package } from 'lucide-react';

import type { DailyRow, Employee } from '@modules/fuel/types/fuel.types';
import { Skeleton } from '@shared/components/ui/skeleton';

/* ─── Types ─────────────────────────────────────────────────── */

type DailyOrderRow = {
  employee_id: string;
  date: string;
  orders_count: number;
};

type CellData = {
  orders: number;
  km: number;
  fuel: number;
  notes: string | null;
  mileageId: string | null;
};

type RiderRow = {
  employee: Employee;
  days: Map<number, CellData>;
  totalOrders: number;
  totalKm: number;
  totalFuel: number;
  daysWithData: number;
};

type CellPopover = {
  riderName: string;
  day: number;
  date: string;
  weekday: string;
  data: CellData | null;
};

type DayHeader = {
  dayNum: number;
  weekday: string;
  dateStr: string;
  isWeekend: boolean;
};

/* ─── Arabic day names ──────────────────────────────────────── */

const SHORT_DAY_NAMES = ['أحد', 'إثن', 'ثلا', 'أرب', 'خمي', 'جمع', 'سبت'];

/* ─── Stat Card ─────────────────────────────────────────────── */

function SpreadsheetStat(props: Readonly<{
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  accent?: string;
}>) {
  const { icon, label, value, sub, accent } = props;
  return (
    <div className="bg-card shadow-card p-4 flex items-center gap-3 rounded-2xl">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${accent ?? 'bg-primary/10 text-primary'}`}>
        {icon}
      </div>
      <div>
        <p className="text-[11px] text-muted-foreground">{label}</p>
        <p className="text-xl font-bold text-foreground">{value}</p>
        {sub && <p className="text-[10px] text-muted-foreground">{sub}</p>}
      </div>
    </div>
  );
}

/* ─── Cell Popover ──────────────────────────────────────────── */

function CellDetailPopover(props: Readonly<{
  popover: CellPopover;
  onClose: () => void;
}>) {
  const { popover, onClose } = props;
  return (
    <dialog
      className="relative bg-card -2xl shadow-xl border border-border p-5 min-w-[300px] max-w-[380px] space-y-4 rounded-2xl"
      open
    >
      <div
        className="absolute inset-0 bg-black/20"
        onClick={onClose}
        onKeyDown={(e) => { if (e.key === 'Enter') onClose(); }}
        role="button"
        tabIndex={0}
        aria-label="إغلاق"
      />
      <div className="relative">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-bold text-foreground">{popover.riderName}</h4>
          <button
            type="button"
            className="text-muted-foreground hover:text-foreground text-lg leading-none"
            onClick={onClose}
          >
            ✕
          </button>
        </div>
        <p className="text-xs text-muted-foreground">📅 {popover.weekday} — {popover.date}</p>

        {popover.data && (popover.data.orders > 0 || popover.data.km > 0 || popover.data.fuel > 0) ? (
          <div className="space-y-2.5">
            <div className="flex items-center justify-between text-sm rounded-lg bg-blue-50 dark:bg-blue-950/30 px-3 py-2">
              <span className="text-muted-foreground flex items-center gap-1.5">📦 الطلبات</span>
              <span className="font-bold text-blue-600">{popover.data.orders.toLocaleString('en-US')}</span>
            </div>
            <div className="flex items-center justify-between text-sm rounded-lg bg-emerald-50 dark:bg-emerald-950/30 px-3 py-2">
              <span className="text-muted-foreground flex items-center gap-1.5">🛣️ المسافة</span>
              <span className="font-bold text-emerald-600">{popover.data.km.toLocaleString('en-US')} كم</span>
            </div>
            <div className="flex items-center justify-between text-sm rounded-lg bg-amber-50 dark:bg-amber-950/30 px-3 py-2">
              <span className="text-muted-foreground flex items-center gap-1.5">⛽ البنزين</span>
              <span className="font-bold text-amber-600">{popover.data.fuel.toLocaleString('en-US')} ر.س</span>
            </div>
            {popover.data.notes && (
              <div className="text-xs bg-muted/30 rounded-lg p-2.5 text-muted-foreground">
                💬 {popover.data.notes}
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-4">لا توجد بيانات لهذا اليوم</p>
        )}
      </div>
    </dialog>
  );
}

/* ─── Main Component ────────────────────────────────────────── */

export default function FuelSpreadsheetView(props: Readonly<{
  loading: boolean;
  dailyRows: DailyRow[];
  dailyOrderRows: DailyOrderRow[];
  riders: Employee[];
  monthYear: string;
}>) {
  const { loading, dailyRows, dailyOrderRows, riders, monthYear } = props;
  const [popover, setPopover] = useState<CellPopover | null>(null);

  /* Days in month + day headers with weekday names */
  const dayHeaders = useMemo((): DayHeader[] => {
    const [y, m] = monthYear.split('-').map(Number);
    const totalDays = getDaysInMonth(new Date(y, m - 1));
    return Array.from({ length: totalDays }, (_, i) => {
      const dayNum = i + 1;
      const date = new Date(y, m - 1, dayNum);
      const dayOfWeek = date.getDay(); // 0=Sun..6=Sat
      const weekday = SHORT_DAY_NAMES[dayOfWeek];
      const dateStr = format(date, 'yyyy-MM-dd');
      const isWeekend = dayOfWeek === 5; // الجمعة
      return { dayNum, weekday, dateStr, isWeekend };
    });
  }, [monthYear]);

  /* Pivot: merge mileage + orders into per-rider per-day cells */
  const riderRows = useMemo((): RiderRow[] => {
    // Build orders map: employee_id → day_number → total orders
    const ordersMap = new Map<string, Map<number, number>>();
    for (const row of dailyOrderRows) {
      const dayNum = Number.parseInt(row.date.split('-')[2], 10);
      if (!ordersMap.has(row.employee_id)) {
        ordersMap.set(row.employee_id, new Map());
      }
      const dayMap = ordersMap.get(row.employee_id)!;
      dayMap.set(dayNum, (dayMap.get(dayNum) ?? 0) + (Number(row.orders_count) || 0));
    }

    // Build mileage map: employee_id → day_number → { km, fuel, notes, id }
    const mileageMap = new Map<string, Map<number, { km: number; fuel: number; notes: string | null; id: string }>>();
    for (const row of dailyRows) {
      const dayNum = Number.parseInt(row.date.split('-')[2], 10);
      if (!mileageMap.has(row.employee_id)) {
        mileageMap.set(row.employee_id, new Map());
      }
      const dayMap = mileageMap.get(row.employee_id)!;
      const existing = dayMap.get(dayNum);
      if (existing) {
        dayMap.set(dayNum, {
          km: existing.km + (row.km_total || 0),
          fuel: existing.fuel + (row.fuel_cost || 0),
          notes: row.notes || existing.notes,
          id: row.id,
        });
      } else {
        dayMap.set(dayNum, {
          km: row.km_total || 0,
          fuel: row.fuel_cost || 0,
          notes: row.notes,
          id: row.id,
        });
      }
    }

    return riders.map((emp) => {
      const empOrders = ordersMap.get(emp.id);
      const empMileage = mileageMap.get(emp.id);
      const days = new Map<number, CellData>();
      let totalOrders = 0;
      let totalKm = 0;
      let totalFuel = 0;
      let daysWithData = 0;

      for (const dh of dayHeaders) {
        const orders = empOrders?.get(dh.dayNum) ?? 0;
        const mileage = empMileage?.get(dh.dayNum);
        const km = mileage?.km ?? 0;
        const fuel = mileage?.fuel ?? 0;

        if (orders > 0 || km > 0 || fuel > 0) {
          days.set(dh.dayNum, {
            orders,
            km,
            fuel,
            notes: mileage?.notes ?? null,
            mileageId: mileage?.id ?? null,
          });
          totalOrders += orders;
          totalKm += km;
          totalFuel += fuel;
          daysWithData++;
        }
      }

      return { employee: emp, days, totalOrders, totalKm, totalFuel, daysWithData };
    }).sort((a, b) => a.employee.name.localeCompare(b.employee.name, 'ar'));
  }, [dailyRows, dailyOrderRows, riders, dayHeaders]);

  /* Column totals */
  const columnTotals = useMemo(() => {
    const totals = new Map<number, { orders: number; km: number; fuel: number }>();
    for (const dh of dayHeaders) {
      let orders = 0;
      let km = 0;
      let fuel = 0;
      for (const row of riderRows) {
        const cell = row.days.get(dh.dayNum);
        if (cell) {
          orders += cell.orders;
          km += cell.km;
          fuel += cell.fuel;
        }
      }
      totals.set(dh.dayNum, { orders, km, fuel });
    }
    return totals;
  }, [dayHeaders, riderRows]);

  /* Grand totals */
  const grandTotals = useMemo(() => {
    let orders = 0;
    let km = 0;
    let fuel = 0;
    for (const row of riderRows) {
      orders += row.totalOrders;
      km += row.totalKm;
      fuel += row.totalFuel;
    }
    return { orders, km, fuel };
  }, [riderRows]);

  /* Stats */
  const stats = useMemo(() => {
    const ridersWithData = riderRows.filter((r) => r.daysWithData > 0).length;
    const totalCells = riders.length * dayHeaders.length;
    const filledCells = riderRows.reduce((s, r) => s + r.daysWithData, 0);
    const coveragePct = totalCells > 0 ? (filledCells / totalCells) * 100 : 0;
    return { ridersWithData, filledCells, coveragePct };
  }, [riderRows, riders.length, dayHeaders.length]);

  const handleCellClick = (riderName: string, dh: DayHeader, data: CellData | null) => {
    const fullWeekday = format(new Date(dh.dateStr), 'EEEE', { locale: ar });
    setPopover({ riderName, day: dh.dayNum, date: dh.dateStr, weekday: fullWeekday, data });
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i}  className="bg-card h-20 shadow-card rounded-2xl" />
          ))}
        </div>
        <Skeleton  className="bg-card h-96 shadow-card rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ── Stats ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        <SpreadsheetStat
          icon={<Users size={18} />}
          label="مناديب لديهم بيانات"
          value={`${stats.ridersWithData} / ${riders.length}`}
        />
        <SpreadsheetStat
          icon={<Package size={18} />}
          label="إجمالي الطلبات"
          value={grandTotals.orders.toLocaleString('en-US')}
          accent="bg-blue-500/10 text-blue-600"
        />
        <SpreadsheetStat
          icon={<TrendingUp size={18} />}
          label="إجمالي المسافة"
          value={`${grandTotals.km.toLocaleString('en-US')} كم`}
          accent="bg-emerald-500/10 text-emerald-600"
        />
        <SpreadsheetStat
          icon={<Fuel size={18} />}
          label="إجمالي البنزين"
          value={`${grandTotals.fuel.toLocaleString('en-US')} ر.س`}
          accent="bg-amber-500/10 text-amber-600"
        />
        <SpreadsheetStat
          icon={<Calendar size={18} />}
          label="خلايا مسجّلة"
          value={stats.filledCells.toLocaleString('en-US')}
          sub={`من ${(riders.length * dayHeaders.length).toLocaleString('en-US')}`}
        />
        <SpreadsheetStat
          icon={<BarChart3 size={18} />}
          label="نسبة التغطية"
          value={`${stats.coveragePct.toFixed(0)}%`}
          sub="الخلايا المعبأة"
        />
      </div>

      {/* ── Legend ─────────────────────────────────────────────────── */}
      <div className="flex items-center gap-4 text-[10px] text-muted-foreground bg-muted/30 rounded-lg px-3 py-2 border border-border/30">
        <span className="font-semibold text-foreground">دليل الألوان:</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-blue-500" /> 📦 طلبات</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" /> 🛣️ مسافة (كم)</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-amber-500" /> ⛽ بنزين (ر.س)</span>
        <span className="me-2">|</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-emerald-100 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-700" /> يوجد بيانات</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-muted/60 border border-border/50" /> فارغ</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-800" /> جمعة</span>
      </div>

      {/* ── Spreadsheet Grid ──────────────────────────────────────── */}
      {riders.length === 0 ? (
        <div className="bg-card shadow-card p-12 text-center rounded-2xl">
          <BarChart3 size={40} className="mx-auto opacity-60" aria-hidden />
          <p className="font-medium text-foreground mt-3">لا يوجد مناديب</p>
          <p className="text-xs text-muted-foreground mt-1">غيّر المنصة أو البحث</p>
        </div>
      ) : (
        <div className="bg-card shadow-card overflow-hidden border border-border/50 rounded-2xl">
          <div className="overflow-auto max-h-[75vh]">
            <table className="text-[10px] border-collapse w-max">
              {/* ── Header: 2 rows (weekday + day number) ───── */}
              <thead className="sticky top-0 z-20">
                {/* Row 1: Weekday names */}
                <tr className="bg-muted/90 backdrop-blur-sm">
                  <th
                    rowSpan={2}
                    className="ta-th sticky right-0 z-30 bg-muted min-w-[170px] text-start text-[11px] font-bold text-foreground border-b border-l border-border/50 align-bottom"
                  >
                    المندوب
                  </th>
                  {dayHeaders.map((dh) => (
                    <th
                      key={`wd-${dh.dayNum}`}
                      className={`min-w-[68px] px-0.5 py-1 text-center text-[9px] font-semibold border-l border-border/30 ${
                        dh.isWeekend ? 'text-rose-500 bg-rose-50/50 dark:bg-rose-950/20' : 'text-muted-foreground'
                      }`}
                    >
                      {dh.weekday}
                    </th>
                  ))}
                  <th
                    rowSpan={2}
                    className="ta-th min-w-[85px] text-[11px] font-bold text-primary border-l border-border/50 bg-primary/5 align-bottom"
                  >
                    المجموع
                  </th>
                </tr>
                {/* Row 2: Day numbers */}
                <tr className="bg-muted/80 backdrop-blur-sm border-b border-border/50">
                  {dayHeaders.map((dh) => (
                    <th
                      key={`dn-${dh.dayNum}`}
                      className={`min-w-[68px] px-0.5 py-1.5 text-center text-xs font-bold border-l border-border/30 ${
                        dh.isWeekend ? 'text-rose-600 bg-rose-50/50 dark:bg-rose-950/20' : 'text-foreground'
                      }`}
                    >
                      {dh.dayNum}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {riderRows.map((row) => (
                  <tr key={row.employee.id} className="border-b border-border/20 hover:bg-muted/5">
                    {/* ── Sticky rider name ────────────────────── */}
                    <td className="ta-td sticky right-0 z-10 bg-card border-l border-border/50 min-w-[170px] rounded-2xl">
                      <div className="flex items-center gap-2">
                        {row.employee.personal_photo_url && (
                          <img
                            src={row.employee.personal_photo_url}
                            className="w-6 h-6 rounded-full object-cover flex-shrink-0"
                            alt=""
                          />
                        )}
                        <div className="min-w-0">
                          <p className="font-medium text-foreground truncate text-[11px] leading-tight">{row.employee.name}</p>
                          {row.employee.vehicle && (
                            <p className="text-[8px] text-muted-foreground truncate leading-tight">
                              {row.employee.vehicle.type === 'motorcycle' ? '🏍️' : '🚗'} {row.employee.vehicle.plate_number}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* ── Day cells: 3 values ─────────────────── */}
                    {dayHeaders.map((dh) => {
                      const cell = row.days.get(dh.dayNum) ?? null;
                      const hasData = cell !== null;
                      let dayCellClass = 'bg-muted/10 hover:bg-muted/30';
                      if (hasData) {
                        dayCellClass = 'bg-emerald-50/60 dark:bg-emerald-950/20 hover:bg-emerald-100 dark:hover:bg-emerald-950/40';
                      } else if (dh.isWeekend) {
                        dayCellClass = 'bg-rose-50/40 dark:bg-rose-950/10 hover:bg-rose-100/60 dark:hover:bg-rose-950/20';
                      }
                      return (
                        <td
                          key={dh.dayNum}
                          className={`border-l border-border/20 p-0 text-center transition-colors min-w-[68px] ${dayCellClass}`}
                          title={hasData ? `📦${cell.orders} 🛣️${cell.km}كم ⛽${cell.fuel}ر.س` : 'لا بيانات'}
                        >
                          <button
                            type="button"
                            className="w-full h-full min-h-[44px] flex flex-col items-center justify-center px-0.5 py-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                            onClick={() => handleCellClick(row.employee.name, dh, cell)}
                          >
                            {hasData ? (
                              <div className="space-y-[1px] leading-none">
                                {cell.orders > 0 && (
                                  <p className="font-bold text-blue-600 dark:text-blue-400 text-[10px]">{cell.orders}</p>
                                )}
                                {cell.km > 0 && (
                                  <p className="font-semibold text-emerald-600 dark:text-emerald-400 text-[9px]">{cell.km}</p>
                                )}
                                {cell.fuel > 0 && (
                                  <p className="text-amber-600 dark:text-amber-400 text-[8px]">{cell.fuel}</p>
                                )}
                                {cell.orders === 0 && cell.km === 0 && cell.fuel === 0 && (
                                  <span className="text-muted-foreground/30">·</span>
                                )}
                              </div>
                            ) : (
                              <span className="text-muted-foreground/20">·</span>
                            )}
                          </button>
                        </td>
                      );
                    })}

                    {/* ── Row total ────────────────────────────── */}
                    <td className="ta-td border-l border-border/50 px-1.5 bg-primary/5 min-w-[85px]">
                      <div className="space-y-[1px] leading-none">
                        {row.totalOrders > 0 && (
                          <p className="font-bold text-blue-600 text-[10px]">📦 {row.totalOrders.toLocaleString('en-US')}</p>
                        )}
                        {row.totalKm > 0 && (
                          <p className="font-semibold text-emerald-600 text-[9px]">{row.totalKm.toLocaleString('en-US')} كم</p>
                        )}
                        {row.totalFuel > 0 && (
                          <p className="text-amber-600 text-[8px]">{row.totalFuel.toLocaleString('en-US')} ر.س</p>
                        )}
                        {row.totalOrders === 0 && row.totalKm === 0 && row.totalFuel === 0 && (
                          <span className="text-muted-foreground/40 text-[9px]">—</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>

              {/* ── Column totals footer ──────────────────────────── */}
              <tfoot className="sticky bottom-0 z-20">
                <tr className="border-t-2 border-border bg-muted/70 backdrop-blur-sm">
                  <td className="ta-td sticky right-0 z-30 bg-muted text-[11px] font-bold text-foreground border-l border-border/50">
                    المجموع اليومي
                  </td>
                  {dayHeaders.map((dh) => {
                    const ct = columnTotals.get(dh.dayNum);
                    const hasData = ct && (ct.orders > 0 || ct.km > 0 || ct.fuel > 0);
                    return (
                      <td
                        key={dh.dayNum}
                        className={`border-l border-border/30 px-0.5 py-1.5 text-center ${
                          dh.isWeekend ? 'bg-rose-50/30 dark:bg-rose-950/10' : ''
                        }`}
                      >
                        {hasData ? (
                          <div className="space-y-[1px] leading-none">
                            {ct.orders > 0 && (
                              <p className="font-bold text-blue-600 text-[9px]">{ct.orders.toLocaleString('en-US')}</p>
                            )}
                            {ct.km > 0 && (
                              <p className="font-semibold text-emerald-600 text-[8px]">{ct.km.toLocaleString('en-US')}</p>
                            )}
                            {ct.fuel > 0 && (
                              <p className="text-amber-600 text-[7px]">{ct.fuel.toLocaleString('en-US')}</p>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground/20">·</span>
                        )}
                      </td>
                    );
                  })}
                  <td className="ta-td border-l border-border/50 px-1.5 bg-primary/10">
                    <div className="space-y-[2px] leading-none">
                      <p className="font-black text-blue-600 text-[10px]">📦 {grandTotals.orders.toLocaleString('en-US')}</p>
                      <p className="font-bold text-emerald-600 text-[9px]">{grandTotals.km.toLocaleString('en-US')} كم</p>
                      <p className="font-semibold text-amber-600 text-[8px]">{grandTotals.fuel.toLocaleString('en-US')} ر.س</p>
                    </div>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* ── Cell Detail Popover ────────────────────────────────── */}
      {popover && <CellDetailPopover popover={popover} onClose={() => setPopover(null)} />}
    </div>
  );
}
