export const SAUDI_BANKS: Record<string, string> = {
  '10': 'البنك الأهلي السعودي (SNB)',
  '15': 'مصرف الراجحي',
  '20': 'بنك الرياض',
  '30': 'البنك العربي الوطني',
  '40': 'البنك الأهلي السعودي (سامبا)',
  '45': 'البنك السعودي الأول (ساب)',
  '50': 'البنك السعودي الأول (الأول)',
  '55': 'البنك السعودي الفرنسي',
  '60': 'بنك الجزيرة',
  '65': 'البنك السعودي للاستثمار',
  '71': 'بنك الكويت الوطني',
  '75': 'بنك الخليج الدولي',
  '76': 'جي بي مورجان تشيس',
  '79': 'بنك أبوظبي الأول',
  '80': 'مصرف الإنماء',
  '82': 'بنك قطر الوطني',
  '85': 'بنك ستاندرد تشارترد',
  '90': 'بنك الخليج',
  '95': 'بنك الإمارات دبي الوطني',
  '98': 'بنك D360',
  '99': 'STC Pay',
  '05': 'يور باي (Urpay)',
};

/**
 * Extracts the bank name from a Saudi IBAN.
 * @param iban - The IBAN string to check.
 * @returns The name of the bank in Arabic, or null if invalid or unknown.
 */
export function getSaudiBankName(iban: string | null | undefined): string | null {
  if (!iban) return null;
  // Remove spaces and convert to uppercase for standard processing
  const cleanIban = iban.replace(/\s+/g, '').toUpperCase();
  
  if (!cleanIban.startsWith('SA')) return null;
  if (cleanIban.length < 6) return null;

  // Extract the bank code (characters 5 and 6)
  const bankCode = cleanIban.substring(4, 6);
  return SAUDI_BANKS[bankCode] || null;
}

/**
 * Validates an IBAN using the standard MOD-97 algorithm.
 * @param iban - The IBAN string to check.
 * @returns true if valid, false otherwise.
 */
export function isValidIBAN(iban: string | null | undefined): boolean {
  if (!iban) return false;
  const cleanIban = iban.replace(/\s+/g, '').toUpperCase();
  
  // Saudi IBAN is exactly 24 chars. We can generalize if needed, but for now focus on SA.
  // Actually, standard IBAN validation handles any country if length is correct.
  // Let's just check if it matches basic alphanumeric format.
  if (!/^[A-Z]{2}[0-9]{2}[A-Z0-9]{4,30}$/.test(cleanIban)) return false;
  
  // For SA specifically, it must be 24 chars
  if (cleanIban.startsWith('SA') && cleanIban.length !== 24) return false;

  // Move first 4 characters to the end
  const rearranged = cleanIban.substring(4) + cleanIban.substring(0, 4);
  
  // Convert letters to numbers (A=10, B=11, ... Z=35)
  const numericString = rearranged.replace(/[A-Z]/g, (match) => {
    return (match.charCodeAt(0) - 55).toString();
  });
  
  try {
    return BigInt(numericString) % 97n === 1n;
  } catch (e) {
    return false;
  }
}

/**
 * Formats an IBAN with spaces every 4 characters.
 * @param iban - The raw IBAN string.
 * @returns Formatted IBAN string.
 */
export function formatIBAN(iban: string | null | undefined): string {
  if (!iban) return '';
  const cleanIban = iban.replace(/\s+/g, '').toUpperCase();
  const match = cleanIban.match(/.{1,4}/g);
  return match ? match.join(' ') : cleanIban;
}
