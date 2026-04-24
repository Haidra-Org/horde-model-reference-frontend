import { parseSizeLabel, syncParametersFromSize } from './size-parser';

describe('parseSizeLabel', () => {
  it('parses standard "8B"', () => {
    expect(parseSizeLabel('8B')).toEqual({ value: 8, unit: 'B' });
  });

  it('parses decimal "7.5B"', () => {
    expect(parseSizeLabel('7.5B')).toEqual({ value: 7.5, unit: 'B' });
  });

  it('parses multiplied "8x7B"', () => {
    expect(parseSizeLabel('8x7B')).toEqual({ value: 56, unit: 'B' });
  });

  it('parses millions "350M"', () => {
    expect(parseSizeLabel('350M')).toEqual({ value: 350, unit: 'M' });
  });

  it('returns null for unparseable "large"', () => {
    expect(parseSizeLabel('large')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(parseSizeLabel('')).toBeNull();
  });

  it('returns null for zero "0B"', () => {
    expect(parseSizeLabel('0B')).toBeNull();
  });

  it('returns null for negative "-8B"', () => {
    expect(parseSizeLabel('-8B')).toBeNull();
  });

  it('trims whitespace " 8B "', () => {
    expect(parseSizeLabel(' 8B ')).toEqual({ value: 8, unit: 'B' });
  });

  it('is case-insensitive', () => {
    expect(parseSizeLabel('8b')).toEqual({ value: 8, unit: 'B' });
  });
});

describe('syncParametersFromSize', () => {
  it('returns parsed value when linked', () => {
    expect(syncParametersFromSize('8B', true)).toEqual({ value: 8, unit: 'B' });
  });

  it('returns null/B when unlinked', () => {
    expect(syncParametersFromSize('8B', false)).toEqual({ value: null, unit: 'B' });
  });

  it('returns null/B when linked but unparseable', () => {
    expect(syncParametersFromSize('large', true)).toEqual({ value: null, unit: 'B' });
  });
});
