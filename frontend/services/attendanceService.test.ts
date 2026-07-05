import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createQueryBuilder, type MockQueryResult } from '@shared/test/mocks/supabaseClientMock';
import { resetMockTableResults } from '@shared/test/mocks/serviceLayerTestUtils';

const { tableResults, fromMock, rpcMock } = vi.hoisted(() => {
  const tableResultsLocal: Record<string, MockQueryResult> = {};
  return {
    tableResults: tableResultsLocal,
    fromMock: vi.fn((table: string) => createQueryBuilder(tableResultsLocal[table] ?? { data: null, error: null })),
    rpcMock: vi.fn(),
  };
});

vi.mock('@services/supabase/client', () => ({
  supabase: {
    from: fromMock,
    rpc: rpcMock,
  },
}));


import attendanceService from './attendanceService';

describe('attendanceService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fromMock.mockImplementation((table: string) => createQueryBuilder(tableResults[table] ?? { data: null, error: null }));
    resetMockTableResults(tableResults);
  });

  describe('getDailyAttendanceBase', () => {
    it('returns data successfully', async () => {
      tableResults.employees = { data: [{ id: '1' }], error: null };
      tableResults.apps = { data: [{ id: 'a1' }], error: null };
      tableResults.employee_apps = { data: [{ employee_id: '1', app_id: 'a1' }], error: null };

      const res = await attendanceService.getDailyAttendanceBase();
      expect(res.employees).toHaveLength(1);
      expect(res.apps).toHaveLength(1);
      expect(res.employeeApps).toHaveLength(1);
    });

    it('falls back if primary employee query fails', async () => {
      // First call fails, fallback succeeds
      fromMock.mockImplementation((table: string) => {
        if (table === 'employees') {
          // This relies on the fact that the first call is order('name') and the second is also order('name')
          // The mock will just return from tableResults. We can simulate it by making the first error out but the fallback work?
          // Since the mock builder doesn't differentiate between the two calls easily without complex logic, we'll just mock it.
        }
        return createQueryBuilder(tableResults[table] ?? { data: null, error: null });
      });

      // A simple way to test fallback logic is to use mockResolvedValue on the query builder
      const errorBuilder = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        range: vi.fn().mockResolvedValueOnce({ data: null, error: new Error('primary error') })
          .mockResolvedValueOnce({ data: [{ id: 'fallback' }], error: null }),
      };

      fromMock.mockImplementation((table) => {
        if (table === 'employees') return errorBuilder;
        return createQueryBuilder(tableResults[table] ?? { data: null, error: null });
      });

      const res = await attendanceService.getDailyAttendanceBase();
      expect(res.employees).toEqual([{ id: 'fallback' }]);
    });

    it('throws if fallback fails', async () => {
      const errorBuilder = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        range: vi.fn().mockResolvedValueOnce({ data: null, error: new Error('primary error') })
          .mockResolvedValueOnce({ data: null, error: new Error('fallback error') }),
      };
      fromMock.mockImplementation((table) => {
        if (table === 'employees') return errorBuilder;
        return createQueryBuilder(tableResults[table] ?? { data: null, error: null });
      });

      await expect(attendanceService.getDailyAttendanceBase()).rejects.toThrow('fallback error');
    });

    it('throws if apps query fails', async () => {
      tableResults.employees = { data: [], error: null };
      tableResults.apps = { data: null, error: new Error('apps error') };
      tableResults.employee_apps = { data: [], error: null };

      await expect(attendanceService.getDailyAttendanceBase()).rejects.toThrow('apps error');
    });

    it('throws if employeeApps query fails', async () => {
      tableResults.employees = { data: [], error: null };
      tableResults.apps = { data: [], error: null };
      tableResults.employee_apps = { data: null, error: new Error('ea error') };

      await expect(attendanceService.getDailyAttendanceBase()).rejects.toThrow('ea error');
    });
  });

  describe('getDailyAttendanceRecords', () => {
    it('returns records', async () => {
      tableResults.attendance = { data: [{ id: '1' }], error: null };
      const res = await attendanceService.getDailyAttendanceRecords('2026-04-01');
      expect(res).toEqual([{ id: '1' }]);
    });

    it('throws on error', async () => {
      tableResults.attendance = { data: null, error: new Error('err') };
      await expect(attendanceService.getDailyAttendanceRecords('2026-04-01')).rejects.toThrow('err');
    });
  });

  describe('checkIn', () => {
    it('returns check-in result', async () => {
      rpcMock.mockResolvedValue({ data: { success: true }, error: null });
      const res = await attendanceService.checkIn('emp-1');
      expect(res).toEqual({ success: true });
    });

    it('throws on error', async () => {
      rpcMock.mockResolvedValue({ data: null, error: new Error('checkin err') });
      await expect(attendanceService.checkIn('emp-1')).rejects.toThrow('checkin err');
    });
  });

  describe('checkOut', () => {
    it('returns check-out result', async () => {
      rpcMock.mockResolvedValue({ data: { success: true }, error: null });
      const res = await attendanceService.checkOut('emp-1');
      expect(res).toEqual({ success: true });
    });

    it('throws on error', async () => {
      rpcMock.mockResolvedValue({ data: null, error: new Error('checkout err') });
      await expect(attendanceService.checkOut('emp-1')).rejects.toThrow('checkout err');
    });
  });

  describe('getAttendanceStatusRange', () => {
    it('returns attendance rows on success', async () => {
      tableResults.attendance = {
        data: [{ date: '2026-03-01', status: 'present' }, { date: '2026-03-02', status: 'absent' }],
        error: null,
      };
      const rows = await attendanceService.getAttendanceStatusRange('2026-03-01', '2026-03-31');
      expect(rows).toHaveLength(2);
      expect(rows[0].status).toBe('present');
    });

    it('throws when query fails', async () => {
      tableResults.attendance = { data: null, error: new Error('query failed') };
      await expect(attendanceService.getAttendanceStatusRange('2026-03-01', '2026-03-31'))
        .rejects.toThrow('query failed');
    });
  });

  describe('getActiveEmployeesCount', () => {
    it('returns count of visible active employees', async () => {
      tableResults.employees = {
        data: [{ id: '1', status: 'active', sponsorship_status: 'sponsored', probation_end_date: null }],
        error: null,
      };
      const count = await attendanceService.getActiveEmployeesCount();
      expect(count).toBe(1);
    });

    it('throws on error', async () => {
      tableResults.employees = { data: null, error: new Error('emp error') };
      await expect(attendanceService.getActiveEmployeesCount()).rejects.toThrow('emp error');
    });
  });

  describe('upsertDailyAttendance', () => {
    it('upserts data successfully', async () => {
      tableResults.attendance = { data: null, error: null }; // upsert returns no error
      // A rejected promise here would fail the test, so a successful await is the assertion.
      await attendanceService.upsertDailyAttendance({
        employee_id: 'e1', date: '2026-04-01', status: 'present', check_in: null, check_out: null, note: null
      });
    });

    it('throws on error', async () => {
      // the createQueryBuilder handles upsert returning this builder, and resolving with the error
      tableResults.attendance = { data: null, error: new Error('upsert err') };
      await expect(attendanceService.upsertDailyAttendance({
        employee_id: 'e1', date: '2026-04-01', status: 'present', check_in: null, check_out: null, note: null
      })).rejects.toThrow('upsert err');
    });
  });

  describe('getMonthlyEmployeesAndAttendance', () => {
    it('returns formatted data', async () => {
      tableResults.employees = { data: [{ id: 'e1', status: 'active', sponsorship_status: 'sponsored', probation_end_date: null }], error: null };
      tableResults.attendance = { data: [{ employee_id: 'e1', status: 'present' }], error: null };

      const res = await attendanceService.getMonthlyEmployeesAndAttendance('2026-04-01', '2026-04-30');
      expect(res.employees).toHaveLength(1);
      expect(res.attendanceRows).toHaveLength(1);
    });

    it('throws if employees query fails', async () => {
      tableResults.employees = { data: null, error: new Error('emp err') };
      tableResults.attendance = { data: [], error: null };

      await expect(attendanceService.getMonthlyEmployeesAndAttendance('2026-04-01', '2026-04-30')).rejects.toThrow('emp err');
    });

    it('throws if attendance query fails', async () => {
      tableResults.employees = { data: [], error: null };
      tableResults.attendance = { data: null, error: new Error('att err') };

      await expect(attendanceService.getMonthlyEmployeesAndAttendance('2026-04-01', '2026-04-30')).rejects.toThrow('att err');
    });
  });

  describe('getAttendanceByMonth', () => {
    it('throws on invalid format', async () => {
      await expect(attendanceService.getAttendanceByMonth('invalid')).rejects.toThrow('Invalid monthYear format. Expected YYYY-MM');
    });

    it('returns data', async () => {
      tableResults.attendance = { data: [{ employee_id: 'e1', status: 'present' }], error: null };
      const res = await attendanceService.getAttendanceByMonth('2026-04');
      expect(res).toEqual([{ employee_id: 'e1', status: 'present' }]);
    });

    it('throws on error', async () => {
      tableResults.attendance = { data: null, error: new Error('att error') };
      await expect(attendanceService.getAttendanceByMonth('2026-04')).rejects.toThrow('att error');
    });
  });

  describe('getAttendanceByEmployeeMonth', () => {
    it('throws on invalid employeeId', async () => {
      await expect(attendanceService.getAttendanceByEmployeeMonth('not-uuid', '2026-04')).rejects.toThrow('Invalid employeeId format');
    });

    it('throws on invalid monthYear', async () => {
      await expect(attendanceService.getAttendanceByEmployeeMonth('12345678-1234-1234-1234-1234567890ab', 'invalid')).rejects.toThrow('Invalid monthYear format. Expected YYYY-MM');
    });

    it('returns data', async () => {
      tableResults.attendance = { data: [{ id: '1' }], error: null };
      const res = await attendanceService.getAttendanceByEmployeeMonth('12345678-1234-1234-1234-1234567890ab', '2026-04');
      expect(res).toEqual([{ id: '1' }]);
    });

    it('throws on error', async () => {
      tableResults.attendance = { data: null, error: new Error('att error') };
      await expect(attendanceService.getAttendanceByEmployeeMonth('12345678-1234-1234-1234-1234567890ab', '2026-04')).rejects.toThrow('att error');
    });
  });

  describe('getStatusConfigs', () => {
    it('returns configs', async () => {
      tableResults.attendance_status_configs = { data: [{ id: '1', name: 'cfg', color: '#fff' }], error: null };
      const res = await attendanceService.getStatusConfigs();
      expect(res).toEqual([{ id: '1', name: 'cfg', color: '#fff' }]);
    });

    it('throws on error', async () => {
      tableResults.attendance_status_configs = { data: null, error: new Error('cfg error') };
      await expect(attendanceService.getStatusConfigs()).rejects.toThrow('cfg error');
    });
  });

  describe('addStatusConfig', () => {
    it('inserts successfully', async () => {
      tableResults.attendance_status_configs = { data: null, error: null };
      // A rejected promise here would fail the test, so a successful await is the assertion.
      await attendanceService.addStatusConfig('test cfg');
    });

    it('throws on error', async () => {
      tableResults.attendance_status_configs = { data: null, error: new Error('cfg error') };
      await expect(attendanceService.addStatusConfig('test cfg')).rejects.toThrow('cfg error');
    });
  });
});
