import { beforeEach, describe, expect, it } from 'vitest';
import {
  APP_LANGUAGE_STORAGE_KEY,
  getInitialLanguage,
  getStoredLanguage,
  isAppLanguage,
  localizedText,
  persistLanguage,
} from './language';

describe('application language', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('accepts only supported languages', () => {
    expect(isAppLanguage('ar')).toBe(true);
    expect(isAppLanguage('en')).toBe(true);
    expect(isAppLanguage('fr')).toBe(false);
  });

  it('falls back to Arabic when storage has no valid language', () => {
    localStorage.setItem(APP_LANGUAGE_STORAGE_KEY, 'invalid');
    expect(getStoredLanguage()).toBeNull();
    expect(getInitialLanguage()).toBe('ar');
  });

  it('persists the selected language', () => {
    persistLanguage('en');
    expect(getStoredLanguage()).toBe('en');
  });

  it.each([
    ['en', 'English'],
    ['ar', 'العربية'],
  ] as const)('returns the %s version of localized text', (language, expected) => {
    expect(localizedText(language, 'العربية', 'English')).toBe(expected);
  });
});
