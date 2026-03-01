import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import type {
  PendingQueueAuditBatchDetail,
  PendingQueueAuditBatchSummary,
  PendingQueueAuditChange,
} from '../../models/pending-queue-audit';
import type { BatchNetChangeResponse } from '../../api-client/model/models';
import { PendingQueueAuditTimelineComponent } from './pending-queue-audit-timeline.component';
import { PendingQueueBatchNetChangesComponent } from './pending-queue-batch-net-changes.component';
import { NotificationService } from '../../services/notification.service';

@Component({
  selector: 'app-pending-queue-audit-detail-drawer',
  imports: [DatePipe, PendingQueueAuditTimelineComponent, PendingQueueBatchNetChangesComponent],
  templateUrl: './pending-queue-audit-detail-drawer.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PendingQueueAuditDetailDrawerComponent {
  private readonly notifications = inject(NotificationService);

  readonly open = input(false);
  readonly summary = input<PendingQueueAuditBatchSummary | null>(null);
  readonly detail = input<PendingQueueAuditBatchDetail | null>(null);
  readonly netChanges = input<BatchNetChangeResponse | null>(null);
  readonly loading = input(false);
  readonly netChangesLoading = input(false);
  readonly error = input<string | null>(null);
  readonly netChangesError = input<string | null>(null);

  readonly closed = output<void>();
  readonly retryRequested = output<void>();
  readonly netChangesRetryRequested = output<void>();

  readonly activeTab = signal<'timeline' | 'net-changes'>('timeline');
  readonly searchTerm = signal('');
  readonly statusFilter = signal<'all' | 'pending' | 'applied' | 'rejected'>('all');

  private lastBatchId: number | null = null;

  readonly statusCounts = computed(() => {
    const detail = this.detail();
    const counts = {
      all: detail?.changes?.length ?? 0,
      pending: 0,
      applied: 0,
      rejected: 0,
    };

    detail?.changes?.forEach((change) => {
      const status = (change.status ?? '').toLowerCase();
      if (status in counts) {
        counts[status as keyof typeof counts]++;
      }
    });

    return counts;
  });

  readonly filteredChanges = computed(() => {
    const detail = this.detail();
    const changes = detail?.changes ?? [];
    const query = this.searchTerm().trim().toLowerCase();
    const statusFilter = this.statusFilter();

    return [...changes]
      .filter((change) => {
        if (statusFilter !== 'all' && (change.status ?? '').toLowerCase() !== statusFilter) {
          return false;
        }

        if (!query) {
          return true;
        }

        const fields = [
          change.change_id?.toString() ?? '',
          change.model_name ?? '',
          change.operation ?? '',
          change.requested_by ?? '',
          change.approved_by ?? '',
          change.applied_by ?? '',
        ].map((value) => value.toLowerCase());

        return fields.some((value) => value.includes(query));
      })
      .sort((a, b) => (b.requested_at ?? 0) - (a.requested_at ?? 0));
  });

  constructor() {
    effect(
      () => {
        const batchId = this.summary()?.batch_id ?? null;
        if (batchId !== this.lastBatchId) {
          this.lastBatchId = batchId;
          this.searchTerm.set('');
          this.statusFilter.set('all');
          this.activeTab.set('timeline');
        }
      },
      { allowSignalWrites: true },
    );
  }

  closeDrawer(): void {
    this.closed.emit();
  }

  onBackdropInteraction(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.closeDrawer();
    }
  }

  retry(): void {
    this.retryRequested.emit();
  }

  retryNetChanges(): void {
    this.netChangesRetryRequested.emit();
  }

  switchTab(tab: 'timeline' | 'net-changes'): void {
    this.activeTab.set(tab);
  }

  onSearchTermChange(value: string): void {
    this.searchTerm.set(value);
  }

  clearSearch(): void {
    this.searchTerm.set('');
  }

  setStatusFilter(filter: 'all' | 'pending' | 'applied' | 'rejected'): void {
    this.statusFilter.set(filter);
  }

  copyBatchJson(): void {
    const detail = this.detail();
    if (!detail) {
      return;
    }

    this.copyText(JSON.stringify(detail, null, 2), 'Batch detail copied to clipboard.');
  }

  copyChangeJson(change: PendingQueueAuditChange): void {
    this.copyText(
      JSON.stringify(change, null, 2),
      `Change #${change.change_id} copied to clipboard.`,
    );
  }

  downloadBatchDetail(): void {
    const detail = this.detail();
    if (!detail) {
      return;
    }

    const filename = `pending-queue-batch-${detail.batch_id}.json`;
    const blob = new Blob([JSON.stringify(detail, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
    this.notifications.success('Batch detail downloaded.');
  }

  hasDetail(): boolean {
    return !!this.detail();
  }

  formatStatus(change: PendingQueueAuditChange): string {
    return (change.status ?? 'unknown').toLowerCase();
  }

  statusLabel(change: PendingQueueAuditChange): string {
    const status = (change.status ?? 'unknown').toLowerCase();
    switch (status) {
      case 'applied':
        return 'Applied';
      case 'rejected':
        return 'Rejected';
      case 'pending':
        return 'Pending';
      default:
        return status.replace(/^\w/, (char) => char.toUpperCase());
    }
  }

  toDate(timestamp?: number | null): number | null {
    if (!timestamp) {
      return null;
    }
    return timestamp * 1000;
  }

  private copyText(text: string, successMessage: string): void {
    if (navigator?.clipboard) {
      navigator.clipboard
        .writeText(text)
        .then(() => this.notifications.success(successMessage))
        .catch(() => this.notifications.error('Unable to copy to clipboard.'));
      return;
    }

    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    try {
      document.execCommand('copy');
      this.notifications.success(successMessage);
    } catch (error) {
      console.error('Failed to copy text', error);
      this.notifications.error('Unable to copy to clipboard.');
    } finally {
      document.body.removeChild(textarea);
    }
  }
}
