import { useEffect, useState, type Dispatch, type SetStateAction } from 'react';

type StateValidator<T> = (value: unknown) => value is T;

function readStoredState<T>(
  storageKey: string,
  fallback: T | (() => T),
  isValid: StateValidator<T>,
): T {
  const fallbackValue = typeof fallback === 'function'
    ? (fallback as () => T)()
    : fallback;

  try {
    const storedValue = globalThis.localStorage?.getItem(storageKey);
    if (!storedValue) return fallbackValue;

    const parsedValue: unknown = JSON.parse(storedValue);
    return isValid(parsedValue) ? parsedValue : fallbackValue;
  } catch {
    return fallbackValue;
  }
}

export function usePersistentState<T>(
  storageKey: string,
  fallback: T | (() => T),
  isValid: StateValidator<T>,
): readonly [T, Dispatch<SetStateAction<T>>] {
  const [state, setState] = useState<T>(() => readStoredState(storageKey, fallback, isValid));

  useEffect(() => {
    try {
      globalThis.localStorage?.setItem(storageKey, JSON.stringify(state));
    } catch {
      // Preferences remain available for the current session when storage is blocked.
    }
  }, [state, storageKey]);

  return [state, setState] as const;
}

export function isStringRecord(value: unknown): value is Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  return Object.values(value).every((entry) => typeof entry === 'string');
}
