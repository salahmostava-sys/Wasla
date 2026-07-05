import { getEmployeeCities } from '@modules/employees/model/employeeUtils';
import { cityLabel } from '@modules/employees/model/employeeCity';
import { EMPTY_DATA_PLACEHOLDER } from '@modules/employees/types/employee.types';
import { Employee, MonthlyOrders, DailyOrder } from './employeeProfile.types';

export function employeeCitySummary(employee: Pick<Employee, 'cities' | 'city'>): string {
  const values = getEmployeeCities(employee);
  if (values.length === 0) return EMPTY_DATA_PLACEHOLDER;
  return values.map((value) => cityLabel(value, value)).join('، ');
}

export const statusLabels: Record<string, string> = {
  active: 'نشط', inactive: 'موقوف', ended: 'منتهي',
};
export const statusStyles: Record<string, string> = {
  active: 'badge-success', inactive: 'badge-warning', ended: 'badge-urgent',
};

export const advanceStatusLabel: Record<string, string> = {
  active: 'نشطة', completed: 'مكتملة', paused: 'موقوفة',
};
export const advanceStatusStyle: Record<string, string> = {
  active: 'badge-warning', completed: 'badge-success', paused: 'badge-info',
};

export const installmentStatusStyle: Record<string, string> = {
  deducted: 'badge-success', pending: 'badge-warning', deferred: 'bg-muted text-muted-foreground text-xs font-medium px-2.5 py-0.5 rounded-full',
};
export const installmentStatusLabel: Record<string, string> = {
  deducted: 'مخصوم', pending: 'معلّق', deferred: 'مؤجل',
};

export const salaryTypeBadgeClass = (salaryType: string) => (salaryType === 'orders' ? 'badge-info' : 'badge-success');
export const salaryTypeLabel = (salaryType: string) => (salaryType === 'orders' ? 'طلبات' : 'دوام');

export function residencyHeaderUrgencyClass(days: number): string {
  if (days < 30) return 'text-destructive';
  if (days < 60) return 'text-warning';
  return 'text-success';
}

export function residencyExpiryTextClass(residencyDays: number | null): string {
  if (residencyDays === null) return 'text-foreground';
  if (residencyDays < 30) return 'text-destructive';
  if (residencyDays < 60) return 'text-warning';
  return 'text-foreground';
}

export function healthInsuranceExpiryTextClass(hiDays: number): string {
  if (hiDays < 0) return 'text-destructive';
  if (hiDays < 30) return 'text-destructive';
  if (hiDays < 60) return 'text-warning';
  return 'text-foreground';
}

export function isImageDocument(path?: string | null) {
  const normalized = (path ?? '').toLowerCase();
  return ['.jpg', '.jpeg', '.png', '.webp'].some((ext) => normalized.endsWith(ext));
}

export const MONTH_LABELS: Record<string, string> = {
  '01': 'يناير', '02': 'فبراير', '03': 'مارس', '04': 'أبريل',
  '05': 'مايو', '06': 'يونيو', '07': 'يوليو', '08': 'أغسطس',
  '09': 'سبتمبر', '10': 'أكتوبر', '11': 'نوفمبر', '12': 'ديسمبر',
};

export function monthLabel(ym: string) {
  const [year, month] = ym.split('-');
  return `${MONTH_LABELS[month] || month} ${year}`;
}

export function groupOrdersByMonth(orders: DailyOrder[]): MonthlyOrders[] {
  const map: Record<string, MonthlyOrders> = {};
  for (const o of orders) {
    const month = o.date.slice(0, 7);
    if (!map[month]) {
      map[month] = { month, label: monthLabel(month), total: 0, byApp: [], days: [] };
    }
    map[month].total += o.orders_count;
    map[month].days.push(o);
    const appName = o.apps?.name || o.app_id;
    const existing = map[month].byApp.find(a => a.appName === appName);
    if (existing) {
      existing.count += o.orders_count;
    } else {
      map[month].byApp.push({ appName, color: o.apps?.brand_color || undefined, count: o.orders_count });
    }
  }
  return Object.values(map).sort((a, b) => b.month.localeCompare(a.month));
}

export const NATIONALITIES = [
  'سعودي', 'مصري', 'سوداني', 'يمني', 'سوري', 'أردني', 'فلسطيني', 'لبناني',
  'عراقي', 'باكستاني', 'هندي', 'بنغلاديشي', 'فلبيني', 'إندونيسي', 'نيبالي',
  'سريلانكي', 'إثيوبي', 'إريتري', 'صومالي', 'تشادي', 'نيجيري', 'غاني', 'كيني',
  'أوغندي', 'تنزاني',
];
