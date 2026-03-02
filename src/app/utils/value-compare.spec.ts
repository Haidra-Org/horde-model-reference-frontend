import { describe, expect, it } from 'vitest';

import { formatValue } from './value-compare';

describe('value-compare', () => {
  it('normalizes object key order for stable comparison', () => {
    const first = formatValue({ b: 1, a: 2 });
    const second = formatValue({ a: 2, b: 1 });
    expect(first).toBe(second);
  });

  it('returns empty string for empty collections', () => {
    expect(formatValue({})).toBe('');
    expect(formatValue([])).toBe('');
  });

  it('keeps array order meaningful', () => {
    const first = formatValue([1, 2]);
    const second = formatValue([2, 1]);
    expect(first).not.toBe(second);
  });

  it('normalizes nested objects within arrays', () => {
    const first = formatValue([{ y: 1, x: 2 }]);
    const second = formatValue([{ x: 2, y: 1 }]);
    expect(first).toBe(second);
  });
});
