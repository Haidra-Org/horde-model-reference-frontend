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
  imports: [ModelRequirementsEditorComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="write-step-fields">
      <label class="form-label">
        Baseline
        <input
          class="form-input write-input-short"
          type="text"
          list="image-baseline-options"
          [value]="form().baseline"
          (input)="onFieldChange('baseline', $event)"
        />
        <datalist id="image-baseline-options">
          @for (opt of baselineOpts; track opt) {
            <option [value]="opt"></option>
          }
        </datalist>
      </label>

      <label class="form-label">
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
        </datalist>
      </label>

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
      </div>

      <label class="form-label">
        Tags
        <input
          type="text"
          class="form-input"
          [value]="form().tags"
          placeholder="photorealism, highres"
          (input)="onFieldChange('tags', $event)"
        />
        <span class="form-hint">comma-separated</span>
      </label>

      <label class="form-label">
        Trigger words
        <input
          type="text"
          class="form-input"
          [value]="form().trigger"
          placeholder="score_9, score_8_up"
          (input)="onFieldChange('trigger', $event)"
        />
        <span class="form-hint">comma-separated</span>
      </label>

      <label class="form-label"
        >Optimization
        <input
          class="form-input"
          [value]="form().optimization || ''"
          (input)="onFieldChange('optimization', $event)"
        />
      </label>
      <label class="form-label"
        >Total size on disk (bytes)
        <input
          class="form-input"
          type="number"
          min="0"
          step="1"
          [value]="form().size_on_disk_bytes || ''"
          (input)="onFieldChange('size_on_disk_bytes', $event)"
        />
      </label>
      <label class="form-label"
        >Showcase URLs
        <textarea
          class="form-textarea"
          rows="3"
          [value]="form().showcases || ''"
          (input)="onFieldChange('showcases', $event)"
        ></textarea>
        <span class="form-hint">One URL per line</span>
      </label>
      <app-model-requirements-editor
        [values]="form().requirements || {}"
        (valuesChange)="formChange.emit({ requirements: $event })"
      />
      <div class="write-field-grid">
        <label class="form-label">
          Homepage
          <input
            type="url"
            class="form-input"
            [value]="form().homepage"
            placeholder="https://…"
            (input)="onFieldChange('homepage', $event)"
          />
        </label>
        <label class="form-label">
          Min bridge version
          <input
            type="number"
            class="form-input"
            [value]="form().min_bridge_version"
            placeholder="23"
            (input)="onFieldChange('min_bridge_version', $event)"
          />
        </label>
      </div>
    </div>
  `,
})
export class WizardStepImageComponent {
  readonly form = input.required<WriteFormState>();
  readonly formChange = output<Partial<WriteFormState>>();

  readonly baselineOpts = BASELINE_OPTIONS;
  readonly styleOpts = STYLE_OPTIONS;

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
