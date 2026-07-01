import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as MaintenanceService from '../services/maintenanceService';
import { supabase } from '@/lib/supabase';

vi.mock('@/lib/supabase');

describe('MaintenanceService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createMaintenanceRequest', () => {
    it('should create maintenance request', async () => {
      const mockRequest = {
        id: 'maint-123',
        vehicle_id: 'v-1',
        type: 'oil_change',
        status: 'pending',
        cost: 500,
      };

      vi.mocked(supabase).from().insert().select().single.mockResolvedValueOnce({
        data: mockRequest,
        error: null,
      });

      const result = await MaintenanceService.createMaintenanceRequest({
        vehicle_id: 'v-1',
        type: 'oil_change',
        description: 'Regular oil change',
      });

      expect(result).toEqual(mockRequest);
    });

    it('should validate required fields', async () => {
      await expect(
        MaintenanceService.createMaintenanceRequest({
          vehicle_id: '',
          type: 'oil_change',
          description: 'Regular oil change',
        })
      ).rejects.toThrow();
    });
  });

  describe('getMaintenanceHistory', () => {
    it('should fetch maintenance history for vehicle', async () => {
      const mockHistory = [
        { id: 'maint-1', type: 'oil_change', status: 'completed' },
        { id: 'maint-2', type: 'tire_rotation', status: 'completed' },
      ];

      vi.mocked(supabase).from().select().eq.mockResolvedValueOnce({
        data: mockHistory,
        error: null,
      });

      const result = await MaintenanceService.getMaintenanceHistory('v-1');

      expect(result).toHaveLength(2);
    });
  });
});
