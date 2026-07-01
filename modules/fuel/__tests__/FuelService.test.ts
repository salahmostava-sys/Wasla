import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as FuelService from '../services/fuelService';
import { supabase } from '@/lib/supabase';

vi.mock('@/lib/supabase');

describe('FuelService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('recordFuelConsumption', () => {
    it('should record fuel consumption', async () => {
      const mockRecord = {
        id: 'fuel-123',
        vehicle_id: 'v-1',
        liters: 50,
        cost: 250,
        date: '2026-07-01',
      };

      vi.mocked(supabase).from().insert().select().single.mockResolvedValueOnce({
        data: mockRecord,
        error: null,
      });

      const result = await FuelService.recordFuelConsumption({
        vehicle_id: 'v-1',
        liters: 50,
        cost: 250,
      });

      expect(result).toEqual(mockRecord);
    });

    it('should validate liters > 0', async () => {
      await expect(
        FuelService.recordFuelConsumption({
          vehicle_id: 'v-1',
          liters: 0,
          cost: 250,
        })
      ).rejects.toThrow();
    });
  });

  describe('getFuelReports', () => {
    it('should fetch fuel reports', async () => {
      const mockReports = [
        { id: 'fuel-1', liters: 50, cost: 250 },
        { id: 'fuel-2', liters: 45, cost: 225 },
      ];

      vi.mocked(supabase).from().select().gte.mockResolvedValueOnce({
        data: mockReports,
        error: null,
      });

      const result = await FuelService.getFuelReports('2026-06', '2026-07');

      expect(result).toHaveLength(2);
    });
  });
});
