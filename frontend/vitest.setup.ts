import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

// Stub side-effect dependencies so serviceError module runs for real
// without triggering logging, Sentry, or network calls.
vi.mock('@shared/lib/logger', () => ({
  logError: vi.fn(),
  logger: { error: vi.fn(), warn: vi.fn() },
  installGlobalErrorMonitoring: vi.fn(),
}));

// Cleanup after each test
afterEach(() => {
  cleanup();
});
