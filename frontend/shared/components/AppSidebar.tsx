import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  LayoutDashboard, Users, Clock, Package, Wallet, CreditCard,
  Bike, FileDown, Bell, Smartphone,
  Fuel, Settings2, X, FileWarning,
  Layers, ChevronsLeft, ChevronsRight, ShieldCheck, Sparkles, Wrench,
  ChevronDown, Activity, Car
} from 'lucide-react';
import { memo, useCallback, useEffect, useMemo, useState, type ComponentType } from 'react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@shared/components/ui/collapsible';
import { useLanguage } from '@app/providers/LanguageContext';
import { useSystemSettings } from '@app/providers/SystemSettingsContext';
import { useMobileSidebar } from '@app/providers/MobileSidebarContext';
import { cn } from '@shared/lib/utils';
import { brandLogoSrc } from '@shared/lib/brandLogo';
import {
  getRouteTitle,
  routeGroupTitleAr,
  routeGroupTitleEn,
  routesManifest,
  toPagePermissionKey,
  type RouteGroup,
} from '@app/routesManifest';

const SIDEBAR_SECTIONS_STORAGE_KEY = 'sidebar_nav_sections_open_v1';

function loadSectionOpenState(): Record<string, boolean> | null {
  try {
    const raw = localStorage.getItem(SIDEBAR_SECTIONS_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, boolean>;
    }
  } catch {
    /* ignore */
  }
  return null;
}

function persistSectionOpenState(next: Record<string, boolean>) {
  try {
    localStorage.setItem(SIDEBAR_SECTIONS_STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}

type NavGroupForSections = { key: string; items: readonly { path: string }[] };

function mergeNewGroupsSectionDefaults(
  prev: Record<string, boolean>,
  navGroups: readonly NavGroupForSections[],
  stored: Record<string, boolean> | null,
): Record<string, boolean> {
  const next = { ...prev };
  let changed = false;
  navGroups.forEach((g) => {
    if (next[g.key] === undefined) {
      next[g.key] = stored?.[g.key] ?? true;
      changed = true;
    }
  });
  return changed ? next : prev;
}

function ensureSectionOpenForActiveRoute(
  prev: Record<string, boolean>,
  navGroups: readonly NavGroupForSections[],
  isActive: (path: string) => boolean,
): Record<string, boolean> {
  const next = { ...prev };
  let changed = false;
  let activeGroupKey: string | null = null;

  // Find which group contains the active route
  navGroups.forEach((g) => {
    const hasActive = g.items.some((i) => isActive(i.path));
    if (hasActive) {
      activeGroupKey = g.key;
    }
  });

  // Open the active group and close others
  navGroups.forEach((g) => {
    const shouldBeOpen = g.key === activeGroupKey;
    if (next[g.key] !== shouldBeOpen) {
      next[g.key] = shouldBeOpen;
      changed = true;
    }
  });

  if (changed) persistSectionOpenState(next);
  return changed ? next : prev;
}
import { usePermissionMap } from '@shared/hooks/usePermissions';

const iconByRouteId: Record<string, ComponentType<{ size?: string | number; className?: string }>> = {
  dashboard: LayoutDashboard,
  employees: Users,
  attendance: Clock,
  alerts: Bell,
  apps: Smartphone,
  salaries: Wallet,
  wallet: Wallet,
  advances: CreditCard,
  orders: Package,
  ai_analytics: Sparkles,
  motorcycles: Bike,
  vehicle_assignment: FileDown,
  fuel: Fuel,
  maintenance: Wrench,
  violation_resolver: FileWarning,
  employee_tiers: Layers,
  platform_accounts: ShieldCheck,
  settings: Settings2,
  stitch_preview: Sparkles,
};

const groupIcons: Record<RouteGroup, ComponentType<{ size?: string | number; className?: string }>> = {
  dashboard: LayoutDashboard,
  hr: Users,
  finance: Wallet,
  operations: Activity,
  fleet: Car,
  system: Settings2,
};

type SidebarNavItemData = {
  label: string;
  icon: ComponentType<{ size?: string | number; className?: string }>;
  path: string;
};

const SidebarNavLink = memo(function SidebarNavLink({
  item,
  collapsed,
  isRTL,
  active,
  onNavigate,
}: Readonly<{
  item: SidebarNavItemData;
  collapsed: boolean;
  isRTL: boolean;
  active: boolean;
  onNavigate: () => void;
}>) {
  const Icon = item.icon;
  return (
    <Link
      to={item.path}
      title={collapsed ? item.label : undefined}
      className={cn(
        'relative flex h-10 items-center gap-2.5 px-3 rounded-xl text-sm font-medium transition-all duration-150 overflow-hidden',
        collapsed && 'justify-center px-0',
        active
          ? 'bg-sidebar-primary text-sidebar-primary-foreground font-bold'
          : 'text-sidebar-foreground font-semibold hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
      )}
      onClick={onNavigate}
    >
      {active && !collapsed && (
        <span
          className="absolute top-1/2 -translate-y-1/2 w-1 h-5 rounded-full bg-white/80"
          style={{ [isRTL ? 'right' : 'left']: '-2px' }}
        />
      )}
      <Icon size={16} className="flex-shrink-0" />
      {!collapsed && <span className="min-w-0 truncate">{item.label}</span>}
    </Link>
  );
});

const AppSidebar = () => {
  const location = useLocation();
  const { isRTL, lang } = useLanguage();
  const { t } = useTranslation();
  const { permissionsByPage } = usePermissionMap();
  const { projectName, projectSubtitle, settings } = useSystemSettings();
  const { isOpen, close } = useMobileSidebar();
  const [collapsed, setCollapsed] = useState<boolean>(
    () => localStorage.getItem('sidebar_collapsed') === 'true'
  );

  const toggleCollapse = () => {
    setCollapsed(prev => {
      const next = !prev;
      localStorage.setItem('sidebar_collapsed', String(next));
      return next;
    });
  };

  const isActive = useCallback((path: string) => {
    const [pathPart, queryPart] = path.split('?');
    if (pathPart !== location.pathname) return false;
    if (!queryPart) return true;
    const params = new URLSearchParams(queryPart);
    const locationParams = new URLSearchParams(location.search);
    for (const [key, value] of params.entries()) {
      if (locationParams.get(key) !== value) return false;
    }
    return true;
  }, [location.pathname, location.search]);

  const canViewRoute = useCallback((permission?: string) => {
    const pageKey = toPagePermissionKey(permission);
    if (!pageKey) return true;
    return permissionsByPage[pageKey]?.can_view ?? false;
  }, [permissionsByPage]);

  const navGroups = useMemo(() => {
    const groupsOrder: RouteGroup[] = [
      'dashboard',
      'hr',
      'operations',
      'finance',
      'fleet',
      'system',
    ];
    return groupsOrder.map((groupKey) => {
      const items = routesManifest
        .filter((route) => route.group === groupKey && route.sidebar)
        .filter((route) => canViewRoute(route.permission))
        .map((route) => ({
          label: getRouteTitle(route, lang),
          icon: iconByRouteId[route.id] ?? LayoutDashboard,
          path: route.path,
        }));
      return {
        key: groupKey,
        sectionLabel: lang === 'ar' ? routeGroupTitleAr[groupKey] : routeGroupTitleEn[groupKey],
        groupIcon: groupIcons[groupKey],
        items,
      };
    }).filter((group) => group.items.length > 0);
  }, [canViewRoute, lang]);

  const [sectionOpen, setSectionOpen] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setSectionOpen((prev) =>
      mergeNewGroupsSectionDefaults(prev, navGroups, loadSectionOpenState()),
    );
  }, [navGroups]);

  useEffect(() => {
    setSectionOpen((prev) => ensureSectionOpenForActiveRoute(prev, navGroups, isActive));
  }, [navGroups, isActive, location.pathname, location.search]);

  const mobileTranslateClass = (
    {
      rtl: {
        true: 'translate-x-0',
        false: 'translate-x-full',
      },
      ltr: {
        true: 'translate-x-0',
        false: '-translate-x-full',
      },
    } as const
  )[isRTL ? 'rtl' : 'ltr'][isOpen ? 'true' : 'false'] as string;

  const CollapseChevronIcon = (
    {
      true: {
        rtl: ChevronsLeft,
        ltr: ChevronsRight,
      },
      false: {
        rtl: ChevronsRight,
        ltr: ChevronsLeft,
      },
    } as const
  )[collapsed ? 'true' : 'false'][isRTL ? 'rtl' : 'ltr'];

  return (
    <>
      {/* Backdrop — mobile only */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 lg:hidden"
          onClick={close}
          aria-hidden="true"
        />
      )}

      <aside
        className={cn(
          'fixed top-0 h-screen flex flex-col z-50',
          'transition-all duration-300 ease-in-out',
          collapsed ? 'w-[64px]' : 'w-[260px]',
          mobileTranslateClass,
          isRTL ? 'right-0' : 'left-0',
          'lg:translate-x-0',
        )}
        style={{
          background: 'hsl(var(--sidebar-background))',
          boxShadow: 'none',
          borderInlineStart: isRTL ? '6px solid hsl(var(--sidebar-border))' : undefined,
          borderInlineEnd: isRTL ? undefined : '6px solid hsl(var(--sidebar-border))',
        }}
      >

        {/* ── Logo / Brand ───────────────────────────────────── */}
        <div className={cn(
          'h-[62px] flex items-center justify-between flex-shrink-0',
          collapsed ? 'px-3 justify-center' : 'px-5',
        )}>
          <Link to="/" className="flex items-center gap-3 min-w-0">
            <SidebarLogo logoSrc={brandLogoSrc(settings?.logo_url, settings?.updated_at)} />
            {!collapsed && (
              <div className="min-w-0">
                <span
                  className="text-sm font-bold leading-tight block truncate text-sidebar-foreground"
                >
                  {projectName}
                </span>
                {projectSubtitle && (
                  <span
                    className="text-[11px] block truncate leading-tight mt-0.5"
                    style={{ color: 'var(--ds-on-surface)' }}
                  >
                    {projectSubtitle}
                  </span>
                )}
              </div>
            )}
          </Link>

          {/* Mobile close */}
          {!collapsed && (
            <button type="button"
              onClick={close}
              aria-label={t('close')}
              className="lg:hidden w-7 h-7 rounded-lg flex items-center justify-center transition-colors flex-shrink-0"
              style={{ color: 'var(--ds-primary)' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(31,84,173,0.08)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <X size={15} />
            </button>
          )}
        </div>

        {/* ── Nav ──────────────────────────────────────────── */}
        <nav 
          dir={isRTL ? 'rtl' : 'ltr'}
          className={cn('flex-1 overflow-y-auto py-2.5 space-y-0.5 custom-sidebar-scroll', collapsed ? 'px-2' : 'px-3')}
        >

          {navGroups.map((group, groupIdx) => {
            if (collapsed) {
              return (
                <div key={group.key} className={cn('space-y-0.5', groupIdx > 0 && 'mt-2')}>
                  {group.items.map((item) => (
                    <SidebarNavLink
                      key={item.path}
                      item={item}
                      collapsed={collapsed}
                      isRTL={isRTL}
                      active={isActive(item.path)}
                      onNavigate={close}
                    />
                  ))}
                </div>
              );
            }

            const isOpen = sectionOpen[group.key] ?? true;

            // مجموعة تحتوي على عنصر واحد فقط (مثل لوحة التحكم) — تُعرض مباشرةً بدون header قابل للطي
            if (group.items.length === 1) {
              return (
                <div key={group.key} className={cn(groupIdx > 0 && 'mt-1')}>
                  <SidebarNavLink
                    key={group.items[0].path}
                    item={group.items[0]}
                    collapsed={collapsed}
                    isRTL={isRTL}
                    active={isActive(group.items[0].path)}
                    onNavigate={close}
                  />
                </div>
              );
            }

            return (
              <Collapsible
                key={group.key}
                open={isOpen}
                onOpenChange={(open) => {
                  setSectionOpen((s) => {
                    const n = { ...s, [group.key]: open };
                    persistSectionOpenState(n);
                    return n;
                  });
                }}
                className={cn(groupIdx > 0 && 'mt-2.5')}
              >
                <CollapsibleTrigger
                  type="button"
                  className={cn(
                    'flex h-10 w-full items-center gap-2.5 rounded-xl px-3 text-start transition-all duration-150',
                    'hover:bg-[rgba(31,84,173,0.08)]',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                    'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                  )}
                  style={{ fontWeight: 600 }}
                >
                  {group.groupIcon && <group.groupIcon size={16} className="flex-shrink-0 text-[var(--ds-primary)]" />}
                  <span className="min-w-0 flex-1 truncate text-sm">
                    {group.sectionLabel}
                  </span>
                  <ChevronDown
                    size={16}
                    className={cn(
                      'flex-shrink-0 text-[var(--ds-primary)] transition-transform duration-200',
                      isOpen && '-rotate-180',
                    )}
                    aria-hidden
                  />
                </CollapsibleTrigger>
                <CollapsibleContent className="overflow-hidden space-y-0.5">
                  <div className={cn(
                    "mt-1 space-y-0.5",
                    isRTL ? "pe-4" : "ps-4"
                  )}>
                    {group.items.map((item) => (
                      <SidebarNavLink
                        key={item.path}
                        item={item}
                        collapsed={collapsed}
                        isRTL={isRTL}
                        active={isActive(item.path)}
                        onNavigate={close}
                      />
                    ))}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            );
          })}
        </nav>

        {/* ── Collapse toggle — desktop only ────────────────── */}
        <div
          className="hidden lg:flex px-3 py-2.5 flex-shrink-0 justify-end"
          style={{ borderTop: '1px solid hsl(var(--sidebar-border))' }}
        >
          <button type="button"
            onClick={toggleCollapse}
            title={collapsed ? t('expandSidebar') : t('collapseSidebar')}
            aria-label={collapsed ? t('expandSidebar') : t('collapseSidebar')}
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
            style={{ color: 'var(--ds-primary)' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(31,84,173,0.08)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            <CollapseChevronIcon size={16} />
          </button>
        </div>

      </aside>
    </>
  );
};

function SidebarLogo({ logoSrc }: Readonly<{ logoSrc?: string }>) {
  const [failed, setFailed] = useState(false);
  if (logoSrc && !failed) {
    return (
      <img
        src={logoSrc}
        alt="logo"
        className="w-8 h-8 rounded-xl object-cover flex-shrink-0"
        onError={() => setFailed(true)}
      />
    );
  }
  return (
    <div
      className="w-8 h-8 rounded-xl flex items-center justify-center text-white flex-shrink-0"
      style={{ background: 'var(--ds-primary)' }}
    >
      <Sparkles size={18} aria-hidden />
    </div>
  );
}

export default AppSidebar;
