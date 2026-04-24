import {
  Component,
  input,
  output,
  ChangeDetectionStrategy,
  ElementRef,
  ViewChild,
  effect,
} from '@angular/core';
import { HordeButtonComponent } from '@haidra/design-system/button';

export interface FieldDiff {
  field: string;
  label: string;
  oldValue: string;
  newValue: string;
}

/**
 * Modal dialog that shows a field-level diff of all changes made in edit mode.
 * Displays old → new values before the user confirms submission.
 */
@Component({
  selector: 'app-edit-summary',
  imports: [HordeButtonComponent],
  template: `
    @if (open()) {
      <div
        class="edit-summary-overlay"
        role="presentation"
        tabindex="0"
        (click)="onOverlayClick($event)"
        (keydown.enter)="dismissed.emit()"
        (keydown.space)="dismissed.emit()"
      >
        <div
          #dialogRef
          class="edit-summary-dialog"
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-summary-title"
          tabindex="-1"
          (keydown.escape)="dismissed.emit()"
        >
          <div class="edit-summary-header">
            <h3 id="edit-summary-title" class="heading-card">Review Changes</h3>
            <horde-button variant="secondary" size="sm" (click)="dismissed.emit()">
              ✕
            </horde-button>
          </div>
          <div class="edit-summary-body">
            @if (diffs().length === 0) {
              <p class="text-muted text-sm">No changes detected.</p>
            } @else {
              <p class="text-sm text-muted mb-3">{{ diffs().length }} field(s) modified</p>
              @for (diff of diffs(); track diff.field) {
                <div class="edit-summary-row">
                  <span class="edit-summary-field-name">{{ diff.label }}</span>
                  <div class="edit-summary-values">
                    @if (diff.oldValue) {
                      <span class="edit-summary-old">{{ diff.oldValue }}</span>
                      <span class="edit-summary-arrow">→</span>
                    } @else {
                      <span class="text-xs text-gray-400 italic">not set</span>
                      <span class="edit-summary-arrow">→</span>
                    }
                    <span class="edit-summary-new">{{ diff.newValue }}</span>
                  </div>
                </div>
              }
            }
          </div>
          <div
            class="flex justify-end gap-3 px-5 py-3 border-t border-gray-200 dark:border-gray-700"
          >
            <horde-button variant="secondary" (click)="dismissed.emit()"> Cancel </horde-button>
            @if (diffs().length > 0) {
              <horde-button variant="primary" (click)="confirmed.emit()">
                Confirm & Save
              </horde-button>
            }
          </div>
        </div>
      </div>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EditSummaryComponent {
  readonly open = input(false);
  readonly diffs = input<FieldDiff[]>([]);
  readonly dismissed = output<void>();
  readonly confirmed = output<void>();
  @ViewChild('dialogRef') dialogRef?: ElementRef<HTMLDivElement>;

  constructor() {
    effect(() => {
      if (this.open()) {
        queueMicrotask(() => this.focusDialog());
      }
    });
  }

  private focusDialog(): void {
    const dialog = this.dialogRef?.nativeElement;
    if (dialog) {
      dialog.focus();
    }
  }

  onOverlayClick(event: Event): void {
    if ((event.target as HTMLElement).classList.contains('edit-summary-overlay')) {
      this.dismissed.emit();
    }
  }
}
