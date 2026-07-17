export type RouteGroup =
  | 'dashboard'
  | 'hr'
  | 'finance'
  | 'operations'
  | 'fleet'
  | 'system';

export type AppRouteManifestItem = {
  id: string;
  titleAr: string;
  titleEn: string;
  group: RouteGroup;
  path: string;
  permission?: string;
  public?: boolean;
  sidebar?: boolean;
};

/** Manifest permission format: view_<pageKey> (ex: view_salaries). */
export const routePermission = (pageKey: string) => `view_${pageKey}`;

/**
 * Converts manifest permission token to permissions page key.
 * - view_salaries -> salaries
 * - salaries -> salaries (backward compatible)
 */
export const toPagePermissionKey = (permission?: string): string | undefined => {
  if (!permission) return undefined;
  return permission.startsWith('view_') ? permission.slice(5) : permission;
};

export const routesManifest: AppRouteManifestItem[] = [
  /** عرض البيانات والمؤشرات */
  { id: 'dashboard', titleAr: 'لوحة التحكم', titleEn: 'Dashboard', group: 'dashboard', path: '/', sidebar: true },

  { id: 'employees', titleAr: 'الموظفون', titleEn: 'Employees', group: 'hr', path: '/employees', permission: routePermission('employees'), sidebar: true },
  { id: 'attendance', titleAr: 'الحضور والانصراف', titleEn: 'Attendance', group: 'hr', path: '/attendance', permission: routePermission('attendance'), sidebar: true },
  { id: 'alerts', titleAr: 'التنبيهات', titleEn: 'Alerts', group: 'hr', path: '/alerts', permission: routePermission('alerts'), sidebar: true },
  { id: 'apps', titleAr: 'التطبيقات', titleEn: 'Platforms', group: 'hr', path: '/apps', permission: routePermission('apps'), sidebar: true },
  { id: 'apps_settings', titleAr: 'إعدادات المنصات', titleEn: 'Platform Settings', group: 'hr', path: '/apps/settings', permission: routePermission('apps'), sidebar: false },

  /** إدخال يومي وتشغيل */
  { id: 'orders', titleAr: 'الطلبات', titleEn: 'Orders', group: 'operations', path: '/orders', permission: routePermission('orders'), sidebar: true },
  { id: 'fuel', titleAr: 'استهلاك المناديب', titleEn: 'Rider Consumption', group: 'operations', path: '/fuel', permission: routePermission('fuel'), sidebar: true },
  { id: 'violation_resolver', titleAr: 'تسوية المخالفات', titleEn: 'Violation Settlement', group: 'operations', path: '/violation-resolver', permission: routePermission('violation_resolver'), sidebar: true },
  { id: 'employee_tiers', titleAr: 'شرائح الشركة', titleEn: 'Company SIM Cards', group: 'operations', path: '/employee-tiers', permission: routePermission('employee_tiers'), sidebar: true },

  { id: 'salaries', titleAr: 'الرواتب', titleEn: 'Payroll', group: 'finance', path: '/salaries', permission: routePermission('salaries'), sidebar: true },
  { id: 'salary_schemes', titleAr: 'مخططات الرواتب', titleEn: 'Salary Schemes', group: 'finance', path: '/settings?tab=schemes', permission: routePermission('salary_schemes'), sidebar: false },
  { id: 'advances', titleAr: 'السلف', titleEn: 'Advances', group: 'finance', path: '/advances', permission: routePermission('advances'), sidebar: true },
  { id: 'finance', titleAr: 'المصاريف والإيرادات', titleEn: 'Expenses and Revenue', group: 'finance', path: '/finance', permission: routePermission('finance'), sidebar: true },
  { id: 'wallet', titleAr: 'المحفظة والعهد', titleEn: 'Wallet and Custody', group: 'finance', path: '/wallet', permission: routePermission('finance'), sidebar: false },

  /** المركبات والحركة والصيانة */
  { id: 'motorcycles', titleAr: 'المركبات', titleEn: 'Vehicles', group: 'fleet', path: '/motorcycles', permission: routePermission('vehicles'), sidebar: true },
  { id: 'vehicle_assignment', titleAr: 'توزيع المركبات', titleEn: 'Vehicle Assignment', group: 'fleet', path: '/vehicle-assignment', permission: routePermission('vehicle_assignment'), sidebar: true },
  { id: 'maintenance', titleAr: 'الصيانة والمخزون', titleEn: 'Maintenance and Inventory', group: 'fleet', path: '/maintenance', permission: routePermission('maintenance'), sidebar: true },

  { id: 'settings', titleAr: 'إعدادات النظام', titleEn: 'System Settings', group: 'system', path: '/settings', permission: routePermission('settings'), sidebar: true },
  { id: 'profile', titleAr: 'الملف الشخصي', titleEn: 'Profile', group: 'system', path: '/profile', sidebar: false },
];

export const routeGroupTitleAr: Record<RouteGroup, string> = {
  dashboard: 'لوحة التحكم',
  hr: 'الموارد البشرية',
  finance: 'المالية',
  operations: 'العمليات',
  fleet: 'إدارة الحركة',
  system: 'النظام',
};

export const routeGroupTitleEn: Record<RouteGroup, string> = {
  dashboard: 'Dashboard',
  hr: 'Human Resources',
  finance: 'Finance',
  operations: 'Operations',
  fleet: 'Fleet Management',
  system: 'System',
};

export const getRouteTitle = (route: AppRouteManifestItem, language: 'ar' | 'en') =>
  language === 'ar' ? route.titleAr : route.titleEn;

export const getRouteByPathname = (pathname: string) => {
  const exact = routesManifest.find((route) => route.path === pathname);
  if (exact) return exact;

  const byPrefix = routesManifest
    .filter((route) => route.path !== '/' && pathname.startsWith(route.path))
    .sort((a, b) => b.path.length - a.path.length)[0];
  return byPrefix ?? null;
};

