import { describe, it, expect } from 'vitest';
import {
  parseBranchFilter,
  getEmployeeFieldValue,
  getEmployeeCities,
  getEmployeePrimaryCity,
  applyEmployeeFilters,
  sortEmployees,
  type Employee,
} from '@modules/employees/model/employeeUtils';

describe('employeeUtils', () => {
  const mockEmployee: Employee = {
    id: '1',
    name: 'محمد أحمد',
    name_en: 'Mohammed Ahmed',
    job_title: 'سائق',
    phone: '0501234567',
    email: 'test@example.com',
    national_id: '1234567890',
    city: 'makkah',
    cities: ['makkah'],
    join_date: '2024-01-15',
    birth_date: '1990-05-20',
    residency_expiry: '2025-12-31',
    status: 'active',
    salary_type: 'shift',
    base_salary: 5000,
    license_status: 'has_license',
    sponsorship_status: 'sponsored',
  };

  describe('parseBranchFilter', () => {
    it('should return valid branch keys', () => {
      expect(parseBranchFilter('makkah')).toBe('makkah');
      expect(parseBranchFilter('jeddah')).toBe('jeddah');
    });

    it('should return undefined for "all"', () => {
      expect(parseBranchFilter('all')).toBeUndefined();
    });
  });

  describe('getEmployeeFieldValue', () => {
    it('should get field values', () => {
      expect(getEmployeeFieldValue(mockEmployee, 'name')).toBe('محمد أحمد');
      expect(getEmployeeFieldValue(mockEmployee, 'base_salary')).toBe(5000);
    });

    it('should return undefined for non-existent fields', () => {
      expect(getEmployeeFieldValue(mockEmployee, 'nonexistent')).toBeUndefined();
    });
  });

  describe('getEmployeeCities', () => {
    it('should return cities array', () => {
      const cities = getEmployeeCities(mockEmployee);
      expect(cities).toEqual(['makkah']);
    });

    it('should handle null cities', () => {
      const emp = { ...mockEmployee, cities: null, city: 'makkah' };
      const cities = getEmployeeCities(emp);
      expect(cities).toContain('makkah');
    });

    it('should handle empty cities', () => {
      const emp = { ...mockEmployee, cities: [], city: null };
      const cities = getEmployeeCities(emp);
      expect(cities).toEqual([]);
    });
  });

  describe('getEmployeePrimaryCity', () => {
    it('should return first city from cities array', () => {
      expect(getEmployeePrimaryCity(mockEmployee)).toBe('makkah');
    });

    it('should fallback to city field', () => {
      const emp = { ...mockEmployee, cities: null };
      expect(getEmployeePrimaryCity(emp)).toBe('makkah');
    });

    it('should return null if no cities', () => {
      const emp = { ...mockEmployee, cities: null, city: null };
      expect(getEmployeePrimaryCity(emp)).toBeNull();
    });
  });

  describe('applyEmployeeFilters', () => {
    const employees: Employee[] = [
      mockEmployee,
      {
        ...mockEmployee,
        id: '2',
        name: 'علي حسن',
        status: 'inactive',
        city: 'jeddah',
        cities: ['jeddah'],
        phone: '0559876543',
        national_id: '9876543210',
      },
    ];

    it('should filter by name', () => {
      const result = applyEmployeeFilters(employees, { name: 'محمد' });
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('محمد أحمد');
    });

    it('should filter by status', () => {
      const result = applyEmployeeFilters(employees, { status: 'active' });
      expect(result).toHaveLength(1);
      expect(result[0].status).toBe('active');
    });

    it('should filter by city', () => {
      const result = applyEmployeeFilters(employees, { city: 'jeddah' });
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('2');
    });

    it('should apply multiple filters', () => {
      const result = applyEmployeeFilters(employees, {
        status: 'active',
        city: 'makkah',
      });
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('1');
    });

    it('should return all when no filters', () => {
      const result = applyEmployeeFilters(employees, {});
      expect(result).toHaveLength(2);
    });

    it('should filter by phone', () => {
      const result = applyEmployeeFilters(employees, { phone: '0501234567' });
      expect(result).toHaveLength(1);
    });

    it('should filter by national_id', () => {
      const result = applyEmployeeFilters(employees, { national_id: '1234567890' });
      expect(result).toHaveLength(1);
    });
  });

  describe('sortEmployees', () => {
    const employees: Employee[] = [
      { ...mockEmployee, id: '1', name: 'محمد', base_salary: 5000 },
      { ...mockEmployee, id: '2', name: 'أحمد', base_salary: 6000 },
      { ...mockEmployee, id: '3', name: 'علي', base_salary: 4000 },
    ];

    it('should sort by name ascending', () => {
      const result = sortEmployees(employees, 'name', 'asc');
      expect(result[0].name).toBe('أحمد');
      expect(result[2].name).toBe('محمد');
    });

    it('should sort by name descending', () => {
      const result = sortEmployees(employees, 'name', 'desc');
      expect(result[0].name).toBe('محمد');
      expect(result[2].name).toBe('أحمد');
    });

    it('should sort by salary ascending', () => {
      const result = sortEmployees(employees, 'base_salary', 'asc');
      expect(result[0].base_salary).toBe(4000);
      expect(result[2].base_salary).toBe(6000);
    });

    it('should sort by salary descending', () => {
      const result = sortEmployees(employees, 'base_salary', 'desc');
      expect(result[0].base_salary).toBe(6000);
      expect(result[2].base_salary).toBe(4000);
    });

    it('should return original array when no sort', () => {
      const result = sortEmployees(employees, null, null);
      expect(result).toEqual(employees);
    });

    it('should not mutate original array', () => {
      const original = [...employees];
      sortEmployees(employees, 'name', 'asc');
      expect(employees).toEqual(original);
    });
  });
});
