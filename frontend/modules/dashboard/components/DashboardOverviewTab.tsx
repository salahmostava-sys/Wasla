import { lazy, Suspense, useEffect, useRef, useState } from 'react';

import { AlertsWidget } from '@modules/dashboard/components/AlertsWidget';
import { DashboardSupervisorTargetsCard } from '@modules/dashboard/components/DashboardSupervisorTargetsCard';
import { OrdersChart } from '@modules/dashboard/components/OrdersChart';
import { StatsCards } from '@modules/dashboard/components/StatsCards';
import { TopEmployees } from '@modules/dashboard/components/TopEmployees';
import type { AtRiskRider } from '@modules/dashboard/hooks/useDashboard';

const loadAttendanceChart = () =>
  import('@modules/dashboard/components/AttendanceChart').then((module) => ({
    default: module.AttendanceChart,
  }));

const LazyAttendanceChart = lazy(loadAttendanceChart);

function SectionPlaceholder({
  title,
  rows = 3,
}: Readonly<{
  title: string;
  rows?: number;
}>) {
  return (
    <div className="bg-card -2xl shadow-card p-5 rounded-2xl">
      <div className="flex items-center justify-between gap-3 mb-4">
        <h3 className="text-sm font-bold text-foreground">{title}</h3>
        <div className="h-4 w-24 rounded bg-muted/40 animate-pulse" />
      </div>

      <div className="space-y-3">
        {Array.from({ length: rows }, (_, index) => (
          <div key={`${title}-${index + 1}`} className="h-14 rounded-xl bg-muted/40 animate-pulse" />
        ))}
      </div>
    </div>
  );
}

function useNearViewport(rootMargin = '240px') {
  const ref = useRef<HTMLDivElement | null>(null);
  const [isActive, setIsActive] = useState(false);

  useEffect(() => {
    if (isActive) return;

    const node = ref.current;
    if (!node || typeof IntersectionObserver === 'undefined') {
      setIsActive(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        setIsActive(true);
        observer.disconnect();
      },
      { rootMargin },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [isActive, rootMargin]);

  return { ref, isActive };
}

type RiderEntry = {
  name: string;
  orders: number;
  app: string;
  appColor: string;
  appId: string;
};

type AppRidersGroup = {
  id: string;
  name: string;
  brand_color: string;
  riders: RiderEntry[];
};

type DashboardOverviewTabProps = {
  loading: boolean;
  kpis: {
    activeRiders: number;
    totalMonthTarget: number;
    targetAchievementPct: number;
    presentToday: number;
    absentToday: number;
    lateToday: number;
    leaveToday: number;
    sickToday: number;
    totalOrders: number;
    prevMonthOrders: number;
    activeVehicles: number;
    activeAlerts: number;
    fuelCost?: number;
    fuelLiters?: number;
    maintenanceCost?: number;
    violationsCount?: number;
    violationsCost?: number;
    pendingAdvances?: number;
    totalSalaries?: number;
  };
  orderGrowth: number;
  ordersByApp: {
    app: string;
    orders: number;
    target: number;
    brandColor: string;
    textColor: string;
    riders: number;
  }[];
  ordersByCity: { city: string; orders: number }[];
  topNInput: string;
  setTopNInput: (value: string) => void;
  handleTopNBlur: () => void;
  topRidersOverall: RiderEntry[];
  topRidersPerApp: AppRidersGroup[];
  bottomRidersPerApp: AppRidersGroup[];
  atRiskRiders: AtRiskRider[];
  attendanceWeek: { day: string; present: number; absent: number; leave: number; sick: number; late: number }[];
  supervisorPerformance: Array<{
    supervisor_id: string;
    supervisor_name: string;
    target_orders: number;
    actual_orders: number;
    achievement_percent: number;
  }>;
};

export function DashboardOverviewTab({
  loading,
  kpis,
  orderGrowth,
  ordersByApp,
  ordersByCity,
  topNInput,
  setTopNInput,
  handleTopNBlur,
  topRidersOverall,
  topRidersPerApp,
  bottomRidersPerApp,
  atRiskRiders,
  attendanceWeek,
  supervisorPerformance,
}: Readonly<DashboardOverviewTabProps>) {
  const attendanceSection = useNearViewport();
  const alertsSection = useNearViewport('320px');

  return (
    <div className="space-y-6">
      <StatsCards loading={loading} kpis={kpis} orderGrowth={orderGrowth} />

      <DashboardSupervisorTargetsCard loading={loading} rows={supervisorPerformance} />

      <OrdersChart
        loading={loading}
        ordersByApp={ordersByApp}
        ordersByCity={ordersByCity}
        totalOrders={kpis.totalOrders}
      />

      <TopEmployees
        loading={loading}
        topNInput={topNInput}
        setTopNInput={setTopNInput}
        handleTopNBlur={handleTopNBlur}
        topRidersOverall={topRidersOverall}
        topRidersPerApp={topRidersPerApp}
        bottomRidersPerApp={bottomRidersPerApp}
        atRiskRiders={atRiskRiders}
      />

      <div ref={attendanceSection.ref}>
        {attendanceSection.isActive ? (
          <Suspense fallback={<SectionPlaceholder title="الحضور" rows={5} />}>
            <LazyAttendanceChart
              loading={loading}
              kpis={{
                presentToday: kpis.presentToday,
                lateToday: kpis.lateToday,
                absentToday: kpis.absentToday,
                leaveToday: kpis.leaveToday,
                sickToday: kpis.sickToday,
              }}
              attendanceWeek={attendanceWeek}
            />
          </Suspense>
        ) : (
          <SectionPlaceholder title="الحضور" rows={5} />
        )}
      </div>

      <div ref={alertsSection.ref}>
        {alertsSection.isActive ? (
          <Suspense fallback={<SectionPlaceholder title="التنبيهات" rows={4} />}>
            <AlertsWidget />
          </Suspense>
        ) : (
          <SectionPlaceholder title="التنبيهات" rows={4} />
        )}
      </div>
    </div>
  );
}
