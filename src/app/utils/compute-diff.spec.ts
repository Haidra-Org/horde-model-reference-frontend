/**
 * Tests for compute-diff utility — field-level diff computation.
 */
import { describe, it, expect } from 'vitest';
import { computeDiff } from './compute-diff';

describe('computeDiff', () => {
  describe('create operation', () => {
    it('produces add entries for all fields in after', () => {
      const after = {
        name: 'new-model',
        baseline: 'flux_1',
        nsfw: false,
        tags: ['tag1'],
        config: { download: [{ file_name: 'f.safetensors' }] },
      };

      const diffs = computeDiff('create', null, after);

      // Should have entries for name, baseline, nsfw, tags, and flattened config fields
      expect(diffs.length).toBeGreaterThan(0);
      expect(diffs.every((d) => d.kind === 'add')).toBe(true);

      const nameDiff = diffs.find((d) => d.field === 'name');
      expect(nameDiff).toBeDefined();
      expect(nameDiff!.before).toBeNull();
      expect(nameDiff!.after).toBe('"new-model"');

      const baselineDiff = diffs.find((d) => d.field === 'baseline');
      expect(baselineDiff).toBeDefined();

      // config fields should be flattened
      const configDiffs = diffs.filter((d) => d.field.startsWith('config'));
      expect(configDiffs.length).toBeGreaterThan(0);
    });

    it('returns empty array for null after', () => {
      expect(computeDiff('create', null, null)).toEqual([]);
    });
  });

  describe('delete operation', () => {
    it('returns empty array (no field-level diff needed)', () => {
      const before = { name: 'old-model' };
      expect(computeDiff('delete', before, null)).toEqual([]);
    });
  });

  describe('update operation', () => {
    it('detects modified fields', () => {
      const before = { name: 'model', baseline: 'sd1', nsfw: false };
      const after = { name: 'model', baseline: 'sdxl', nsfw: true };

      const diffs = computeDiff('update', before, after);

      const baselineDiff = diffs.find((d) => d.field === 'baseline');
      expect(baselineDiff).toBeDefined();
      expect(baselineDiff!.kind).toBe('modify');
      expect(baselineDiff!.before).toBe('"sd1"');
      expect(baselineDiff!.after).toBe('"sdxl"');

      const nsfwDiff = diffs.find((d) => d.field === 'nsfw');
      expect(nsfwDiff).toBeDefined();
      expect(nsfwDiff!.kind).toBe('modify');
      expect(nsfwDiff!.before).toBe('false');
      expect(nsfwDiff!.after).toBe('true');

      // name unchanged → not in diff
      expect(diffs.find((d) => d.field === 'name')).toBeUndefined();
    });

    it('detects added fields', () => {
      const before = { name: 'model' };
      const after = { name: 'model', homepage: 'https://example.com' };

      const diffs = computeDiff('update', before, after);

      const homepageDiff = diffs.find((d) => d.field === 'homepage');
      expect(homepageDiff).toBeDefined();
      expect(homepageDiff!.kind).toBe('add');
      expect(homepageDiff!.before).toBeNull();
      expect(homepageDiff!.after).toBe('"https://example.com"');
    });

    it('detects removed fields', () => {
      const before = { name: 'model', deprecated_field: 'old' };
      const after = { name: 'model' };

      const diffs = computeDiff('update', before, after);

      const removedDiff = diffs.find((d) => d.field === 'deprecated_field');
      expect(removedDiff).toBeDefined();
      expect(removedDiff!.kind).toBe('remove');
      expect(removedDiff!.before).toBe('"old"');
      expect(removedDiff!.after).toBeNull();
    });

    it('computes diffs for config.download array changes', () => {
      const before = {
        name: 'model',
        config: {
          download: [{ file_name: 'old.safetensors', file_url: 'https://old.com' }],
        },
      };
      const after = {
        name: 'model',
        config: {
          download: [{ file_name: 'new.safetensors', file_url: 'https://new.com' }],
        },
      };

      const diffs = computeDiff('update', before, after);

      const fileUrlDiff = diffs.find((d) => d.field === 'config.download[0].file_url');
      expect(fileUrlDiff).toBeDefined();
      expect(fileUrlDiff!.kind).toBe('modify');
    });

    it('detects added download entry', () => {
      const before = {
        name: 'model',
        config: { download: [{ file_name: 'a.safetensors' }] },
      };
      const after = {
        name: 'model',
        config: {
          download: [
            { file_name: 'a.safetensors' },
            { file_name: 'b.safetensors', file_url: 'https://b.com' },
          ],
        },
      };

      const diffs = computeDiff('update', before, after);

      const newFileDiffs = diffs.filter((d) => d.field.startsWith('config.download[1]'));
      expect(newFileDiffs.length).toBeGreaterThan(0);
      expect(newFileDiffs.every((d) => d.kind === 'add')).toBe(true);
    });

    it('returns empty array when before and after are identical', () => {
      const record = { name: 'model', nsfw: false, tags: ['a', 'b'] };
      const diffs = computeDiff('update', record, { ...record });
      expect(diffs).toEqual([]);
    });

    it('handles null inputs', () => {
      expect(computeDiff('update', null, null)).toEqual([]);
      expect(computeDiff('update', { a: 1 }, null)).toEqual([]);
      expect(computeDiff('update', null, { a: 1 })).toEqual([]);
    });
  });

  describe('DiffEntry shape', () => {
    it('every entry has required fields', () => {
      const diffs = computeDiff('create', null, { name: 'x' });
      for (const d of diffs) {
        expect(d).toHaveProperty('field');
        expect(d).toHaveProperty('kind');
        expect(d).toHaveProperty('before');
        expect(d).toHaveProperty('after');
        expect(['add', 'modify', 'remove']).toContain(d.kind);
      }
    });
  });
});
