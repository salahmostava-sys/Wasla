import { beforeEach, describe, expect, it, vi } from 'vitest';

const { fromMock } = vi.hoisted(() => ({
  fromMock: vi.fn(),
}));

vi.mock('@services/supabase/client', () => ({
  supabase: {
    from: fromMock,
  },
}));


vi.mock('@shared/lib/employeeVisibility', () => ({
  filterOperationallyVisibleEmployees: vi.fn((emps: unknown[]) => emps),
}));

import { platformAccountService, type PlatformAccountWritePayload } from './platformAccountService';

describe('platformAccountService', () => {
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
              p.in = vi.fn().mockReturnValue(p);
              p.or = vi.fn().mockReturnValue(p);
              p.order = vi.fn().mockReturnValue(p);
              p.limit = vi.fn().mockReturnValue(p);
              p.range = vi.fn().mockReturnValue(p);
              p.single = vi.fn().mockResolvedValue(mockObj);
              return p;
    });
  });

  describe('getApps', () => {
    it('returns active apps successfully', async () => {
      tableMocks.apps = { data: [{ id: 'app1' }], error: null };
      const result = await platformAccountService.getApps();
      expect(result).toEqual([{ id: 'app1' }]);
    });
  });

  describe('getEmployees', () => {
    it('returns employees', async () => {
      tableMocks.employees = { data: [{ id: 'e1' }], error: null };
      const result = await platformAccountService.getEmployees();
      expect(result).toEqual([{ id: 'e1' }]);
    });
  });

  describe('getAccounts', () => {
    it('returns accounts', async () => {
      tableMocks.platform_accounts = { data: [{ id: 'a1' }], error: null };
      const result = await platformAccountService.getAccounts();
      expect(result).toEqual([{ id: 'a1' }]);
    });
  });

  describe('getAccountsPaged', () => {
    it('returns paged accounts', async () => {
      fromMock.mockImplementation(() => {
        const p: any = Promise.resolve({ data: [{ id: 'a1' }], count: 1, error: null });
                p.select = vi.fn().mockReturnValue(p);
                p.order = vi.fn().mockReturnValue(p);
                p.range = vi.fn().mockReturnValue(p);
                p.eq = vi.fn().mockReturnValue(p);
                p.in = vi.fn().mockReturnValue(p);
                p.or = vi.fn().mockReturnValue(p);
                return p;
      });
      const result = await platformAccountService.getAccountsPaged({
        page: 1, pageSize: 10, filters: { employeeId: 'e1', appIds: ['app1'], status: 'active', branch: 'makkah', search: 'x' }
      });
      expect(result.rows).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('handles single appId filter', async () => {
      fromMock.mockImplementation(() => {
        const p: any = Promise.resolve({ data: [{ id: 'a1' }], count: 1, error: null });
                p.select = vi.fn().mockReturnValue(p);
                p.order = vi.fn().mockReturnValue(p);
                p.range = vi.fn().mockReturnValue(p);
                p.eq = vi.fn().mockReturnValue(p);
                p.in = vi.fn().mockReturnValue(p);
                p.or = vi.fn().mockReturnValue(p);
                return p;
      });
      const result = await platformAccountService.getAccountsPaged({
        page: 1, pageSize: 10, filters: { appId: 'app1' }
      });
      expect(result.rows).toHaveLength(1);
    });
  });

  describe('exportAccounts', () => {
    it('fetches all chunks for export', async () => {
      let callCount = 0;
      fromMock.mockImplementation(() => {
        const p: any = Promise.resolve({ data, count: 2, error: null });
                p.select = vi.fn().mockReturnValue(p);
                p.order = vi.fn().mockReturnValue(p);
                p.range = vi.fn().mockReturnValue(p);
                p.eq = vi.fn().mockReturnValue(p);
                p.const data = callCount === 1 ? [{ id = 'a1' }, { id: 'a2' }] : [];;
                p.return Promise.resolve({ data, count = 2, error: null }).then(resolve);;
                return p;
      });
      const res = await platformAccountService.exportAccounts({ chunkSize: 2, maxRows: 4 });
      expect(res).toHaveLength(2);
    });
  });

  describe('createAccount', () => {
    it('inserts account successfully', async () => {
      tableMocks.platform_accounts = { data: { id: 'acc1' }, error: null };
      const payload: PlatformAccountWritePayload = {
        app_id: 'app1', account_username: 'user1', employee_id: null,
        account_id_on_platform: null, iqama_number: null, iqama_expiry_date: null, status: 'active', notes: null,
      };
      const result = await platformAccountService.createAccount(payload);
      expect(result).toEqual({ id: 'acc1' });
    });
  });

  describe('updateAccount', () => {
    it('updates account successfully', async () => {
      tableMocks.platform_accounts = { error: null };
      const payload: PlatformAccountWritePayload = {
        app_id: 'app1', account_username: 'user1', employee_id: null,
        account_id_on_platform: null, iqama_number: null, iqama_expiry_date: null, status: 'inactive', notes: null,
      };
      await platformAccountService.updateAccount('acc1', payload);
      expect(fromMock).toHaveBeenCalledWith('platform_accounts');
    });
  });

  describe('syncAccountEmployee', () => {
    it('syncs account employee successfully', async () => {
      tableMocks.platform_accounts = { error: null };
      await platformAccountService.syncAccountEmployee('acc1', 'e1');
      expect(fromMock).toHaveBeenCalledWith('platform_accounts');
    });
  });
});
