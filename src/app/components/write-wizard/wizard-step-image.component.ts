import { ClearableFieldComponent } from '../form-fields/clearable-field/clearable-field.component';
import { clearedWriteFormFields } from '../../utils/write-record';
import { WizardFieldGroupComponent } from './wizard-field-group.component';
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { KNOWN_IMAGE_GENERATION_BASELINE } from '../../api-client';
import { ModelRequirementsEditorComponent } from '../form-fields/model-requirements-editor/model-requirements-editor.component';
import type { WriteFormState } from '../../utils/write-record';

// Schema suggestions remain editable so newly registered baselines are usable immediately.
const BASELINE_OPTIONS = [
  ...Object.values(KNOWN_IMAGE_GENERATION_BASELINE),
  'krea2_turbo',
  'anima',
];

const STYLE_OPTIONS = ['generalist', 'anime', 'artistic', 'realistic', 'furry', 'other'];

@Component({
  selector: 'app-wizard-step-image',
  imports: [ClearableFieldComponent, WizardFieldGroupComponent, ModelRequirementsEditorComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="write-step-fields">
      <header class="write-step-intro">
        <h2>Image behavior</h2>
        <p>Define the architecture, content profile, and practical requirements.</p>
      </header>
      <app-wizard-field-group
        title="Architecture & content"
        [clearable]="true"
        (cleared)="clearFields(['baseline', 'style', 'nsfw', 'inpainting'])"
        icon="layers"
        [primary]="true"
        ><div class="write-field-grid">
          <app-clearable-field
            label="Baseline"
            [filled]="!!form().baseline"
            width="short"
            (cleared)="clearFields(['baseline'])"
            ><label class="form-label">
              Baseline <span class="write-required-mark" aria-hidden="true">Required</span>
              <input
                class="form-input write-input-short"
                type="text"
                list="image-baseline-options"
                aria-required="true"
                [value]="form().baseline"
                (input)="onFieldChange('baseline', $event)"
              />
              <datalist id="image-baseline-options">
                @for (opt of baselineOpts; track opt) {
                  <option [value]="opt"></option>
                }
              </datalist> </label></app-clearable-field
          ><app-clearable-field
            label="Style"
            [filled]="!!form().style"
            width="short"
            (cleared)="clearFields(['style'])"
            ><label class="form-label">
              Style
              <input
                class="form-input write-input-short"
                type="text"
                list="image-style-options"
                [value]="form().style"
                (input)="onFieldChange('style', $event)"
              />
              <datalist id="image-style-options">
                @for (s of styleOpts; track s) {
                  <option [value]="s"></option>
                }
              </datalist> </label
          ></app-clearable-field>
        </div>
        <div class="write-toggle-row">
          <label class="write-toggle">
            <input
              type="checkbox"
              class="form-checkbox"
              [checked]="form().nsfw"
              (change)="onCheckChange('nsfw', $event)"
            />
            <span class="checkbox-label">NSFW</span>
          </label>
          <label class="write-toggle">
            <input
              type="checkbox"
              class="form-checkbox"
              [checked]="form().inpainting"
              (change)="onCheckChange('inpainting', $event)"
            />
            <span class="checkbox-label">Inpainting model</span>
          </label>
        </div></app-wizard-field-group
      ><app-wizard-field-group
        title="Model reference"
        [clearable]="true"
        (cleared)="clearFields(['homepage', 'size_on_disk_bytes'])"
        icon="link"
        description="Point to the original model and declare its total download footprint."
        ><app-clearable-field
          label="Homepage"
          [filled]="!!form().homepage"
          width="url"
          (cleared)="clearFields(['homepage'])"
          ><label class="form-label">
            Homepage
            <input
              type="url"
              class="form-input"
              [value]="form().homepage"
              placeholder="https://…"
              (input)="onFieldChange('homepage', $event)"
            /> </label
        ></app-clearable-field>
        <app-clearable-field
          label="Total size on disk (bytes)"
          [filled]="!!form().size_on_disk_bytes"
          width="short"
          (cleared)="clearFields(['size_on_disk_bytes'])"
          ><label class="form-label"
            >Total size on disk (bytes)
            <input
              class="form-input"
              type="number"
              min="0"
              step="1"
              [value]="form().size_on_disk_bytes || ''"
              (input)="onFieldChange('size_on_disk_bytes', $event)"
            /> </label></app-clearable-field></app-wizard-field-group
      ><app-wizard-field-group
        title="Discovery & examples"
        [clearable]="true"
        (cleared)="clearFields(['tags', 'trigger', 'showcases'])"
        icon="image"
        description="Add search terms, activation words, and examples when useful."
        [optional]="true"
        ><app-clearable-field
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
              placeholder="photorealism, highres"
              (input)="onFieldChange('tags', $event)"
            />
            <span class="form-hint">comma-separated</span>
          </label></app-clearable-field
        >
        <app-clearable-field
          label="Trigger words"
          [filled]="!!form().trigger"
          width="standard"
          (cleared)="clearFields(['trigger'])"
          ><label class="form-label">
            Trigger words
            <input
              type="text"
              class="form-input"
              [value]="form().trigger"
              placeholder="score_9, score_8_up"
              (input)="onFieldChange('trigger', $event)"
            />
            <span class="form-hint">comma-separated</span>
          </label></app-clearable-field
        >
        <app-clearable-field
          label="Showcase URLs"
          [filled]="!!form().showcases"
          width="wide"
          (cleared)="clearFields(['showcases'])"
          ><label class="form-label"
            >Showcase URLs
            <textarea
              class="form-textarea"
              rows="3"
              [value]="form().showcases || ''"
              (input)="onFieldChange('showcases', $event)"
            ></textarea>
            <span class="form-hint">One URL per line</span>
          </label></app-clearable-field
        ></app-wizard-field-group
      ><app-wizard-field-group
        title="Runtime requirements"
        [clearable]="true"
        (cleared)="requirementsEditor.clearAll()"
        icon="filter"
        description="Specify only the settings this model needs to work correctly."
        [optional]="true"
      >
        <app-model-requirements-editor
          #requirementsEditor
          [clearableFields]="true"
          [values]="form().requirements || {}"
          (valuesChange)="formChange.emit({ requirements: $event })" /></app-wizard-field-group
      ><app-wizard-field-group
        title="Compatibility"
        [clearable]="true"
        (cleared)="clearFields(['optimization', 'min_bridge_version'])"
        icon="server"
        [optional]="true"
        ><app-clearable-field
          label="Optimization"
          [filled]="!!form().optimization"
          width="standard"
          (cleared)="clearFields(['optimization'])"
          ><label class="form-label"
            >Optimization
            <input
              class="form-input"
              [value]="form().optimization || ''"
              (input)="onFieldChange('optimization', $event)"
            /> </label
        ></app-clearable-field>
        <app-clearable-field
          label="Min bridge version"
          [filled]="!!form().min_bridge_version"
          width="short"
          (cleared)="clearFields(['min_bridge_version'])"
          ><label class="form-label">
            Min bridge version
            <input
              type="number"
              class="form-input"
              [value]="form().min_bridge_version"
              placeholder="23"
              (input)="onFieldChange('min_bridge_version', $event)"
            /> </label></app-clearable-field
      ></app-wizard-field-group>
    </div>
  `,
})
export class WizardStepImageComponent {
  readonly form = input.required<WriteFormState>();
  readonly formChange = output<Partial<WriteFormState>>();

  readonly baselineOpts = BASELINE_OPTIONS;
  readonly styleOpts = STYLE_OPTIONS;

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
