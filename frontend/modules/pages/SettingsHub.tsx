import {
  Suspense,
  lazy,
  startTransition,
  useEffect,
  useState,
  type ComponentType,
  type ElementType,
  type LazyExoticComponent,
} from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Building2,
  ChevronLeft,
  ChevronRight,
  History,
  Settings2,
  User,
  Users,
  Wallet,
} from 'lucide-react';

import { useLanguage } from '@app/providers/LanguageContext';
import { cn } from '@shared/lib/utils';

type TabKey = 'general' | 'company' | 'schemes' | 'users' | 'activity' | 'profile';

type Tab = {
  key: TabKey;
  labelAr: string;
  labelEn: string;
  icon: ElementType;
};

type TabModule = {
  default: ComponentType;
};

const TABS: Tab[] = [
  { key: 'general', labelAr: 'إعدادات النظام', labelEn: 'System Settings', icon: Settings2 },
  { key: 'company', labelAr: 'بيانات المنشأة', labelEn: 'Organization Info', icon: Building2 },
  { key: 'schemes', labelAr: 'مخططات الرواتب', labelEn: 'Salary Schemes', icon: Wallet },
  { key: 'users', labelAr: 'المستخدمون والصلاحيات', labelEn: 'Users & Permissions', icon: Users },
  { key: 'activity', labelAr: 'سجل النشاطات', labelEn: 'Activity Log', icon: History },
  { key: 'profile', labelAr: 'الملف الشخصي', labelEn: 'My Profile', icon: User },
];

const TAB_TITLES: Record<TabKey, { ar: string; en: string }> = {
  general: { ar: 'إعدادات النظام', en: 'System Settings' },
  company: { ar: 'بيانات المنشأة', en: 'Organization Info' },
  schemes: { ar: 'مخططات الرواتب', en: 'Salary Schemes' },
  users: { ar: 'المستخدمون والصلاحيات', en: 'Users & Permissions' },
  activity: { ar: 'سجل النشاطات', en: 'Activity Log' },
  profile: { ar: 'الملف الشخصي', en: 'My Profile' },
};

const tabLoaders: Record<TabKey, () => Promise<TabModule>> = {
  general: () => import('./settings-hub/GeneralSettingsContent'),
  company: () => import('./settings-hub/CompanySettingsContent'),
  schemes: () => import('./SalarySchemes'),
  users: () => import('./settings-hub/UsersContent'),
  activity: () => import('./settings-hub/ActivityLogContent'),
  profile: () => import('./settings-hub/ProfileSettingsContent'),
};

const tabComponents: Record<TabKey, LazyExoticComponent<ComponentType>> = {
  general: lazy(tabLoaders.general),
  company: lazy(tabLoaders.company),
  schemes: lazy(tabLoaders.schemes),
  users: lazy(tabLoaders.users),
  activity: lazy(tabLoaders.activity),
  profile: lazy(tabLoaders.profile),
};

const SECTION_SKELETON_KEYS = ['sk-1', 'sk-2', 'sk-3', 'sk-4'] as const;

function SettingsContentFallback() {
  return (
    <div className="space-y-5 animate-pulse">
      <div className="h-7 w-56 rounded-xl bg-muted/40" />
      <div className="h-4 w-80 max-w-full rounded-lg bg-muted/30" />
      <div className="-2xl border border-border/50 bg-card p-5 space-y-4 rounded-2xl">
        <div className="h-4 w-32 rounded bg-muted/40" />
        {SECTION_SKELETON_KEYS.map((key) => (
          <div key={key} className="h-11 rounded-xl bg-muted/40" />
        ))}
      </div>
      <div className="-2xl border border-border/50 bg-card p-5 space-y-4 rounded-2xl">
        <div className="h-4 w-40 rounded bg-muted/40" />
        <div className="h-32 rounded-xl bg-muted/30" />
      </div>
    </div>
  );
}

export default function SettingsHub() {
  const { isRTL } = useLanguage();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const tabParam = searchParams.get('tab') as TabKey | null;
  const validTab = TABS.find((tab) => tab.key === tabParam)?.key ?? 'general';
  const [active, setActive] = useState<TabKey>(validTab);

  useEffect(() => {
    const nextTabParam = searchParams.get('tab') as TabKey | null;
    const nextValidTab = TABS.find((tab) => tab.key === nextTabParam)?.key ?? 'general';
    setActive(nextValidTab);
  }, [searchParams]);

  const prefetchTab = (key: TabKey) => {
    tabLoaders[key]().catch(() => {});
  };

  const switchTab = (key: TabKey) => {
    prefetchTab(key);
    navigate(`/settings?tab=${key}`, { replace: true });
    startTransition(() => {
      setActive(key);
    });
  };

  const title = TAB_TITLES[active];
  const SeparatorIcon = isRTL ? ChevronLeft : ChevronRight;
  const ActiveContent = tabComponents[active];

  return (
    <div className="flex flex-col gap-0 animate-fade-in" dir="rtl">
      <div className="mb-5">
        <div className="flex items-center gap-1 text-xs mb-1" style={{ color: 'var(--ds-on-surface-variant)' }}>
          <span>{isRTL ? 'الإعدادات' : 'Settings'}</span>
          <SeparatorIcon size={12} className="opacity-40" />
          <span className="font-semibold" style={{ color: 'var(--ds-on-surface)' }}>
            {isRTL ? title.ar : title.en}
          </span>
        </div>

        <h1 className="text-2xl font-bold" style={{ color: 'var(--ds-on-surface)' }}>
          {isRTL ? 'إعدادات النظام المتقدمة' : 'Advanced System Settings'}
        </h1>

        <p className="text-sm mt-1" style={{ color: 'var(--ds-on-surface-variant)' }}>
          {isRTL
            ? 'تحكم في هوية مؤسستك، صلاحيات الموظفين، وبوابات الربح من مكان واحد.'
            : 'Control your organization identity, employee permissions, and integrations from one place.'}
        </p>
      </div>

      <div
        className="flex gap-0 rounded-2xl overflow-hidden flex-1"
        style={{ boxShadow: 'var(--shadow-card)', minHeight: '70vh' }}
      >
        <aside
          className={cn(
            'flex-shrink-0 hidden sm:flex w-[180px] md:w-[220px] flex-col py-4 px-3',
            isRTL ? 'border-l' : 'border-r',
          )}
          style={{
            background: 'var(--ds-surface-low)',
            borderColor: 'var(--ds-surface-container)',
          }}
        >
          <p
            className="text-[10px] font-semibold uppercase tracking-widest px-3 mb-3"
            style={{ color: 'var(--ds-on-surface-variant)' }}
          >
            {isRTL ? 'الأقسام' : 'Sections'}
          </p>

          <nav className="space-y-0.5 flex-1">
            {TABS.map((tab) => {
              const isActive = active === tab.key;

              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => switchTab(tab.key)}
                  onFocus={() => prefetchTab(tab.key)}
                  onMouseEnter={() => prefetchTab(tab.key)}
                  onTouchStart={() => prefetchTab(tab.key)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-150 text-start"
                  style={
                    isActive
                      ? {
                          background: 'linear-gradient(135deg, #2642e6, #465fff)',
                          color: '#ffffff',
                          fontWeight: 600,
                          boxShadow: '0 4px 12px rgba(38,66,230,0.20)',
                        }
                      : { color: 'var(--ds-on-surface-variant)', fontWeight: 400 }
                  }
                  onMouseOver={(event) => {
                    if (isActive) return;
                    event.currentTarget.style.background = 'var(--ds-surface-container)';
                    event.currentTarget.style.color = 'var(--ds-on-surface)';
                  }}
                  onMouseLeave={(event) => {
                    if (isActive) return;
                    event.currentTarget.style.background = 'transparent';
                    event.currentTarget.style.color = 'var(--ds-on-surface-variant)';
                  }}
                >
                  <tab.icon size={16} className="flex-shrink-0" />
                  <span className="truncate">{isRTL ? tab.labelAr : tab.labelEn}</span>
                </button>
              );
            })}
          </nav>

          <div className="pt-4 px-3" style={{ borderTop: '1px solid var(--ds-surface-container)' }}>
            <p className="text-[11px] font-semibold mb-1" style={{ color: 'var(--ds-on-surface-variant)' }}>
              {isRTL ? 'المساعدة' : 'Help'}
            </p>
            <button
              type="button"
              className="text-[11px] flex items-center gap-1 hover:underline bg-transparent p-0"
              style={{ color: 'var(--ds-primary)' }}
            >
              {isRTL ? '? وثائق المساعدة' : '? Help Docs'}
            </button>
          </div>
        </aside>

        <main
          className="flex-1 overflow-auto p-6 lg:p-8"
          style={{ background: 'var(--ds-surface-lowest)' }}
        >
          <Suspense fallback={<SettingsContentFallback />}>
            <ActiveContent />
          </Suspense>
        </main>
      </div>
    </div>
  );
}
