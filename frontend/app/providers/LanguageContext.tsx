import { createContext, useCallback, useContext, useEffect, ReactNode, useMemo, useState } from 'react';
import { DirectionProvider } from '@radix-ui/react-direction';
import i18n from '@app/i18n';
import {
  getInitialLanguage,
  persistLanguage,
  type AppLanguage,
} from '@app/i18n/language';

interface LanguageContextType {
  lang: AppLanguage;
  isRTL: boolean;
  setLang: (lang: AppLanguage) => void;
}

const LanguageContext = createContext<LanguageContextType>({} as LanguageContextType);

export const LanguageProvider = ({ children }: { children: ReactNode }) => {
  const [lang, setLanguageState] = useState<AppLanguage>(getInitialLanguage);

  const isRTL = lang === 'ar';
  const setLang = useCallback((nextLanguage: AppLanguage) => {
    setLanguageState(nextLanguage);
    persistLanguage(nextLanguage);
  }, []);

  useEffect(() => {
    document.documentElement.dir = isRTL ? 'rtl' : 'ltr';
    document.documentElement.lang = lang;
    document.documentElement.style.fontFamily = isRTL
      ? "'Tajawal', 'IBM Plex Sans Arabic', sans-serif"
      : "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif";
    void i18n.changeLanguage(lang);
  }, [lang, isRTL]);

  const value = useMemo<LanguageContextType>(() => ({ lang, isRTL, setLang }), [lang, isRTL, setLang]);

  return (
    <DirectionProvider dir={isRTL ? 'rtl' : 'ltr'}>
      <LanguageContext.Provider value={value}>
        {children}
      </LanguageContext.Provider>
    </DirectionProvider>
  );
};

export const useLanguage = () => useContext(LanguageContext);
