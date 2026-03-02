import {
  Component,
  input,
  signal,
  computed,
  ChangeDetectionStrategy,
  HostListener,
  ElementRef,
  inject,
} from '@angular/core';
import { FIELD_HELP_TEXT, FieldHelpEntry } from '../../../models/field-help-text';

/**
 * Inline info icon that shows a popover with contextual help for a form field.
 * Looks up help text from the central FIELD_HELP_TEXT registry by field ID.
 */
@Component({
  selector: 'app-field-tooltip',
  template: `
    @if (helpEntry()) {
      <span class="field-tooltip-trigger" (click)="toggle($event)" (keydown.enter)="toggle($event)"
        tabindex="0" role="button"
        [attr.aria-label]="'Help for ' + fieldId()"
        [attr.aria-expanded]="isOpen()">
        <svg class="field-tooltip-icon" viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd"
            d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z"
            clip-rule="evenodd" />
        </svg>
      </span>
      @if (isOpen()) {
        <div class="field-tooltip-popover" role="tooltip">
          <div class="field-tooltip-popover-content">
            <p class="field-tooltip-summary">{{ helpEntry()!.summary }}</p>
            @if (helpEntry()!.impact) {
              <p class="field-tooltip-impact">
                <span class="font-medium">Impact:</span> {{ helpEntry()!.impact }}
              </p>
            }
            @if (helpEntry()!.examples) {
              <p class="field-tooltip-examples">{{ helpEntry()!.examples }}</p>
            }
          </div>
        </div>
      }
    }
  `,
  host: {
    class: 'field-tooltip-wrapper',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FieldTooltipComponent {
  private readonly elRef = inject(ElementRef);

  readonly fieldId = input.required<string>();

  readonly helpEntry = computed<FieldHelpEntry | null>(() => {
    return FIELD_HELP_TEXT[this.fieldId()] ?? null;
  });

  readonly isOpen = signal(false);

  toggle(event: Event): void {
    event.stopPropagation();
    this.isOpen.update((v) => !v);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event): void {
    if (this.isOpen() && !this.elRef.nativeElement.contains(event.target)) {
      this.isOpen.set(false);
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.isOpen.set(false);
  }
}
