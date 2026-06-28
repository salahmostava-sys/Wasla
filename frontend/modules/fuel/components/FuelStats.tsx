import type React from 'react';
import { TrendingUp, Fuel, DollarSign, Package, Calendar } from 'lucide-react';

function StatCard(props: Readonly<{ icon: React.ReactNode; label: string; value: string; sub?: string }>) {
  const { icon, label, value, sub } = props;
  return (
    <div className="bg-card shadow-card p-5 flex items-center gap-4 rounded-2xl">
      <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary flex-shrink-0">{icon}</div>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-2xl font-bold text-foreground">{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

export function FuelMonthlyStats(props: Readonly<{ totalKm: number; totalFuel: number; avgCostPerKm: number; totalOrders: number }>) {
  const { totalKm, totalFuel, avgCostPerKm, totalOrders } = props;
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <StatCard icon={<TrendingUp size={22} />} label="إجمالي الكيلومترات" value={totalKm.toLocaleString('en-US')} sub="كم هذا الشهر" />
      <StatCard icon={<Fuel size={22} />} label="إجمالي تكلفة البنزين" value={`${totalFuel.toLocaleString('en-US')} ر.س`} sub="هذا الشهر" />
      <StatCard icon={<DollarSign size={22} />} label="متوسط تكلفة الكيلومتر" value={avgCostPerKm > 0 ? `${avgCostPerKm.toFixed(3)} ر.س` : '—'} sub="ر.س / كم" />
      <StatCard icon={<Package size={22} />} label="إجمالي الطلبات" value={totalOrders.toLocaleString('en-US')} sub="من الطلبات اليومية" />
    </div>
  );
}

export function FuelDailyStats(props: Readonly<{ count: number; totalKm: number; totalFuel: number }>) {
  const { count, totalKm, totalFuel } = props;
  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
      <StatCard icon={<Calendar size={22} />} label="إجمالي الإدخالات" value={String(count)} sub="سجل في هذا الشهر" />
      <StatCard icon={<TrendingUp size={22} />} label="إجمالي الكيلومترات" value={totalKm.toLocaleString('en-US')} sub="كم" />
      <StatCard icon={<Fuel size={22} />} label="إجمالي تكلفة البنزين" value={`${totalFuel.toLocaleString('en-US')} ر.س`} sub="هذا الشهر" />
    </div>
  );
}
