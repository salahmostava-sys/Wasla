import { describe, it, expect } from 'vitest';
import {
  normalizeCustomColumns,
  toAppFormValues,
  toAppUpsertPayload,
  buildAppsOverview,
  getMonthBounds,
  buildAppEmployees,
} from './appsModel';

describe('appsModel', () => {
  describe('normalizeCustomColumns', () => {
    it('returns empty array for invalid input', () => {
      expect(normalizeCustomColumns(null)).toEqual([]);
      expect(normalizeCustomColumns(undefined)).toEqual([]);
      expect(normalizeCustomColumns('invalid')).toEqual([]);
    });

    it('normalizes valid custom columns', () => {
      const input = [{ key: 'id', label: 'ID' }, { invalid: 'test' }, null, { key: 'name', label: 'Name' }];
      expect(normalizeCustomColumns(input)).toEqual([
        { key: 'id', label: 'ID' },
        { key: 'name', label: 'Name' },
      ]);
    });
  });

  describe('toAppFormValues', () => {
    it('returns default values for null input', () => {
      const values = toAppFormValues(null);
      expect(values.name).toBe('');
      expect(values.name_en).toBe('');
      expect(values.brand_color).toBe('#6366f1');
      expect(values.is_active).toBe(true);
      expect(values.custom_columns).toEqual([]);
    });

    it('returns correctly mapped values', () => {
      const app = {
        name: 'App',
        name_en: 'App EN',
        brand_color: '#ffffff',
        text_color: '#000000',
        is_active: false,
        custom_columns: [{ key: 'test', label: 'Test' }]
      };
      const values = toAppFormValues(app as any);
      expect(values).toEqual(app);
    });
  });

  describe('toAppUpsertPayload', () => {
    it('trims string fields and maps to payload', () => {
      const input = {
        name: '  App  ',
        name_en: '  ',
        brand_color: '#fff',
        text_color: '#000',
        is_active: true,
        custom_columns: []
      };
      const payload = toAppUpsertPayload(input);
      expect(payload).toEqual({
        name: 'App',
        name_en: null,
        brand_color: '#fff',
        text_color: '#000',
        is_active: true,
        custom_columns: []
      });
    });
  });

  describe('buildAppsOverview', () => {
    it('builds overview correctly with order counts and visible employees', () => {
      const apps = [{
        id: '1',
        name: 'App1',
        name_en: null,
        brand_color: '#000',
        text_color: '#fff',
        is_active: true,
      }];
      
      const orders = [
        { app_id: '1', orders_count: 5 },
        { app_id: '1', orders_count: 10 },
      ] as any;

      const assignments = [
        { app_id: '1', employee_id: 'emp1', employees: { status: 'active', sponsorship_status: 'transfer' } }, // visible
        { app_id: '1', employee_id: 'emp2', employees: { status: 'inactive' } }, // invisible
        { app_id: '1', employee_id: 'emp3', employees: { status: 'active', sponsorship_status: 'absconded' } }, // invisible
      ] as any;

      const overview = buildAppsOverview(apps, orders, assignments);
      expect(overview).toHaveLength(1);
      expect(overview[0].employeeCount).toBe(1);
      expect(overview[0].ordersCount).toBe(15);
    });
  });

  describe('getMonthBounds', () => {
    it('returns bounds for current month correctly', () => {
      const refDate = new Date('2023-10-15');
      const bounds = getMonthBounds('2023-10', refDate);
      expect(bounds.startDate).toBe('2023-10-01');
      expect(bounds.endDate).toBe('2023-10-31');
      expect(bounds.daysInMonth).toBe(31);
      expect(bounds.daysPassed).toBe(15); // current month uses current day
    });

    it('returns bounds for past month correctly', () => {
      const refDate = new Date('2023-11-15');
      const bounds = getMonthBounds('2023-10', refDate);
      expect(bounds.daysPassed).toBe(31); // past month uses days in month
    });
  });

  describe('buildAppEmployees', () => {
    it('builds app employees with targets and projection', () => {
      const assignments = [
        { employees: { id: '1', name: 'Emp 1', status: 'active', sponsorship_status: 'transfer' } }
      ] as any;

      const orders = [
        { employee_id: '1', orders_count: 10 }
      ] as any;

      const result = buildAppEmployees({
        assignments,
        orderRows: orders,
        targetOrders: 100, // 1 rider -> target is 100
        employeeTargetOrders: null,
        daysInMonth: 30,
        daysPassed: 15,
      });

      expect(result).toHaveLength(1);
      const emp = result[0];
      expect(emp.monthOrders).toBe(10);
      expect(emp.targetShare).toBe(100);
      
      // projected: (10 / 15) * 30 = 20
      expect(emp.projectedMonthEnd).toBe(20);
      expect(emp.onTrack).toBe(false); // 20 is not >= 95
    });

    it('handles no target gracefully', () => {
      const assignments = [
        { employees: { id: '1', name: 'Emp 1', status: 'active', sponsorship_status: 'transfer' } }
      ] as any;

      const result = buildAppEmployees({
        assignments,
        orderRows: [],
        targetOrders: null,
        employeeTargetOrders: null,
        daysInMonth: 30,
        daysPassed: 15,
      });

      expect(result).toHaveLength(1);
      expect(result[0].onTrack).toBeNull();
      expect(result[0].targetShare).toBeNull();
    });
  });
});
