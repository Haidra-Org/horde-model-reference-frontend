import { Component, ChangeDetectionStrategy, input, output, computed } from '@angular/core';
import { HordeButtonComponent, type ButtonVariant } from '@haidra/design-system/button';

/**
 * Operation severity levels for visual styling.
 * - 'create': Primary/blue - adding new content
 * - 'update': Warning/amber - modifying existing content
 * - 'delete': Danger/red - removing content
 * - 'info': Neutral/gray - informational
 */
export type OperationSeverity = 'create' | 'update' | 'delete' | 'info';

/**
 * A reusable confirmation modal that displays operation-specific styling
 * based on the severity level. Supports custom title, message, and content projection.
 *
 * @example
 * ```html
 * <app-confirmation-modal
 *   [open]="showModal"
 *   severity="delete"
 *   title="Confirm Deletion"
 *   message="Are you sure you want to delete this model?"
 *   confirmText="Delete"
 *   (confirmed)="onConfirm()"
 *   (cancelled)="onCancel()"
 * />
 * ```
 */
@Component({
  selector: 'app-confirmation-modal',
  imports: [HordeButtonComponent],
  template: `
    @if (open()) {
      <div
        class="modal-overlay"
        tabindex="0"
        (click)="onCancel()"
        (keydown)="$event.key === 'Escape' && onCancel()"
        aria-label="Close modal"
      >
        <div
          class="modal-dialog modal-dialog--lg"
          [class]="modalDialogClass()"
          (click)="$event.stopPropagation()"
          (keydown)="$event.stopPropagation()"
          aria-modal="true"
          role="dialog"
        >
          <!-- Header with severity-based styling -->
          <div [class]="headerClass()">
            <div class="flex items-center gap-3">
              <div [class]="iconContainerClass()">
                @switch (severity()) {
                  @case ('create') {
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      class="w-6 h-6"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M12 4v16m8-8H4"
                      />
                    </svg>
                  }
                  @case ('update') {
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      class="w-6 h-6"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                      />
                    </svg>
                  }
                  @case ('delete') {
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      class="w-6 h-6"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                      />
                    </svg>
                  }
                  @default {
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      class="w-6 h-6"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  }
                }
              </div>
              <h2 class="text-xl font-semibold">{{ title() }}</h2>
            </div>
          </div>

          <!-- Content -->
          <div class="modal-content">
            @if (message()) {
              <p class="mb-4">{{ message() }}</p>
            }
            <ng-content />
          </div>

          <!-- Actions -->
          <div class="modal-actions">
            <horde-button variant="secondary" (click)="onCancel()" [disabled]="loading()">
              {{ cancelText() }}
            </horde-button>
            <horde-button
              [variant]="confirmButtonVariant()"
              (click)="onConfirm()"
              [disabled]="confirmDisabled()"
              [loading]="loading()"
            >
              @if (loading()) {
                Processing...
              } @else {
                {{ confirmText() }}
              }
            </horde-button>
          </div>
        </div>
      </div>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConfirmationModalComponent {
  /** Whether the modal is visible */
  readonly open = input.required<boolean>();

  /** The severity/type of operation for styling */
  readonly severity = input<OperationSeverity>('info');

  /** Modal title */
  readonly title = input.required<string>();

  /** Optional message text displayed below the title */
  readonly message = input<string>('');

  /** Text for the confirm button */
  readonly confirmText = input<string>('Confirm');

  /** Text for the cancel button */
  readonly cancelText = input<string>('Cancel');

  /** Whether the modal is in a loading state */
  readonly loading = input<boolean>(false);

  /** Whether the confirm button is disabled */
  readonly confirmDisabled = input<boolean>(false);

  /** Emitted when the user confirms the action */
  readonly confirmed = output<void>();

  /** Emitted when the user cancels or closes the modal */
  readonly cancelled = output<void>();

  /** Computed class for the modal dialog based on severity */
  readonly modalDialogClass = computed(() => {
    const base = 'overflow-visible';
    return base;
  });

  /** Computed class for the header based on severity */
  readonly headerClass = computed(() => {
    const base = 'flex items-center gap-3 mb-4 pb-4 border-b';
    const severityClasses: Record<OperationSeverity, string> = {
      create: 'border-primary-200 dark:border-primary-700',
      update: 'border-warning-200 dark:border-warning-700',
      delete: 'border-danger-200 dark:border-danger-700',
      info: 'border-gray-200 dark:border-gray-700',
    };
    return `${base} ${severityClasses[this.severity()]}`;
  });

  /** Computed class for the icon container based on severity */
  readonly iconContainerClass = computed(() => {
    const base = 'p-2 rounded-full';
    const severityClasses: Record<OperationSeverity, string> = {
      create: 'bg-primary-100 text-primary-600 dark:bg-primary-900/30 dark:text-primary-400',
      update: 'bg-warning-100 text-warning-600 dark:bg-warning-900/30 dark:text-warning-400',
      delete: 'bg-danger-100 text-danger-600 dark:bg-danger-900/30 dark:text-danger-400',
      info: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
    };
    return `${base} ${severityClasses[this.severity()]}`;
  });

  /** Computed variant for the confirm button based on severity */
  readonly confirmButtonVariant = computed<ButtonVariant>(() => {
    const severityVariants: Record<OperationSeverity, ButtonVariant> = {
      create: 'primary',
      update: 'primary',
      delete: 'danger',
      info: 'primary',
    };
    return severityVariants[this.severity()];
  });

  onConfirm(): void {
    if (!this.loading() && !this.confirmDisabled()) {
      this.confirmed.emit();
    }
  }

  onCancel(): void {
    if (!this.loading()) {
      this.cancelled.emit();
    }
  }
}
