import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { ProgressBarComponent } from './progress-bar.component';

/**
 * BarRow — a distribution row (label · ProgressBar · count · percentage).
 * Used by the Analytics Statistics tab for baseline / parameter / style / host / safety distributions.
 *
 * Accessible: every BarRow exposes label + count + percentage as text;
 * color is never the sole signal.
 */
@Component({
  selector: 'app-bar-row',
  imports: [ProgressBarComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (actionLabel()) {
      <button
        type="button"
        class="bar-row bar-row--actionable"
        [attr.aria-label]="actionLabel()"
        (click)="activated.emit()"
      >
        <span class="bar-row__label">{{ label() }}</span>
        <span class="bar-row__bar">
          <app-progress-bar
            [value]="percentage()"
            [accent]="accent()"
            [max]="100"
            [ariaLabel]="label() + ': ' + count() + ' models, ' + fmtPct()"
          />
        </span>
        <span class="bar-row__count">{{ count() }}</span>
        <span class="bar-row__pct">{{ fmtPct() }}</span>
        <span class="bar-row__arrow" aria-hidden="true">→</span>
      </button>
    } @else {
      <div class="bar-row">
        <span class="bar-row__label">{{ label() }}</span>
        <div class="bar-row__bar">
          <app-progress-bar
            [value]="percentage()"
            [accent]="accent()"
            [max]="100"
            [ariaLabel]="label() + ': ' + count() + ' models, ' + fmtPct()"
          />
        </div>
        <span class="bar-row__count">{{ count() }}</span>
        <span class="bar-row__pct">{{ fmtPct() }}</span>
      </div>
    }
  `,
})
export class BarRowComponent {
  /** Distribution label (baseline name, host domain, style, etc.) */
  readonly label = input.required<string>();
  /** Model count for this bucket */
  readonly count = input.required<number>();
  /** Percentage of total (0–100) */
  readonly percentage = input.required<number>();
  /** Optional accent color (CSS custom property value) for the bar */
  readonly accent = input<string>();
  /** Screen-reader label and opt-in marker for drill-down behavior. */
  readonly actionLabel = input<string | null>(null);
  readonly activated = output<void>();

  protected fmtPct(): string {
    const pct = this.percentage();
    if (pct >= 10) return `${Math.round(pct)}%`;
    if (pct >= 1) return `${pct.toFixed(1)}%`;
    return `${pct.toFixed(1)}%`;
  }
}
