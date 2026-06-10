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
import type { PendingChangeRecord, PendingChangeStatus } from '../../api-client';
import { PendingQueueService } from '../../services/pending-queue.service';
import { PendingQueueSummaryService } from '../../services/pending-queue-summary.service';
import { NotificationService } from '../../services/notification.service';
import { AuthService } from '../../services/auth.service';
import { ShellContextService } from '../../services/shell-context.service';
import { ModelReferenceApiService } from '../../services/model-reference-api.service';
import {
  STATUS_META,
  ALL_STATUS_FILTERS,
  type StatusFilter,
  statusLabel,
  batchesFromPending,
  type DerivedBatch,
} from '../../shared/queue-meta';
import { ChangeRowComponent } from './change-row.component';
import { ChangeDetailComponent } from './change-detail.component';

@Component({
  selector: 'app-review-queue',
  imports: [ChangeRowComponent, ChangeDetailComponent],
  template: `
    <!-- Main content area matching the prototype's layout max-width -->
    <div class="review-queue-container">
      <!-- Banners -->
      @if (isReadOnly()) {
        <div class="review-queue-banner review-queue-banner--warning">
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.6"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"
            />
          </svg>
          <div>
            This backend is <strong>{{ api.backendCapabilities().mode }}</strong> / read-only — the
            queue is shown for transparency, but approvals and applies are disabled. Writes require
            a PRIMARY deployment.
          </div>
        </div>
      }

      @if (isPublicView()) {
        <div class="review-queue-banner review-queue-banner--info">
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.6"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z"
            />
          </svg>
          <div>
            You're viewing as <strong>Public</strong>. Anyone can watch the queue; proposing
            requires a requestor key and approving requires an approver key.
          </div>
        </div>
      }

      <!-- Status filter chips -->
      <div class="review-queue-chips">
        @for (filter of statusFilters; track $index) {
          @if (filter === 'all' || counts()[filter] > 0) {
            <button
              type="button"
              class="review-queue-chip"
              [class.review-queue-chip--active]="statusFilter() === filter"
              (click)="setStatusFilter(filter)"
            >
              {{ filter === 'all' ? 'All' : STATUS_META[filter].label }}
              <span class="review-queue-chip-count">{{ counts()[filter] }}</span>
            </button>
          }
        }
      </div>

      <!-- Loading / Error -->
      @if (loading() && records().length === 0) {
        <div class="glass-inflow review-queue-empty">
          <p>Loading pending changes…</p>
        </div>
      } @else if (error() && records().length === 0) {
        <div class="alert alert--danger">
          {{ error() }}
          <button type="button" class="btn btn-ghost btn-sm ml-auto" (click)="refresh()">
            Retry
          </button>
        </div>
      }

      <!-- Main grid: list + side panel -->
      @if (!loading() || records().length > 0) {
        <div
          class="review-queue-grid"
          [class.review-queue-grid--has-detail]="selectedChange() !== null"
        >
          <div class="review-queue-list">
            @if (filteredRecords().length === 0 && !loading()) {
              <div class="glass-inflow review-queue-empty">
                <p>
                  {{
                    statusFilter() === 'all'
                      ? 'No changes have been proposed.'
                      : 'No ' + statusFilter() + ' changes.'
                  }}
                </p>
              </div>
            } @else {
              <div class="review-queue-row-list">
                @for (change of filteredRecords(); track change.change_id) {
                  <app-change-row
                    [change]="change"
                    [selected]="selectedId() === change.change_id"
                    [checked]="checkedIds().has(change.change_id)"
                    [approverMode]="isApprover() && canWrite()"
                    (selectedChange)="selectChange($event)"
                    (checkToggled)="toggleCheck($event)"
                    (applyRequested)="applyChange($event)"
                  />
                }
              </div>
            }

            <!-- Batches section -->
            @if (!isMyView()) {
              <div class="review-queue-batches">
                <div class="review-queue-section-title">
                  <span>Batches</span>
                  <span class="review-queue-section-sub"
                    >Approved changes are grouped into batches and applied together.</span
                  >
                </div>
                @if (batches().length > 0) {
                  <div class="review-queue-batch-list">
                    @for (batch of batches(); track batch.batch_id) {
                      <div class="review-queue-batch-card glass-inflow">
                        <span
                          class="review-queue-batch-id"
                          [class.review-queue-batch-id--applied]="batch.allApplied"
                          >#{{ batch.batch_id }}</span
                        >
                        <div class="review-queue-batch-info">
                          <div class="review-queue-batch-title">{{ batch.title }}</div>
                          <div class="review-queue-batch-meta">
                            {{ batch.ids.length }} change(s) ·
                            {{
                              batch.allApplied
                                ? 'fully applied'
                                : batch.approvedCount + ' approved, awaiting apply'
                            }}
                          </div>
                        </div>
                        @if (!batch.allApplied && isApprover() && canWrite()) {
                          <button
                            type="button"
                            class="btn btn-primary btn-sm"
                            (click)="applyBatch(batch)"
                            [disabled]="actionLoading()"
                          >
                            <svg
                              width="14"
                              height="14"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              stroke-width="1.6"
                            >
                              <path
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z"
                              />
                            </svg>
                            Apply batch
                          </button>
                        }
                        @if (batch.allApplied) {
                          <span class="badge badge-success">
                            <svg
                              width="11"
                              height="11"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              stroke-width="2"
                            >
                              <path
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                d="M5 13l4 4L19 7"
                              />
                            </svg>
                            Applied
                          </span>
                        }
                      </div>
                    }
                  </div>
                } @else {
                  <div class="glass-inflow review-queue-empty-batches">
                    No batches yet. Approve pending changes to open one.
                  </div>
                }
              </div>
            }
          </div>

          <!-- Detail side panel -->
          @if (selectedChange(); as change) {
            <app-change-detail
              class="review-queue-detail"
              [change]="change"
              [approverMode]="isApprover() && canWrite()"
              (closed)="closeDetail()"
              (approveRequested)="approve(change)"
              (rejectRequested)="openRejectModal()"
              (applyRequested)="applyChange(change)"
            />
          }
        </div>
      }
    </div>

    <!-- Approve batch modal -->
    @if (approveBatchModalOpen()) {
      <div
        class="modal-overlay"
        tabindex="0"
        (click)="approveBatchModalOpen.set(false)"
        (keydown)="$event.key === 'Escape' && approveBatchModalOpen.set(false)"
        aria-label="Close modal"
      >
        <div
          class="modal-dialog"
          style="max-width: 460px"
          (click)="$event.stopPropagation()"
          (keydown)="$event.stopPropagation()"
          aria-modal="true"
          role="dialog"
          aria-labelledby="batch-modal-title"
        >
          <div class="modal-title-area">
            <h2 class="modal-title" id="batch-modal-title">Approve as a batch</h2>
            <p class="modal-title-sub">
              {{ pendingCheckedIds().length }} change(s) will share a new batch ID
            </p>
          </div>
          <div class="modal-content">
            <label class="form-label" for="batch-title-input">Batch title</label>
            <input
              id="batch-title-input"
              class="form-input"
              placeholder="e.g. June image additions"
              [value]="batchTitleInput()"
              (input)="batchTitleInput.set($any($event.target).value)"
            />
          </div>
          <div class="modal-actions">
            <button type="button" class="btn btn-ghost" (click)="approveBatchModalOpen.set(false)">
              Cancel
            </button>
            <button
              type="button"
              class="btn btn-primary"
              (click)="confirmBatchApprove()"
              [disabled]="!batchTitleInput().trim() || actionLoading()"
            >
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              Approve {{ pendingCheckedIds().length }}
            </button>
          </div>
        </div>
      </div>
    }

    <!-- Reject modal -->
    @if (rejectModalOpen()) {
      <div
        class="modal-overlay"
        tabindex="0"
        (click)="rejectModalOpen.set(false)"
        (keydown)="$event.key === 'Escape' && rejectModalOpen.set(false)"
        aria-label="Close modal"
      >
        <div
          class="modal-dialog"
          style="max-width: 460px"
          (click)="$event.stopPropagation()"
          (keydown)="$event.stopPropagation()"
          aria-modal="true"
          role="dialog"
          aria-labelledby="reject-modal-title"
        >
          <div class="modal-title-area">
            <h2 class="modal-title" id="reject-modal-title">Reject changes</h2>
            <p class="modal-title-sub">Provide a reason the requestor will see</p>
          </div>
          <div class="modal-content">
            <label class="form-label" for="reject-reason-input">Rejection reason</label>
            <textarea
              id="reject-reason-input"
              class="form-textarea"
              rows="3"
              placeholder="e.g. Download URL points to an untrusted host."
              [value]="rejectReason()"
              (input)="rejectReason.set($any($event.target).value)"
            ></textarea>
          </div>
          <div class="modal-actions">
            <button type="button" class="btn btn-ghost" (click)="rejectModalOpen.set(false)">
              Cancel
            </button>
            <button
              type="button"
              class="btn btn-danger"
              (click)="confirmReject()"
              [disabled]="!rejectReason().trim() || actionLoading()"
            >
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
              Reject
            </button>
          </div>
        </div>
      </div>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReviewQueueComponent {
  private readonly pendingQueue = inject(PendingQueueService);
  private readonly pendingSummary = inject(PendingQueueSummaryService);
  private readonly notifications = inject(NotificationService);
  private readonly shell = inject(ShellContextService);
  readonly api = inject(ModelReferenceApiService);
  readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  // ── Core state ──────────────────────────────────────────────────────
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly records = signal<PendingChangeRecord[]>([]);

  // ── Filter & selection ──────────────────────────────────────────────
  readonly statusFilter = signal<StatusFilter>('all');
  readonly selectedId = signal<number | null>(null);
  readonly checkedIds = signal<Set<number>>(new Set());

  // ── Modal state ─────────────────────────────────────────────────────
  readonly rejectModalOpen = signal(false);
  readonly rejectReason = signal('');
  readonly approveBatchModalOpen = signal(false);
  readonly batchTitleInput = signal('');
  readonly actionLoading = signal(false);

  // ── Role/computed ───────────────────────────────────────────────────
  readonly canWrite = computed(() => this.api.backendCapabilities().writable);
  readonly isApprover = computed(() => this.auth.isApprover());
  readonly isRequestor = computed(() => this.auth.isRequestor());
  readonly isAuthenticated = computed(() => this.auth.isAuthenticated());

  /** The user is a requestor but NOT an approver (sees "my changes"). */
  readonly isMyView = computed(
    () => !this.isApprover() && this.isRequestor() && this.isAuthenticated(),
  );

  /** Backend cannot accept writes (REPLICA mode or mismatched canonical format). */
  readonly isReadOnly = computed(() => !this.canWrite());

  /** Public viewer: can write but not authenticated (or authenticated but no role). */
  readonly isPublicView = computed(
    () => this.canWrite() && this.isAuthenticated() && !this.isRequestor() && !this.isApprover(),
  );

  // ── Derived data ────────────────────────────────────────────────────
  readonly filteredRecords = computed(() => {
    let list = this.records();

    // My-view: filter to own changes
    if (this.isMyView()) {
      const username = this.auth.username();
      if (username) {
        list = list.filter((r) => r.requested_username === username);
      }
    }

    // Status filter
    if (this.statusFilter() !== 'all') {
      list = list.filter((r) => r.status === this.statusFilter());
    }

    return list;
  });

  readonly statusCounts = computed(() => {
    const base = this.isMyView()
      ? this.records().filter((r) => r.requested_username === (this.auth.username() ?? ''))
      : this.records();
    const counts: Record<string, number> = { all: base.length };
    for (const key of Object.keys(STATUS_META)) {
      counts[key] = base.filter((r) => r.status === key).length;
    }
    return counts;
  });

  readonly selectedChange = computed(() => {
    const id = this.selectedId();
    if (id == null) return null;
    return this.records().find((r) => r.change_id === id) ?? null;
  });

  readonly pendingCheckedIds = computed(() => {
    const ids = this.checkedIds();
    return Array.from(ids).filter((id) => {
      const record = this.records().find((r) => r.change_id === id);
      return record?.status === 'pending';
    });
  });

  readonly batches = computed((): DerivedBatch[] => {
    // Don't show batches in "my view"
    if (this.isMyView()) return [];
    return batchesFromPending(this.records());
  });

  // ── Lifecycle ───────────────────────────────────────────────────────
  constructor() {
    // Set topbar context
    this.shell.setContext({
      breadcrumb: [{ label: 'Contribute', route: ['/propose'] }, { label: 'Review queue' }],
      title: this.isApprover()
        ? 'Write review queue'
        : this.isMyView()
          ? 'My proposed changes'
          : 'Pending review queue',
      sub: this.isApprover()
        ? 'Approve, reject & apply staged model changes'
        : this.isMyView()
          ? "Track the status of changes you've proposed"
          : 'Public view of changes pending review',
      actions: [],
    });

    // Load on init
    this.load();

    // Watch for focus param
    this.route.queryParams.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const focus = params['focus'];
      if (focus != null) {
        const id = Number(focus);
        if (!Number.isNaN(id)) {
          this.selectedId.set(id);
        }
      }
    });
  }

  // ── Data loading ────────────────────────────────────────────────────
  load(): void {
    this.loading.set(true);
    this.error.set(null);

    this.pendingQueue
      .listChanges({ limit: 200 })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (page) => {
          this.records.set(page.items ?? []);
          this.loading.set(false);
        },
        error: (err: Error) => {
          this.error.set(err.message);
          this.loading.set(false);
        },
      });
  }

  // ── Selection ───────────────────────────────────────────────────────
  selectChange(change: PendingChangeRecord): void {
    const id = change.change_id;
    if (this.selectedId() === id) {
      this.selectedId.set(null);
      this.updateFocusParam(null);
    } else {
      this.selectedId.set(id);
      this.updateFocusParam(id);
    }
  }

  closeDetail(): void {
    this.selectedId.set(null);
    this.updateFocusParam(null);
  }

  private updateFocusParam(id: number | null): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: id != null ? { focus: id } : {},
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  // ── Checkbox / multi-select ─────────────────────────────────────────
  toggleCheck(change: PendingChangeRecord): void {
    const id = change.change_id;
    this.checkedIds.update((set) => {
      const next = new Set(set);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  // ── Filters ─────────────────────────────────────────────────────────
  setStatusFilter(filter: StatusFilter): void {
    this.statusFilter.set(filter);
    this.selectedId.set(null);
  }

  // ── Notifications refresh ───────────────────────────────────────────
  refresh(): void {
    this.load();
    this.pendingSummary.refresh();
  }

  // ── Actions ─────────────────────────────────────────────────────────
  /** Approve one or more pending changes (opens batch modal for multi). */
  approve(change?: PendingChangeRecord): void {
    const ids = change ? [change.change_id] : this.pendingCheckedIds();
    if (ids.length === 0) return;

    if (ids.length > 1 || change == null) {
      this.batchTitleInput.set('');
      this.approveBatchModalOpen.set(true);
    } else {
      // Single: use default batch title
      this.executeApprove(ids, `Approved change #${ids[0]}`);
    }
  }

  /** Execute approve via processBatch. */
  private executeApprove(ids: number[], batchTitle: string): void {
    this.actionLoading.set(true);
    this.pendingQueue
      .processBatch({
        batch_title: batchTitle,
        approved_ids: ids,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          this.notifications.success(
            `Approved ${result.approved.length} change${result.approved.length === 1 ? '' : 's'}.`,
          );
          this.finishAction();
        },
        error: (err: Error) => {
          this.notifications.error(err.message);
          this.actionLoading.set(false);
        },
      });
  }

  confirmBatchApprove(): void {
    const ids = this.pendingCheckedIds();
    const title = this.batchTitleInput().trim();
    if (ids.length === 0 || !title) return;

    this.approveBatchModalOpen.set(false);
    this.executeApprove(ids, title);
  }

  /** Open reject modal for selected pending changes. */
  openRejectModal(): void {
    this.rejectReason.set('');
    this.rejectModalOpen.set(true);
  }

  confirmReject(): void {
    const ids = this.pendingCheckedIds();
    const reason = this.rejectReason().trim();
    if (ids.length === 0 || !reason) return;

    this.actionLoading.set(true);
    this.rejectModalOpen.set(false);

    // Reject each pending change individually
    this.pendingQueue
      .processBatch({
        batch_title: `Rejected ${ids.length} change(s)`,
        rejected_ids: ids,
        reject_reason: reason,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          this.notifications.error(`Rejected ${result.rejected.length} change(s).`);
          this.finishAction();
        },
        error: (err: Error) => {
          this.notifications.error(err.message);
          this.actionLoading.set(false);
        },
      });
  }

  /** Apply a single approved change. */
  applyChange(change: PendingChangeRecord): void {
    this.actionLoading.set(true);
    this.pendingQueue
      .applyChange(change.change_id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.notifications.success(`Applied change #${change.change_id} to the live dataset.`);
          this.finishAction();
        },
        error: (err: Error) => {
          this.notifications.error(err.message);
          this.actionLoading.set(false);
        },
      });
  }

  /** Apply an entire batch. */
  applyBatch(batch: DerivedBatch): void {
    this.actionLoading.set(true);
    this.pendingQueue
      .applyBatch(batch.batch_id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          const appliedCount = result.applied?.length ?? 0;
          this.notifications.success(
            `Applied batch #${batch.batch_id} (${appliedCount} change(s)).`,
          );
          if (result.batch_split_occurred) {
            this.notifications.warning(
              `Batch split: ${result.batch_split_reassigned_count} changes reassigned to batch #${result.batch_split_new_batch_id}.`,
            );
          }
          this.finishAction();
        },
        error: (err: Error) => {
          this.notifications.error(err.message);
          this.actionLoading.set(false);
        },
      });
  }

  private finishAction(): void {
    this.actionLoading.set(false);
    this.checkedIds.set(new Set());
    this.load();
    this.pendingSummary.refresh();
  }

  // ── Helpers ─────────────────────────────────────────────────────────
  protected statusLabel(s: PendingChangeStatus | string): string {
    return statusLabel(s);
  }

  /** Exposed for template: all status filter options */
  protected readonly statusFilters = ALL_STATUS_FILTERS;

  /** Exposed for template: status counts */
  protected readonly counts = this.statusCounts;

  /** Exposed for template: status meta map */
  protected readonly STATUS_META = STATUS_META;
}
