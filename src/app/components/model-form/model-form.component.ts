import {
  Component,
  inject,
  OnInit,
  signal,
  computed,
  ChangeDetectionStrategy,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ModelReferenceApiService } from '../../services/model-reference-api.service';
import { NotificationService } from '../../services/notification.service';
import { LegacyRecordUnion, LegacyConfig, ModelReferenceCategory } from '../../models/api.models';
import {
  createDefaultRecordForCategory,
  isLegacyStableDiffusionRecord,
  isLegacyTextGenerationRecord,
  isLegacyClipRecord,
} from '../../models/legacy-type-guards';
import {
  validateLegacyRecord,
  hasErrorIssues,
  groupIssuesBySeverity,
  ValidationIssue,
} from '../../models/legacy-validators';
import {
  CommonFieldsComponent,
  CommonFieldsData,
} from '../model-fields/common-fields/common-fields.component';
import {
  StableDiffusionFieldsComponent,
  StableDiffusionFieldsData,
} from '../model-fields/stable-diffusion-fields/stable-diffusion-fields.component';
import {
  TextGenerationFieldsComponent,
  TextGenerationFieldsData,
} from '../model-fields/text-generation-fields/text-generation-fields.component';
import {
  ClipFieldsComponent,
  ClipFieldsData,
} from '../model-fields/clip-fields/clip-fields.component';
import { ConfigFormSectionComponent } from '../form-fields/config-form-section/config-form-section.component';

@Component({
  selector: 'app-model-form',
  imports: [
    ReactiveFormsModule,
    CommonFieldsComponent,
    StableDiffusionFieldsComponent,
    TextGenerationFieldsComponent,
    ClipFieldsComponent,
    ConfigFormSectionComponent,
  ],
  templateUrl: './model-form.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ModelFormComponent implements OnInit {
  private readonly api = inject(ModelReferenceApiService);
  private readonly notification = inject(NotificationService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly fb = inject(FormBuilder);

  readonly category = signal<string>('');
  readonly modelName = signal<string | null>(null);
  readonly isEditMode = signal(false);
  readonly loading = signal(false);
  readonly submitting = signal(false);
  readonly validationIssues = signal<ValidationIssue[]>([]);
  readonly viewMode = signal<'form' | 'json'>('form');

  readonly commonData = signal<CommonFieldsData>({});
  readonly stableDiffusionData = signal<StableDiffusionFieldsData>({
    inpainting: false,
    baseline: 'stable_diffusion_1',
  });
  readonly textGenerationData = signal<TextGenerationFieldsData>({});
  readonly clipData = signal<ClipFieldsData>({});
  readonly configData = signal<LegacyConfig | null>(null);

  readonly isImageGeneration = computed(() => this.category() === 'image_generation');
  readonly isTextGeneration = computed(() => this.category() === 'text_generation');
  readonly isClip = computed(() => this.category() === 'clip');

  readonly groupedIssues = computed(() => groupIssuesBySeverity(this.validationIssues()));
  readonly hasErrors = computed(() => hasErrorIssues(this.validationIssues()));

  form!: FormGroup;

  ngOnInit(): void {
    this.route.params.subscribe((params) => {
      this.category.set(params['category']);
      const modelName = params['modelName'];

      if (modelName) {
        this.isEditMode.set(true);
        this.modelName.set(modelName);
        this.initFormForEdit(modelName);
      } else {
        this.isEditMode.set(false);
        this.initFormForCreate();
      }
    });
  }

  cancel(): void {
    this.router.navigate(['/categories', this.category()]);
  }

  validateJson(): void {
    try {
      const jsonData = JSON.parse(this.form.value.jsonData);
      const modelName = this.form.value.name || 'new-model';
      const modelData: LegacyRecordUnion = { name: modelName, ...jsonData };

      const issues = validateLegacyRecord(modelData);
      this.validationIssues.set(issues);
    } catch (error) {
      this.validationIssues.set([
        {
          message: 'Invalid JSON format',
          severity: 'error',
        },
      ]);
    }
  }

  toggleViewMode(): void {
    const currentMode = this.viewMode();
    if (currentMode === 'form') {
      this.syncFormToJson();
      this.viewMode.set('json');
    } else {
      this.syncJsonToForm();
      this.viewMode.set('form');
    }
  }

  syncFormToJson(): void {
    const modelData = this.buildModelDataFromForm();
    const { name, ...jsonData } = modelData;
    this.form.patchValue({
      jsonData: JSON.stringify(jsonData, null, 2),
    });
    this.validateJson();
  }

  syncJsonToForm(): void {
    try {
      const jsonData = JSON.parse(this.form.value.jsonData);
      const modelName = this.form.value.name || 'new-model';
      const modelData: LegacyRecordUnion = { name: modelName, ...jsonData };
      this.populateFormFromModel(modelData);
    } catch (error) {
      this.notification.error('Invalid JSON format - cannot switch to form view');
      this.viewMode.set('json');
    }
  }

  buildModelDataFromForm(): LegacyRecordUnion {
    const modelName = this.form.value.name;
    const config = this.configData();
    const base: LegacyRecordUnion = {
      name: modelName,
      ...this.commonData(),
      config: config !== null ? config : undefined,
    };

    if (this.isImageGeneration()) {
      return { ...base, ...this.stableDiffusionData() };
    } else if (this.isTextGeneration()) {
      return { ...base, ...this.textGenerationData() };
    } else if (this.isClip()) {
      return { ...base, ...this.clipData() };
    }

    return base;
  }

  populateFormFromModel(model: LegacyRecordUnion): void {
    const common: CommonFieldsData = {
      description: model.description,
      type: model.type,
      version: model.version,
      style: model.style,
      nsfw: model.nsfw,
      download_all: model.download_all,
      available: model.available,
      features_not_supported: model.features_not_supported,
    };
    this.commonData.set(common);

    if (model.config) {
      this.configData.set(model.config);
    }

    if (this.isImageGeneration() && isLegacyStableDiffusionRecord(model)) {
      const sdData: StableDiffusionFieldsData = {
        inpainting: model.inpainting,
        baseline: model.baseline,
        tags: model.tags,
        showcases: model.showcases,
        min_bridge_version: model.min_bridge_version,
        trigger: model.trigger,
        homepage: model.homepage,
        size_on_disk_bytes: model.size_on_disk_bytes,
        optimization: model.optimization,
        requirements: model.requirements,
      };
      this.stableDiffusionData.set(sdData);
    } else if (this.isTextGeneration() && isLegacyTextGenerationRecord(model)) {
      const tgData: TextGenerationFieldsData = {
        parameters: model.parameters,
        model_name: model.model_name,
        baseline: model.baseline,
        display_name: model.display_name,
        url: model.url,
        tags: model.tags,
        settings: model.settings,
      };
      this.textGenerationData.set(tgData);
    } else if (this.isClip() && isLegacyClipRecord(model)) {
      const clipData: ClipFieldsData = {
        pretrained_name: model.pretrained_name,
      };
      this.clipData.set(clipData);
    }
  }

  onCommonDataChange(data: CommonFieldsData): void {
    this.commonData.set(data);
    if (this.viewMode() === 'form') {
      const modelData = this.buildModelDataFromForm();
      const issues = validateLegacyRecord(modelData);
      this.validationIssues.set(issues);
    }
  }

  onStableDiffusionDataChange(data: StableDiffusionFieldsData): void {
    this.stableDiffusionData.set(data);
    if (this.viewMode() === 'form') {
      const modelData = this.buildModelDataFromForm();
      const issues = validateLegacyRecord(modelData);
      this.validationIssues.set(issues);
    }
  }

  onTextGenerationDataChange(data: TextGenerationFieldsData): void {
    this.textGenerationData.set(data);
    if (this.viewMode() === 'form') {
      const modelData = this.buildModelDataFromForm();
      const issues = validateLegacyRecord(modelData);
      this.validationIssues.set(issues);
    }
  }

  onClipDataChange(data: ClipFieldsData): void {
    this.clipData.set(data);
    if (this.viewMode() === 'form') {
      const modelData = this.buildModelDataFromForm();
      const issues = validateLegacyRecord(modelData);
      this.validationIssues.set(issues);
    }
  }

  onConfigDataChange(data: LegacyConfig | null): void {
    this.configData.set(data);
    if (this.viewMode() === 'form') {
      const modelData = this.buildModelDataFromForm();
      const issues = validateLegacyRecord(modelData);
      this.validationIssues.set(issues);
    }
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const modelName = this.form.value.name;
    let modelData: LegacyRecordUnion;

    if (this.viewMode() === 'form') {
      modelData = this.buildModelDataFromForm();
    } else {
      try {
        const jsonData = JSON.parse(this.form.value.jsonData);
        modelData = { name: modelName, ...jsonData };
      } catch (error) {
        this.notification.error('Invalid JSON format');
        return;
      }
    }

    const issues = validateLegacyRecord(modelData);
    this.validationIssues.set(issues);

    if (hasErrorIssues(issues)) {
      this.notification.error('Please fix validation errors before submitting');
      return;
    }

    this.submitting.set(true);

    const operation = this.isEditMode()
      ? this.api.updateLegacyModel(this.category(), modelName, modelData)
      : this.api.createLegacyModel(this.category(), modelName, modelData);

    operation.subscribe({
      next: () => {
        const action = this.isEditMode() ? 'updated' : 'created';
        this.notification.success(`Model "${modelName}" ${action} successfully`);
        this.router.navigate(['/categories', this.category()]);
      },
      error: (error: Error) => {
        this.notification.error(error.message);
        this.submitting.set(false);
      },
    });
  }

  private initFormForCreate(): void {
    const category = this.category() as ModelReferenceCategory;
    const defaultRecord = createDefaultRecordForCategory(category, 'new-model');
    const { name, ...jsonData } = defaultRecord;

    this.form = this.fb.group({
      name: ['', [Validators.required, Validators.pattern(/^[a-zA-Z0-9_-]+$/)]],
      jsonData: [JSON.stringify(jsonData, null, 2), Validators.required],
    });

    this.form.get('jsonData')?.valueChanges.subscribe(() => {
      if (this.viewMode() === 'json') {
        this.validateJson();
      }
    });

    this.populateFormFromModel(defaultRecord);
    this.validateJson();
  }

  private initFormForEdit(modelName: string): void {
    this.loading.set(true);

    this.api.getLegacyModelsInCategory(this.category()).subscribe({
      next: (response) => {
        const model = response[modelName];
        if (!model) {
          this.notification.error(`Model "${modelName}" not found`);
          this.router.navigate(['/categories', this.category()]);
          return;
        }

        const { name, ...jsonData } = model;

        this.form = this.fb.group({
          name: [{ value: name, disabled: true }, Validators.required],
          jsonData: [JSON.stringify(jsonData, null, 2), Validators.required],
        });

        this.form.get('jsonData')?.valueChanges.subscribe(() => {
          if (this.viewMode() === 'json') {
            this.validateJson();
          }
        });

        this.populateFormFromModel(model);
        this.validateJson();
        this.loading.set(false);
      },
      error: (error: Error) => {
        this.notification.error(error.message);
        this.router.navigate(['/categories', this.category()]);
      },
    });
  }
}
