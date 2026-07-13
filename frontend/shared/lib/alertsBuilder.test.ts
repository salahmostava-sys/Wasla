import { describe, expect, it } from 'vitest';
import { buildAlertsFromResponses } from './alertsBuilder';

describe('buildAlertsFromResponses', () => {
  it('includes commercial record name and renewal cost in employee expiry alerts when present', () => {
    const alerts = buildAlertsFromResponses(
      {
        employeesRes: {
          data: [
            {
              id: 'emp-1',
              name: 'أحمد',
              commercial_record: 'سجل مكة',
              residency_expiry: '2026-04-10',
              probation_end_date: null,
              health_insurance_expiry: null,
              license_expiry: null,
            },
          ],
        },
        vehiclesRes: { data: [] },
        platformAccountsRes: { data: [] },
        dbAlertsRes: { data: [] },
        sparePartsRes: { data: [] },
        abscondedRes: { data: [] },
        commercialRecordsRes: {
          data: [{
            name: 'سجل مكة',
            residency_renewal_monthly_cost: 650,
            residency_renewal_cost_period: 'yearly',
          }],
        },
      },
      '2026-04-30',
      new Date('2026-04-07T00:00:00Z'),
    );

    expect(alerts[0]).toMatchObject({
      id: 'res-emp-1',
      type: 'residency',
      residencyRenewalCost: 650,
      residencyRenewalCostPeriod: 'yearly',
    });
    expect(alerts[0]?.entityName).toContain('أحمد • السجل: سجل مكة');
    expect(alerts[0]?.entityName).toContain('650');
  });
});

