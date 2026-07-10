import { supabase } from '@services/supabase/client';
import { validateUploadFile } from '@shared/lib/validation';
import { authService } from '@services/authService';
import { toServiceError } from '@services/serviceError';
import { createPagedResult } from '@shared/types/pagination';
import { sanitizeLikeQuery } from '@shared/lib/security';
import { sanitizeStoragePath } from '@shared/lib/storagePath';

const EXPORT_TABLE_ALLOWLIST = new Set([
  'audit_log',
  'admin_action_log',
  'profiles',
  'employees',
  'vehicles',
  'apps',
  'daily_orders',
  'attendance',
  'advances',
  'salary_records',
  'trade_registers',
  'system_settings',
]);

/** Max rows per settings backup export (paginated). */
const EXPORT_MAX_ROWS = 10_000;
const EXPORT_PAGE_SIZE = 1_000;

/**
 * Tables included in the full project backup (download + restore).
 * Kept separate from EXPORT_TABLE_ALLOWLIST (used by the audit-log export screen),
 * since the full backup intentionally excludes sensitive/system-only tables like
 * `profiles`, `audit_log`, and `system_settings`.
 */
export const BACKUP_TABLES = [
  'employees', 'attendance', 'advances', 'advance_installments', 'daily_orders',
  'employee_apps', 'apps', 'salary_schemes', 'salary_records', 'external_deductions',
  'vehicles', 'vehicle_assignments', 'alerts',
] as const;

const BACKUP_TABLE_SET = new Set<string>(BACKUP_TABLES);

/** Max rows restored per table per call, and batch size for upserts. */
const RESTORE_MAX_ROWS_PER_TABLE = 10_000;
const RESTORE_BATCH_SIZE = 500;

const getNameLabelsById = async (
  table: 'employees' | 'apps',
  ids: string[],
  context: string,
) => {
  if (ids.length === 0) return {};

  const { data, error } = await supabase
    .from(table)
    .select('id, name')
    .in('id', ids);
  if (error) throw toServiceError(error, context);

  return Object.fromEntries((data ?? []).map((row) => [row.id, row.name] as const));
};

export const settingsHubService = {
  getCurrentUserId: async () => {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw toServiceError(error, 'settingsHubService.getCurrentUserId');
    return data.session?.user?.id ?? null;
  },

  getAuditLogs: async (
    from: number,
    to: number,
    filterAction: string,
    filterTable: string,
    search: string,
    filterUserId = 'all',
  ) => {
    let query = supabase
      .from('audit_log')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to);

    if (filterAction !== 'all') query = query.eq('action', filterAction);
    if (filterTable !== 'all') query = query.eq('table_name', filterTable);
    if (filterUserId !== 'all') query = query.eq('user_id', filterUserId);
    if (search.trim()) {
      const sq = sanitizeLikeQuery(search.trim());
      query = query.or(`table_name.ilike.%${sq}%,action.ilike.%${sq}%,record_id.ilike.%${sq}%`);
    }

    const { data, error, count } = await query;
    if (error) throw toServiceError(error, 'settingsHubService.getAuditLogs');
    return createPagedResult({
      rows: data,
      total: count,
      page: Math.floor(from / Math.max(1, to - from + 1)) + 1,
      pageSize: Math.max(1, to - from + 1),
    });
  },

  getAuditProfilesByIds: async (userIds: string[]) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, name, email')
      .in('id', userIds);
    if (error) throw toServiceError(error, 'settingsHubService.getAuditProfilesByIds');
    return data ?? [];
  },

  getAuditReferenceLabels: async ({
    employeeIds,
    appIds,
  }: {
    employeeIds: string[];
    appIds: string[];
  }) => {
    const [employeeLabels, appLabels] = await Promise.all([
      getNameLabelsById('employees', employeeIds, 'settingsHubService.getAuditReferenceLabels.employees'),
      getNameLabelsById('apps', appIds, 'settingsHubService.getAuditReferenceLabels.apps'),
    ]);

    return { ...employeeLabels, ...appLabels };
  },

  /**
   * Fetch all user profiles for the activity-log user filter.
   */
  getAuditUsers: async () => {
    const { data: profiles, error } = await supabase
      .from('profiles')
      .select('id, name, email')
      .order('name', { ascending: true });
    if (error) throw toServiceError(error, 'settingsHubService.getAuditUsers');

    return (profiles ?? []).sort((a, b) => (a.name ?? '').localeCompare(b.name ?? '', 'ar'));
  },

  /**
   * Export all audit logs (up to 2000 rows) with resolved user names.
   */
  getAuditLogsForExport: async () => {
    const { data, error } = await supabase
      .from('audit_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(2000);
    if (error) throw toServiceError(error, 'settingsHubService.getAuditLogsForExport');
    const rows = data ?? [];

    // Resolve user IDs → names
    const userIds = [...new Set(rows.map(l => l.user_id).filter(Boolean))] as string[];
    const profileMap: Record<string, { name: string | null; email: string | null }> = {};
    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name, email')
        .in('id', userIds);
      (profiles ?? []).forEach(p => { profileMap[p.id] = { name: p.name, email: p.email }; });
    }

    return rows.map(row => ({
      ...row,
      user_name:  row.user_id ? (profileMap[row.user_id]?.name  ?? 'غير معروف') : 'النظام',
      user_email: row.user_id ? (profileMap[row.user_id]?.email ?? '')          : '',
    }));
  },

  getProfileByUserId: async (userId: string) => {
    const { data, error } = await supabase.from('profiles').select('name, avatar_url').eq('id', userId).maybeSingle();
    if (error) throw toServiceError(error, 'settingsHubService.getProfileByUserId');
    return data;
  },
  uploadAvatar: async (path: string, file: File) => {
    const safePath = sanitizeStoragePath(path);
    if (!safePath) {
      throw toServiceError(new Error('Invalid storage path'), 'settingsHubService.uploadAvatar.path');
    }
    if (safePath.includes('..') || safePath.startsWith('/') || !/^[A-Za-z0-9/_\-.]+$/.test(safePath)) {
      throw toServiceError(new Error('Unsafe storage path'), 'settingsHubService.uploadAvatar.path');
    }
    const validation = validateUploadFile(file, {
      allowedTypes: ['image/jpeg', 'image/png', 'image/webp'],
    });
    if (!validation.valid) {
      throw toServiceError(
        new Error('error' in validation ? validation.error : 'Invalid file'),
        'settingsHubService.uploadAvatar.validation'
      );
    }
    const { data, error } = await supabase.storage.from('avatars').upload(safePath, file, { upsert: true });
    if (error) throw toServiceError(error, 'settingsHubService.uploadAvatar');
    if (!data) throw toServiceError(new Error('Upload returned no data'), 'settingsHubService.uploadAvatar');
    return data;
  },
  getAvatarPublicUrl: (path: string) => supabase.storage.from('avatars').getPublicUrl(path),
  updateProfileByUserId: async (userId: string, payload: Record<string, unknown>) => {
    const { error } = await supabase.from('profiles').update(payload as never).eq('id', userId);
    if (error) throw toServiceError(error, 'settingsHubService.updateProfileByUserId');
  },
  updatePassword: (password: string) => authService.updatePassword(password),

  getTradeRegister: async () => {
    const { data, error } = await supabase.from('trade_registers').select('*').order('created_at').limit(1).maybeSingle();
    if (error) throw toServiceError(error, 'settingsHubService.getTradeRegister');
    return data;
  },
  uploadCompanyLogo: async (path: string, file: File) => {
    const safePath = sanitizeStoragePath(path);
    if (!safePath) {
      throw toServiceError(new Error('Invalid storage path'), 'settingsHubService.uploadCompanyLogo.path');
    }
    if (safePath.includes('..') || safePath.startsWith('/') || !/^[A-Za-z0-9/_\-.]+$/.test(safePath)) {
      throw toServiceError(new Error('Unsafe storage path'), 'settingsHubService.uploadCompanyLogo.path');
    }
    const validation = validateUploadFile(file, {
      allowedTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'],
    });
    if (!validation.valid) {
      throw toServiceError(
        new Error('error' in validation ? validation.error : 'Invalid file'),
        'settingsHubService.uploadCompanyLogo.validation'
      );
    }
    const { data, error } = await supabase.storage.from('avatars').upload(safePath, file, { upsert: true });
    if (error) throw toServiceError(error, 'settingsHubService.uploadCompanyLogo');
    if (!data) throw toServiceError(new Error('Upload returned no data'), 'settingsHubService.uploadCompanyLogo');
    return data;
  },
  getCompanyLogoPublicUrl: (path: string) => supabase.storage.from('avatars').getPublicUrl(path),
  getSystemSettings: async () => {
    const { data, error } = await supabase
      .from('system_settings')
      .select('*')
      .limit(1)
      .maybeSingle();
    if (error) throw toServiceError(error, 'settingsHubService.getSystemSettings');
    return data;
  },
  saveSystemSettings: async (
    settingsId: string | null | undefined,
    payload: {
      project_name_ar: string;
      project_name_en: string;
      default_language: string;
      logo_url: string | null;
      iqama_alert_days: number;
    },
  ) => {
    if (settingsId) {
      const { error } = await supabase.from('system_settings').update(payload).eq('id', settingsId);
      if (error) throw toServiceError(error, 'settingsHubService.saveSystemSettings.update');
      return;
    }

    const { error } = await supabase.from('system_settings').insert(payload);
    if (error) throw toServiceError(error, 'settingsHubService.saveSystemSettings.insert');
  },
  updateSystemLogo: async (settingsId: string, logoUrl: string | null) => {
    const { error } = await supabase.from('system_settings').update({ logo_url: logoUrl }).eq('id', settingsId);
    if (error) throw toServiceError(error, 'settingsHubService.updateSystemLogo');
  },
  updateTradeRegister: async (recordId: string, payload: Record<string, unknown>) => {
    const { error } = await supabase.from('trade_registers').update(payload as never).eq('id', recordId);
    if (error) throw toServiceError(error, 'settingsHubService.updateTradeRegister');
  },
  createTradeRegister: async (payload: Record<string, unknown>) => {
    const { data, error } = await supabase.from('trade_registers' as never).insert(payload as never).select().single();
    if (error) throw toServiceError(error, 'settingsHubService.createTradeRegister');
    return data;
  },

  exportTableRows: async (table: string) => {
    if (!EXPORT_TABLE_ALLOWLIST.has(table)) {
      throw toServiceError(new Error('Table is not allowed for export'), 'settingsHubService.exportTableRows');
    }

    const allRows: Record<string, unknown>[] = [];
    let from = 0;

    while (allRows.length < EXPORT_MAX_ROWS) {
      const to = from + EXPORT_PAGE_SIZE - 1;
      const { data, error } = await supabase
        .from(table as never)
        .select('*')
        .range(from, to);
      if (error) throw toServiceError(error, 'settingsHubService.exportTableRows');
      if (!data || data.length === 0) break;

      allRows.push(...(data as Record<string, unknown>[]));
      if (data.length < EXPORT_PAGE_SIZE) break;
      from += EXPORT_PAGE_SIZE;
    }

    if (allRows.length >= EXPORT_MAX_ROWS) {
      throw toServiceError(
        new Error(`Export limit exceeded (${EXPORT_MAX_ROWS} rows). Narrow the table or contact an administrator.`),
        'settingsHubService.exportTableRows',
      );
    }

    return allRows;
  },

  /**
   * Restore (upsert) rows into one of the backup tables. Rows are matched by their
   * existing `id` column (as produced by exportBackupFiles), so re-running a restore
   * updates already-existing records instead of duplicating them. Rows that no longer
   * have a matching table in the current schema, or that are missing an `id`, are skipped.
   * Does NOT delete rows that exist in the database but are absent from the backup file.
   */
  importTableRows: async (table: string, rows: Record<string, unknown>[]): Promise<number> => {
    if (!BACKUP_TABLE_SET.has(table)) {
      throw toServiceError(new Error(`Table "${table}" is not allowed for restore`), 'settingsHubService.importTableRows');
    }
    if (!Array.isArray(rows) || rows.length === 0) return 0;
    if (rows.length > RESTORE_MAX_ROWS_PER_TABLE) {
      throw toServiceError(
        new Error(`Restore limit exceeded (${RESTORE_MAX_ROWS_PER_TABLE} rows) for table "${table}".`),
        'settingsHubService.importTableRows',
      );
    }

    const validRows = rows.filter(r => r && typeof r === 'object' && 'id' in r && r.id != null);
    let restored = 0;
    for (let i = 0; i < validRows.length; i += RESTORE_BATCH_SIZE) {
      const batch = validRows.slice(i, i + RESTORE_BATCH_SIZE);
      const { error } = await supabase.from(table as never).upsert(batch as never, { onConflict: 'id' });
      if (error) throw toServiceError(error, `settingsHubService.importTableRows[${table}]`);
      restored += batch.length;
    }
    return restored;
  },
};
