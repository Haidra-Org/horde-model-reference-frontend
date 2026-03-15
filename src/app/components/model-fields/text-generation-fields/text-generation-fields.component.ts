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
  instruct_format?: string | null;
  settings?: Record<string, SettingsValue> | null;
  /** V2-only: base model group for grouping variants together */
  text_model_group?: string | null;
}

@Component({
  selector: 'app-text-generation-fields',
  imports: [FieldGroupComponent],
  template: `
    <div class="space-y-4">
      <!-- Simplified callout -->
      <div class="min-required-callout">
        <span>✏️</span>
        <span>
          <strong>Minimum required:</strong> Parameters and Baseline.
          The same fields you'd fill in a CSV row. Toggle "Show all fields" for tags, settings, etc.
        </span>
      </div>

      <!-- Core fields (always visible) -->
      @for (item of coreFieldGroups(); track $index) {
        <app-field-group [item]="item" />
      }

      <!-- Advanced toggle -->
      <button type="button" class="advanced-toggle-btn" (click)="showAdvanced.set(!showAdvanced())">
        <svg class="w-4 h-4 transition-transform" [class.rotate-90]="showAdvanced()"
          fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
        </svg>
        {{ showAdvanced() ? 'Hide' : 'Show' }} all fields
      </button>

      <!-- Advanced fields -->
      @if (showAdvanced()) {
        @for (item of advancedFieldGroups(); track $index) {
          <app-field-group [item]="item" />
        }
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
  readonly canonicalFormat = input<string>('legacy');
  readonly dataChange = output<TextGenerationFieldsData>();

  readonly showAdvanced = signal(false);

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
   * Core fields: the CSV-equivalent fields that every text model needs.
   * parameters, baseline, display_name, url (name and description are in parent/common).
   */
  readonly coreFieldGroups = computed<(FormFieldConfig | FormFieldGroup)[]>(() => {
    const currentData = this.data();

    return [
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
              'Total number of model parameters. Affects GPU memory (~0.6GB per billion at 4-bit), speed, and kudos cost.',
            )
            .build(),

          FormFieldBuilder.text('baseline', 'Baseline', currentData.baseline || null, (value) =>
            this.updateField('baseline', value),
          )
            .required()
            .placeholder('e.g., llama, gpt, falcon')
            .helpText('Base model family or architecture lineage')
            .build(),

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

          FormFieldBuilder.text(
            'instruct_format',
            'Instruct Format',
            currentData.instruct_format || null,
            (value) => this.updateField('instruct_format', value),
          )
            .placeholder('e.g., ChatML, Alpaca, Mistral')
            .helpText('Instruction/chat template format the model expects')
            .build(),
        ],
        'form-grid-2',
        {
          label: 'Core Fields',
          collapsible: false,
        },
      ),
    ];
  });

  /**
   * Advanced fields: tags, model_name/text_model_group, settings.
   * Hidden by default behind the toggle.
   */
  readonly advancedFieldGroups = computed<(FormFieldConfig | FormFieldGroup)[]>(() => {
    const currentData = this.data();
    const format = this.canonicalFormat();
    const isV2 = format === 'v2';

    return [
      FormFieldBuilder.group(
        [
          FormFieldBuilder.text(
            'model_name',
            'Model Name (Legacy)',
            currentData.model_name || null,
            (value) => this.updateField('model_name', value),
          )
            .placeholder('e.g., gpt2, llama-2-7b')
            .helpText('Technical name of the model architecture')
            .hideWhen(() => isV2)
            .build(),

          FormFieldBuilder.text(
            'text_model_group',
            'Text Model Group',
            currentData.text_model_group || null,
            (value) => this.updateField('text_model_group', value),
          )
            .placeholder('e.g., llama-2-7b')
            .helpText('Base model group name for grouping model variants together')
            .showWhen(() => isV2)
            .build(),

          FormFieldBuilder.tagInput('tags', 'Tags', currentData.tags || [], (value) =>
            this.updateField('tags', value.length > 0 ? value : null),
          )
            .placeholder('Add tag...')
            .suggestions(this.categoryTagValues())
            .helpText('Descriptive tags for categorization (e.g., instruct, chat, code)')
            .build(),
        ],
        'form-grid-2',
        {
          label: 'Additional Metadata',
          collapsible: true,
          defaultCollapsed: false,
        },
      ),

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
          label: 'Settings',
          collapsible: true,
          defaultCollapsed: true,
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
