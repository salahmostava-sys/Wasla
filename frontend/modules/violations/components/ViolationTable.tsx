import { Button } from '@shared/components/ui/button';
import { CheckCircle2, Edit, Trash2, CreditCard } from 'lucide-react';
import { sortArrowOrNeutral } from '@shared/lib/sortTableIndicators';
import type { ViolationRecord, ViolationSortFieldKey } from '@modules/violations/types/violation.types';
import { ViolationAdvanceStatusCell } from '@modules/violations/components/ViolationAdvanceStatusCell';
import {
  violationApprovalStatusLabel,
  convertToAdvanceTitle,
  convertToAdvanceButtonLabel,
  deleteViolationButtonLabel,
  violationApprovalBadgeClasses,
} from '@modules/violations/lib/violationUtils';

type ViolationTableProps = Readonly<{
  violationsLoading: boolean;
  filteredSortedViolations: ViolationRecord[];
  toggleVSort: (field: ViolationSortFieldKey) => void;
  vSortField: ViolationSortFieldKey;
  vSortDir: 'asc' | 'desc';
  perms: { can_edit: boolean; can_delete: boolean };
  isViolationConvertedToAdvance: (v: ViolationRecord) => boolean;
  openEditViolation: (v: ViolationRecord) => void;
  handleDeleteViolation: (id: string) => void;
  handleConvertToAdvance: (v: ViolationRecord) => void;
  deletingId: string | null;
  convertingId: string | null;
}>;

export default function ViolationTable({
  violationsLoading,
  filteredSortedViolations,
  toggleVSort,
  vSortField,
  vSortDir,
  perms,
  isViolationConvertedToAdvance,
  openEditViolation,
  handleDeleteViolation,
  handleConvertToAdvance,
  deletingId,
  convertingId,
}: Readonly<ViolationTableProps>) {
  if (violationsLoading) {
    return <div className="p-10 text-center text-muted-foreground text-sm">جارٍ التحميل...</div>;
  }
  if (filteredSortedViolations.length === 0) {
    return (
      <div className="p-12 text-center text-muted-foreground">
        <CheckCircle2 className="mx-auto mb-3 text-success opacity-30" size={48} />
        <p className="font-medium">لا توجد نتائج مطابقة</p>
        <p className="text-sm mt-1">غيّر الفلاتر أو قم بتسجيل مخالفات جديدة.</p>
      </div>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="data-table w-full min-w-[980px] text-sm">
        <thead className="bg-muted/40 border-b border-border">
          <tr>
            <th onClick={() => toggleVSort('employee_name')} className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground whitespace-nowrap cursor-pointer hover:text-foreground select-none">
              اسم الموظف {sortArrowOrNeutral(vSortField, 'employee_name', vSortDir, '')}
            </th>
            <th onClick={() => toggleVSort('violation_details')} className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground cursor-pointer hover:text-foreground select-none min-w-[200px]">
              تفاصيل المخالفة {sortArrowOrNeutral(vSortField, 'violation_details', vSortDir, '')}
            </th>
            <th onClick={() => toggleVSort('incident_date')} className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground whitespace-nowrap cursor-pointer hover:text-foreground select-none">
              التاريخ {sortArrowOrNeutral(vSortField, 'incident_date', vSortDir, '')}
            </th>
            <th onClick={() => toggleVSort('amount')} className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground whitespace-nowrap cursor-pointer hover:text-foreground select-none">
              المبلغ {sortArrowOrNeutral(vSortField, 'amount', vSortDir, '')}
            </th>
            <th onClick={() => toggleVSort('status')} className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground whitespace-nowrap cursor-pointer hover:text-foreground select-none">
              الحالة {sortArrowOrNeutral(vSortField, 'status', vSortDir, '')}
            </th>
            <th onClick={() => toggleVSort('advance_status')} className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground whitespace-nowrap cursor-pointer hover:text-foreground select-none" title="مربوط بجدول السلف في قاعدة البيانات أو سجل قديم في الملاحظة">
              حالة السلفة {sortArrowOrNeutral(vSortField, 'advance_status', vSortDir, '')}
            </th>
            <th className="ta-th">إجراءات</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/40">
          {filteredSortedViolations.map(v => {
            const statusBadge = violationApprovalBadgeClasses(v.status);
            const convertedAdv = isViolationConvertedToAdvance(v);

            return (
              <tr key={v.id} className="hover:bg-muted/20 transition-colors">
                <td className="ta-td font-semibold">{v.employee_name}</td>
                <td className="ta-td text-muted-foreground align-top">
                  <div className="max-w-[520px] whitespace-pre-wrap break-words">{v.violation_details || '—'}</div>
                </td>
                <td className="ta-td text-muted-foreground">{v.incident_date || '—'}</td>
                <td className="ta-td font-medium">{v.amount?.toLocaleString('en-US')} ر.س</td>
                <td className="ta-td">
                  <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${statusBadge}`}>
                    {violationApprovalStatusLabel(v.status)}
                  </span>
                </td>
                <td className="ta-td align-top">
                  <ViolationAdvanceStatusCell v={v} convertedAdv={convertedAdv} />
                </td>
                <td className="ta-td">
                  <div className="flex items-center justify-center gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 px-2 text-xs"
                      disabled={!perms.can_edit}
                      onClick={() => openEditViolation(v)}
                    >
                      <Edit size={14} /> تعديل
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 px-2 text-xs text-destructive hover:text-destructive"
                      disabled={!perms.can_delete || deletingId === v.id}
                      onClick={() => handleDeleteViolation(v.id)}
                    >
                      <Trash2 size={14} className="text-destructive" /> {deleteViolationButtonLabel(deletingId, v.id)}
                    </Button>
                    <Button
                      size="sm"
                      className="h-8 px-2 text-xs gap-2"
                      disabled={!perms.can_edit || convertingId === v.id || convertedAdv}
                      onClick={() => handleConvertToAdvance(v)}
                      title={convertToAdvanceTitle(convertedAdv)}
                    >
                      <CreditCard size={14} />
                      {convertToAdvanceButtonLabel(convertingId, v.id, convertedAdv)}
                    </Button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
