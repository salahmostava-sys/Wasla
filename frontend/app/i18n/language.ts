export const APP_LANGUAGE_STORAGE_KEY = 'app-lang';

export type AppLanguage = 'ar' | 'en';

function isStorageError(error: unknown): error is DOMException {
  return error instanceof DOMException;
}

export function isAppLanguage(value: unknown): value is AppLanguage {
  return value === 'ar' || value === 'en';
}

export function getStoredLanguage(): AppLanguage | null {
  try {
    const stored = globalThis.localStorage?.getItem(APP_LANGUAGE_STORAGE_KEY);
    return isAppLanguage(stored) ? stored : null;
  } catch (error) {
    if (!isStorageError(error)) throw error;
    return null;
  }
}

export function getInitialLanguage(): AppLanguage {
  return getStoredLanguage() ?? 'ar';
}

export function persistLanguage(language: AppLanguage): void {
  try {
    globalThis.localStorage?.setItem(APP_LANGUAGE_STORAGE_KEY, language);
  } catch (error) {
    if (!isStorageError(error)) throw error;
    // The app still switches language when browser storage is unavailable.
  }
}

export function localizedText(language: AppLanguage, arabic: string, english: string): string {
  return language === 'ar' ? arabic : english;
}
