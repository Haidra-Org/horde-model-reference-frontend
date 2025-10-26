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
import { forkJoin, Observable, of } from 'rxjs';
import { switchMap } from 'rxjs/operators';
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
import { applyFixedFields } from '../../models/legacy-fixed-fields.config';
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
import { ConfigFormSectionSimplifiedComponent } from '../form-fields/config-form-section/config-form-section-simplified.component';
import {
  parseTextModelName,
  buildTextModelName,
  getModelNameVariations,
  extractBackends,
  TextBackend,
} from '../../models/text-model-name';
import { DownloadRecord } from '../../api-client';
import {
  legacyConfigToSimplified,
  simplifiedToLegacyConfig,
} from '../../utils/config-converter';

@Component({
  selector: 'app-model-form',
  imports: [
    ReactiveFormsModule,
    CommonFieldsComponent,
    StableDiffusionFieldsComponent,
    TextGenerationFieldsComponent,
    ClipFieldsComponent,
    ConfigFormSectionSimplifiedComponent,
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

  readonly category = signal<ModelReferenceCategory | ''>('');
  readonly modelName = signal<string | null>(null);
  readonly isEditMode = signal(false);
  readonly loading = signal(false);
  readonly submitting = signal(false);
  readonly validationIssues = signal<ValidationIssue[]>([]);
  // Store config-specific validation errors (e.g., unverified URLs)
  private readonly configValidationErrors = signal<string[]>([]);
  readonly viewMode = signal<'form' | 'json'>('form');

  readonly commonData = signal<CommonFieldsData>({});
  readonly stableDiffusionData = signal<StableDiffusionFieldsData>({
    inpainting: false,
    baseline: 'stable_diffusion_1',
  });
  readonly textGenerationData = signal<TextGenerationFieldsData>({});
  readonly clipData = signal<ClipFieldsData>({});
  // Store simplified download records for form editing
  readonly simplifiedDownloads = signal<DownloadRecord[]>([]);
  // Store legacy files array to preserve when converting back
  private readonly legacyFiles = signal<LegacyConfig['files']>([]);

  readonly isImageGeneration = computed(() => this.category() === 'image_generation');
  readonly isTextGeneration = computed(() => this.category() === 'text_generation');
  readonly isClip = computed(() => this.category() === 'clip');

  readonly groupedIssues = computed(() => {
    const backendIssues = this.validationIssues();
    const configErrors = this.configValidationErrors();

    // Convert config errors to ValidationIssue format
    const configIssues: ValidationIssue[] = configErrors.map(error => ({
      severity: 'error' as const,
      field: 'config.download',
      message: error,
    }));

    return groupIssuesBySeverity([...backendIssues, ...configIssues]);
  });
  readonly hasErrors = computed(() => {
    const backendIssues = this.validationIssues();
    const configErrors = this.configValidationErrors();
    return hasErrorIssues(backendIssues) || configErrors.length > 0;
  });

  /**
   * For text generation models, compute the model variations based on selected backends
   */
  readonly modelVariations = computed<{ name: string; data: LegacyRecordUnion }[]>(() => {
    if (!this.isTextGeneration()) {
      return [];
    }

    const baseModelName = this.form?.getRawValue().name || '';
    const modelData = this.buildModelDataFromForm();
    const selectedBackends = this.textGenerationData().selectedBackends || [];

    const variations: { name: string; data: LegacyRecordUnion }[] = [];

    // Always include base model (without backend prefix) if no backends selected
    if (selectedBackends.length === 0) {
      variations.push({
        name: baseModelName,
        data: { ...modelData, name: baseModelName },
      });
    } else {
      // Create variation for each selected backend
      for (const backend of selectedBackends) {
        const variantName = buildTextModelName({
          backend,
          ...parseTextModelName(baseModelName),
        });
        variations.push({
          name: variantName,
          data: { ...modelData, name: variantName },
        });
      }
    }

    return variations;
  });

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

  isBackendSelected(backend: string): boolean {
    const selectedBackends = this.textGenerationData().selectedBackends || [];
    return selectedBackends.includes(backend as TextBackend);
  }

  toggleBackend(backend: string): void {
    const currentData = this.textGenerationData();
    const selectedBackends = currentData.selectedBackends || [];
    const backendValue = backend as TextBackend;

    const newBackends = selectedBackends.includes(backendValue)
      ? selectedBackends.filter((b) => b !== backendValue)
      : [...selectedBackends, backendValue];

    this.textGenerationData.set({
      ...currentData,
      selectedBackends: newBackends.length > 0 ? newBackends : undefined,
    });
  }

  getVariationNames(): string {
    return this.modelVariations().map((v) => v.name).join(', ');
  }

  validateJson(): void {
    try {
      const formValue = this.form.getRawValue();
      const jsonData = JSON.parse(formValue.jsonData);
      const modelName = formValue.name || 'new-model';
      const modelData: LegacyRecordUnion = { name: modelName, ...jsonData };

      const issues = validateLegacyRecord(modelData);
      this.validationIssues.set(issues);
    } catch {
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
    if (this.isTextGeneration()) {
      // For text generation with backend selection, show all variations
      const variations = this.modelVariations();
      if (variations.length > 1) {
        const variationsJson = variations.map((v) => {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { name, ...jsonData } = v.data;
          return { name: v.name, ...jsonData };
        });
        this.form.patchValue({
          jsonData: JSON.stringify(variationsJson, null, 2),
        });
      } else {
        const modelData = this.buildModelDataFromForm();
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { name, ...jsonData } = modelData;
        this.form.patchValue({
          jsonData: JSON.stringify(jsonData, null, 2),
        });
      }
    } else {
      const modelData = this.buildModelDataFromForm();
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { name, ...jsonData } = modelData;
      this.form.patchValue({
        jsonData: JSON.stringify(jsonData, null, 2),
      });
    }
    // Delay validation to ensure all signals have propagated
    setTimeout(() => this.validateJson(), 0);
  }

  syncJsonToForm(): void {
    try {
      // Preserve UI-only state before syncing
      const preservedBackends = this.isTextGeneration()
        ? this.textGenerationData().selectedBackends
        : undefined;

      const formValue = this.form.getRawValue();
      const jsonData = JSON.parse(formValue.jsonData);
      const modelName = formValue.name || 'new-model';
      const modelData: LegacyRecordUnion = { name: modelName, ...jsonData };
      this.populateFormFromModel(modelData);

      // Restore preserved UI state
      if (this.isTextGeneration() && preservedBackends) {
        const currentData = this.textGenerationData();
        this.textGenerationData.set({
          ...currentData,
          selectedBackends: preservedBackends,
        });
      }
    } catch {
      this.notification.error('Invalid JSON format - cannot switch to form view');
      this.viewMode.set('json');
    }
  }

  buildModelDataFromForm(): LegacyRecordUnion {
    const modelName = this.form.getRawValue().name;
    // Convert simplified downloads back to legacy config format
    const legacyConfig = simplifiedToLegacyConfig(
      { download: this.simplifiedDownloads() },
      this.legacyFiles(),
    );
    const hasConfig = (legacyConfig.download?.length ?? 0) > 0 || (legacyConfig.files?.length ?? 0) > 0;
    const base: LegacyRecordUnion = {
      name: modelName,
      ...this.commonData(),
      config: hasConfig ? legacyConfig : undefined,
    };

    if (this.isImageGeneration()) {
      return { ...base, ...this.stableDiffusionData() };
    } else if (this.isTextGeneration()) {
      // Exclude selectedBackends from the model data
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { selectedBackends: _selectedBackends, ...textGenData } = this.textGenerationData();
      return { ...base, ...textGenData };
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

    // Convert legacy config to simplified downloads for editing
    if (model.config) {
      const simplified = legacyConfigToSimplified(model.config);
      this.simplifiedDownloads.set(simplified.download);
      // Preserve legacy files array (usually empty in new format)
      this.legacyFiles.set(model.config.files || []);
    } else {
      this.simplifiedDownloads.set([]);
      this.legacyFiles.set([]);
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

  onSimplifiedDownloadsChange(data: DownloadRecord[]): void {
    this.simplifiedDownloads.set(data);
    if (this.viewMode() === 'form') {
      const modelData = this.buildModelDataFromForm();
      const issues = validateLegacyRecord(modelData);
      this.validationIssues.set(issues);
    }
  }

  onConfigValidationErrors(errors: string[]): void {
    this.configValidationErrors.set(errors);
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    // For text generation with backends, handle multiple model creation
    if (this.isTextGeneration() && this.viewMode() === 'form') {
      this.submitTextGenerationWithBackends();
    } else {
      this.submitSingleModel();
    }
  }

  private submitSingleModel(): void {
    const formValue = this.form.getRawValue();
    const modelName = formValue.name;
    let modelData: LegacyRecordUnion;

    if (this.viewMode() === 'form') {
      modelData = this.buildModelDataFromForm();
    } else {
      try {
        const jsonData = JSON.parse(formValue.jsonData);
        modelData = { name: modelName, ...jsonData };
      } catch {
        this.notification.error('Invalid JSON format');
        return;
      }
    }

    // Apply fixed field values for legacy compatibility
    const category = this.category() as ModelReferenceCategory;
    modelData = applyFixedFields(category, modelData) as LegacyRecordUnion;

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

  private submitTextGenerationWithBackends(): void {
    const variations = this.modelVariations();
    const category = this.category() as ModelReferenceCategory;

    // Validate all variations
    const allIssues: ValidationIssue[] = [];
    for (const variation of variations) {
      const modelData = applyFixedFields(category, variation.data) as LegacyRecordUnion;
      const issues = validateLegacyRecord(modelData);
      allIssues.push(...issues);
    }

    this.validationIssues.set(allIssues);

    if (hasErrorIssues(allIssues)) {
      this.notification.error('Please fix validation errors before submitting');
      return;
    }

    this.submitting.set(true);

    if (this.isEditMode()) {
      // In edit mode, we need to:
      // 1. Determine which variations existed before
      // 2. Delete variations that are no longer selected
      // 3. Update existing variations
      // 4. Create new variations
      this.handleEditModeBackendChanges(variations);
    } else {
      // Create mode: just create all variations
      this.createAllVariations(variations);
    }
  }

  private createAllVariations(variations: { name: string; data: LegacyRecordUnion }[]): void {
    const category = this.category() as ModelReferenceCategory;
    const operations: Observable<unknown>[] = variations.map((variation) => {
      const modelData = applyFixedFields(category, variation.data) as LegacyRecordUnion;
      return this.api.createLegacyModel(category, variation.name, modelData);
    });

    forkJoin(operations).subscribe({
      next: () => {
        const count = variations.length;
        this.notification.success(
          `Successfully created ${count} model ${count === 1 ? 'entry' : 'entries'}`,
        );
        this.router.navigate(['/categories', this.category()]);
      },
      error: (error: Error) => {
        this.notification.error(`Failed to create models: ${error.message}`);
        this.submitting.set(false);
      },
    });
  }

  private handleEditModeBackendChanges(
    newVariations: { name: string; data: LegacyRecordUnion }[],
  ): void {
    const category = this.category() as ModelReferenceCategory;
    const baseModelName = this.form.getRawValue().name;

    // First, fetch all existing models to determine what exists
    this.api.getLegacyModelsInCategory(category).pipe(
      switchMap((response) => {
        const allModels = Object.values(response);
        const variations = getModelNameVariations(baseModelName);
        const existingVariations = allModels.filter((m) => variations.includes(m.name));

        const existingNames = new Set(existingVariations.map((v) => v.name));
        const newNames = new Set(newVariations.map((v) => v.name));

        const operations: Observable<unknown>[] = [];

        // Delete variations that no longer exist in selection
        for (const existing of existingVariations) {
          if (!newNames.has(existing.name)) {
            operations.push(this.api.deleteModel(category, existing.name));
          }
        }

        // Update or create variations
        for (const variation of newVariations) {
          const modelData = applyFixedFields(category, variation.data) as LegacyRecordUnion;
          if (existingNames.has(variation.name)) {
            // Update existing
            operations.push(this.api.updateLegacyModel(category, variation.name, modelData));
          } else {
            // Create new
            operations.push(this.api.createLegacyModel(category, variation.name, modelData));
          }
        }

        return operations.length > 0 ? forkJoin(operations) : of([]);
      }),
    ).subscribe({
      next: () => {
        this.notification.success('Successfully updated model variations');
        this.router.navigate(['/categories', this.category()]);
      },
      error: (error: Error) => {
        this.notification.error(`Failed to update models: ${error.message}`);
        this.submitting.set(false);
      },
    });
  }

  private initFormForCreate(): void {
    const category = this.category() as ModelReferenceCategory;
    const defaultRecord = createDefaultRecordForCategory(category, 'new-model');
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { name: _name, ...jsonData } = defaultRecord;

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

    // Delay validation to allow signals to propagate
    setTimeout(() => this.validateJson(), 0);
  }

  private initFormForEdit(modelName: string): void {
    this.loading.set(true);

    this.api.getLegacyModelsInCategory(this.category()).subscribe({
      next: (response) => {
        // For text generation, check if this is a grouped model with backend variations
        if (this.isTextGeneration()) {
          this.initFormForEditTextGeneration(modelName, response);
        } else {
          this.initFormForEditSingle(modelName, response);
        }
      },
      error: (error: Error) => {
        this.notification.error(error.message);
        this.router.navigate(['/categories', this.category()]);
      },
    });
  }

  private initFormForEditSingle(modelName: string, response: Record<string, LegacyRecordUnion>): void {
    const model = response[modelName];
    if (!model) {
      this.notification.error(`Model "${modelName}" not found`);
      this.router.navigate(['/categories', this.category()]);
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { name: _modelName, ...jsonData } = model;

    this.form = this.fb.group({
      name: [{ value: model.name, disabled: true }, Validators.required],
      jsonData: [JSON.stringify(jsonData, null, 2), Validators.required],
    });

    this.form.get('jsonData')?.valueChanges.subscribe(() => {
      if (this.viewMode() === 'json') {
        this.validateJson();
      }
    });

    this.populateFormFromModel(model);

    // Delay validation to allow signals to propagate
    setTimeout(() => {
      this.validateJson();
      this.loading.set(false);
    }, 0);
  }

  private initFormForEditTextGeneration(
    modelName: string,
    response: Record<string, LegacyRecordUnion>,
  ): void {
    // Find all variations of this model (with different backend prefixes)
    const allModels = Object.values(response);
    const parsed = parseTextModelName(modelName);
    const baseModelName = buildTextModelName({
      author: parsed.author,
      modelName: parsed.modelName,
    });

    // Find all variations (models with same base name but different backends)
    const variations = getModelNameVariations(modelName);
    const existingVariations = allModels.filter((m) => variations.includes(m.name));

    if (existingVariations.length === 0) {
      this.notification.error(`Model "${modelName}" not found`);
      this.router.navigate(['/categories', this.category()]);
      return;
    }

    // Use the first variation as the primary model data
    const primaryModel = existingVariations[0];

    // Detect which backends currently exist
    const existingBackends = extractBackends(existingVariations.map((v) => v.name));

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { name: _modelName, ...jsonData } = primaryModel;

    this.form = this.fb.group({
      name: [{ value: baseModelName, disabled: true }, Validators.required],
      jsonData: [JSON.stringify(jsonData, null, 2), Validators.required],
    });

    this.form.get('jsonData')?.valueChanges.subscribe(() => {
      if (this.viewMode() === 'json') {
        this.validateJson();
      }
    });

    this.populateFormFromModel(primaryModel);

    // Set the existing backends as selected
    if (isLegacyTextGenerationRecord(primaryModel)) {
      const tgData = this.textGenerationData();
      this.textGenerationData.set({
        ...tgData,
        selectedBackends: existingBackends,
      });
    }

    // Delay validation to allow signals to propagate
    setTimeout(() => {
      this.validateJson();
      this.loading.set(false);
    }, 0);
  }
}
