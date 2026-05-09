import { Check, X } from 'lucide-react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import type { AppData, AppEmployee } from '@modules/apps/types';

interface AppEmployeesPanelProps {
  app: AppData;
  monthYear: string;
  employees: AppEmployee[];
  loading: boolean;
  onClose: () => void;
}

const STATUS_LABELS: Record<string, string> = {
  active: 'نشط',
  inactive: 'موقوف',
};
const STATUS_CLASSES: Record<string, string> = {
  active: 'badge-success',
  inactive: 'badge-warning',
};
const getStatusLabel = (status: string) => STATUS_LABELS[status] ?? 'منتهي';
const getStatusClass = (status: string) => STATUS_CLASSES[status] ?? 'badge-urgent';

export const AppEmployeesPanel = ({
  app,
  monthYear,
  employees,
  loading,
  onClose,
}: Readonly<AppEmployeesPanelProps>) => {
  return (
    <div className="mt-8 space-y-4 animate-in fade-in slide-in-from-top-4">
      <div className="flex items-center justify-between rounded-xl border border-border bg-muted/30 p-4">
        <div className="flex items-center gap-3">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-lg font-bold text-white shadow-sm"
            style={{ backgroundColor: app.brand_color }}
          >
            {app.name.charAt(0)}
          </div>
          <div>
            <h3 className="font-bold text-foreground">تفاصيل أداء {app.name}</h3>
            <p className="text-[10px] text-muted-foreground">
              لشهر {format(new Date(`${monthYear}-01`), 'MMMM yyyy', { locale: ar })}
            </p>
          </div>
        </div>
        <button aria-label="إغلاق" onClick={onClose} className="text-muted-foreground hover:text-foreground" type="button">
          <X size={20} />
        </button>
      </div>

      <div className="ta-table-wrap">
        {loading ? (
          <div className="flex flex-col items-center gap-2 py-12 text-center text-sm text-muted-foreground">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            جاري تحميل أرقام المناديب...
          </div>
        ) : employees.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-muted/10 py-12 text-center text-muted-foreground">
            لم يتم تسجيل أي طلبات لهذه المنصة بواسطة المناديب في هذا الشهر.
          </div>
        ) : (
          <table className="w-full">
            <thead className="ta-thead">
              <tr>
                <th className="ta-th text-right">المندوب</th>
                <th className="ta-th text-center">رقم الهوية</th>
                <th className="ta-th text-center">الجوال</th>
                <th className="ta-th text-center">حالة العمل</th>
                <th className="ta-th text-center">الطلبات المنفذة</th>
                <th className="ta-th text-center">حصة الهدف</th>
                <th className="ta-th text-center">التوقع</th>
                <th className="ta-th text-center">الحالة</th>
              </tr>
            </thead>
            <tbody>
              {employees.map((employee) => {
                const statusLabel = getStatusLabel(employee.status);
                const statusClass = getStatusClass(employee.status);
                
                return (
                  <tr key={employee.id} className="ta-tr group">
                    <td className="ta-td text-right">
                      <div>
                        <p className="font-bold text-foreground">{employee.name}</p>
                        {employee.job_title && (
                          <p className="text-[10px] text-muted-foreground">{employee.job_title}</p>
                        )}
                      </div>
                    </td>
                    <td className="ta-td text-center">
                      <span className="text-xs font-mono text-muted-foreground" dir="ltr">
                        {employee.national_id || '—'}
                      </span>
                    </td>
                    <td className="ta-td text-center">
                      <span className="text-xs font-mono text-muted-foreground" dir="ltr">
                        {employee.phone || '—'}
                      </span>
                    </td>
                    <td className="ta-td text-center">
                      <span className={`${statusClass} text-[10px]`}>{statusLabel}</span>
                    </td>
                    <td className="ta-td text-center text-sm font-black" style={{ color: app.brand_color }}>
                      {employee.monthOrders.toLocaleString('en-US')}
                    </td>
                    <td className="ta-td text-center text-xs tabular-nums text-muted-foreground">
                      {employee.targetShare == null ? '—' : Math.round(employee.targetShare).toLocaleString('en-US')}
                    </td>
                    <td className="ta-td text-center text-xs font-semibold tabular-nums">
                      {employee.projectedMonthEnd == null ? '—' : employee.projectedMonthEnd.toLocaleString('en-US')}
                    </td>
                    <td className="ta-td text-center">
                      {(() => {
                        if (employee.onTrack === null) {
                          return <span className="text-[10px] text-muted-foreground">بدون هدف</span>;
                        }
                        if (employee.onTrack) {
                          return (
                            <div className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-600">
                              <Check size={10} /> يحقق التارجت
                            </div>
                          );
                        }
                        return (
                          <div className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-600">
                            <X size={10} /> تحت التارجت
                          </div>
                        );
                      })()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
