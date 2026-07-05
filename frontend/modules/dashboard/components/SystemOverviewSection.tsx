/**
 * SystemOverviewSection — نظرة شاملة على النظام كله (موظفين، حضور، رواتب، سلف،
 * وقود، صيانة، مركبات، تنبيهات، أداء المشرفين، آخر الأنشطة) في مكان واحد أعلى
 * صفحة الأداء.
 *
 * البطاقات المالية (الرواتب/السلف) وآخر الأنشطة مخفية بالكامل عن دور "operations"
 * (المشرفين) — عرض واجهة فقط، والحماية الحقيقية للبيانات تتم عبر RLS على مستوى
 * قاعدة البيانات.
 */

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { ar } from 'date-fns/locale';
import type { LucideIcon } from 'lucide-react';
import {
  AlertTriangle,
  Banknote,
  Car,
  Clock,
  Fuel,
  History,
  UserCheck,
  UserX,
  Users,
  Wallet,
  Wrench,
} from 'lucide-react';

import { useAuth } from '@app/providers/AuthContext';
import { useTemporalContext } from '@app/providers/TemporalContext';
import { authQueryUserId, useAuthQueryGate } from '@shared/hooks/useAuthQueryGate';
import { Skeleton } from '@shared/components/ui/skeleton';
import { dashboardService } from '@services/dashboardService';

/** Roles allowed to see financial data (salaries, advances, fuel/maintenance cost, audit log). */
const FINANCE_VISIBLE_ROLES = new Set(['admin', 'hr', 'finance']);

function formatCurrency(value: number) {
  return `${Math.round(value).toLocaleString('en-US')} ج.م`;
}

function StatCard(props: Readonly<{
  label: string;
  value: string;
  sub?: string;
  icon: LucideIcon;
  accent?: 'default' | 'good' | 'warn' | 'bad';
}>) {
  const { label, value, sub, icon: Icon, accent = 'default' } = props;
  const accentClasses: Record<string, string> = {
    default: 'bg-muted/40 text-foreground',
    good: 'bg-emerald-500/10 text-emerald-600',
    warn: 'bg-amber-500/10 text-amber-600',
    bad: 'bg-rose-500/10 text-rose-500',
  };
  return (
    <div className="bg-card p-4 shadow-card rounded-2xl">
      <div className="flex items-start justify-between gap-2">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${accentClasses[accent]}`}>
          <Icon size={18} />
        </div>
      </div>
      <div className="mt-3">
        <p className="text-xl font-black text-foreground leading-tight">{value}</p>
        <p className="text-xs font-semibold text-foreground/75 mt-2">{label}</p>
        {sub && <p className="text-[11px] text-muted-foreground mt-1">{sub}</p>}
      </div>
    </div>
  );
}

function actionLabel(action: string, tableName: string) {
  const tableLabels: Record<string, string> = {
    employees: 'موظف',
    salary_records: 'راتب',
    advances: 'سلفة',
    attendance: 'حضور',
    maintenance_logs: 'صيانة',
    vehicles: 'مركبة',
    alerts: 'تنبيه',
    daily_orders: 'طلبات',
  };
  const actionLabels: Record<string, string> = {
    INSERT: 'إضافة',
    UPDATE: 'تعديل',
    DELETE: 'حذف',
  };
  const t = tableLabels[tableName] ?? tableName;
  const a = actionLabels[action.toUpperCase()] ?? action;
  return `${a} ${t}`;
}

export function SystemOverviewSection() {
  const { role } = useAuth();
  const { enabled, userId } = useAuthQueryGate();
  const uid = authQueryUserId(userId);
  const { selectedMonth: currentMonth } = useTemporalContext();
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const canSeeFinance = role ? FINANCE_VISIBLE_ROLES.has(role) : false;

  const overviewQuery = useQuery({
    queryKey: ['system-overview', uid, currentMonth, canSeeFinance] as const,
    enabled,
    staleTime: 60_000,
    queryFn: async () => {
      const [kpisRes, additional, supervisorPerf, activeVehicles, unresolvedAlerts, recentActivity] =
        await Promise.all([
          dashboardService.getKPIs(currentMonth, today),
          dashboardService.getAdditionalMetrics(currentMonth),
          dashboardService.getSupervisorPerformance(currentMonth),
          dashboardService.getActiveVehiclesCount(),
          dashboardService.getUnresolvedAlertsCount(),
          canSeeFinance ? dashboardService.getRecentActivity(6) : Promise.resolve([]),
        ]);
      return {
        kpis: kpisRes.kpis,
        additional,
        supervisorPerf,
        activeVehicles,
        unresolvedAlerts,
        recentActivity,
      };
    },
  });

  if (overviewQuery.isLoading || !overviewQuery.data) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
        {Array.from({ length: 5 }, (_, index) => (
          <Skeleton key={index} className="bg-card h-32 shadow-card rounded-2xl" />
        ))}
      </div>
    );
  }

  const { kpis, additional, supervisorPerf, activeVehicles, unresolvedAlerts, recentActivity } = overviewQuery.data;

  return (
    <div className="space-y-6">
      {/* ── Operational KPIs (visible to everyone) ───────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
        <StatCard label="الموظفين النشطين" value={kpis.activeEmployees.toLocaleString('en-US')} icon={Users} />
        <StatCard label="حاضر اليوم" value={kpis.presentToday.toLocaleString('en-US')} icon={UserCheck} accent="good" />
        <StatCard
          label="غايب اليوم"
          value={kpis.absentToday.toLocaleString('en-US')}
          icon={UserX}
          accent={kpis.absentToday > 0 ? 'warn' : 'default'}
        />
        <StatCard label="المركبات النشطة" value={activeVehicles.toLocaleString('en-US')} icon={Car} />
        <StatCard
          label="تنبيهات غير محلولة"
          value={unresolvedAlerts.toLocaleString('en-US')}
          icon={AlertTriangle}
          accent={unresolvedAlerts > 0 ? 'bad' : 'good'}
        />
      </div>

      {/* ── Financial + cost KPIs (hidden from supervisors/operations) ────── */}
      {canSeeFinance && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <StatCard
            label="إجمالي الرواتب المعتمدة"
            value={formatCurrency(kpis.totalSalaries)}
            sub="الشهر الحالي"
            icon={Banknote}
          />
          <StatCard
            label="السلف النشطة"
            value={formatCurrency(kpis.activeAdvances)}
            icon={Wallet}
          />
          <StatCard
            label="مصاريف الوقود"
            value={formatCurrency(additional.fuelCost)}
            sub="الشهر الحالي"
            icon={Fuel}
          />
          <StatCard
            label="مصاريف الصيانة"
            value={formatCurrency(additional.maintenanceCost)}
            sub="الشهر الحالي"
            icon={Wrench}
          />
        </div>
      )}

      {/* ── Supervisor performance + recent activity ──────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-[1.4fr,0.8fr] gap-4">
        <div className="bg-card p-5 shadow-card rounded-2xl">
          <div className="flex items-center justify-between gap-3 mb-4">
            <h3 className="text-sm font-bold text-foreground">أداء المشرفين</h3>
            <span className="text-xs font-semibold text-muted-foreground">{supervisorPerf.length} مشرف</span>
          </div>
          {supervisorPerf.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">لا توجد بيانات أهداف للمشرفين هذا الشهر</p>
          ) : (
            <div className="space-y-3">
              {supervisorPerf.map((row) => (
                <div key={row.supervisor_id} className="rounded-xl bg-muted/30 px-4 py-3 flex items-center justify-between gap-3">
                  <span className="text-sm font-medium text-foreground">{row.supervisor_name}</span>
                  <div className="flex items-center gap-3 text-xs">
                    <span className="text-muted-foreground">
                      {row.actual_orders.toLocaleString('en-US')} / {row.target_orders.toLocaleString('en-US')}
                    </span>
                    <span
                      className={`font-black ${row.achievement_percent >= 100 ? 'text-emerald-600' : 'text-amber-600'}`}
                    >
                      {row.achievement_percent.toFixed(0)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {canSeeFinance && (
          <div className="bg-card p-5 shadow-card rounded-2xl">
            <div className="flex items-center gap-2 mb-4">
              <History size={16} className="text-muted-foreground" />
              <h3 className="text-sm font-bold text-foreground">آخر الأنشطة في النظام</h3>
            </div>
            {recentActivity.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">لا توجد أنشطة حديثة</p>
            ) : (
              <div className="space-y-2">
                {recentActivity.map((entry) => (
                  <div
                    key={`${entry.user_id ?? 'system'}-${entry.table_name}-${entry.created_at}`}
                    className="flex items-center justify-between gap-2 text-sm py-2 border-b border-border/40 last:border-0"
                  >
                    <span className="text-foreground/85">{actionLabel(entry.action, entry.table_name)}</span>
                    <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                      <Clock size={11} />
                      {formatDistanceToNow(new Date(entry.created_at), { addSuffix: true, locale: ar })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
