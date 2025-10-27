import { Component, input, output, computed, inject, ChangeDetectionStrategy } from '@angular/core';
import { FieldGroupComponent } from '../../form-fields/field-group/field-group.component';
import { ModelReferenceCategory } from '../../../models/api.models';
import { FormFieldConfig, FormFieldGroup } from '../../../models/form-field-config';
import { FormFieldBuilder } from '../../../utils/form-field-builder';
import { ModelConstantsService } from '../../../services/model-constants.service';

export interface CommonFieldsData {
  description?: string | null;
  type?: string | null;
  version?: string | null;
  style?: string | null;
  nsfw?: boolean | null;
  download_all?: boolean | null;
  available?: boolean | null;
  features_not_supported?: string[] | null;
}

@Component({
  selector: 'app-common-fields',
  imports: [FieldGroupComponent],
  template: `
    <div class="card">
      <div class="card-header">
        <h3 class="heading-card">Common Fields</h3>
      </div>

      <div class="card-body">
        <!-- Color Legend -->
        <div class="form-legend mb-4">
          <span class="form-legend-item">
            <span>🔷</span>
            <span>Core</span>
          </span>
          <span class="form-legend-item">
            <span>✅</span>
            <span>Content</span>
          </span>
          <span class="form-legend-item">
            <span>⚠️</span>
            <span>Constraints</span>
          </span>
        </div>

        <div class="card-section">
          @for (item of fieldGroups(); track $index) {
            <app-field-group [item]="item" />
          }
        </div>
      </div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CommonFieldsComponent {
  private readonly modelConstants = inject(ModelConstantsService);

  readonly data = input.required<CommonFieldsData>();
  readonly category = input.required<ModelReferenceCategory>();
  readonly dataChange = output<CommonFieldsData>();

  /**
   * Computed signal that generates all field configurations for the common fields form.
   * This declaratively defines all fields using the builder pattern with helpful descriptions.
   */
  readonly fieldGroups = computed<(FormFieldConfig | FormFieldGroup)[]>(() => {
    const category = this.category();
    const currentData = this.data();

    return [
      // Model Identity - Core information
      FormFieldBuilder.group(
        [
          FormFieldBuilder.textarea(
            'description',
            'Description',
            currentData.description || null,
            (value) => this.updateField('description', value),
          )
            .rows(3)
            .placeholder('Brief description of the model and its capabilities')
            .helpText('A concise summary that helps users understand what this model does')
            .build(),

          FormFieldBuilder.text('type', 'Type', currentData.type || null, (value) =>
            this.updateField('type', value),
          )
            .placeholder('e.g., ckpt, safetensors')
            .helpText('Model file format (e.g., ckpt, safetensors, diffusers)')
            .hideForCategory(category)
            .build(),

          FormFieldBuilder.text('version', 'Version', currentData.version || null, (value) =>
            this.updateField('version', value),
          )
            .placeholder('e.g., 1.0, v2.1, fp16')
            .helpText('Version identifier or variant name for this model release')
            .build(),

          FormFieldBuilder.select(
            'style',
            'Style',
            currentData.style || '',
            [
              { value: '', label: '(None)' },
              ...this.modelConstants.getModelStyles(),
            ],
            (value) => this.updateField('style', value || null),
          )
            .helpText('Visual or output style category of the model')
            .build(),
        ],
        'form-grid-3',
        {
          label: 'Model Identity',
          collapsible: true,
          defaultCollapsed: false,
          helpText: 'Basic identifying information about this model',
          colorVariant: 'primary',
          icon: '🔷',
        },
      ),

      // Content & Availability Settings
      FormFieldBuilder.group(
        [
          FormFieldBuilder.triStateBoolean('nsfw', 'NSFW', currentData.nsfw ?? null, (value) =>
            this.updateField('nsfw', value),
          )
            .helpText('Whether this model is designed for or may generate NSFW content')
            .build(),

          FormFieldBuilder.triStateBoolean(
            'download_all',
            'Download All',
            currentData.download_all ?? null,
            (value) => this.updateField('download_all', value),
          )
            .helpText('Whether to download all model variants')
            .hideForCategory(category)
            .build(),

          FormFieldBuilder.triStateBoolean(
            'available',
            'Available',
            currentData.available ?? null,
            (value) => this.updateField('available', value),
          )
            .labelSuffix(' (usually should be unset)')
            .helpText('Model availability status (leave unset to auto-detect)')
            .hideForCategory(category)
            .build(),
        ],
        'form-grid-3',
        {
          label: 'Content & Availability',
          collapsible: true,
          defaultCollapsed: false,
          colorVariant: 'success',
          icon: '✅',
        },
      ),

      // Limitations
      FormFieldBuilder.group(
        [
          FormFieldBuilder.tagInput(
            'features_not_supported',
            'Features Not Supported',
            currentData.features_not_supported || [],
            (value) => this.updateField('features_not_supported', value.length > 0 ? value : null),
          )
            .placeholder('Add unsupported feature...')
            .suggestions(this.modelConstants.getCommonUnsupportedFeatures())
            .helpText(
              'List any features this model does not support (e.g., img2img, controlnet, lora). Start typing for common suggestions.',
            )
            .build(),
        ],
        undefined,
        {
          label: 'Limitations',
          collapsible: true,
          defaultCollapsed: false,
          helpText: 'Document known limitations or unsupported features',
          colorVariant: 'warning',
          icon: '⚠️',
        },
      ),
    ];
  });

  updateField<K extends keyof CommonFieldsData>(field: K, value: CommonFieldsData[K]): void {
    this.dataChange.emit({
      ...this.data(),
      [field]: value,
    });
  }
}
