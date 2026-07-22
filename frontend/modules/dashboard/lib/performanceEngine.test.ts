import { describe, expect, it } from 'vitest';
import {
  computeBestDaysAnalytics,
  computeWeeklyBreakdown,
} from './performanceEngine';

describe('performanceEngine — Weekly & Best Days Analytics', () => {

  describe('computeWeeklyBreakdown', () => {
    it('returns empty array when dailyTrend is empty', () => {
      expect(computeWeeklyBreakdown([])).toEqual([]);
    });

    it('correctly aggregates orders into weeks W1 through W5', () => {
      const dailyTrend = [
        { date: '2026-07-01', orders: 100 },
        { date: '2026-07-05', orders: 150 },
        { date: '2026-07-10', orders: 200 },
        { date: '2026-07-16', orders: 300 },
        { date: '2026-07-25', orders: 250 },
        { date: '2026-07-30', orders: 100 },
      ];

      const weeks = computeWeeklyBreakdown(dailyTrend);
      expect(weeks.length).toBe(5);

      // W1: July 1 and July 5 -> 250 orders
      expect(weeks[0].weekNumber).toBe(1);
      expect(weeks[0].totalOrders).toBe(250);
      expect(weeks[0].activeDaysCount).toBe(2);

      // W2: July 10 -> 200 orders
      expect(weeks[1].weekNumber).toBe(2);
      expect(weeks[1].totalOrders).toBe(200);

      // W3: July 16 -> 300 orders
      expect(weeks[2].weekNumber).toBe(3);
      expect(weeks[2].totalOrders).toBe(300);

      // W4: July 25 -> 250 orders
      expect(weeks[3].weekNumber).toBe(4);

      // W5: July 30 -> 100 orders
      expect(weeks[4].weekNumber).toBe(5);
    });
  });

  describe('computeBestDaysAnalytics', () => {
    it('returns default empty structure when dailyTrend is empty', () => {
      const res = computeBestDaysAnalytics([]);
      expect(res.topPeakDays).toEqual([]);
      expect(res.bestDayOfWeek).toBeNull();
      expect(res.highestSingleDayOrders).toBe(0);
    });

    it('identifies top 3 peak days and highest single day orders', () => {
      const dailyTrend = [
        { date: '2026-07-01', orders: 100 },
        { date: '2026-07-02', orders: 500 }, // Top 1
        { date: '2026-07-03', orders: 400 }, // Top 2
        { date: '2026-07-04', orders: 300 }, // Top 3
        { date: '2026-07-05', orders: 200 },
      ];

      const res = computeBestDaysAnalytics(dailyTrend);
      expect(res.highestSingleDayOrders).toBe(500);
      expect(res.topPeakDays.length).toBe(3);
      expect(res.topPeakDays[0].orders).toBe(500);
      expect(res.topPeakDays[0].date).toBe('2026-07-02');
    });
  });

});
