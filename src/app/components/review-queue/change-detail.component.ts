import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { JsonPipe } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import type { PendingChangeRecord, PendingChangeDiff } from '../../api-client';
import { PendingQueueService } from '../../services/pending-queue.service';
import { OP_META, statusLabel } from '../../shared/queue-meta';
import { domainMeta } from '../../shared/domain';

type DetailTab = 'diff' | 'payload';

/**
 * Represents a field-level diff entry parsed from the API's field_diffs.
 */
interface ParsedFieldDiff {
  field_path: string;
  old_value: unknown;
  new_value: unknown;
  change_type: 'added' | 'removed' | 'modified';
}

@Component({
  selector: 'app-change-detail',
  imports: [JsonPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="change-detail glass-inflow">
      <!-- Header -->
      <div class="change-detail-header">
        <div class="change-detail-header-info">
          <div class="change-detail-op-line">
            <span class="change-detail-op-label" [attr.data-op]="change().operation">{{
              opMeta().label
            }}</span>
            <span class="change-detail-id">change #{{ change().change_id }}</span>
            <span class="change-detail-status-badge" [attr.data-status]="status()">{{
              statusLabel()
            }}</span>
          </div>
          <div class="change-detail-model-name">{{ change().model_name }}</div>
          <div class="change-detail-meta">
            {{ displayCategory() }} · by {{ change().requested_username }} · {{ formattedDate() }}
          </div>
        </div>
        <button
          type="button"
          class="change-detail-close"
          (click)="closed.emit()"
          aria-label="Close detail panel"
        >
          <svg
            width="17"
            height="17"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <!-- Reject reason banner -->
      @if (change().reject_reason) {
        <div class="change-detail-reject-banner">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.6"
          >
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
          <div><strong>Rejected:</strong> {{ change().reject_reason }}</div>
        </div>
      }

      <!-- Batch / job line -->
      @if (change().batch_id !== null && change().batch_id !== undefined) {
        <div class="change-detail-batch-line">
          Batch <strong>#{{ change().batch_id }}</strong>
          @if (change().applied_job_id) {
            · job {{ change().applied_job_id }}
          }
        </div>
      }

      <!-- Tabs -->
      <div class="change-detail-tabs">
        @for (t of detailTabs; track t[0]) {
          <button
            type="button"
            class="change-detail-tab"
            [class.change-detail-tab--active]="activeTab() === t[0]"
            (click)="activeTab.set(t[0])"
          >
            {{ t[1] }}
          </button>
        }
      </div>

      <!-- Tab content -->
      <div class="change-detail-tab-body">
        @if (activeTab() === 'diff') {
          @if (loadingDiff()) {
            <div class="change-detail-loading">Loading diff…</div>
          } @else if (diffError()) {
            <div class="change-detail-loading text-danger-600 dark:text-danger-400">
              {{ diffError() }}
            </div>
          } @else if (diff()?.field_diffs?.length) {
            <div class="change-detail-diff-list">
              @for (d of parsedFieldDiffs(); track d.field_path) {
                <div class="change-detail-diff-card">
                  <!-- Header -->
                  <div class="change-detail-diff-card-header">
                    <span
                      class="change-detail-diff-card-dot"
                      [attr.data-kind]="d.change_type"
                    ></span>
                    <span>{{ d.field_path }}</span>
                  </div>
                  <!-- Before / After -->
                  <div class="change-detail-diff-card-body">
                    <div class="change-detail-diff-cell" data-side="before">
                      <div class="change-detail-diff-cell-label">Before</div>
                      <div class="change-detail-diff-cell-value">
                        {{ formatValue(d.old_value) }}
                      </div>
                    </div>
                    <div class="change-detail-diff-cell" data-side="after">
                      <div class="change-detail-diff-cell-label">After</div>
                      <div class="change-detail-diff-cell-value">
                        {{ formatValue(d.new_value) }}
                      </div>
                    </div>
                  </div>
                </div>
              }
            </div>
          } @else {
            <div class="change-detail-empty-diff">
              {{
                change().operation === 'delete'
                  ? 'This change removes the entire record.'
                  : 'No field-level diff recorded.'
              }}
            </div>
          }
        } @else {
          <pre class="change-detail-payload">{{ change().payload | json }}</pre>
        }
      </div>

      <!-- Footer actions (approver + pending/approved) -->
      @if (approverMode() && (status() === 'pending' || status() === 'approved')) {
        <div class="change-detail-footer">
          @if (status() === 'pending') {
            <button
              type="button"
              class="btn btn-danger"
              style="flex: 1"
              (click)="rejectRequested.emit()"
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
            <button
              type="button"
              class="btn btn-primary"
              style="flex: 1"
              (click)="approveRequested.emit()"
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
              Approve
            </button>
          }
          @if (status() === 'approved') {
            <button
              type="button"
              class="btn btn-primary"
              style="flex: 1"
              (click)="applyRequested.emit()"
            >
              <svg
                width="15"
                height="15"
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
              Apply to live dataset
            </button>
          }
        </div>
      }
    </div>
  `,
})
export class ChangeDetailComponent {
  private readonly pendingQueue = inject(PendingQueueService);
  private readonly destroyRef = inject(DestroyRef);

  readonly change = input.required<PendingChangeRecord>();
  readonly approverMode = input(false);

  readonly closed = output<void>();
  readonly approveRequested = output<void>();
  readonly rejectRequested = output<void>();
  readonly applyRequested = output<void>();

  readonly activeTab = signal<DetailTab>('diff');
  readonly diff = signal<PendingChangeDiff | null>(null);
  readonly loadingDiff = signal(false);
  readonly diffError = signal<string | null>(null);
  private diffLoadedFor: number | null = null;

  readonly detailTabs: [DetailTab, string][] = [
    ['diff', 'Diff'],
    ['payload', 'Payload JSON'],
  ];

  readonly status = computed(() => this.change().status ?? 'pending');
  readonly opMeta = computed(() => OP_META[this.change().operation]);

  protected statusLabel = computed(() => statusLabel(this.status()));
  protected displayCategory = computed(() => {
    const meta = domainMeta(this.change().category);
    return meta.label;
  });
  protected formattedDate = computed(() => {
    const ts = this.change().requested_at;
    if (ts == null) return '';
    return new Date(ts * 1000).toLocaleString();
  });

  /** Parse field_diffs from the API response into a typed array. */
  protected parsedFieldDiffs = computed((): ParsedFieldDiff[] => {
    const raw: (Record<string, unknown> | null)[] | undefined = this.diff()?.field_diffs as
      | (Record<string, unknown> | null)[]
      | undefined;
    if (!raw) return [];
    return raw
      .filter((d): d is Record<string, unknown> => d != null && typeof d === 'object')
      .map((d) => ({
        field_path: String(d['field_path'] ?? d['field'] ?? ''),
        old_value: d['old_value'] ?? d['before'] ?? null,
        new_value: d['new_value'] ?? d['after'] ?? null,
        change_type: String(d['change_type'] ?? d['kind'] ?? 'modified') as
          | 'added'
          | 'removed'
          | 'modified',
      }));
  });

  protected formatValue(value: unknown): string {
    if (value === null || value === undefined) return '∅';
    if (Array.isArray(value)) return `[${value.join(', ')}]`;
    if (typeof value === 'boolean') return String(value);
    return String(value);
  }

  constructor() {
    // Load diff when change changes
    // (handled via ngOnChanges-like effect in template)
  }

  /** Called by the parent when the panel becomes visible. */
  loadDiff(): void {
    const changeId = this.change().change_id;
    if (this.diffLoadedFor === changeId) return;

    this.loadingDiff.set(true);
    this.diffError.set(null);

    this.pendingQueue
      .getChangeDiff(changeId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (d: PendingChangeDiff) => {
          this.diff.set(d);
          this.diffLoadedFor = changeId;
          this.loadingDiff.set(false);
        },
        error: (err: Error) => {
          this.diffError.set(err.message);
          this.loadingDiff.set(false);
        },
      });
  }
}
