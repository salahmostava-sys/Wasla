import { ReactNode, useEffect, useRef, useState, type CSSProperties } from 'react';
import AppSidebar from './AppSidebar';
import ErrorBoundary from './ErrorBoundary';
import { useLanguage } from '@app/providers/LanguageContext';
import { useAuth } from '@app/providers/AuthContext';
import { useSystemSettings } from '@app/providers/SystemSettingsContext';
import { useMobileSidebar, MobileSidebarProvider } from '@app/providers/MobileSidebarContext';
import { useTranslation } from 'react-i18next';
import { Link, useLocation } from 'react-router-dom';
import { getRouteByPathname } from '@app/routesManifest';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@shared/components/ui/dropdown-menu';
import { Menu, ChevronLeft, ChevronRight, LogOut, Settings, User, ChevronDown, Sparkles } from 'lucide-react';
import { ThemeToggle } from '@shared/components/ThemeToggle';
import { LanguageToggle } from '@shared/components/LanguageToggle';
import NotificationCenter from '@shared/components/NotificationCenter';
import GlobalSearch from '@shared/components/GlobalSearch';
import { cn } from '@shared/lib/utils';
import { brandLogoSrc } from '@shared/lib/brandLogo';
import { logError } from '@shared/lib/logger';
import { profileService } from '@services/profileService';
import GlobalMonthPicker from '@shared/components/Temporal/GlobalMonthPicker';
import { GlobalPresenceAvatars } from '@shared/components/GlobalPresenceAvatars';

interface AppLayoutProps {
  children: ReactNode;
}

const roleLabelsMap: Record<string, string> = {
  admin: 'مدير النظام', hr: 'موارد بشرية', finance: 'مالية',
  operations: 'عمليات', viewer: 'عارض',
};
/** ألوان هادئة للدور في الهيدر (بدون أحمر يشبه الخطأ) */
const roleBadgeClass: Record<string, string> = {
  admin: 'text-primary bg-primary/12',
  hr: 'text-blue-700 dark:text-blue-300 bg-blue-500/12',
  finance: 'text-emerald-700 dark:text-emerald-300 bg-emerald-500/12',
  operations: 'text-orange-700 dark:text-orange-300 bg-orange-500/12',
  viewer: 'text-muted-foreground bg-muted',
};

const SIDEBAR_WIDTH_CLASS = 'lg:mr-[var(--app-sidebar-width)]';
const SIDEBAR_WIDTH_CLASS_LTR = 'lg:ml-[var(--app-sidebar-width)]';
const SIDEBAR_WIDTH_EXPANDED = '260px';
const SIDEBAR_WIDTH_COLLAPSED = '64px';

const AppLayoutInner = ({ children }: Readonly<AppLayoutProps>) => { // NOSONAR: layout wiring for route/theme/sidebar states
  const { isRTL } = useLanguage();
  const { signOut, role, user } = useAuth();

  const { projectName, projectSubtitle, settings } = useSystemSettings();
  const { toggle } = useMobileSidebar();
  const { t } = useTranslation();
  const location = useLocation();
  const [profileName, setProfileName] = useState<string | null>(null);
  const [profileAvatarUrl, setProfileAvatarUrl] = useState<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(
    () => localStorage.getItem('sidebar_collapsed') === 'true'
  );
  const [pageKey, setPageKey] = useState(0);
  const prevPathRef = useRef(location.pathname);

  useEffect(() => {
    const onStorage = () => setSidebarCollapsed(localStorage.getItem('sidebar_collapsed') === 'true');
    globalThis.addEventListener('storage', onStorage);
    return () => { globalThis.removeEventListener('storage', onStorage); };
  }, []);

  useEffect(() => {
    if (prevPathRef.current !== location.pathname) {
      prevPathRef.current = location.pathname;
      setPageKey(k => k + 1);
    }
  }, [location.pathname]);

  const manifestRoute = getRouteByPathname(location.pathname);
  const pageTitle = manifestRoute?.titleAr ?? t('dashboard');
  const isDashboardRoute = location.pathname === '/';

  useEffect(() => {
    document.title = `${projectName} | ${pageTitle}`;
  }, [location.pathname, projectName, pageTitle]);

  useEffect(() => {
    if (!user?.id) return;
    profileService.getProfile(user.id)
      .then((row) => {
        if (row?.name) setProfileName(row.name);
        if (row?.avatar_url) setProfileAvatarUrl(row.avatar_url);
      })
      .catch((e: unknown) => {
        logError('[AppLayout] getProfile failed', e);
      });
  }, [user?.id]);

  const Sep = isRTL ? ChevronLeft : ChevronRight;
  const displayEmail = user?.email ?? '';
  const displayName = profileName || displayEmail.split('@')[0];
  const initials = displayName.charAt(0).toUpperCase();
  const roleLabel = role ? roleLabelsMap[role] || role : '';
  const roleBadgeCls = role ? roleBadgeClass[role] || 'text-muted-foreground bg-muted' : '';

  const sidebarOffsetCls = isRTL ? SIDEBAR_WIDTH_CLASS : SIDEBAR_WIDTH_CLASS_LTR;
  const sidebarWidth = sidebarCollapsed ? SIDEBAR_WIDTH_COLLAPSED : SIDEBAR_WIDTH_EXPANDED;

  return (
    <div
      className="min-h-screen"
      dir={isRTL ? 'rtl' : 'ltr'}
      style={{ background: 'var(--ds-surface)', '--app-sidebar-width': sidebarWidth } as CSSProperties}
    >
      <ErrorBoundary>
        <AppSidebar />
      </ErrorBoundary>

      <main className={cn(
        'flex flex-col transition-all duration-300',
        'h-screen overflow-hidden',
        sidebarOffsetCls
      )}>

        {/* ── Glass Header ─────────────────────────────────── */}
        <header
          className="min-h-[60px] lg:min-h-[62px] flex flex-wrap sm:flex-nowrap items-center gap-2 sm:gap-3 px-3 sm:px-4 lg:px-5 py-2 sticky top-0 z-40"
          style={{
            background: 'var(--header-glass-bg)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            borderBottom: '1px solid var(--ds-outline-variant)',
          }}
        >

          {/* Mobile brand + sidebar toggle (avoid desktop logo duplication with sidebar) */}
          <div className="lg:hidden flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={toggle}
              className="h-9 w-9 flex items-center justify-center border border-border/60 bg-card/80 flex-shrink-0 rounded-xl"
              style={{ color: 'var(--ds-on-surface-variant)' }}
              aria-label="Toggle sidebar"
            >
              <Menu size={18} />
            </button>

            <Link
              to="/"
              className="flex items-center gap-2.5 min-w-0 rounded-xl py-1 ps-1 -ms-1 hover:opacity-90 transition-opacity"
              title={projectSubtitle || projectName}
            >
              <MobileLogo logoSrc={brandLogoSrc(settings?.logo_url, settings?.updated_at)} />
              <div className="hidden sm:flex flex-col min-w-0 text-start leading-tight">
                <span className="font-bold text-foreground text-sm sm:text-base truncate max-w-[9rem] sm:max-w-[14rem]">
                  {projectName}
                </span>
                {projectSubtitle ? (
                  <span className="text-[10px] sm:text-[11px] text-muted-foreground/90 truncate max-w-[9rem] sm:max-w-[14rem]">
                    {projectSubtitle}
                  </span>
                ) : null}
              </div>
            </Link>
          </div>

          {/* مسار الصفحة + بحث */}
          <div className="order-last sm:order-none w-full sm:w-auto flex-1 flex items-center justify-center gap-2 lg:gap-3 min-w-0 basis-full sm:basis-auto px-0 sm:px-2">
            <div
              className="hidden lg:flex h-9 items-center gap-1.5 text-[11px] min-w-0 max-w-[220px] lg:max-w-[260px] px-3 rounded-xl bg-muted border border-border/50 shrink-0"
              style={{ color: 'var(--ds-on-surface-variant)' }}
              aria-label="مسار الصفحة الحالية"
            >
              {isDashboardRoute ? null : (
                <>
                  <Link
                    to="/"
                    className="truncate opacity-80 hover:opacity-100 hover:text-foreground transition-colors shrink-0"
                  >
                    {t('dashboard')}
                  </Link>
                  <Sep size={11} className="opacity-40 flex-shrink-0" aria-hidden />
                </>
              )}
              <span className="font-semibold truncate" style={{ color: 'var(--ds-on-surface)' }}>
                {pageTitle}
              </span>
            </div>
            <div className="w-full max-w-xl lg:max-w-2xl mx-auto flex-1">
              <GlobalSearch />
            </div>
          </div>

          {/* إشعارات + المتواجدون + ثيم + مستخدم */}
          <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 shrink-0 ms-auto sm:ms-0">
            <div className="hidden sm:flex items-center me-2">
              <GlobalPresenceAvatars />
            </div>
            
            <div className="hidden sm:block">
              <GlobalMonthPicker />
            </div>
            <NotificationCenter />

            <ThemeToggle />
            <LanguageToggle />

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                className={cn(
                    'flex items-center gap-2 h-9 ps-1 pe-2 rounded-xl transition-colors border shadow-sm',
                    'border-border/70 bg-card/95 hover:bg-muted/70',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'
                  )}
                >
                  {profileAvatarUrl ? (
                    <img
                      src={profileAvatarUrl}
                      alt={displayName}
                      title={displayName}
                      className="w-7 h-7 rounded-full object-cover flex-shrink-0 ring-2 ring-background"
                    />
                  ) : (
                    <div
                      className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 ring-2 ring-background"
                      style={{ background: 'linear-gradient(135deg, #2642e6, #465fff)' }}
                      title={displayName}
                    >
                      {initials || 'A'}
                    </div>
                  )}
                  <div
                    className={cn(
                      'hidden sm:flex flex-col leading-tight min-w-0 max-w-[120px] lg:max-w-[160px]',
                      isRTL ? 'items-end text-end' : 'items-start text-start'
                    )}
                  >
                    <span className="text-xs font-semibold truncate" style={{ color: 'var(--ds-on-surface)' }}>
                      {displayName || t('systemAdmin')}
                    </span>
                    {roleLabel && (
                      <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded-md mt-0.5 inline-block max-w-full truncate', roleBadgeCls)}>
                        {roleLabel}
                      </span>
                    )}
                  </div>
                  <ChevronDown size={14} className="hidden sm:block flex-shrink-0 opacity-60" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56" sideOffset={6}>
                <div className="px-3 py-2.5" style={{ borderBottom: '1px solid var(--ds-surface-container)' }}>
                  <div className="flex items-center gap-2.5">
                    {profileAvatarUrl ? (
                      <img src={profileAvatarUrl} alt={displayName} className="w-10 h-10 rounded-full object-cover flex-shrink-0 ring-2 ring-border" />
                    ) : (
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
                        style={{ background: 'linear-gradient(135deg, #2642e6, #465fff)' }}
                      >
                        {initials || 'A'}
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate" style={{ color: 'var(--ds-on-surface)' }}>
                        {displayName}
                      </p>
                      <p className="text-[11px] truncate" style={{ color: 'var(--ds-on-surface-variant)' }}>
                        {displayEmail}
                      </p>
                      {roleLabel && (
                        <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded-md inline-block', roleBadgeCls)}>{roleLabel}</span>
                      )}
                    </div>
                  </div>
                </div>
                <DropdownMenuItem asChild>
                  <Link to="/profile" className="flex items-center gap-2 cursor-pointer">
                    <User size={14} />
                    <span>الملف الشخصي</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/settings" className="flex items-center gap-2 cursor-pointer">
                    <Settings size={14} />
                    <span>إعدادات النظام</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="gap-2 cursor-pointer text-destructive focus:text-destructive" onClick={signOut}>
                  <LogOut size={14} />
                  <span>{t('logout')}</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* ── Page content ─────────────────────────────────── */}
        <div
          key={pageKey}
          className="app-content-shell flex-1 overflow-auto min-h-0 flex flex-col page-enter"
          style={{ background: 'var(--ds-surface)' }}
        >
          {children}
        </div>
      </main>
    </div>
  );
};

const AppLayout = ({ children }: Readonly<AppLayoutProps>) => (
  <MobileSidebarProvider>
    <AppLayoutInner>{children}</AppLayoutInner>
  </MobileSidebarProvider>
);

function MobileLogo({ logoSrc }: Readonly<{ logoSrc?: string }>) {
  const [failed, setFailed] = useState(false);
  if (logoSrc && !failed) {
    return (
      <img
        src={logoSrc}
        alt=""
        className="h-10 w-10 sm:h-11 sm:w-11 object-cover border-2 border-border/80 bg-card shadow-sm shrink-0 rounded-2xl"
        onError={() => setFailed(true)}
      />
    );
  }
  return (
    <div className="h-10 w-10 sm:h-11 sm:w-11 rounded-full flex items-center justify-center shrink-0 border-2 border-border/80 shadow-sm bg-gradient-to-br from-primary to-primary/80 text-primary-foreground">
      <Sparkles size={20} aria-hidden />
    </div>
  );
}

export default AppLayout;
