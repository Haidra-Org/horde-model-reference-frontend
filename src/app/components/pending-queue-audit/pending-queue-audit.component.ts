import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import type { BatchNetChangeResponse } from '../../api-client/model/models';
import {
  AUDIT_DOMAINS,
  AuditDomain,
  PendingQueueAuditBatchPage,
  PendingQueueAuditBatchSummary,
  PendingQueueAuditBatchDetail,
  PendingQueueAuditChange,
  PendingQueueAuditCurrentResponse,
} from '../../models/pending-queue-audit';
import {
  PendingQueueAuditService,
  AuditDisabledError,
} from '../../services/pending-queue-audit.service';
import { AuditDomainPreferenceService } from '../../services/audit-domain-preference.service';
import { PendingQueueAuditDetailDrawerComponent } from './pending-queue-audit-detail-drawer.component';
import { PendingQueueAuditTimelineComponent } from './pending-queue-audit-timeline.component';
import { NotificationService } from '../../services/notification.service';

@Component({
  selector: 'app-pending-queue-audit-page',
  imports: [DatePipe, PendingQueueAuditDetailDrawerComponent, PendingQueueAuditTimelineComponent],
  templateUrl: './pending-queue-audit.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PendingQueueAuditComponent {
  private readonly auditService = inject(PendingQueueAuditService);
  private readonly domainPreference = inject(AuditDomainPreferenceService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly notifications = inject(NotificationService);

  readonly domainOptions = AUDIT_DOMAINS;
  readonly selectedDomain = this.domainPreference.domain;

  readonly currentSnapshot = signal<PendingQueueAuditCurrentResponse | null>(null);
  readonly batchSummaries = signal<PendingQueueAuditBatchSummary[]>([]);
  readonly nextCursor = signal<number | null>(null);

  readonly selectedBatch = signal<PendingQueueAuditBatchSummary | null>(null);
  readonly selectedBatchDetail = signal<PendingQueueAuditBatchDetail | null>(null);
  readonly selectedBatchNetChanges = signal<BatchNetChangeResponse | null>(null);
  readonly selectedPendingChange = signal<PendingQueueAuditChange | null>(null);

  readonly loadingBatchDetail = signal(false);
  readonly loadingNetChanges = signal(false);
  readonly batchDetailError = signal<string | null>(null);
  readonly netChangesError = signal<string | null>(null);

  readonly loadingCurrent = signal(false);
  readonly loadingBatches = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly auditDisabled = signal(false);

  readonly pendingChanges = computed<PendingQueueAuditChange[]>(
    () => this.currentSnapshot()?.pending_changes ?? [],
  );
  readonly hasStaleData = computed(() => {
    const generatedAt = this.currentSnapshot()?.generated_at;
    if (!generatedAt) {
      return false;
    }
    const generatedDate = generatedAt * 1000;
    return Date.now() - generatedDate > 5 * 60 * 1000;
  });

  private lastLoadedDomain: AuditDomain | null = null;

  constructor() {
    effect(
      () => {
        const domain = this.selectedDomain();
        this.reloadForDomain(domain, false);
      },
      { allowSignalWrites: true },
    );
  }

  onDomainChange(domain: AuditDomain): void {
    this.domainPreference.setDomain(domain);
    this.reloadForDomain(domain, true);
  }

  onDomainSelectChange(event: Event): void {
    const target = event.target as HTMLSelectElement | null;
    if (!target) {
      return;
    }
    this.onDomainChange(target.value as AuditDomain);
  }

  refresh(): void {
    this.auditService.clearDetailCache();
    this.reloadForDomain(this.selectedDomain(), true);
  }

  formatDomain(domain: AuditDomain): string {
    return domain === 'legacy' ? 'Legacy' : 'V2';
  }

  loadMoreBatches(): void {
    const domain = this.selectedDomain();
    const cursor = this.nextCursor();
    if (cursor === null || this.loadingBatches()) {
      return;
    }

    this.loadingBatches.set(true);
    this.auditService
      .listBatches({ domain, cursor, limit: 10 })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (page: PendingQueueAuditBatchPage) => {
          this.batchSummaries.update((existing) => [...existing, ...page.batches]);
          this.nextCursor.set(page.next_cursor ?? null);
          this.auditService.updateCacheFromPage(page, domain);
          this.loadingBatches.set(false);
          this.errorMessage.set(null);
          this.auditDisabled.set(false);
        },
        error: (error: Error) => {
          if (!this.handleAuditDisabled(error)) {
            this.errorMessage.set(error.message);
          }
          this.loadingBatches.set(false);
        },
      });
  }

  pendingChangesCount(): number {
    return this.pendingChanges().length;
  }

  trackBatch(_: number, batch: PendingQueueAuditBatchSummary): number {
    return batch.batch_id;
  }

  trackChange(_: number, change: PendingQueueAuditChange): number {
    return change.change_id;
  }

  toDate(timestamp?: number | null): number | null {
    if (!timestamp) {
      return null;
    }
    return timestamp * 1000;
  }

  formatRelativeTime(timestamp?: number | null): string | null {
    if (!timestamp) {
      return null;
    }

    const diffMs = Date.now() - timestamp * 1000;
    if (diffMs < 0) {
      return 'just now';
    }

    const minutes = Math.floor(diffMs / 60000);
    if (minutes < 1) {
      return 'just now';
    }

    if (minutes < 60) {
      return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
    }

    const hours = Math.floor(minutes / 60);
    if (hours < 24) {
      return `${hours} hour${hours === 1 ? '' : 's'} ago`;
    }

    const days = Math.floor(hours / 24);
    return `${days} day${days === 1 ? '' : 's'} ago`;
  }

  openPendingChangeTimeline(change: PendingQueueAuditChange): void {
    this.selectedPendingChange.set(change);
  }

  closePendingChangeTimeline(): void {
    this.selectedPendingChange.set(null);
  }

  onPendingChangeBackdrop(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.closePendingChangeTimeline();
    }
  }

  copyPendingChangeJson(change: PendingQueueAuditChange): void {
    const payload = JSON.stringify(change, null, 2);
    if (navigator?.clipboard) {
      navigator.clipboard
        .writeText(payload)
        .then(() => this.notifications.success(`Change #${change.change_id} copied to clipboard.`))
        .catch(() => this.notifications.error('Unable to copy change JSON.'));
      return;
    }

    try {
      const textarea = document.createElement('textarea');
      textarea.value = payload;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      document.execCommand('copy');
      this.notifications.success(`Change #${change.change_id} copied to clipboard.`);
      document.body.removeChild(textarea);
    } catch (error) {
      console.error('Failed to copy pending change JSON', error);
      this.notifications.error('Unable to copy change JSON.');
    }
  }

  openBatchDetail(batch: PendingQueueAuditBatchSummary): void {
    this.selectedBatch.set(batch);
    this.fetchBatchDetail(batch.batch_id, false);
    this.fetchBatchNetChanges(batch.batch_id, false);
  }

  closeBatchDetail(): void {
    this.selectedBatch.set(null);
    this.selectedBatchDetail.set(null);
    this.selectedBatchNetChanges.set(null);
    this.loadingBatchDetail.set(false);
    this.loadingNetChanges.set(false);
    this.batchDetailError.set(null);
    this.netChangesError.set(null);
  }

  retryBatchDetail(): void {
    const batch = this.selectedBatch();
    if (!batch) {
      return;
    }
    this.fetchBatchDetail(batch.batch_id, true);
  }

  retryNetChanges(): void {
    const batch = this.selectedBatch();
    if (!batch) {
      return;
    }
    this.fetchBatchNetChanges(batch.batch_id, true);
  }

  private reloadForDomain(domain: AuditDomain, forceReload: boolean): void {
    if (!forceReload && this.lastLoadedDomain === domain) {
      return;
    }

    if (this.lastLoadedDomain !== domain) {
      this.auditService.clearDetailCache();
    }

    this.lastLoadedDomain = domain;
    this.batchSummaries.set([]);
    this.nextCursor.set(null);
    this.auditDisabled.set(false);
    this.errorMessage.set(null);
    this.closeBatchDetail();
    this.closePendingChangeTimeline();
    this.loadCurrent(domain);
    this.loadInitialBatches(domain);
  }

  private loadCurrent(domain: AuditDomain): void {
    this.loadingCurrent.set(true);
    this.auditService
      .getCurrent(domain)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response: PendingQueueAuditCurrentResponse) => {
          this.currentSnapshot.set(response);
          this.loadingCurrent.set(false);
          this.errorMessage.set(null);
          this.auditDisabled.set(false);
        },
        error: (error: Error) => {
          this.loadingCurrent.set(false);
          if (!this.handleAuditDisabled(error)) {
            this.errorMessage.set(error.message);
          }
        },
      });
  }

  private loadInitialBatches(domain: AuditDomain): void {
    this.loadingBatches.set(true);
    this.auditService
      .listBatches({ domain, limit: 10 })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (page: PendingQueueAuditBatchPage) => {
          this.batchSummaries.set(page.batches);
          this.nextCursor.set(page.next_cursor ?? null);
          this.auditService.updateCacheFromPage(page, domain);
          this.loadingBatches.set(false);
          this.errorMessage.set(null);
          this.auditDisabled.set(false);
        },
        error: (error: Error) => {
          this.loadingBatches.set(false);
          if (!this.handleAuditDisabled(error)) {
            this.errorMessage.set(error.message);
          }
        },
      });
  }

  private fetchBatchDetail(batchId: number, forceRefresh: boolean): void {
    if (!forceRefresh) {
      this.selectedBatchDetail.set(null);
    }
    this.loadingBatchDetail.set(true);
    this.batchDetailError.set(null);
    this.auditService
      .getBatchDetail(batchId, { domain: this.selectedDomain(), forceRefresh })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (detail: PendingQueueAuditBatchDetail) => {
          this.selectedBatchDetail.set(detail);
          this.loadingBatchDetail.set(false);
        },
        error: (error: Error) => {
          this.batchDetailError.set(error.message);
          this.loadingBatchDetail.set(false);
        },
      });
  }

  private fetchBatchNetChanges(batchId: number, forceRefresh: boolean): void {
    if (!forceRefresh) {
      this.selectedBatchNetChanges.set(null);
    }
    this.loadingNetChanges.set(true);
    this.netChangesError.set(null);
    this.auditService
      .getBatchNetChanges(batchId, { domain: this.selectedDomain(), forceRefresh })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (netChanges: BatchNetChangeResponse) => {
          this.selectedBatchNetChanges.set(netChanges);
          this.loadingNetChanges.set(false);
        },
        error: (error: Error) => {
          this.netChangesError.set(error.message);
          this.loadingNetChanges.set(false);
        },
      });
  }

  private handleAuditDisabled(error: Error): boolean {
    if (error instanceof AuditDisabledError) {
      this.auditDisabled.set(true);
      this.errorMessage.set(null);
      return true;
    }
    return false;
  }
}
