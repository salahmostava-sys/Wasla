import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as AdvanceService from '../services/advanceService';
import { supabase } from '@/lib/supabase';

vi.mock('@/lib/supabase');

describe('AdvanceService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createAdvance', () => {
    it('should create advance request with valid data', async () => {
      const mockData = {
        id: 'adv-123',
        employee_id: 'emp-123',
        amount: 1000,
        reason: 'emergency',
        status: 'pending',
      };

      vi.mocked(supabase).from().insert().select().single.mockResolvedValueOnce({
        data: mockData,
        error: null,
      });

      const result = await AdvanceService.createAdvance({
        employee_id: 'emp-123',
        amount: 1000,
        reason: 'emergency',
      });

      expect(result).toEqual(mockData);
    });

    it('should throw error when amount is invalid', async () => {
      await expect(
        AdvanceService.createAdvance({
          employee_id: 'emp-123',
          amount: -1000, // invalid
          reason: 'emergency',
        })
      ).rejects.toThrow();
    });

    it('should throw error when employee_id is missing', async () => {
      await expect(
        AdvanceService.createAdvance({
          employee_id: '',
          amount: 1000,
          reason: 'emergency',
        })
      ).rejects.toThrow();
    });
  });

  describe('getAdvances', () => {
    it('should fetch advances for employee', async () => {
      const mockAdvances = [
        { id: 'adv-1', amount: 1000, status: 'pending' },
        { id: 'adv-2', amount: 500, status: 'approved' },
      ];

      vi.mocked(supabase).from().select().eq.mockResolvedValueOnce({
        data: mockAdvances,
        error: null,
      });

      const result = await AdvanceService.getAdvances('emp-123');

      expect(result).toEqual(mockAdvances);
      expect(result).toHaveLength(2);
    });

    it('should handle error when fetching fails', async () => {
      vi.mocked(supabase).from().select().eq.mockResolvedValueOnce({
        data: null,
        error: new Error('Database error'),
      });

      await expect(
        AdvanceService.getAdvances('emp-123')
      ).rejects.toThrow();
    });
  });

  describe('approveAdvance', () => {
    it('should approve advance request', async () => {
      vi.mocked(supabase)
        .from()
        .update()
        .eq()
        .select()
        .single.mockResolvedValueOnce({
          data: { id: 'adv-123', status: 'approved' },
          error: null,
        });

      const result = await AdvanceService.approveAdvance('adv-123');

      expect(result.status).toBe('approved');
    });
  });
});
