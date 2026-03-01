import { computed, DestroyRef, inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import type {
  MODEL_REFERENCE_CATEGORY,
  PendingChangeRecord,
} from '../api-client/model/models';
import { AuthService } from './auth.service';
import { PendingQueueService } from './pending-queue.service';

const POLL_INTERVAL_MS = 60_000;

@Injectable({
  providedIn: 'root',
})
export class PendingQueueSummaryService {
  private readonly pendingQueue = inject(PendingQueueService);
  private readonly auth = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);

  private pollTimer: ReturnType<typeof setInterval> | null = null;

  private readonly _records = signal<PendingChangeRecord[]>([]);
  private readonly _loading = signal(false);
  private readonly _lastRefreshed = signal<Date | null>(null);

  readonly loading = this._loading.asReadonly();
  readonly lastRefreshed = this._lastRefreshed.asReadonly();

  readonly totalPendingCount = computed(
    () => this._records().filter((r) => r.status === 'pending').length,
  );

  readonly pendingCountByCategory = computed(() => {
    const map = new Map<string, number>();
    for (const record of this._records()) {
      if (record.status !== 'pending') continue;
      const cat = record.category as string;
      map.set(cat, (map.get(cat) ?? 0) + 1);
    }
    return map;
  });

  /** All cached pending records (used by Phase 2 for model list integration). */
  readonly records = this._records.asReadonly();

  constructor() {
    this.destroyRef.onDestroy(() => this.stopPolling());
  }

  /** Start polling. Safe to call multiple times; only one timer runs. */
  startPolling(): void {
    if (this.pollTimer) return;
    this.refresh();
    this.pollTimer = setInterval(() => {
      if (this.auth.isAuthenticated()) {
        this.refresh();
      }
    }, POLL_INTERVAL_MS);
  }

  stopPolling(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  /** Clear cached data (e.g., on logout). */
  clear(): void {
    this._records.set([]);
    this._lastRefreshed.set(null);
    this.stopPolling();
  }

  refresh(): void {
    if (!this.auth.isAuthenticated()) return;
    this._loading.set(true);

    this.pendingQueue
      .listChanges({ statuses: ['pending'], limit: 200 })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (page) => {
          this._records.set(page.items ?? []);
          this._lastRefreshed.set(new Date());
          this._loading.set(false);
        },
        error: () => {
          this._loading.set(false);
        },
      });
  }

  /** Get the pending count for a specific category. */
  pendingCountFor(category: MODEL_REFERENCE_CATEGORY | string): number {
    return this.pendingCountByCategory().get(category) ?? 0;
  }
}
