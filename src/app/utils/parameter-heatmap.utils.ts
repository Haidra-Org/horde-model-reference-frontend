/**
 * Utility functions for parameter count heatmap styling
 */

/**
 * Maps parameter count to heatmap bucket class name
 * Buckets:
 * - <3B -> pc-0-3b
 * - >=3B - 6B -> pc-3-6b
 * - >6B - 9B -> pc-6-9b
 * - >9B - 14B -> pc-9-14b
 * - >14B - 20B -> pc-14-20b
 * - >20B - <70B -> pc-20-70b
 * - 70B - <100B -> pc-70-100b
 * - 100B+ -> pc-100b-plus
 */
export function getParameterHeatmapClass(parameterCount: number): string {
  const billions = parameterCount / 1_000_000_000;

  if (billions < 3) {
    return 'pc-0-3b';
  } else if (billions >= 3 && billions < 6) {
    return 'pc-3-6b';
  } else if (billions >= 6 && billions < 9) {
    return 'pc-6-9b';
  } else if (billions >= 9 && billions < 14) {
    return 'pc-9-14b';
  } else if (billions >= 14 && billions < 20) {
    return 'pc-14-20b';
  } else if (billions >= 20 && billions < 70) {
    return 'pc-20-70b';
  } else if (billions >= 70 && billions < 100) {
    return 'pc-70-100b';
  } else {
    return 'pc-100b-plus';
  }
}

export function getParametersCountFromShorthand(shorthand: string): number | null {
  const match = shorthand.match(/^(\d+)([BMT])$/i);
  if (!match) {
    return null;
  }
  const value = parseInt(match[1], 10);
  const unit = match[2].toUpperCase();
  if (unit === 'T') {
    return value * 1_000_000_000_000;
  } else if (unit === 'B') {
    return value * 1_000_000_000;
  } else if (unit === 'M') {
    return value * 1_000_000;
  }
  return null;
}

/**
 * Formats parameter count as billions (e.g., "3B", "33B")
 */
export function formatParametersInBillions(params: number): string {
  return params >= 1_000_000_000
    ? `${(params / 1_000_000_000).toFixed(0)}B`
    : `${(params / 1_000_000).toFixed(0)}M`;
}
