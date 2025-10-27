import { Component, input, output, computed, inject, ChangeDetectionStrategy } from '@angular/core';
import { FieldGroupComponent } from '../../form-fields/field-group/field-group.component';
import { FormFieldConfig, FormFieldGroup } from '../../../models/form-field-config';
import { FormFieldBuilder } from '../../../utils/form-field-builder';
import { ModelConstantsService } from '../../../services/model-constants.service';

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

      <div class="card-body">
        <!-- Color Legend -->
        <div class="form-legend mb-4">
          <span class="form-legend-item">
            <span>🔷</span>
            <span>Core</span>
          </span>
          <span class="form-legend-item">
            <span>🔧</span>
            <span>Technical</span>
          </span>
          <span class="form-legend-item">
            <span>✅</span>
            <span>Content</span>
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
export class StableDiffusionFieldsComponent {
  private readonly modelConstants = inject(ModelConstantsService);

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
   * Organized into collapsible sections: Core → Technical Details → Metadata.
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
            .helpText('The base Stable Diffusion model architecture (e.g., SD1.5, SDXL)')
            .build(),

          FormFieldBuilder.checkbox(
            'inpainting',
            'Inpainting Model',
            currentData.inpainting,
            (value) => this.updateField('inpainting', value),
          )
            .checkboxLabel('This model is designed for inpainting tasks')
            .helpText('Inpainting models fill in missing or masked parts of images')
            .build(),
        ],
        'form-grid-2',
        {
          label: 'Core Configuration',
          collapsible: true,
          defaultCollapsed: false,
          helpText: 'Essential model architecture settings',
          colorVariant: 'primary',
          icon: '🔷',
        },
      ),

      // Technical Details Section (promoted for frequently used fields)
      FormFieldBuilder.group(
        [
          FormFieldBuilder.text(
            'optimization',
            'Optimization',
            currentData.optimization || null,
            (value) => this.updateField('optimization', value),
          )
            .placeholder('e.g., xformers, sdp, none')
            .helpText('Optimization techniques: xformers, scaled dot product attention (sdp), etc.')
            .build(),

          FormFieldBuilder.number(
            'size_on_disk_bytes',
            'Size on Disk (bytes)',
            currentData.size_on_disk_bytes || null,
            (value) => this.updateField('size_on_disk_bytes', value),
          )
            .placeholder('e.g., 2000000000')
            .helpText('Total size of the model file in bytes (~2GB for SD1.5, ~6-7GB for SDXL)')
            .build(),

          FormFieldBuilder.number(
            'min_bridge_version',
            'Min Bridge Version',
            currentData.min_bridge_version || null,
            (value) => this.updateField('min_bridge_version', value),
          )
            .placeholder('e.g., 7')
            .helpText('Minimum AI Horde bridge version required to run this model')
            .hideForCategory('image_generation')
            .build(),

          FormFieldBuilder.requirements(
            'requirements',
            'Requirements',
            currentData.requirements || {},
            (value) =>
              this.updateField('requirements', Object.keys(value).length > 0 ? value : null),
          )
            .helpText(
              'System requirements for running this model (steps, cfg_scale, samplers, schedulers, etc.)',
            )
            .build(),
        ],
        undefined,
        {
          label: 'Technical Details',
          collapsible: true,
          defaultCollapsed: false,
          helpText: 'Performance optimization and technical specifications',
          colorVariant: 'info',
          icon: '🔧',
        },
      ),

      // Metadata Section (less frequently edited)
      FormFieldBuilder.group(
        [
          FormFieldBuilder.url('homepage', 'Homepage', currentData.homepage || null, (value) =>
            this.updateField('homepage', value),
          )
            .placeholder('https://civitai.com/models/...')
            .helpText("URL to the model's homepage, CivitAI page, or HuggingFace repository")
            .build(),

          FormFieldBuilder.tagInput('tags', 'Tags', currentData.tags || [], (value) =>
            this.updateField('tags', value.length > 0 ? value : null),
          )
            .placeholder('Add tag...')
            .suggestions(this.modelConstants.getKnownTags())
            .helpText(
              'Descriptive tags for categorizing (e.g., anime, realistic, portrait). Start typing for suggestions.',
            )
            .build(),

          FormFieldBuilder.tagInput(
            'trigger',
            'Trigger Words',
            currentData.trigger || [],
            (value) => this.updateField('trigger', value.length > 0 ? value : null),
          )
            .placeholder('Add trigger word...')
            .helpText("Specific words or phrases that activate this model's style (e.g., 'ohwx', 'person', 'style')")
            .build(),

          FormFieldBuilder.tagInput(
            'showcases',
            'Showcase URLs',
            currentData.showcases || [],
            (value) => this.updateField('showcases', value.length > 0 ? value : null),
          )
            .placeholder('Add showcase URL...')
            .helpText('URLs to example images generated with this model (typically GitHub raw URLs or CivitAI images)')
            .build(),
        ],
        undefined,
        {
          label: 'Metadata',
          collapsible: true,
          defaultCollapsed: false,
          helpText: 'Additional descriptive information about the model',
          colorVariant: 'success',
          icon: '✅',
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
