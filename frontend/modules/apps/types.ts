import type { WorkType } from '@shared/types/shifts';

export interface CustomColumn {
  key: string;
  label: string;
}

export interface AppData {
  id: string;
  name: string;
  name_en: string | null;
  brand_color: string;
  text_color: string;
  is_active: boolean;
  is_active_this_month: boolean;
  employeeCount: number;
  ordersCount: number;
  work_type?: WorkType | null;
  logo_url?: string | null;
  custom_columns: CustomColumn[];
}

export interface AppFormValues {
  name: string;
  name_en: string;
  brand_color: string;
  text_color: string;
  is_active: boolean;
  custom_columns: CustomColumn[];
}

export interface AppEmployee {
  id: string;
  name: string;
  national_id?: string | null;
  phone?: string | null;
  job_title?: string | null;
  status: string;
  monthOrders: number;
  targetShare: number | null;
  projectedMonthEnd: number | null;
  onTrack: boolean | null;
}

export interface AppMonthlyOrderRow {
  app_id: string | null;
  employee_id: string | null;
  orders_count: number | null;
}

export interface AppEmployeeAssignmentRow {
  app_id: string;
  employee_id: string;
  employees: {
    id: string;
    name: string;
    national_id?: string | null;
    phone?: string | null;
    job_title?: string | null;
    status: string;
    sponsorship_status: string | null;
  } | null;
}

export interface AppEmployeeOrderRow {
  employee_id: string | null;
  orders_count: number | null;
}
