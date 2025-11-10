import {
  Component,
  input,
  output,
  computed,
  ChangeDetectionStrategy,
  inject,
  signal,
  DestroyRef,
  effect,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, switchMap } from 'rxjs';
import { FieldGroupComponent } from '../../form-fields/field-group/field-group.component';
import { FormFieldConfig, FormFieldGroup } from '../../../models/form-field-config';
import { FormFieldBuilder } from '../../../utils/form-field-builder';
import { TextBackend } from '../../../models/text-model-name';
import { ModelConstantsService } from '../../../services/model-constants.service';
import { ModelReferenceApiService } from '../../../services/model-reference-api.service';
import { MODEL_REFERENCE_CATEGORY } from '../../../api-client';
import { LegacyRecordUnion } from '../../../models/api.models';

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
    <div class="space-y-4">
      @for (item of fieldGroups(); track $index) {
        <app-field-group [item]="item" />
      }
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TextGenerationFieldsComponent {
  private readonly modelConstants = inject(ModelConstantsService);
  private readonly api = inject(ModelReferenceApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly categoryChange$ = new Subject<MODEL_REFERENCE_CATEGORY>();

  readonly data = input.required<TextGenerationFieldsData>();
  readonly dataChange = output<TextGenerationFieldsData>();

  // Signal to hold the models for the current category
  protected readonly categoryModels = signal<LegacyRecordUnion[]>([]);

  // Computed signal for tag suggestions based on category models
  protected readonly categoryTagValues = computed(() => {
    const models = this.categoryModels();
    return this.modelConstants.getTagSuggestions(models);
  });

  constructor() {
    // Set up API call stream with switchMap for proper cancellation
    this.categoryChange$
      .pipe(
        switchMap((category) => this.api.getLegacyModelsAsArray(category)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (models) => this.categoryModels.set(models as LegacyRecordUnion[]),
        error: () => this.categoryModels.set([]), // Fallback to empty on error
      });

    // Effect to trigger fetching when component initializes
    effect(() => {
      // Text generation is always text_generation category
      this.categoryChange$.next(MODEL_REFERENCE_CATEGORY.TextGeneration);
    });
  }

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
            .helpText(
              'Total number of model parameters (required for proper categorization). Impact: Directly affects GPU memory requirements (~0.6GB per billion for 4-bit), generation speed, and kudos costs. Larger = better quality but slower.',
            )
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
        {
          label: 'Core Configuration',
          collapsible: true,
          defaultCollapsed: false,
          helpText: 'Essential model identification and parameters',
          colorVariant: 'primary',
          icon: '🔷',
        },
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
            .suggestions(this.categoryTagValues())
            .helpText('Descriptive tags for categorization (e.g., instruct, chat, code)')
            .build(),
        ],
        undefined,
        {
          label: 'Display & Metadata',
          collapsible: true,
          defaultCollapsed: false,
          colorVariant: 'success',
          icon: '✅',
        },
      ),

      // Advanced Settings (collapsible, default collapsed)
      FormFieldBuilder.group(
        [
          FormFieldBuilder.requirements(
            'settings',
            'Settings',
            currentData.settings || {},
            (value) => this.updateField('settings', Object.keys(value).length > 0 ? value : null),
            {
              enableMinSteps: false,
              enableMaxSteps: false,
              enableCfgScale: false,
              enableSamplers: false,
              enableSchedulers: false,
            },
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
          colorVariant: 'warning',
          icon: '⚠️',
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
