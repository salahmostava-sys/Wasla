import type React from 'react';
import { Search, AlertTriangle, XCircle, CheckCircle, CheckCircle2, RefreshCw, ListChecks, Trash2 } from 'lucide-react';
import { Button } from '@shared/components/ui/button';
import { Input } from '@shared/components/ui/input';
import { Label } from '@shared/components/ui/label';
import type { ViolationForm, VehicleSuggestion, ResultRow } from '@modules/violations/types/violation.types';
import { searchResultAssignButtonLabel } from '@modules/violations/lib/violationUtils';

type ViolationSearchTabProps = Readonly<{
  form: ViolationForm;
  setForm: React.Dispatch<React.SetStateAction<ViolationForm>>;
  suggestions: VehicleSuggestion[];
  showSuggestions: boolean;
  setShowSuggestions: (v: boolean) => void;
  suggRef: React.RefObject<HTMLDivElement | null>;
  selectVehicle: (v: VehicleSuggestion) => void;
  handleSearch: () => void | Promise<void>;
  handleReset: () => void;
  searching: boolean;
  noVehicle: boolean;
  results: ResultRow[] | null;
  dateDisplay: string;
  perms: { can_edit: boolean; can_delete: boolean };
  assigningEmployeeId: string | null;
  handleAssign: (row: ResultRow) => void | Promise<void>;
  handleDeleteSearchResultRow: (row: ResultRow) => void | Promise<void>;
  handleTransferSearchRowToSaved: (row: ResultRow) => void;
  deletingSearchDeductionId: string | null;
  setResults: (v: ResultRow[] | null) => void;
  setNoVehicle: (v: boolean) => void;
  setAssigningEmployeeId: (v: string | null) => void;
}>;

export default function ViolationSearchTab({
  form,
  setForm,
  suggestions,
  showSuggestions,
  setShowSuggestions,
  suggRef,
  selectVehicle,
  handleSearch,
  handleReset,
  searching,
  noVehicle,
  results,
  dateDisplay,
  perms,
  assigningEmployeeId,
  handleAssign,
  handleDeleteSearchResultRow,
  handleTransferSearchRowToSaved,
  deletingSearchDeductionId,
  setResults,
  setNoVehicle,
  setAssigningEmployeeId,
}: Readonly<ViolationSearchTabProps>) {
  return (
    <>
      {/* ── Search Card ── */}
      <div className="bg-card border border-border rounded-2xl p-4 shadow-sm space-y-3">
        <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Search size={15} className="text-primary" /> بيانات الاستعلام
        </h2>

        {/* Filters in one horizontal row */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Plate number with autocomplete */}
          <div className="relative" ref={suggRef}>
            <Label className="text-sm mb-1.5 block">رقم لوحة المركبة <span className="text-destructive">*</span></Label>
            <Input
              value={form.plate_number}
              onChange={e => {
                setForm(f => ({ ...f, plate_number: e.target.value, selected_vehicle_id: null }));
                setShowSuggestions(true);
                setResults(null);
                setNoVehicle(false);
                setAssigningEmployeeId(null);
              }}
              onFocus={() => form.plate_number && setShowSuggestions(true)}
              placeholder="مثال: أ ب ج 1234"
              className="h-10"
              autoComplete="off"
            />
            {/* Suggestions dropdown */}
            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute z-50 top-full mt-1 w-full bg-card border border-border rounded-xl shadow-lg overflow-hidden">
                {suggestions.map(v => (
                  <button
                    key={v.id}
                    onMouseDown={() => selectVehicle(v)}
                    className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-muted/60 text-sm text-right transition-colors"
                  >
                    <span className="font-semibold text-foreground">{v.plate_number}</span>
                    <span className="text-xs text-muted-foreground">
                      {v.plate_number_en && <span className="ms-2 text-muted-foreground/60">{v.plate_number_en}</span>}
                      {v.brand && <span>{v.brand} · </span>}
                      <span>{v.type === 'motorcycle' ? 'دراجة' : 'سيارة'}</span>
                    </span>
                  </button>
                ))}
              </div>
            )}
            {/* Selected badge */}
            {form.selected_vehicle_id && (
              <p className="text-xs text-success mt-1 flex items-center gap-1">
                <CheckCircle size={11} /> تم تحديد المركبة
              </p>
            )}
          </div>

          {/* Date / datetime toggle */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <Label className="text-sm">تاريخ المخالفة <span className="text-destructive">*</span></Label>
              <button
                type="button"
                onClick={() => setForm(f => ({ ...f, use_time: !f.use_time }))}
                className="text-xs text-primary hover:underline"
              >
                {form.use_time ? 'بدون وقت' : 'مع الوقت'}
              </button>
            </div>
            {form.use_time ? (
              <Input
                type="datetime-local"
                value={form.violation_datetime}
                onChange={e => setForm(f => ({ ...f, violation_datetime: e.target.value }))}
                className="h-10"
              />
            ) : (
              <Input
                type="date"
                value={form.violation_date_only}
                onChange={e => setForm(f => ({ ...f, violation_date_only: e.target.value }))}
                className="h-10"
              />
            )}
          </div>

          {/* Place */}
          <div>
            <Label className="text-sm mb-1.5 block">مكان المخالفة</Label>
            <Input
              value={form.place}
              onChange={e => setForm(f => ({ ...f, place: e.target.value }))}
              placeholder="مثال: طريق مكة - جدة"
              className="h-10"
            />
          </div>

          {/* Amount */}
          <div>
            <Label className="text-sm mb-1.5 block">المبلغ (ر.س)</Label>
            <Input
              type="number"
              min={0}
              value={form.amount}
              onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
              placeholder="0"
              className="h-10"
            />
          </div>
        </div>

        <div>
          <Label className="text-sm mb-1.5 block">ملاحظة إضافية</Label>
          <Input
            value={form.note}
            onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
            placeholder="أي تفاصيل إضافية..."
            className="h-10"
          />
        </div>

        <div className="flex gap-2">
          <Button onClick={handleSearch} disabled={searching} className="flex-1 gap-2 h-11 text-base font-semibold">
            {searching
              ? <><span className="animate-spin w-4 h-4 border-2 border-primary-foreground/40 border-t-primary-foreground rounded-full" />جاري البحث...</>
              : <><Search size={17} />بحث عن المسؤول</>}
          </Button>
          <Button variant="outline" onClick={handleReset} className="h-11 gap-1.5">
            <RefreshCw size={14} /> مسح
          </Button>
        </div>
      </div>

      {/* ── No Vehicle Found ── */}
      {noVehicle && (
        <div className="bg-card border border-border rounded-2xl p-6 text-center space-y-2">
          <XCircle className="mx-auto text-muted-foreground" size={36} />
          <p className="font-semibold text-foreground">لم يتم العثور على المركبة</p>
          <p className="text-sm text-muted-foreground">
            لا توجد مركبة نشطة بالرقم "<span className="font-medium">{form.plate_number}</span>" في النظام.
          </p>
        </div>
      )}

      {/* ── No Assignment Found ── */}
      {results !== null && results.length === 0 && !noVehicle && (
        <div className="bg-card border border-border rounded-2xl p-6 text-center space-y-2">
          <AlertTriangle className="mx-auto text-warning" size={36} />
          <p className="font-semibold text-foreground">لا يوجد سائق مسؤول في هذا التوقيت</p>
          <p className="text-sm text-muted-foreground">
            لم يتم تسليم المركبة لأي مندوب في تاريخ <span className="font-medium">{dateDisplay}</span>.
          </p>
        </div>
      )}

      {/* ── Results Table ── */}
      {results && results.length > 0 && (
        <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-border flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-foreground">
              نتائج الاستعلام · {results.length} سجل
            </h2>
            <p className="text-xs text-muted-foreground">
              بعد التسجيل يمكن <strong className="text-foreground">حذف</strong> السجل أو <strong className="text-foreground">ترحيل للمرحلة</strong> للمراجعة في التبويب الثاني.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="bg-muted/40 border-b border-border">
                <tr>
                  <th className="px-4 py-2.5 text-center text-xs font-semibold text-muted-foreground">اسم الموظف</th>
                  <th className="px-4 py-2.5 text-center text-xs font-semibold text-muted-foreground">تفاصيل المخالفة</th>
                  <th className="px-4 py-2.5 text-center text-xs font-semibold text-muted-foreground">التاريخ</th>
                  <th className="px-4 py-2.5 text-center text-xs font-semibold text-muted-foreground">المبلغ</th>
                  <th className="px-4 py-2.5 text-center text-xs font-semibold text-muted-foreground">الحالة</th>
                  <th className="px-4 py-2.5 text-center text-xs font-semibold text-muted-foreground min-w-[200px]">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {results.map((row, idx) => (
                  <tr key={row.assignment_id} className={`border-b border-border/40 hover:bg-muted/20 transition-colors ${idx % 2 === 0 ? '' : 'bg-muted/10'}`}>
                    <td className="px-4 py-3 font-semibold text-foreground whitespace-nowrap">{row.employee_name}</td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap text-xs">{row.violation_details || '—'}</td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap text-xs">{row.violation_date}</td>
                    <td className="px-4 py-3 text-center font-medium text-foreground whitespace-nowrap">
                      {row.amount.toLocaleString('en-US')} ر.س
                    </td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap text-xs">
                      {row.status === 'recorded' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-success/10 text-success border border-success/20">
                          <CheckCircle2 size={12} /> مسجّلة
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border/50">
                          — غير مسجّلة
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center justify-center gap-1.5">
                        <Button
                          size="sm"
                          variant={row.status === 'recorded' ? 'outline' : 'destructive'}
                          disabled={!perms.can_edit || assigningEmployeeId === row.employee_id || row.status === 'recorded'}
                          onClick={() => handleAssign(row)}
                          className="h-7 text-xs px-2.5 gap-1"
                        >
                          {searchResultAssignButtonLabel(row, assigningEmployeeId)}
                        </Button>
                        {row.status === 'recorded' && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs px-2 gap-1 text-destructive border-destructive/30 hover:bg-destructive/10"
                              disabled={!perms.can_delete || deletingSearchDeductionId === row.external_deduction_id}
                              onClick={() => { handleDeleteSearchResultRow(row); }}
                            >
                              <Trash2 size={12} />
                              {deletingSearchDeductionId === row.external_deduction_id ? '...' : 'حذف'}
                            </Button>
                            <Button
                              size="sm"
                              variant="secondary"
                              className="h-7 text-xs px-2 gap-1"
                              onClick={() => handleTransferSearchRowToSaved(row)}
                            >
                              <ListChecks size={12} /> ترحيل للمرحلة
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
