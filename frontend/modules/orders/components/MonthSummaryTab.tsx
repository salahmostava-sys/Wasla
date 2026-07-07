import React from 'react';
import { TrendingUp, Wallet } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { OrdersMonthNavigator } from '@shared/components/orders/OrdersMonthNavigator';
import { OrdersSummaryTable } from '@shared/components/orders/OrdersSummaryTable';
import { useAppColors } from '@shared/hooks/useAppColors';
import { useMonthSummaryTab } from '@modules/orders/hooks/useMonthSummaryTab';
import { monthLabel } from '@modules/orders/utils/dateMonth';
import { shortName } from '@modules/orders/utils/text';
import { MonthSummaryStats } from '@modules/orders/components/MonthSummaryStats';
import { Button } from '@shared/components/ui/button';

export const MonthSummaryTab = React.memo(() => {
  const m = useMonthSummaryTab();
  const { apps: appColorsList } = useAppColors();
  const navigate = useNavigate();

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex items-center gap-2 border border-border bg-card px-3 py-1.5 rounded-2xl">
          <TrendingUp size={14} className="text-primary" />
          <span className="text-sm font-semibold text-foreground">ملخص الشهر</span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 h-8 text-xs border-primary/40 text-primary hover:bg-primary/5"
            onClick={() => navigate('/salaries')}
          >
            <Wallet size={13} />
            احسب الرواتب
          </Button>
          <OrdersMonthNavigator label={monthLabel(m.year, m.month)} onPrev={m.prevMonth} onNext={m.nextMonth} />
        </div>
      </div>

      <MonthSummaryStats
        loading={m.loading}
        apps={m.apps}
        appColorsList={appColorsList}
        employeesCount={m.employees.length}
        grandTotal={m.grandTotal}
        targets={m.targets}
        setTargets={m.setTargets}
        employeeTargets={m.employeeTargets}
        setEmployeeTargets={m.setEmployeeTargets}
        appGrandTotal={m.appGrandTotal}
        saveTargets={m.saveTargets}
        savingTarget={m.savingTarget}
        canEdit={m.permissions.can_edit}
        isMonthLocked={m.isMonthLocked}
      />

      <div className="bg-card shadow-card overflow-hidden rounded-2xl">
        <div className="overflow-x-auto">
          <OrdersSummaryTable
            loading={m.loading}
            apps={m.apps}
            appColorsList={appColorsList}
            sortedEmployees={m.sortedEmployees}
            employeesCount={m.employees.length}
            data={m.data}
            dayArr={m.dayArr}
            days={m.days}
            empTotal={m.empTotal}
            appGrandTotal={m.appGrandTotal}
            grandTotal={m.grandTotal}
            shortName={shortName}
            sortField={m.sortField}
            sortDir={m.sortDir}
            onSort={m.handleSort}
          />
        </div>
      </div>
    </div>
  );
});

MonthSummaryTab.displayName = 'MonthSummaryTab';
