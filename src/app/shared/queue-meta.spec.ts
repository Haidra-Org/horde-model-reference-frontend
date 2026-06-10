import { describe, it, expect } from 'vitest';
import {
  STATUS_META,
  OP_META,
  statusLabel,
  opLabel,
  batchesFromPending,
  timeAgo,
} from './queue-meta';
import type { PendingChangeRecord } from '../api-client';

function makeChange(overrides: Partial<PendingChangeRecord> = {}): PendingChangeRecord {
  return {
    change_id: overrides.change_id ?? 1,
    category: overrides.category ?? (1 as unknown as PendingChangeRecord['category']),
    model_name: overrides.model_name ?? 'test-model',
    operation: overrides.operation ?? 'create',
    requested_by: overrides.requested_by ?? 'user1',
    requested_username: overrides.requested_username ?? 'user1',
    status: overrides.status ?? 'pending',
    batch_id: overrides.batch_id ?? null,
    batch_title: overrides.batch_title ?? null,
    ...overrides,
  };
}

describe('queue-meta', () => {
  describe('STATUS_META', () => {
    it('has entries for all statuses', () => {
      expect(STATUS_META.pending.label).toBe('Pending');
      expect(STATUS_META.approved.label).toBe('Approved');
      expect(STATUS_META.applied.label).toBe('Applied');
      expect(STATUS_META.rejected.label).toBe('Rejected');
    });
  });

  describe('OP_META', () => {
    it('has entries for all operations', () => {
      expect(OP_META.create.label).toBe('Create');
      expect(OP_META.update.label).toBe('Update');
      expect(OP_META.delete.label).toBe('Delete');
    });
  });

  describe('statusLabel', () => {
    it('returns label for known status', () => {
      expect(statusLabel('pending')).toBe('Pending');
      expect(statusLabel('approved')).toBe('Approved');
    });

    it('returns raw value for unknown status', () => {
      expect(statusLabel('unknown')).toBe('unknown');
    });
  });

  describe('opLabel', () => {
    it('returns label for known operation', () => {
      expect(opLabel('create')).toBe('Create');
      expect(opLabel('update')).toBe('Update');
    });

    it('returns raw value for unknown operation', () => {
      expect(opLabel('unknown_op')).toBe('unknown_op');
    });
  });

  describe('batchesFromPending', () => {
    it('returns empty for empty input', () => {
      expect(batchesFromPending([])).toEqual([]);
    });

    it('groups approved changes by batch_id', () => {
      const changes = [
        makeChange({ change_id: 1, batch_id: 10, status: 'approved', batch_title: 'Batch A' }),
        makeChange({ change_id: 2, batch_id: 10, status: 'approved' }),
        makeChange({ change_id: 3, batch_id: 5, status: 'applied', batch_title: 'Batch B' }),
      ];
      const result = batchesFromPending(changes);
      expect(result).toHaveLength(2);
      expect(result[0].batch_id).toBe(10);
      expect(result[0].ids).toEqual([1, 2]);
      expect(result[0].approvedCount).toBe(2);
      expect(result[0].allApplied).toBe(false);
    });

    it('marks batch as applied when all changes are applied', () => {
      const changes = [
        makeChange({ change_id: 1, batch_id: 10, status: 'applied' }),
        makeChange({ change_id: 2, batch_id: 10, status: 'applied' }),
      ];
      const result = batchesFromPending(changes);
      expect(result[0].allApplied).toBe(true);
    });

    it('ignores changes without batch_id', () => {
      const changes = [
        makeChange({ change_id: 1, batch_id: null, status: 'pending' }),
        makeChange({ change_id: 2, batch_id: 10, status: 'approved' }),
      ];
      const result = batchesFromPending(changes);
      expect(result).toHaveLength(1);
      expect(result[0].batch_id).toBe(10);
    });
  });

  describe('timeAgo', () => {
    it('returns empty for null', () => {
      expect(timeAgo(null)).toBe('');
    });

    it('returns just now for recent timestamps', () => {
      const now = Math.floor(Date.now() / 1000) - 5;
      expect(timeAgo(now)).toBe('just now');
    });

    it('returns minutes for older timestamps', () => {
      const ts = Math.floor(Date.now() / 1000) - 120;
      expect(timeAgo(ts)).toBe('2m ago');
    });
  });
});
