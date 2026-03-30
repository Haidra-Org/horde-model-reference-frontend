import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { NgClass } from '@angular/common';
import type {
  BatchNetChangeResponse,
  NetChangeType,
  FieldChangeType,
  FieldDiff,
} from '../../api-client/model/models';

@Component({
  selector: 'app-pending-queue-batch-net-changes',
  templateUrl: './pending-queue-batch-net-changes.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PendingQueueBatchNetChangesComponent {
  readonly data = input<BatchNetChangeResponse | null>(null);
  readonly searchTerm = signal('');
  readonly changeTypeFilter = signal<'all' | NetChangeType>('all');
  readonly criticalOnlyFilter = signal(false);

  readonly hasData = computed(() => !!this.data());

  readonly changeTypeCounts = computed(() => {
    const data = this.data();
    const counts = {
      all: data?.model_changes?.length ?? 0,
      added: 0,
      modified: 0,
      deleted: 0,
      unchanged: 0,
    };

    data?.model_changes?.forEach((model) => {
      const changeType = (model.net_operation ?? '').toLowerCase();
      if (changeType in counts) {
        counts[changeType as keyof typeof counts]++;
      }
    });

    return counts;
  });

  readonly filteredModels = computed(() => {
    const data = this.data();
    const models = data?.model_changes ?? [];
    const query = this.searchTerm().trim().toLowerCase();
    const typeFilter = this.changeTypeFilter();
    const criticalOnly = this.criticalOnlyFilter();

    return models.filter((model) => {
      if (typeFilter !== 'all' && (model.net_operation ?? '').toLowerCase() !== typeFilter) {
        return false;
      }

      if (criticalOnly && !model.is_critical) {
        return false;
      }

      if (!query) {
        return true;
      }

      const searchableText = model.model_name?.toLowerCase() ?? '';
      return searchableText.includes(query);
    });
  });

  onSearchTermChange(value: string): void {
    this.searchTerm.set(value);
  }

  clearSearch(): void {
    this.searchTerm.set('');
  }

  setChangeTypeFilter(filter: 'all' | NetChangeType): void {
    this.changeTypeFilter.set(filter);
  }

  toggleCriticalOnlyFilter(): void {
    this.criticalOnlyFilter.update((value) => !value);
  }

  getChangeTypeLabel(changeType: string | undefined): string {
    switch (changeType?.toLowerCase()) {
      case 'added':
        return 'Added';
      case 'modified':
        return 'Modified';
      case 'deleted':
        return 'Deleted';
      case 'unchanged':
        return 'No Net Change';
      default:
        return 'Unknown';
    }
  }

  isChangeType(model: { net_operation?: string | null }, type: NetChangeType): boolean {
    return (model.net_operation ?? '').toLowerCase() === type;
  }

  isUnknownChangeType(model: { net_operation?: string | null }): boolean {
    const op = (model.net_operation ?? '').toLowerCase();
    return op !== 'added' && op !== 'modified' && op !== 'deleted' && op !== 'unchanged';
  }

  getFieldChangeTypeLabel(changeType: FieldChangeType | undefined): string {
    switch (changeType) {
      case 'added':
        return 'Added';
      case 'removed':
        return 'Removed';
      case 'modified':
        return 'Modified';
      default:
        return 'Unknown';
    }
  }

  isFieldChangeType(diff: FieldDiff, type: FieldChangeType): boolean {
    return diff.change_type === type;
  }

  isUnknownFieldChangeType(diff: FieldDiff): boolean {
    return (
      diff.change_type !== 'added' &&
      diff.change_type !== 'removed' &&
      diff.change_type !== 'modified'
    );
  }

  formatFieldValue(value: unknown): string {
    if (value === null || value === undefined) {
      return '—';
    }
    if (typeof value === 'object') {
      return JSON.stringify(value);
    }
    return String(value);
  }

  shouldShowFieldDiff(diff: FieldDiff): boolean {
    // Always show fields that changed
    return diff.change_type !== undefined;
  }
}
