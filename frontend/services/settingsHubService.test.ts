import { beforeEach, describe, expect, it, vi } from 'vitest';

const { fromMock, getSessionMock, uploadMock, getPublicUrlMock, updatePasswordMock } = vi.hoisted(() => ({
  fromMock: vi.fn(),
  getSessionMock: vi.fn(),
  uploadMock: vi.fn(),
  getPublicUrlMock: vi.fn(),
  updatePasswordMock: vi.fn(),
}));

vi.mock('@services/supabase/client', () => ({
  supabase: {
    from: fromMock,
    auth: {
      getSession: getSessionMock,
    },
    storage: {
      from: vi.fn().mockReturnValue({
        upload: uploadMock,
        getPublicUrl: getPublicUrlMock,
      })
    }
  },
}));


vi.mock('@services/authService', () => ({
  authService: {
    updatePassword: updatePasswordMock,
  }
}));

import { settingsHubService } from './settingsHubService';

describe('settingsHubService', () => {
  let tableMocks: Record<string, any>;

  beforeEach(() => {
    vi.clearAllMocks();
    tableMocks = {};
    fromMock.mockImplementation((table: string) => {
      const mockObj = tableMocks[table] ?? { data: null, error: null };
      const p: any = Promise.resolve(mockObj);
              p.select = vi.fn().mockReturnValue(p);
              p.insert = vi.fn().mockReturnValue(p);
              p.update = vi.fn().mockReturnValue(p);
              p.delete = vi.fn().mockReturnValue(p);
              p.eq = vi.fn().mockReturnValue(p);
              p.not = vi.fn().mockReturnValue(p);
              p.in = vi.fn().mockReturnValue(p);
              p.or = vi.fn().mockReturnValue(p);
              p.order = vi.fn().mockReturnValue(p);
              p.limit = vi.fn().mockReturnValue(p);
              p.range = vi.fn().mockReturnValue(p);
              p.maybeSingle = vi.fn().mockResolvedValue(mockObj);
              p.single = vi.fn().mockResolvedValue(mockObj);
              return p;
    });
  });

  describe('getCurrentUserId', () => {
    it('returns the user id when session exists', async () => {
      getSessionMock.mockResolvedValueOnce({ data: { session: { user: { id: 'user-1' } } }, error: null });
      const result = await settingsHubService.getCurrentUserId();
      expect(result).toBe('user-1');
    });

    it('returns null when there is no user', async () => {
      getSessionMock.mockResolvedValueOnce({ data: { session: null }, error: null });
      const result = await settingsHubService.getCurrentUserId();
      expect(result).toBeNull();
    });

    it('throws error when session fetch fails', async () => {
      getSessionMock.mockResolvedValueOnce({ data: null, error: new Error('auth failed') });
      await expect(settingsHubService.getCurrentUserId()).rejects.toThrow('auth failed');
    });
  });

  describe('getAuditLogs', () => {
    it('returns audit logs', async () => {
      fromMock.mockImplementation(() => {
        const p: any = Promise.resolve({ data: [{ id: 1 }], count: 1, error: null });
                p.select = vi.fn().mockReturnValue(p);
                p.order = vi.fn().mockReturnValue(p);
                p.range = vi.fn().mockReturnValue(p);
                p.eq = vi.fn().mockReturnValue(p);
                p.or = vi.fn().mockReturnValue(p);
                return p;
      });
      const res = await settingsHubService.getAuditLogs(0, 10, 'INSERT', 'employees', 'test', 'user-1');
      expect(res.rows).toHaveLength(1);
    });
  });

  describe('getAuditProfilesByIds', () => {
    it('returns profiles', async () => {
      tableMocks.profiles = { data: [{ id: 'user-1', name: 'Test' }], error: null };
      const res = await settingsHubService.getAuditProfilesByIds(['user-1']);
      expect(res).toHaveLength(1);
    });
  });

  describe('getAuditUsers', () => {
    it('returns unique users from audit_log', async () => {
      fromMock.mockImplementation((table: string) => {
        if (table === 'audit_log') {
          return {
            select: vi.fn().mockReturnThis(),
            not: vi.fn().mockReturnThis(),
            limit: vi.fn().mockResolvedValue({ data: [{ user_id: 'user-1' }], error: null })
          };
        }
        return {
          select: vi.fn().mockReturnThis(),
          in: vi.fn().mockResolvedValue({ data: [{ id: 'user-1', name: 'Z' }, { id: 'user-2', name: 'A' }], error: null })
        };
      });
      const res = await settingsHubService.getAuditUsers();
      expect(res[0].name).toBe('A'); // sorted alphabetically
    });
  });

  describe('getAuditLogsForExport', () => {
    it('returns formatted export rows', async () => {
      fromMock.mockImplementation((table: string) => {
        if (table === 'audit_log') {
          return {
             select: vi.fn().mockReturnThis(),
             order: vi.fn().mockReturnThis(),
             limit: vi.fn().mockResolvedValue({ data: [{ id: 1, user_id: 'user-1' }], error: null })
          };
        }
        return {
           select: vi.fn().mockReturnThis(),
           in: vi.fn().mockResolvedValue({ data: [{ id: 'user-1', name: 'Admin', email: 'admin@test.com' }], error: null })
        };
      });
      const res = await settingsHubService.getAuditLogsForExport();
      expect(res[0].user_name).toBe('Admin');
    });
  });

  describe('getProfileByUserId', () => {
    it('returns profile', async () => {
      tableMocks.profiles = { data: { name: 'Admin' }, error: null };
      const res = await settingsHubService.getProfileByUserId('user-1');
      expect(res).toEqual({ name: 'Admin' });
    });
  });

  describe('uploadAvatar and updateProfileByUserId', () => {
    it('uploads avatar and updates profile', async () => {
      uploadMock.mockResolvedValueOnce({ data: { path: 'avatar.png' }, error: null });
      tableMocks.profiles = { error: null };
      
      const file = new File([''], 'avatar.png', { type: 'image/png' });
      const res = await settingsHubService.uploadAvatar('avatar.png', file);
      expect(res.path).toBe('avatar.png');

      await settingsHubService.updateProfileByUserId('user-1', { name: 'Admin' });
      expect(fromMock).toHaveBeenCalledWith('profiles');
    });
    
    it('throws error for invalid path', async () => {
      const file = new File([''], 'avatar.png', { type: 'image/png' });
      await expect(settingsHubService.uploadAvatar('../avatar.png', file)).rejects.toThrow();
    });
    
    it('throws error for invalid file type', async () => {
      const file = new File([''], 'avatar.txt', { type: 'text/plain' });
      await expect(settingsHubService.uploadAvatar('avatar.txt', file)).rejects.toThrow();
    });
  });

  describe('getAvatarPublicUrl', () => {
    it('returns URL', () => {
      getPublicUrlMock.mockReturnValueOnce({ data: { publicUrl: 'http://test' } });
      const res = settingsHubService.getAvatarPublicUrl('avatar.png');
      expect(res.data.publicUrl).toBe('http://test');
    });
  });

  describe('updatePassword', () => {
    it('delegates password update to auth service', async () => {
      await settingsHubService.updatePassword('password');
      expect(updatePasswordMock).toHaveBeenCalledWith('password');
    });
  });

  describe('getTradeRegister', () => {
    it('returns trade register', async () => {
      tableMocks.trade_registers = { data: { id: 't1' }, error: null };
      const res = await settingsHubService.getTradeRegister();
      expect(res).toEqual({ id: 't1' });
    });
  });

  describe('uploadCompanyLogo', () => {
    it('uploads logo', async () => {
      uploadMock.mockResolvedValueOnce({ data: { path: 'logo.png' }, error: null });
      const file = new File([''], 'logo.png', { type: 'image/png' });
      const res = await settingsHubService.uploadCompanyLogo('logo.png', file);
      expect(res.path).toBe('logo.png');
    });
  });

  describe('getCompanyLogoPublicUrl', () => {
    it('returns URL', () => {
      getPublicUrlMock.mockReturnValueOnce({ data: { publicUrl: 'http://logo' } });
      const res = settingsHubService.getCompanyLogoPublicUrl('logo.png');
      expect(res.data.publicUrl).toBe('http://logo');
    });
  });

  describe('getSystemSettings', () => {
    it('returns settings on success', async () => {
      tableMocks.system_settings = { data: { project_name_en: 'Test' }, error: null };
      const result = await settingsHubService.getSystemSettings();
      expect(result).toEqual({ project_name_en: 'Test' });
    });
  });

  describe('saveSystemSettings', () => {
    it('updates existing settings if settingsId provided', async () => {
      tableMocks.system_settings = { error: null };
      fromMock.mockReturnValue({
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ error: null })
      });
      await settingsHubService.saveSystemSettings('id-1', {
        project_name_ar: 'test', project_name_en: 'test', default_language: 'ar', logo_url: null, iqama_alert_days: 90
      });
      expect(fromMock).toHaveBeenCalledWith('system_settings');
    });

    it('inserts new settings if settingsId is null', async () => {
      tableMocks.system_settings = { error: null };
      fromMock.mockReturnValue({
        insert: vi.fn().mockResolvedValue({ error: null })
      });
      await settingsHubService.saveSystemSettings(null, {
        project_name_ar: 'test', project_name_en: 'test', default_language: 'ar', logo_url: null, iqama_alert_days: 90
      });
      expect(fromMock).toHaveBeenCalledWith('system_settings');
    });
  });

  describe('updateSystemLogo', () => {
    it('updates system logo', async () => {
      tableMocks.system_settings = { error: null };
      fromMock.mockReturnValue({
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ error: null })
      });
      await settingsHubService.updateSystemLogo('s1', 'logo.png');
      expect(fromMock).toHaveBeenCalledWith('system_settings');
    });
  });

  describe('updateTradeRegister', () => {
    it('updates register', async () => {
      tableMocks.trade_registers = { error: null };
      fromMock.mockReturnValue({
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ error: null })
      });
      await settingsHubService.updateTradeRegister('t1', { value: 1 });
      expect(fromMock).toHaveBeenCalledWith('trade_registers');
    });
  });

  describe('createTradeRegister', () => {
    it('creates register', async () => {
      tableMocks.trade_registers = { data: { id: 't1' }, error: null };
      const res = await settingsHubService.createTradeRegister({ value: 1 });
      expect(res).toEqual({ id: 't1' });
    });
  });

  describe('exportTableRows', () => {
    it('exports allowed tables correctly', async () => {
      tableMocks.employees = { data: [{ id: 1 }], error: null };
      const result = await settingsHubService.exportTableRows('employees');
      expect(fromMock).toHaveBeenCalledWith('employees');
      expect(result).toEqual([{ id: 1 }]);
    });

    it('throws for disallowed tables', async () => {
      await expect(settingsHubService.exportTableRows('secrets_table')).rejects.toThrow('Table is not allowed for export');
    });
  });
});
