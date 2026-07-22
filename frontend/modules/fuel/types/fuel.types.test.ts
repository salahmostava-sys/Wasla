import { describe, expect, it } from 'vitest';
import {
  applyDailyFilters,
  buildMonthlyAggMap,
  buildMonthlyRows,
  buildOrdersMap,
  mapDailyRows,
} from './fuel.types';
import type { DailyMileageResponseRow, Employee } from './fuel.types';

const mileageRows: DailyMileageResponseRow[] = [
  {
    id: 'mileage-1',
    employee_id: 'employee-1',
    date: '2026-07-01',
    km_total: 100,
    fuel_cost: 30,
    notes: null,
    employees: { name: 'Rider One', personal_photo_url: null },
  },
  {
    id: 'mileage-2',
    employee_id: 'employee-1',
    date: '2026-07-02',
    km_total: 80,
    fuel_cost: 20,
    notes: null,
    employees: { name: 'Rider One', personal_photo_url: null },
  },
  {
    id: 'mileage-3',
    employee_id: 'employee-2',
    date: '2026-07-01',
    km_total: 50,
    fuel_cost: 15,
    notes: null,
    employees: { name: 'Rider Two', personal_photo_url: null },
  },
];

const employees: Employee[] = [
  { id: 'employee-1', name: 'Rider One', job_title: 'Delivery rider', status: 'active' },
  { id: 'employee-2', name: 'Rider Two', job_title: 'Delivery rider', status: 'active' },
];

describe('fuel row derivation', () => {
  it('reuses raw monthly data to build the summary for the selected platform', () => {
    const platformEmployeeIds = new Set(['employee-1']);
    const aggregate = buildMonthlyAggMap(mileageRows, platformEmployeeIds);
    const orders = buildOrdersMap([
      { employee_id: 'employee-1', orders_count: 4 },
      { employee_id: 'employee-1', orders_count: 6 },
      { employee_id: 'employee-2', orders_count: 8 },
    ]);

    const rows = buildMonthlyRows(
      aggregate,
      orders,
      {
        'employee-1': {
          plate_number: 'ABC 1234',
          type: 'motorcycle',
          brand: 'Honda',
          model: '2026',
        },
      },
      employees,
      employees,
      platformEmployeeIds,
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      employee_id: 'employee-1',
      km_total: 180,
      fuel_cost: 50,
      orders_count: 10,
      daily_count: 2,
      vehicle: { plate_number: 'ABC 1234' },
    });
  });

  it('filters the same daily rows locally without changing their values', () => {
    const mappedRows = mapDailyRows(mileageRows);

    expect(applyDailyFilters(mappedRows, 'employee-2', null)).toEqual([
      expect.objectContaining({
        id: 'mileage-3',
        employee_id: 'employee-2',
        km_total: 50,
        fuel_cost: 15,
      }),
    ]);
    expect(applyDailyFilters(mappedRows, '_all_', new Set(['employee-1']))).toHaveLength(2);
  });
});
