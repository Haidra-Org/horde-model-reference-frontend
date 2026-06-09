import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import type { WriteFormState } from '../../utils/write-record';

@Component({
  selector: 'app-wizard-step-identity',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="write-step-fields">
      <label class="form-label">
        Model name (identifier)
        <input
          type="text"
          class="form-input"
          [value]="form().name"
          [disabled]="isEdit()"
          [placeholder]="isText() ? 'Llama-3.1-8B' : 'Juggernaut XL'"
          (input)="onFieldChange('name', $event)"
        />
        <span class="form-hint">Unique key. For text models, submit the base name only.</span>
      </label>

      <label class="form-label">
        Display name
        <input
          type="text"
          class="form-input"
          [value]="form().display_name"
          (input)="onFieldChange('display_name', $event)"
        />
        <span class="form-hint">Human-friendly label (optional)</span>
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
    </div>
  `,
})
export class WizardStepIdentityComponent {
  readonly form = input.required<WriteFormState>();
  readonly isEdit = input(false);
  readonly isText = input(false);
  readonly formChange = output<Partial<WriteFormState>>();

  onFieldChange(field: string, event: Event): void {
    const input = event.target as HTMLInputElement | HTMLTextAreaElement;
    this.formChange.emit({ [field]: input.value });
  }
}
