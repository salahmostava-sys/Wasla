 
import { differenceInDays, parseISO } from 'date-fns';
import { employeeService } from '@services/employeeService';
import { auditService } from '@services/auditService';
import { validateUploadFile } from '@shared/lib/validation';
import { logError } from '@shared/lib/logger';
import { useToast } from '@shared/hooks/use-toast';
import { normalizeEmployeeCities } from '@modules/employees/model/employeeCity';
import { EmployeeData, ResidencyStatus, STEPS, EMPLOYEE_DOCUMENT_ALLOWED_TYPES, EmployeeDocUploadState } from './addEmployee.types';
import { EmployeeFormValues } from './addEmployee.schema';
import React, { Dispatch, SetStateAction } from 'react';
import { Check, ChevronRight } from 'lucide-react';

export function getResidencyStatus(expiry: string, onParseError: (error: unknown) => void): ResidencyStatus | null {
  if (!expiry) return null;
  try {
    const days = differenceInDays(parseISO(expiry), new Date());
    return { days, valid: days >= 0 };
  } catch (error) {
    onParseError(error);
    return null;
  }
}

export const buildEmployeePayload = (v: EmployeeFormValues, editEmployee?: EmployeeData | null) => ({
  name: v.name,
  name_en: v.name_en || null,
  job_title: v.job_title || null,
  phone: v.phone || null,
  email: v.email || null,
  national_id: v.national_id || null,
  nationality: v.nationality || null,
  commercial_record: v.commercial_record || null,
  bank_account_number: v.bank_account_number || null,
  city: v.cities[0] || null,
  cities: normalizeEmployeeCities(v.cities),
  join_date: v.join_date || null,
  birth_date: v.birth_date || null,
  residency_expiry: v.residency_expiry || null,
  health_insurance_expiry: v.health_insurance_expiry || null,
  license_expiry: v.license_expiry || null,
  probation_end_date: v.probation_end_date || null,
  license_status: v.license_status,
  sponsorship_status: v.sponsorship_status,
  status: v.status,
  salary_type: editEmployee?.salary_type || 'orders',
  base_salary: editEmployee?.base_salary || 0,
  preferred_language: v.preferred_language,
});

export const upsertEmployeeAndAudit = async (payload: ReturnType<typeof buildEmployeePayload>, isEdit: boolean, editEmployeeId?: string) => {
  if (isEdit && editEmployeeId) {
    await employeeService.updateEmployee(editEmployeeId, payload);
    await auditService.logAdminAction({
      action: 'employees.update',
      table_name: 'employees',
      record_id: editEmployeeId,
      meta: { fields: Object.keys(payload) },
    });
    return editEmployeeId;
  }

  const emp = await employeeService.createEmployee(payload);
  await auditService.logAdminAction({
    action: 'employees.create',
    table_name: 'employees',
    record_id: emp.id,
    meta: { name: payload.name, city: payload.city ?? null },
  });
  return emp.id;
};

export async function uploadNewEmployeeDocuments(
  empId: string,
  files: { personal: File | null; id: File | null; iqama: File | null; license: File | null },
  setUploadState: Dispatch<SetStateAction<EmployeeDocUploadState>>,
): Promise<string[]> {
  const uploads = [
    { key: 'personal' as const, file: files.personal, path: `${empId}/personal_photo`, field: 'personal_photo_url' },
    { key: 'id' as const, file: files.id, path: `${empId}/id_photo`, field: 'id_photo_url' },
    { key: 'iqama' as const, file: files.iqama, path: `${empId}/iqama_photo`, field: 'iqama_photo_url' },
    { key: 'license' as const, file: files.license, path: `${empId}/license_photo`, field: 'license_photo_url' },
  ];
  const updates: Record<string, string> = {};
  const uploadedPaths: string[] = [];
  for (const u of uploads) {
    if (!u.file) continue;
    setUploadState((prev) => ({ ...prev, [u.key]: { status: 'uploading', error: null } }));
    const validation = validateUploadFile(u.file, {
      allowedTypes: EMPLOYEE_DOCUMENT_ALLOWED_TYPES,
    });
    if (!validation.valid) {
      const msg = 'error' in validation ? validation.error : 'ملف غير صالح';
      setUploadState((prev) => ({ ...prev, [u.key]: { status: 'error', error: msg } }));
      throw new Error(msg);
    }
    const ext = (u.file.name.split('.').pop() || '').toLowerCase();
    if (!ext) {
      const msg = 'امتداد الملف غير واضح، الرجاء اختيار ملف بصيغة JPG/PNG/PDF';
      setUploadState((prev) => ({ ...prev, [u.key]: { status: 'error', error: msg } }));
      throw new Error(msg);
    }
    const storagePath = `${u.path}.${ext}`;
    const upData = await employeeService.uploadEmployeeDocument(storagePath, u.file);
    if (upData) {
      updates[u.field] = upData.path;
      uploadedPaths.push(upData.path);
      setUploadState((prev) => ({ ...prev, [u.key]: { status: 'uploaded', error: null } }));
    }
  }
  if (Object.keys(updates).length > 0) {
    await employeeService.updateEmployeeDocumentPaths(empId, updates);
  }
  return uploadedPaths;
}

export async function clearRemovedDocumentsOnEdit(
  empId: string,
  removedDocs: Array<{ storagePath: string; field: string }>,
  isEdit: boolean,
): Promise<void> {
  if (removedDocs.length === 0 || !isEdit) return;
  const pathsToDelete = removedDocs.map((d) => d.storagePath);
  const fieldsToNull: Record<string, null> = {};
  removedDocs.forEach((d) => { fieldsToNull[d.field] = null; });
  await employeeService.deleteEmployeeDocuments(pathsToDelete).catch((e) => {
    logError('[AddEmployeeModal] failed to delete removed documents from storage', e, { level: 'warn' });
  });
  await employeeService.updateEmployeeDocumentPaths(empId, fieldsToNull).catch((e) => {
    logError('[AddEmployeeModal] failed to clear removed document paths', e, { level: 'warn' });
  });
}

/** @returns true if rollback failed fatally (caller should not show generic error). */
export async function rollbackNewEmployeeAfterSaveFailure(
  createdEmployeeId: string | null,
  uploadedDocumentPaths: string[],
  showToast: ReturnType<typeof useToast>['toast'],
): Promise<boolean> {
  if (!createdEmployeeId) return false;
  try {
    await employeeService.deleteEmployeeDocuments(uploadedDocumentPaths);
    await employeeService.deleteById(createdEmployeeId);
    return false;
  } catch (rollbackErr: unknown) {
    logError('[AddEmployeeModal] rollback failed after save failure', rollbackErr, {
      meta: { employeeId: createdEmployeeId },
    });
    showToast({
      title: 'خطأ في الحفظ',
      description: 'فشل حفظ الموظف وتعذر التراجع التلقائي بالكامل. يرجى مراجعة الدعم الفني.',
      variant: 'destructive',
    });
    return true;
  }
}

export function buildEmployeeDefaultValues(editEmployee?: EmployeeData | null): EmployeeFormValues {
  return {
    name: editEmployee?.name ?? '',
    name_en: editEmployee?.name_en ?? '',
    job_title: editEmployee?.job_title ?? '',
    phone: editEmployee?.phone ?? '',
    email: editEmployee?.email ?? '',
    national_id: editEmployee?.national_id ?? '',
    nationality: editEmployee?.nationality ?? '',
    commercial_record: editEmployee?.commercial_record ?? '',
    bank_account_number: editEmployee?.bank_account_number ?? '',
    cities: normalizeEmployeeCities(editEmployee?.cities ?? [], editEmployee?.city),
    join_date: editEmployee?.join_date ?? '',
    birth_date: editEmployee?.birth_date ?? '',
    residency_expiry: editEmployee?.residency_expiry ?? '',
    health_insurance_expiry: editEmployee?.health_insurance_expiry ?? '',
    license_expiry: editEmployee?.license_expiry ?? '',
    probation_end_date: editEmployee?.probation_end_date ?? '',
    probation_days: '',
    license_status: (['has_license', 'no_license', 'applied'].includes(editEmployee?.license_status ?? '')
      ? editEmployee?.license_status
      : 'no_license') as EmployeeFormValues['license_status'],
    sponsorship_status: (['sponsored', 'not_sponsored', 'absconded', 'terminated'].includes(editEmployee?.sponsorship_status ?? '')
      ? editEmployee?.sponsorship_status
      : 'not_sponsored') as EmployeeFormValues['sponsorship_status'],
    status: (['active', 'inactive', 'ended'].includes(editEmployee?.status ?? '')
      ? editEmployee?.status
      : 'active') as EmployeeFormValues['status'],
    preferred_language: (['ar', 'en'].includes(editEmployee?.preferred_language ?? '')
      ? editEmployee?.preferred_language
      : 'ar') as EmployeeFormValues['preferred_language'],
  };
}

export function getFooterActionContent(step: number, saving: boolean, isEdit: boolean): React.ReactNode {
  if (saving) return 'جاري الحفظ...';
  const isLastStep = step === STEPS.length - 1;
  if (isLastStep) {
    const submitLabel = isEdit ? 'حفظ التعديلات' : 'حفظ المندوب';
    return <><Check size={15} /> {submitLabel}</>;
  }
  return <>التالي <ChevronRight size={15} /></>;
}
