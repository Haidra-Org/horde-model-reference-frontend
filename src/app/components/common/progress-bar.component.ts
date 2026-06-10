import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/**
 * ProgressBar — a thin horizontal progress bar rendered with CSS.
 * Supports an optional accent color.
 *
 * Accessible: the bar exposes its value as aria-valuenow/aria-valuemax/aria-valuetext.
 */
@Component({
  selector: 'app-progress-bar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    role: 'progressbar',
    '[attr.aria-valuenow]': 'value()',
    '[attr.aria-valuemax]': 'max()',
    '[attr.aria-valuetext]': 'ariaLabel()',
    '[attr.aria-label]': 'ariaLabel()',
  },
  template: `
    <div class="progress-bar-track">
      <div
        class="progress-bar-fill"
        [style.width]="pct() + '%'"
        [style.--bar-accent]="accent()"
      ></div>
    </div>
  `,
})
export class ProgressBarComponent {
  /** Current value */
  readonly value = input.required<number>();
  /** Maximum value (default 100) */
  readonly max = input<number>(100);
  /** Optional accent color (CSS custom property value) for the fill, e.g. #1d4ed8 */
  readonly accent = input<string>();
  /** Accessible label for screen readers */
  readonly ariaLabel = input<string>('');

  protected readonly pct = computed(() => {
    const max = this.max() || 1;
    return Math.min(100, Math.max(0, (this.value() / max) * 100));
  });
}
