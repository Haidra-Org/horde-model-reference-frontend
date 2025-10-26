import {
  pixelstepsToMegapixelsteps,
  formatAsMegapixelsteps,
  formatAsMegapixelstepsLocale,
} from './pixelstep-formatting.utils';

describe('Pixelstep Formatting Utils', () => {
  describe('pixelstepsToMegapixelsteps', () => {
    it('should convert pixelsteps to megapixelsteps', () => {
      expect(pixelstepsToMegapixelsteps(1_000_000)).toBe(1);
      expect(pixelstepsToMegapixelsteps(2_500_000)).toBe(2.5);
      expect(pixelstepsToMegapixelsteps(884_156_600)).toBe(884.1566);
    });

    it('should handle zero', () => {
      expect(pixelstepsToMegapixelsteps(0)).toBe(0);
    });

    it('should handle very large numbers', () => {
      expect(pixelstepsToMegapixelsteps(1_597_177_856)).toBe(1597.177856);
    });
  });

  describe('formatAsMegapixelsteps', () => {
    it('should format with default 2 decimal places', () => {
      expect(formatAsMegapixelsteps(1_000_000)).toBe('1.00');
      expect(formatAsMegapixelsteps(2_500_000)).toBe('2.50');
      expect(formatAsMegapixelsteps(884_156_600)).toBe('884.16');
    });

    it('should format with custom decimal places', () => {
      expect(formatAsMegapixelsteps(884_156_600, 0)).toBe('884');
      expect(formatAsMegapixelsteps(884_156_600, 1)).toBe('884.2');
      expect(formatAsMegapixelsteps(884_156_600, 3)).toBe('884.157');
    });

    it('should handle zero', () => {
      expect(formatAsMegapixelsteps(0)).toBe('0.00');
    });
  });

  describe('formatAsMegapixelstepsLocale', () => {
    it('should format with default 2 decimal places and locale formatting', () => {
      const result = formatAsMegapixelstepsLocale(1_597_177_856);
      // Result will vary by locale, but should contain the number components
      expect(result).toMatch(/1[,.]?597/);
      expect(result).toContain('18'); // From .18
    });

    it('should format with custom decimal places', () => {
      const result = formatAsMegapixelstepsLocale(884_156_600, 1);
      expect(result).toContain('884');
    });

    it('should handle zero', () => {
      const result = formatAsMegapixelstepsLocale(0);
      expect(result).toContain('0');
    });
  });
});
