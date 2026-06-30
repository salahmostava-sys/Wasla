import { describe, it, expect } from 'vitest';
import {
  sanitizeForLog,
  sanitizeObjectForLog,
  sanitizeHTML,
  maskSensitiveData,
  sanitizeError,
} from '@shared/lib/security/sanitize';

describe('security/sanitize', () => {
  describe('sanitizeForLog', () => {
    it('should strip control characters', () => {
      expect(sanitizeForLog('test\nvalue')).toBe('test value');
      expect(sanitizeForLog('test\rvalue')).toBe('test value');
      expect(sanitizeForLog('test\tvalue')).toBe('test value');
    });

    it('should mask sensitive data', () => {
      expect(sanitizeForLog('password=secret123')).toContain('***');
      expect(sanitizeForLog('token=abc123')).toContain('***');
    });

    it('should truncate long strings', () => {
      const longString = 'a'.repeat(2000);
      const result = sanitizeForLog(longString);
      expect(result.length).toBeLessThanOrEqual(1000);
    });

    it('should handle null and undefined', () => {
      expect(sanitizeForLog(null)).toBe('');
      expect(sanitizeForLog(undefined)).toBe('');
    });

    it('should convert non-strings', () => {
      expect(sanitizeForLog(123)).toBe('123');
      expect(sanitizeForLog(true)).toBe('true');
    });
  });

  describe('sanitizeObjectForLog', () => {
    it('should mask sensitive keys', () => {
      const obj = { username: 'user', password: 'secret', token: 'abc123' };
      const result = sanitizeObjectForLog(obj) as Record<string, unknown>;
      expect(result.username).toBe('user');
      expect(result.password).toBe('***');
      expect(result.token).toBe('***');
    });

    it('should handle nested objects', () => {
      const obj = { user: { name: 'test', password: 'secret' } };
      const result = sanitizeObjectForLog(obj) as Record<string, unknown>;
      const user = result.user as Record<string, unknown>;
      expect(user.name).toBe('test');
      expect(user.password).toBe('***');
    });

    it('should handle arrays', () => {
      const obj = { items: ['a', 'b', 'c'] };
      const result = sanitizeObjectForLog(obj) as Record<string, unknown>;
      expect(Array.isArray(result.items)).toBe(true);
      expect((result.items as string[])).toHaveLength(3);
    });

    it('should limit array size', () => {
      const obj = { items: new Array(100).fill('x') };
      const result = sanitizeObjectForLog(obj) as Record<string, unknown>;
      expect((result.items as string[]).length).toBeLessThanOrEqual(50);
    });

    it('should prevent deep recursion', () => {
      const obj: Record<string, unknown> = {};
      let current = obj;
      for (let i = 0; i < 20; i++) {
        current.nested = {};
        current = current.nested as Record<string, unknown>;
      }
      const result = sanitizeObjectForLog(obj);
      expect(result).toBeDefined();
    });

    it('should handle null and undefined', () => {
      expect(sanitizeObjectForLog(null)).toBeNull();
      expect(sanitizeObjectForLog(undefined)).toBeUndefined();
    });

    it('should sanitize string values', () => {
      const obj = { message: 'test\nvalue' };
      const result = sanitizeObjectForLog(obj) as Record<string, unknown>;
      expect(result.message).toBe('test value');
    });
  });

  describe('sanitizeHTML', () => {
    it('should escape HTML special characters', () => {
      expect(sanitizeHTML('<script>alert("xss")</script>')).toBe(
        '&lt;script&gt;alert(&quot;xss&quot;)&lt;&#x2F;script&gt;'
      );
    });

    it('should escape ampersands', () => {
      expect(sanitizeHTML('Tom & Jerry')).toBe('Tom &amp; Jerry');
    });

    it('should escape quotes', () => {
      expect(sanitizeHTML('He said "hello"')).toContain('&quot;');
      expect(sanitizeHTML("It's fine")).toContain('&#x27;');
    });

    it('should handle empty string', () => {
      expect(sanitizeHTML('')).toBe('');
    });
  });

  describe('maskSensitiveData', () => {
    it('should mask password patterns', () => {
      expect(maskSensitiveData('password=secret123')).toBe('password=***');
      expect(maskSensitiveData('passwd=secret123')).toBe('passwd=***');
    });

    it('should mask token patterns', () => {
      expect(maskSensitiveData('token=abc123')).toBe('token=***');
    });

    it('should mask API key patterns', () => {
      expect(maskSensitiveData('api_key=xyz789')).toBe('api_key=***');
      expect(maskSensitiveData('api-key=xyz789')).toBe('api_key=***');
      expect(maskSensitiveData('apikey=xyz789')).toBe('api_key=***');
    });

    it('should mask bearer tokens', () => {
      expect(maskSensitiveData('bearer abc123xyz')).toBe('bearer ***');
    });

    it('should mask authorization headers', () => {
      // The bearer regex runs before authorization, so 'Bearer abc123' is replaced first,
      // then authorization regex replaces the remaining token. Both patterns fire.
      const result = maskSensitiveData('authorization=Bearer abc123');
      expect(result).toContain('***');
      expect(result.toLowerCase()).not.toContain('abc123');
    });

    it('should be case insensitive', () => {
      expect(maskSensitiveData('PASSWORD=secret')).toBe('password=***');
      expect(maskSensitiveData('TOKEN=abc')).toBe('token=***');
    });

    it('should handle multiple patterns', () => {
      const input = 'password=secret token=abc123';
      const result = maskSensitiveData(input);
      expect(result).toContain('password=***');
      expect(result).toContain('token=***');
    });
  });

  describe('sanitizeError', () => {
    it('should sanitize Error objects', () => {
      const error = new Error('Test error\nwith newline');
      const result = sanitizeError(error);
      expect(result.message).toBe('Test error with newline');
      expect(result.stack).toBeDefined();
    });

    it('should handle errors without stack', () => {
      const error = new Error('Test');
      delete error.stack;
      const result = sanitizeError(error);
      expect(result.message).toBe('Test');
      expect(result.stack).toBeUndefined();
    });

    it('should handle non-Error objects', () => {
      const result = sanitizeError('string error');
      expect(result.message).toBe('string error');
      expect(result.stack).toBeUndefined();
    });

    it('should mask sensitive data in error messages', () => {
      const error = new Error('Failed: password=secret123');
      const result = sanitizeError(error);
      expect(result.message).toContain('***');
    });
  });
});
