/**
 * Salary Service — Salary calculations, records, and scheme management.
 *
 * Calculation flow:
 *   Frontend → Express Server (/api/functions/salary-engine) → PostgreSQL RPC → salary_records upsert
 *
 * Also handles: salary record CRUD, salary schemes, pricing rules, app targets.
 */
import { formatCurrency } from '@shared/lib/formatters';

import { supabase } from '@services/supabase/client';
import { callServerFunction } from '@services/serverFunction';
import { isEmployeeIdUuid, isValidSalaryMonthYear } from '@shared/lib/salaryValidation';
import { handleSupabaseError } from '@services/serviceError';
import { sanitizeLikeQuery } from '@shared/lib/security';
import { createPagedResult } from '@shared/types/pagination';
import { logError } from '@shared/lib/logger';
import type { WorkType } from '@shared/types/shifts';

export interface SalaryRecordPayload {
  employee_id: string;
  month_year: string;
  base_salary?: number;
  orders_count?: number;
  order_bonus?: number;
  attendance_deduction?: number;
  advance_deduction?: number;
  other_deduction?: number;
  other_bonus?: number;
  net_salary?: number;
  is_approved?: boolean;
  notes?: string;
}

export interface SalaryRpcParams {
  monthYear: string;
  paymentMethod?: string;
}

export type SalaryPreviewCalculationMethod =
  | 'orders'
  | 'shift'
  | 'orders_fallback'
  | 'mixed'
  | 'none';

export interface SalaryPreviewPlatformBreakdown {
  app_id?: string;
  app_name: string;
  scheme_id?: string | null;
  scheme_total_orders?: number | null;
  work_type: WorkType;
  calculation_method?: SalaryPreviewCalculationMethod | null;
  orders_count?: number | null;
  shift_days?: number | null;
  earnings: number;
}

export interface SalaryPreviewRow {
  employee_id: string;
  total_orders: number;
  total_shift_days?: number;
  base_salary: number;
  external_deduction: number;
  advance_deduction: number;
  net_salary: number;
  platform_breakdown?: SalaryPreviewPlatformBreakdown[] | null;
}

export type PricingCalcType = 'per_order' | 'fixed' | 'hybrid';

export interface PricingRule {
  id: string;
  app_id: string;
  min_orders: number;
  max_orders: number | null;
  rule_type: PricingCalcType;
  rate_per_order: number | null;
  fixed_salary: number | null;
  is_active?: boolean;
  priority?: number;
}

export interface SalaryCalculationResult {
  totalOrders: number;
  matchedRule: PricingRule | null;
  salary: number;
}

export interface SalarySchemeTier {
  from_orders: number;
  to_orders: number | null;
  price_per_order: number;
  tier_order: number;
  /** total_multiplier = تراكمي لكل نطاق؛ per_order_band = إجمالي الطلبات × سعر الشريحة التي تقع فيها فقط */
  tier_type?: 'total_multiplier' | 'fixed_amount' | 'base_plus_incremental' | 'per_order_band';
  incremental_threshold?: number | null;
  incremental_price?: number | null;
}

const sortSalarySchemeTiers = (tiers: SalarySchemeTier[]): SalarySchemeTier[] => {
  return [...tiers].sort((a, b) => a.tier_order - b.tier_order);
};

const formatExplanationNumber = (value: number): string => {
  if (!Number.isFinite(value)) return '0';
  return value.toLocaleString('en-US');
};

const isolateLtr = (value: string): string => `\u2066${value}\u2069`;

const formatExplanationRange = (from: number, to: number | null): string =>
  isolateLtr(`${formatExplanationNumber(from)}-${to === null ? '∞' : formatExplanationNumber(to)}`);

const findMatchedSalaryTier = (tiers: SalarySchemeTier[], orders: number): SalarySchemeTier => {
  let matchedTier = tiers[0];
  for (const tier of tiers) {
    const from = tier.from_orders;
    const to = tier.to_orders ?? Infinity;
    if (orders >= from && orders <= to) {
      matchedTier = tier;
      break;
    }
    if (orders > to) matchedTier = tier;
  }
  return matchedTier;
};

const calculateTotalMultiplierSalary = (orders: number, tiers: SalarySchemeTier[]): number => {
  let total = 0;
  for (const tier of tiers) {
    const from = tier.from_orders;
    const to = tier.to_orders ?? Infinity;
    if (orders < from) break;
    const inTier = Math.min(orders, to) - from + 1;
    if (inTier <= 0) continue;
    total += inTier * tier.price_per_order;
  }
  return total;
};

const buildTotalMultiplierBreakdown = (
  orders: number,
  tiers: SalarySchemeTier[],
): { parts: string[]; total: number } => {
  const parts: string[] = [];
  let total = 0;

  for (const tier of tiers) {
    const from = tier.from_orders;
    const to = tier.to_orders ?? Infinity;
    if (orders < from) break;

    const inTier = Math.min(orders, to) - from + 1;
    if (inTier <= 0) continue;

    total += inTier * tier.price_per_order;
    parts.push(`${formatExplanationNumber(inTier)} × ${formatExplanationNumber(tier.price_per_order)}`);
  }

  return { parts, total };
};

/** أسطر توضيحية لمعاينة السكيما في الواجهة */
export function getTierSalaryExplanationLines(
  orders: number,
  tiers: SalarySchemeTier[] | undefined,
  targetOrders: number | null,
  targetBonus: number | null,
): string[] {
  if (!tiers?.length || orders <= 0) return [];
  const sorted = sortSalarySchemeTiers(tiers);
  const matched = findMatchedSalaryTier(sorted, orders);
  const tierType = matched.tier_type || 'total_multiplier';
  const lines: string[] = [];

  if (tierType === 'per_order_band') {
    const bandTotal = orders * matched.price_per_order;
    const bandExpr = `${formatExplanationNumber(orders)} × ${formatExplanationNumber(matched.price_per_order)} = ${formatExplanationNumber(bandTotal)}`;
    lines.push(
      `المعادلة: ${isolateLtr(bandExpr)} ر.س (شريحة ${formatExplanationRange(matched.from_orders, matched.to_orders ?? null)})`,
    );
  } else if (tierType === 'fixed_amount') {
    lines.push(
      `مبلغ ثابت ${isolateLtr(formatExplanationNumber(Math.round(matched.price_per_order)))} ر.س للنطاق ${formatExplanationRange(matched.from_orders, matched.to_orders ?? null)}`,
    );
  } else if (tierType === 'base_plus_incremental') {
    const thr = matched.incremental_threshold ?? matched.from_orders;
    const incrementalPrice = matched.incremental_price ?? 0;
    const extraOrders = Math.max(0, orders - thr);
    const tierTotal = matched.price_per_order + extraOrders * incrementalPrice;
    const incExpr = `${formatExplanationNumber(Math.round(matched.price_per_order))} + (${formatExplanationNumber(orders)} - ${formatExplanationNumber(thr)}) × ${formatExplanationNumber(incrementalPrice)} = ${formatExplanationNumber(tierTotal)}`;
    lines.push(
      `المعادلة: ${isolateLtr(incExpr)} ر.س`,
    );
  } else {
    const { parts, total } = buildTotalMultiplierBreakdown(orders, sorted);
    const totalExpr = `${parts.join(' + ')} = ${formatExplanationNumber(total)}`;
    lines.push(
      `المعادلة: ${isolateLtr(totalExpr)} ر.س`,
    );
  }

  if (targetOrders && targetBonus && orders >= targetOrders) {
    lines.push(`مكافأة الهدف (≥${targetOrders} طلب): +${formatCurrency(targetBonus)}`);
  }
  return lines;
}

const addTargetBonusIfEligible = (
  total: number,
  orders: number,
  targetOrders: number | null,
  targetBonus: number | null
): number => {
  if (targetOrders && targetBonus && orders >= targetOrders) {
    return total + targetBonus;
  }
  return total;
};

export const salaryService = {
  calculateTierSalary: (
    orders: number,
    tiers: SalarySchemeTier[] | undefined,
    targetOrders: number | null,
    targetBonus: number | null
  ): number => {
    if (!tiers || tiers.length === 0 || orders === 0) return 0;
    const sorted = sortSalarySchemeTiers(tiers);
    const matchedTier = findMatchedSalaryTier(sorted, orders);

    const tierType = matchedTier.tier_type || 'total_multiplier';
    let total: number;
    if (tierType === 'fixed_amount') {
      total = matchedTier.price_per_order;
    } else if (tierType === 'base_plus_incremental') {
      const threshold = matchedTier.incremental_threshold ?? matchedTier.from_orders;
      const incrPrice = matchedTier.incremental_price ?? 0;
      const extra = Math.max(0, orders - threshold);
      total = matchedTier.price_per_order + extra * incrPrice;
    } else if (tierType === 'per_order_band') {
      total = orders * matchedTier.price_per_order;
    } else {
      total = calculateTotalMultiplierSalary(orders, sorted);
    }

    return Math.round(addTargetBonusIfEligible(total, orders, targetOrders, targetBonus));
  },

  calculateFixedMonthlySalary: (monthlyAmount: number, attendanceDays: number): number => {
    if (!monthlyAmount || monthlyAmount <= 0) return 0;
    return Math.round((monthlyAmount / 30) * attendanceDays);
  },

  getPricingRules: async (appId: string) => {
    const { data, error } = await supabase
      .from('pricing_rules' as never)
      .select('id, app_id, min_orders, max_orders, rule_type, rate_per_order, fixed_salary, is_active, priority')
      .eq('app_id', appId)
      .eq('is_active', true)
      .order('priority', { ascending: false })
      .order('min_orders', { ascending: true });
    if (error) handleSupabaseError(error, 'salaryService.getPricingRules');
    return (data || []) as PricingRule[];
  },

  /**
   * Bulk fetch pricing rules for multiple apps in a single query.
   * Use this instead of calling getPricingRules() N times in a loop.
   *
   * Returns: { [appId]: PricingRule[] }
   */
  getPricingRulesForApps: async (appIds: string[]): Promise<Record<string, PricingRule[]>> => {
    if (appIds.length === 0) return {};

    const { data, error } = await supabase
      .from('pricing_rules' as never)
      .select('id, app_id, min_orders, max_orders, rule_type, rate_per_order, fixed_salary, is_active, priority')
      .in('app_id', appIds)
      .eq('is_active', true)
      .order('priority', { ascending: false })
      .order('min_orders', { ascending: true });

    if (error) handleSupabaseError(error, 'salaryService.getPricingRulesForApps');

    // Group results by app_id
    const result: Record<string, PricingRule[]> = {};
    // Ensure every requested appId has an entry (even if empty)
    appIds.forEach((id) => { result[id] = []; });
    (data || []).forEach((rule) => {
      const r = rule as PricingRule;
      if (!result[r.app_id]) result[r.app_id] = [];
      result[r.app_id].push(r);
    });

    return result;
  },

  getOrderCount: async (employeeId: string, appId: string, monthYear: string) => {
    const [year, month] = monthYear.split('-');
    const from = `${year}-${month}-01`;
    const to = new Date(Number(year), Number(month), 0).toISOString().split('T')[0];

    const { data, error } = await supabase
      .from('daily_orders')
      .select('orders_count')
      .eq('employee_id', employeeId)
      .eq('app_id', appId)
      .gte('date', from)
      .lte('date', to);

    if (error) handleSupabaseError(error, 'salaryService.getOrderCount');
    return (data || []).reduce((sum, row) => sum + (row.orders_count ?? 0), 0);
  },

  applyPricingRules: (rules: PricingRule[], orders: number): SalaryCalculationResult => {
    const matched = rules.find(
      (rule) => orders >= rule.min_orders && (rule.max_orders === null || orders <= rule.max_orders)
    ) ?? null;

    if (!matched) {
      return { totalOrders: orders, matchedRule: null, salary: 0 };
    }

    if (matched.rule_type === 'fixed') {
      return { totalOrders: orders, matchedRule: matched, salary: Number(matched.fixed_salary || 0) };
    }
    if (matched.rule_type === 'per_order') {
      return { totalOrders: orders, matchedRule: matched, salary: orders * Number(matched.rate_per_order || 0) };
    }

    return {
      totalOrders: orders,
      matchedRule: matched,
      salary: Number(matched.fixed_salary || 0) + orders * Number(matched.rate_per_order || 0),
    };
  },

  calculateSalaryByRules: async (employeeId: string, appId: string, monthYear: string) => {
    const [rules, total] = await Promise.all([
      salaryService.getPricingRules(appId),
      salaryService.getOrderCount(employeeId, appId, monthYear),
    ]);
    return salaryService.applyPricingRules(rules, total);
  },

  calculateSalaryForEmployeeMonth: async (
    employeeId: string,
    monthYear: string,
    paymentMethod = 'cash',
    manualDeduction = 0,
    manualDeductionNote: string | null = null
  ) => {
    if (!isEmployeeIdUuid(employeeId) || !isValidSalaryMonthYear(monthYear)) {
      handleSupabaseError(new Error('Invalid employee_id or month_year'), 'salaryService.calculateSalaryForEmployeeMonth');
    }
    return callServerFunction('salary-engine', {
      mode: 'employee',
      employee_id: employeeId,
      month_year: monthYear,
      payment_method: paymentMethod,
      manual_deduction: manualDeduction,
      manual_deduction_note: manualDeductionNote,
    });
  },

  calculateSalaryForMonth: async ({ monthYear, paymentMethod = 'cash' }: SalaryRpcParams) => {
    if (!isValidSalaryMonthYear(monthYear)) {
      handleSupabaseError(new Error('Invalid month_year'), 'salaryService.calculateSalaryForMonth');
    }
    return callServerFunction('salary-engine', {
      mode: 'month',
      month_year: monthYear,
      payment_method: paymentMethod,
    });
  },

  getSalaryPreviewForMonth: async (monthYear: string) => {
    const my = String(monthYear ?? '').trim();
    if (!isValidSalaryMonthYear(my)) {
      return [] as SalaryPreviewRow[];
    }

    // salary-engine wraps payloads as { data: ... }; other routes return the body directly.
    const data = await callServerFunction<SalaryPreviewRow[] | { data?: SalaryPreviewRow[] }>('salary-engine', {
      mode: 'month_preview',
      month_year: my,
    });
    const rows = Array.isArray(data) ? data : data?.data;
    return rows ?? [];
  },

  getByMonth: async (monthYear: string) => {
    const { data, error } = await supabase
      .from('salary_records')
      .select('*, employees(name, national_id, salary_type)')
      .eq('month_year', monthYear)
      .order('created_at', { ascending: false });
    if (error) handleSupabaseError(error, 'salaryService.getByMonth');
    return data ?? [];
  },

  /** Server-side salary_records list for large volumes (pagination + filters). */
  getPagedByMonth: async (params: {
    monthYear: string;
    page: number; // 1-based
    pageSize: number;
    filters?: {
      branch?: 'makkah' | 'jeddah';
      search?: string; // employee name/national id
      approved?: 'all' | 'approved' | 'pending';
    };
  }) => {
    const { monthYear, page, pageSize } = params;
    const filters = params.filters ?? {};
    const fromIdx = (page - 1) * pageSize;
    const toIdx = fromIdx + pageSize - 1;

    let query = supabase
      .from('salary_records')
      .select(
        'id, employee_id, month_year, net_salary, base_salary, advance_deduction, external_deduction, manual_deduction, attendance_deduction, is_approved, created_at, employees(id, name, national_id, city)',
        { count: 'exact' }
      )
      .eq('month_year', monthYear)
      .order('created_at', { ascending: false })
      .range(fromIdx, toIdx);

    if (filters.branch) query = query.eq('employees.city', filters.branch);
    if (filters.approved === 'approved') query = query.eq('is_approved', true);
    if (filters.approved === 'pending') query = query.eq('is_approved', false);
    if (filters.search?.trim()) {
      const sq = sanitizeLikeQuery(filters.search.trim());
      query = query.or(`employees.name.ilike.%${sq}%,employees.national_id.ilike.%${sq}%`);
    }

    const { data, error, count } = await query;
    if (error) handleSupabaseError(error, 'salaryService.getPagedByMonth');
    return createPagedResult({
      rows: data,
      total: count,
      page,
      pageSize,
    });
  },

  /** Export helper for large salary_records datasets (chunked). */
  exportMonth: async (params: {
    monthYear: string;
    filters?: {
      branch?: 'makkah' | 'jeddah';
      search?: string;
      approved?: 'all' | 'approved' | 'pending';
    };
    chunkSize?: number;
    maxRows?: number;
  }) => {
    const { monthYear } = params;
    const filters = params.filters ?? {};
    const chunkSize = params.chunkSize ?? 1000;
    const maxRows = params.maxRows ?? 5_000;

    const all: unknown[] = [];
    for (let page = 1; page <= Math.ceil(maxRows / chunkSize); page++) {
      const res = await salaryService.getPagedByMonth({ monthYear, page, pageSize: chunkSize, filters });
      all.push(...res.rows);
      if (res.rows.length < chunkSize) break;
    }
    return all;
  },

  getMonthRecordsForSalaryContext: async (monthYear: string) => {
    // FIX: paginate to bypass Supabase's default 1000-row limit.
    // Companies with 1000+ employees had approved records silently dropped,
    // causing them to appear as "pending" on the salary page.
    const PAGE_SIZE = 1000;
    type SalaryRecordContextRow = {
      employee_id: string;
      is_approved: boolean;
      base_salary: number | null;
      allowances: number | null;
      advance_deduction: number | null;
      net_salary: number | null;
      manual_deduction: number | null;
      attendance_deduction: number | null;
      external_deduction: number | null;
      payment_method: string | null;
      sheet_snapshot: unknown;
    };

    const primarySelect = 'employee_id, is_approved, base_salary, allowances, advance_deduction, net_salary, manual_deduction, attendance_deduction, external_deduction, payment_method, sheet_snapshot';
    const fallbackSelect = 'employee_id, is_approved, base_salary, allowances, advance_deduction, net_salary, manual_deduction, attendance_deduction, external_deduction, payment_method';

    let useFallback = false;

    // Try first page with sheet_snapshot to detect column availability
    {
      const { error } = await supabase
        .from('salary_records')
        .select(primarySelect)
        .eq('month_year', monthYear)
        .range(0, 0); // just 1 row to test column existence
      if (error && String(error.message ?? '').includes('sheet_snapshot')) {
        useFallback = true;
      } else if (error) {
        handleSupabaseError(error, 'salaryService.getMonthRecordsForSalaryContext');
      }
    }

    const selectStr = useFallback ? fallbackSelect : primarySelect;
    const allRows: SalaryRecordContextRow[] = [];
    let offset = 0;
    let hasMore = true;
    while (hasMore) {
      const { data, error } = await supabase
        .from('salary_records')
        .select(selectStr)
        .eq('month_year', monthYear)
        .range(offset, offset + PAGE_SIZE - 1);
      if (error) handleSupabaseError(error, 'salaryService.getMonthRecordsForSalaryContext');
      const rows = useFallback
        ? ((data ?? []) as unknown as Omit<SalaryRecordContextRow, 'sheet_snapshot'>[]).map((r) => ({ ...r, sheet_snapshot: null }))
        : ((data ?? []) as unknown as SalaryRecordContextRow[]);
      allRows.push(...rows);
      hasMore = (data?.length ?? 0) === PAGE_SIZE;
      offset += PAGE_SIZE;
    }
    return allRows;
  },

  getByEmployee: async (employeeId: string) => {
    const { data, error } = await supabase
      .from('salary_records')
      .select('*')
      .eq('employee_id', employeeId)
      .order('month_year', { ascending: false });
    if (error) handleSupabaseError(error, 'salaryService.getByEmployee');
    return data ?? [];
  },

  upsert: async (payload: SalaryRecordPayload) => {
    const { data, error } = await supabase
      .from('salary_records')
      .upsert(payload as never, { onConflict: 'employee_id,month_year' })
      .select()
      .single();
    if (error) handleSupabaseError(error, 'salaryService.upsert');
    return data;
  },

  upsertMany: async (records: Record<string, unknown>[]) => {
    const { error } = await supabase
      .from('salary_records')
      .upsert(records as never, { onConflict: 'employee_id,month_year' });

    // If the sheet_snapshot column doesn't exist (migration pending),
    // fail loudly instead of silently dropping data.
    // The migration should be run before deploying code that uses this column.
    if (error && String(error.message ?? '').includes('sheet_snapshot')) {
      logError(
        '[salaryService.upsertMany] CRITICAL: sheet_snapshot column missing from salary_records. ' +
        'Run the pending DB migration before using this feature.',
        error,
      );
    }

    if (error) handleSupabaseError(error, 'salaryService.upsertMany');
  },

  update: async (id: string, payload: Partial<SalaryRecordPayload>) => {
    const { data, error } = await supabase
      .from('salary_records')
      .update(payload as never)
      .eq('id', id)
      .select()
      .single();
    if (error) handleSupabaseError(error, 'salaryService.update');
    return data;
  },

  approve: async (id: string) => {
    const { error } = await supabase
      .from('salary_records')
      .update({ is_approved: true })
      .eq('id', id);
    if (error) handleSupabaseError(error, 'salaryService.approve');
  },

  delete: async (id: string) => {
    const { error } = await supabase.from('salary_records').delete().eq('id', id);
    if (error) handleSupabaseError(error, 'salaryService.delete');
  },

  getMonthTotal: async (monthYear: string) => {
    const { data, error } = await supabase
      .from('salary_records')
      .select('net_salary')
      .eq('month_year', monthYear)
      .eq('is_approved', true);
    if (error) handleSupabaseError(error, 'salaryService.getMonthTotal');
    return data?.reduce((sum, r) => sum + (r.net_salary ?? 0), 0) ?? 0;
  },

  getActiveAdvanceDeductionsByMonth: async (monthYear: string) => {
    const { data, error } = await supabase
      .from('advance_installments')
      .select('advance_id, amount, advances(employee_id)')
      .eq('month_year', monthYear)
      .eq('status', 'pending');
    if (error) handleSupabaseError(error, 'salaryService.getActiveAdvanceDeductionsByMonth');
    return data ?? [];
  },

  getEmployees: async () => {
    const { data, error } = await supabase
      .from('employees')
      .select('id, name, salary_type, status, sponsorship_status')
      .eq('status', 'active')
      .order('name');
    if (error) handleSupabaseError(error, 'salaryService.getEmployees');
    return data ?? [];
  },
};
