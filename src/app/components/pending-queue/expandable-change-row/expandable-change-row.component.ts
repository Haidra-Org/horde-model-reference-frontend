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
import { DatePipe } from '@angular/common';
import { Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import type {
  AuditOperation,
  PendingChangeDiff,
  PendingChangeRecord,
  PendingChangeStatus,
} from '../../../api-client/model/models';
import { PendingQueueService } from '../../../services/pending-queue.service';
import { AuthService } from '../../../services/auth.service';
import { DeltaDiffComponent } from '../../common/delta-diff/delta-diff.component';
import { HordeButtonComponent } from '@haidra/design-system/button';

@Component({
  selector: 'app-expandable-change-row',
  imports: [DatePipe, DeltaDiffComponent, HordeButtonComponent],
  templateUrl: './expandable-change-row.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ExpandableChangeRowComponent {
  private readonly pendingQueue = inject(PendingQueueService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);
  readonly auth = inject(AuthService);

  readonly change = input.required<PendingChangeRecord>();
  /** Whether to show the category column in collapsed view */
  readonly showCategory = input(true);
  /** Whether to show the requestor column in collapsed view */
  readonly showRequestor = input(true);

  readonly approveRequested = output<PendingChangeRecord>();
  readonly rejectRequested = output<PendingChangeRecord>();
  readonly applyRequested = output<PendingChangeRecord>();
  readonly applyBatchRequested = output<PendingChangeRecord>();

  readonly expanded = signal(false);
  readonly diff = signal<PendingChangeDiff | null>(null);
  readonly loadingDiff = signal(false);
  readonly diffError = signal<string | null>(null);
  private diffLoadedForId: number | null = null;

  readonly isPending = computed(() => this.change().status === 'pending');
  readonly isApproved = computed(() => this.change().status === 'approved');
  readonly isRejected = computed(() => this.change().status === 'rejected');
  readonly isApplied = computed(() => this.change().status === 'applied');
  readonly hasBatch = computed(() => this.change().batch_id != null);

  toggle(): void {
    const willExpand = !this.expanded();
    this.expanded.set(willExpand);

    if (willExpand && this.diffLoadedForId !== this.change().change_id) {
      this.loadDiff();
    }
  }

  private loadDiff(): void {
    const changeId = this.change().change_id;
    this.loadingDiff.set(true);
    this.diffError.set(null);

    this.pendingQueue
      .getChangeDiff(changeId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (diff) => {
          this.diff.set(diff);
          this.diffLoadedForId = changeId;
          this.loadingDiff.set(false);
        },
        error: (err: Error) => {
          this.diffError.set(err.message);
          this.loadingDiff.set(false);
        },
      });
  }

  retryDiff(): void {
    this.loadDiff();
  }

  viewInEditor(): void {
    const c = this.change();
    if (c.operation === 'create' && c.status !== 'applied') {
      this.router.navigate(['/categories', c.category, 'create'], {
        state: { prefill: c.payload, modelName: c.model_name },
      });
    } else {
      this.router.navigate(['/categories', c.category, 'edit', c.model_name]);
    }
  }

  statusLabel(status: PendingChangeStatus | undefined): string {
    if (!status) return 'Unknown';
    return status.charAt(0).toUpperCase() + status.slice(1);
  }

  operationLabel(operation: AuditOperation | undefined): string {
    if (!operation) return 'Unknown';
    return operation.charAt(0).toUpperCase() + operation.slice(1);
  }

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

  toDate(timestamp: number | null | undefined): number {
    return (timestamp ?? 0) * 1000;
  }
}
