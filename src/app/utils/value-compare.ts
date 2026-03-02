/**
 * Normalize values for stable comparison and stringification. Object keys are sorted
 * to avoid false positives from key order changes; primitives are returned as-is.
 */
export function normalizeForComparison(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeForComparison(item));
  }

  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
      a.localeCompare(b),
    );

    const normalized: Record<string, unknown> = {};
    for (const [key, val] of entries) {
      normalized[key] = normalizeForComparison(val);
    }
    return normalized;
  }

  return value;
}

/**
 * Stable, human-friendly string formatting for value diffs.
 * - empty/null-ish values → ''
 * - booleans/numbers/strings → stringified
 * - arrays/objects → stable JSON (sorted keys); empty collections → ''
 */
export function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number' || typeof value === 'string') return String(value);

  const normalized = normalizeForComparison(value);
  const serialized = JSON.stringify(normalized);
  if (serialized === '{}' || serialized === '[]') return '';
  return serialized;
}
