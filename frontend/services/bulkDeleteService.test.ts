import { beforeEach, describe, expect, it, vi } from 'vitest';

type DeleteResult = { error: unknown; count: number | null };

function makeDeleteBuilder(result: DeleteResult) {
  const settled = Promise.resolve(result);
  const b = {
    delete: vi.fn(() => b),
    eq: vi.fn(() => b),
    gte: vi.fn(() => b),
    lte: vi.fn(() => b),
    in: vi.fn(() => b),
    then: settled.then.bind(settled),
    catch: settled.catch.bind(settled),
    finally: settled.finally.bind(settled),
  };
  return b;
}

const { fromMock } = vi.hoisted(() => ({ fromMock: vi.fn() }));

vi.mock('@services/supabase/client', () => ({
  supabase: { from: fromMock },
}));


import { bulkDeleteService } from './bulkDeleteService';

describe('bulkDeleteService', () => {
  beforeEach(() => vi.clearAllMocks());

  // ── deleteEmployeeMonth ──────────────────────────────────────────────────
  describe('deleteEmployeeMonth', () => {
    it('returns deleted count on success', async () => {
      fromMock.mockReturnValue(makeDeleteBuilder({ error: null, count: 7 }));
      const result = await bulkDeleteService.deleteEmployeeMonth('emp-1', '2026-03');
      expect(result).toBe(7);
      expect(fromMock).toHaveBeenCalledWith('daily_orders');
    });

    it('returns 0 when count is null', async () => {
      fromMock.mockReturnValue(makeDeleteBuilder({ error: null, count: null }));
      const result = await bulkDeleteService.deleteEmployeeMonth('emp-1', '2026-03');
      expect(result).toBe(0);
    });

    it('throws on Supabase error', async () => {
      fromMock.mockReturnValue(makeDeleteBuilder({ error: new Error('db error'), count: null }));
      await expect(
        bulkDeleteService.deleteEmployeeMonth('emp-1', '2026-03'),
      ).rejects.toThrow('db error');
    });

    it('builds correct date range for month 2026-02', async () => {
      const b = makeDeleteBuilder({ error: null, count: 3 });
      fromMock.mockReturnValue(b);
      await bulkDeleteService.deleteEmployeeMonth('emp-1', '2026-02');
      expect(b.gte).toHaveBeenCalledWith('date', '2026-02-01');
      expect(b.lte).toHaveBeenCalledWith('date', '2026-02-28');
    });

    it('scopes delete to the given employee_id', async () => {
      const b = makeDeleteBuilder({ error: null, count: 1 });
      fromMock.mockReturnValue(b);
      await bulkDeleteService.deleteEmployeeMonth('emp-99', '2026-01');
      expect(b.eq).toHaveBeenCalledWith('employee_id', 'emp-99');
    });
  });

  // ── deleteEmployeeAppMonth ───────────────────────────────────────────────
  describe('deleteEmployeeAppMonth', () => {
    it('returns count and scopes by employee + app + date range', async () => {
      const b = makeDeleteBuilder({ error: null, count: 4 });
      fromMock.mockReturnValue(b);
      const result = await bulkDeleteService.deleteEmployeeAppMonth('emp-2', 'app-1', '2026-04');
      expect(result).toBe(4);
      expect(b.eq).toHaveBeenCalledWith('employee_id', 'emp-2');
      expect(b.eq).toHaveBeenCalledWith('app_id', 'app-1');
      expect(b.gte).toHaveBeenCalledWith('date', '2026-04-01');
      expect(b.lte).toHaveBeenCalledWith('date', '2026-04-30');
    });

    it('throws on error', async () => {
      fromMock.mockReturnValue(makeDeleteBuilder({ error: new Error('denied'), count: null }));
      await expect(
        bulkDeleteService.deleteEmployeeAppMonth('emp-2', 'app-1', '2026-04'),
      ).rejects.toThrow('denied');
    });
  });

  // ── deleteAppMonth ───────────────────────────────────────────────────────
  describe('deleteAppMonth', () => {
    it('returns count scoped by app + date range', async () => {
      const b = makeDeleteBuilder({ error: null, count: 12 });
      fromMock.mockReturnValue(b);
      const result = await bulkDeleteService.deleteAppMonth('app-5', '2026-06');
      expect(result).toBe(12);
      expect(b.eq).toHaveBeenCalledWith('app_id', 'app-5');
      expect(b.gte).toHaveBeenCalledWith('date', '2026-06-01');
      expect(b.lte).toHaveBeenCalledWith('date', '2026-06-30');
    });

    it('throws on error', async () => {
      fromMock.mockReturnValue(makeDeleteBuilder({ error: new Error('conn refused'), count: null }));
      await expect(bulkDeleteService.deleteAppMonth('app-5', '2026-06')).rejects.toThrow('conn refused');
    });
  });

  // ── deleteDay ────────────────────────────────────────────────────────────
  describe('deleteDay', () => {
    it('deletes all orders for a specific date', async () => {
      const b = makeDeleteBuilder({ error: null, count: 20 });
      fromMock.mockReturnValue(b);
      const result = await bulkDeleteService.deleteDay('2026-03-15');
      expect(result).toBe(20);
      expect(b.eq).toHaveBeenCalledWith('date', '2026-03-15');
    });

    it('returns 0 when no rows deleted', async () => {
      fromMock.mockReturnValue(makeDeleteBuilder({ error: null, count: null }));
      expect(await bulkDeleteService.deleteDay('2026-03-15')).toBe(0);
    });

    it('throws on error', async () => {
      fromMock.mockReturnValue(makeDeleteBuilder({ error: new Error('lock'), count: null }));
      await expect(bulkDeleteService.deleteDay('2026-03-15')).rejects.toThrow('lock');
    });
  });
});
