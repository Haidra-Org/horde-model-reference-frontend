/**
 * Compute a field-level diff between two records for the pending queue.
 *
 * Produces DiffEntry[] used by the Review step (Propose-a-Change) and
 * the Review Queue diff panel (Phase 5).
 */

/**
 * The kind of change for a single field in a diff.
 * - add: field present in after but not in before
 * - modify: field present in both with different values
 * - remove: field present in before but not in after
 */
export type DiffKind = 'add' | 'modify' | 'remove';

export interface DiffEntry {
  /** Dotted path to the field, e.g. "config.download[0].sha256sum" */
  field: string;
  /** JSON-serialized before value (null for add) */
  before: string | null;
  /** JSON-serialized after value (null for remove) */
  after: string | null;
  kind: DiffKind;
}

/**
 * Compute a diff between two records.
 *
 * For create operations, all fields in `after` are "add".
 * For delete operations, no diff is needed (the whole record is removed).
 * For update operations, a recursive field-level comparison is performed.
 *
 * @param operation - 'create' | 'update' | 'delete'
 * @param before - The existing record (null for create)
 * @param after - The proposed record (null for delete)
 * @returns Array of DiffEntry representing all changes
 */
export function computeDiff(
  operation: 'create' | 'update' | 'delete',
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null,
): DiffEntry[] {
  if (operation === 'delete') {
    return [];
  }

  if (operation === 'create') {
    return after ? recordToAddDiffs(after) : [];
  }

  // update operation
  if (!before || !after) {
    return [];
  }

  return computeUpdateDiff(before, after);
}

function recordToAddDiffs(record: Record<string, unknown>): DiffEntry[] {
  const entries: DiffEntry[] = [];
  for (const [key, value] of Object.entries(record)) {
    if (key === 'config') {
      // Flatten config fields
      const configDiffs = objectToAddDiffs(value as Record<string, unknown>, 'config');
      entries.push(...configDiffs);
    } else {
      entries.push({
        field: key,
        before: null,
        after: JSON.stringify(value),
        kind: 'add',
      });
    }
  }
  return entries;
}

function objectToAddDiffs(obj: Record<string, unknown>, prefix: string): DiffEntry[] {
  const entries: DiffEntry[] = [];

  if (!obj || typeof obj !== 'object') {
    return entries;
  }

  for (const [key, value] of Object.entries(obj)) {
    const path = `${prefix}.${key}`;
    if (Array.isArray(value)) {
      for (let i = 0; i < value.length; i++) {
        const item = value[i];
        if (item && typeof item === 'object') {
          entries.push(...objectToAddDiffs(item as Record<string, unknown>, `${path}[${i}]`));
        } else {
          entries.push({
            field: `${path}[${i}]`,
            before: null,
            after: JSON.stringify(item),
            kind: 'add',
          });
        }
      }
    } else if (value !== null && typeof value === 'object') {
      entries.push(...objectToAddDiffs(value as Record<string, unknown>, path));
    } else {
      entries.push({
        field: path,
        before: null,
        after: JSON.stringify(value),
        kind: 'add',
      });
    }
  }

  return entries;
}

function computeUpdateDiff(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
): DiffEntry[] {
  const entries: DiffEntry[] = [];

  // Find modified and removed fields
  for (const [key, beforeValue] of Object.entries(before)) {
    if (!(key in after)) {
      entries.push({
        field: key,
        before: JSON.stringify(beforeValue),
        after: null,
        kind: 'remove',
      });
      continue;
    }

    const afterValue = after[key];
    if (!deepEqual(beforeValue, afterValue)) {
      if (key === 'config') {
        entries.push(
          ...computeConfigUpdateDiff(
            beforeValue as Record<string, unknown>,
            afterValue as Record<string, unknown>,
          ),
        );
      } else {
        entries.push({
          field: key,
          before: JSON.stringify(beforeValue),
          after: JSON.stringify(afterValue),
          kind: 'modify',
        });
      }
    }
  }

  // Find added fields
  for (const [key, afterValue] of Object.entries(after)) {
    if (!(key in before)) {
      entries.push({
        field: key,
        before: null,
        after: JSON.stringify(afterValue),
        kind: 'add',
      });
    }
  }

  return entries;
}

function computeConfigUpdateDiff(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
): DiffEntry[] {
  const entries: DiffEntry[] = [];

  // Compare download arrays by index
  const beforeDownloads = (before['download'] as Record<string, unknown>[]) ?? [];
  const afterDownloads = (after['download'] as Record<string, unknown>[]) ?? [];
  const maxLen = Math.max(beforeDownloads.length, afterDownloads.length);

  for (let i = 0; i < maxLen; i++) {
    const beforeItem = beforeDownloads[i];
    const afterItem = afterDownloads[i];

    if (!beforeItem && afterItem) {
      // New download entry
      entries.push(...objectToAddDiffs(afterItem, `config.download[${i}]`));
    } else if (beforeItem && !afterItem) {
      entries.push({
        field: `config.download[${i}]`,
        before: JSON.stringify(beforeItem),
        after: null,
        kind: 'remove',
      });
    } else if (beforeItem && afterItem) {
      for (const [fileKey, beforeFileVal] of Object.entries(beforeItem)) {
        const afterFileVal = afterItem[fileKey];
        if (!deepEqual(beforeFileVal, afterFileVal)) {
          entries.push({
            field: `config.download[${i}].${fileKey}`,
            before: JSON.stringify(beforeFileVal),
            after: JSON.stringify(afterFileVal),
            kind: afterFileVal === undefined ? 'remove' : 'modify',
          });
        }
      }
    }
  }

  return entries;
}

function deepEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}
