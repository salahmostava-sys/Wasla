import { differenceInDays, parseISO } from 'date-fns';
import { AppWindow, Banknote, FileClock, HandCoins, ShoppingBag, type LucideIcon } from 'lucide-react';

import { formatCurrency } from '@shared/lib/formatters';
import type {
  Advance,
  DailyOrder,
  Employee,
  EmployeeApp,
  SalaryRecord,
} from './employeeProfile.types';
import { groupOrdersByMonth, monthLabel } from './employeeProfile.utils';

type EmployeeProfileOverviewProps = Readonly<{
  employee: Employee;
  advances: Advance[];
  salaries: SalaryRecord[];
  employeeApps: EmployeeApp[];
  dailyOrders: DailyOrder[];
  loading: boolean;
}>;

type ExpiryItem = {
  label: string;
  date: string | null | undefined;
};

function activeAdvanceRemaining(advances: Advance[]): number {
  return advances
    .filter((advance) => advance.status === 'active')
    .reduce((total, advance) => {
      const paid = (advance.advance_installments ?? [])
        .filter((installment) => installment.status === 'deducted')
        .reduce((sum, installment) => sum + installment.amount, 0);
      return total + Math.max(advance.amount - paid, 0);
    }, 0);
}

function expiryStatus(date: string | null | undefined): { label: string; className: string } {
  if (!date) return { label: 'غير مسجل', className: 'text-muted-foreground' };
  const days = differenceInDays(parseISO(date), new Date());
  if (days < 0) return { label: `منتهي منذ ${Math.abs(days)} يوم`, className: 'text-destructive' };
  if (days <= 60) return { label: `متبقي ${days} يوم`, className: 'text-warning' };
  return { label: 'ساري', className: 'text-success' };
}

function SummaryMetric({
  icon: Icon,
  label,
  value,
  detail,
}: Readonly<{
  icon: LucideIcon;
  label: string;
  value: string;
  detail: string;
}>) {
  return (
    <div className="rounded-lg border border-border/60 bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon size={17} aria-hidden />
        </div>
        <p className="text-xl font-bold text-foreground" dir="auto">{value}</p>
      </div>
      <p className="mt-3 text-sm font-semibold text-foreground">{label}</p>
      <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
    </div>
  );
}

export function EmployeeProfileOverview({
  employee,
  advances,
  salaries,
  employeeApps,
  dailyOrders,
  loading,
}: EmployeeProfileOverviewProps) {
  const latestOrdersMonth = groupOrdersByMonth(dailyOrders)[0];
  const latestSalary = salaries[0];
  const outstandingAdvances = activeAdvanceRemaining(advances);
  const expiryItems: ExpiryItem[] = [
    { label: 'الإقامة', date: employee.residency_expiry },
    { label: 'التأمين الصحي', date: employee.health_insurance_expiry },
    { label: 'رخصة القيادة', date: employee.license_expiry },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <SummaryMetric
          icon={AppWindow}
          label="التطبيقات النشطة"
          value={loading ? '...' : String(employeeApps.filter((app) => app.status === 'active').length)}
          detail={`${employeeApps.length} تطبيق مرتبط`}
        />
        <SummaryMetric
          icon={ShoppingBag}
          label="أحدث شهر للطلبات"
          value={loading ? '...' : (latestOrdersMonth?.total.toLocaleString('en-US') ?? '0')}
          detail={latestOrdersMonth?.label ?? 'لا توجد طلبات مسجلة'}
        />
        <SummaryMetric
          icon={HandCoins}
          label="السلف المتبقية"
          value={loading ? '...' : formatCurrency(outstandingAdvances)}
          detail={`${advances.filter((advance) => advance.status === 'active').length} سلفة نشطة`}
        />
        <SummaryMetric
          icon={Banknote}
          label="آخر راتب صافي"
          value={(() => {
            if (loading) return '...';
            if (latestSalary) return formatCurrency(latestSalary.net_salary);
            return 'غير مسجل';
          })()}
          detail={latestSalary ? monthLabel(latestSalary.month_year) : 'لا توجد رواتب معتمدة'}
        />
      </div>

      <section className="rounded-lg border border-border/60 bg-card" aria-labelledby="employee-expiry-heading">
        <div className="flex items-center gap-2 border-b border-border/60 px-4 py-3">
          <FileClock size={17} className="text-primary" aria-hidden />
          <h3 id="employee-expiry-heading" className="font-semibold text-foreground">حالة الوثائق</h3>
        </div>
        <div className="divide-y divide-border/60">
          {expiryItems.map((item) => {
            const status = expiryStatus(item.date);
            return (
              <div key={item.label} className="grid grid-cols-[1fr,auto] items-center gap-3 px-4 py-3 text-sm">
                <span className="font-medium text-foreground">{item.label}</span>
                <div className="text-end">
                  <span className={status.className}>{status.label}</span>
                  {item.date && <span className="ms-2 text-xs text-muted-foreground" dir="ltr">{item.date}</span>}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
