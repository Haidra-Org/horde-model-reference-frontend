import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import type { PendingChangeRecord } from '../../api-client';
import { domainOf } from '../../shared/domain';
import { STATUS_META, OP_META } from '../../shared/queue-meta';

@Component({
  selector: 'app-change-row',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="change-row"
      [class.change-row--selected]="selected()"
      [class.change-row--pending]="status() === 'pending'"
      (click)="selectedChange.emit(change())"
      (keydown.enter)="selectedChange.emit(change())"
      (keydown.space)="$event.preventDefault(); selectedChange.emit(change())"
      tabindex="0"
      role="button"
      [attr.aria-selected]="selected()"
    >
      <!-- Checkbox (approver + pending) -->
      @if (approverMode() && status() === 'pending') {
        <button
          type="button"
          class="change-row-check"
          [class.change-row-check--checked]="checked()"
          (click)="$event.stopPropagation(); onCheck()"
          [attr.aria-label]="checked() ? 'Deselect change' : 'Select change for bulk action'"
        >
          @if (checked()) {
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#fff"
              stroke-width="3"
            >
              <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          }
        </button>
      }

      <!-- Operation icon avatar -->
      <span class="change-row-op-avatar" [attr.data-op]="change().operation">
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.6"
        >
          <path stroke-linecap="round" stroke-linejoin="round" [attr.d]="opIconPath()" />
        </svg>
      </span>

      <!-- Info -->
      <div class="change-row-info">
        <div class="change-row-name-line">
          <span class="change-row-model-name">{{ change().model_name }}</span>
          <span class="change-row-id">#{{ change().change_id }}</span>
        </div>
        <div class="change-row-meta">
          <span class="change-row-op-label" [attr.data-op]="change().operation">{{
            opMeta().label
          }}</span>
          <span>·</span>
          <span>{{ displayCategory() }}</span>
          <span>·</span>
          <span>{{ change().requested_username }}</span>
          <span>·</span>
          <span>{{ timeAgoText() }}</span>
        </div>
      </div>

      <!-- Status badge -->
      <span class="change-row-status-badge" [attr.data-status]="status()">
        {{ statusLabel() }}
      </span>

      <!-- Inline Apply (approver + approved) -->
      @if (approverMode() && status() === 'approved') {
        <button
          type="button"
          class="btn btn-primary btn-sm"
          (click)="$event.stopPropagation(); applyRequested.emit(change())"
        >
          <svg
            width="13"
            height="13"
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
          Apply
        </button>
      }
    </div>
  `,
})
export class ChangeRowComponent {
  readonly change = input.required<PendingChangeRecord>();
  readonly selected = input(false);
  readonly approverMode = input(false);
  readonly checked = input(false);

  readonly selectedChange = output<PendingChangeRecord>();
  readonly checkToggled = output<PendingChangeRecord>();
  readonly applyRequested = output<PendingChangeRecord>();

  readonly status = computed(() => this.change().status ?? 'pending');
  readonly opMeta = computed(() => OP_META[this.change().operation]);

  protected statusLabel = computed(() => STATUS_META[this.status()]?.label ?? this.status());
  protected displayCategory = computed(() => {
    const c = this.change().category;
    return domainOf(c) === 'image' ? c : c.replace(/_/g, ' ');
  });
  protected timeAgoText = computed(() => {
    const ts = this.change().requested_at ?? this.change().updated_at;
    if (ts == null) return '';
    const seconds = Math.floor((Date.now() - ts * 1000) / 1000);
    if (seconds < 60) return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  });

  /** Returns the SVG path data for the operation icon. */
  protected opIconPath = computed((): string => {
    switch (this.change().operation) {
      case 'create':
        return 'M12 4.5v15m7.5-7.5h-15';
      case 'update':
        return 'M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125';
      case 'delete':
        return 'M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0';
      default:
        return '';
    }
  });

  protected onCheck(): void {
    this.checkToggled.emit(this.change());
  }
}
