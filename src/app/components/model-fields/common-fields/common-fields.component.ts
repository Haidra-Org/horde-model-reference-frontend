import {
  Component,
  input,
  output,
  computed,
  inject,
  ChangeDetectionStrategy,
  signal,
  effect,
  DestroyRef,
  OnInit,
  Injector,
  runInInjectionContext,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FieldGroupComponent } from '../../form-fields/field-group/field-group.component';
import { ModelReferenceCategory, LegacyRecordUnion } from '../../../models/api.models';
import { FormFieldConfig, FormFieldGroup } from '../../../models/form-field-config';
import { FormFieldBuilder } from '../../../utils/form-field-builder';
import { isFieldHidden } from '../../../models/legacy-fixed-fields.config';
import { ModelConstantsService } from '../../../services/model-constants.service';
import { ModelReferenceApiService } from '../../../services/model-reference-api.service';
import { Subject } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { ModelClassification, FineTuneSeriesInfo, MODEL_DOMAIN, MODEL_PURPOSE } from '../../../api-client';

export interface CommonFieldsData {
  description?: string | null;
  type?: string | null;
  version?: string | null;
  style?: string | null;
  nsfw: boolean;
  download_all?: boolean | null;
  available?: boolean | null;
  features_not_supported?: string[] | null;
  /** V2-only: model classification (domain + purpose) */
  modelClassification?: ModelClassification | null;
  /** V2-only: fine-tune series information */
  finetuneSeries?: FineTuneSeriesInfo | null;
}

@Component({
  selector: 'app-common-fields',
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
export class CommonFieldsComponent implements OnInit {
  private readonly modelConstants = inject(ModelConstantsService);
  private readonly api = inject(ModelReferenceApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);

  readonly data = input.required<CommonFieldsData>();
  readonly category = input.required<ModelReferenceCategory>();
  readonly canonicalFormat = input<string>('legacy');
  readonly dataChange = output<CommonFieldsData>();

  /**
   * Signal to store actual style values from models in the current category.
   * Populated asynchronously when the category changes.
   */
  private readonly categoryModels = signal<LegacyRecordUnion[]>([]);

  /**
   * Subject to trigger category changes and handle request cancellation.
   * Using switchMap ensures only the latest request completes.
   */
  private readonly categoryChange$ = new Subject<ModelReferenceCategory>();

  /**
   * Computed signal that extracts unique styles from existing models in the category.
   * Returns unique, sorted suggestions for the autocomplete.
   */
  private readonly categoryStyleValues = computed(() => {
    const models = this.categoryModels();
    return this.modelConstants.getStyleSuggestions(models);
  });

  constructor() {
    // Setup category change handler with proper request cancellation
    this.categoryChange$
      .pipe(
        switchMap((category) => this.api.getLegacyModelsAsArray(category)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (models) => this.categoryModels.set(models),
        error: () => {
          // Silently fail and just use base suggestions
          this.categoryModels.set([]);
        },
      });
  }

  ngOnInit(): void {
    runInInjectionContext(this.injector, () =>
      effect(() => {
        const category = this.category();
        if (!category) {
          return;
        }
        this.categoryChange$.next(category);
      }),
    );
  }

  /**
   * Computed signal that generates all field configurations for the common fields form.
   * This declaratively defines all fields using the builder pattern with helpful descriptions.
   * Fields are organized by priority: required, recommended, optional, advanced.
   */
  readonly fieldGroups = computed<(FormFieldConfig | FormFieldGroup)[]>(() => {
    const category = this.category();
    const currentData = this.data();
    const format = this.canonicalFormat();
    const isV2 = format === 'v2';
    const hideLegacyField = (fieldName: string) => isV2 || isFieldHidden(category, fieldName);

    return [
      // Essential Information - Required fields
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
            .gridSpan(4)
            .priority('required')
            .build(),

          FormFieldBuilder.text('type', 'Type', currentData.type || null, (value) =>
            this.updateField('type', value),
          )
            .placeholder('e.g., ckpt, safetensors')
            .helpText('Model file format (e.g., ckpt, safetensors, diffusers)')
            .hideWhen(() => hideLegacyField('type'))
            .gridSpan(1)
            .priority('advanced')
            .build(),

          FormFieldBuilder.text('version', 'Version', currentData.version || null, (value) =>
            this.updateField('version', value),
          )
            .placeholder('e.g., 1.0, v2.1, fp16')
            .helpText('Version identifier or variant name for this model release')
            .gridSpan(3)
            .priority('recommended')
            .build(),
        ],
        'form-grid-4',
        {
          label: 'Essential Information',
          collapsible: true,
          helpText: 'Core information required for all models',
          icon: '⭐',
          priority: 'required',
        },
      ),

      // Content Classification - Recommended fields
      FormFieldBuilder.group(
        [
          FormFieldBuilder.boolean('nsfw', 'NSFW', currentData.nsfw, (value) =>
            this.updateField('nsfw', value),
          )
            .helpText(
              'Whether this model is designed for or may generate NSFW content. Impact: Affects model discoverability and which workers will serve it. Some institutions filter NSFW models from search results.',
            )
            .gridSpan(1)
            .priority('recommended')
            .build(),

          FormFieldBuilder.autocomplete('style', 'Style', currentData.style || null, (value) =>
            this.updateField('style', value || null),
          )
            .suggestions(this.categoryStyleValues())
            .placeholder('Type or select a style...')
            .helpText(
              'Visual or output style category of the model. You can type a custom value or select from common styles.',
            )
            .gridSpan(1)
            .priority('optional')
            .build(),

          FormFieldBuilder.tagInput(
            'features_not_supported',
            'Features Not Supported',
            currentData.features_not_supported || [],
            (value) => this.updateField('features_not_supported', value.length > 0 ? value : null),
          )
            .placeholder('Add unsupported feature...')
            .suggestions(this.modelConstants.getCommonUnsupportedFeatures())
            .helpText(
              'List any features this model does not support (e.g., img2img, controlnet, lora)',
            )
            .hideWhen(() => hideLegacyField('features_not_supported'))
            .gridSpan(2)
            .priority('optional')
            .build(),

          FormFieldBuilder.triStateBoolean(
            'download_all',
            'Download All',
            currentData.download_all ?? null,
            (value) => this.updateField('download_all', value),
          )
            .helpText('Whether to download all model variants')
            .hideWhen(() => hideLegacyField('download_all'))
            .gridSpan(2)
            .build(),

          FormFieldBuilder.triStateBoolean(
            'available',
            'Available',
            currentData.available ?? null,
            (value) => this.updateField('available', value),
          )
            .labelSuffix(' (usually should be unset)')
            .helpText('Model availability status (leave unset to auto-detect)')
            .hideWhen(() => hideLegacyField('available'))
            .gridSpan(2)
            .build(),
        ],
        'form-grid-3',
        {
          label: 'Content Classification',
          collapsible: true,
          helpText: 'Classify model content type and document any limitations',
          icon: '🏷️',
          priority: 'recommended',
        },
      ),

      // V2 Model Classification — shown only in v2 mode
      FormFieldBuilder.group(
        [
          FormFieldBuilder.select(
            'model_domain',
            'Domain',
            currentData.modelClassification?.domain ?? '',
            [
              { value: '', label: '— Select domain —' },
              ...Object.values(MODEL_DOMAIN).map((v) => ({ value: v, label: v })),
            ],
            (value) => {
              const current = currentData.modelClassification ?? { domain: '' as MODEL_DOMAIN, purpose: '' as MODEL_PURPOSE };
              this.updateField('modelClassification', {
                domain: value as MODEL_DOMAIN,
                purpose: current.purpose,
              });
            },
          )
            .required()
            .helpText('What the model pertains to (image, text, video, etc.)')
            .showWhen(() => isV2)
            .gridSpan(1)
            .priority('required')
            .build(),

          FormFieldBuilder.select(
            'model_purpose',
            'Purpose',
            currentData.modelClassification?.purpose ?? '',
            [
              { value: '', label: '— Select purpose —' },
              ...Object.values(MODEL_PURPOSE).map((v) => ({ value: v, label: v })),
            ],
            (value) => {
              const current = currentData.modelClassification ?? { domain: '' as MODEL_DOMAIN, purpose: '' as MODEL_PURPOSE };
              this.updateField('modelClassification', {
                domain: current.domain,
                purpose: value as MODEL_PURPOSE,
              });
            },
          )
            .required()
            .helpText('The primary purpose of the model (generation, post-processing, etc.)')
            .showWhen(() => isV2)
            .gridSpan(1)
            .priority('required')
            .build(),
        ],
        'form-grid-2',
        {
          label: 'Model Classification',
          collapsible: true,
          helpText: 'Categorize the model by domain and purpose (V2 only)',
          icon: '📊',
          priority: 'required',
          showWhen: () => isV2,
        },
      ),

      // V2 Fine-Tune Series — shown only in v2 mode
      FormFieldBuilder.group(
        [
          FormFieldBuilder.text(
            'finetune_name',
            'Series Name',
            currentData.finetuneSeries?.name ?? null,
            (value) => this.updateFinetuneSeries('name', value ?? ''),
          )
            .placeholder('e.g., Dreamshaper, Deliberate')
            .helpText('Name of the fine-tuning series this model belongs to')
            .showWhen(() => isV2)
            .gridSpan(2)
            .priority('optional')
            .build(),

          FormFieldBuilder.text(
            'finetune_version',
            'Series Version',
            currentData.finetuneSeries?.version ?? null,
            (value) => this.updateFinetuneSeries('version', value),
          )
            .placeholder('e.g., 8.0, XL')
            .helpText('Version of this model within the fine-tuning series')
            .showWhen(() => isV2)
            .gridSpan(1)
            .priority('optional')
            .build(),

          FormFieldBuilder.text(
            'finetune_author',
            'Author',
            currentData.finetuneSeries?.author ?? null,
            (value) => this.updateFinetuneSeries('author', value),
          )
            .placeholder('e.g., Lykon, XpucT')
            .helpText('Author or creator of the fine-tuning series')
            .showWhen(() => isV2)
            .gridSpan(1)
            .priority('optional')
            .build(),

          FormFieldBuilder.textarea(
            'finetune_description',
            'Series Description',
            currentData.finetuneSeries?.description ?? null,
            (value) => this.updateFinetuneSeries('description', value),
          )
            .rows(2)
            .placeholder('Brief description of the fine-tuning series')
            .showWhen(() => isV2)
            .gridSpan(4)
            .priority('optional')
            .build(),

          FormFieldBuilder.url(
            'finetune_homepage',
            'Homepage',
            currentData.finetuneSeries?.homepage ?? null,
            (value) => this.updateFinetuneSeries('homepage', value),
          )
            .placeholder('https://civitai.com/models/...')
            .helpText('Homepage or project page for the fine-tuning series')
            .showWhen(() => isV2)
            .gridSpan(4)
            .priority('optional')
            .build(),
        ],
        'form-grid-4',
        {
          label: 'Fine-Tune Series',
          collapsible: true,
          helpText: 'Information about the fine-tuning lineage of this model (V2 only)',
          icon: '🔗',
          priority: 'optional',
          showWhen: () => isV2,
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

  private updateFinetuneSeries(field: keyof FineTuneSeriesInfo, value: string | null | undefined): void {
    const current = this.data().finetuneSeries ?? { name: '' };
    const updated = { ...current, [field]: value };
    // Only emit non-null finetuneSeries if at least the name is set
    const hasContent = updated.name?.trim();
    this.updateField('finetuneSeries', hasContent ? updated : null);
  }
}
