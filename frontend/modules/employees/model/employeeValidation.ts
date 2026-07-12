import type { EmployeeArabicRow } from '@shared/lib/employeeArabicTemplateImport';
import {
  isValidEmployeeNationalId,
  isValidEmployeePhone,
} from '@modules/employees/model/employeeFieldValidation';

const isValidImportPhone = (value: string) => isValidEmployeePhone(value);

export const validateImportRow = (row: EmployeeArabicRow, rowIndex: number) => {
  const issues: Array<{ rowIndex: number; issue: string }> = [];
  const name = String(row.name ?? '').trim();
  const phone = String(row.phone ?? '').trim();
  const nationalId = String(row.national_id ?? '').trim();

  if (!name) issues.push({ rowIndex, issue: 'الاسم مفقود' });
  if (!phone) issues.push({ rowIndex, issue: 'رقم الهاتف مفقود' });
  else if (!isValidImportPhone(phone)) issues.push({ rowIndex, issue: 'رقم الهاتف غير صالح' });
  if (!nationalId) issues.push({ rowIndex, issue: 'رقم الهوية مفقود' });
  else if (!isValidEmployeeNationalId(nationalId)) issues.push({ rowIndex, issue: 'رقم الهوية غير صالح' });

  return issues;
};
