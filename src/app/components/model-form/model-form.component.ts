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
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
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
import { DownloadRecord, MODEL_REFERENCE_CATEGORY } from '../../api-client';
import {
  FormModelData,
  formToLegacyApi,
  legacyApiToForm,
} from '../../adapters/model-format-adapter';
import { JsonEditorComponent } from '../common/json-editor.component';
import { FormSectionComponent } from '../form-fields/form-section/form-section.component';
import {
  EditSummaryComponent,
  FieldDiff,
} from '../form-fields/edit-summary/edit-summary.component';
import { PendingQueueSummaryService } from '../../services/pending-queue-summary.service';
import { formatValue } from '../../utils/value-compare';
import { HordeButtonComponent } from '@haidra/design-system/button';

@Component({
  selector: 'app-model-form',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    CommonFieldsComponent,
    StableDiffusionFieldsComponent,
    TextGenerationFieldsComponent,
    ClipFieldsComponent,
    ControlNetFieldsComponent,
    ConfigFormSectionSimplifiedComponent,
    JsonEditorComponent,
    FormSectionComponent,
    EditSummaryComponent,
    HordeButtonComponent,
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
  private readonly pendingQueue = inject(PendingQueueSummaryService);

  readonly category = signal<ModelReferenceCategory | ''>('');
  readonly modelName = signal<string | null>(null);
  readonly isEditMode = signal(false);
  /** Group context passed via query param when navigating from text model group view */
  readonly groupName = signal<string | null>(null);
  readonly loading = signal(false);
  readonly submitting = signal(false);
  readonly validationIssues = signal<ValidationIssue[]>([]);
  // Store config-specific validation errors (e.g., unverified URLs)
  private readonly configValidationErrors = signal<string[]>([]);
  readonly viewMode = signal<'form' | 'json'>('form');

  /** When true, JSON view shows all fields. When false, text_generation shows CSV fields only. */
  readonly showAllJsonFields = signal(false);

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
  private readonly initialNameValue = signal<string>('');
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

  /** Whether the backend will queue this change for approval vs apply immediately */
  readonly willBeQueued = computed(() => !this.api.backendCapabilities().writable);
  /** Number of pending changes for the current category */
  readonly pendingCountForCategory = computed(() =>
    this.pendingQueue.pendingCountFor(this.category()),
  );
  /** Edit summary modal state */
  readonly showEditSummary = signal(false);
  /** Post-submission result for success screen */
  readonly submissionResult = signal<{ action: string; queued: boolean } | null>(null);

  /**
   * Field-level dirty tracking: compares current form state against initial snapshot.
   * Returns a Map of field name → { oldValue, newValue } for changed fields.
   */
  readonly dirtyFields = computed<Map<string, { oldValue: string; newValue: string }>>(() => {
    const initial = this.initialFormData();
    if (!initial || !this.isEditMode()) return new Map();

    const currentCommon = this.commonData();
    const currentDownloads = this.simplifiedDownloads();
    const dirty = new Map<string, { oldValue: string; newValue: string }>();

    // Compare common fields
    for (const [key, currentVal] of Object.entries(currentCommon)) {
      const initialVal = initial.commonData[key as keyof CommonFieldsData];
      const oldStr = formatValue(initialVal);
      const newStr = formatValue(currentVal);
      if (oldStr !== newStr) {
        dirty.set(key, { oldValue: oldStr, newValue: newStr });
      }
    }

    // Compare category-specific fields
    const currentCatData = this.getCurrentCategoryData();
    const initialCatData = initial.categoryData?.data;
    if (currentCatData && initialCatData) {
      for (const [key, currentVal] of Object.entries(currentCatData)) {
        const initialVal = (initialCatData as Record<string, unknown>)[key];
        const oldStr = formatValue(initialVal);
        const newStr = formatValue(currentVal);
        if (oldStr !== newStr) {
          dirty.set(key, { oldValue: oldStr, newValue: newStr });
        }
      }
    }

    // Compare downloads
    const oldDl = formatValue(initial.downloads);
    const newDl = formatValue(currentDownloads);
    if (oldDl !== newDl) {
      dirty.set('downloads', { oldValue: oldDl, newValue: newDl });
    }

    return dirty;
  });

  readonly hasAnyChanges = computed(() => this.dirtyFields().size > 0);
  readonly dirtyFieldCount = computed(() => this.dirtyFields().size);

  /** Builds FieldDiff[] for the EditSummaryComponent */
  readonly fieldDiffs = computed<FieldDiff[]>(() => {
    const dirty = this.dirtyFields();
    return Array.from(dirty.entries()).map(([field, { oldValue, newValue }]) => ({
      field,
      label: humanizeFieldName(field),
      oldValue,
      newValue,
    }));
  });

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
    this.route.queryParamMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((qp) => this.groupName.set(qp.get('groupName')));

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

  hasUnsavedChanges(): boolean {
    if (this.submitting() || this.submissionResult() != null) {
      return false;
    }

    if (this.isEditMode()) {
      return this.hasAnyChanges();
    }

    const initial = this.initialFormData();
    if (!initial) {
      return false;
    }

    const hasNameChanges = this.formNameValue().trim() !== this.initialNameValue().trim();
    const hasDataChanges = JSON.stringify(this.buildFormModelData()) !== JSON.stringify(initial);

    return hasNameChanges || hasDataChanges;
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

  toggleJsonFieldScope(): void {
    this.showAllJsonFields.update((v) => !v);
    this.syncFormToJson();
  }

  syncJsonToForm(): void {
    try {
      const formValue = this.form.getRawValue();
      const jsonData = JSON.parse(formValue.jsonData);
      const modelName = formValue.name || 'new-model';
      const modelData: LegacyRecordUnion = { name: modelName, ...jsonData };
      const formModel = legacyApiToForm(modelData, this.category() as MODEL_REFERENCE_CATEGORY);
      this.populateFormFromFormModel(formModel);

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
      licensing: loaded?.licensing ?? null,
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
    this.scheduleValidationIfFormView();
  }

  onStableDiffusionDataChange(data: StableDiffusionFieldsData): void {
    this.stableDiffusionData.set(data);
    this.scheduleValidationIfFormView();
  }

  onTextGenerationDataChange(data: TextGenerationFieldsData): void {
    this.textGenerationData.set(data);
    this.scheduleValidationIfFormView();
  }

  onClipDataChange(data: ClipFieldsData): void {
    this.clipData.set(data);
    this.scheduleValidationIfFormView();
  }

  onControlnetDataChange(data: ControlNetFieldsData): void {
    this.controlnetData.set(data);
    this.scheduleValidationIfFormView();
  }

  onSimplifiedDownloadsChange(data: DownloadRecord[]): void {
    this.simplifiedDownloads.set(data);
    this.scheduleValidationIfFormView();
  }

  onConfigValidationErrors(errors: string[]): void {
    this.configValidationErrors.set(errors);
  }

  /**
   * Re-validates the current form view after change handlers finish, but only when in form mode.
   * Uses a microtask to allow dependent signals/computeds to settle before validation runs.
   */
  private scheduleValidationIfFormView(): void {
    if (this.viewMode() !== 'form') return;
    setTimeout(() => {
      const modelData = this.buildModelDataFromForm(this.formNameValue());
      const issues = this.validationService.validateRecord(modelData, this.canonicalFormat());
      this.validationIssues.set(issues);
    }, 0);
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitSingleModel();
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
    const legacyForValidation = formToLegacyApi(
      formData,
      modelName,
      category as MODEL_REFERENCE_CATEGORY,
    );

    this.validationService.clearServerErrors();
    const issues = this.validationService.validateRecord(
      legacyForValidation,
      this.canonicalFormat(),
    );
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
      next: (response) => {
        const action = this.isEditMode() ? 'updated' : 'created';
        // Check if the response was queued (HTTP 202) vs applied directly
        const queued =
          typeof response === 'object' && response !== null && 'status' in response
            ? (response as { status?: string }).status === 'pending'
            : false;
        this.submitting.set(false);
        this.submissionResult.set({ action, queued });
        this.notification.success(`Model "${modelName}" ${action} successfully`);
      },
      error: (error: Error) => {
        this.notification.error(error.message);
        this.submitting.set(false);
      },
    });
  }

  private initFormForCreate(prefill?: Record<string, unknown>, prefillName?: string): void {
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
    this.initialNameValue.set(prefillName ?? '');

    const formModel = legacyApiToForm(record, category as MODEL_REFERENCE_CATEGORY);
    this.populateFormFromFormModel(formModel);
    this.initialFormData.set(structuredClone(this.buildFormModelData()));
    this.originalFormData.set(null);

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
          this.initFormForEditSingle(modelName, response);
        },
        error: (error: Error) => {
          this.notification.error(error.message);
          this.router.navigate(['/categories', this.category()]);
        },
      });
  }

  private initFormForEditSingle(modelName: string, response: Record<string, FormModelData>): void {
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
    this.initialNameValue.set(modelName);
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

  private getCurrentCategoryData(): Record<string, unknown> | null {
    if (this.isImageGeneration()) return { ...this.stableDiffusionData() };
    if (this.isTextGeneration()) return { ...this.textGenerationData() };
    if (this.isClip()) return { ...this.clipData() };
    if (this.isControlnet()) return { ...this.controlnetData() };
    return null;
  }

  /** Opens the edit summary dialog (for edit mode "Review Changes" button) */
  openEditSummary(): void {
    this.showEditSummary.set(true);
  }

  /** Handles confirmation from the edit summary dialog */
  onEditSummaryConfirm(): void {
    this.showEditSummary.set(false);
    this.onSubmit();
  }
}

function humanizeFieldName(field: string): string {
  return field.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}
