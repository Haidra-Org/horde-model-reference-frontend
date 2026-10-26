import { ClearableFieldComponent } from '../form-fields/clearable-field/clearable-field.component';
import { clearedWriteFormFields } from '../../utils/write-record';
import { WizardFieldGroupComponent } from './wizard-field-group.component';
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
  imports: [ClearableFieldComponent, WizardFieldGroupComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="write-step-fields">
      <header class="write-step-intro">
        <h2>Text model</h2>
        <p>Record the model size, grouping, and supported prompt format.</p>
      </header>
      <app-wizard-field-group
        title="Model size & grouping"
        [clearable]="true"
        (cleared)="clearFields(['parameters', 'text_model_group'])"
        icon="layers"
        [primary]="true"
        ><app-clearable-field
          label="Parameters"
          [filled]="!!form().parameters"
          width="short"
          (cleared)="clearFields(['parameters'])"
          ><label class="form-label">
            Parameters <span class="write-required-mark" aria-hidden="true">Required</span>
            <input
              type="number"
              class="form-input"
              aria-required="true"
              [value]="form().parameters"
              placeholder="8030000000"
              (input)="onFieldChange('parameters', $event)"
            />
            <span class="form-hint">exact count</span>
          </label></app-clearable-field
        >
        <app-clearable-field
          label="Text model group"
          [filled]="!!form().text_model_group"
          width="standard"
          (cleared)="clearFields(['text_model_group'])"
          ><label class="form-label">
            Text model group
            <input
              type="text"
              class="form-input"
              [value]="form().text_model_group"
              [placeholder]="form().name || 'Llama-3.1-8B'"
              (input)="onFieldChange('text_model_group', $event)"
            />
            <span class="form-hint">base group for variant grouping; defaults to name</span>
          </label></app-clearable-field
        ></app-wizard-field-group
      ><app-wizard-field-group
        title="Architecture & prompts"
        [clearable]="true"
        (cleared)="clearFields(['baseline', 'instruct_format'])"
        icon="text"
        description="Use the published architecture and prompt format when known."
        [optional]="true"
        ><app-clearable-field
          label="Baseline architecture"
          [filled]="!!form().baseline"
          width="standard"
          (cleared)="clearFields(['baseline'])"
          ><label class="form-label">
            Baseline architecture
            <input
              type="text"
              class="form-input"
              [value]="form().baseline"
              placeholder="e.g., Qwen/Qwen3.5-35B-A3B-Base"
              (input)="onFieldChange('baseline', $event)"
            /> </label
        ></app-clearable-field>
        <app-clearable-field
          label="Instruct format"
          [filled]="!!form().instruct_format"
          width="short"
          (cleared)="clearFields(['instruct_format'])"
          ><label class="form-label">
            Instruct format
            <input
              type="text"
              class="form-input write-input-short"
              list="instruct-formats"
              [value]="form().instruct_format"
              (input)="onFieldChange('instruct_format', $event)"
            />
            <datalist id="instruct-formats">
              @for (fmt of instructFormats; track fmt) {
                <option [value]="fmt"></option>
              }
            </datalist> </label></app-clearable-field></app-wizard-field-group
      ><app-wizard-field-group
        title="Content & discovery"
        [clearable]="true"
        (cleared)="clearFields(['nsfw', 'tags'])"
        icon="search"
        [optional]="true"
        ><label class="write-toggle">
          <input
            type="checkbox"
            class="form-checkbox"
            [checked]="form().nsfw"
            (change)="onCheckChange('nsfw', $event)"
          />
          <span class="checkbox-label">NSFW-capable</span>
        </label>
        <app-clearable-field
          label="Tags"
          [filled]="!!form().tags"
          width="standard"
          (cleared)="clearFields(['tags'])"
          ><label class="form-label">
            Tags
            <input
              type="text"
              class="form-input"
              [value]="form().tags"
              (input)="onFieldChange('tags', $event)"
            />
            <span class="form-hint">comma-separated</span>
          </label></app-clearable-field
        ></app-wizard-field-group
      >
    </div>
  `,
})
export class WizardStepModelComponent {
  readonly form = input.required<WriteFormState>();
  readonly formChange = output<Partial<WriteFormState>>();

  readonly instructFormats = INSTRUCT_FORMAT_OPTIONS;

  clearFields(fields: readonly (keyof WriteFormState)[]): void {
    this.formChange.emit(clearedWriteFormFields(fields));
  }

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
