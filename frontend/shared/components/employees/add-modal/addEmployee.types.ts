export interface EmployeeData {
  id: string;
  name: string;
  name_en?: string | null;
  job_title?: string | null;
  phone?: string | null;
  email?: string | null;
  national_id?: string | null;
  bank_account_number?: string | null;
  city?: string | null;
  cities?: string[] | null;
  join_date?: string | null;
  birth_date?: string | null;
  residency_expiry?: string | null;
  health_insurance_expiry?: string | null;
  probation_end_date?: string | null;
  license_status?: string | null;
  license_expiry?: string | null;
  sponsorship_status?: string | null;
  commercial_record?: string | null;
  id_photo_url?: string | null;
  iqama_photo_url?: string | null;
  license_photo_url?: string | null;
  personal_photo_url?: string | null;
  status: string;
  salary_type: string;
  base_salary: number;
  preferred_language?: string | null;
  nationality?: string | null;
}

export interface AddEmployeeModalProps {
  onClose: () => void;
  onSuccess?: () => void;
  editEmployee?: EmployeeData | null;
}

export const STEPS = ['البيانات الأساسية', 'الإقامة والوثائق', 'رفع المستندات'];

export type UploadStatus = 'idle' | 'selected' | 'uploading' | 'uploaded' | 'error';
export type ResidencyStatus = { days: number; valid: boolean };

export const EMPLOYEE_DOCUMENT_ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

export function isImageDocument(nameOrPath?: string | null, mimeType?: string | null) {
  const normalizedMime = mimeType?.toLowerCase() ?? '';
  if (normalizedMime.startsWith('image/')) return true;

  const normalizedName = (nameOrPath ?? '').toLowerCase();
  return ['.jpg', '.jpeg', '.png', '.webp'].some((ext) => normalizedName.endsWith(ext));
}

export type EmployeeDocUploadState = {
  personal: { status: UploadStatus; error: string | null };
  id: { status: UploadStatus; error: string | null };
  iqama: { status: UploadStatus; error: string | null };
  license: { status: UploadStatus; error: string | null };
};
