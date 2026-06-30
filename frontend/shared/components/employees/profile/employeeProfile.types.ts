import {
  type EmployeeProfileAdvance,
  type EmployeeProfileApp,
  type EmployeeProfileDailyOrder,
  type EmployeeProfileSalaryRecord,
} from '@services/employeeProfileService';

export interface Employee {
  id: string;
  name: string;
  job_title?: string | null;
  phone?: string | null;
  email?: string | null;
  national_id?: string | null;
  iban?: string | null;
  bank_account_number?: string | null;
  city?: string | null;
  cities?: string[] | null;
  join_date?: string | null;
  dob?: string | null;
  birth_date?: string | null;
  residency_expiry?: string | null;
  health_insurance_expiry?: string | null;
  license_expiry?: string | null;
  license_status?: string | null;
  sponsorship_status?: string | null;
  probation_end_date?: string | null;
  nationality?: string | null;
  preferred_language?: string | null;
  commercial_record?: string | null;
  id_photo_url?: string | null;
  iqama_photo_url?: string | null;
  license_photo_url?: string | null;
  personal_photo_url?: string | null;
  status: string;
  salary_type: string;
  base_salary: number;
}

export type Advance = EmployeeProfileAdvance;
export type SalaryRecord = EmployeeProfileSalaryRecord;
export type EmployeeApp = EmployeeProfileApp;
export type DailyOrder = EmployeeProfileDailyOrder;

export interface MonthlyOrders {
  month: string;           // YYYY-MM
  label: string;           // e.g. "يناير 2025"
  total: number;
  byApp: { appName: string; color?: string; count: number }[];
  days: DailyOrder[];
}

export interface EmployeeProfileProps {
  employee: Employee;
  onBack: () => void;
}
