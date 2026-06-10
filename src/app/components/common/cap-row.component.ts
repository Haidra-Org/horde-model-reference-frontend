import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { IconComponent } from './icon.component';

/**
 * Capability row — used on the Deployment page to display backend facts.
 * Shows an icon (checkCircle when ok, xCircle when not ok, info when neutral),
 * a label, a description, and a value badge.
 */
@Component({
  selector: 'app-cap-row',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="cap-row surface-glass">
      <app-icon
        [name]="neutral() ? 'info' : ok() ? 'checkCircle' : 'xCircle'"
        class="cap-row-icon"
        [style.color]="iconColor()"
      />
      <div class="cap-row-body">
        <div class="cap-row-label">{{ label() }}</div>
        <div class="cap-row-desc">{{ desc() }}</div>
      </div>
      <span class="cap-row-value">{{ value() }}</span>
    </div>
  `,
})
export class CapRowComponent {
  readonly ok = input.required<boolean>();
  readonly label = input.required<string>();
  readonly value = input.required<string>();
  readonly desc = input.required<string>();
  readonly neutral = input(false);

  protected iconColor(): string {
    if (this.neutral()) return 'var(--fg-2)';
    return this.ok() ? 'var(--success-icon, #16a34a)' : 'var(--danger-text, #dc2626)';
  }
}
