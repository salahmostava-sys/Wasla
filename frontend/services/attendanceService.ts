import { supabase } from '@services/supabase/client';
import { handleSupabaseError } from '@services/serviceError';
import { filterEmployeesForAttendanceMonth, filterOperationallyVisibleEmployees } from '@shared/lib/employeeVisibility';

const attendanceService = {
  getDailyAttendanceBase: async () => {
    const PAGE_SIZE = 1000;
    const allEmployees: any[] = [];
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await supabase
        .from('employees')
        .select('id, name, salary_type, job_title, sponsorship_status, probation_end_date, status')
        .order('name')
        .range(offset, offset + PAGE_SIZE - 1);

      if (error) {
        // Fallback fields on error
        const fallbackRes = await supabase
          .from('employees')
          .select('id, name, sponsorship_status, probation_end_date, status')
          .order('name')
          .range(offset, offset + PAGE_SIZE - 1);
        if (fallbackRes.error) handleSupabaseError(fallbackRes.error, 'attendanceService.getDailyAttendanceBase.employeesFallback');
        const rows = fallbackRes.data ?? [];
        allEmployees.push(...rows);
        if (rows.length < PAGE_SIZE) hasMore = false;
        else offset += PAGE_SIZE;
      } else {
        const rows = data ?? [];
        allEmployees.push(...rows);
        if (rows.length < PAGE_SIZE) hasMore = false;
        else offset += PAGE_SIZE;
      }
    }

    const appsRes = await supabase
      .from('apps')
      .select('id, name, logo_url')
      .eq('is_active', true)
      .order('name');

    const allEmployeeApps: any[] = [];
    let appLinksOffset = 0;
    let hasMoreLinks = true;
    while (hasMoreLinks) {
      const { data, error } = await supabase
        .from('employee_apps')
        .select('employee_id, app_id')
        .range(appLinksOffset, appLinksOffset + PAGE_SIZE - 1);
      
      if (error) handleSupabaseError(error, 'attendanceService.getDailyAttendanceBase.employeeApps');
      const rows = data ?? [];
      allEmployeeApps.push(...rows);
      if (rows.length < PAGE_SIZE) hasMoreLinks = false;
      else appLinksOffset += PAGE_SIZE;
    }

    let employeeRows = allEmployees;

    if (appsRes.error) handleSupabaseError(appsRes.error, 'attendanceService.getDailyAttendanceBase.apps');

    return {
      employees: employeeRows,
      apps: appsRes.data ?? [],
      employeeApps: allEmployeeApps,
    };
  },

  getDailyAttendanceRecords: async (date: string) => {
    const { data, error } = await supabase
      .from('attendance')
      .select('id, employee_id, date, status, check_in, check_out, note')
      .eq('date', date);

    if (error) handleSupabaseError(error, 'attendanceService.getDailyAttendanceRecords');
    return data ?? [];
  },

  checkIn: async (employeeId: string, checkinAt?: string) => {
    const { data, error } = await supabase.rpc('check_in' as never, {
      p_employee_id: employeeId,
      p_checkin_at: checkinAt ?? new Date().toISOString(),
    } as never);
    if (error) handleSupabaseError(error, 'attendanceService.checkIn');
    return data;
  },

  checkOut: async (employeeId: string, checkoutAt?: string) => {
    const { data, error } = await supabase.rpc('check_out' as never, {
      p_employee_id: employeeId,
      p_checkout_at: checkoutAt ?? new Date().toISOString(),
    } as never);
    if (error) handleSupabaseError(error, 'attendanceService.checkOut');
    return data;
  },

  getAttendanceStatusRange: async (from: string, to: string) => {
    const { data, error } = await supabase
      .from('attendance')
      .select('date, status')
      .gte('date', from)
      .lte('date', to);
    if (error) handleSupabaseError(error, 'attendanceService.getAttendanceStatusRange');
    return data ?? [];
  },

  getActiveEmployeesCount: async () => {
    const { data, error } = await supabase
      .from('employees')
      .select('id, sponsorship_status, probation_end_date')
      .eq('status', 'active');
    if (error) handleSupabaseError(error, 'attendanceService.getActiveEmployeesCount');
    return filterOperationallyVisibleEmployees(data ?? []).length;
  },

  upsertDailyAttendance: async (payload: {
    employee_id: string;
    date: string;
    status: 'present' | 'absent' | 'leave' | 'sick' | 'late';
    check_in: string | null;
    check_out: string | null;
    note: string | null;
  }) => {
    // Keep compatibility with existing grid editor flow.
    // For explicit check-in/out actions, prefer attendanceService.checkIn/checkOut RPCs.
    const { error } = await supabase.from('attendance').upsert([payload], {
      onConflict: 'employee_id,date',
    });
    if (error) handleSupabaseError(error, 'attendanceService.upsertDailyAttendance');
  },

  getMonthlyEmployeesAndAttendance: async (startDate: string, endDate: string) => {
    const [employeesRes, attendanceRes] = await Promise.all([
      supabase
        .from('employees')
        .select('id, name, national_id, salary_type, base_salary, sponsorship_status, probation_end_date')
        .eq('status', 'active')
        .order('name'),
      supabase
        .from('attendance')
        .select('employee_id, status, note, date, check_in, check_out')
        .gte('date', startDate)
        .lte('date', endDate),
    ]);
    if (employeesRes.error) handleSupabaseError(employeesRes.error, 'attendanceService.getMonthlyEmployeesAndAttendance.employees');
    if (attendanceRes.error) handleSupabaseError(attendanceRes.error, 'attendanceService.getMonthlyEmployeesAndAttendance.attendance');
    return {
      employees: filterEmployeesForAttendanceMonth(employeesRes.data ?? [], startDate),
      attendanceRows: attendanceRes.data ?? [],
    };
  },

  getAttendanceByMonth: async (monthYear: string) => {
    // Validate monthYear format
    if (!/^\d{4}-\d{2}$/.test(monthYear)) {
      throw new Error('Invalid monthYear format. Expected YYYY-MM');
    }
    
    const [year, month] = monthYear.split('-');
    const from = `${year}-${month}-01`;
    const to = new Date(Number(year), Number(month), 0).toISOString().split('T')[0];

    const { data, error } = await supabase
      .from('attendance')
      .select('employee_id, status')
      .gte('date', from)
      .lte('date', to)
      .in('status', ['present', 'late']);

    if (error) handleSupabaseError(error, 'attendanceService.getAttendanceByMonth');
    return data ?? [];
  },

  getAttendanceByEmployeeMonth: async (employeeId: string, monthYear: string) => {
    // Validate inputs
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(employeeId)) {
      throw new Error('Invalid employeeId format');
    }
    if (!/^\d{4}-\d{2}$/.test(monthYear)) {
      throw new Error('Invalid monthYear format. Expected YYYY-MM');
    }
    
    const [year, month] = monthYear.split('-');
    const from = `${year}-${month}-01`;
    const to = new Date(Number(year), Number(month), 0).toISOString().split('T')[0];

    const { data, error } = await supabase
      .from('attendance')
      .select('id, employee_id, date, status, check_in, check_out, note')
      .eq('employee_id', employeeId)
      .gte('date', from)
      .lte('date', to)
      .order('date', { ascending: true });

    if (error) handleSupabaseError(error, 'attendanceService.getAttendanceByEmployeeMonth');
    return data ?? [];
  },
  /** Fetch custom attendance status configs (e.g. إجازة خاصة). */
  getStatusConfigs: async () => {
    const { data, error } = await supabase
      .from('attendance_status_configs')
      .select('id, name, color')
      .order('created_at');
    if (error) handleSupabaseError(error, 'attendanceService.getStatusConfigs');
    return (data ?? []) as Array<{ id: string; name: string; color: string }>;
  },

  /** Add a new custom attendance status. */
  addStatusConfig: async (name: string, color = '#6366f1') => {
    const { error } = await supabase
      .from('attendance_status_configs')
      .insert({ name, color });
    if (error) handleSupabaseError(error, 'attendanceService.addStatusConfig');
  },
};

export default attendanceService;
