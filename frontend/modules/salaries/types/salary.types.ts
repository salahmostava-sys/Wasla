import type { SlipLanguage } from '@shared/lib/salarySlipTranslations';
import type { PricingRule } from '@services/salaryService';
import type { WorkType } from '@shared/types/shifts';

export type SortDir = 'asc' | 'desc' | null;

export interface SalaryRow {
  id: string;
  employeeId: string;
  employeeName: string;
  jobTitle: string;
  nationalId: string;
  city: string;
  cityKey: 'makkah' | 'jeddah' | null;
  bankAccount: string;
  hasIban: boolean;
  paymentMethod: 'bank' | 'cash';
  registeredApps: string[];
  platformOrders: Record<string, number>;
  platformSalaries: Record<string, number>;
  platformMetrics: Record<string, PlatformSalaryMetric>;
  incentives: number;
  sickAllowance: number;
  violations: number;
  customDeductions: Record<string, number>;
  transfer: number;
  advanceDeduction: number;
  advanceInstallmentIds: string[];
  advanceRemaining: number;
  externalDeduction: number;
  status: 'pending' | 'approved' | 'paid';
  isDirty?: boolean;
  preferEngineBaseSalary?: boolean;
  preferredLanguage: SlipLanguage;
  phone?: string | null;
  workDays: number;
  fuelCost: number;
  kilometers: number;
  platformIncome: number;
  engineBaseSalary?: number;
}

export interface PlatformSalaryMetric {
  appName: string;
  schemeId?: string | null;
  schemeTotalOrders?: number | null;
  workType: WorkType;
  calculationMethod?: string | null;
  ordersCount: number;
  shiftDays: number;
  salary: number;
}

export interface SchemeData {
  id: string;
  name: string;
  name_en: string | null;
  status: string;
  scheme_type?: 'order_based' | 'fixed_monthly';
  monthly_amount?: number | null;
  target_orders: number | null;
  target_bonus: number | null;
  salary_scheme_tiers?: {
    from_orders: number;
    to_orders: number | null;
    price_per_order: number;
    tier_order: number;
    tier_type?: 'total_multiplier' | 'fixed_amount' | 'base_plus_incremental' | 'per_order_band';
    incremental_threshold?: number | null;
    incremental_price?: number | null;
  }[];
  snapshot?: unknown;
  scheme_id?: string;
}

export type OrderWithAppRow = {
  employee_id: string;
  orders_count: number;
  apps?: { name?: string | null } | null;
};
// buildOrdersMap lives in salaryDomain.ts — do not duplicate here.

export type AppWithSchemeRow = {
  id: string;
  name: string;
  work_type?: WorkType | null;
  scheme_id?: string | null;
  salary_schemes?: SchemeData | null;
};

export type SalaryDraftPatch = Pick<
  SalaryRow,
  | 'platformOrders'
  | 'incentives'
  | 'sickAllowance'
  | 'violations'
  | 'customDeductions'
  | 'transfer'
  | 'advanceDeduction'
  | 'externalDeduction'
  | 'platformIncome'
  | 'engineBaseSalary'
  | 'paymentMethod'
>;

export type SalaryRowSnapshot = Pick<
  SalaryRow,
  | 'bankAccount'
  | 'hasIban'
  | 'paymentMethod'
  | 'platformOrders'
  | 'platformSalaries'
  | 'platformMetrics'
  | 'incentives'
  | 'sickAllowance'
  | 'violations'
  | 'customDeductions'
  | 'transfer'
  | 'advanceDeduction'
  | 'externalDeduction'
  | 'platformIncome'
  | 'engineBaseSalary'
>;

export type MergedPdfComputed = {
  totalPlatformSalary: number;
  totalAdditions: number;
  totalWithSalary: number;
  totalDeductions: number;
  netSalary: number;
  remaining: number;
};

export type SalaryBaseContextData = {
  monthlyContext: {
    employees: unknown;
    extRes: unknown;
    orders: unknown;
    appsWithSchemeRes: unknown;
    attendanceRows: unknown;
    fuelRes: unknown;
    savedRecords: unknown;
    allAdvances: unknown;
  };
  previewData: unknown;
};

export type PreparedSalaryState = {
  appNameToId: Record<string, string>;
  rulesMap: Record<string, PricingRule[]>;
  appsWithoutPricingRules: string[];
  appsWithoutScheme: string[];
  builtEmpPlatformScheme: Record<string, Record<string, SchemeData | null>>;
  hydratedRows: SalaryRow[];
};
