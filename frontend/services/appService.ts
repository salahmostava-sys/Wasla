import { supabase } from '@services/supabase/client';
import type { Json } from '@services/supabase/types';
import { handleSupabaseError } from '@services/serviceError';

export interface AppUpsertPayload {
  name: string;
  name_en: string | null;
  brand_color: string;
  text_color: string;
  is_active: boolean;
  is_archived?: boolean;
  custom_columns: Json;
  work_type?: 'orders' | 'shift' | 'hybrid';
}

export const appService = {
  getActiveApps: async () => {
    const { data, error } = await supabase
      .from('apps')
      .select('id, name')
      .eq('is_active', true)
      .order('name');
    if (error) handleSupabaseError(error, 'appService.getActiveApps');
    return data ?? [];
  },

  getAll: async () => {
    const { data, error } = await supabase
      .from('apps')
      .select('id, name, name_en, brand_color, text_color, is_active, is_archived, custom_columns, work_type, logo_url')
      .eq('is_archived', false)
      .order('name');
    if (error) handleSupabaseError(error, 'appService.getAll');
    return data ?? [];
  },

  getMonthlyApps: async (_monthYear: string) => {
    const { data: allApps, error: appsError } = await supabase
      .from('apps')
      .select('id, name, name_en, brand_color, text_color, is_active, is_archived, custom_columns, work_type, logo_url')
      .eq('is_archived', false)
      .order('name');
    
    if (appsError) handleSupabaseError(appsError, 'appService.getMonthlyApps.apps');

    // 2. We'll consider an app "active this month" if it's generally active,
    // until we have a formal monthly activation table.
    return (allApps || []).map(app => ({
      ...app,
      is_active_this_month: app.is_active
    }));
  },

  create: async (payload: AppUpsertPayload) => {
    const { error } = await supabase.from('apps').insert(payload);
    if (error) handleSupabaseError(error, 'appService.create');
  },

  update: async (id: string, payload: AppUpsertPayload) => {
    const { error } = await supabase.from('apps').update(payload).eq('id', id);
    if (error) handleSupabaseError(error, 'appService.update');
  },

  toggleMonthlyActive: async (appId: string, _monthYear: string, isActive: boolean) => {
    // Fallback: Toggle global activity since monthly table is missing
    const { error } = await supabase
      .from('apps')
      .update({ is_active: isActive })
      .eq('id', appId);
    if (error) handleSupabaseError(error, 'appService.toggleMonthlyActive');
  },

  delete: async (id: string) => {
    // Soft delete: deactivate the app (keeps historical data intact)
    const { error } = await supabase
      .from('apps')
      .update({ is_active: false })
      .eq('id', id);
    if (error) handleSupabaseError(error, 'appService.delete');
  },

  permanentDelete: async (id: string) => {
    // Hard delete: remove completely from system
    // Delete related records first to avoid FK constraint violations
    await Promise.all([
      supabase.from('employee_apps').delete().eq('app_id', id),
      supabase.from('daily_orders').delete().eq('app_id', id),
      supabase.from('app_targets').delete().eq('app_id', id),
      supabase.from('pricing_rules').delete().eq('app_id', id),
      supabase.from('daily_shifts').delete().eq('app_id', id),
      supabase.from('app_hybrid_rules').delete().eq('app_id', id),
    ]);
    
    // Now delete the app itself
    const { error } = await supabase.from('apps').delete().eq('id', id);
    if (error) handleSupabaseError(error, 'appService.permanentDelete');
  },

  getAppDependencies: async (id: string) => {
    // Check all dependencies before permanent delete
    const [employeeApps, dailyOrders, appTargets, pricingRules] = await Promise.all([
      supabase.from('employee_apps').select('id', { count: 'exact', head: true }).eq('app_id', id),
      supabase.from('daily_orders').select('id', { count: 'exact', head: true }).eq('app_id', id),
      supabase.from('app_targets').select('id', { count: 'exact', head: true }).eq('app_id', id),
      supabase.from('pricing_rules').select('id', { count: 'exact', head: true }).eq('app_id', id),
    ]);

    return {
      employeeAppsCount: employeeApps.count ?? 0,
      dailyOrdersCount: dailyOrders.count ?? 0,
      appTargetsCount: appTargets.count ?? 0,
      pricingRulesCount: pricingRules.count ?? 0,
      hasAnyDependencies: 
        (employeeApps.count ?? 0) > 0 ||
        (dailyOrders.count ?? 0) > 0 ||
        (appTargets.count ?? 0) > 0 ||
        (pricingRules.count ?? 0) > 0,
    };
  },

  countActiveEmployeeApps: async (appId: string) => {
    const { error, count } = await supabase
      .from('employee_apps')
      .select('id', { count: 'exact', head: true })
      .eq('app_id', appId)
      .eq('status', 'active');
    if (error) handleSupabaseError(error, 'appService.countActiveEmployeeApps');
    return count ?? 0;
  },

  getActiveEmployeeAppsWithEmployees: async (appId: string) => {
    const { data, error } = await supabase
      .from('employee_apps')
      .select('app_id, employee_id, employees!inner(id, name, national_id, phone, job_title, status, sponsorship_status)')
      .eq('app_id', appId)
      .eq('status', 'active');
    if (error) handleSupabaseError(error, 'appService.getActiveEmployeeAppsWithEmployees');
    return data ?? [];
  },

  getActiveAssignmentsWithEmployees: async () => {
    const { data, error } = await supabase
      .from('employee_apps')
      .select('app_id, employee_id, employees!inner(id, name, national_id, phone, job_title, status, sponsorship_status)')
      .eq('status', 'active');
    if (error) handleSupabaseError(error, 'appService.getActiveAssignmentsWithEmployees');
    return data ?? [];
  },

  getEmployeeMonthlyOrders: async (employeeId: string, appId: string, startDate: string, endDate: string) => {
    const { data, error } = await supabase
      .from('daily_orders')
      .select('orders_count')
      .eq('employee_id', employeeId)
      .eq('app_id', appId)
      .gte('date', startDate)
      .lte('date', endDate);
    if (error) handleSupabaseError(error, 'appService.getEmployeeMonthlyOrders');
    return data ?? [];
  },

  getMonthlyOrdersForApp: async (appId: string, startDate: string, endDate: string) => {
    const { data, error } = await supabase
      .from('daily_orders')
      .select('employee_id, orders_count')
      .eq('app_id', appId)
      .gte('date', startDate)
      .lte('date', endDate);
    if (error) handleSupabaseError(error, 'appService.getMonthlyOrdersForApp');
    return data ?? [];
  },

  assignScheme: async (appId: string, schemeId: string | null) => {
    const { error } = await supabase.from('apps').update({ scheme_id: schemeId }).eq('id', appId);
    if (error) handleSupabaseError(error, 'appService.assignScheme');
  },

  getActiveWithScheme: async () => {
    const { data, error } = await supabase
      .from('apps')
      .select('id, name, scheme_id')
      .eq('is_active', true)
      .eq('is_archived', false)
      .order('name');
    if (error) handleSupabaseError(error, 'appService.getActiveWithScheme');
    return data ?? [];
  },

  getActiveWithSalarySchemes: async () => {
    const { data, error } = await supabase
      .from('apps')
      .select('id, name, work_type, scheme_id, salary_schemes(id, name, name_en, status, scheme_type, monthly_amount, target_orders, target_bonus, salary_scheme_tiers(id, from_orders, to_orders, price_per_order, tier_order, tier_type, incremental_threshold, incremental_price))')
      .eq('is_active', true)
      .eq('is_archived', false);
    if (error) handleSupabaseError(error, 'appService.getActiveWithSalarySchemes');
    return data ?? [];
  },

  /** Monthly order target for one app (YYYY-MM), or null if not set */
  getAppTargetForMonth: async (appId: string, monthYear: string) => {
    const { data, error } = await supabase
      .from('app_targets')
      .select('target_orders')
      .eq('app_id', appId)
      .eq('month_year', monthYear)
      .maybeSingle();
    if (error) handleSupabaseError(error, 'appService.getAppTargetForMonth');
    return data?.target_orders ?? null;
  },
};
