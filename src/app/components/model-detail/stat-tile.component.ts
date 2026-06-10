import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-stat-tile',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="glass-inflow stat-tile" [style.--stat-accent]="accent()">
      <div class="stat-tile-header">
        @if (icon()) {
          <span class="stat-tile-icon" [style.color]="accent() || 'var(--color-content-muted)'">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                [attr.d]="icon()"
              />
            </svg>
          </span>
        }
        <span class="stat-tile-label">{{ label() }}</span>
      </div>
      @if (loading()) {
        <div class="stat-tile-value">
          <span class="stat-tile-skeleton" aria-label="Loading"></span>
        </div>
      } @else {
        <div class="stat-tile-value">{{ value() }}</div>
        @if (sub()) {
          <div class="stat-tile-sub">{{ sub() }}</div>
        }
      }
    </div>
  `,
})
export class StatTileComponent {
  readonly icon = input<string>();
  readonly label = input.required<string>();
  readonly value = input.required<string | number>();
  readonly sub = input<string>();
  readonly accent = input<string>();
  readonly loading = input<boolean>(false);
}
