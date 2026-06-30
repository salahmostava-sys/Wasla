import { describe, it, expect } from 'vitest';
import { findBestMatch, matchEmployeeNames } from '@shared/lib/nameMatching';

describe('nameMatching', () => {
  const employees = [
    { id: '1', name: 'محمد أحمد علي' },
    { id: '2', name: 'أحمد محمد' },
    { id: '3', name: 'علي حسن' },
    { id: '4', name: 'فاطمة الزهراء' },
    { id: '5', name: 'عبدالله محمد' },
  ];

  describe('findBestMatch', () => {
    it('should find exact match', () => {
      const result = findBestMatch('محمد أحمد علي', employees);
      expect(result.match?.id).toBe('1');
      expect(result.similarity).toBe(100);
    });

    it('should find partial match', () => {
      const result = findBestMatch('محمد أحمد', employees);
      expect(result.match?.id).toBe('1');
      expect(result.similarity).toBeGreaterThan(80);
    });

    it('should handle Arabic normalization', () => {
      const result = findBestMatch('محمد احمد علي', employees);
      expect(result.match?.id).toBe('1');
      expect(result.similarity).toBeGreaterThan(80);
    });

    it('should handle single word match', () => {
      const result = findBestMatch('محمد', employees);
      expect(result.match).toBeTruthy();
      expect(result.similarity).toBeGreaterThan(60);
    });

    it('should return null for no match', () => {
      const result = findBestMatch('xyz', employees, { autoMatchThreshold: 80 });
      expect(result.match).toBeNull();
    });

    it('should provide suggestions', () => {
      const result = findBestMatch('محمد', employees);
      expect(result.suggestions.length).toBeGreaterThan(0);
      expect(result.suggestions[0].similarity).toBeGreaterThan(0);
    });

    it('should respect autoMatchThreshold', () => {
      const result = findBestMatch('محمد', employees, { autoMatchThreshold: 95 });
      expect(result.match).toBeNull();
    });

    it('should respect suggestionThreshold', () => {
      const result = findBestMatch('محمد', employees, { suggestionThreshold: 90 });
      expect(result.suggestions.every(s => s.similarity >= 90)).toBe(true);
    });

    it('should respect maxSuggestions', () => {
      const result = findBestMatch('محمد', employees, { maxSuggestions: 2 });
      expect(result.suggestions.length).toBeLessThanOrEqual(2);
    });
  });

  describe('matchEmployeeNames', () => {
    it('should match all exact names', () => {
      const names = ['محمد أحمد علي', 'أحمد محمد'];
      const result = matchEmployeeNames(names, employees);
      expect(result.matched.size).toBe(2);
      expect().toHaveLength();
    });

    it('should match partial names', () => {
      const names = ['محمد أحمد'];
      const result = matchEmployeeNames(names, employees);
      expect(result.matched.size).toBe(1);
      expect(result.matched.get('محمد أحمد')?.id).toBe('1');
    });

    it('should identify unmatched names', () => {
      const names = ['غير موجود'];
      const result = matchEmployeeNames(names, employees, { autoMatchThreshold: 80 });
      expect(result.matched.size).toBe(0);
      expect().toHaveLength();
      expect(result.unmatched[0].name).toBe('غير موجود');
    });

    it('should provide suggestions for unmatched', () => {
      const names = ['محمد'];
      const result = matchEmployeeNames(names, employees, { autoMatchThreshold: 95 });
      expect().toHaveLength();
      expect(result.unmatched[0].suggestions.length).toBeGreaterThan(0);
    });

    it('should categorize unmatched by reason', () => {
      const names = ['محمد', 'xyz'];
      const result = matchEmployeeNames(names, employees, { 
        autoMatchThreshold: 95,
        suggestionThreshold: 50 
      });
      const lowConfidence = result.unmatched.filter(u => u.reason === 'low-confidence');
      const notFound = result.unmatched.filter(u => u.reason === 'not-found');
      expect().toHaveLength();
    });

    it('should handle empty input', () => {
      const result = matchEmployeeNames([], employees);
      expect(result.matched.size).toBe(0);
      expect().toHaveLength();
    });

    it('should handle duplicate names', () => {
      const names = ['محمد أحمد علي', 'محمد أحمد علي'];
      const result = matchEmployeeNames(names, employees);
      expect(result.matched.size).toBe(1);
    });
  });
});
