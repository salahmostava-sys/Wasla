export const EMPLOYEE_NATIONAL_ID_DIGITS = 10;
const EMPLOYEE_LOCAL_PHONE_DIGITS = 10;
export const EMPLOYEE_INTL_PHONE_DIGITS = 12;

function digitsOnly(value: string | null | undefined): string {
  return String(value ?? '').replaceAll(/\D/g, '');
}

export function clampEmployeePhoneInput(value: string | null | undefined): string {
  const digits = digitsOnly(value);
  if (digits.startsWith('966')) return digits.slice(0, EMPLOYEE_INTL_PHONE_DIGITS);
  if (digits.startsWith('05')) return digits.slice(0, EMPLOYEE_LOCAL_PHONE_DIGITS);
  return digits.slice(0, EMPLOYEE_INTL_PHONE_DIGITS);
}

export function isValidEmployeePhone(value: string | null | undefined): boolean {
  const digits = digitsOnly(value);
  return /^(05\d{8}|9665\d{8})$/.test(digits);
}

export function clampEmployeeNationalIdInput(value: string | null | undefined): string {
  return digitsOnly(value).slice(0, EMPLOYEE_NATIONAL_ID_DIGITS);
}

export function isValidEmployeeNationalId(value: string | null | undefined): boolean {
  const digits = digitsOnly(value);
  return /^[12]\d{9}$/.test(digits);
}
