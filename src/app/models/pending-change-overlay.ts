import type { AuditOperation, PendingChangeRecord } from '../api-client/model/models';

/**
 * Overlay annotation applied to model data to indicate a pending change exists
 * for that model in the pending queue.
 */
export interface PendingChangeOverlay {
  /** The type of pending operation (create, update, delete) */
  pendingOperation: AuditOperation;

  /** The pending change record ID (for navigation) */
  pendingChangeId: number;

  /** True for pending-create entries that don't yet exist in the model list */
  isGhost: boolean;

  /** The underlying pending change record (for detail display) */
  pendingRecord: PendingChangeRecord;
}

/**
 * Map of model name → pending change overlay. Used to annotate models in the list.
 */
export type PendingOverlayMap = Map<string, PendingChangeOverlay>;
