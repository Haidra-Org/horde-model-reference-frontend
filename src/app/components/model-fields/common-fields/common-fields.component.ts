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
import { ModelConstantsService } from '../../../services/model-constants.service';
import { ModelReferenceApiService } from '../../../services/model-reference-api.service';
import { Subject } from 'rxjs';
import { switchMap } from 'rxjs/operators';

export interface CommonFieldsData {
  description?: string | null;
  type?: string | null;
  version?: string | null;
  style?: string | null;
  nsfw: boolean;
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
export class CommonFieldsComponent implements OnInit {
  private readonly modelConstants = inject(ModelConstantsService);
  private readonly api = inject(ModelReferenceApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);

  readonly data = input.required<CommonFieldsData>();
  readonly category = input.required<ModelReferenceCategory>();
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
            .hideForCategory(category)
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
            .hideForCategory(category)
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
            .hideForCategory(category)
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
    ];
  });

  updateField<K extends keyof CommonFieldsData>(field: K, value: CommonFieldsData[K]): void {
    this.dataChange.emit({
      ...this.data(),
      [field]: value,
    });
  }
}
