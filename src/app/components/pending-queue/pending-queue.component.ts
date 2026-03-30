import { DatePipe, JsonPipe, TitleCasePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import type {
  AuditOperation,
  MODEL_REFERENCE_CATEGORY,
  PendingChangeDiff,
  PendingChangeRecord,
  PendingChangeStatus,
} from '../../api-client/model/models';
import { PendingQueueService } from '../../services/pending-queue.service';
import { NotificationService } from '../../services/notification.service';
import { ModelValidationService } from '../../services/model-validation.service';
import { AuthService } from '../../services/auth.service';
import { ConfirmationModalComponent } from '../common/confirmation-modal/confirmation-modal.component';
import { DeltaDiffComponent } from '../common/delta-diff/delta-diff.component';
import { ExpandableChangeRowComponent } from './expandable-change-row/expandable-change-row.component';
import { PendingQueueAuditComponent } from '../pending-queue-audit/pending-queue-audit.component';

type PendingQueueTab = 'queue' | 'my-submissions' | 'batches' | 'history';

/** Action types for confirmation modal */
type ConfirmActionType = 'approve' | 'apply' | 'applyBatch' | 'approveAll';

interface ConfirmationState {
  action: ConfirmActionType;
  change: PendingChangeRecord;
  batchId?: number;
  changes?: PendingChangeRecord[];
}

/** Workflow step in the submit → approve → apply lifecycle */
interface WorkflowStep {
  label: string;
  count: number;
  active: boolean;
  completed: boolean;
  rejectedCount?: number;
}

/** Batch split notification persisted after applyBatch */
interface BatchSplitNotice {
  originalBatchId: number;
  newBatchId: number;
  reassignedCount: number;
  timestamp: number;
}

interface PendingQueueFilters {
  statuses: PendingChangeStatus[];
  category: MODEL_REFERENCE_CATEGORY | '';
  modelName: string;
  batchId: number | null;
}

interface GroupSummary {
  key: string;
  items: PendingChangeRecord[];
  statusCounts: Record<PendingChangeStatus, number>;
  operationCounts: Record<AuditOperation, number>;
  /** Batch ID for batch grouping (null = pending approval) */
  batchId?: number | null;
  /** Batch title if available */
  batchTitle?: string | null;
  /** Approved by username for batch groups */
  approvedBy?: string | null;
  /** Approval timestamp for batch groups */
  approvedAt?: number | null;
}

interface NetSummary {
  total: number;
  statusCounts: Record<PendingChangeStatus, number>;
  operationCounts: Record<AuditOperation, number>;
  categoryCounts: Record<string, number>;
  topModels: { model: string; count: number }[];
  lastUpdated: number | null;
}

@Component({
  selector: 'app-pending-queue-page',
  imports: [
    DatePipe,
    JsonPipe,
    TitleCasePipe,
    ConfirmationModalComponent,
    DeltaDiffComponent,
    ExpandableChangeRowComponent,
    PendingQueueAuditComponent,
  ],
  templateUrl: './pending-queue.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PendingQueueComponent {
  private readonly pendingQueue = inject(PendingQueueService);
  private readonly notifications = inject(NotificationService);
  private readonly validationService = inject(ModelValidationService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  readonly auth = inject(AuthService);

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly records = signal<PendingChangeRecord[]>([]);
  readonly total = signal(0);
  readonly activeTab = signal<PendingQueueTab>('queue');
  readonly collapsedGroups = signal<Set<string>>(new Set());
  readonly rejectingChange = signal<PendingChangeRecord | null>(null);
  readonly rejectReason = signal('');
  readonly sortOrder = signal<'newest' | 'oldest'>('newest');
  readonly filtersExpanded = signal(false);

  /** Batch split notifications to display */
  readonly batchSplitNotices = signal<BatchSplitNotice[]>([]);

  /** Expose server validation errors for display in template */
  readonly serverErrors = this.validationService.serverErrors;

  /** Confirmation modal state */
  readonly confirmationState = signal<ConfirmationState | null>(null);
  readonly confirmationLoading = signal(false);
  readonly changeDiff = signal<PendingChangeDiff | null>(null);
  readonly loadingDiff = signal(false);

  /** Per-change diffs for multi-change confirmation (approveAll) */
  readonly changeDiffs = signal<Map<number, PendingChangeDiff>>(new Map());
  readonly loadingDiffs = signal<Set<number>>(new Set());

  // ── My Submissions ──
  readonly mySubmissions = signal<PendingChangeRecord[]>([]);
  readonly loadingMySubmissions = signal(false);

  /** Computed: batch changes for batch apply confirmation */
  readonly batchChanges = computed(() => {
    const state = this.confirmationState();
    if (!state || state.action !== 'applyBatch' || !state.batchId) return [];
    return this.records().filter((r) => r.batch_id === state.batchId);
  });

  /** Computed: batch changes summary grouped by operation */
  readonly batchSummary = computed(() => {
    const changes = this.batchChanges();
    const operationCounts: Record<AuditOperation, number> = { create: 0, update: 0, delete: 0 };
    const statusCounts: Record<PendingChangeStatus, number> = {
      pending: 0,
      approved: 0,
      applying: 0,
      rejected: 0,
      applied: 0,
    };

    for (const change of changes) {
      operationCounts[change.operation] = (operationCounts[change.operation] ?? 0) + 1;
      statusCounts[change.status ?? 'pending'] = (statusCounts[change.status ?? 'pending'] ?? 0) + 1;
    }

    return {
      total: changes.length,
      operationCounts,
      statusCounts,
      approvedCount: statusCounts.approved,
      pendingCount: statusCounts.pending,
    };
  });

  /** Workflow stepper: Submit → Approve/Reject → Apply */
  readonly workflowSteps = computed((): WorkflowStep[] => {
    const summary = this.netSummary();
    const pending = summary.statusCounts.pending;
    const approved = summary.statusCounts.approved;
    const applied = summary.statusCounts.applied;
    const rejected = summary.statusCounts.rejected;

    const hasSubmissions = summary.total > 0;
    const hasApproved = approved > 0;
    const hasApplied = applied > 0;

    const needsReview = pending > 0;

    return [
      {
        label: 'Submit',
        count: summary.total,
        active: !hasSubmissions,
        completed: hasSubmissions,
      },
      {
        label: 'Review',
        count: pending,
        active: needsReview,
        completed: !needsReview && hasSubmissions,
        rejectedCount: rejected,
      },
      {
        label: 'Apply',
        count: approved,
        active: hasApproved && !needsReview,
        completed: hasApplied && !hasApproved,
      },
    ];
  });

  /** Guidance text for the workflow stepper */
  readonly workflowGuidance = computed((): string => {
    const summary = this.netSummary();
    const pending = summary.statusCounts.pending;
    const approved = summary.statusCounts.approved;
    const applied = summary.statusCounts.applied;
    const rejected = summary.statusCounts.rejected;

    if (summary.total === 0) {
      return 'No changes in the queue. Submit changes from the model editor.';
    }
    if (pending > 0 && approved > 0) {
      return `${pending} change${pending === 1 ? '' : 's'} awaiting review and ${approved} approved change${approved === 1 ? '' : 's'} ready to apply.`;
    }
    if (pending > 0) {
      return `${pending} change${pending === 1 ? '' : 's'} awaiting review. Approve or reject each, then apply the batch.`;
    }
    if (approved > 0) {
      return `${approved} approved change${approved === 1 ? '' : 's'} ready to apply. Apply individually or as a batch.`;
    }
    if (rejected > 0 && applied === 0) {
      return `All ${rejected} change${rejected === 1 ? '' : 's'} rejected. No changes to apply.`;
    }
    if (rejected > 0) {
      return `${applied} change${applied === 1 ? '' : 's'} applied, ${rejected} rejected.`;
    }
    return 'All changes have been applied.';
  });

  /** All pending change IDs for bulk approval */
  readonly allPendingIds = computed(() =>
    this.records()
      .filter((r) => r.status === 'pending')
      .map((r) => r.change_id),
  );

  readonly filters = signal<PendingQueueFilters>({
    statuses: [],
    category: '',
    modelName: '',
    batchId: null,
  });

  readonly statusOptions: PendingChangeStatus[] = ['pending', 'approved', 'applying', 'rejected', 'applied'];
  readonly operationOptions: AuditOperation[] = ['create', 'update', 'delete'];
  readonly hasFilters = computed(() => {
    const value = this.filters();
    return Boolean(value.statuses.length || value.category || value.modelName || value.batchId);
  });

  readonly netSummary = computed<NetSummary>(() => {
    const all = this.records();
    const statusCounts: Record<PendingChangeStatus, number> = {
      pending: 0,
      approved: 0,
      applying: 0,
      rejected: 0,
      applied: 0,
    } as const;
    const operationCounts: Record<AuditOperation, number> = {
      create: 0,
      update: 0,
      delete: 0,
    } as const;
    const categoryCounts: Record<string, number> = {};
    const modelCounts: Record<string, number> = {};
    let lastUpdated: number | null = null;

    for (const item of all) {
      statusCounts[item.status ?? 'pending'] = (statusCounts[item.status ?? 'pending'] ?? 0) + 1;
      operationCounts[item.operation] = (operationCounts[item.operation] ?? 0) + 1;
      categoryCounts[item.category] = (categoryCounts[item.category] ?? 0) + 1;
      modelCounts[item.model_name] = (modelCounts[item.model_name] ?? 0) + 1;
      if (typeof item.updated_at === 'number') {
        lastUpdated =
          lastUpdated === null ? item.updated_at : Math.max(lastUpdated, item.updated_at);
      }
    }

    const topModels = Object.entries(modelCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([model, count]) => ({ model, count }));

    return {
      total: all.length,
      statusCounts,
      operationCounts,
      categoryCounts,
      topModels,
      lastUpdated,
    };
  });

  /** Records sorted for the queue tab */
  readonly sortedRecords = computed(() => this.sortItems(this.records()));

  /** Only rejected records */
  readonly rejectedRecords = computed(() =>
    this.sortItems(this.records().filter((r) => r.status === 'rejected')),
  );

  readonly rejectedCount = computed(() => this.rejectedRecords().length);

  /** Groups changes by batch ID */
  readonly byBatch = computed<GroupSummary[]>(() => {
    const groups = new Map<string, PendingChangeRecord[]>();

    for (const item of this.records()) {
      const groupKey = item.batch_id != null ? `batch-${item.batch_id}` : 'pending-approval';
      const list = groups.get(groupKey) ?? [];
      list.push(item);
      groups.set(groupKey, list);
    }

    const results: GroupSummary[] = [];

    for (const [groupKey, items] of groups.entries()) {
      // Get batch metadata from the first item in the group
      const firstItem = items[0];
      const batchId = firstItem?.batch_id ?? null;
      const batchTitle = firstItem?.batch_title ?? null;
      const approvedBy = firstItem?.approved_username ?? null;
      const approvedAt = firstItem?.approved_at ?? null;

      // Create display key
      let displayKey: string;
      if (groupKey === 'pending-approval') {
        displayKey = 'Inbox \u2014 Awaiting Review';
      } else {
        displayKey = batchTitle
          ? `Batch #${batchId} · ${batchTitle}`
          : `Batch #${batchId}`;
      }

      results.push({
        key: displayKey,
        items: this.sortItems(items),
        statusCounts: this.countStatuses(items),
        operationCounts: this.countOperations(items),
        batchId,
        batchTitle,
        approvedBy,
        approvedAt,
      });
    }

    // Sort: inbox (awaiting review) first, then by batch_id descending (newest first)
    return results.sort((a, b) => {
      if (a.batchId === null && b.batchId !== null) return -1;
      if (a.batchId !== null && b.batchId === null) return 1;
      if (a.batchId === null && b.batchId === null) return 0;
      return (b.batchId ?? 0) - (a.batchId ?? 0);
    });
  });

  constructor() {
    // Restore tab from query param if present
    const tabParam = this.route.snapshot.queryParamMap.get('tab');
    if (tabParam && ['queue', 'my-submissions', 'batches', 'history'].includes(tabParam)) {
      this.activeTab.set(tabParam as PendingQueueTab);
    }

    this.load();
    if (this.auth.isAuthenticated()) {
      this.loadMySubmissions();
    }
  }

  setTab(tab: PendingQueueTab): void {
    this.activeTab.set(tab);
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });

    if (tab === 'my-submissions' && this.mySubmissions().length === 0 && !this.loadingMySubmissions()) {
      this.loadMySubmissions();
    }
  }

  toggleSortOrder(): void {
    this.sortOrder.update((current) => (current === 'newest' ? 'oldest' : 'newest'));
  }

  toggleFilters(): void {
    this.filtersExpanded.update((v) => !v);
  }

  dismissSplitNotice(index: number): void {
    this.batchSplitNotices.update((notices) => notices.filter((_, i) => i !== index));
  }

  approveAllPending(): void {
    const pendingChanges = this.records().filter((r) => r.status === 'pending');
    if (pendingChanges.length === 0) return;
    this.openConfirmation('approveAll', pendingChanges[0], undefined, pendingChanges);
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);

    const { statuses, category, modelName, batchId } = this.filters();

    this.pendingQueue
      .listChanges({
        statuses,
        categories: category ? [category] : undefined,
        modelName: modelName || undefined,
        batchId: batchId ?? undefined,
        limit: 200,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (page) => {
          const items = page.items ?? [];
          this.records.set(items);
          this.total.set(page.total ?? items.length);
          this.loading.set(false);
        },
        error: (err: Error) => {
          this.error.set(err.message);
          this.loading.set(false);
        },
      });
  }

  loadMySubmissions(): void {
    const username = this.auth.username();
    if (!username) return;

    this.loadingMySubmissions.set(true);
    this.pendingQueue
      .listChanges({ requestedBy: username, limit: 200 })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (page) => {
          this.mySubmissions.set(page.items ?? []);
          this.loadingMySubmissions.set(false);
        },
        error: () => {
          this.loadingMySubmissions.set(false);
        },
      });
  }

  resetFilters(): void {
    this.filters.set({ statuses: [], category: '', modelName: '', batchId: null });
    this.load();
  }

  toggleStatus(status: PendingChangeStatus): void {
    this.filters.update((current) => {
      const set = new Set(current.statuses);
      if (set.has(status)) {
        set.delete(status);
      } else {
        set.add(status);
      }
      return { ...current, statuses: Array.from(set) };
    });
    this.load();
  }

  onCategoryChange(value: string): void {
    this.filters.update((current) => ({
      ...current,
      category: value as MODEL_REFERENCE_CATEGORY | '',
    }));
  }

  onModelChange(value: string): void {
    this.filters.update((current) => ({ ...current, modelName: value }));
  }

  onBatchIdChange(value: string): void {
    const parsed = Number.parseInt(value, 10);
    this.filters.update((current) => ({
      ...current,
      batchId: Number.isNaN(parsed) ? null : parsed,
    }));
  }

  onRejectReasonChange(value: string): void {
    this.rejectReason.set(value ?? '');
  }

  approve(change: PendingChangeRecord): void {
    this.openConfirmation('approve', change);
  }

  apply(change: PendingChangeRecord): void {
    this.openConfirmation('apply', change);
  }

  applyBatchForChange(change: PendingChangeRecord): void {
    if (!change.batch_id) return;
    this.openConfirmation('applyBatch', change, change.batch_id);
  }

  openConfirmation(
    action: ConfirmActionType,
    change: PendingChangeRecord,
    batchId?: number,
    changes?: PendingChangeRecord[],
  ): void {
    this.confirmationState.set({ action, change, batchId, changes });
    this.changeDiff.set(null);
    this.changeDiffs.set(new Map());
    this.loadingDiffs.set(new Set());

    if (action === 'approveAll' && changes) {
      // Load diffs for all update operations in the approve-all list
      const updates = changes.filter((c) => c.operation === 'update');
      if (updates.length > 0) {
        this.loadingDiffs.set(new Set(updates.map((c) => c.change_id)));
        for (const u of updates) {
          this.pendingQueue
            .getChangeDiff(u.change_id)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
              next: (diff) => {
                this.changeDiffs.update((m) => new Map(m).set(u.change_id, diff));
                this.loadingDiffs.update((s) => {
                  const next = new Set(s);
                  next.delete(u.change_id);
                  return next;
                });
              },
              error: () => {
                this.loadingDiffs.update((s) => {
                  const next = new Set(s);
                  next.delete(u.change_id);
                  return next;
                });
              },
            });
        }
      }
    } else if (change.operation === 'update' && action !== 'applyBatch') {
      // Single-change diff
      this.loadingDiff.set(true);
      this.pendingQueue
        .getChangeDiff(change.change_id)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (diff) => {
            this.changeDiff.set(diff);
            this.loadingDiff.set(false);
          },
          error: () => {
            this.loadingDiff.set(false);
          },
        });
    }
  }

  closeConfirmation(): void {
    this.confirmationState.set(null);
    this.changeDiff.set(null);
    this.changeDiffs.set(new Map());
    this.loadingDiffs.set(new Set());
    this.confirmationLoading.set(false);
    this.loadingDiff.set(false);
  }

  /** Returns severity for the confirmation modal based on operation */
  getConfirmationSeverity(): 'create' | 'update' | 'delete' | 'info' {
    const state = this.confirmationState();
    if (!state) return 'info';
    if (state.action === 'applyBatch' || state.action === 'approveAll') return 'info';
    return state.change.operation as 'create' | 'update' | 'delete';
  }

  /** Returns title for the confirmation modal */
  getConfirmationTitle(): string {
    const state = this.confirmationState();
    if (!state) return 'Confirm Action';

    switch (state.action) {
      case 'approve':
        return `Approve ${this.operationLabel(state.change.operation)} Change`;
      case 'approveAll':
        return `Approve All Pending Changes`;
      case 'apply':
        return `Apply ${this.operationLabel(state.change.operation)} Change`;
      case 'applyBatch':
        return `Apply Batch #${state.batchId}`;
      default:
        return 'Confirm Action';
    }
  }

  /** Returns message for the confirmation modal */
  getConfirmationMessage(): string {
    const state = this.confirmationState();
    if (!state) return '';

    const { action, change, batchId } = state;
    const modelName = change.model_name;
    const operation = this.operationLabel(change.operation).toLowerCase();

    switch (action) {
      case 'approve':
        return `Are you sure you want to approve the ${operation} of "${modelName}"? This will mark the change as approved and ready for application.`;
      case 'approveAll': {
        const count = this.allPendingIds().length;
        return `Are you sure you want to approve all ${count} pending change${count === 1 ? '' : 's'}? They will be grouped into a single batch for application.`;
      }
      case 'apply':
        return `Are you sure you want to apply this ${operation} to "${modelName}"? This action cannot be undone.`;
      case 'applyBatch':
        return `Are you sure you want to apply all changes in batch #${batchId}? This will apply all approved changes in the batch at once.`;
      default:
        return '';
    }
  }

  /** Returns confirm button text for the confirmation modal */
  getConfirmButtonText(): string {
    const state = this.confirmationState();
    if (!state) return 'Confirm';

    switch (state.action) {
      case 'approve':
        return 'Approve';
      case 'approveAll':
        return `Approve All (${this.allPendingIds().length})`;
      case 'apply':
        return 'Apply Change';
      case 'applyBatch':
        return 'Apply Batch';
      default:
        return 'Confirm';
    }
  }

  /** Execute the confirmed action */
  executeConfirmedAction(): void {
    const state = this.confirmationState();
    if (!state) return;

    this.confirmationLoading.set(true);

    switch (state.action) {
      case 'approve':
        this.executeApprove(state.change);
        break;
      case 'approveAll':
        this.executeApproveAll();
        break;
      case 'apply':
        this.executeApply(state.change);
        break;
      case 'applyBatch':
        this.executeApplyBatch(state.change, state.batchId!);
        break;
    }
  }

  private executeApply(change: PendingChangeRecord): void {
    this.pendingQueue
      .applyChange(change.change_id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.notifications.success(`Applied change #${change.change_id}.`);
          this.closeConfirmation();
          this.load();
        },
        error: (err: Error) => {
          this.notifications.error(err.message);
          this.confirmationLoading.set(false);
        },
      });
  }

  private executeApplyBatch(change: PendingChangeRecord, batchId: number): void {
    this.pendingQueue
      .applyBatch(batchId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          const appliedCount = result.applied?.length ?? 0;
          if (appliedCount === 0) {
            this.notifications.info(`Batch #${batchId} already applied.`);
          } else {
            this.notifications.success(`Applied ${appliedCount} change(s) from batch #${batchId}.`);
          }

          // Persist a batch split notice for in-page display
          if (result.batch_split_occurred && result.batch_split_new_batch_id != null) {
            const reassignedCount = result.batch_split_reassigned_count ?? 0;
            this.batchSplitNotices.update((notices) => [
              ...notices,
              {
                originalBatchId: batchId,
                newBatchId: result.batch_split_new_batch_id!,
                reassignedCount,
                timestamp: Date.now(),
              },
            ]);
            this.notifications.info(
              `Batch split: ${reassignedCount} remaining change(s) reassigned to batch #${result.batch_split_new_batch_id}.`,
            );
          }

          this.closeConfirmation();
          this.load();
        },
        error: (err: Error) => {
          this.notifications.error(err.message);
          this.confirmationLoading.set(false);
        },
      });
  }

  private executeApproveAll(): void {
    const pendingIds = this.allPendingIds();
    if (pendingIds.length === 0) {
      this.closeConfirmation();
      return;
    }

    const batchTitle = `Bulk approval of ${pendingIds.length} pending change${pendingIds.length === 1 ? '' : 's'}`;
    this.pendingQueue
      .processBatch({
        batch_title: batchTitle,
        approved_ids: pendingIds,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.notifications.success(`Approved ${pendingIds.length} change${pendingIds.length === 1 ? '' : 's'}.`);
          this.closeConfirmation();
          this.load();
        },
        error: (err: Error) => {
          this.notifications.error(err.message);
          this.confirmationLoading.set(false);
        },
      });
  }

  private executeApprove(change: PendingChangeRecord): void {
    const batchTitle = `Approved change #${change.change_id} - ${change.model_name}`;
    this.pendingQueue
      .processBatch({
        batch_title: batchTitle,
        approved_ids: [change.change_id],
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.notifications.success(`Approved change #${change.change_id}.`);
          this.closeConfirmation();
          this.load();
        },
        error: (err: Error) => {
          this.notifications.error(err.message);
          this.confirmationLoading.set(false);
        },
      });
  }

  openRejectModal(change: PendingChangeRecord): void {
    this.rejectingChange.set(change);
    this.rejectReason.set('');
  }

  closeRejectModal(): void {
    this.rejectingChange.set(null);
    this.rejectReason.set('');
  }

  confirmReject(): void {
    const change = this.rejectingChange();
    const reason = this.rejectReason().trim();
    if (!change || !reason) return;

    this.loading.set(true);
    const batchTitle = `Rejected change #${change.change_id} - ${change.model_name}`;
    this.pendingQueue
      .processBatch({
        batch_title: batchTitle,
        rejected_ids: [change.change_id],
        reject_reason: reason,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.notifications.success(`Rejected change #${change.change_id}.`);
          this.closeRejectModal();
          this.load();
        },
        error: (err: Error) => {
          this.notifications.error(err.message);
          this.loading.set(false);
        },
      });
  }

  statusLabel(status: PendingChangeStatus | undefined): string {
    if (!status) return 'Unknown';
    return status.charAt(0).toUpperCase() + status.slice(1);
  }

  operationLabel(operation: AuditOperation | undefined): string {
    if (!operation) return 'Unknown';
    return operation.charAt(0).toUpperCase() + operation.slice(1);
  }

  operationLabelSafe(value: string): string {
    return this.operationLabel(value as AuditOperation);
  }

  /** Returns the CSS class for operation badge styling */
  operationBadgeClass(operation: AuditOperation | string | undefined): string {
    switch (operation) {
      case 'create':
        return 'badge-create';
      case 'update':
        return 'badge-update';
      case 'delete':
        return 'badge-delete';
      default:
        return 'badge-secondary';
    }
  }

  /** Returns the CSS class for status badge styling */
  statusBadgeClass(status: PendingChangeStatus | string | undefined): string {
    switch (status) {
      case 'pending':
        return 'badge-pending';
      case 'approved':
        return 'badge-approved';
      case 'rejected':
        return 'badge-rejected';
      case 'applied':
        return 'badge-applied';
      default:
        return 'badge-secondary';
    }
  }

  hasApprovedChanges(group: GroupSummary): boolean {
    return group.statusCounts['approved'] > 0;
  }

  applyBatchFromGroup(group: GroupSummary): void {
    if (group.batchId == null) return;
    const firstApproved = group.items.find((item) => item.status === 'approved');
    if (firstApproved) {
      this.applyBatchForChange(firstApproved);
    }
  }

  getBatchLifecycleStage(group: GroupSummary): 'created' | 'approved' | 'applying' | 'applied' {
    if (group.batchId === null) return 'created';
    const { pending, approved, applied } = group.statusCounts;
    const total = group.items.length;
    if (applied === total) return 'applied';
    if (applied > 0) return 'applying';
    if (approved > 0 && pending === 0) return 'approved';
    return 'created';
  }

  getBatchProgress(group: GroupSummary): { applied: number; total: number; percent: number } {
    const applied = group.statusCounts.applied;
    const total = group.items.length;
    return { applied, total, percent: total > 0 ? Math.round((applied / total) * 100) : 0 };
  }

  navigateToBatch(batchId: number): void {
    this.filters.update((current) => ({ ...current, batchId }));
    this.setTab('batches');
    this.load();
  }

  trackById(_: number, change: PendingChangeRecord): number {
    return change.change_id;
  }

  trackByGroup(_: number, group: GroupSummary): string {
    return group.key;
  }

  toggleGroup(groupKey: string): void {
    this.collapsedGroups.update((collapsed) => {
      const newSet = new Set(collapsed);
      if (newSet.has(groupKey)) {
        newSet.delete(groupKey);
      } else {
        newSet.add(groupKey);
      }
      return newSet;
    });
  }

  isGroupCollapsed(groupKey: string): boolean {
    return this.collapsedGroups().has(groupKey);
  }

  private sortItems(items: PendingChangeRecord[]): PendingChangeRecord[] {
    const direction = this.sortOrder() === 'newest' ? -1 : 1;
    return [...items].sort((a, b) => direction * ((a.requested_at ?? 0) - (b.requested_at ?? 0)));
  }

  private countStatuses(items: PendingChangeRecord[]): Record<PendingChangeStatus, number> {
    return items.reduce(
      (acc, item) => {
        const status = item.status ?? 'pending';
        acc[status] = (acc[status] ?? 0) + 1;
        return acc;
      },
      { pending: 0, approved: 0, rejected: 0, applied: 0 } as Record<PendingChangeStatus, number>,
    );
  }

  private countOperations(items: PendingChangeRecord[]): Record<AuditOperation, number> {
    return items.reduce(
      (acc, item) => {
        acc[item.operation] = (acc[item.operation] ?? 0) + 1;
        return acc;
      },
      { create: 0, update: 0, delete: 0 } as Record<AuditOperation, number>,
    );
  }
}
