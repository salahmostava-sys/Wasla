import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { useTemporalContext } from '@app/providers/TemporalContext';
import { authQueryUserId, useAuthQueryGate } from '@shared/hooks/useAuthQueryGate';
import { performanceService } from '@services/performanceService';
import { Button } from '@shared/components/ui/button';
import { Input } from '@shared/components/ui/input';
import { useToast } from '@shared/hooks/use-toast';
import { usePermissions } from '@shared/hooks/usePermissions';
import { getErrorMessage } from '@services/serviceError';
import { RiderProfilePerformanceCard } from '@modules/dashboard/components/RiderProfilePerformanceCard';
import { Skeleton } from '@shared/components/ui/skeleton';

export function EmployeePerformanceTab(props: Readonly<{ employeeId: string }>) {
  const { employeeId } = props;
  const queryClient = useQueryClient();
  const { enabled, userId } = useAuthQueryGate();
  const uid = authQueryUserId(userId);
  const { selectedMonth } = useTemporalContext();
  const { toast } = useToast();
  const { permissions } = usePermissions('orders');
  const [monthlyTargetOrders, setMonthlyTargetOrders] = useState('0');
  const [dailyTargetOrders, setDailyTargetOrders] = useState('0');
  const [savingTargets, setSavingTargets] = useState(false);

  const performanceQuery = useQuery({
    queryKey: ['employee-performance', uid, employeeId, selectedMonth] as const,
    enabled,
    staleTime: 60_000,
    queryFn: () => performanceService.getRiderProfile(employeeId, selectedMonth),
  });

  useEffect(() => {
    if (!performanceQuery.data) return;
    setMonthlyTargetOrders(String(performanceQuery.data.summary.monthlyTargetOrders ?? 0));
    setDailyTargetOrders(String(performanceQuery.data.summary.dailyTargetOrders ?? 0));
  }, [performanceQuery.data]);

  const handleSaveTargets = async () => {
    setSavingTargets(true);
    try {
      await performanceService.upsertEmployeeTarget({
        employeeId,
        monthYear: selectedMonth,
        monthlyTargetOrders: Math.max(Number(monthlyTargetOrders) || 0, 0),
        dailyTargetOrders: Math.max(Number(dailyTargetOrders) || 0, 0),
      });
      await queryClient.invalidateQueries({ queryKey: ['employee-performance', uid, employeeId, selectedMonth] });
      await queryClient.invalidateQueries({ queryKey: ['performance-dashboard', uid, selectedMonth] });
      toast({ title: 'تم حفظ الهدف', description: 'تم تحديث أهداف المندوب لهذا الشهر' });
    } catch (error) {
      toast({
        title: 'تعذر حفظ الهدف',
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    } finally {
      setSavingTargets(false);
    }
  };

  if (performanceQuery.isLoading) {
    return <Skeleton  className="bg-card -2xl h-72 shadow-card rounded-2xl" />;
  }

  if (performanceQuery.isError || !performanceQuery.data) {
    return (
      <div className="bg-card -2xl border border-border/60 p-6 text-sm text-muted-foreground rounded-2xl">
        تعذر تحميل تحليل الأداء.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ── New Unified Rider Profile Performance Card ── */}
      <RiderProfilePerformanceCard data={performanceQuery.data} />

      {/* ── Targets Form ── */}
      <div className="bg-card -2xl p-5 shadow-card md:max-w-md rounded-2xl">
        <h3 className="text-sm font-bold text-foreground mb-4">إعدادات الأهداف</h3>
        <div className="space-y-3">
          <div>
            <label className="text-[11px] text-muted-foreground" htmlFor="perf-field-1">الهدف الشهري (عدد الطلبات)</label>
            <Input
              id="perf-field-1"
              value={monthlyTargetOrders}
              onChange={(event) => setMonthlyTargetOrders(event.target.value)}
              inputMode="numeric"
              disabled={!permissions.can_edit || savingTargets}
            />
          </div>
          <div>
            <label className="text-[11px] text-muted-foreground" htmlFor="perf-field-2">الهدف اليومي (المنطقي)</label>
            <Input
              id="perf-field-2"
              value={dailyTargetOrders}
              onChange={(event) => setDailyTargetOrders(event.target.value)}
              inputMode="numeric"
              disabled={!permissions.can_edit || savingTargets}
            />
          </div>
          {permissions.can_edit ? (
            <Button className="w-full mt-2" onClick={() => { handleSaveTargets(); }} disabled={savingTargets}>
              {savingTargets ? 'جارٍ الحفظ...' : 'حفظ الأهداف'}
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
