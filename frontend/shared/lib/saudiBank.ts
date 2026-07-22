/**
 * Saudi IBAN helpers for WPS / Mudad wage files.
 *
 * A Saudi IBAN is exactly 24 chars: "SA" + 2 check digits + 2-digit bank code
 * + 18-digit account number. The 2-digit bank code is what WPS/SARIE files key
 * on, and it is derived mechanically from the IBAN (reliable). The bank *name*
 * map below is best-effort for display only — the exported file uses the code.
 */

const IBAN_CLEANUP = /[\s-]/gu;

export function normalizeIban(iban: string | null | undefined): string {
  return (iban ?? '').replace(IBAN_CLEANUP, '').toUpperCase();
}

export function isValidSaudiIban(iban: string | null | undefined): boolean {
  return /^SA\d{22}$/u.test(normalizeIban(iban));
}

/** The 2-digit bank code embedded in a Saudi IBAN, or null if the IBAN is invalid. */
export function deriveSaudiBankCode(iban: string | null | undefined): string | null {
  const clean = normalizeIban(iban);
  if (!isValidSaudiIban(clean)) return null;
  return clean.slice(4, 6);
}

// Best-effort bank-code → name map (display only; verify against the bank's own
// WPS template before relying on names). The wage file itself uses the code.
const SAUDI_BANK_NAMES: Record<string, { ar: string; en: string }> = {
  '10': { ar: 'البنك الأهلي السعودي', en: 'Saudi National Bank' },
  '15': { ar: 'بنك البلاد', en: 'Bank AlBilad' },
  '20': { ar: 'بنك الرياض', en: 'Riyad Bank' },
  '30': { ar: 'البنك العربي الوطني', en: 'Arab National Bank' },
  '45': { ar: 'البنك السعودي الأول', en: 'Saudi Awwal Bank (SAB)' },
  '55': { ar: 'بنك الجزيرة', en: 'Bank AlJazira' },
  '60': { ar: 'بنك الإنماء', en: 'Alinma Bank' },
  '80': { ar: 'مصرف الراجحي', en: 'Al Rajhi Bank' },
};

export function saudiBankName(code: string | null | undefined, lang: 'ar' | 'en' = 'ar'): string | null {
  if (!code) return null;
  return SAUDI_BANK_NAMES[code]?.[lang] ?? null;
}
