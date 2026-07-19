import { formatCurrency } from '@shared/lib/formatters';

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
      {/* -- Search Card -- */}
      <div className="space-y-4 rounded-lg border border-border/70 bg-card p-5 shadow-sm">
        <h2 className="flex items-center gap-2 text-base font-semibold text-foreground">
          <Search size={17} className="text-primary" /> البحث والاستعلام
        </h2>

        {/* Filters in one horizontal row */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {/* Plate number with autocomplete */}
          <div className="relative" ref={suggRef}>
            <div className="flex items-center justify-between mb-1.5 h-6">
              <Label className="text-sm">رقم لوحة المركبة <span className="text-destructive">*</span></Label>
            </div>
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
              placeholder="مثال: ا ب ج 1234"
              className="h-10"
              autoComplete="off"
            />
            {/* Suggestions dropdown */}
            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute top-full z-50 mt-1 w-full overflow-hidden rounded-lg border border-border bg-card shadow-card">
                {suggestions.map(v => (
                  <button type="button"
                    key={v.id}
                    onMouseDown={() => selectVehicle(v)}
                    className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-muted/60 text-sm text-start transition-colors"
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
                <CheckCircle size={11} /> تم اختيار المركبة
              </p>
            )}
          </div>

          {/* Date / datetime toggle */}
          <div>
            <div className="flex items-center justify-between mb-1.5 h-6">
              <Label className="text-sm">تاريخ المخالفة <span className="text-destructive">*</span></Label>
              <button
                type="button"
                onClick={() => setForm(f => ({ ...f, use_time: !f.use_time }))}
                className="text-xs text-primary hover:underline"
              >
                {form.use_time ? 'بدون وقت' : 'تحديد وقت'}
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
            <div className="flex items-center justify-between mb-1.5 h-6">
              <Label className="text-sm">مكان المخالفة</Label>
            </div>
            <Input
              value={form.place}
              onChange={e => setForm(f => ({ ...f, place: e.target.value }))}
              placeholder="مثال: طريق الملك - جدة"
              className="h-10"
            />
          </div>

          {/* Amount */}
          <div>
            <div className="flex items-center justify-between mb-1.5 h-6">
              <Label className="text-sm">المبلغ (ر.س)</Label>
            </div>
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
          <Label className="text-sm mb-1.5 block">تفاصيل المخالفة</Label>
          <Input
            value={form.note}
            onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
            placeholder="أدخل تفاصيل المخالفة..."
            className="h-10"
          />
        </div>

        <div className="flex flex-col-reverse gap-2 sm:flex-row">
          <Button onClick={handleSearch} disabled={searching} className="flex-1 gap-2 h-11 text-base font-semibold">
            {searching
              ? <><span className="animate-spin w-4 h-4 border-2 border-primary-foreground/40 border-t-primary-foreground rounded-full" />جاري البحث...</>
              : <><Search size={17} />بحث عن المخالفات</>}
          </Button>
          <Button variant="outline" onClick={handleReset} className="h-11 gap-1.5">
            <RefreshCw size={14} /> إعادة ضبط
          </Button>
        </div>
      </div>

      {/* -- No Vehicle Found -- */}
      {noVehicle && (
        <div className="space-y-2 rounded-lg border border-border bg-card p-6 text-center">
          <XCircle className="mx-auto text-muted-foreground" size={36} />
          <p className="font-semibold text-foreground">لم يتم العثور على المركبة</p>
          <p className="text-sm text-muted-foreground">
            لم نتمكن من إيجاد مركبة برقم اللوحة "<span className="font-medium">{form.plate_number}</span>" في النظام.
          </p>
        </div>
      )}

      {/* -- No Assignment Found -- */}
      {results !== null && results.length === 0 && !noVehicle && (
        <div className="space-y-2 rounded-lg border border-border bg-card p-6 text-center">
          <AlertTriangle className="mx-auto text-warning" size={36} />
          <p className="font-semibold text-foreground">لم يتم العثور على مخالفات</p>
          <p className="text-sm text-muted-foreground">
            لم يتم تسجيل مخالفات على هذه المركبة في تاريخ <span className="font-medium">{dateDisplay}</span>.
          </p>
        </div>
      )}

      {/* -- Results Table -- */}
      {results && results.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
          <div className="px-5 py-3 border-b border-border flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-foreground">
              نتائج الاستعلام · {results.length} سجل
            </h2>
            <p className="text-xs text-muted-foreground">
              هذه المخالفات يمكن <strong className="text-foreground">تأكيد</strong> تسجيلها أو <strong className="text-foreground">ترحيل للمرحلة</strong> لمراجعتها في التبويب الثاني.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="data-table w-full min-w-[760px] text-sm">
              <thead className="bg-muted/40 border-b border-border">
                <tr>
                  <th className="ta-th">اسم الموظف</th>
                  <th className="ta-th">تفاصيل المخالفة</th>
                  <th className="ta-th">التاريخ</th>
                  <th className="ta-th">المبلغ</th>
                  <th className="ta-th">الحالة</th>
                  <th className="ta-th min-w-[200px]">الإجراء</th>
                </tr>
              </thead>
              <tbody>
                {results.map((row, idx) => (
                  <tr key={row.assignment_id} className={`border-b border-border/40 hover:bg-muted/20 transition-colors ${idx % 2 === 0 ? '' : 'bg-muted/10'}`}>
                    <td className="ta-td font-semibold text-foreground">{row.employee_name}</td>
                    <td className="ta-td text-muted-foreground">{row.violation_details || '—'}</td>
                    <td className="ta-td text-muted-foreground">{row.violation_date}</td>
                    <td className="ta-td font-medium text-foreground">
                      {formatCurrency(row.amount)}
                    </td>
                    <td className="ta-td text-muted-foreground">
                      {row.status === 'recorded' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-success/10 text-success border border-success/20">
                          <CheckCircle2 size={12} /> مسجلة
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border/50">
                          — غير مسجلة
                        </span>
                      )}
                    </td>
                    <td className="ta-td">
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
                              <Trash2 size={12} className="text-destructive" />
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
