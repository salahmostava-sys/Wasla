import { supabase } from '@services/supabase/client';
import { handleSupabaseError } from '@services/serviceError';
import { createPagedResult } from '@shared/types/pagination';
import { sanitizeLikeQuery } from '@shared/lib/security';
import { fetchAllPages } from '@shared/lib/supabaseUtils';
export interface MileageDailyPayload {
  employee_id: string;
  date: string;
  km_total: number;
  fuel_cost: number;
  notes: string | null;
}

export interface MileageMonthlyPayload {
  employee_id: string;
  month_year: string;
  km_total: number;
  fuel_cost: number;
  notes: string | null;
}

export const fuelService = {
  getMonthlyDailyMileage: async (monthStart: string, monthEnd: string) => {
    type Row = { employee_id: string; km_total: number; fuel_cost: number; employees: { name: string; personal_photo_url: string | null } | null };
    return await fetchAllPages<Row>(async (offset, limit) => {
      const { data, error } = await supabase
        .from('vehicle_mileage_daily')
        .select('employee_id, km_total, fuel_cost, employees(name, personal_photo_url)')
        .gte('date', monthStart)
        .lte('date', monthEnd)
        .order('date')
        .order('employee_id')
        .range(offset, offset + limit - 1);
      if (error) handleSupabaseError(error, 'fuelService.getMonthlyDailyMileage');
      return { data, error };
    });
  },

  getMonthlyFuelByMonthYear: async (monthYear: string) => {
    type Row = { employee_id: string; fuel_cost: number };
    return await fetchAllPages<Row>(async (offset, limit) => {
      const { data, error } = await supabase
        .from('vehicle_mileage')
        .select('employee_id, fuel_cost')
        .eq('month_year', monthYear)
        .order('employee_id')
        .range(offset, offset + limit - 1);
      if (error) handleSupabaseError(error, 'fuelService.getMonthlyFuelByMonthYear');
      return { data, error };
    });
  },

  getActiveVehicleAssignments: async () => {
    type Row = { employee_id: string; vehicles: { plate_number: string; type: string; brand: string; model: string } | null };
    return await fetchAllPages<Row>(async (offset, limit) => {
      const { data, error } = await supabase
        .from('vehicle_assignments')
        .select('employee_id, vehicles(plate_number, type, brand, model)')
        .is('end_date', null)
        .order('start_date', { ascending: false })
        .order('employee_id')
        .range(offset, offset + limit - 1);
      if (error) handleSupabaseError(error, 'fuelService.getActiveVehicleAssignments');
      return { data, error };
    });
  },

  getDailyMileageByMonth: async (monthStart: string, monthEnd: string) => {
    // select * returns many fields, using Record<string, unknown> as a base to avoid any
    return await fetchAllPages<Record<string, unknown>>(async (offset, limit) => {
      const { data, error } = await supabase
        .from('vehicle_mileage_daily')
        .select('*, employees(name, personal_photo_url)')
        .gte('date', monthStart)
        .lte('date', monthEnd)
        .order('date')
        .order('employee_id')
        .range(offset, offset + limit - 1);
        
      if (error) handleSupabaseError(error, 'fuelService.getDailyMileageByMonth');
      return { data, error };
    });
  },

  /**
   * Server-side daily mileage list (pagination + filters) for a month.
   * Notes:
   * - Branch filter is derived from employees.city (makkah/jeddah).
   */
  getDailyMileagePaged: async (params: {
    monthStart: string;
    monthEnd: string;
    page: number; // 1-based
    pageSize: number;
    filters?: {
      employeeId?: string;
      branch?: 'makkah' | 'jeddah';
      search?: string; // employee name
    };
  }) => {
    // Validate date formats
    if (!/^\d{4}-\d{2}-\d{2}$/.test(params.monthStart) || !/^\d{4}-\d{2}-\d{2}$/.test(params.monthEnd)) {
      throw new Error('Invalid date format. Expected YYYY-MM-DD');
    }
    
    const { monthStart, monthEnd, page, pageSize } = params;
    const filters = params.filters ?? {};

    const fromIdx = (page - 1) * pageSize;
    const toIdx = fromIdx + pageSize - 1;

    let query = supabase
      .from('vehicle_mileage_daily')
      .select('id, employee_id, date, km_total, fuel_cost, notes, employees(id, name, city)', { count: 'exact' })
      .gte('date', monthStart)
      .lte('date', monthEnd)
      .order('date', { ascending: false })
      .range(fromIdx, toIdx);

    if (filters.employeeId) query = query.eq('employee_id', filters.employeeId);
    if (filters.branch) query = query.eq('employees.city', filters.branch);
    if (filters.search?.trim()) {
      const sq = sanitizeLikeQuery(filters.search.trim());
      query = query.ilike('employees.name', `%${sq}%`);
    }

    const { data, error, count } = await query;
    if (error) handleSupabaseError(error, 'fuelService.getDailyMileagePaged');
    return createPagedResult({
      rows: data,
      total: count,
      page,
      pageSize,
    });
  },

  /** Export helper for large daily mileage datasets (chunked). */
  exportDailyMileage: async (params: {
    monthStart: string;
    monthEnd: string;
    filters?: {
      employeeId?: string;
      branch?: 'makkah' | 'jeddah';
      search?: string;
    };
    chunkSize?: number;
    maxRows?: number;
  }) => {
    const { monthStart, monthEnd } = params;
    const filters = params.filters ?? {};
    const chunkSize = params.chunkSize ?? 1000;
    const maxRows = params.maxRows ?? 5_000;

    const all: unknown[] = [];
    for (let page = 1; page <= Math.ceil(maxRows / chunkSize); page++) {
      const res = await fuelService.getDailyMileagePaged({
        monthStart,
        monthEnd,
        page,
        pageSize: chunkSize,
        filters,
      });
      all.push(...res.rows);
      if (res.rows.length < chunkSize) break;
    }
    return all;
  },

  upsertDailyMileage: async (payload: MileageDailyPayload, editId?: string) => {
    // Validate payload
    if (!payload.employee_id || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(payload.employee_id)) {
      throw new Error('Invalid employee_id');
    }
    if (!payload.date || !/^\d{4}-\d{2}-\d{2}$/.test(payload.date)) {
      throw new Error('Invalid date format. Expected YYYY-MM-DD');
    }
    if (typeof payload.km_total !== 'number' || payload.km_total < 0) {
      throw new Error('Invalid km_total');
    }
    if (typeof payload.fuel_cost !== 'number' || payload.fuel_cost < 0) {
      throw new Error('Invalid fuel_cost');
    }
    
    if (editId) {
      const { error } = await supabase
        .from('vehicle_mileage_daily')
        .update(payload)
        .eq('id', editId);
      if (error) handleSupabaseError(error, 'fuelService.upsertDailyMileage.update');
      return;
    }
    const { error } = await supabase
      .from('vehicle_mileage_daily')
      .upsert(payload, { onConflict: 'employee_id,date' });
    if (error) handleSupabaseError(error, 'fuelService.upsertDailyMileage.upsert');
  },

  deleteDailyMileage: async (id: string) => {
    const { error } = await supabase
      .from('vehicle_mileage_daily')
      .delete()
      .eq('id', id);
    if (error) handleSupabaseError(error, 'fuelService.deleteDailyMileage');
  },

  /**
   * Bulk-upsert daily mileage rows (used by the fuel-only / km-only spreadsheet
   * import). Falls back to row-by-row saving when a chunk fails so a single bad
   * row doesn't block the rest of the batch.
   */
  bulkUpsertDailyMileage: async (rows: MileageDailyPayload[], chunkSize = 200) => {
    let saved = 0;
    const failed: { row: MileageDailyPayload; error: string }[] = [];

    const saveRowByRow = async (chunk: MileageDailyPayload[]) => {
      for (const row of chunk) {
        try {
          await fuelService.upsertDailyMileage(row);
          saved += 1;
        } catch (error) {
          failed.push({ row, error: error instanceof Error ? error.message : 'خطأ غير معروف' });
        }
      }
    };

    for (let i = 0; i < rows.length; i += chunkSize) {
      const chunk = rows.slice(i, i + chunkSize);
      try {
        const { error } = await supabase
          .from('vehicle_mileage_daily')
          .upsert(chunk, { onConflict: 'employee_id,date' });
        if (error) {
          await saveRowByRow(chunk);
        } else {
          saved += chunk.length;
        }
      } catch {
        await saveRowByRow(chunk);
      }
    }

    return { saved, failed };
  },

  saveMonthlyMileageImport: async (rows: MileageMonthlyPayload[], replaceExisting: boolean) => {
    if (replaceExisting) {
      const { error } = await supabase
        .from('vehicle_mileage')
        .upsert(rows, { onConflict: 'employee_id,month_year' });
      if (error) handleSupabaseError(error, 'fuelService.saveMonthlyMileageImport.upsert');
      return;
    }
    const { error } = await supabase
      .from('vehicle_mileage')
      .upsert(rows as never, { onConflict: 'employee_id,month_year', ignoreDuplicates: true });
    if (error) handleSupabaseError(error, 'fuelService.saveMonthlyMileageImport.insert');
  },
};


