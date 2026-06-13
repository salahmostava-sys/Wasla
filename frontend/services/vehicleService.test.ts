import { beforeEach, describe, expect, it, vi } from 'vitest';

const { fromMock, filterEmpsMock } = vi.hoisted(() => {
  const fromMockLocal = vi.fn();
  return {
    fromMock: fromMockLocal,
    filterEmpsMock: vi.fn((emps: any[]) => emps),
  };
});

vi.mock('@services/supabase/client', () => ({
  supabase: {
    from: fromMock,
  },
}));


vi.mock('@shared/lib/employeeVisibility', () => ({
  filterOperationallyVisibleEmployees: filterEmpsMock,
}));

import { vehicleService, type VehiclePayload } from './vehicleService';

describe('vehicleService', () => {
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
              p.is = vi.fn().mockReturnValue(p);
              p.order = vi.fn().mockReturnValue(p);
              p.limit = vi.fn().mockReturnValue(p);
              p.single = vi.fn().mockResolvedValue(mockObj);
              return p;
    });
  });

  describe('getAll', () => {
    it('returns all vehicles successfully', async () => {
      tableMocks.vehicles = { data: [{ id: 'v1', plate_number: '123' }], error: null };
      const result = await vehicleService.getAll();
      expect(result).toEqual([{ id: 'v1', plate_number: '123' }]);
    });
    
    it('throws on database error', async () => {
      tableMocks.vehicles = { data: null, error: new Error('db error') };
      await expect(vehicleService.getAll()).rejects.toThrow('db error');
    });
  });

  describe('getAllWithCurrentRider', () => {
    it('combines vehicles and assignments', async () => {
      fromMock.mockImplementation((table: string) => {
        if (table === 'vehicles') {
           return {
             select: vi.fn().mockReturnThis(),
             order: vi.fn().mockReturnThis(),
             limit: vi.fn().mockResolvedValue({ data: [{ id: 'v1' }], error: null })
           };
        }
        const p: any = Promise.resolve({ data: [{ vehicle_id: 'v1', employees: { name: 'emp' } }], error: null });
                p.select = vi.fn().mockReturnValue(p);
                p.is = vi.fn().mockReturnValue(p);
                return p;
      });
      const res = await vehicleService.getAllWithCurrentRider();
      expect(res).toEqual([{ id: 'v1', current_rider: 'emp' }]);
    });
  });

  describe('getById', () => {
    it('returns a single vehicle', async () => {
      tableMocks.vehicles = { data: { id: 'v1' }, error: null };
      const res = await vehicleService.getById('v1');
      expect(res).toEqual({ id: 'v1' });
    });
  });

  describe('create', () => {
    it('creates vehicle', async () => {
      tableMocks.vehicles = { data: { id: 'v1' }, error: null };
      const res = await vehicleService.create({ plate_number: '123' } as VehiclePayload);
      expect(res).toEqual({ id: 'v1' });
    });
  });

  describe('update', () => {
    it('updates vehicle', async () => {
      tableMocks.vehicles = { data: { id: 'v1' }, error: null };
      const res = await vehicleService.update('v1', { plate_number: '123' });
      expect(res).toEqual({ id: 'v1' });
    });
  });

  describe('delete', () => {
    it('deletes vehicle', async () => {
      tableMocks.vehicles = { error: null };
      await vehicleService.delete('v1');
      expect(fromMock).toHaveBeenCalledWith('vehicles');
    });
  });

  describe('getAssignments', () => {
    it('returns assignments for vehicle', async () => {
      tableMocks.vehicle_assignments = { data: [{ id: 'a1' }], error: null };
      const res = await vehicleService.getAssignments('v1');
      expect(res).toHaveLength(1);
    });
  });

  describe('getActiveCount', () => {
    it('returns active count', async () => {
      fromMock.mockImplementation(() => {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockResolvedValue({ count: 5, error: null }),
        };
      });
      const res = await vehicleService.getActiveCount();
      expect(res).toBe(5);
    });
  });

  describe('getAssignmentsWithRelations', () => {
    it('returns assignments with relations', async () => {
      fromMock.mockImplementation(() => {
        return {
          select: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          limit: vi.fn().mockReturnThis(),
          lte: vi.fn().mockReturnThis(),
          or: vi.fn().mockResolvedValue({ data: [{ id: 'a1' }], error: null }),
        };
      });
      const res = await vehicleService.getAssignmentsWithRelations('2026-03');
      expect(res).toHaveLength(1);
    });
  });

  describe('getActiveAssignments', () => {
    it('returns active assignments', async () => {
      fromMock.mockImplementation(() => {
        return {
          select: vi.fn().mockReturnThis(),
          is: vi.fn().mockResolvedValue({ data: [{ vehicle_id: 'v1' }], error: null }),
        };
      });
      const res = await vehicleService.getActiveAssignments();
      expect(res).toHaveLength(1);
    });
  });

  describe('getActiveEmployees', () => {
    it('returns active employees', async () => {
      fromMock.mockImplementation(() => {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({ data: [{ id: 'e1' }], error: null }),
        };
      });
      const res = await vehicleService.getActiveEmployees();
      expect(res).toHaveLength(1);
    });
  });

  describe('createAssignment', () => {
    it('creates assignment', async () => {
      tableMocks.vehicle_assignments = { data: { id: 'a1' }, error: null };
      const res = await vehicleService.createAssignment({ vehicle_id: 'v1', employee_id: 'e1', start_date: '2026-03-01' });
      expect(res).toEqual({ id: 'a1' });
    });
  });

  describe('updateAssignment', () => {
    it('updates assignment', async () => {
      tableMocks.vehicle_assignments = { data: { id: 'a1' }, error: null };
      const res = await vehicleService.updateAssignment('a1', { end_date: '2026-03-02' });
      expect(res).toEqual({ id: 'a1' });
    });
  });

  describe('closeActiveAssignment', () => {
    it('closes assignment', async () => {
      fromMock.mockImplementation(() => {
        return {
          update: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          is: vi.fn().mockResolvedValue({ error: null }),
        };
      });
      await vehicleService.closeActiveAssignment('v1', '2026-03-02');
      expect(fromMock).toHaveBeenCalledWith('vehicle_assignments');
    });
  });

  describe('getForSelect', () => {
    it('returns for select', async () => {
      fromMock.mockImplementation(() => {
        return {
          select: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue({ data: [{ id: 'v1' }], error: null }),
        };
      });
      const res = await vehicleService.getForSelect();
      expect(res).toHaveLength(1);
    });
  });
});
