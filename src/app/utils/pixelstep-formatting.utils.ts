/**
 * Utility functions for converting and formatting pixelsteps for image generation models
 */

/**
 * Converts pixelsteps to megapixelsteps
 * @param pixelsteps - The number of pixelsteps
 * @returns The number of megapixelsteps (pixelsteps / 1,000,000)
 */
export function pixelstepsToMegapixelsteps(pixelsteps: number): number {
  return pixelsteps / 1_000_000;
}

/**
 * Formats pixelsteps as megapixelsteps with appropriate decimal places
 * @param pixelsteps - The number of pixelsteps
 * @param decimals - Number of decimal places (default: 2)
 * @returns Formatted string with megapixelsteps
 */
export function formatAsMegapixelsteps(pixelsteps: number, decimals = 2): string {
  const megapixelsteps = pixelstepsToMegapixelsteps(pixelsteps);
  return megapixelsteps.toFixed(decimals);
}

/**
 * Formats pixelsteps as megapixelsteps with locale-specific thousands separators
 * @param pixelsteps - The number of pixelsteps
 * @param decimals - Number of decimal places (default: 2)
 * @returns Formatted string with megapixelsteps and locale formatting
 */
export function formatAsMegapixelstepsLocale(pixelsteps: number, decimals = 2): string {
  const megapixelsteps = pixelstepsToMegapixelsteps(pixelsteps);
  return megapixelsteps.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}
