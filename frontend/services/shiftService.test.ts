import { beforeEach, describe, expect, it, vi } from 'vitest';

const { fromMock } = vi.hoisted(() => ({
  fromMock: vi.fn(),
}));

vi.mock('@services/supabase/client', () => ({
  supabase: {
    from: fromMock,
  },
}));


import { shiftService } from './shiftService';

describe('shiftService', () => {
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
              p.upsert = vi.fn().mockReturnValue(p);
              p.delete = vi.fn().mockReturnValue(p);
              p.eq = vi.fn().mockReturnValue(p);
              p.gte = vi.fn().mockReturnValue(p);
              p.lte = vi.fn().mockReturnValue(p);
              p.order = vi.fn().mockReturnValue(p);
              p.limit = vi.fn().mockReturnValue(p);
              p.single = vi.fn().mockResolvedValue(mockObj);
              return p;
    });
  });

  describe('getAll', () => {
    it('returns all shifts successfully', async () => {
      tableMocks.daily_shifts = { data: [{ id: 's1' }], error: null };
      const result = await shiftService.getAll();
      expect(result).toEqual([{ id: 's1' }]);
    });
  });

  describe('getByMonth', () => {
    it('returns shifts for the given month', async () => {
      tableMocks.daily_shifts = { data: [{ id: 's1' }], error: null };
      const result = await shiftService.getByMonth('2026-03', { employeeId: 'emp-1', appId: 'app-1' });
      expect(fromMock).toHaveBeenCalledWith('daily_shifts');
      expect(result).toEqual([{ id: 's1' }]);
    });
  });

  describe('getMonthRaw', () => {
    it('returns raw month shifts', async () => {
      tableMocks.daily_shifts = { data: [{ employee_id: 'e1', app_id: 'a1', date: '2026-03-01', hours_worked: 8 }], error: null };
      const res = await shiftService.getMonthRaw(2026, 3);
      expect(res).toHaveLength(1);
    });
  });

  describe('upsert', () => {
    it('inserts a single shift', async () => {
      tableMocks.daily_shifts = { data: { id: 's1' }, error: null };
      const result = await shiftService.upsert('emp-1', '2026-03-01', 'app-1', 8);
      expect(result).toEqual({ id: 's1' });
    });
  });

  describe('bulkUpsert', () => {
    it('bulk upserts shifts', async () => {
      tableMocks.daily_shifts = { error: null };
      const res = await shiftService.bulkUpsert([{ employee_id: 'e1', app_id: 'a1', date: '2026-03-01', hours_worked: 8 }]);
      expect(res.saved).toBe(1);
      expect(res.failed).toHaveLength(0);
    });
  });

  describe('delete', () => {
    it('deletes shift', async () => {
      tableMocks.daily_shifts = { error: null };
      await shiftService.delete('s1');
      expect(fromMock).toHaveBeenCalledWith('daily_shifts');
    });
  });

  describe('deleteByMonthAndApp', () => {
    it('deletes shifts properly', async () => {
      tableMocks.daily_shifts = { error: null };
      await shiftService.deleteByMonthAndApp(2026, 3, 'app-1');
      expect(fromMock).toHaveBeenCalledWith('daily_shifts');
    });

    it('throws error if delete fails', async () => {
      tableMocks.daily_shifts = { error: new Error('db error') };
      await expect(shiftService.deleteByMonthAndApp(2026, 3, 'app-1')).rejects.toThrow('db error');
    });
  });

  describe('getTotalHoursByEmployee', () => {
    it('returns total hours', async () => {
      tableMocks.daily_shifts = { data: [{ hours_worked: 8 }, { hours_worked: 4 }], error: null };
      const res = await shiftService.getTotalHoursByEmployee('emp-1', '2026-03');
      expect(res).toBe(12);
    });
    
    it('returns 0 if no data', async () => {
      tableMocks.daily_shifts = { data: null, error: null };
      const res = await shiftService.getTotalHoursByEmployee('emp-1', '2026-03');
      expect(res).toBe(0);
    });
  });
});
