import { Loader2, ShieldAlert, Pencil, Trash2, X, Check, Car } from 'lucide-react';
import { useFuelPage } from '@modules/fuel/hooks/useFuelPage';
import { FuelPageHeader } from '@modules/fuel/components/FuelPageHeader';
import { FuelFiltersToolbar, FuelPlatformTabs } from '@modules/fuel/components/FuelFilters';
import { FuelMonthlyStats, FuelDailyStats } from '@modules/fuel/components/FuelStats';
import { FuelForm } from '@modules/fuel/components/FuelForm';
import { Card, CardContent } from '@shared/components/ui/card';
import { Input } from '@shared/components/ui/input';
import { Button } from '@shared/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@shared/components/ui/select';
import { DAY_NAMES } from '@modules/fuel/types/fuel.types';
import type { DailyRow, MonthlyRow } from '@modules/fuel/types/fuel.types';
import { useAuthQueryGate } from '@shared/hooks/useAuthQueryGate';

/* ─── Monthly Table ──────────────────────────────────────────── */
function MonthlyTable({ rows }: Readonly<{ rows: MonthlyRow[] }>) {
  if (rows.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground text-sm">
        لا توجد بيانات لهذا الشهر
      </div>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table ref={undefined} className="w-full text-sm">
        <thead>
          <tr className="border-b border-border/60 text-muted-foreground text-xs">
            <th className="text-right py-2.5 px-3 font-medium">المندوب</th>
            <th className="text-right py-2.5 px-3 font-medium">المركبة</th>
            <th className="text-right py-2.5 px-3 font-medium">أيام مسجّلة</th>
            <th className="text-right py-2.5 px-3 font-medium">الكيلومترات</th>
            <th className="text-right py-2.5 px-3 font-medium">تكلفة البنزين</th>
            <th className="text-right py-2.5 px-3 font-medium">تكلفة/كم</th>
            <th className="text-right py-2.5 px-3 font-medium">الطلبات</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/40">
          {rows.map((row) => {
            const costPerKm = row.km_total > 0 ? row.fuel_cost / row.km_total : 0;
            return (
              <tr key={row.employee_id} className="hover:bg-muted/30 transition-colors">
                <td className="py-2.5 px-3 font-medium">{row.employee_name}</td>
                <td className="py-2.5 px-3 text-muted-foreground text-xs">
                  {row.vehicle ? (
                    <span className="flex items-center gap-1">
                      <Car size={11} />
                      {row.vehicle.plate_number}
                    </span>
                  ) : '—'}
                </td>
                <td className="py-2.5 px-3 text-center">{row.daily_count}</td>
                <td className="py-2.5 px-3 font-mono">{row.km_total.toLocaleString('en-US')}</td>
                <td className="py-2.5 px-3 font-mono">{row.fuel_cost.toLocaleString('en-US')} ر.س</td>
                <td className="py-2.5 px-3 font-mono text-muted-foreground">
                  {costPerKm > 0 ? `${costPerKm.toFixed(3)} ر.س` : '—'}
                </td>
                <td className="py-2.5 px-3 text-center">{row.orders_count}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ─── Daily Table Row ────────────────────────────────────────── */
function DailyTableRow({
  row,
  editing,
  saving,
  canEdit,
  onEdit,
  onCancelEdit,
  onSaveEdit,
  onDelete,
  onUpdateEditing,
}: Readonly<{
  row: DailyRow;
  editing: { id: string; km_total: string; fuel_cost: string; notes: string } | null;
  saving: boolean;
  canEdit: boolean;
  onEdit: () => void;
  onCancelEdit: () => void;
  onSaveEdit: (row: DailyRow) => void;
  onDelete: (id: string) => void;
  onUpdateEditing: (field: 'km_total' | 'fuel_cost' | 'notes', value: string) => void;
}>) {
  const isEditing = editing?.id === row.id;
  const dayName = DAY_NAMES[new Date(`${row.date}T12:00:00`).getDay()];

  return (
    <tr className="hover:bg-muted/30 transition-colors border-b border-border/40 last:border-0">
      <td className="py-2.5 px-3 text-xs text-muted-foreground whitespace-nowrap">
        {row.date} <span className="text-primary/60 font-medium">{dayName}</span>
      </td>
      <td className="py-2.5 px-3 font-medium">{row.employee?.name || '—'}</td>
      <td className="py-2.5 px-3">
        {isEditing ? (
          <Input
            type="number"
            className="h-7 w-24 text-xs"
            value={editing.km_total}
            onChange={(e) => onUpdateEditing('km_total', e.target.value)}
          />
        ) : (
          <span className="font-mono">{row.km_total.toLocaleString('en-US')}</span>
        )}
      </td>
      <td className="py-2.5 px-3">
        {isEditing ? (
          <Input
            type="number"
            className="h-7 w-28 text-xs"
            value={editing.fuel_cost}
            onChange={(e) => onUpdateEditing('fuel_cost', e.target.value)}
          />
        ) : (
          <span className="font-mono">{row.fuel_cost.toLocaleString('en-US')} ر.س</span>
        )}
      </td>
      <td className="py-2.5 px-3 text-muted-foreground text-xs">
        {isEditing ? (
          <Input
            className="h-7 text-xs"
            value={editing.notes}
            onChange={(e) => onUpdateEditing('notes', e.target.value)}
          />
        ) : (
          row.notes || '—'
        )}
      </td>
      {canEdit && (
        <td className="py-2.5 px-3">
          {isEditing ? (
            <div className="flex gap-1">
              <Button
                size="sm"
                variant="ghost"
                className="h-7 w-7 p-0 text-green-600"
                disabled={saving}
                onClick={() => onSaveEdit(row)}
              >
                <Check size={13} />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 w-7 p-0 text-muted-foreground"
                onClick={onCancelEdit}
              >
                <X size={13} />
              </Button>
            </div>
          ) : (
            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <Button
                size="sm"
                variant="ghost"
                className="h-7 w-7 p-0"
                onClick={onEdit}
              >
                <Pencil size={12} />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 w-7 p-0 text-destructive"
                onClick={() => onDelete(row.id)}
              >
                <Trash2 size={12} />
              </Button>
            </div>
          )}
        </td>
      )}
    </tr>
  );
}

/* ─── Daily Table ────────────────────────────────────────────── */
function DailyTable({
  rows,
  editing,
  saving,
  canEdit,
  setEditing,
  onSaveEdit,
  onDelete,
  onUpdateEditing,
}: Readonly<{
  rows: DailyRow[];
  editing: { id: string; km_total: string; fuel_cost: string; notes: string } | null;
  saving: boolean;
  canEdit: boolean;
  setEditing: (v: { id: string; km_total: string; fuel_cost: string; notes: string } | null) => void;
  onSaveEdit: (row: DailyRow) => void;
  onDelete: (id: string) => void;
  onUpdateEditing: (field: 'km_total' | 'fuel_cost' | 'notes', value: string) => void;
}>) {
  if (rows.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground text-sm">
        لا توجد إدخالات يومية لهذا الشهر
      </div>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border/60 text-muted-foreground text-xs">
            <th className="text-right py-2.5 px-3 font-medium">التاريخ</th>
            <th className="text-right py-2.5 px-3 font-medium">المندوب</th>
            <th className="text-right py-2.5 px-3 font-medium">الكيلومترات</th>
            <th className="text-right py-2.5 px-3 font-medium">تكلفة البنزين</th>
            <th className="text-right py-2.5 px-3 font-medium">ملاحظات</th>
            {canEdit && <th className="py-2.5 px-3 w-20" />}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <DailyTableRow
              key={row.id}
              row={row}
              editing={editing}
              saving={saving}
              canEdit={canEdit}
              onEdit={() =>
                setEditing({
                  id: row.id,
                  km_total: String(row.km_total),
                  fuel_cost: String(row.fuel_cost),
                  notes: row.notes || '',
                })
              }
              onCancelEdit={() => setEditing(null)}
              onSaveEdit={onSaveEdit}
              onDelete={onDelete}
              onUpdateEditing={onUpdateEditing}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ─── Spreadsheet Table ──────────────────────────────────────── */
function SpreadsheetView({
  monthly,
  daily,
  dailyOrderRows: _dailyOrderRows,
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

  const kmByEmpDay: Record<string, Record<number, number>> = {};
  daily.forEach((r) => {
    const d = new Date(`${r.date}T12:00:00`).getDate();
    if (!kmByEmpDay[r.employee_id]) kmByEmpDay[r.employee_id] = {};
    kmByEmpDay[r.employee_id][d] = (kmByEmpDay[r.employee_id][d] || 0) + r.km_total;
  });

  if (monthly.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground text-sm">
        لا توجد بيانات لهذا الشهر
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="bg-muted/40 border-b border-border/60">
            <th className="text-right py-2 px-3 font-medium sticky right-0 bg-muted/60 min-w-[130px]">المندوب</th>
            {days.map((d) => (
              <th key={d} className="py-2 px-1.5 font-medium text-center min-w-[36px] text-muted-foreground">
                {d}
              </th>
            ))}
            <th className="py-2 px-3 font-medium text-center min-w-[80px]">الإجمالي</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/30">
          {monthly.map((row) => (
            <tr key={row.employee_id} className="hover:bg-muted/20">
              <td className="py-2 px-3 font-medium sticky right-0 bg-card border-r border-border/40">{row.employee_name}</td>
              {days.map((d) => {
                const km = kmByEmpDay[row.employee_id]?.[d];
                return (
                  <td key={d} className="py-2 px-1 text-center font-mono">
                    {km ? <span className="text-primary font-medium">{km}</span> : <span className="text-border">·</span>}
                  </td>
                );
              })}
              <td className="py-2 px-3 text-center font-mono font-semibold">{row.km_total.toLocaleString('en-US')}</td>
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
    selectedEmployee, setSelectedEmployee,
    platformTab, setPlatformTab,
    apps,
    monthYear,
    ridersForTab,
    loading,
    filteredMonthly, filteredDaily,
    totalKm, totalFuel, totalOrders, avgCostPerKm,
    dailyTotalKm, dailyTotalFuel,
    handleExportMonthly, handleExportDaily,
    newEntry, setNewEntry, defaultEntryDate, savingEntry,
    submitNewEntry,
    editingDaily, setEditingDaily,
    updateEditingDaily, saveEditedDaily,
    handleDeleteDaily,
    permissions,
    dailyOrderRows,
  } = page;

  return (
    <div className="flex flex-col gap-4 w-full max-w-[1600px]" dir="rtl">
      <FuelPageHeader
        view={view}
        onViewChange={setView}
        selectedMonth={selectedMonth}
        selectedYear={selectedYear}
        toolbarEnd={
          <FuelFiltersToolbar
            search={search}
            setSearch={setSearch}
            view={view}
            handleExportMonthly={handleExportMonthly}
            handleExportDaily={handleExportDaily}
            onOpenImport={() => page.setShowImport(true)}
          />
        }
      />

      {apps.length > 1 && (
        <FuelPlatformTabs
          platformTab={platformTab}
          setPlatformTab={setPlatformTab}
          apps={apps}
        />
      )}

      {view === 'daily' && (
        <div className="flex flex-wrap gap-2 items-center">
          <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
            <SelectTrigger className="h-8 w-[200px] text-xs">
              <SelectValue placeholder="كل المناديب" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_all_">كل المناديب</SelectItem>
              {ridersForTab.map((r) => (
                <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {view === 'monthly' && (
        <FuelMonthlyStats
          totalKm={totalKm}
          totalFuel={totalFuel}
          avgCostPerKm={avgCostPerKm}
          totalOrders={totalOrders}
        />
      )}

      {view === 'daily' && (
        <FuelDailyStats
          count={filteredDaily.length}
          totalKm={dailyTotalKm}
          totalFuel={dailyTotalFuel}
        />
      )}

      {view === 'daily' && permissions.can_edit && (
        <Card className="border-border/60 shadow-sm">
          <CardContent className="p-4">
            <p className="text-xs font-semibold text-muted-foreground mb-3">إضافة سجل جديد</p>
            <FuelForm
              riders={ridersForTab}
              entry={newEntry}
              defaultEntryDate={defaultEntryDate}
              saving={savingEntry}
              onChange={setNewEntry}
              onSubmit={submitNewEntry}
            />
          </CardContent>
        </Card>
      )}

      <Card className="border-border/60 shadow-sm overflow-hidden">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 size={24} className="animate-spin text-primary" />
            </div>
          ) : view === 'monthly' ? (
            <MonthlyTable rows={filteredMonthly} />
          ) : view === 'daily' ? (
            <DailyTable
              rows={filteredDaily}
              editing={editingDaily}
              saving={savingEntry}
              canEdit={permissions.can_edit}
              setEditing={setEditingDaily}
              onSaveEdit={saveEditedDaily}
              onDelete={handleDeleteDaily}
              onUpdateEditing={updateEditingDaily}
            />
          ) : (
            <SpreadsheetView
              monthly={filteredMonthly}
              daily={filteredDaily}
              dailyOrderRows={dailyOrderRows}
              monthYear={monthYear}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
