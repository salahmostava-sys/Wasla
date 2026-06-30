import { createContext, useContext, useState, type ReactNode, useEffect, useMemo } from 'react';
import { format } from 'date-fns';

interface TemporalContextType {
  selectedMonth: string; // YYYY-MM
  setSelectedMonth: (month: string) => void;
}

const TemporalContext = createContext<TemporalContextType | undefined>(undefined);

/** Validates a YYYY-MM string. Returns true only for well-formed month strings. */
const isValidMonthString = (value: unknown): value is string => {
  if (typeof value !== 'string') return false;
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
};

/** Returns current month as YYYY-MM fallback. */
const currentMonth = (): string => format(new Date(), 'yyyy-MM');

export const TemporalProvider = ({ children }: { children: ReactNode }) => {
  // Always start with current month on fresh page load.
  // Use sessionStorage to persist selection within the same browser session
  // (navigating between pages keeps the month), but resets when opening new tab/window.
  const [selectedMonth, setSelectedMonth] = useState(() => {
    try {
      const saved = sessionStorage.getItem('global_selected_month');
      // Validate before trusting the stored value — corrupt/stale data falls back to current month
      return isValidMonthString(saved) ? saved : currentMonth();
    } catch {
      // sessionStorage may be unavailable in some sandboxed contexts
      return currentMonth();
    }
  });

  const changeSelectedMonth = (month: string) => {
    // Guard against invalid month strings before storing or updating state
    if (!isValidMonthString(month)) return;
    setSelectedMonth(month);
    try {
      sessionStorage.setItem('global_selected_month', month);
    } catch {
      // best-effort — sessionStorage may be unavailable
    }
  };

  useEffect(() => {
    // Clean up old localStorage value (migration from previous behavior)
    localStorage.removeItem('global_selected_month');
  }, []);

  const contextValue = useMemo<TemporalContextType>(
    () => ({ selectedMonth, setSelectedMonth: changeSelectedMonth }),
    [selectedMonth]
  );

  return (
    <TemporalContext.Provider value={contextValue}>
      {children}
    </TemporalContext.Provider>
  );
};

export const useTemporalContext = () => {
  const context = useContext(TemporalContext);
  if (context === undefined) {
    throw new Error('useTemporalContext must be used within a TemporalProvider');
  }
  return context;
};
