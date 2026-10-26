import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import type { WriteFormState } from '../../utils/write-record';

interface Attribute {
  key: string;
  label: string;
  type: 'text' | 'number' | 'list' | 'json' | 'boolean';
}
/** Less common schema attributes remain editable without replacing the complete request body. */
@Component({
  selector: 'app-wizard-step-attributes',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <details class="write-step-fields">
      <summary>Additional model attributes</summary>
      @for (field of fields(); track field.key) {
        <label class="form-label" [for]="'attribute-' + field.key">
          {{ field.label }}
          @if (field.type === 'json') {
            <textarea
              [id]="'attribute-' + field.key"
              class="form-textarea mono"
              rows="4"
              [value]="value(field)"
              (input)="update(field, $event)"
            ></textarea>
            <span class="form-hint">JSON object; leave empty if unknown.</span>
          } @else if (field.type === 'boolean') {
            <input
              [id]="'attribute-' + field.key"
              type="checkbox"
              class="form-checkbox"
              [checked]="form().sourceRecord?.[field.key] === true"
              (change)="update(field, $event)"
            />
          } @else {
            <input
              [id]="'attribute-' + field.key"
              class="form-input"
              [type]="field.type === 'number' ? 'number' : 'text'"
              [value]="value(field)"
              (input)="update(field, $event)"
            />
            @if (field.type === 'list') {
              <span class="form-hint">Comma-separated</span>
            }
          }
          @if (errors()[field.key]) {
            <span class="form-error">{{ errors()[field.key] }}</span>
          }
        </label>
      }
    </details>
  `,
})
export class WizardStepAttributesComponent {
  readonly form = input.required<WriteFormState>();
  readonly category = input.required<string>();
  readonly formChange = output<Partial<WriteFormState>>();
  readonly validChange = output<boolean>();
  readonly errors = signal<Record<string, string>>({});
  readonly fields = computed<Attribute[]>(() => {
    const fields: Attribute[] = [
      { key: 'finetune_series', label: 'Fine-tune series', type: 'json' },
    ];
    if (this.category() !== 'image_generation')
      fields.push({
        key: 'size_on_disk_bytes',
        label: 'Total size on disk (bytes)',
        type: 'number',
      });
    if (this.category() === 'image_generation')
      fields.push({
        key: 'features_not_supported',
        label: 'Unsupported features (legacy)',
        type: 'list',
      });
    if (this.category() === 'text_generation')
      fields.push(
        { key: 'style', label: 'Style', type: 'text' },
        { key: 'url', label: 'Model URL', type: 'text' },
        { key: 'name_schema_exception', label: 'Name schema exception reason', type: 'text' },
        { key: 'settings', label: 'Generation settings', type: 'json' },
        { key: 'context_window', label: 'Publisher context window', type: 'json' },
        { key: 'interaction_modes', label: 'Reviewed interaction support', type: 'json' },
        { key: 'capabilities', label: 'Reviewed capability claims', type: 'json' },
      );
    if (this.category() === 'clip')
      fields.push({ key: 'pretrained_name', label: 'Pretrained name', type: 'text' });
    if (this.category() === 'controlnet')
      fields.push({ key: 'controlnet_style', label: 'ControlNet style', type: 'text' });
    if (this.category() === 'controlnet_annotator')
      fields.push(
        { key: 'control_types', label: 'Control types', type: 'list' },
        { key: 'preprocessors', label: 'Preprocessor node classes', type: 'list' },
      );
    if (['video_generation', 'audio_generation', 'lora', 'ti'].includes(this.category()))
      fields.push(
        { key: 'baseline', label: 'Baseline', type: 'text' },
        { key: 'nsfw', label: 'NSFW', type: 'boolean' },
        { key: 'tags', label: 'Tags', type: 'list' },
      );
    if (['lora', 'ti'].includes(this.category()))
      fields.push(
        { key: 'trigger', label: 'Trigger words', type: 'list' },
        { key: 'homepage', label: 'Homepage', type: 'text' },
        { key: 'showcases', label: 'Showcase URLs', type: 'list' },
      );
    return fields;
  });
  value(field: Attribute): string {
    if (field.key === 'size_on_disk_bytes') return this.form().size_on_disk_bytes ?? '';
    const value = this.form().sourceRecord?.[field.key];
    return value == null
      ? ''
      : field.type === 'json'
        ? JSON.stringify(value, null, 2)
        : Array.isArray(value)
          ? value.join(', ')
          : String(value);
  }
  update(field: Attribute, event: Event): void {
    const input = event.target as HTMLInputElement;
    let value: unknown = input.value;
    try {
      if (field.type === 'json') {
        value = input.value.trim() ? JSON.parse(input.value) : undefined;
        if (value != null && (typeof value !== 'object' || Array.isArray(value)))
          throw new Error('Enter a JSON object');
      } else if (field.type === 'list')
        value = input.value
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);
      else if (field.type === 'boolean') value = input.checked;
      const errors = { ...this.errors() };
      delete errors[field.key];
      this.errors.set(errors);
      if (field.key === 'size_on_disk_bytes')
        this.formChange.emit({ size_on_disk_bytes: input.value });
      else
        this.formChange.emit({ sourceRecord: { ...this.form().sourceRecord, [field.key]: value } });
    } catch {
      this.errors.update((errors) => ({ ...errors, [field.key]: 'Enter a valid JSON object' }));
    }
    this.validChange.emit(Object.keys(this.errors()).length === 0);
  }
}
