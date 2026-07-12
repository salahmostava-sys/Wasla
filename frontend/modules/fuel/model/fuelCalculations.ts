
type MonthlyRowLike = { employee_name: string; km_total: number; fuel_cost: number; orders_count: number };
type DailyRowLike = { km_total: number; fuel_cost: number; employee?: { name: string } };

export const fuelPerOrderBadgeClass = (v: number | null) => {
  if (v === null || !Number.isFinite(v)) return null;
  if (v < 0.5) return { label: 'ممتاز', className: 'badge-success' };
  if (v <= 1) return { label: 'متوسط', className: 'badge-warning' };
  return { label: 'مرتفع', className: 'badge-urgent' };
};

export const filterMonthlyRows = <T extends MonthlyRowLike>(rows: T[], search: string): T[] =>
  rows.filter((row) => !search || row.employee_name.toLowerCase().includes(search.toLowerCase()));

export const filterDailyRows = <T extends DailyRowLike>(rows: T[], search: string): T[] =>
  rows.filter((row) => !search || (row.employee?.name ?? '').toLowerCase().includes(search.toLowerCase()));

export const calcMonthlyStats = <T extends MonthlyRowLike>(rows: T[]) => {
  const totalKm = rows.reduce((sum, row) => sum + row.km_total, 0);
  const totalFuel = rows.reduce((sum, row) => sum + row.fuel_cost, 0);
  const totalOrders = rows.reduce((sum, row) => sum + row.orders_count, 0);
  const avgCostPerKm = totalKm > 0 ? totalFuel / totalKm : 0;
  return { totalKm, totalFuel, totalOrders, avgCostPerKm };
};

export const calcDailyStats = <T extends DailyRowLike>(rows: T[]) => ({
  dailyTotalKm: rows.reduce((sum, row) => sum + row.km_total, 0),
  dailyTotalFuel: rows.reduce((sum, row) => sum + row.fuel_cost, 0),
});
