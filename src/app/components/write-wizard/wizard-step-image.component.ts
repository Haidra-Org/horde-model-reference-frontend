import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import type { WriteFormState } from '../../utils/write-record';

const BASELINE_OPTIONS: { value: string; label: string }[] = [
  { value: 'stable_diffusion_1', label: 'Stable Diffusion 1.x' },
  { value: 'stable_diffusion_2_1', label: 'Stable Diffusion 2.1' },
  { value: 'stable_diffusion_xl', label: 'Stable Diffusion XL' },
  { value: 'stable_diffusion_3', label: 'Stable Diffusion 3' },
  { value: 'flux_1', label: 'Flux.1' },
  { value: 'kandinsky', label: 'Kandinsky' },
  { value: 'wurstchen', label: 'Würstchen' },
  { value: 'pixart', label: 'PixArt' },
  { value: 'playground', label: 'Playground' },
  { value: 'other', label: 'Other' },
];

const STYLE_OPTIONS = ['generalist', 'anime', 'artistic', 'realistic', 'furry', 'other'];

@Component({
  selector: 'app-wizard-step-image',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="write-step-fields">
      <label class="form-label">
        Baseline
        <select
          class="form-select"
          [value]="form().baseline"
          (change)="onSelectChange('baseline', $event)"
        >
          @for (opt of baselineOpts; track opt.value) {
            <option [value]="opt.value">{{ opt.label }}</option>
          }
        </select>
      </label>

      <label class="form-label">
        Style
        <select
          class="form-select"
          [value]="form().style"
          (change)="onSelectChange('style', $event)"
        >
          @for (s of styleOpts; track s) {
            <option [value]="s">{{ s }}</option>
          }
        </select>
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
