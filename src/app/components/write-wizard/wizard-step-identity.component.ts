import { ClearableFieldComponent } from '../form-fields/clearable-field/clearable-field.component';
import { clearedWriteFormFields } from '../../utils/write-record';
import { WizardFieldGroupComponent } from './wizard-field-group.component';
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import type { WriteFormState } from '../../utils/write-record';

@Component({
  selector: 'app-wizard-step-identity',
  imports: [ClearableFieldComponent, WizardFieldGroupComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="write-step-fields">
      <header class="write-step-intro">
        <h2>Model identity</h2>
        <p>Choose a recognizable name and describe the model for the catalog.</p>
      </header>
      <app-wizard-field-group
        title="Model identifier"
        [clearable]="true"
        (cleared)="clearFields(['name'])"
        [clearDisabled]="isEdit()"
        icon="cube"
        [primary]="true"
        ><app-clearable-field
          label="Model name (identifier)"
          [filled]="!!form().name"
          width="standard"
          [disabled]="isEdit()"
          (cleared)="clearFields(['name'])"
          ><label class="form-label">
            Model name (identifier)
            <span class="write-required-mark" aria-hidden="true">Required</span>
            <input
              type="text"
              class="form-input"
              aria-required="true"
              [value]="form().name"
              [disabled]="isEdit()"
              [placeholder]="isText() ? 'Llama-3.1-8B' : 'Juggernaut XL'"
              (input)="onFieldChange('name', $event)"
            />
            <span class="form-hint">Unique key. For text models, submit the base name only.</span>
          </label></app-clearable-field
        ></app-wizard-field-group
      ><app-wizard-field-group
        title="Catalog presentation"
        [clearable]="true"
        (cleared)="clearFields(['display_name', 'description', 'version'])"
        icon="doc"
        description="Help people recognize this model and understand what it does."
        [optional]="true"
        ><app-clearable-field
          label="Display name"
          [filled]="!!form().display_name"
          width="standard"
          (cleared)="clearFields(['display_name'])"
          ><label class="form-label">
            Display name
            <input
              type="text"
              class="form-input"
              [value]="form().display_name"
              (input)="onFieldChange('display_name', $event)"
            />
            <span class="form-hint">Human-friendly label (optional)</span>
          </label></app-clearable-field
        >
        <app-clearable-field
          label="Description"
          [filled]="!!form().description"
          width="wide"
          (cleared)="clearFields(['description'])"
          ><label class="form-label">
            Description
            <textarea
              class="form-textarea"
              rows="4"
              [value]="form().description"
              (input)="onFieldChange('description', $event)"
            ></textarea></label
        ></app-clearable-field>
        <app-clearable-field
          label="Version"
          [filled]="!!form().version"
          width="short"
          (cleared)="clearFields(['version'])"
          ><label class="form-label">
            Version
            <input
              type="text"
              class="form-input write-input-short"
              [value]="form().version"
              placeholder="1.0"
              (input)="onFieldChange('version', $event)"
            /> </label></app-clearable-field
      ></app-wizard-field-group>
    </div>
  `,
})
export class WizardStepIdentityComponent {
  readonly form = input.required<WriteFormState>();
  readonly isEdit = input(false);
  readonly isText = input(false);
  readonly formChange = output<Partial<WriteFormState>>();

  clearFields(fields: readonly (keyof WriteFormState)[]): void {
    this.formChange.emit(clearedWriteFormFields(fields));
  }

  onFieldChange(field: string, event: Event): void {
    const input = event.target as HTMLInputElement | HTMLTextAreaElement;
    this.formChange.emit({ [field]: input.value });
  }
}
