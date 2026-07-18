import { Check, X } from 'lucide-react';
import { format } from 'date-fns';
import { ar, enUS } from 'date-fns/locale';
import type { AppData, AppEmployee } from '@modules/apps/types';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '@app/providers/LanguageContext';

interface AppEmployeesPanelProps {
  app: AppData;
  monthYear: string;
  employees: AppEmployee[];
  loading: boolean;
  onClose: () => void;
}

const STATUS_CLASSES: Record<string, string> = {
  active: 'badge-success',
  inactive: 'badge-warning',
};
const getStatusClass = (status: string) => STATUS_CLASSES[status] ?? 'badge-urgent';

export const AppEmployeesPanel = ({
  app,
  monthYear,
  employees,
  loading,
  onClose,
}: Readonly<AppEmployeesPanelProps>) => {
  const { t } = useTranslation();
  const { lang } = useLanguage();
  const locale = lang === 'ar' ? ar : enUS;
  const getStatusLabel = (status: string) => {
    if (status === 'active') return t('active');
    if (status === 'inactive') return t('inactive');
    return t('ended');
  };

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
            <h3 className="font-bold text-foreground">{t('platformPerformanceDetails', { name: app.name })}</h3>
            <p className="text-[10px] text-muted-foreground">
              {t('forMonth', { month: format(new Date(`${monthYear}-01`), 'MMMM yyyy', { locale }) })}
            </p>
          </div>
        </div>
        <button aria-label={t('close')} onClick={onClose} className="text-muted-foreground hover:text-foreground" type="button">
          <X size={20} />
        </button>
      </div>

      <div className="ta-table-wrap">
        {loading && (
          <div className="flex flex-col items-center gap-2 py-12 text-center text-sm text-muted-foreground">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            {t('loadingRiderNumbers')}
          </div>
        )}
        {!loading && employees.length === 0 && (
          <div className="rounded-xl border border-dashed border-border bg-muted/10 py-12 text-center text-muted-foreground">
            {t('noPlatformOrdersThisMonth')}
          </div>
        )}
        {!loading && employees.length > 0 && (
          <table className="w-full">
            <thead className="ta-thead">
              <tr>
                <th className="ta-th text-start">{t('walletRider')}</th>
                <th className="ta-th">{t('nationalId')}</th>
                <th className="ta-th">{t('phone')}</th>
                <th className="ta-th">{t('workStatus')}</th>
                <th className="ta-th">{t('completedOrders')}</th>
                <th className="ta-th">{t('targetShare')}</th>
                <th className="ta-th">{t('projection')}</th>
                <th className="ta-th">{t('status')}</th>
              </tr>
            </thead>
            <tbody>
              {employees.map((employee) => {
                const statusLabel = getStatusLabel(employee.status);
                const statusClass = getStatusClass(employee.status);
                
                return (
                  <tr key={employee.id} className="ta-tr group">
                    <td className="ta-td text-start">
                      <div>
                        <p className="font-bold text-foreground">{employee.name}</p>
                        {employee.job_title && (
                          <p className="text-[10px] text-muted-foreground">{employee.job_title}</p>
                        )}
                      </div>
                    </td>
                    <td className="ta-td">
                      <span className="text-xs font-mono text-muted-foreground" dir="ltr">
                        {employee.national_id || '—'}
                      </span>
                    </td>
                    <td className="ta-td">
                      <span className="text-xs font-mono text-muted-foreground" dir="ltr">
                        {employee.phone || '—'}
                      </span>
                    </td>
                    <td className="ta-td">
                      <span className={`${statusClass} text-[10px]`}>{statusLabel}</span>
                    </td>
                    <td className="ta-td font-black" style={{ color: app.brand_color }}>
                      {employee.monthOrders.toLocaleString('en-US')}
                    </td>
                    <td className="ta-td tabular-nums text-muted-foreground">
                      {employee.targetShare == null ? '—' : Math.round(employee.targetShare).toLocaleString('en-US')}
                    </td>
                    <td className="ta-td font-semibold tabular-nums">
                      {employee.projectedMonthEnd == null ? '—' : employee.projectedMonthEnd.toLocaleString('en-US')}
                    </td>
                    <td className="ta-td">
                      {(() => {
                        if (employee.onTrack === null) {
                          return <span className="text-[10px] text-muted-foreground">{t('noTarget')}</span>;
                        }
                        if (employee.onTrack) {
                          return (
                            <div className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-600">
                              <Check size={10} /> {t('onTrackTarget')}
                            </div>
                          );
                        }
                        return (
                          <div className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-600">
                            <X size={10} /> {t('belowTarget')}
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
