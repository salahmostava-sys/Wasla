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

export function FuelMonthlyStats(props: Readonly<{ totalKm: number; totalFuel: number; avgCostPerKm: number; totalOrders: number; pageTab?: string }>) {
  const { totalKm, totalFuel, avgCostPerKm, totalOrders, pageTab = 'summary' } = props;

  if (pageTab === 'fuel') {
    const avgFuelPerOrder = totalOrders > 0 ? (totalFuel / totalOrders) : 0;
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard icon={<Fuel size={22} />} label="إجمالي تكلفة البنزين" value={`${totalFuel.toLocaleString('en-US')} ر.س`} sub="هذا الشهر" />
        <StatCard icon={<DollarSign size={22} />} label="متوسط البنزين للطلب" value={avgFuelPerOrder > 0 ? `${avgFuelPerOrder.toFixed(2)} ر.س` : '—'} sub="ر.س / طلب" />
        <StatCard icon={<Package size={22} />} label="إجمالي الطلبات" value={totalOrders.toLocaleString('en-US')} sub="الطلبات المسجلة" />
      </div>
    );
  }

  if (pageTab === 'km') {
    const avgKmPerOrder = totalOrders > 0 ? (totalKm / totalOrders) : 0;
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard icon={<TrendingUp size={22} />} label="إجمالي الكيلومترات" value={totalKm.toLocaleString('en-US')} sub="كم هذا الشهر" />
        <StatCard icon={<TrendingUp size={22} />} label="متوسط الكيلومترات للطلب" value={avgKmPerOrder > 0 ? `${avgKmPerOrder.toFixed(2)} كم` : '—'} sub="كم / طلب" />
        <StatCard icon={<Package size={22} />} label="إجمالي الطلبات" value={totalOrders.toLocaleString('en-US')} sub="الطلبات المسجلة" />
      </div>
    );
  }

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
