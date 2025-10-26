import { Component, input, output, computed, ChangeDetectionStrategy } from '@angular/core';
import { FieldGroupComponent } from '../../form-fields/field-group/field-group.component';
import { FormFieldConfig, FormFieldGroup } from '../../../models/form-field-config';
import { FormFieldBuilder } from '../../../utils/form-field-builder';

type RequirementsValue = number | string | boolean | number[] | string[];

export interface StableDiffusionFieldsData {
  inpainting: boolean;
  baseline: string;
  tags?: string[] | null;
  showcases?: string[] | null;
  min_bridge_version?: number | null;
  trigger?: string[] | null;
  homepage?: string | null;
  size_on_disk_bytes?: number | null;
  optimization?: string | null;
  requirements?: Record<string, RequirementsValue> | null;
}

@Component({
  selector: 'app-stable-diffusion-fields',
  imports: [FieldGroupComponent],
  template: `
    <div class="card">
      <div class="card-header">
        <h3 class="heading-card">Image Generation (Stable Diffusion) Fields</h3>
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
export class StableDiffusionFieldsComponent {
  readonly data = input.required<StableDiffusionFieldsData>();
  readonly dataChange = output<StableDiffusionFieldsData>();

  readonly baselineOptions = [
    { value: 'stable_diffusion_1', label: 'Stable Diffusion 1' },
    { value: 'stable_diffusion_2_768', label: 'Stable Diffusion 2 (768)' },
    { value: 'stable_diffusion_2_512', label: 'Stable Diffusion 2 (512)' },
    { value: 'stable_diffusion_xl', label: 'Stable Diffusion XL' },
    { value: 'stable_cascade', label: 'Stable Cascade' },
  ];

  /**
   * Computed signal that generates all field configurations for the stable diffusion fields form.
   * Organized into collapsible sections for better UX.
   */
  readonly fieldGroups = computed<(FormFieldConfig | FormFieldGroup)[]>(() => {
    const currentData = this.data();

    return [
      // Core Fields (always visible)
      FormFieldBuilder.group(
        [
          FormFieldBuilder.select(
            'baseline',
            'Baseline',
            currentData.baseline,
            this.baselineOptions,
            (value) => this.updateField('baseline', value),
          )
            .required()
            .helpText('The base Stable Diffusion model architecture')
            .build(),

          FormFieldBuilder.checkbox(
            'inpainting',
            'Inpainting Model',
            currentData.inpainting,
            (value) => this.updateField('inpainting', value),
          )
            .checkboxLabel('This model is designed for inpainting tasks')
            .helpText('Inpainting models are used to fill in missing or masked parts of images')
            .build(),
        ],
        'form-grid-2',
      ),

      // Metadata Section (collapsible)
      FormFieldBuilder.group(
        [
          FormFieldBuilder.url('homepage', 'Homepage', currentData.homepage || null, (value) =>
            this.updateField('homepage', value),
          )
            .placeholder('https://...')
            .helpText("URL to the model's homepage or documentation")
            .build(),

          FormFieldBuilder.tagInput('tags', 'Tags', currentData.tags || [], (value) =>
            this.updateField('tags', value.length > 0 ? value : null),
          )
            .placeholder('Add tag...')
            .helpText(
              'Descriptive tags for categorizing the model (e.g., realistic, anime, portrait)',
            )
            .build(),

          FormFieldBuilder.tagInput(
            'trigger',
            'Trigger Words',
            currentData.trigger || [],
            (value) => this.updateField('trigger', value.length > 0 ? value : null),
          )
            .placeholder('Add trigger word...')
            .helpText("Specific words or phrases that activate this model's style")
            .build(),

          FormFieldBuilder.tagInput(
            'showcases',
            'Showcase URLs',
            currentData.showcases || [],
            (value) => this.updateField('showcases', value.length > 0 ? value : null),
          )
            .placeholder('Add showcase URL...')
            .helpText('URLs to example images generated with this model')
            .build(),
        ],
        undefined,
        {
          label: 'Metadata',
          collapsible: true,
          defaultCollapsed: false,
          helpText: 'Additional information about the model',
        },
      ),

      // Technical Details Section (collapsible, default collapsed)
      FormFieldBuilder.group(
        [
          FormFieldBuilder.text(
            'optimization',
            'Optimization',
            currentData.optimization || null,
            (value) => this.updateField('optimization', value),
          )
            .placeholder('e.g., xformers, sdp')
            .helpText('Optimization techniques used (e.g., xformers, scaled dot product attention)')
            .build(),

          FormFieldBuilder.number(
            'size_on_disk_bytes',
            'Size on Disk (bytes)',
            currentData.size_on_disk_bytes || null,
            (value) => this.updateField('size_on_disk_bytes', value),
          )
            .placeholder('e.g., 2000000000')
            .helpText('Total size of the model file in bytes')
            .build(),

          FormFieldBuilder.number(
            'min_bridge_version',
            'Min Bridge Version',
            currentData.min_bridge_version || null,
            (value) => this.updateField('min_bridge_version', value),
          )
            .placeholder('e.g., 7')
            .helpText('Minimum bridge version required')
            .hideForCategory('image_generation')
            .build(),

          FormFieldBuilder.keyValue(
            'requirements',
            'Requirements',
            currentData.requirements || {},
            (value) =>
              this.updateField('requirements', Object.keys(value).length > 0 ? value : null),
          )
            .helpText('Additional system or software requirements for this model')
            .build(),
        ],
        undefined,
        {
          label: 'Technical Details',
          collapsible: true,
          defaultCollapsed: true,
          helpText: 'Advanced configuration and technical specifications',
        },
      ),
    ];
  });

  updateField<K extends keyof StableDiffusionFieldsData>(
    field: K,
    value: StableDiffusionFieldsData[K],
  ): void {
    this.dataChange.emit({
      ...this.data(),
      [field]: value,
    });
  }
}
