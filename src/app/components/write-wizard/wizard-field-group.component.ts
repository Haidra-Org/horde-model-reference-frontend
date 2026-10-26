import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { IconComponent } from '../common/icon.component';

@Component({
  selector: 'app-wizard-field-group',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  // Scoped styles take precedence over the global fieldset reset.
  styles: [
    `
      .write-field-group {
        min-width: 0;
        margin: 0;
        padding: 16px 0 4px;
        border: 0;
        border-top: 1px solid var(--color-border-hairline);
      }

      .write-field-group--primary {
        padding: 16px 18px 20px;
        border: 1px solid
          color-mix(in srgb, var(--color-primary-500) 24%, var(--color-border-hairline));
        border-radius: 10px;
        background: color-mix(in srgb, var(--color-primary-500) 3%, transparent);
      }

      @media (max-width: 640px) {
        .write-field-group--primary {
          padding-inline: 12px;
        }
      }
    `,
  ],
  template: `
    <fieldset class="write-field-group" [class.write-field-group--primary]="primary()">
      <legend class="write-field-group-title">
        <app-icon [name]="icon()" />
        {{ title() }}
        @if (optional()) {
          <span class="write-field-optional">Optional</span>
        }
        @if (clearable()) {
          <button
            type="button"
            class="write-section-clear"
            [attr.aria-label]="'Clear ' + title() + ' section'"
            (click)="cleared.emit()"
            [disabled]="clearDisabled()"
          >
            Clear section
          </button>
        }
      </legend>
      @if (description()) {
        <p class="write-field-group-description">{{ description() }}</p>
      }
      <div class="write-field-group-fields"><ng-content /></div>
    </fieldset>
  `,
})
export class WizardFieldGroupComponent {
  readonly title = input.required<string>();
  readonly description = input('');
  readonly icon = input('doc');
  readonly primary = input(false);
  readonly optional = input(false);
  readonly clearable = input(false);
  readonly clearDisabled = input(false);
  readonly cleared = output<void>();
}
