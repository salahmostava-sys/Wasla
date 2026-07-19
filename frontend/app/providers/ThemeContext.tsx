import { createContext, useContext, useLayoutEffect, useState, ReactNode, useCallback, useMemo, useRef } from 'react';

type Theme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  isDark: boolean;
  /** true while the 400ms colour transition is running */
  isTransitioning: boolean;
}

const TRANSITION_MS = 400;

const ThemeContext = createContext<ThemeContextType>({} as ThemeContextType);

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const [theme, setTheme] = useState<Theme>(() => {
    try {
      const stored = localStorage.getItem('theme');
      return (stored === 'light' || stored === 'dark') ? stored : 'light';
    } catch {
      return 'light';
    }
  });

  const [isTransitioning, setIsTransitioning] = useState(false);
  const isFirstRender = useRef(true);

  useLayoutEffect(() => {
    const root = document.documentElement;

    // Skip the transition on initial mount so the page loads without a flash
    if (isFirstRender.current) {
      isFirstRender.current = false;
      root.classList.toggle('dark', theme === 'dark');
      root.style.colorScheme = theme;
      try { localStorage.setItem('theme', theme); } catch { /* ignore */ }
      return;
    }

    // Add smooth transition class for the color switch
    root.classList.add('theme-transitioning');
    setIsTransitioning(true);

    root.classList.toggle('dark', theme === 'dark');
    root.style.colorScheme = theme;

    const timer = setTimeout(() => {
      root.classList.remove('theme-transitioning');
      setIsTransitioning(false);
    }, TRANSITION_MS);

    try {
      localStorage.setItem('theme', theme);
    } catch {
      // Ignore localStorage errors
    }

    return () => clearTimeout(timer);
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme(prev => (prev === 'light' ? 'dark' : 'light'));
  }, []);

  const value = useMemo<ThemeContextType>(
    () => ({ theme, toggleTheme, isDark: theme === 'dark', isTransitioning }),
    [theme, toggleTheme, isTransitioning]
  );

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
