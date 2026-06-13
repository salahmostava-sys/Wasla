import { describe, expect, it } from 'vitest';
import { cn, safeStr } from './utils';

describe('cn', () => {
  it('merges class names with tailwind-merge', () => {
    expect(cn('px-2 py-1', 'px-4')).toBe('py-1 px-4');
  });
});

describe('safeStr — [object Object] guard for salary slips', () => {
  it('returns the string as-is when value is a non-empty string', () => {
    expect(safeStr('أحمد محمد')).toBe('أحمد محمد');
    expect(safeStr('SA12345678901234567890')).toBe('SA12345678901234567890');
  });

  it('converts numbers to strings', () => {
    expect(safeStr(12345)).toBe('12345');
    expect(safeStr(0)).toBe('0');
    expect(safeStr(3.14)).toBe('3.14');
  });

  it('returns fallback for null', () => {
    expect(safeStr(null)).toBe('');
    expect(safeStr(null, '—')).toBe('—');
    expect(safeStr(null, 'مندوب توصيل')).toBe('مندوب توصيل');
  });

  it('returns fallback for undefined', () => {
    expect(safeStr(undefined)).toBe('');
    expect(safeStr(undefined, '•')).toBe('•');
  });

  it('returns fallback for empty string', () => {
    expect(safeStr('', 'مندوب توصيل')).toBe('مندوب توصيل');
    expect(safeStr('')).toBe('');
  });

  // Critical: this is the exact scenario that produces "[object Object]" in salary slips
  it('returns fallback (NOT "[object Object]") when Supabase returns an embedded object', () => {
    // Supabase JOIN may return { id: 'uuid', name: 'Driver' } instead of a plain string
    expect(safeStr({ id: 'uuid', name: 'Driver' })).toBe('');
    expect(safeStr({ id: 'uuid', name: 'Driver' }, 'مندوب توصيل')).toBe('مندوب توصيل');
    expect(safeStr([])).toBe('');
    expect(safeStr({})).toBe('');
  });

  it('never produces the string "[object Object]"', () => {
    const problematicInputs: unknown[] = [
      { name: 'Ahmed' },
      [1, 2, 3],
      { toString: () => '[object Object]' },
    ];
    for (const input of problematicInputs) {
      const result = safeStr(input, 'FALLBACK');
      expect(result).not.toBe('[object Object]');
      expect(result).toBe('FALLBACK');
    }
  });
});

