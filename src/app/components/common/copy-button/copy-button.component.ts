import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { Clipboard } from '@angular/cdk/clipboard';

@Component({
  selector: 'app-copy-button',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      type="button"
      class="copy-button"
      [class.copy-button--copied]="copied()"
      [attr.aria-label]="ariaLabel()"
      (click)="copy()"
    >
      @if (copied()) {
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M5 13l4 4L19 7"
          />
        </svg>
        <span>{{ copiedLabel() }}</span>
      } @else {
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
          />
        </svg>
        <span>{{ label() }}</span>
      }
    </button>
  `,
})
export class CopyButtonComponent {
  readonly text = input.required<string>();
  readonly label = input('Copy');
  readonly copiedLabel = input('Copied');
  readonly ariaLabel = input<string>();

  private readonly clipboard = inject(Clipboard);

  protected readonly copied = signal(false);

  protected copy(): void {
    this.clipboard.copy(this.text());
    this.copied.set(true);
    setTimeout(() => this.copied.set(false), 2000);
  }
}
