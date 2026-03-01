import {
  Component,
  inject,
  OnInit,
  signal,
  computed,
  ChangeDetectionStrategy,
  DestroyRef,
  effect,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { forkJoin, Observable, of } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { ModelReferenceApiService } from '../../services/model-reference-api.service';
import { NotificationService } from '../../services/notification.service';
import { ModelValidationService } from '../../services/model-validation.service';
import { LegacyRecordUnion, LegacyConfig, ModelReferenceCategory } from '../../models/api.models';
import { createDefaultRecordForCategory } from '../../models/legacy-type-guards';
import { type ValidationIssue } from '../../models/legacy-validators';
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
import {
  ControlNetFieldsComponent,
  ControlNetFieldsData,
} from '../model-fields/controlnet-fields/controlnet-fields.component';
import { ConfigFormSectionSimplifiedComponent } from '../form-fields/config-form-section/config-form-section-simplified.component';
import {
  parseTextModelName,
  buildTextModelName,
  getModelNameVariations,
  extractBackends,
  TextBackend,
} from '../../models/text-model-name';
import { DownloadRecord, MODEL_REFERENCE_CATEGORY } from '../../api-client';
import { FormModelData, formToLegacyApi, legacyApiToForm } from '../../adapters/model-format-adapter';
import { JsonEditorComponent } from '../common/json-editor.component';

@Component({
  selector: 'app-model-form',
  imports: [
    ReactiveFormsModule,
    CommonFieldsComponent,
    StableDiffusionFieldsComponent,
    TextGenerationFieldsComponent,
    ClipFieldsComponent,
    ControlNetFieldsComponent,
    ConfigFormSectionSimplifiedComponent,
    JsonEditorComponent,
  ],
  templateUrl: './model-form.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ModelFormComponent implements OnInit {
  private readonly api = inject(ModelReferenceApiService);
  private readonly notification = inject(NotificationService);
  private readonly validationService = inject(ModelValidationService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);

  readonly category = signal<ModelReferenceCategory | ''>('');
  readonly modelName = signal<string | null>(null);
  readonly isEditMode = signal(false);
  readonly loading = signal(false);
  readonly submitting = signal(false);
  readonly validationIssues = signal<ValidationIssue[]>([]);
  // Store config-specific validation errors (e.g., unverified URLs)
  private readonly configValidationErrors = signal<string[]>([]);
  readonly viewMode = signal<'form' | 'json'>('form');

  readonly commonData = signal<CommonFieldsData>({ nsfw: false });
  readonly stableDiffusionData = signal<StableDiffusionFieldsData>({
    inpainting: false,
    baseline: 'stable_diffusion_1',
  });
  readonly textGenerationData = signal<TextGenerationFieldsData>({});
  readonly clipData = signal<ClipFieldsData>({});
  readonly controlnetData = signal<ControlNetFieldsData>({ controlnet_style: '' });
  // Store simplified download records for form editing
  readonly simplifiedDownloads = signal<DownloadRecord[]>([]);
  // Store legacy files array to preserve when converting back
  private readonly legacyFiles = signal<LegacyConfig['files']>([]);
  private readonly formNameValue = signal<string>('');
  private readonly jsonDataText = signal<string>('');
  // Track original form model state for edit-mode delta computation
  private readonly originalFormData = signal<FormModelData | null>(null);
  private readonly initialFormData = signal<FormModelData | null>(null);
  // Preserve loaded FormModelData for format-aware round-trip
  private readonly loadedFormModel = signal<FormModelData | null>(null);

  readonly isImageGeneration = computed(() => this.category() === 'image_generation');
  readonly isTextGeneration = computed(() => this.category() === 'text_generation');
  readonly isClip = computed(() => this.category() === 'clip');
  readonly isControlnet = computed(() => this.category() === 'controlnet');
  readonly canonicalFormat = computed(() => this.api.backendCapabilities().canonicalFormat);

  readonly groupedIssues = computed(() => {
    const backendIssues = this.validationIssues();
    const configErrors = this.configValidationErrors();
    const serverErrors = this.validationService.serverErrors();

    // Convert config errors to ValidationIssue format
    const configIssues: ValidationIssue[] = configErrors.map((error) => ({
      severity: 'error' as const,
      field: 'config.download',
      message: error,
    }));

    // Convert server errors to ValidationIssue format
    const serverIssues: ValidationIssue[] = serverErrors.map((error) => ({
      severity: 'error' as const,
      field: error.path,
      message: error.message,
    }));

    return this.validationService.analyzeIssues([
      ...backendIssues,
      ...configIssues,
      ...serverIssues,
    ]);
  });
  readonly hasErrors = computed(() => {
    const backendIssues = this.validationIssues();
    const configErrors = this.configValidationErrors();
    const serverErrors = this.validationService.serverErrors();
    const analysis = this.validationService.analyzeIssues(backendIssues);
    return analysis.hasErrors || configErrors.length > 0 || serverErrors.length > 0;
  });

  /**
   * For text generation models, compute the model variations based on selected backends.
   * Returns FormModelData for each variation with the appropriate name.
   */
  readonly modelVariations = computed<{ name: string; data: FormModelData }[]>(() => {
    if (!this.isTextGeneration()) {
      return [];
    }

    const baseModelName = this.formNameValue();
    if (!baseModelName) {
      return [];
    }

    const selectedBackends = this.textGenerationData().selectedBackends || [];

    let baseFormData: FormModelData | null;
    if (this.viewMode() === 'json') {
      const jsonModel = this.buildModelDataFromJson(baseModelName);
      if (!jsonModel) return [];
      baseFormData = legacyApiToForm(jsonModel, this.category() as MODEL_REFERENCE_CATEGORY);
    } else {
      baseFormData = this.buildFormModelData();
    }

    const variations: { name: string; data: FormModelData }[] = [];

    // Always include base model (without backend prefix)
    variations.push({
      name: baseModelName,
      data: baseFormData,
    });

    // Add variation for each selected backend
    for (const backend of selectedBackends) {
      const variantName = buildTextModelName({
        backend,
        ...parseTextModelName(baseModelName),
      });
      variations.push({
        name: variantName,
        data: baseFormData,
      });
    }

    return variations;
  });

  /**
   * For text generation in JSON view, get the exploded variations (backend-prefixed models only)
   * to display in a read-only preview section
   */
  readonly explodedVariationsJson = computed<string | null>(() => {
    if (!this.isTextGeneration()) {
      return null;
    }

    const variations = this.modelVariations();
    if (variations.length <= 1) {
      return null;
    }

    const category = this.category() as MODEL_REFERENCE_CATEGORY;
    const explodedVariations = variations.slice(1).map((v) => {
      const legacyRecord = formToLegacyApi(v.data, v.name, category);
      const { name: _name, ...jsonData } = legacyRecord;
      void _name;
      return { name: v.name, ...jsonData };
    });

    return JSON.stringify(explodedVariations, null, 2);
  });

  form!: FormGroup;

  constructor() {
    // Automatically sync form data to JSON view when signals change
    effect(() => {
      // Track all relevant signals
      this.commonData();
      this.stableDiffusionData();
      this.textGenerationData();
      this.clipData();
      this.controlnetData();
      this.simplifiedDownloads();

      // Only sync if in JSON view mode and form exists
      if (this.viewMode() === 'json' && this.form) {
        this.syncFormToJsonSilent();
      }
    });
  }

  ngOnInit(): void {
    this.route.params.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      this.category.set(params['category']);
      const modelName = params['modelName'];

      if (modelName) {
        this.isEditMode.set(true);
        this.modelName.set(modelName);
        this.initFormForEdit(modelName);
      } else {
        this.isEditMode.set(false);
        const nav = this.router.getCurrentNavigation();
        const prefill = nav?.extras?.state?.['prefill'] as Record<string, unknown> | undefined;
        const prefillName = nav?.extras?.state?.['modelName'] as string | undefined;
        this.initFormForCreate(prefill, prefillName);
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

    // Trigger validation after backend change
    if (this.viewMode() === 'form') {
      setTimeout(() => {
        const modelData = this.buildModelDataFromForm(this.formNameValue());
        const issues = this.validationService.validateRecord(modelData, this.canonicalFormat());
        this.validationIssues.set(issues);
      }, 0);
    }
  }

  getVariationNames(): string {
    return this.modelVariations()
      .map((v) => v.name)
      .join(', ');
  }

  validateJson(): void {
    try {
      const formValue = this.form.getRawValue();
      const jsonData = JSON.parse(formValue.jsonData);
      const modelName = formValue.name || 'new-model';
      const modelData: LegacyRecordUnion = { name: modelName, ...jsonData };

      const issues = this.validationService.validateRecord(modelData, this.canonicalFormat());
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

  /**
   * Gets the parsed JSON data for syntax-highlighted display
   * Returns null if the JSON is invalid
   */
  getParsedJsonData(): unknown {
    try {
      const formValue = this.form.getRawValue();
      return JSON.parse(formValue.jsonData);
    } catch {
      return null;
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

  /**
   * Syncs form data to JSON format and updates the jsonData control
   * This is a silent version that doesn't trigger validation
   */
  private syncFormToJsonSilent(): void {
    // For text generation, always show only the base (ungrouped) model data
    // Exploded variations are shown in a separate read-only section
    const modelData = this.buildModelDataFromForm(this.formNameValue());
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { name: _name, ...jsonData } = modelData;
    const jsonString = JSON.stringify(jsonData, null, 2);
    this.form.patchValue(
      {
        jsonData: jsonString,
      },
      { emitEvent: false },
    );
    this.jsonDataText.set(jsonString);
  }

  syncFormToJson(): void {
    this.syncFormToJsonSilent();
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
      const formModel = legacyApiToForm(modelData, this.category() as MODEL_REFERENCE_CATEGORY);
      this.populateFormFromFormModel(formModel);

      // Restore preserved UI state
      if (this.isTextGeneration() && preservedBackends) {
        const currentData = this.textGenerationData();
        this.textGenerationData.set({
          ...currentData,
          selectedBackends: preservedBackends,
        });
      }

      // Validate after a microtask to ensure all signals have propagated through child components
      setTimeout(() => {
        const modelData = this.buildModelDataFromForm(this.formNameValue());
        const issues = this.validationService.validateRecord(modelData, this.canonicalFormat());
        this.validationIssues.set(issues);
      }, 0);
    } catch {
      this.notification.error('Invalid JSON format - cannot switch to form view');
      this.viewMode.set('json');
    }
  }

  private buildModelDataFromJson(baseModelName: string): LegacyRecordUnion | null {
    const jsonSource = this.jsonDataText();
    if (!jsonSource.trim()) {
      return null;
    }

    try {
      const jsonData = JSON.parse(jsonSource) as Record<string, unknown>;
      return { name: baseModelName, ...jsonData } as LegacyRecordUnion;
    } catch {
      return null;
    }
  }

  /**
   * Build format-agnostic FormModelData from current form signals.
   * This is the primary data assembly method — components produce FormModelData,
   * and adapters convert to the API-specific shape at submission time.
   */
  buildFormModelData(): FormModelData {
    const category = this.category() as MODEL_REFERENCE_CATEGORY;
    const commonData = this.commonData();
    const downloads = this.simplifiedDownloads();
    const legacyFiles = this.legacyFiles() ?? [];

    let categoryData: FormModelData['categoryData'];
    if (this.isImageGeneration()) {
      categoryData = { kind: 'image_generation', data: this.stableDiffusionData() };
    } else if (this.isTextGeneration()) {
      categoryData = { kind: 'text_generation', data: this.textGenerationData() };
    } else if (this.isClip()) {
      categoryData = { kind: 'clip', data: this.clipData() };
    } else if (this.isControlnet()) {
      categoryData = { kind: 'controlnet', data: this.controlnetData() };
    } else {
      categoryData = { kind: 'generic', data: null };
    }

    // Preserve V2 fields from loaded model when editing in V2 mode
    const loaded = this.loadedFormModel();
    const v2Fields = loaded?.v2Fields ?? null;
    // Sync model_classification and finetune_series back from common fields if they were edited
    const resolvedV2Fields = v2Fields
      ? {
        ...v2Fields,
        modelClassification: commonData.modelClassification ?? v2Fields.modelClassification,
        finetuneSeries: commonData.finetuneSeries ?? v2Fields.finetuneSeries,
      }
      : null;

    // Ensure record_type is set for V2 round-trip
    void category;

    return {
      commonData,
      categoryData,
      downloads,
      legacyFiles,
      v2Fields: resolvedV2Fields,
    };
  }

  /**
   * Build a legacy-format record from form signals.
   * Used for JSON view serialization and legacy validation.
   */
  buildModelDataFromForm(modelName: string): LegacyRecordUnion {
    const formData = this.buildFormModelData();
    return formToLegacyApi(formData, modelName, this.category() as MODEL_REFERENCE_CATEGORY);
  }

  /**
   * Build an edit delta by comparing FormModelData snapshots.
   * Only fields that changed between initial and current form state are included
   * in the resulting FormModelData, preventing phantom diffs from form defaults.
   */
  private buildFormEditDelta(
    original: FormModelData,
    initialForm: FormModelData,
    currentForm: FormModelData,
  ): FormModelData {
    const result = structuredClone(original);

    // Compare common data fields individually
    for (const [key, currentVal] of Object.entries(currentForm.commonData)) {
      const initialVal = initialForm.commonData[key as keyof CommonFieldsData];
      if (JSON.stringify(currentVal) !== JSON.stringify(initialVal)) {
        Object.assign(result.commonData, { [key]: currentVal });
      }
    }

    // Compare downloads
    if (JSON.stringify(currentForm.downloads) !== JSON.stringify(initialForm.downloads)) {
      result.downloads = currentForm.downloads;
    }

    // Compare legacy files
    if (JSON.stringify(currentForm.legacyFiles) !== JSON.stringify(initialForm.legacyFiles)) {
      result.legacyFiles = currentForm.legacyFiles;
    }

    // Compare category data
    if (JSON.stringify(currentForm.categoryData) !== JSON.stringify(initialForm.categoryData)) {
      result.categoryData = currentForm.categoryData;
    }

    // Always use current V2 fields
    result.v2Fields = currentForm.v2Fields;

    return result;
  }

  private setupFormValueTracking(): void {
    const nameControl = this.form.get('name');
    const jsonControl = this.form.get('jsonData');

    const currentName = (nameControl?.value ?? '') as string;
    const currentJson = (jsonControl?.value ?? '') as string;

    this.formNameValue.set(currentName);
    this.jsonDataText.set(currentJson);

    nameControl?.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((value) => this.formNameValue.set((value ?? '') as string));

    jsonControl?.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((value) => this.jsonDataText.set((value ?? '') as string));
  }

  onCommonDataChange(data: CommonFieldsData): void {
    this.commonData.set(data);
    if (this.viewMode() === 'form') {
      // Use setTimeout to ensure signal has propagated through all computed dependencies
      setTimeout(() => {
        const modelData = this.buildModelDataFromForm(this.formNameValue());
        const issues = this.validationService.validateRecord(modelData, this.canonicalFormat());
        this.validationIssues.set(issues);
      }, 0);
    }
  }

  onStableDiffusionDataChange(data: StableDiffusionFieldsData): void {
    this.stableDiffusionData.set(data);
    if (this.viewMode() === 'form') {
      // Use setTimeout to ensure signal has propagated through all computed dependencies
      setTimeout(() => {
        const modelData = this.buildModelDataFromForm(this.formNameValue());
        const issues = this.validationService.validateRecord(modelData, this.canonicalFormat());
        this.validationIssues.set(issues);
      }, 0);
    }
  }

  onTextGenerationDataChange(data: TextGenerationFieldsData): void {
    this.textGenerationData.set(data);
    if (this.viewMode() === 'form') {
      // Use setTimeout to ensure signal has propagated through all computed dependencies
      setTimeout(() => {
        const modelData = this.buildModelDataFromForm(this.formNameValue());
        const issues = this.validationService.validateRecord(modelData, this.canonicalFormat());
        this.validationIssues.set(issues);
      }, 0);
    }
  }

  onClipDataChange(data: ClipFieldsData): void {
    this.clipData.set(data);
    if (this.viewMode() === 'form') {
      // Use setTimeout to ensure signal has propagated through all computed dependencies
      setTimeout(() => {
        const modelData = this.buildModelDataFromForm(this.formNameValue());
        const issues = this.validationService.validateRecord(modelData, this.canonicalFormat());
        this.validationIssues.set(issues);
      }, 0);
    }
  }

  onControlnetDataChange(data: ControlNetFieldsData): void {
    this.controlnetData.set(data);
    if (this.viewMode() === 'form') {
      setTimeout(() => {
        const modelData = this.buildModelDataFromForm(this.formNameValue());
        const issues = this.validationService.validateRecord(modelData, this.canonicalFormat());
        this.validationIssues.set(issues);
      }, 0);
    }
  }

  onSimplifiedDownloadsChange(data: DownloadRecord[]): void {
    this.simplifiedDownloads.set(data);
    if (this.viewMode() === 'form') {
      // Use setTimeout to ensure signal has propagated through all computed dependencies
      setTimeout(() => {
        const modelData = this.buildModelDataFromForm(this.formNameValue());
        const issues = this.validationService.validateRecord(modelData, this.canonicalFormat());
        this.validationIssues.set(issues);
      }, 0);
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
    const category = this.category() as ModelReferenceCategory;

    // Build submission data — format-native when using form view, legacy for JSON view
    let formData: FormModelData;

    if (this.viewMode() === 'form') {
      const currentFormData = this.buildFormModelData();
      const original = this.originalFormData();
      const initial = this.initialFormData();

      if (this.isEditMode() && original && initial) {
        formData = this.buildFormEditDelta(original, initial, currentFormData);
      } else {
        formData = currentFormData;
      }
    } else {
      // JSON view: parse as legacy, convert through adapter
      try {
        const jsonData = JSON.parse(formValue.jsonData);
        const legacyModel: LegacyRecordUnion = { name: modelName, ...jsonData };
        formData = legacyApiToForm(legacyModel, category as MODEL_REFERENCE_CATEGORY);
      } catch {
        this.notification.error('Invalid JSON format');
        return;
      }
    }

    // Validate via legacy representation (validator expects LegacyRecordUnion)
    const legacyForValidation = formToLegacyApi(formData, modelName, category as MODEL_REFERENCE_CATEGORY);

    this.validationService.clearServerErrors();
    const issues = this.validationService.validateRecord(legacyForValidation, this.canonicalFormat());
    this.validationIssues.set(issues);

    const analysis = this.validationService.analyzeIssues(issues);
    if (analysis.hasErrors) {
      this.notification.error('Please fix validation errors before submitting');
      return;
    }

    this.submitting.set(true);

    const operation = this.isEditMode()
      ? this.api.updateModel(this.category(), modelName, formData)
      : this.api.createModel(this.category(), modelName, formData);

    operation.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
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
    const categoryEnum = category as MODEL_REFERENCE_CATEGORY;

    this.validationService.clearServerErrors();

    // Validate all variations via legacy representation
    const allIssues: ValidationIssue[] = [];
    for (const variation of variations) {
      const legacyForValidation = formToLegacyApi(variation.data, variation.name, categoryEnum);
      const issues = this.validationService.validateRecord(legacyForValidation, this.canonicalFormat());
      allIssues.push(...issues);
    }

    this.validationIssues.set(allIssues);

    const analysis = this.validationService.analyzeIssues(allIssues);
    if (analysis.hasErrors) {
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

  private createAllVariations(variations: { name: string; data: FormModelData }[]): void {
    const category = this.category() as ModelReferenceCategory;
    const operations: Observable<unknown>[] = variations.map((variation) =>
      this.api.createModel(category, variation.name, variation.data),
    );

    forkJoin(operations)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
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
    newVariations: { name: string; data: FormModelData }[],
  ): void {
    const category = this.category() as ModelReferenceCategory;
    const baseModelName = this.form.getRawValue().name;

    this.api
      .getLegacyModelsInCategory(category)
      .pipe(
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
            if (existingNames.has(variation.name)) {
              operations.push(
                this.api.updateModel(category, variation.name, variation.data),
              );
            } else {
              operations.push(
                this.api.createModel(category, variation.name, variation.data),
              );
            }
          }

          return operations.length > 0 ? forkJoin(operations) : of([]);
        }),
      )
      .subscribe({
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

  private initFormForCreate(
    prefill?: Record<string, unknown>,
    prefillName?: string,
  ): void {
    const category = this.category() as ModelReferenceCategory;
    const record = prefill
      ? ({ name: prefillName ?? 'new-model', ...prefill } as LegacyRecordUnion)
      : createDefaultRecordForCategory(category, 'new-model');
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { name: _name, ...jsonData } = record;

    this.form = this.fb.group({
      name: [prefillName ?? '', [Validators.required, Validators.pattern(/^[a-zA-Z0-9_-]+$/)]],
      jsonData: [JSON.stringify(jsonData, null, 2), Validators.required],
    });

    this.form.get('jsonData')?.valueChanges.subscribe(() => {
      if (this.viewMode() === 'json') {
        this.validateJson();
      }
    });

    this.setupFormValueTracking();

    const formModel = legacyApiToForm(record, category as MODEL_REFERENCE_CATEGORY);
    this.populateFormFromFormModel(formModel);

    // For text generation, select all backends by default
    if (this.isTextGeneration()) {
      const tgData = this.textGenerationData();
      this.textGenerationData.set({
        ...tgData,
        selectedBackends: [TextBackend.Aphrodite, TextBackend.KoboldCpp],
      });
    }

    // Delay validation to allow signals to propagate
    setTimeout(() => this.validateJson(), 0);
  }

  private initFormForEdit(modelName: string): void {
    this.loading.set(true);

    this.api
      .getFormModelsInCategory(this.category())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
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

  private initFormForEditSingle(
    modelName: string,
    response: Record<string, FormModelData>,
  ): void {
    const formModel = response[modelName];
    if (!formModel) {
      this.notification.error(`Model "${modelName}" not found`);
      this.router.navigate(['/categories', this.category()]);
      return;
    }

    this.form = this.fb.group({
      name: [{ value: modelName, disabled: true }, Validators.required],
      jsonData: ['', Validators.required],
    });

    this.form.get('jsonData')?.valueChanges.subscribe(() => {
      if (this.viewMode() === 'json') {
        this.validateJson();
      }
    });

    this.setupFormValueTracking();
    this.populateFormFromFormModel(formModel);
    this.loadedFormModel.set(formModel);

    // Store FormModelData snapshots for edit-mode delta computation
    const currentFormData = this.buildFormModelData();
    this.originalFormData.set(structuredClone(currentFormData));
    this.initialFormData.set(structuredClone(currentFormData));
    this.syncFormToJsonSilent();

    // Delay validation to allow signals to propagate
    setTimeout(() => {
      this.validateJson();
      this.loading.set(false);
    }, 0);
  }

  private initFormForEditTextGeneration(
    modelName: string,
    response: Record<string, FormModelData>,
  ): void {
    // Find all variations of this model (with different backend prefixes)
    const parsed = parseTextModelName(modelName);
    const baseModelName = buildTextModelName({
      author: parsed.author,
      modelName: parsed.modelName,
    });

    // Find all variations (models with same base name but different backends)
    const variations = getModelNameVariations(modelName);
    const existingVariations = Object.keys(response).filter((name) => variations.includes(name));

    if (existingVariations.length === 0) {
      this.notification.error(`Model "${modelName}" not found`);
      this.router.navigate(['/categories', this.category()]);
      return;
    }

    // Use the first variation as the primary model data
    const primaryModelName = existingVariations.includes(modelName) ? modelName : existingVariations[0];
    const primaryModel = response[primaryModelName];
    if (!primaryModel) {
      this.notification.error(`Model "${modelName}" not found`);
      this.router.navigate(['/categories', this.category()]);
      return;
    }

    // Detect which backends currently exist
    const existingBackends = extractBackends(existingVariations);

    this.form = this.fb.group({
      name: [{ value: baseModelName, disabled: true }, Validators.required],
      jsonData: ['', Validators.required],
    });

    this.form.get('jsonData')?.valueChanges.subscribe(() => {
      if (this.viewMode() === 'json') {
        this.validateJson();
      }
    });

    this.setupFormValueTracking();

    this.populateFormFromFormModel(primaryModel);
    this.loadedFormModel.set(primaryModel);
    this.originalFormData.set(structuredClone(this.buildFormModelData()));

    // Set the existing backends as selected
    if (primaryModel.categoryData.kind === 'text_generation') {
      const tgData = this.textGenerationData();
      this.textGenerationData.set({
        ...tgData,
        selectedBackends: existingBackends,
      });
    }

    this.initialFormData.set(structuredClone(this.buildFormModelData()));
    this.syncFormToJsonSilent();

    // Delay validation to allow signals to propagate
    setTimeout(() => {
      this.validateJson();
      this.loading.set(false);
    }, 0);
  }

  private populateFormFromFormModel(model: FormModelData): void {
    const common = { ...model.commonData };
    if (model.v2Fields) {
      common.modelClassification = model.v2Fields.modelClassification ?? null;
      common.finetuneSeries = model.v2Fields.finetuneSeries ?? null;
    }
    this.commonData.set(common);
    this.simplifiedDownloads.set(model.downloads);
    this.legacyFiles.set(model.legacyFiles);

    if (model.categoryData.kind === 'image_generation') {
      this.stableDiffusionData.set(model.categoryData.data);
    } else if (model.categoryData.kind === 'text_generation') {
      this.textGenerationData.set(model.categoryData.data);
    } else if (model.categoryData.kind === 'clip') {
      this.clipData.set(model.categoryData.data);
    } else if (model.categoryData.kind === 'controlnet') {
      this.controlnetData.set(model.categoryData.data);
    }
  }
}
