import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Users, Clock, Package, Wallet, CreditCard,
  Bike, FileDown, Bell, Smartphone,
  Fuel, Settings2, X, FileWarning,
  Layers, ChevronsLeft, ChevronsRight, ShieldCheck, Sparkles, Wrench,
  ChevronDown, CalendarDays, FileText, Star,
  Activity, Car
} from 'lucide-react';
import { memo, useCallback, useEffect, useMemo, useState, type ComponentType } from 'react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@shared/components/ui/collapsible';
import { useLanguage } from '@app/providers/LanguageContext';
import { useSystemSettings } from '@app/providers/SystemSettingsContext';
import { useMobileSidebar } from '@app/providers/MobileSidebarContext';
import { cn } from '@shared/lib/utils';
import { brandLogoSrc } from '@shared/lib/brandLogo';
import { routesManifest, routeGroupTitleAr, toPagePermissionKey, type RouteGroup } from '@app/routesManifest';

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
  navGroups.forEach((g) => {
    next[g.key] ??= stored?.[g.key] ?? true;
  });
  return next;
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
import { useAuth } from '@app/providers/AuthContext';
import { DEFAULT_PERMISSIONS, type AppRole } from '@shared/hooks/usePermissions';

const iconByRouteId: Record<string, ComponentType<{ size?: string | number; className?: string }>> = {
  dashboard: LayoutDashboard,
  employees: Users,
  attendance: Clock,
  alerts: Bell,
  apps: Smartphone,
  salaries: Wallet,
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
  leaves: CalendarDays,
  documents: FileText,
  performance_reviews: Star,
};

const groupIcons: Record<RouteGroup, ComponentType<{ size?: string | number; className?: string }>> = {
  dashboard: LayoutDashboard,
  hr: Users,
  finance: Wallet,
  operations: Activity,
  fleet: Car,
  system: Settings2,
};

function setHoverStylesIf(
  el: HTMLElement,
  shouldApply: boolean,
  enter: boolean
) {
  if (!shouldApply) return;
  el.style.background = enter ? 'var(--ds-surface-container)' : 'transparent';
  el.style.color = enter ? 'var(--ds-on-surface)' : 'var(--ds-on-surface-variant)';
}

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
        'relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-150 overflow-hidden',
        collapsed && 'justify-center px-0',
      )}
      style={
        active
          ? {
              background: 'linear-gradient(135deg, #2642e6 0%, #465fff 100%)',
              color: '#ffffff',
              fontWeight: 600,
              boxShadow: '0 4px 14px rgba(38,66,230,0.25)',
            }
          : { color: 'var(--ds-on-surface-variant)', fontWeight: 400 }
      }
      onMouseEnter={(e) => {
        setHoverStylesIf(e.currentTarget, !active, true);
      }}
      onMouseLeave={(e) => {
        setHoverStylesIf(e.currentTarget, !active, false);
      }}
      onClick={onNavigate}
    >
      {active && !collapsed && (
        <span
          className="absolute top-1/2 -translate-y-1/2 w-1 h-5 rounded-full bg-white/60"
          style={{ [isRTL ? 'right' : 'left']: '-2px' }}
        />
      )}
      <Icon size={16} className="flex-shrink-0" />
      {!collapsed && <span>{item.label}</span>}
    </Link>
  );
});

const AppSidebar = () => {
  const location = useLocation();
  const { isRTL } = useLanguage();
  const { role } = useAuth();
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
    if (role === 'admin') return true;
    if (!role) return false;
    const defaults = DEFAULT_PERMISSIONS[role as AppRole] ?? DEFAULT_PERMISSIONS.viewer;
    return defaults[pageKey]?.can_view ?? false;
  }, [role]);

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
          label: route.titleAr,
          icon: iconByRouteId[route.id] ?? LayoutDashboard,
          path: route.path,
        }));
      return {
        key: groupKey,
        sectionLabel: routeGroupTitleAr[groupKey],
        groupIcon: groupIcons[groupKey],
        items,
      };
    }).filter((group) => group.items.length > 0);
  }, [canViewRoute]);

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
          background: 'var(--ds-surface-low)',
          boxShadow: '4px 0 24px rgba(26,28,29,0.06)',
        }}
      >

        {/* ── Logo / Brand ───────────────────────────────────── */}
        <div className={cn(
          'h-[70px] flex items-center justify-between flex-shrink-0',
          collapsed ? 'px-3 justify-center' : 'px-5',
        )}>
          <Link to="/" className="flex items-center gap-3 min-w-0">
            <SidebarLogo logoSrc={brandLogoSrc(settings?.logo_url, settings?.updated_at)} />
            {!collapsed && (
              <div className="min-w-0">
                <span
                  className="text-sm font-bold leading-tight block truncate"
                  style={{ color: 'var(--ds-on-surface)' }}
                >
                  {projectName}
                </span>
                {projectSubtitle && (
                  <span
                    className="text-[11px] block truncate leading-tight mt-0.5"
                    style={{ color: 'var(--ds-on-surface-variant)' }}
                  >
                    {projectSubtitle}
                  </span>
                )}
              </div>
            )}
          </Link>

          {/* Mobile close */}
          {!collapsed && (
            <button
              onClick={close}
              className="lg:hidden w-7 h-7 rounded-lg flex items-center justify-center transition-colors flex-shrink-0"
              style={{ color: 'var(--ds-on-surface-variant)' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--ds-surface-container)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <X size={15} />
            </button>
          )}
        </div>

        {/* ── Nav ──────────────────────────────────────────── */}
        <nav className={cn('flex-1 overflow-y-auto py-3 space-y-0.5', collapsed ? 'px-2' : 'px-3')}>

          {navGroups.map((group, groupIdx) => {
            if (collapsed) {
              return (
                <div key={group.key} className={cn('space-y-0.5', groupIdx > 0 && 'mt-3')}>
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
                className={cn(groupIdx > 0 && 'mt-3')}
              >
                <CollapsibleTrigger
                  type="button"
                  className={cn(
                    'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-start transition-colors',
                    'hover:bg-[var(--ds-surface-container)]',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                    isOpen ? 'text-[var(--ds-primary)]' : 'text-[var(--ds-on-surface-variant)]'
                  )}
                >
                  {group.groupIcon && <group.groupIcon size={16} className={cn("flex-shrink-0", isOpen ? "text-[var(--ds-primary)]" : "opacity-70")} />}
                  <span className="min-w-0 flex-1 text-[13px] font-bold uppercase tracking-wider">
                    {group.sectionLabel}
                  </span>
                  <ChevronDown
                    size={16}
                    className={cn(
                      'flex-shrink-0 opacity-70 transition-transform duration-200',
                      isOpen && '-rotate-180',
                    )}
                    aria-hidden
                  />
                </CollapsibleTrigger>
                <CollapsibleContent className="overflow-hidden space-y-0.5">
                  <div className={cn(
                    "mt-1 space-y-0.5 relative before:absolute before:inset-y-1 before:w-[2px] before:bg-border/60 before:rounded-full",
                    isRTL ? "pe-4 before:right-2" : "ps-4 before:left-2"
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
          className="hidden lg:flex px-3 py-3 flex-shrink-0 justify-end"
          style={{ borderTop: '1px solid var(--ds-surface-container)' }}
        >
          <button
            onClick={toggleCollapse}
            title={collapsed ? 'توسيع القائمة' : 'تصغير القائمة'}
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
            style={{ color: 'var(--ds-on-surface-variant)' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--ds-surface-container)')}
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
        className="w-9 h-9 rounded-xl object-cover flex-shrink-0"
        onError={() => setFailed(true)}
      />
    );
  }
  return (
    <div
      className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-base font-bold flex-shrink-0 shadow-brand-sm"
      style={{ background: 'linear-gradient(135deg, #2642e6, #465fff)' }}
    >
      🚀
    </div>
  );
}

export default AppSidebar;
