import { describe, expect, it } from 'vitest';
import { buildFuelMetricTemplateRows } from './fuelSpreadsheetImport';

describe('buildFuelMetricTemplateRows', () => {
  it('prefills every rider with the current metric values for each day', () => {
    expect(buildFuelMetricTemplateRows(
      [1, 2, 3],
      [{ id: 'employee-1', name: 'أحمد محمد' }, { id: 'employee-2', name: 'خالد علي' }],
      'fuel',
      [
        {
          id: 'row-1',
          employee_id: 'employee-1',
          date: '2026-07-02',
          km_total: 120,
          fuel_cost: 45,
          notes: null,
        },
      ],
    )).toEqual([
      ['اسم المندوب', 'اليوم 1', 'اليوم 2', 'اليوم 3'],
      ['أحمد محمد', '', 45, ''],
      ['خالد علي', '', '', ''],
    ]);
  });
});
