import { Component, ChangeDetectionStrategy, input, computed } from '@angular/core';
import { PendingChangeDiff } from '../../../api-client';
import { JsonPipe } from '@angular/common';

/**
 * Represents a single field-level difference.
 */
export interface FieldDiffItem {
  field_path: string;
  old_value: unknown;
  new_value: unknown;
  change_type: 'added' | 'removed' | 'modified';
}

/** Threshold (in characters) above which a diff value is collapsed by default. */
const COLLAPSE_THRESHOLD = 200;

@Component({
  selector: 'app-delta-diff',
  imports: [JsonPipe],
  template: `
    <div class="delta-diff">
      <!-- Summary badges -->
      <div class="flex flex-wrap gap-2 mb-4">
        @if (addedCount() > 0) {
          <span class="badge badge-create">+ {{ addedCount() }} added</span>
        }
        @if (modifiedCount() > 0) {
          <span class="badge badge-update">~ {{ modifiedCount() }} modified</span>
        }
        @if (removedCount() > 0) {
          <span class="badge badge-delete">&minus; {{ removedCount() }} removed</span>
        }
        @if (diff()?.is_critical) {
          <span class="badge badge-danger">Critical fields affected</span>
        }
      </div>

      <!-- Unified-style field change list -->
      @if (fieldDiffs().length > 0) {
        <div class="diff-hunk-list">
          @for (field of fieldDiffs(); track field.field_path) {
            <div class="diff-hunk">
              <!-- Hunk header: field path + change type -->
              <div class="diff-hunk-header">
                <span class="font-mono text-xs">{{ field.field_path }}</span>
                @switch (field.change_type) {
                  @case ('added') {
                    <span class="diff-change-tag diff-change-tag--added">added</span>
                  }
                  @case ('removed') {
                    <span class="diff-change-tag diff-change-tag--removed">removed</span>
                  }
                  @case ('modified') {
                    <span class="diff-change-tag diff-change-tag--modified">modified</span>
                  }
                }
              </div>

              <!-- Diff lines -->
              <div class="diff-body">
                @if (field.change_type !== 'added') {
                  @if (isLongValue(field.old_value)) {
                    <details class="diff-line diff-line--removed">
                      <summary class="diff-line-prefix select-none cursor-pointer">
                        <span class="diff-prefix">&minus;</span>
                        <span class="diff-value-preview">{{ previewValue(field.old_value) }}</span>
                      </summary>
                      <pre class="diff-value-full">{{ formatValue(field.old_value) }}</pre>
                    </details>
                  } @else {
                    <div class="diff-line diff-line--removed">
                      <span class="diff-prefix select-none">&minus;</span>
                      <span class="diff-value">{{ formatValue(field.old_value) }}</span>
                    </div>
                  }
                }
                @if (field.change_type !== 'removed') {
                  @if (isLongValue(field.new_value)) {
                    <details class="diff-line diff-line--added">
                      <summary class="diff-line-prefix select-none cursor-pointer">
                        <span class="diff-prefix">+</span>
                        <span class="diff-value-preview">{{ previewValue(field.new_value) }}</span>
                      </summary>
                      <pre class="diff-value-full">{{ formatValue(field.new_value) }}</pre>
                    </details>
                  } @else {
                    <div class="diff-line diff-line--added">
                      <span class="diff-prefix select-none">+</span>
                      <span class="diff-value">{{ formatValue(field.new_value) }}</span>
                    </div>
                  }
                }
              </div>
            </div>
          }
        </div>
      } @else if (diff()?.net_operation === 'unchanged') {
        <div class="text-center py-8 text-gray-500 dark:text-gray-400">
          <svg
            class="w-12 h-12 mx-auto mb-3 text-gray-300 dark:text-gray-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <p>No changes detected</p>
          <p class="text-sm text-gray-400 dark:text-gray-500 mt-1">
            The proposed state matches the current state.
          </p>
        </div>
      }

      <!-- Collapsible raw JSON view -->
      @if (showRawJson()) {
        <details class="mt-4">
          <summary
            class="cursor-pointer text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
          >
            View raw JSON
          </summary>
          <div class="mt-2 space-y-4">
            <div>
              <h4 class="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                Current State
              </h4>
              <pre
                class="text-xs bg-gray-50 dark:bg-gray-900 p-3 rounded-lg overflow-x-auto max-h-64 overflow-y-auto"
                >{{ diff()?.current_state | json }}</pre
              >
            </div>
            <div>
              <h4 class="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                Proposed State
              </h4>
              <pre
                class="text-xs bg-gray-50 dark:bg-gray-900 p-3 rounded-lg overflow-x-auto max-h-64 overflow-y-auto"
                >{{ diff()?.proposed_state | json }}</pre
              >
            </div>
          </div>
        </details>
      }
    </div>
  `,
  styles: `
    .diff-hunk-list {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .diff-hunk {
      border-radius: 0.5rem;
      overflow: hidden;
      border: 1px solid var(--color-gray-200);
    }
    :host-context(.dark) .diff-hunk {
      border-color: var(--color-gray-700);
    }

    .diff-hunk-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.5rem;
      padding: 0.375rem 0.75rem;
      background: var(--color-gray-100);
      border-bottom: 1px solid var(--color-gray-200);
      color: var(--color-gray-700);
    }
    :host-context(.dark) .diff-hunk-header {
      background: var(--color-gray-800);
      border-bottom-color: var(--color-gray-700);
      color: var(--color-gray-300);
    }

    .diff-change-tag {
      font-size: 0.65rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      padding: 0.125rem 0.5rem;
      border-radius: 9999px;
    }
    .diff-change-tag--added {
      background: var(--color-primary-100);
      color: var(--color-primary-700);
    }
    .diff-change-tag--removed {
      background: var(--color-danger-100);
      color: var(--color-danger-700);
    }
    .diff-change-tag--modified {
      background: var(--color-warning-100);
      color: var(--color-warning-700);
    }
    :host-context(.dark) .diff-change-tag--added {
      background: color-mix(in srgb, var(--color-primary-900) 40%, transparent);
      color: var(--color-primary-300);
    }
    :host-context(.dark) .diff-change-tag--removed {
      background: color-mix(in srgb, var(--color-danger-900) 40%, transparent);
      color: var(--color-danger-300);
    }
    :host-context(.dark) .diff-change-tag--modified {
      background: color-mix(in srgb, var(--color-warning-900) 40%, transparent);
      color: var(--color-warning-300);
    }

    .diff-body {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 0.75rem;
      line-height: 1.5;
    }

    .diff-line {
      display: flex;
      padding: 0.25rem 0.75rem;
      min-height: 1.75rem;
      align-items: baseline;
    }

    .diff-line--removed {
      background: var(--color-danger-50);
      color: var(--color-danger-900);
    }
    :host-context(.dark) .diff-line--removed {
      background: color-mix(in srgb, var(--color-danger-950) 60%, transparent);
      color: var(--color-danger-200);
    }

    .diff-line--added {
      background: var(--color-success-50);
      color: var(--color-success-900);
    }
    :host-context(.dark) .diff-line--added {
      background: color-mix(in srgb, var(--color-success-950) 60%, transparent);
      color: var(--color-success-200);
    }

    .diff-prefix {
      flex-shrink: 0;
      width: 1.25rem;
      font-weight: 700;
    }

    .diff-value,
    .diff-value-preview {
      white-space: pre-wrap;
      word-break: break-all;
    }

    .diff-value-preview::after {
      content: ' (click to expand)';
      font-style: italic;
      opacity: 0.6;
      font-size: 0.65rem;
    }

    .diff-value-full {
      white-space: pre-wrap;
      word-break: break-all;
      margin: 0;
      padding: 0.5rem 0.75rem 0.5rem 2rem;
      max-height: 24rem;
      overflow-y: auto;
    }

    .diff-line-prefix {
      display: flex;
      padding: 0.25rem 0.75rem;
      min-height: 1.75rem;
      align-items: baseline;
      list-style: none;
    }

    .diff-line-prefix::-webkit-details-marker {
      display: none;
    }

    /* Remove default details marker across browsers */
    details.diff-line > summary.diff-line-prefix::marker,
    details.diff-line > summary.diff-line-prefix::-webkit-details-marker {
      display: none;
      content: '';
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DeltaDiffComponent {
  /** The pending change diff data to display */
  readonly diff = input<PendingChangeDiff | null>(null);

  /** Whether to show the raw JSON view option */
  readonly showRawJson = input<boolean>(true);

  /** Parsed field diffs from the input */
  readonly fieldDiffs = computed<FieldDiffItem[]>(() => {
    const d = this.diff();
    if (!d?.field_diffs) return [];
    return d.field_diffs
      .filter((f): f is { [key: string]: unknown } => f != null)
      .map((f) => ({
        field_path: f['field_path'] as string,
        old_value: f['old_value'],
        new_value: f['new_value'],
        change_type: f['change_type'] as 'added' | 'removed' | 'modified',
      }));
  });

  readonly addedCount = computed(() => this.diff()?.fields_added?.length ?? 0);
  readonly modifiedCount = computed(() => this.diff()?.fields_modified?.length ?? 0);
  readonly removedCount = computed(() => this.diff()?.fields_removed?.length ?? 0);

  /** Format a value for display without truncation. */
  formatValue(value: unknown): string {
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  }

  /** Whether a value's formatted string exceeds the collapse threshold. */
  isLongValue(value: unknown): boolean {
    return this.formatValue(value).length > COLLAPSE_THRESHOLD;
  }

  /** Return a truncated preview for collapsed long values. */
  previewValue(value: unknown): string {
    const formatted = this.formatValue(value);
    return formatted.substring(0, COLLAPSE_THRESHOLD);
  }
}
