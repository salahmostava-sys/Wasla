import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { isStringRecord, usePersistentState } from './usePersistentState';

describe('usePersistentState', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('uses the fallback when no preference exists', () => {
    const { result } = renderHook(() => usePersistentState('table:test', { search: '' }, isStringRecord));

    expect(result.current[0]).toEqual({ search: '' });
  });

  it('loads valid stored preferences', () => {
    localStorage.setItem('table:test', JSON.stringify({ search: 'Honda' }));

    const { result } = renderHook(() => usePersistentState('table:test', { search: '' }, isStringRecord));

    expect(result.current[0]).toEqual({ search: 'Honda' });
  });

  it('rejects malformed stored preferences', () => {
    localStorage.setItem('table:test', JSON.stringify({ search: 42 }));

    const { result } = renderHook(() => usePersistentState('table:test', { search: '' }, isStringRecord));

    expect(result.current[0]).toEqual({ search: '' });
  });

  it('persists state updates', async () => {
    const { result } = renderHook(() => usePersistentState('table:test', { search: '' }, isStringRecord));

    act(() => result.current[1]({ search: 'rider' }));

    await waitFor(() => {
      expect(JSON.parse(localStorage.getItem('table:test') ?? '{}')).toEqual({ search: 'rider' });
    });
  });
});

describe('isStringRecord', () => {
  it('accepts plain string records only', () => {
    expect(isStringRecord({ status: 'active' })).toBe(true);
    expect(isStringRecord({ status: 1 })).toBe(false);
    expect(isStringRecord(['active'])).toBe(false);
  });
});
