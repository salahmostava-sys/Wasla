import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createQueryBuilder, type MockQueryResult } from '@shared/test/mocks/supabaseClientMock';

const { tableResults, rpcResults, fromMock, rpcMock, removeMock, uploadMock } = vi.hoisted(() => {
  const tableResultsLocal: Record<string, MockQueryResult> = {};
  const rpcResultsLocal: Record<string, MockQueryResult> = {};
  return {
    tableResults: tableResultsLocal,
    rpcResults: rpcResultsLocal,
    fromMock: vi.fn((table: string) => createQueryBuilder(tableResultsLocal[table] ?? { data: null, error: null })),
    rpcMock: vi.fn((fn: string) => Promise.resolve(rpcResultsLocal[fn] ?? { data: null, error: null })),
    removeMock: vi.fn().mockResolvedValue({ error: null }),
    uploadMock: vi.fn().mockResolvedValue({ data: { path: 'mock' }, error: null }),
  };
});

vi.mock('@services/supabase/client', () => ({
  supabase: {
    from: fromMock,
    rpc: rpcMock,
    storage: {
      from: vi.fn(() => ({
        upload: uploadMock,
        remove: removeMock,
      })),
    },
  },
}));


import { employeeService } from './employeeService';

describe('employeeService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    for (const k of Object.keys(tableResults)) delete tableResults[k];
    for (const k of Object.keys(rpcResults)) delete rpcResults[k];
  });

  describe('getAll', () => {
    it('fetchEmployees returns data', async () => {
      tableResults.employees = {
        data: [{ id: 'e1', name: 'Ahmed', employee_apps: [{ apps: { id: 'app1', name: 'App 1' } }] }],
        error: null,
      };

      const rows = await employeeService.getAll();
      expect(rows).toEqual([{ id: 'e1', name: 'Ahmed', employee_apps: [{ apps: { id: 'app1', name: 'App 1' } }], platform_apps: [{ id: 'app1', name: 'App 1' }] }]);
    });
  });

  describe('getPaged', () => {
    it('returns paginated data with filters', async () => {
      tableResults.employees = { data: [{ id: '1' }], count: 1 };
      const res = await employeeService.getPaged({ page: 1, pageSize: 10, filters: { branch: 'makkah', status: 'active', search: 'test' } });
      expect(res.rows).toEqual([{ id: '1' }]);
      expect(res.total).toBe(1);
    });
  });

  describe('exportEmployees', () => {
    it('chunks and exports all employees', async () => {
      fromMock
        .mockImplementationOnce(() => createQueryBuilder({ data: Array(100).fill({ id: '1' }), error: null }))
        .mockImplementationOnce(() => createQueryBuilder({ data: [{ id: '101' }], error: null }));
      const res = await employeeService.exportEmployees({ chunkSize: 100 });
      expect(res.length).toBe(101);
    });
  });



  describe('deleteById', () => {
    it('deletes if no blocking records', async () => {
      rpcResults.check_employee_operational_records = { data: false };
      await employeeService.deleteById('e1');
      expect(rpcMock).toHaveBeenCalled();
      expect(fromMock).toHaveBeenCalledWith('employees');
    });

    it('throws if blocking records exist', async () => {
      rpcResults.check_employee_operational_records = { data: true };
      await expect(employeeService.deleteById('e1')).rejects.toThrow('لا يمكن حذف المندوب');
    });
  });

  describe('getActiveForSalaryContext', () => {
    it('paginates salary context', async () => {
      tableResults.employees = { data: [{ id: 'e1' }] };
      const res = await employeeService.getActiveForSalaryContext();
      expect(res.length).toBe(1);
    });
  });



  describe('getEmployeeAssignedAppNames', () => {
    it('gets names', async () => {
      tableResults.employee_apps = { data: [{ apps: { name: 'App1' } }] };
      const res = await employeeService.getEmployeeAssignedAppNames('e1');
      expect(res).toEqual(['App1']);
    });
  });

  describe('simple query methods return data', () => {
    it.each([
      ['getById', () => employeeService.getById('e1'), 'employees', { id: 'e1' }],
      ['findByNationalId', () => employeeService.findByNationalId('123'), 'employees', { id: 'e1' }],
      ['getActiveSalarySchemes', () => employeeService.getActiveSalarySchemes(), 'salary_schemes', [{ id: 's1' }]],
      ['getActiveApps', () => employeeService.getActiveApps(), 'apps', [{ id: 'a1' }]],
    ] as const)('%s returns expected data', async (_name, call, tableName, payload) => {
      tableResults[tableName] = { data: payload, error: null };
      await expect(call()).resolves.toEqual(payload);
    });
  });

  describe('simple query methods throw on database error', () => {
    it.each([
      ['getById', () => employeeService.getById('e1'), 'employees'],
      ['findByNationalId', () => employeeService.findByNationalId('123'), 'employees'],
      ['getActiveSalarySchemes', () => employeeService.getActiveSalarySchemes(), 'salary_schemes'],
      ['getActiveApps', () => employeeService.getActiveApps(), 'apps'],
    ])('%s throws when query fails', async (_name, call, tableName) => {
      tableResults[tableName] = { data: null, error: new Error(`${tableName} error`) };
      await expect(call()).rejects.toThrow(`${tableName} error`);
    });
  });

  describe('createEmployee', () => {
    it('returns created employee', async () => {
      tableResults.employees = { data: { id: 'e1', name: 'A' } };
      const res = await employeeService.createEmployee({ name: 'A' });
      expect(res).toEqual({ id: 'e1', name: 'A' });
    });
    it('throws on database error', async () => {
      tableResults.employees = { data: null, error: new Error('duplicate key') };
      await expect(employeeService.createEmployee({ name: 'A' })).rejects.toThrow();
    });
  });

  describe('updateEmployee', () => {
    it('completes without error on success', async () => {
      tableResults.employees = { data: null };
      await expect(employeeService.updateEmployee('e1', { name: 'B' })).resolves.toBeUndefined();
    });
    it('throws on database error', async () => {
      tableResults.employees = { data: null, error: new Error('update failed') };
      await expect(employeeService.updateEmployee('e1', { name: 'B' })).rejects.toThrow('update failed');
    });
  });

  describe('uploadEmployeeDocument', () => {
    it('uploads safely', async () => {
      const file = new File([''], 'test.png');
      await employeeService.uploadEmployeeDocument('e1/doc.png', file);
      expect(uploadMock).toHaveBeenCalled();
    });

    it('throws on unsafe path', async () => {
      const file = new File([''], 'test.png');
      await expect(employeeService.uploadEmployeeDocument('../e1/doc.png', file)).rejects.toThrow();
    });
  });

  describe('updateEmployeeDocumentPaths', () => {
    it('completes without error on success', async () => {
      tableResults.employees = { data: null };
      await expect(employeeService.updateEmployeeDocumentPaths('e1', { id: 'e1' })).resolves.toBeUndefined();
    });
    it('throws on database error', async () => {
      tableResults.employees = { data: null, error: new Error('paths update failed') };
      await expect(employeeService.updateEmployeeDocumentPaths('e1', { id: 'e1' })).rejects.toThrow('paths update failed');
    });
  });

  describe('deleteEmployeeDocuments', () => {
    it('deletes safe paths', async () => {
      await employeeService.deleteEmployeeDocuments(['e1/doc.png']);
      expect(removeMock).toHaveBeenCalled();
    });
  });

  describe('replaceEmployeeApps', () => {
    it('completes without error on success', async () => {
      tableResults.employee_apps = { data: null };
      await expect(employeeService.replaceEmployeeApps('e1', ['a1', 'a2'])).resolves.toBeUndefined();
    });
    it('throws on database error', async () => {
      tableResults.employee_apps = { data: null, error: new Error('replace failed') };
      await expect(employeeService.replaceEmployeeApps('e1', ['a1'])).rejects.toThrow('replace failed');
    });
  });

  describe('upsertEmployeeApp', () => {
    it('completes without error on success', async () => {
      tableResults.employee_apps = { data: null };
      await expect(employeeService.upsertEmployeeApp('e1', 'a1')).resolves.toBeUndefined();
    });
    it('throws on database error', async () => {
      tableResults.employee_apps = { data: null, error: new Error('upsert app failed') };
      await expect(employeeService.upsertEmployeeApp('e1', 'a1')).rejects.toThrow('upsert app failed');
    });
  });

  describe('updateCity', () => {
    it('completes without error on success', async () => {
      tableResults.employees = { data: null };
      await expect(employeeService.updateCity('e1', 'jeddah')).resolves.toBeUndefined();
    });
    it('throws on database error', async () => {
      tableResults.employees = { data: null, error: new Error('city update failed') };
      await expect(employeeService.updateCity('e1', 'jeddah')).rejects.toThrow('city update failed');
    });
  });
});
