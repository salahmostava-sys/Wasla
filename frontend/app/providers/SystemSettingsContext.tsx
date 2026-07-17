// @refresh reset
import { createContext, useContext, useEffect, ReactNode, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@app/providers/AuthContext';
import { logError } from '@shared/lib/logger';
import { settingsHubService } from '@services/settingsHubService';
import { useLanguage } from '@app/providers/LanguageContext';
import { getStoredLanguage, isAppLanguage, localizedText } from '@app/i18n/language';

interface SystemSettings {
  id: string;
  project_name_ar: string;
  project_name_en: string;
  project_subtitle_ar: string;
  project_subtitle_en: string;
  logo_url: string | null;
  default_language: string;
  theme: string;
  iqama_alert_days?: number;
  /** لتحديث صورة الشعار في الواجهة دون كاش قديم */
  updated_at?: string | null;
}

interface SystemSettingsContextType {
  settings: SystemSettings | null;
  projectName: string;
  projectSubtitle: string;
  loading: boolean;
  refresh: () => Promise<void>;
}

const defaults: SystemSettings = {
  id: '',
  project_name_ar: 'مهمة التوصيل',
  project_name_en: 'Muhimmat alTawseel',
  project_subtitle_ar: 'إدارة المناديب',
  project_subtitle_en: 'Rider Management',
  logo_url: null,
  default_language: 'ar',
  theme: 'light',
  iqama_alert_days: 90,
};

const SystemSettingsContext = createContext<SystemSettingsContextType>({
  settings: defaults,
  projectName: defaults.project_name_ar,
  projectSubtitle: defaults.project_subtitle_ar,
  loading: true,
  refresh: async () => {},
});

export const SystemSettingsProvider = ({ children }: { children: ReactNode }) => {
  const { user, session, authLoading } = useAuth();
  const { lang, setLang } = useLanguage();
  const enabled = !!session && !!user && !authLoading;
  const query = useQuery({
    queryKey: ['system-settings', user?.id ?? '__guest__'] as const,
    enabled,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      try {
        const data = await settingsHubService.getSystemSettings();
        return (data as SystemSettings | null) ?? defaults;
      } catch (error) {
        logError('[SystemSettingsContext] fetch settings failed', error);
        return defaults;
      }
    },
  });

  const s = query.data ?? defaults;
  const loading = enabled ? query.isLoading : authLoading;
  const projectName = localizedText(lang, s.project_name_ar, s.project_name_en || s.project_name_ar);
  const projectSubtitle = localizedText(
    lang,
    s.project_subtitle_ar,
    s.project_subtitle_en || s.project_subtitle_ar,
  );

  useEffect(() => {
    if (!query.data || getStoredLanguage()) return;
    if (isAppLanguage(query.data.default_language)) {
      setLang(query.data.default_language);
    }
  }, [query.data, setLang]);
  const contextValue = useMemo<SystemSettingsContextType>(
    () => ({
      settings: s,
      projectName,
      projectSubtitle,
      loading,
      refresh: async () => {
        await query.refetch();
      },
    }),
    [s, projectName, projectSubtitle, loading, query]
  );

  // Sync browser title
  useEffect(() => {
    document.title = projectName;
  }, [projectName]);

  return (
    <SystemSettingsContext.Provider value={contextValue}>
      {children}
    </SystemSettingsContext.Provider>
  );
};

export const useSystemSettings = () => useContext(SystemSettingsContext);
