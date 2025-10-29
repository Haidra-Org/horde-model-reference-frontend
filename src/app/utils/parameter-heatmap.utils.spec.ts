import {
  getParameterHeatmapClass,
  formatParametersInBillions,
  getParametersCountFromShorthand,
} from './parameter-heatmap.utils';

describe('Parameter Heatmap Utils', () => {
  describe('getParameterHeatmapClass', () => {
    it('should return pc-0-3b for parameters < 3B', () => {
      expect(getParameterHeatmapClass(1_000_000_000)).toBe('pc-0-3b'); // 1B
      expect(getParameterHeatmapClass(2_500_000_000)).toBe('pc-0-3b'); // 2.5B
      expect(getParameterHeatmapClass(500_000_000)).toBe('pc-0-3b'); // 0.5B
    });

    it('should return pc-3-6b for parameters >= 3B and < 6B', () => {
      expect(getParameterHeatmapClass(3_000_000_000)).toBe('pc-3-6b'); // 3B
      expect(getParameterHeatmapClass(4_500_000_000)).toBe('pc-3-6b'); // 4.5B
      expect(getParameterHeatmapClass(5_999_999_999)).toBe('pc-3-6b'); // ~6B
    });

    it('should return pc-6-9b for parameters >= 6B and < 9B', () => {
      expect(getParameterHeatmapClass(6_000_000_000)).toBe('pc-6-9b'); // 6B
      expect(getParameterHeatmapClass(7_500_000_000)).toBe('pc-6-9b'); // 7.5B
      expect(getParameterHeatmapClass(8_999_999_999)).toBe('pc-6-9b'); // ~9B
    });

    it('should return pc-9-14b for parameters >= 9B and < 14B', () => {
      expect(getParameterHeatmapClass(9_000_000_000)).toBe('pc-9-14b'); // 9B
      expect(getParameterHeatmapClass(11_000_000_000)).toBe('pc-9-14b'); // 11B
      expect(getParameterHeatmapClass(13_999_999_999)).toBe('pc-9-14b'); // ~14B
    });

    it('should return pc-14-20b for parameters >= 14B and < 20B', () => {
      expect(getParameterHeatmapClass(14_000_000_000)).toBe('pc-14-20b'); // 14B
      expect(getParameterHeatmapClass(17_000_000_000)).toBe('pc-14-20b'); // 17B
      expect(getParameterHeatmapClass(19_999_999_999)).toBe('pc-14-20b'); // ~20B
    });

    it('should return pc-20-70b for parameters >= 20B and < 70B', () => {
      expect(getParameterHeatmapClass(20_000_000_000)).toBe('pc-20-70b'); // 20B
      expect(getParameterHeatmapClass(33_000_000_000)).toBe('pc-20-70b'); // 33B
      expect(getParameterHeatmapClass(69_999_999_999)).toBe('pc-20-70b'); // ~70B
    });

    it('should return pc-70-100b for parameters >= 70B and < 100B', () => {
      expect(getParameterHeatmapClass(70_000_000_000)).toBe('pc-70-100b'); // 70B
      expect(getParameterHeatmapClass(85_000_000_000)).toBe('pc-70-100b'); // 85B
      expect(getParameterHeatmapClass(99_999_999_999)).toBe('pc-70-100b'); // ~100B
    });

    it('should return pc-100b-plus for parameters >= 100B', () => {
      expect(getParameterHeatmapClass(100_000_000_000)).toBe('pc-100b-plus'); // 100B
      expect(getParameterHeatmapClass(175_000_000_000)).toBe('pc-100b-plus'); // 175B
      expect(getParameterHeatmapClass(1_000_000_000_000)).toBe('pc-100b-plus'); // 1T
    });
  });

  describe('formatParametersInBillions', () => {
    it('should format parameters in billions with B suffix', () => {
      expect(formatParametersInBillions(3_000_000_000)).toBe('3B');
      expect(formatParametersInBillions(33_000_000_000)).toBe('33B');
      expect(formatParametersInBillions(175_000_000_000)).toBe('175B');
    });

    it('should format parameters in millions with M suffix for values < 1B', () => {
      expect(formatParametersInBillions(500_000_000)).toBe('500M');
      expect(formatParametersInBillions(750_000_000)).toBe('750M');
      expect(formatParametersInBillions(100_000_000)).toBe('100M');
    });

    it('should round to whole numbers', () => {
      expect(formatParametersInBillions(3_500_000_000)).toBe('4B'); // Rounds to 4B
      expect(formatParametersInBillions(3_200_000_000)).toBe('3B'); // Rounds to 3B
      expect(formatParametersInBillions(550_000_000)).toBe('550M'); // Rounds to 550M
    });
  });

  describe('getParametersCountFromShorthand', () => {
    it('should parse million, billion, and trillion shorthand regardless of case', () => {
      expect(getParametersCountFromShorthand('250M')).toBe(250_000_000);
      expect(getParametersCountFromShorthand('12b')).toBe(12_000_000_000);
      expect(getParametersCountFromShorthand('3T')).toBe(3_000_000_000_000);
    });

    it('should return null for invalid shorthand values', () => {
      expect(getParametersCountFromShorthand('abc')).toBeNull();
      expect(getParametersCountFromShorthand('42')).toBeNull();
      expect(getParametersCountFromShorthand('4G')).toBeNull();
    });
  });
});
