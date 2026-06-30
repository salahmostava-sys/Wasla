import React from 'react';
import {
  Edit2, Trash2,
  ChevronDown, ChevronUp,
} from 'lucide-react';
import { Button } from '@shared/components/ui/button';
import { Input } from '@shared/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@shared/components/ui/select';
import {
  calcFuelCostPerKm,
  calcFuelPerOrder,
  getRiderDailyRows,
  getRiderOrders,
  sumRiderFuel,
  sumRiderKm,
} from '@shared/lib/fuelBusiness';
import {
  costPerKmColor,
  fuelPerOrderBadgeClass,
} from '@modules/fuel/model/fuelCalculations';
import { FuelMonthlyStats, FuelDailyStats } from '@modules/fuel/components/FuelStats';
import { FuelForm } from '@modules/fuel/components/FuelForm';
import type {
  DailyRow,
  MonthlyRow,
  Employee,
  DailyExpandedArgs,
} from '@modules/fuel/types/fuel.types';
import { MONTHLY_SKELETON_ROWS } from '@modules/fuel/types/fuel.types';
import { Skeleton } from '@shared/components/ui/skeleton';

export function FuelMonthlyTable(props: Readonly<{
  tableRef: React.RefObject<HTMLTableElement | null>;
  bodyRows: React.ReactNode;
}>) {
  const { tableRef, bodyRows } = props;
  return (
    <div className="bg-card shadow-card overflow-hidden rounded-2xl">
      <div className="overflow-x-auto w-full">
        <table ref={tableRef} className="w-full min-w-[800px] text-sm">
          <thead>
            <tr className="border-b border-border/50 bg-muted/30">
              <th className="ta-th text-start">المندوب</th>
              <th className="ta-th">أيام مسجّلة</th>
              <th className="ta-th">الكيلومترات</th>
              <th className="ta-th">تكلفة البنزين</th>
              <th className="ta-th">تكلفة/كم</th>
              <th className="ta-th">الدباب 🏍️</th>
              <th className="ta-th">عدد الطلبات 📦</th>
              <th className="ta-th">بنزين/طلب</th>
              <th className="ta-th">إجراءات</th>
            </tr>
          </thead>
          <tbody>{bodyRows}</tbody>
        </table>
      </div>
    </div>
  );
}

const renderMonthlyLoadingRows = (): React.ReactNode =>
  MONTHLY_SKELETON_ROWS.map((rowKey) => (
    <tr key={`fuel-monthly-skeleton-row-${rowKey}`} className="border-b border-border/30">
      {Array.from({ length: 9 }).map((_, j) => (
        <td key={`fuel-monthly-skeleton-cell-${rowKey}-${j}`} className="ta-td"><Skeleton  className="h-4 bg-muted/60 rounded" /></td>
      ))}
    </tr>
  ));

const renderMonthlyEmptyRow = (): React.ReactNode => (
  <tr>
    <td colSpan={9} className="ta-td">
      <div className="flex flex-col items-center gap-2 text-muted-foreground">
        <span className="text-4xl">⛽</span>
        <p className="font-medium">لا توجد بيانات لهذا الشهر</p>
        <p className="text-xs">أضف إدخالات يومية من عرض يومي أو غيّر المنصة/البحث</p>
      </div>
    </td>
  </tr>
);

const renderMonthlyTotalsRow = (
  filteredCount: number,
  totalKm: number,
  totalFuel: number,
  avgCostPerKm: number,
  totalOrders: number
): React.ReactNode => (
  <tr className="border-t-2 border-border bg-muted/20 font-semibold text-sm">
    <td className="ta-td text-foreground">الإجمالي ({filteredCount} مندوب)</td>
    <td className="ta-td text-muted-foreground">—</td>
    <td className="ta-td text-primary">{totalKm.toLocaleString('en-US')} كم</td>
    <td className="ta-td text-warning">{totalFuel.toLocaleString('en-US')} ر.س</td>
    <td className={`px-4 py-3 text-center ${costPerKmColor(avgCostPerKm)}`}>
      {avgCostPerKm > 0 ? `${avgCostPerKm.toFixed(3)} ر.س/كم` : '—'}
    </td>
    <td className="ta-td text-muted-foreground">—</td>
    <td className="ta-td">{totalOrders.toLocaleString('en-US')}</td>
    <td className="ta-td text-muted-foreground">
      {totalOrders > 0 ? `${(totalFuel / totalOrders).toFixed(2)} ر.س` : '—'}
    </td>
    <td />
  </tr>
);

const renderDailyLoadingRow = (): React.ReactNode => (
  <tr><td colSpan={5} className="ta-td text-muted-foreground">جاري التحميل...</td></tr>
);

const renderDailyEmptyRidersRow = (): React.ReactNode => (
  <tr><td colSpan={5} className="ta-td text-muted-foreground">لا يوجد مناديب على هذه المنصة</td></tr>
);

const renderDailyExpandedContent = ({
  days,
  editingDaily,
  permissionsCanEdit,
  savingEntry,
  updateEditingDaily,
  saveEditedDaily,
  setEditingDaily,
  handleDeleteDaily,
}: DailyExpandedArgs): React.ReactNode => {
  if (days.length === 0) {
    return <p className="text-xs text-muted-foreground px-2">لا سجلات يومية لهذا الشهر</p>;
  }
  return (
    <table className="w-full text-xs border border-border/40 rounded-lg overflow-hidden">
      <thead className="bg-muted/50">
        <tr>
          <th className="ta-th text-start">التاريخ</th>
          <th className="ta-th">كم</th>
          <th className="ta-th">بنزين</th>
          <th className="ta-th text-start">ملاحظات</th>
          <th className="ta-th w-24">إجراء</th>
        </tr>
      </thead>
      <tbody>
        {days.map(dr => (
          <tr key={dr.id} className="border-t border-border/30">
            <td className="ta-td font-mono">{dr.date}</td>
            <td className="ta-td">
              {editingDaily?.id === dr.id ? (
                <Input className="h-7 text-xs" type="number" value={editingDaily.km_total} onChange={e => updateEditingDaily('km_total', e.target.value)} />
              ) : (dr.km_total || '—')}
            </td>
            <td className="ta-td">
              {editingDaily?.id === dr.id ? (
                <Input className="h-7 text-xs" type="number" value={editingDaily.fuel_cost} onChange={e => updateEditingDaily('fuel_cost', e.target.value)} />
              ) : (dr.fuel_cost || '—')}
            </td>
            <td className="ta-td">
              {editingDaily?.id === dr.id ? (
                <Input className="h-7 text-xs" value={editingDaily.notes} onChange={e => updateEditingDaily('notes', e.target.value)} />
              ) : (dr.notes || '—')}
            </td>
            <td className="ta-td">
              {permissionsCanEdit && (
                <div className="flex gap-1 justify-center">
                  {editingDaily?.id === dr.id ? (
                    <>
                      <Button type="button" size="sm" className="h-7 text-[10px] px-2" disabled={savingEntry} onClick={() => saveEditedDaily(dr)}>حفظ</Button>
                      <Button type="button" size="sm" variant="outline" className="h-7 text-[10px] px-2" onClick={() => setEditingDaily(null)}>إلغاء</Button>
                    </>
                  ) : (
                    <>
                      <button aria-label="تعديل" type="button" className="p-1 rounded hover:bg-muted" onClick={() => setEditingDaily({ id: dr.id, km_total: String(dr.km_total), fuel_cost: String(dr.fuel_cost), notes: dr.notes ?? '' })}><Edit2 size={13} /></button>
                      <button aria-label="حذف" type="button" className="p-1 rounded hover:bg-destructive/10 text-destructive" onClick={() => handleDeleteDaily(dr.id)}><Trash2 size={13} /></button>
                    </>
                  )}
                </div>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};

export function FuelMonthlyView(props: Readonly<{
  loading: boolean;
  filteredMonthly: MonthlyRow[];
  totalKm: number;
  totalFuel: number;
  totalOrders: number;
  avgCostPerKm: number;
  setSelectedEmployee: (id: string) => void;
  setView: (v: 'monthly' | 'daily' | 'spreadsheet') => void;
  setExpandedRider: (id: string | null) => void;
  tableRef: React.RefObject<HTMLTableElement | null>;
}>) {
  const {
    loading,
    filteredMonthly,
    totalKm,
    totalFuel,
    totalOrders,
    avgCostPerKm,
    setSelectedEmployee,
    setView,
    setExpandedRider,
    tableRef,
  } = props;

  let monthlyBodyRows: React.ReactNode;
  if (loading) {
    monthlyBodyRows = renderMonthlyLoadingRows();
  } else if (filteredMonthly.length === 0) {
    monthlyBodyRows = renderMonthlyEmptyRow();
  } else {
    monthlyBodyRows = (
      <>
        {filteredMonthly.map(row => {
          const costPerKm = calcFuelCostPerKm(row.km_total, row.fuel_cost);
          const fuelPerOrder = calcFuelPerOrder(row.fuel_cost, row.orders_count);
          return (
            <tr key={row.employee_id} className="border-b border-border/30 hover:bg-muted/20 transition-colors">
              <td className="ta-td">
                <div className="flex items-center gap-2">
                  {row.personal_photo_url && (
                    <img src={row.personal_photo_url} className="w-8 h-8 rounded-full object-cover" alt="" />
                  )}
                  <span className="font-medium text-foreground">{row.employee_name}</span>
                </div>
              </td>
              <td className="ta-td">
                <span className="text-xs bg-muted px-2 py-0.5 rounded-full">{row.daily_count} يوم</span>
              </td>
              <td className="ta-td font-medium text-primary">{row.km_total.toLocaleString('en-US')} كم</td>
              <td className="ta-td font-medium text-warning">{row.fuel_cost.toLocaleString('en-US')} ر.س</td>
              <td className={`px-4 py-3 text-center ${costPerKmColor(costPerKm)}`}>
                {costPerKm === null ? '—' : `${costPerKm.toFixed(3)} ر.س/كم`}
              </td>
              <td className="ta-td">
                {row.vehicle ? (
                  <div className="flex flex-col items-center gap-0.5">
                    <span className="text-xs font-semibold text-foreground">
                      {row.vehicle.type === 'motorcycle' ? '🏍️' : '🚗'} {row.vehicle.plate_number}
                    </span>
                    {(row.vehicle.brand || row.vehicle.model) && (
                      <span className="text-[10px] text-muted-foreground">
                        {[row.vehicle.brand, row.vehicle.model].filter(Boolean).join(' ')}
                      </span>
                    )}
                  </div>
                ) : <span className="text-muted-foreground/40 text-xs">—</span>}
              </td>
              <td className="ta-td">
                {row.orders_count > 0
                  ? <span className="font-semibold text-foreground">{row.orders_count.toLocaleString('en-US')}</span>
                  : <span className="text-muted-foreground/40">—</span>}
              </td>
              <td className="ta-td">
                <div className="flex flex-col items-center gap-0.5">
                  <span className="text-xs text-muted-foreground">{fuelPerOrder === null ? '—' : `${fuelPerOrder.toFixed(2)} ر.س`}</span>
                  {(() => {
                    const badge = fuelPerOrderBadgeClass(fuelPerOrder);
                    if (!badge) return null;
                    return <span className={badge.className}>{badge.label}</span>;
                  })()}
                </div>
              </td>
              <td className="ta-td">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedEmployee(row.employee_id);
                    setView('daily');
                    setExpandedRider(row.employee_id);
                  }}
                  className="text-xs text-primary hover:underline"
                >
                  الأيام ←
                </button>
              </td>
            </tr>
          );
        })}
        {renderMonthlyTotalsRow(filteredMonthly.length, totalKm, totalFuel, avgCostPerKm, totalOrders)}
      </>
    );
  }

  return (
    <>
      <FuelMonthlyStats totalKm={totalKm} totalFuel={totalFuel} avgCostPerKm={avgCostPerKm} totalOrders={totalOrders} />
      <FuelMonthlyTable tableRef={tableRef} bodyRows={monthlyBodyRows} />
    </>
  );
}

export function FuelDailyDetailedView(props: Readonly<{
  filteredDaily: DailyRow[];
  dailyTotalKm: number;
  dailyTotalFuel: number;
  ridersForTab: Employee[];
  selectedEmployee: string;
  setSelectedEmployee: (v: string) => void;
  loading: boolean;
  expandedRider: string | null;
  setExpandedRider: (v: string | null) => void;
  monthOrdersMap: Record<string, number>;
  permissionsCanEdit: boolean;
  newEntry: { employee_id: string; date: string; km_total: string; fuel_cost: string; notes: string };
  setNewEntry: React.Dispatch<React.SetStateAction<{ employee_id: string; date: string; km_total: string; fuel_cost: string; notes: string }>>;
  defaultEntryDate: string;
  savingEntry: boolean;
  submitNewEntry: () => Promise<void>;
  editingDaily: { id: string; km_total: string; fuel_cost: string; notes: string } | null;
  setEditingDaily: React.Dispatch<React.SetStateAction<{ id: string; km_total: string; fuel_cost: string; notes: string } | null>>;
  updateEditingDaily: (field: 'km_total' | 'fuel_cost' | 'notes', value: string) => void;
  saveEditedDaily: (row: DailyRow) => Promise<void>;
  handleDeleteDaily: (id: string) => Promise<void>;
}>) {
  const {
    filteredDaily,
    dailyTotalKm,
    dailyTotalFuel,
    ridersForTab,
    selectedEmployee,
    setSelectedEmployee,
    loading,
    expandedRider,
    setExpandedRider,
    monthOrdersMap,
    permissionsCanEdit,
    newEntry,
    setNewEntry,
    defaultEntryDate,
    savingEntry,
    submitNewEntry,
    editingDaily,
    setEditingDaily,
    updateEditingDaily,
    saveEditedDaily,
    handleDeleteDaily,
  } = props;

  const dailyForRider = (empId: string) => getRiderDailyRows(filteredDaily, empId);
  const riderMonthKm = (empId: string) => sumRiderKm(dailyForRider(empId));
  const riderMonthFuel = (empId: string) => sumRiderFuel(dailyForRider(empId));
  const riderMonthOrders = (empId: string) => getRiderOrders(monthOrdersMap, empId);

  let dailyRiderRows: React.ReactNode;
  if (loading) {
    dailyRiderRows = renderDailyLoadingRow();
  } else if (ridersForTab.length === 0) {
    dailyRiderRows = renderDailyEmptyRidersRow();
  } else {
    dailyRiderRows = ridersForTab.map(emp => {
      const open = expandedRider === emp.id;
      const days = dailyForRider(emp.id);
      const vehicle = emp.vehicle;
      return (
        <React.Fragment key={emp.id}>
          <tr className="border-b border-border/30 hover:bg-muted/10">
            <td className="ta-td">
              <button
                aria-label="عرض التفاصيل"
                type="button"
                className="p-1 rounded hover:bg-muted"
                onClick={() => setExpandedRider(open ? null : emp.id)}
                aria-expanded={open}
              >
                {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>
            </td>
            <td className="ta-td">
              <div className="flex items-center gap-2">
                {emp.personal_photo_url && <img src={emp.personal_photo_url} className="w-8 h-8 rounded-full object-cover" alt="" />}
                <span className="font-medium">{emp.name}</span>
              </div>
            </td>
            <td className="ta-td">
              {vehicle ? (
                <div className="flex flex-col items-center gap-0.5">
                  <span className="text-xs font-semibold text-foreground">
                    {vehicle.type === 'motorcycle' ? '🏍️' : '🚗'} {vehicle.plate_number}
                  </span>
                  {(vehicle.brand || vehicle.model) && (
                    <span className="text-[10px] text-muted-foreground">
                      {[vehicle.brand, vehicle.model].filter(Boolean).join(' ')}
                    </span>
                  )}
                </div>
              ) : <span className="text-muted-foreground/40 text-xs">—</span>}
            </td>
            <td className="ta-td">
              {riderMonthOrders(emp.id) > 0
                ? <span className="font-semibold text-foreground">{riderMonthOrders(emp.id).toLocaleString('en-US')}</span>
                : <span className="text-muted-foreground/40">—</span>}
            </td>
            <td className="ta-td font-medium text-primary">{riderMonthKm(emp.id).toLocaleString('en-US')}</td>
            <td className="ta-td text-warning">{riderMonthFuel(emp.id).toLocaleString('en-US')} ر.س</td>
          </tr>
          {open && (
            <tr className="bg-muted/10">
              <td colSpan={6} className="p-0">
                <div className="p-3 space-y-2">
                  {renderDailyExpandedContent({
                    days,
                    editingDaily,
                    permissionsCanEdit,
                    savingEntry,
                    updateEditingDaily,
                    saveEditedDaily,
                    setEditingDaily,
                    handleDeleteDaily,
                  })}
                </div>
              </td>
            </tr>
          )}
        </React.Fragment>
      );
    });
  }

  return (
    <>
      <FuelDailyStats count={filteredDaily.length} totalKm={dailyTotalKm} totalFuel={dailyTotalFuel} />

      <div className="flex flex-wrap gap-2 items-center">
        <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
          <SelectTrigger className="w-44 h-9 text-sm">
            <SelectValue placeholder="كل المناديب" />
          </SelectTrigger>
          <SelectContent className="max-h-60">
            <SelectItem value="_all_">كل المناديب (المنصة)</SelectItem>
            {ridersForTab.map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Riders + expandable daily + bottom inline add */}
      <div className="bg-card shadow-card overflow-hidden border border-border/50 rounded-2xl">
        <div className="px-4 py-2 border-b border-border/50 bg-muted/20 text-xs text-muted-foreground">
          مناديب المنصة المختارة (يشمل أي مندوب لديه طلبات هذا الشهر) — اضغط السهم لعرض السجلات اليومية وإضافة إدخال من الصف السفلي.
        </div>
        <div className="overflow-x-auto w-full">
          <table className="w-full min-w-[820px] text-sm">
            <thead>
              <tr className="border-b border-border/50 bg-muted/30">
                <th className="ta-th w-10" />
                <th className="ta-th text-start">المندوب</th>
                <th className="ta-th">رقم الدباب 🏍️</th>
                <th className="ta-th">الطلبات (الشهر)</th>
                <th className="ta-th">كم (الشهر)</th>
                <th className="ta-th">بنزين (الشهر)</th>
              </tr>
            </thead>
            <tbody>
              {dailyRiderRows}
            </tbody>
            {permissionsCanEdit && (
              <tfoot>
                <tr className="bg-primary/5 border-t-2 border-primary/20">
                  <td colSpan={6} className="p-3">
                    <FuelForm
                      riders={ridersForTab}
                      entry={newEntry}
                      defaultEntryDate={defaultEntryDate}
                      saving={savingEntry}
                      onSubmit={submitNewEntry}
                      onChange={setNewEntry}
                    />
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </>
  );
}
