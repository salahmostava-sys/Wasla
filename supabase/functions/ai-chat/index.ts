import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { getCorsHeaders, handleCorsPreflight } from '../_shared/cors.ts';

const SYSTEM_PROMPT = `
أنت مساعد إداري ذكي لنظام "مهمات التوصيل" اللوجستي.
لا تؤلف أي أرقام أو بيانات من عندك أبداً.
استخدم الأدوات المتاحة للإجابة على أسئلة المستخدم 
بناءً على البيانات الحقيقية من النظام.
أجب دائماً باللغة العربية بشكل دقيق ومختصر.
إذا لم تجد البيانات المطلوبة في الأدوات المتاحة، قل ذلك صراحةً.
`.trim();

const tools = [
  {
    type: 'function',
    function: {
      name: 'get_employee_stats',
      description: 'إحصائيات المناديب — العدد الإجمالي وتوزيعهم حسب الحالة',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_vehicle_status',
      description: 'حالة المركبات — كم مركبة نشطة وغير معينة',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_orders_summary',
      description: 'ملخص الطلبات لليوم أو الشهر الحالي',
      parameters: {
        type: 'object',
        properties: {
          period: {
            type: 'string',
            enum: ['today', 'this_month'],
            description: 'الفترة الزمنية',
          },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_salary_summary',
      description: 'ملخص الرواتب للشهر الحالي',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_advances_summary',
      description: 'ملخص السلف النشطة',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_top_riders',
      description: 'أكثر المناديب تنفيذاً للطلبات هذا الشهر — يرجع أفضل 10 مع عدد الطلبات لكل واحد',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_attendance_summary',
      description: 'ملخص الحضور والغياب لليوم أو الشهر الحالي',
      parameters: {
        type: 'object',
        properties: {
          period: { type: 'string', enum: ['today', 'this_month'], description: 'الفترة' },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_alerts_summary',
      description: 'ملخص التنبيهات النشطة — إقامات منتهية، تأمين، رخص',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_employee_details',
      description: 'تفاصيل موظف معين بالاسم — البيانات الشخصية والحالة والمدينة والسجل التجاري',
      parameters: {
        type: 'object',
        properties: { name: { type: 'string', description: 'اسم الموظف أو جزء منه' } },
        required: ['name'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_platform_accounts',
      description: 'حسابات المنصات — كم حساب نشط على كل منصة',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_fuel_summary',
      description: 'ملخص استهلاك الوقود للشهر الحالي',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_maintenance_summary',
      description: 'ملخص الصيانة — عدد طلبات الصيانة وتكاليفها',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_rider_orders_breakdown',
      description: 'تفصيل طلبات مندوب معين هذا الشهر حسب المنصة واليوم',
      parameters: {
        type: 'object',
        properties: { name: { type: 'string', description: 'اسم المندوب' } },
        required: ['name'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_bottom_riders',
      description: 'أضعف 10 مناديب أداءً هذا الشهر — الأقل طلبات',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_apps_overview',
      description: 'نظرة عامة على المنصات — أسماؤها وأنواعها وعدد الموظفين والطلبات لكل منصة',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_rider_monthly_average',
      description: 'حساب متوسط الطلبات الشهري لمندوب معين خلال آخر 3 أشهر + التوقع للشهر الحالي',
      parameters: {
        type: 'object',
        properties: { name: { type: 'string', description: 'اسم المندوب' } },
        required: ['name'],
      },
    },
  },
];

// ── Tool Implementations ──────────────────────────────────────

type DbClient = ReturnType<typeof createClient>;
type AppRole = 'admin' | 'hr' | 'finance' | 'operations' | 'viewer';

const TOOL_PERMISSIONS: Partial<Record<string, AppRole[]>> = {
  get_salary_summary: ['admin', 'finance'],
  get_advances_summary: ['admin', 'finance'],
  get_employee_details: ['admin', 'hr', 'finance'],
  get_rider_orders_breakdown: ['admin', 'hr', 'operations'],
  get_rider_monthly_average: ['admin', 'hr', 'operations'],
};

function canAccessTool(userRole: AppRole | null, toolName: string): boolean {
  const allowedRoles = TOOL_PERMISSIONS[toolName];
  if (!allowedRoles) return true;
  return !!userRole && allowedRoles.includes(userRole);
}

function toolAccessError(toolName: string) {
  if (toolName === 'get_salary_summary' || toolName === 'get_advances_summary') {
    return {
      error:
        'عذراً، بيانات الرواتب والسلف مقصورة على المدير والمحاسب فقط. إذا كنت تحتاج هذه البيانات، يرجى التواصل مع المدير.',
    };
  }

  return { error: 'لا تملك صلاحية الوصول إلى هذه البيانات.' };
}

function buildNameSearchPattern(name: string): string | null {
  const trimmed = name.trim();
  if (!trimmed) return null;
  return `%${trimmed.replaceAll('\\', '\\\\').replaceAll('%', String.raw`\%`).replaceAll('_', String.raw`\_`)}%`;
}

async function getEmployeeStats(sb: DbClient) {
  const { data, error } = await sb.from('employees').select('sponsorship_status, status');
  if (error) throw error;
  const rows = data ?? [];
  const bySponsorship: Record<string, number> = {};
  for (const r of rows) {
    const s = (r.sponsorship_status as string) ?? 'unknown';
    bySponsorship[s] = (bySponsorship[s] ?? 0) + 1;
  }
  /** مناديب/موظفون «نشطون» حسب حقل status في النظام */
  const active_count = rows.filter((r) => (r.status as string) === 'active').length;
  return {
    total: rows.length,
    by_sponsorship: bySponsorship,
    active_employees_count: active_count,
    note:
      'active_employees_count = عدد السجلات حيث status = active. أسئلة «كم مندوب نشط» تشير عادةً إلى هذا العدد.',
  };
}

async function getVehicleStatus(sb: DbClient) {
  const { data, error } = await sb.from('vehicles').select('status');
  if (error) throw error;
  const rows = data ?? [];
  const byStatus: Record<string, number> = {};
  for (const r of rows) {
    const s = (r.status as string) ?? 'unknown';
    byStatus[s] = (byStatus[s] ?? 0) + 1;
  }
  return { total: rows.length, by_status: byStatus };
}

async function getOrdersSummary(sb: DbClient, period: string = 'today') {
  const now = new Date();
  let from: string;
  let to: string;

  if (period === 'this_month') {
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    from = `${y}-${m}-01`;
    to = new Date(y, now.getMonth() + 1, 0).toISOString().split('T')[0];
  } else {
    from = now.toISOString().split('T')[0];
    to = from;
  }

  const { data, error } = await sb
    .from('daily_orders')
    .select('orders_count, apps(name)')
    .gte('date', from)
    .lte('date', to);
  if (error) throw error;

  const rows = data ?? [];
  let total = 0;
  const byPlatform: Record<string, number> = {};
  for (const r of rows) {
    const count = (r.orders_count as number) ?? 0;
    total += count;
    const appName = ((r.apps as { name?: string } | null)?.name) ?? 'أخرى';
    byPlatform[appName] = (byPlatform[appName] ?? 0) + count;
  }

  return {
    total,
    period: period === 'this_month' ? 'الشهر الحالي' : 'اليوم',
    date_range: `${from} → ${to}`,
    by_platform: byPlatform,
  };
}

async function getSalarySummary(sb: DbClient) {
  const now = new Date();
  const monthYear = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const { data, error } = await sb
    .from('salary_records')
    .select('is_approved, net_salary')
    .eq('month_year', monthYear);
  if (error) throw error;

  const rows = data ?? [];
  let paid = 0;
  let pending = 0;
  let totalAmount = 0;
  for (const r of rows) {
    const net = (r.net_salary as number) ?? 0;
    totalAmount += net;
    if (r.is_approved) paid++;
    else pending++;
  }

  return { month: monthYear, paid, pending, total_records: rows.length, total_amount: totalAmount };
}

async function getAdvancesSummary(sb: DbClient) {
  const { data, error } = await sb
    .from('advances')
    .select('id, amount')
    .eq('status', 'active');
  if (error) throw error;

  const rows = data ?? [];
  const totalAmount = rows.reduce((sum, r) => sum + ((r.amount as number) ?? 0), 0);
  return { count: rows.length, total_amount: totalAmount };
}

async function getTopRiders(sb: DbClient) {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const from = `${y}-${m}-01`;
  const to = new Date(y, now.getMonth() + 1, 0).toISOString().split('T')[0];

  const { data, error } = await sb
    .from('daily_orders')
    .select('employee_id, orders_count, employees(name)')
    .gte('date', from)
    .lte('date', to);
  if (error) throw error;

  const totals: Record<string, { name: string; total: number }> = {};
  for (const r of (data ?? [])) {
    const empId = r.employee_id as string;
    const name = ((r.employees as { name?: string } | null)?.name) ?? empId;
    const count = (r.orders_count as number) ?? 0;
    if (!totals[empId]) totals[empId] = { name, total: 0 };
    totals[empId].total += count;
  }

  const sorted = Object.values(totals).sort((a, b) => b.total - a.total).slice(0, 10);
  return {
    month: `${y}-${m}`,
    top_riders: sorted.map((r, i) => ({ rank: i + 1, name: r.name, orders: r.total })),
  };
}

async function getAttendanceSummary(sb: DbClient, period: string = 'today') {
  const now = new Date();
  let from: string;
  let to: string;

  if (period === 'this_month') {
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    from = `${y}-${m}-01`;
    to = new Date(y, now.getMonth() + 1, 0).toISOString().split('T')[0];
  } else {
    from = now.toISOString().split('T')[0];
    to = from;
  }

  const { data, error } = await sb
    .from('attendance')
    .select('status')
    .gte('date', from)
    .lte('date', to);
  if (error) throw error;

  const rows = data ?? [];
  const byStatus: Record<string, number> = {};
  for (const r of rows) {
    const s = (r.status as string) ?? 'unknown';
    byStatus[s] = (byStatus[s] ?? 0) + 1;
  }

  return { period: period === 'this_month' ? 'الشهر الحالي' : 'اليوم', total_records: rows.length, by_status: byStatus };
}

async function getAlertsSummary(sb: DbClient) {
  const now = new Date();
  const threshold = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

  const { data, error } = await sb
    .from('employees')
    .select('id, name, residency_expiry')
    .eq('status', 'active')
    .not('residency_expiry', 'is', null)
    .lte('residency_expiry', threshold);
  if (error) throw error;

  const expiring = (data ?? []).map((e) => ({
    name: e.name,
    expiry: e.residency_expiry,
    days_left: Math.round((new Date(e.residency_expiry as string).getTime() - now.getTime()) / 86400000),
  })).sort((a, b) => a.days_left - b.days_left);

  return {
    expiring_residencies: expiring.length,
    details: expiring.slice(0, 10),
  };
}

async function getEmployeeDetails(sb: DbClient, name: string, userRole: AppRole | null) {
  const canViewSalaryFields = userRole === 'admin' || userRole === 'finance';
  const namePattern = buildNameSearchPattern(name);
  if (!namePattern) return { found: false, message: 'يرجى تحديد اسم الموظف.' };
  const selectFields = [
    'id',
    'name',
    'national_id',
    'phone',
    'city',
    'cities',
    'status',
    'sponsorship_status',
    'job_title',
    'join_date',
    'residency_expiry',
    'commercial_record',
    'salary_type',
    ...(canViewSalaryFields ? ['base_salary'] : []),
  ].join(', ');

  const { data, error } = await sb
    .from('employees')
    .select(selectFields)
    .ilike('name', namePattern)
    .limit(5);
  if (error) throw error;
  if (!data || data.length === 0) return { found: false, message: `لم يُعثر على موظف باسم "${name}"` };
  return { found: true, employees: data };
}

async function getPlatformAccounts(sb: DbClient) {
  const { data, error } = await sb
    .from('platform_accounts')
    .select('status, app_id, apps(name)')
    .eq('status', 'active');
  if (error) throw error;
  const byApp: Record<string, number> = {};
  for (const r of (data ?? [])) {
    const appName = ((r.apps as { name?: string } | null)?.name) ?? 'أخرى';
    byApp[appName] = (byApp[appName] ?? 0) + 1;
  }
  return { total_active: (data ?? []).length, by_platform: byApp };
}

async function getFuelSummary(sb: DbClient) {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const from = `${y}-${m}-01`;
  const to = new Date(y, now.getMonth() + 1, 0).toISOString().split('T')[0];

  const { data, error } = await sb
    .from('fuel_records')
    .select('cost, liters')
    .gte('date', from)
    .lte('date', to);
  if (error) throw error;
  const rows = data ?? [];
  const totalCost = rows.reduce((s, r) => s + ((r.cost as number) ?? 0), 0);
  const totalLiters = rows.reduce((s, r) => s + ((r.liters as number) ?? 0), 0);
  return { month: `${y}-${m}`, records: rows.length, total_cost: totalCost, total_liters: totalLiters };
}

async function getMaintenanceSummary(sb: DbClient) {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const from = `${y}-${m}-01`;
  const to = new Date(y, now.getMonth() + 1, 0).toISOString().split('T')[0];

  const { data, error } = await sb
    .from('maintenance_logs')
    .select('cost, status, type')
    .gte('date', from)
    .lte('date', to);
  if (error) throw error;
  const rows = data ?? [];
  const totalCost = rows.reduce((s, r) => s + ((r.cost as number) ?? 0), 0);
  const byStatus: Record<string, number> = {};
  for (const r of rows) { const s = (r.status as string) ?? 'unknown'; byStatus[s] = (byStatus[s] ?? 0) + 1; }
  return { month: `${y}-${m}`, records: rows.length, total_cost: totalCost, by_status: byStatus };
}

async function getRiderOrdersBreakdown(sb: DbClient, name: string) {
  const namePattern = buildNameSearchPattern(name);
  if (!namePattern) return { found: false, message: 'يرجى تحديد اسم المندوب.' };
  const { data: emps } = await sb.from('employees').select('id, name').ilike('name', namePattern).limit(1);
  if (!emps || emps.length === 0) return { found: false, message: `لم يُعثر على مندوب باسم "${name}"` };
  const emp = emps[0];
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const from = `${y}-${m}-01`;
  const to = new Date(y, now.getMonth() + 1, 0).toISOString().split('T')[0];

  const { data, error } = await sb
    .from('daily_orders')
    .select('date, orders_count, apps(name)')
    .eq('employee_id', emp.id)
    .gte('date', from)
    .lte('date', to)
    .order('date');
  if (error) throw error;

  let total = 0;
  const byApp: Record<string, number> = {};
  const days: { date: string; app: string; orders: number }[] = [];
  for (const r of (data ?? [])) {
    const count = (r.orders_count as number) ?? 0;
    total += count;
    const appName = ((r.apps as { name?: string } | null)?.name) ?? 'أخرى';
    byApp[appName] = (byApp[appName] ?? 0) + count;
    days.push({ date: r.date as string, app: appName, orders: count });
  }
  return { found: true, employee: emp.name, month: `${y}-${m}`, total_orders: total, by_platform: byApp, daily: days.slice(-10) };
}

async function getBottomRiders(sb: DbClient) {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const from = `${y}-${m}-01`;
  const to = new Date(y, now.getMonth() + 1, 0).toISOString().split('T')[0];

  const { data } = await sb
    .from('daily_orders')
    .select('employee_id, orders_count, employees(name)')
    .gte('date', from)
    .lte('date', to);

  const totals: Record<string, { name: string; total: number }> = {};
  for (const r of (data ?? [])) {
    const empId = r.employee_id as string;
    const name = ((r.employees as { name?: string } | null)?.name) ?? empId;
    const count = (r.orders_count as number) ?? 0;
    if (!totals[empId]) totals[empId] = { name, total: 0 };
    totals[empId].total += count;
  }
  const sorted = Object.values(totals).sort((a, b) => a.total - b.total).slice(0, 10);
  return { month: `${y}-${m}`, bottom_riders: sorted.map((r, i) => ({ rank: i + 1, name: r.name, orders: r.total })) };
}

async function getAppsOverview(sb: DbClient) {
  const { data: apps } = await sb.from('apps').select('id, name, work_type, is_active').eq('is_active', true);
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const from = `${y}-${m}-01`;
  const to = new Date(y, now.getMonth() + 1, 0).toISOString().split('T')[0];

  const { data: empApps } = await sb.from('employee_apps').select('app_id');
  const { data: orders } = await sb.from('daily_orders').select('app_id, orders_count').gte('date', from).lte('date', to);

  const empCount: Record<string, number> = {};
  for (const r of (empApps ?? [])) { const id = r.app_id as string; empCount[id] = (empCount[id] ?? 0) + 1; }
  const orderCount: Record<string, number> = {};
  for (const r of (orders ?? [])) { const id = r.app_id as string; orderCount[id] = (orderCount[id] ?? 0) + ((r.orders_count as number) ?? 0); }

  return {
    apps: (apps ?? []).map((a) => ({
      name: a.name,
      work_type: a.work_type ?? 'orders',
      employees: empCount[a.id as string] ?? 0,
      orders_this_month: orderCount[a.id as string] ?? 0,
    })),
  };
}

async function getRiderMonthlyAverage(sb: DbClient, name: string) {
  name = name.trim();
  const namePattern = buildNameSearchPattern(name);
  if (!name) return { error: 'يرجى تحديد اسم المندوب' };
  if (!namePattern) return { error: 'فشل إنشاء نمط البحث للاسم' };
  const { data: emp } = await sb.from('employees').select('id, name').ilike('name', namePattern).limit(1).maybeSingle();
  if (!emp) return { error: `لم يتم العثور على مندوب باسم "${name}"` };

  const now = new Date();
  const months: { label: string; from: string; to: string }[] = [];
  for (let i = 0; i < 3; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const lastDay = new Date(y, d.getMonth() + 1, 0).getDate();
    months.push({
      label: `${y}-${m}`,
      from: `${y}-${m}-01`,
      to: `${y}-${m}-${String(lastDay).padStart(2, '0')}`,
    });
  }

  const monthlyData: { month: string; orders: number; days: number }[] = [];
  for (const mo of months) {
    const { data } = await sb
      .from('daily_orders')
      .select('orders_count')
      .eq('employee_id', emp.id)
      .gte('date', mo.from)
      .lte('date', mo.to);
    const total = (data ?? []).reduce((s, r) => s + ((r.orders_count as number) ?? 0), 0);
    const activeDays = (data ?? []).filter(r => ((r.orders_count as number) ?? 0) > 0).length;
    monthlyData.push({ month: mo.label, orders: total, days: activeDays });
  }

  const totalOrders = monthlyData.reduce((s, m) => s + m.orders, 0);
  const monthsWithData = monthlyData.filter(m => m.orders > 0).length;
  const avgMonthly = monthsWithData > 0 ? Math.round(totalOrders / monthsWithData) : 0;
  const avgDaily = monthsWithData > 0 ? Math.round(totalOrders / monthlyData.reduce((s, m) => s + m.days, 0)) : 0;

  // Predict current month based on average
  const currentMonth = monthlyData[0];
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const daysPassed = now.getDate();
  const projectedTotal = currentMonth.days > 0 
    ? Math.round((currentMonth.orders / daysPassed) * daysInMonth)
    : avgMonthly;

  return {
    employee: emp.name,
    monthly_breakdown: monthlyData,
    average_monthly: avgMonthly,
    average_daily: avgDaily,
    current_month_actual: currentMonth.orders,
    current_month_projected: projectedTotal,
    days_passed: daysPassed,
    days_in_month: daysInMonth,
  };
}

async function executeTool(
  sb: DbClient,
  userRole: AppRole | null,
  name: string,
  args: Record<string, unknown>,
) {
  // ── Sensitive tools gated by role ────────────────────────────────────
  const sensitiveTools = new Set([
    'get_salary_summary',
    'get_advances_summary',
    'get_employee_details',
    'get_rider_orders_breakdown',
    'get_rider_monthly_average',
  ]);
  if (sensitiveTools.has(name)) {
    if (!canAccessTool(userRole, name)) {
      return toolAccessError(name);
    }
  }

  // All tool implementations below receive the RLS-enforced client.
  // They CANNOT bypass RLS — the database enforces access based on the
  // authenticated user's row-level security policies.
  switch (name) {
    case 'get_employee_stats':
      return await getEmployeeStats(sb);
    case 'get_vehicle_status':
      return await getVehicleStatus(sb);
    case 'get_orders_summary':
      return await getOrdersSummary(sb, (args.period as string) ?? 'today');
    case 'get_salary_summary':
      return await getSalarySummary(sb);
    case 'get_advances_summary':
      return await getAdvancesSummary(sb);
    case 'get_top_riders':
      return await getTopRiders(sb);
    case 'get_attendance_summary':
      return await getAttendanceSummary(sb, (args.period as string) ?? 'today');
    case 'get_alerts_summary':
      return await getAlertsSummary(sb);
    case 'get_employee_details':
      return await getEmployeeDetails(sb, (args.name as string) ?? '', userRole);
    case 'get_platform_accounts':
      return await getPlatformAccounts(sb);
    case 'get_fuel_summary':
      return await getFuelSummary(sb);
    case 'get_maintenance_summary':
      return await getMaintenanceSummary(sb);
    case 'get_rider_orders_breakdown':
      return await getRiderOrdersBreakdown(sb, (args.name as string) ?? '');
    case 'get_bottom_riders':
      return await getBottomRiders(sb);
    case 'get_apps_overview':
      return await getAppsOverview(sb);
    case 'get_rider_monthly_average':
      return await getRiderMonthlyAverage(sb, (args.name as string) ?? '');
    default:
      return { error: `Unknown tool: ${name}` };
  }
}

// ── Groq chat completion via fetch ──────────────────────────

interface ChatMessage {
  role: string;
  content: string | null;
  tool_calls?: { id: string; type: string; function: { name: string; arguments: string } }[];
  tool_call_id?: string;
  name?: string;
}

async function groqChat(
  messages: ChatMessage[],
  apiKey: string,
  availableTools?: typeof tools,
): Promise<ChatMessage> {
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'openai/gpt-oss-120b',
      messages,
      ...(availableTools ? { tools: availableTools, tool_choice: 'auto' } : {}),
      temperature: 0.3,
      max_completion_tokens: 1024,
      reasoning_effort: 'medium',
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Groq API error ${res.status}: ${err}`);
  }

  const json = await res.json();
  return json.choices[0].message;
}

// ── Main handler ──────────────────────────────────────────────

async function getEnvConfig() {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const groqKey = Deno.env.get('GROQ_API_KEY');
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

  if (!supabaseUrl) throw new Error('SUPABASE_URL not configured');
  if (!groqKey) throw new Error('GROQ_API_KEY not configured');

  return { supabaseUrl, groqKey, supabaseAnonKey };
}

async function authorizeUser(req: Request, supabaseUrl: string, supabaseAnonKey: string) {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) throw new Error('Unauthorized');

  const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  
  const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
  if (authError || !user) throw new Error(`Auth Error: ${authError?.message}`);

  return { supabaseClient, user };
}

async function checkRateLimit(client: DbClient, userId: string) {
  const rateLimitKey = `ai-chat:${userId}`;
  const { data: rateRows, error: rateLimitError } = await client.rpc('enforce_rate_limit', {
    p_key: rateLimitKey, p_limit: 15, p_window_seconds: 60,
  } as Record<string, unknown>);

  if (rateLimitError) {
    console.error('Rate limit RPC failed:', rateLimitError);
  } else {
    const rate = Array.isArray(rateRows)
      ? (rateRows[0] as { allowed?: boolean; remaining?: number } | undefined)
      : undefined;
    if (rate && !rate.allowed) throw new Error('Too many requests. Please retry shortly.');
  }
}

async function processChatToolCalls(
  conversation: ChatMessage[],
  responseMessage: ChatMessage,
  supabaseClient: DbClient,
  userRole: AppRole | null,
  groqKey: string
) {
  conversation.push(responseMessage);

  for (const toolCall of responseMessage.tool_calls!) {
    let fnArgs: Record<string, unknown> = {};
    try {
      fnArgs = JSON.parse(toolCall.function.arguments || '{}');
    } catch {
      fnArgs = {};
    }

    let result: unknown = {};
    try {
      result = await executeTool(supabaseClient, userRole, toolCall.function.name, fnArgs);
    } catch (e) {
      result = { error: `Tool error: ${(e as Error).message}` };
    }

    conversation.push({ role: 'tool', tool_call_id: toolCall.id, content: JSON.stringify(result) });
  }

  return await groqChat(conversation, groqKey);
}

Deno.serve(async (req) => {
  const requestOrigin = req.headers.get('origin');
  if (req.method === 'OPTIONS') return handleCorsPreflight(requestOrigin);

  try {
    const { supabaseUrl, groqKey, supabaseAnonKey } = await getEnvConfig();
    const { supabaseClient, user } = await authorizeUser(req, supabaseUrl, supabaseAnonKey);

    await checkRateLimit(supabaseClient, user.id);

    let userRole: AppRole | null = null;
    try {
      const { data: role } = await supabaseClient.rpc('get_my_role');
      userRole = (role as AppRole) ?? null;
    } catch {}

    const { messages: clientMessages } = await req.json() as { messages: ChatMessage[] };
    if (!Array.isArray(clientMessages) || clientMessages.length === 0) {
      throw new Error('messages array required');
    }

    const conversation: ChatMessage[] = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...clientMessages.map((m) => ({ role: m.role, content: m.content })),
    ];

    const responseMessage = await groqChat(conversation, groqKey, tools);

    if (responseMessage.tool_calls && responseMessage.tool_calls.length > 0) {
      const finalResponseMessage = await processChatToolCalls(conversation, responseMessage, supabaseClient, userRole, groqKey);
      return new Response(JSON.stringify({ message: finalResponseMessage.content ?? '' }), { headers: { ...getCorsHeaders(requestOrigin), 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ message: responseMessage.content ?? '' }), { headers: { ...getCorsHeaders(requestOrigin), 'Content-Type': 'application/json' } });
  } catch (e) {
    console.error('[ai-chat] error:', e);
    const msg = (e as Error).message || 'Internal server error';
    let status = 500;
    if (msg.includes('Too many requests')) status = 429;
    else if (msg.includes('Unauthorized') || msg.includes('Auth Error')) status = 401;
    else if (msg.includes('messages array required')) status = 400;
    return new Response(JSON.stringify({ error: msg }), { status, headers: { ...getCorsHeaders(requestOrigin), 'Content-Type': 'application/json' } });
  }
});
