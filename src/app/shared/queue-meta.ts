import type { PendingChangeStatus, AuditOperation } from '../api-client';
import type { PendingChangeRecord } from '../api-client/model/models';

// ── Status metadata ──────────────────────────────────────────────────────
export interface StatusMeta {
  label: string;
  /** Semantic kind for badge/styling: amber, blue, green, red */
  kind: 'amber' | 'blue' | 'green' | 'red';
  icon: string;
}

export const STATUS_META: Record<PendingChangeStatus, StatusMeta> = {
  pending: { label: 'Pending', kind: 'amber', icon: 'clock' },
  approved: { label: 'Approved', kind: 'blue', icon: 'check' },
  applying: { label: 'Applying', kind: 'blue', icon: 'clock' },
  applied: { label: 'Applied', kind: 'green', icon: 'check' },
  rejected: { label: 'Rejected', kind: 'red', icon: 'x' },
};

export const ALL_STATUS_FILTERS: (PendingChangeStatus | 'all')[] = [
  'all',
  'pending',
  'approved',
  'applied',
  'rejected',
];

export type StatusFilter = (typeof ALL_STATUS_FILTERS)[number];

// ── Operation metadata ───────────────────────────────────────────────────
export interface OpMeta {
  label: string;
  icon: string;
}

export const OP_META: Record<AuditOperation, OpMeta> = {
  create: { label: 'Create', icon: 'plus' },
  update: { label: 'Update', icon: 'pencil' },
  delete: { label: 'Delete', icon: 'trash' },
};

// ── Helpers ──────────────────────────────────────────────────────────────

export function statusLabel(status: PendingChangeStatus | string): string {
  const s = status as PendingChangeStatus;
  return STATUS_META[s]?.label ?? status;
}

export function opLabel(operation: AuditOperation | string): string {
  const o = operation as AuditOperation;
  return OP_META[o]?.label ?? operation;
}

// ── Batches ──────────────────────────────────────────────────────────────

export interface DerivedBatch {
  batch_id: number;
  title: string;
  ids: number[];
  allApplied: boolean;
  approvedCount: number;
}

/**
 * Derive batches from a list of pending changes.
 * Groups approved changes by batch_id, sorted newest-first.
 */
export function batchesFromPending(pending: PendingChangeRecord[]): DerivedBatch[] {
  const map = new Map<number, PendingChangeRecord[]>();
  for (const c of pending) {
    if (c.batch_id != null) {
      const list = map.get(c.batch_id) ?? [];
      list.push(c);
      map.set(c.batch_id, list);
    }
  }

  return Array.from(map.entries())
    .map(([bid, cs]) => ({
      batch_id: bid,
      title: cs[0]?.batch_title ?? `Batch #${bid}`,
      ids: cs.map((c) => c.change_id),
      allApplied: cs.every((c) => c.status === 'applied'),
      approvedCount: cs.filter((c) => c.status === 'approved').length,
    }))
    .sort((a, b) => b.batch_id - a.batch_id);
}

// ── Time helpers ─────────────────────────────────────────────────────────

export function timeAgo(timestamp: number | null | undefined): string {
  if (timestamp == null) return '';
  const seconds = Math.floor((Date.now() - timestamp * 1000) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}
