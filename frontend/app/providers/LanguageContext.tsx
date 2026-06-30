import { createContext, useContext, useEffect, ReactNode, useMemo, useState } from 'react';
import { DirectionProvider } from '@radix-ui/react-direction';
import i18n from '@app/i18n';

type Lang = 'ar' | 'en';

interface LanguageContextType {
  lang: Lang;
  isRTL: boolean;
  setLang: (lang: Lang) => void;
}

const LanguageContext = createContext<LanguageContextType>({} as LanguageContextType);

export const LanguageProvider = ({ children }: { children: ReactNode }) => {
  const [lang, setLang] = useState<Lang>(() => {
    return (localStorage.getItem('app-lang') as Lang) || 'ar';
  });

  const isRTL = lang === 'ar';

  useEffect(() => {
    document.documentElement.dir = isRTL ? 'rtl' : 'ltr';
    document.documentElement.lang = lang;
    document.documentElement.style.fontFamily = isRTL ? "'IBM Plex Sans Arabic', 'Tajawal', sans-serif" : "'Inter', 'Roboto', sans-serif";
    i18n.changeLanguage(lang);
    localStorage.setItem('app-lang', lang);
  }, [lang, isRTL]);

  const value = useMemo<LanguageContextType>(() => ({ lang, isRTL, setLang }), [lang, isRTL]);

  return (
    <DirectionProvider dir={isRTL ? 'rtl' : 'ltr'}>
      <LanguageContext.Provider value={value}>
        {children}
      </LanguageContext.Provider>
    </DirectionProvider>
  );
};

export const useLanguage = () => useContext(LanguageContext);
