import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import type { WriteFormState } from '../../utils/write-record';

/**
 * Generic wizard step for non-image/text categories.
 * Provides the identity fields plus a basic JSON-textarea for additional fields,
 * since generic categories don't have curated field sets.
 */
@Component({
  selector: 'app-wizard-step-generic',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="write-step-fields">
      <p class="write-generic-hint">
        This category uses the <strong>request body</strong> for field definition. The fields below
        cover common metadata; edit the live request body on the right to add category-specific
        fields.
      </p>

      <label class="form-label">
        Model name (identifier)
        <input type="text" class="form-input" [value]="form().name" [disabled]="true" />
      </label>

      <label class="form-label">
        Display name
        <input
          type="text"
          class="form-input"
          [value]="form().display_name"
          (input)="onFieldChange('display_name', $event)"
        />
      </label>

      <label class="form-label">
        Description
        <textarea
          class="form-textarea"
          rows="3"
          [value]="form().description"
          (input)="onFieldChange('description', $event)"
        ></textarea>
      </label>

      <label class="form-label">
        Version
        <input
          type="text"
          class="form-input"
          [value]="form().version"
          placeholder="1.0"
          (input)="onFieldChange('version', $event)"
        />
      </label>

      <label class="form-label">
        Tags
        <input
          type="text"
          class="form-input"
          [value]="form().tags"
          placeholder="comma, separated"
          (input)="onFieldChange('tags', $event)"
        />
        <span class="form-hint">comma-separated</span>
      </label>
    </div>
  `,
})
export class WizardStepGenericComponent {
  readonly form = input.required<WriteFormState>();
  readonly category = input.required<string>();
  readonly formChange = output<Partial<WriteFormState>>();

  onFieldChange(field: string, event: Event): void {
    const input = event.target as HTMLInputElement | HTMLTextAreaElement;
    this.formChange.emit({ [field]: input.value });
  }
}
