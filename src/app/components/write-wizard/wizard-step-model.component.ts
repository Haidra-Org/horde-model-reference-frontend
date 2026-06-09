import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import type { WriteFormState } from '../../utils/write-record';

const INSTRUCT_FORMAT_OPTIONS = [
  'ChatML',
  'Llama-3',
  'Mistral',
  'Alpaca',
  'Gemma',
  'Vicuna',
  'none',
];

@Component({
  selector: 'app-wizard-step-model',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="write-step-fields">
      <label class="form-label">
        Baseline architecture
        <input
          type="text"
          class="form-input"
          [value]="form().baseline"
          placeholder="llama"
          (input)="onFieldChange('baseline', $event)"
        />
      </label>

      <div class="write-field-grid">
        <label class="form-label">
          Parameters
          <input
            type="number"
            class="form-input"
            [value]="form().parameters"
            placeholder="8030000000"
            (input)="onFieldChange('parameters', $event)"
          />
          <span class="form-hint">exact count</span>
        </label>
        <label class="form-label">
          Instruct format
          <select
            class="form-select"
            [value]="form().instruct_format"
            (change)="onSelectChange('instruct_format', $event)"
          >
            @for (fmt of instructFormats; track fmt) {
              <option [value]="fmt">{{ fmt }}</option>
            }
          </select>
        </label>
      </div>

      <label class="form-label">
        Text model group
        <input
          type="text"
          class="form-input"
          [value]="form().text_model_group"
          [placeholder]="form().name || 'Llama-3.1-8B'"
          (input)="onFieldChange('text_model_group', $event)"
        />
        <span class="form-hint">base group for variant grouping; defaults to name</span>
      </label>

      <label class="write-toggle">
        <input
          type="checkbox"
          class="form-checkbox"
          [checked]="form().nsfw"
          (change)="onCheckChange('nsfw', $event)"
        />
        <span class="checkbox-label">NSFW-capable</span>
      </label>

      <label class="form-label">
        Tags
        <input
          type="text"
          class="form-input"
          [value]="form().tags"
          (input)="onFieldChange('tags', $event)"
        />
        <span class="form-hint">comma-separated</span>
      </label>
    </div>
  `,
})
export class WizardStepModelComponent {
  readonly form = input.required<WriteFormState>();
  readonly formChange = output<Partial<WriteFormState>>();

  readonly instructFormats = INSTRUCT_FORMAT_OPTIONS;

  onFieldChange(field: string, event: Event): void {
    const input = event.target as HTMLInputElement;
    this.formChange.emit({ [field]: input.value });
  }

  onSelectChange(field: string, event: Event): void {
    const select = event.target as HTMLSelectElement;
    this.formChange.emit({ [field]: select.value });
  }

  onCheckChange(field: string, event: Event): void {
    const checkbox = event.target as HTMLInputElement;
    this.formChange.emit({ [field]: checkbox.checked });
  }
}
