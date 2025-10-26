import { Component, input, output, computed, ChangeDetectionStrategy } from '@angular/core';
import { FieldGroupComponent } from '../../form-fields/field-group/field-group.component';
import { FormFieldConfig, FormFieldGroup } from '../../../models/form-field-config';
import { FormFieldBuilder } from '../../../utils/form-field-builder';
import { TextBackend } from '../../../models/text-model-name';

type SettingsValue = number | string | boolean | number[] | string[];

export interface TextGenerationFieldsData {
  parameters?: number | null;
  model_name?: string | null;
  baseline?: string | null;
  display_name?: string | null;
  url?: string | null;
  tags?: string[] | null;
  settings?: Record<string, SettingsValue> | null;
  /**
   * Selected backends for this text model (aphrodite, koboldcpp, or none for base name only)
   */
  selectedBackends?: TextBackend[];
}

@Component({
  selector: 'app-text-generation-fields',
  imports: [FieldGroupComponent],
  template: `
    <div class="card">
      <div class="card-header">
        <h3 class="heading-card">Text Generation Fields</h3>
      </div>

      <div class="card-body card-section">
        @for (item of fieldGroups(); track $index) {
          <app-field-group [item]="item" />
        }
      </div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TextGenerationFieldsComponent {
  readonly data = input.required<TextGenerationFieldsData>();
  readonly dataChange = output<TextGenerationFieldsData>();

  /**
   * Computed signal that generates all field configurations for the text generation fields form.
   * Organized into logical sections for better UX.
   */
  readonly fieldGroups = computed<(FormFieldConfig | FormFieldGroup)[]>(() => {
    const currentData = this.data();

    return [
      // Core Fields (always visible)
      FormFieldBuilder.group(
        [
          FormFieldBuilder.number(
            'parameters',
            'Parameters',
            currentData.parameters || null,
            (value) => this.updateField('parameters', value),
          )
            .required()
            .placeholder('e.g., 7000000000')
            .helpText('Total number of model parameters (required for proper categorization)')
            .build(),

          FormFieldBuilder.text(
            'model_name',
            'Model Name',
            currentData.model_name || null,
            (value) => this.updateField('model_name', value),
          )
            .placeholder('e.g., gpt2, llama-2-7b')
            .helpText('Technical name of the model architecture')
            .build(),

          FormFieldBuilder.text('baseline', 'Baseline', currentData.baseline || null, (value) =>
            this.updateField('baseline', value),
          )
            .placeholder('e.g., llama, gpt, falcon')
            .helpText('Base model family or architecture lineage')
            .build(),
        ],
        'form-grid-2',
      ),

      // Display & Metadata
      FormFieldBuilder.group(
        [
          FormFieldBuilder.text(
            'display_name',
            'Display Name',
            currentData.display_name || null,
            (value) => this.updateField('display_name', value),
          )
            .placeholder('Human-friendly name')
            .helpText('User-facing name shown in the interface')
            .build(),

          FormFieldBuilder.url('url', 'URL', currentData.url || null, (value) =>
            this.updateField('url', value),
          )
            .placeholder('https://...')
            .helpText('Link to model card, documentation, or homepage')
            .build(),

          FormFieldBuilder.tagInput('tags', 'Tags', currentData.tags || [], (value) =>
            this.updateField('tags', value.length > 0 ? value : null),
          )
            .placeholder('Add tag...')
            .helpText('Descriptive tags for categorization (e.g., instruct, chat, code)')
            .build(),
        ],
        undefined,
        {
          label: 'Display & Metadata',
          collapsible: true,
          defaultCollapsed: false,
        },
      ),

      // Advanced Settings (collapsible, default collapsed)
      FormFieldBuilder.group(
        [
          FormFieldBuilder.keyValue('settings', 'Settings', currentData.settings || {}, (value) =>
            this.updateField('settings', Object.keys(value).length > 0 ? value : null),
          )
            .helpText('Model-specific configuration parameters and default values')
            .build(),
        ],
        undefined,
        {
          label: 'Advanced Settings',
          collapsible: true,
          defaultCollapsed: true,
          helpText: 'Optional configuration parameters for this model',
        },
      ),
    ];
  });

  updateField<K extends keyof TextGenerationFieldsData>(
    field: K,
    value: TextGenerationFieldsData[K],
  ): void {
    this.dataChange.emit({
      ...this.data(),
      [field]: value,
    });
  }
}
