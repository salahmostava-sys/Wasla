/**
 * Order Service — Daily orders CRUD + month-level operations.
 *
 * Handles: fetching raw orders, replacing a full month's data (chunked),
 * month locking/unlocking, app targets, and employee/app base queries
 * shared by the Orders spreadsheet grid.
 */
import { supabase } from '@services/supabase/client';
import { toServiceError } from '@services/serviceError';
import { authService } from '@services/authService';
import { createPagedResult } from '@shared/types/pagination';
import { sanitizeLikeQuery } from '@shared/lib/security';
import { fetchAllPages } from '@shared/lib/supabaseUtils';

export interface DailyOrder {
  id: string;
  employee_id: string;
  date: string;
  app_id: string;
  orders_count: number;
  created_at: string;
  updated_at: string;
}

export type DailyOrderUpsertRow = {
  employee_id: string;
  app_id: string;
  date: string;
  orders_count: number;
};

export type BulkUpsertFailure = {
  row: DailyOrderUpsertRow;
  error: string;
};

export type ReplaceMonthDataMeta = {
  sourceType?: 'manual' | 'excel' | 'api';
  fileName?: string | null;
  targetAppId?: string | null;
};

export interface OrderFilter {
  employeeId?: string;
  appId?: string;
  /** عدة منصات — يُفضَّل على `appId` عند التمرير من الفلتر متعدد الاختيار */
  appIds?: string[];
  date?: string;
  monthYear?: string;
  search?: string;
  branch?: 'makkah' | 'jeddah';
}

type OrderBaseEmployee = {
  id: string;
  name: string;
  salary_type: string;
  status: string;
  sponsorship_status: string | null;
  probation_end_date: string | null;
  city?: string | null;
};

type ActiveApp = {
  id: string;
  name: string;
  name_en: string | null;
  logo_url?: string | null;
  work_type?: 'orders' | 'shift' | 'hybrid' | null;
};

type EmployeeAppRow = {
  employee_id: string;
  app_id: string;
};

const DAILY_ORDERS_UPSERT_CONFLICT = 'employee_id,app_id,date';

function safeUnknownText(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return 'خطأ غير معروف';
  }
}

function getBulkUpsertErrorMessage(error: unknown): string {
  if (
    error &&
    typeof error === 'object' &&
    'message' in error &&
    typeof (error as { message?: unknown }).message === 'string' &&
    (error as { message: string }).message.trim()
  ) {
    return (error as { message: string }).message;
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  const text = safeUnknownText(error).trim();
  return text || 'خطأ غير معروف';
}

function upsertDailyOrderRows(rows: DailyOrderUpsertRow[]) {
  return supabase.from('daily_orders').upsert(rows, { onConflict: DAILY_ORDERS_UPSERT_CONFLICT });
}

function getMonthDateRange(monthYear: string) {
  const [year, month] = monthYear.split('-');
  const from = `${year}-${month}-01`;
  const lastDay = new Date(Number(year), Number(month), 0).getDate();
  const to = `${year}-${month}-${String(lastDay).padStart(2, '0')}`;
  return { from, to };
}

function isMissingReplaceMonthRpc(error: unknown): boolean {
  const message =
    error &&
    typeof error === 'object' &&
    'message' in error &&
    typeof (error as { message?: unknown }).message === 'string'
      ? (error as { message: string }).message
      : '';

  return (
    message.includes('replace_daily_orders_month_rpc')
    && message.includes('Could not find the function')
  );
}

export const orderService = {
  getMonthlyOrders: async (monthStart: string, monthEnd: string) => {
    type Row = { employee_id: string; orders_count: number };
    return await fetchAllPages<Row>(async (offset, limit) => {
      const { data, error } = await supabase
        .from('daily_orders')
        .select('employee_id, orders_count')
        .gte('date', monthStart)
        .lte('date', monthEnd)
        .order('date')
        .order('employee_id')
        .range(offset, offset + limit - 1);
      
      return { data, error };
    });
  },

  getAll: async () => {
    const { data, error } = await supabase
      .from('daily_orders')
      .select('id, date, employee_id, app_id, platform_account_id, orders_count, notes')
      .order('date', { ascending: false })
      .limit(1000);
    if (error) throw toServiceError(error, 'orderService.getAll');
    return data ?? [];
  },

  getOrdersByEmployeeMonth: async (employeeId: string, monthYear: string) => {
    const [year, month] = monthYear.split('-');
    const from = `${year}-${month}-01`;
    const lastDay = new Date(Number(year), Number(month), 0).getDate();
    const to = `${year}-${month}-${String(lastDay).padStart(2, '0')}`;

    const { data, error } = await supabase
      .from('daily_orders')
      .select('id, employee_id, date, app_id, platform_account_id, orders_count, notes, created_at, updated_at')
      .eq('employee_id', employeeId)
      .gte('date', from)
      .lte('date', to)
      .order('date', { ascending: true });

    if (error) throw toServiceError(error, 'orderService.getOrdersByEmployeeMonth');
    return data ?? [];
  },

  getSalaryContextOrdersByMonth: async (monthYear: string) => {
    const [year, month] = monthYear.split('-');
    const from = `${year}-${month}-01`;
    const lastDay = new Date(Number(year), Number(month), 0).getDate();
    const to = `${year}-${month}-${String(lastDay).padStart(2, '0')}`;
    // FIX: paginate to bypass Supabase's default 1000-row limit.
    // A month can have 50 employees × 3 apps × 30 days = ~4500 rows.
    const PAGE_SIZE = 1000;
    type OrderSalaryContextRow = {
      employee_id: string;
      app_id: string;
      orders_count: number;
      apps: { name: string; id: string } | null;
    };
    const allRows: OrderSalaryContextRow[] = [];
    let offset = 0;
    let hasMore = true;
    while (hasMore) {
      const { data, error } = await supabase
        .from('daily_orders')
        .select('employee_id, app_id, orders_count, apps(name, id)')
        .gte('date', from)
        .lte('date', to)
        .order('employee_id')
        .range(offset, offset + PAGE_SIZE - 1);
      if (error) throw toServiceError(error, 'orderService.getSalaryContextOrdersByMonth');
      const rows = (data ?? []) as OrderSalaryContextRow[];
      allRows.push(...rows);
      hasMore = rows.length === PAGE_SIZE;
      offset += PAGE_SIZE;
    }
    return allRows;
  },

  getByDate: async (date: string, filters: Pick<OrderFilter, 'employeeId' | 'appId'> = {}) => {
    let query = supabase
      .from('daily_orders')
      .select('*, employees(name, name_en), apps(name, name_en, brand_color)')
      .eq('date', date)
      .order('created_at', { ascending: false });

    if (filters.employeeId) query = query.eq('employee_id', filters.employeeId);
    if (filters.appId) query = query.eq('app_id', filters.appId);

    const { data, error } = await query;
    if (error) throw toServiceError(error, 'orderService.getByDate');
    return data ?? [];
  },

  getByMonth: async (monthYear: string, filters: Pick<OrderFilter, 'employeeId' | 'appId'> = {}) => {
    const [year, month] = monthYear.split('-');
    const from = `${year}-${month}-01`;
    const lastDay = new Date(Number(year), Number(month), 0).getDate();
    const to = `${year}-${month}-${String(lastDay).padStart(2, '0')}`;

    let query = supabase
      .from('daily_orders')
      .select('*, employees(name, name_en), apps(name, name_en, brand_color)')
      .gte('date', from)
      .lte('date', to)
      .order('date', { ascending: false });

    if (filters.employeeId) query = query.eq('employee_id', filters.employeeId);
    if (filters.appId) query = query.eq('app_id', filters.appId);

    const { data, error } = await query;
    if (error) throw toServiceError(error, 'orderService.getByMonth');
    return data ?? [];
  },

  /**
   * Server-side list for large volumes (pagination + filters).
   * Notes:
   * - Branch filter is derived from employees.city (makkah/jeddah).
   * - Search applies to employee name (fallback) and can be extended later (order number if you add it).
   */
  getMonthPaged: async (params: {
    monthYear: string;
    page: number; // 1-based
    pageSize: number;
    filters?: Pick<OrderFilter, 'employeeId' | 'appId' | 'appIds' | 'search' | 'branch'>;
  }) => {
    const { monthYear, page, pageSize } = params;
    const filters = params.filters ?? {};
    const [year, month] = monthYear.split('-');
    const from = `${year}-${month}-01`;
    const lastDay = new Date(Number(year), Number(month), 0).getDate();
    const to = `${year}-${month}-${String(lastDay).padStart(2, '0')}`;

    const fromIdx = (page - 1) * pageSize;
    const toIdx = fromIdx + pageSize - 1;

    let query = supabase
      .from('daily_orders')
      .select('employee_id, app_id, date, orders_count, employees(id, name, city), apps(id, name)', { count: 'exact' })
      .gte('date', from)
      .lte('date', to)
      .order('date', { ascending: false })
      .range(fromIdx, toIdx);

    if (filters.employeeId) query = query.eq('employee_id', filters.employeeId);
    if (filters.appIds && filters.appIds.length > 0) {
      query = query.in('app_id', filters.appIds);
    } else if (filters.appId) {
      query = query.eq('app_id', filters.appId);
    }
    if (filters.branch) query = query.eq('employees.city', filters.branch);
    if (filters.search?.trim()) {
      const sq = sanitizeLikeQuery(filters.search.trim());
      query = query.ilike('employees.name', `%${sq}%`);
    }

    const { data, error, count } = await query;
    if (error) throw toServiceError(error, 'orderService.getMonthPaged');
    return createPagedResult({
      rows: (data || []),
      total: count,
      page,
      pageSize,
    });
  },

  upsert: async (employeeId: string, date: string, appId: string, ordersCount: number) => {
    const { data, error } = await supabase
      .from('daily_orders')
      .upsert(
        { employee_id: employeeId, date, app_id: appId, orders_count: ordersCount },
        { onConflict: 'employee_id,date,app_id' }
      )
      .select()
      .single();
    if (error) throw toServiceError(error, 'orderService.upsert');
    return data;
  },

  delete: async (id: string) => {
    const { error } = await supabase.from('daily_orders').delete().eq('id', id);
    if (error) throw toServiceError(error, 'orderService.delete');
  },

  deleteDailyOrders: async (keys: { employeeId: string; appId: string; date: string }[]) => {
    const CHUNK_SIZE = 20;
    for (let i = 0; i < keys.length; i += CHUNK_SIZE) {
      const chunk = keys.slice(i, i + CHUNK_SIZE);
      await Promise.all(
        chunk.map(async (k) => {
          const { error } = await supabase
            .from('daily_orders')
            .delete()
            .eq('employee_id', k.employeeId)
            .eq('app_id', k.appId)
            .eq('date', k.date);
          if (error) {
            throw toServiceError(error, 'orderService.deleteDailyOrders');
          }
        })
      );
    }
  },

  getTotalByEmployee: async (employeeId: string, monthYear: string) => {
    const [year, month] = monthYear.split('-');
    const from = `${year}-${month}-01`;
    const lastDay = new Date(Number(year), Number(month), 0).getDate();
    const to = `${year}-${month}-${String(lastDay).padStart(2, '0')}`;

    const { data, error } = await supabase
      .from('daily_orders')
      .select('orders_count')
      .eq('employee_id', employeeId)
      .gte('date', from)
      .lte('date', to);
    if (error) throw toServiceError(error, 'orderService.getTotalByEmployee');

    return data?.reduce((sum, row) => sum + (row.orders_count ?? 0), 0) ?? 0;
  },

  getAppTargets: async (monthYear: string) => {
    const { data, error } = await supabase
      .from('app_targets')
      .select('*, apps(name, name_en, brand_color)')
      .eq('month_year', monthYear);
    if (error) throw toServiceError(error, 'orderService.getAppTargets');
    return data ?? [];
  },

  getMonthTargets: async (monthYear: string) => {
    return orderService.getAppTargets(monthYear);
  },

  upsertAppTarget: async (appId: string, monthYear: string, targetOrders: number, employeeTargetOrders: number | null = null) => {
    const { data, error } = await supabase
      .from('app_targets')
      .upsert(
        { app_id: appId, month_year: monthYear, target_orders: targetOrders, employee_target_orders: employeeTargetOrders },
        { onConflict: 'app_id,month_year' }
      )
      .select()
      .single();
    if (error) throw toServiceError(error, 'orderService.upsertAppTarget');
    return data;
  },

  getMonthRaw: async (year: number, month: number) => {
    const from = `${year}-${String(month).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const to = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    // Fetch ALL rows — Supabase default limit is 1000 which truncates large months.
    // 50 employees × 3 apps × 30 days = 4,500 rows possible.
    const allRows: { employee_id: string; app_id: string; date: string; orders_count: number }[] = [];
    const PAGE_SIZE = 1000;
    let offset = 0;
    let hasMore = true;
    while (hasMore) {
      const { data, error } = await supabase
        .from('daily_orders')
        .select('employee_id, app_id, date, orders_count')
        .gte('date', from)
        .lte('date', to)
        .range(offset, offset + PAGE_SIZE - 1);
      if (error) throw toServiceError(error, 'orderService.getMonthRaw');
      allRows.push(...(data ?? []));
      hasMore = (data?.length ?? 0) === PAGE_SIZE;
      offset += PAGE_SIZE;
    }
    return allRows;
  },

  replaceMonthData: async (
    monthYear: string,
    rows: DailyOrderUpsertRow[],
    chunkSize = 200,
    meta: ReplaceMonthDataMeta = {},
  ) => {
    try {
      const { data, error } = await supabase.rpc('replace_daily_orders_month_rpc', {
        p_month_year: monthYear,
        p_rows: rows,
        p_source_type: meta.sourceType ?? 'manual',
        p_file_name: meta.fileName ?? null,
        p_target_app_id: meta.targetAppId ?? null,
      });

      if (error) {
        if (!isMissingReplaceMonthRpc(error)) {
          throw toServiceError(error, 'orderService.replaceMonthData.rpc');
        }
      } else {
        const resultRow = Array.isArray(data) ? data[0] : data;
        return {
          saved: Number(resultRow?.saved_rows ?? rows.length),
          failed: [] as BulkUpsertFailure[],
          batchId: typeof resultRow?.batch_id === 'string' ? resultRow.batch_id : null,
        };
      }
    } catch (error) {
      if (!isMissingReplaceMonthRpc(error)) {
        throw error;
      }
    }

    const { from, to } = getMonthDateRange(monthYear);
    const { error: deleteError } = await supabase
      .from('daily_orders')
      .delete()
      .gte('date', from)
      .lte('date', to);

    if (deleteError) {
      throw toServiceError(deleteError, 'orderService.replaceMonthData.deleteMonthRange');
    }

    if (rows.length === 0) {
      return { saved: 0, failed: [] as BulkUpsertFailure[], batchId: null };
    }

    const fallbackResult = await orderService.bulkUpsert(rows, chunkSize);
    return { ...fallbackResult, batchId: null };
  },

  bulkUpsert: async (rows: DailyOrderUpsertRow[], chunkSize = 200) => {
    let saved = 0;
    const failed: BulkUpsertFailure[] = [];

    const saveChunkRowByRow = async (chunk: DailyOrderUpsertRow[]) => {
      for (const row of chunk) {
        try {
          const { error } = await upsertDailyOrderRows([row]);
          if (error) {
            failed.push({ row, error: getBulkUpsertErrorMessage(error) });
          } else {
            saved += 1;
          }
        } catch (error) {
          failed.push({ row, error: getBulkUpsertErrorMessage(error) });
        }
      }
    };
    
    for (let i = 0; i < rows.length; i += chunkSize) {
      const chunk = rows.slice(i, i + chunkSize);
      try {
        const { error } = await upsertDailyOrderRows(chunk);
        
        if (error) {

          if (chunk.length === 1) {
            failed.push({ row: chunk[0], error: getBulkUpsertErrorMessage(error) });
          } else {
            await saveChunkRowByRow(chunk);
          }
        } else {
          saved += chunk.length;
        }
      } catch (error) {
        if (chunk.length === 1) {
          failed.push({ row: chunk[0], error: getBulkUpsertErrorMessage(error) });
        } else {
          await saveChunkRowByRow(chunk);
        }
      }
    }
    
    return { saved, failed };
  },

  getBaseEmployees: async () => {
    const PAGE_SIZE = 1000;
    const allRows: OrderBaseEmployee[] = [];
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await supabase
        .from('employees')
        .select('id, name, city, salary_type, status, sponsorship_status, probation_end_date')
        .order('name')
        .range(offset, offset + PAGE_SIZE - 1);
        
      if (error) throw toServiceError(error, 'orderService.getBaseEmployees');
      
      const rows = data ?? [];
      allRows.push(...rows);
      
      if (rows.length < PAGE_SIZE) hasMore = false;
      else offset += PAGE_SIZE;
    }
    
    return allRows;
  },

  getActiveApps: async () => {
    const { data, error } = await supabase
      .from('apps')
      .select('id, name, name_en, logo_url, work_type')
      .eq('is_active', true)
      .order('name');
    if (error) throw toServiceError(error, 'orderService.getActiveApps');
    return (data || []) as ActiveApp[];
  },

  getEmployeeAppAssignments: async () => {
    const { data, error } = await supabase
      .from('employee_apps')
      .select('employee_id, app_id');
    if (error) throw toServiceError(error, 'orderService.getEmployeeAppAssignments');
    return (data || []) as EmployeeAppRow[];
  },

  getMonthLockStatus: async (month_year: string) => {
    const { data, error } = await supabase
      .from('locked_months')
      .select('month_year')
      .eq('month_year', month_year)
      .maybeSingle();
    if (error) throw toServiceError(error, 'orderService.getMonthLockStatus');
    return { locked: !!data };
  },

  lockMonth: async (month_year: string) => {
    const user = await authService.getCurrentUser();
    const userId = user?.id ?? null;
    const { error } = await supabase.from('locked_months').upsert(
      { month_year, locked_at: new Date().toISOString(), locked_by: userId },
      { onConflict: 'month_year' }
    );
    if (error) throw toServiceError(error, 'orderService.lockMonth');
  },

  unlockMonth: async (month_year: string) => {
    const { error } = await supabase.from('locked_months').delete().eq('month_year', month_year);
    if (error) throw toServiceError(error, 'orderService.unlockMonth');
  },
};
