import { describe, expect, it } from 'vitest';
import {
  isExcludedSponsorshipStatus,
  isEmployeeVisibleInMonth,
  isEmployeeRetainedForMonth,
  isEmployeeVisibleForSalaryMonth,
  isOperationallyVisibleEmployee,
  isAttendanceRosterVisibleOnDate,
  isAttendanceRosterVisibleInMonth,
} from '../employeeVisibility';

describe('employeeVisibility', () => {
  it('isExcludedSponsorshipStatus works correctly', () => {
    expect(isExcludedSponsorshipStatus('absconded')).toBe(true);
    expect(isExcludedSponsorshipStatus('terminated')).toBe(true);
    expect(isExcludedSponsorshipStatus('active')).toBe(false);
    expect(isExcludedSponsorshipStatus(null)).toBe(false);
  });

  describe('isEmployeeVisibleInMonth', () => {
    it('returns true if status is active (not excluded) and data not yet loaded', () => {
      expect(isEmployeeVisibleInMonth({ id: '1', sponsorship_status: 'active' }, null)).toBe(true);
    });

    it('returns true if active employee has orders in month', () => {
      expect(isEmployeeVisibleInMonth({ id: '1', sponsorship_status: 'active' }, new Set(['1']))).toBe(true);
    });

    // STRICT FILTERING: absconded/terminated are ALWAYS hidden regardless of active set
    it('returns false for absconded even if activeEmployeeIdsInMonth is undefined', () => {
      expect(isEmployeeVisibleInMonth({ id: '1', sponsorship_status: 'absconded' }, undefined)).toBe(false);
    });

    it('returns false for absconded even if in activeEmployeeIdsInMonth', () => {
      expect(isEmployeeVisibleInMonth({ id: '1', sponsorship_status: 'absconded' }, new Set(['1']))).toBe(false);
    });

    it('returns false if not in activeEmployeeIdsInMonth', () => {
      expect(isEmployeeVisibleInMonth({ id: '1', sponsorship_status: 'absconded' }, new Set(['2']))).toBe(false);
    });

    it('returns false for inventory job title', () => {
      expect(isEmployeeVisibleInMonth({ id: '1', status: 'active', job_title: '\u0623\u0645\u064a\u0646 \u0645\u0633\u062a\u0648\u062f\u0639' }, new Set(['1']))).toBe(false);
    });
  });

  describe('isEmployeeRetainedForMonth', () => {
    it('returns true if status is active', () => {
      expect(isEmployeeRetainedForMonth({ id: '1', status: 'active' }, new Set())).toBe(true);
    });

    it('returns false if status is not active and not in active set', () => {
      expect(isEmployeeRetainedForMonth({ id: '1', status: 'pending' }, new Set())).toBe(false);
    });

    it('returns true if in active set', () => {
      expect(isEmployeeRetainedForMonth({ id: '1', status: 'pending' }, new Set(['1']))).toBe(true);
    });

    it('returns false for absconded even if in active set', () => {
      expect(isEmployeeRetainedForMonth({ id: '1', status: 'active', sponsorship_status: 'absconded' }, new Set(['1']))).toBe(false);
    });
  });

  describe('isEmployeeVisibleForSalaryMonth', () => {
    it('returns true if not excluded (active employee)', () => {
      expect(isEmployeeVisibleForSalaryMonth({ id: '1', sponsorship_status: 'active' }, '2026-05-01', new Set())).toBe(true);
    });

    // STRICT FILTERING: absconded/terminated are ALWAYS hidden
    it('returns false for absconded even if active set is undefined', () => {
      expect(isEmployeeVisibleForSalaryMonth({ id: '1', sponsorship_status: 'absconded' }, '2026-05-01', undefined)).toBe(false);
    });

    it('returns false for absconded even if visible in attendance roster', () => {
      expect(isEmployeeVisibleForSalaryMonth({ id: '1', sponsorship_status: 'absconded', probation_end_date: '2026-06-01' }, '2026-05-01', new Set())).toBe(false);
    });

    it('returns false for absconded even if in active set', () => {
      expect(isEmployeeVisibleForSalaryMonth({ id: '1', sponsorship_status: 'absconded', probation_end_date: '2026-04-01' }, '2026-05-01', new Set(['1']))).toBe(false);
    });

    it('returns false if not visible and not active', () => {
      expect(isEmployeeVisibleForSalaryMonth({ id: '1', sponsorship_status: 'absconded', probation_end_date: '2026-04-01' }, '2026-05-01', new Set(['2']))).toBe(false);
    });
  });

  describe('isOperationallyVisibleEmployee', () => {
    it('returns true if not excluded', () => {
      expect(isOperationallyVisibleEmployee({ sponsorship_status: 'active' })).toBe(true);
    });

    it('returns false if probation_end_date is missing', () => {
      expect(isOperationallyVisibleEmployee({ sponsorship_status: 'absconded' })).toBe(false);
    });

    it('returns true if today is before effective date', () => {
      expect(isOperationallyVisibleEmployee({ sponsorship_status: 'absconded', probation_end_date: '2026-06-01' }, new Date('2026-05-01'))).toBe(true);
    });

    it('returns false if today is after effective date', () => {
      expect(isOperationallyVisibleEmployee({ sponsorship_status: 'absconded', probation_end_date: '2026-04-01' }, new Date('2026-05-01'))).toBe(false);
    });

    it('returns false for inventory job title', () => {
      expect(isOperationallyVisibleEmployee({ sponsorship_status: 'active', job_title: '\u0645\u0633\u0624\u0648\u0644 \u0645\u062e\u0632\u0648\u0646' })).toBe(false);
    });
  });

  describe('isAttendanceRosterVisibleOnDate', () => {
    it('returns true if not excluded', () => {
      expect(isAttendanceRosterVisibleOnDate({ id: '1', sponsorship_status: 'active' }, new Date())).toBe(true);
    });

    it('returns false for absconded with no probation date', () => {
      expect(isAttendanceRosterVisibleOnDate({ id: '1', sponsorship_status: 'absconded' }, new Date())).toBe(false);
    });

    it('returns true if asOfDate is before effective date', () => {
      expect(isAttendanceRosterVisibleOnDate({ id: '1', sponsorship_status: 'absconded', probation_end_date: '2026-06-01' }, new Date('2026-05-01'))).toBe(true);
    });

    it('returns false if asOfDate is after effective date', () => {
      expect(isAttendanceRosterVisibleOnDate({ id: '1', sponsorship_status: 'absconded', probation_end_date: '2026-04-01' }, new Date('2026-05-01'))).toBe(false);
    });
  });

  describe('isAttendanceRosterVisibleInMonth', () => {
    it('returns true if not excluded', () => {
      expect(isAttendanceRosterVisibleInMonth({ id: '1', sponsorship_status: 'active' }, '2026-05-01')).toBe(true);
    });

    it('returns false for absconded with missing probation date', () => {
      expect(isAttendanceRosterVisibleInMonth({ id: '1', sponsorship_status: 'absconded' }, '2026-05-01')).toBe(false);
    });

    it('returns true if effective date is in or after monthStart', () => {
      expect(isAttendanceRosterVisibleInMonth({ id: '1', sponsorship_status: 'absconded', probation_end_date: '2026-05-15' }, '2026-05-01')).toBe(true);
    });

    it('returns false if effective date is before monthStart', () => {
      expect(isAttendanceRosterVisibleInMonth({ id: '1', sponsorship_status: 'absconded', probation_end_date: '2026-04-15' }, '2026-05-01')).toBe(false);
    });
  });
});
