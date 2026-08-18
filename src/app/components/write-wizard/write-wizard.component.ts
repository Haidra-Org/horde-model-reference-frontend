import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { ModelReferenceApiService } from '../../services/model-reference-api.service';
import { ViewerCapabilitiesService } from '../../services/viewer-capabilities.service';
import { NotificationService } from '../../services/notification.service';
import { ModelValidationService } from '../../services/model-validation.service';
import { PendingQueueSummaryService } from '../../services/pending-queue-summary.service';
import { ShellContextService } from '../../services/shell-context.service';
import { CopyButtonComponent } from '../common/copy-button/copy-button.component';
import { EndpointBannerComponent } from './endpoint-banner.component';
import { WizardStepIdentityComponent } from './wizard-step-identity.component';
import { WizardStepImageComponent } from './wizard-step-image.component';
import { WizardStepModelComponent } from './wizard-step-model.component';
import { WizardStepGenericComponent } from './wizard-step-generic.component';
import { WizardStepFilesComponent } from './wizard-step-files.component';
import { WizardStepLicensingComponent } from './wizard-step-licensing.component';
import { WizardStepReviewComponent } from './wizard-step-review.component';
import { WriteGatingComponent } from './write-gating.component';
import {
  blankForm,
  editFormFromRecord,
  formToRecord,
  type WriteFormState,
  type WriteFormDownload,
} from '../../utils/write-record';
import { computeDiff, type DiffEntry } from '../../utils/compute-diff';
import type { MODEL_REFERENCE_CATEGORY } from '../../api-client';
import type { LegacyRecordUnion } from '../../models/api.models';

type WizardStep = 0 | 1 | 2 | 3 | 4;

@Component({
  selector: 'app-write-wizard',
  imports: [
    CopyButtonComponent,
    EndpointBannerComponent,
    WizardStepIdentityComponent,
    WizardStepImageComponent,
    WizardStepModelComponent,
    WizardStepGenericComponent,
    WizardStepFilesComponent,
    WizardStepLicensingComponent,
    WizardStepReviewComponent,
    WriteGatingComponent,
  ],
  templateUrl: './write-wizard.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WriteWizardComponent implements OnInit {
  private readonly api = inject(ModelReferenceApiService);
  private readonly viewer = inject(ViewerCapabilitiesService);
  private readonly notifications = inject(NotificationService);
  readonly validationService = inject(ModelValidationService);
  private readonly pendingQueue = inject(PendingQueueSummaryService);
  private readonly shell = inject(ShellContextService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  // -----------------------------------------------------------------------
  // Route state
  // -----------------------------------------------------------------------
  readonly category = signal<string>('');
  readonly modelName = signal<string | null>(null);
  readonly isEditMode = signal(false);
  readonly operation = signal<'create' | 'update' | 'delete'>('create');
  readonly loading = signal(true);

  // -----------------------------------------------------------------------
  // Wizard state
  // -----------------------------------------------------------------------
  readonly currentStep = signal<WizardStep>(0);
  readonly form = signal<WriteFormState>(blankForm('image_generation'));
  readonly jsonText = signal('');
  readonly jsonError = signal<string | null>(null);
  /** True while the JSON editor is focused — pauses form→JSON sync so the cursor doesn't jump. */
  readonly jsonFocused = signal(false);
  readonly submitting = signal(false);
  readonly submitSuccess = signal(false);
  readonly submitResultMessage = signal('');
  readonly submitChangeId = signal<number | null>(null);
  readonly showAdvancedJson = signal(false);

  // Store original record for diff computation (edit mode)
  private readonly originalRecord = signal<Record<string, unknown> | null>(null);

  // -----------------------------------------------------------------------
  // Derived state
  // -----------------------------------------------------------------------
  readonly canWrite = this.viewer.canPropose;

  readonly isImageGeneration = computed(() => this.category() === 'image_generation');
  readonly isTextGeneration = computed(() => this.category() === 'text_generation');

  readonly steps = computed<string[]>(() => {
    return [
      'Identity',
      this.isTextGeneration() ? 'Model' : 'Image',
      'Files',
      'Licensing',
      'Review',
    ];
  });

  readonly endpointStr = computed(() => {
    const legacy = this.api.backendCapabilities().canonicalFormat === 'legacy';
    const cat = this.category();
    const name = this.form().name || '{name}';
    if (legacy) {
      return this.isEditMode()
        ? `PUT /api/model_references/v1/${cat}/model/${name}`
        : `POST /api/model_references/v1/${cat}`;
    }
    return this.isEditMode()
      ? `PUT /api/model_references/v2/${cat}/model/${name}`
      : `POST /api/model_references/v2/${cat}`;
  });

  /** The canonical record derived from the form (source of truth). */
  readonly record = computed(() =>
    formToRecord(this.form(), this.category() as MODEL_REFERENCE_CATEGORY),
  );

  /** Computed diff entries for edit mode review step. */
  readonly diffEntries = computed<DiffEntry[]>(() => {
    if (!this.isEditMode() || !this.originalRecord()) return [];
    return computeDiff('update', this.originalRecord(), this.record());
  });

  readonly validationIssues = computed(() =>
    this.validationService.validateRecord(
      this.record() as LegacyRecordUnion,
      this.api.backendCapabilities().canonicalFormat,
    ),
  );

  readonly validationErrors = computed(() =>
    this.validationIssues().filter((issue) => issue.severity === 'error'),
  );

  /** Whether the current step's data is valid enough to advance. */
  readonly canAdvance = computed(() => {
    if (this.currentStep() === 0) {
      return this.form().name.trim().length > 0;
    }
    if (this.currentStep() === 1 && this.isTextGeneration()) {
      return Number(this.form().parameters) > 0;
    }
    if (this.currentStep() === 3) {
      return this.licensingIsValid();
    }
    return true;
  });

  /** Whether the form is valid enough to submit. */
  readonly canSubmit = computed(() => {
    const f = this.form();
    if (!f.name.trim()) return false;
    if (this.isTextGeneration() && Number(f.parameters) <= 0) return false;
    if (this.jsonError() !== null || !this.licensingIsValid()) return false;
    return this.validationErrors().length === 0;
  });

  constructor() {
    // Two-way JSON sync: form → JSON, except while the editor is focused (so user
    // keystrokes aren't clobbered mid-type). On blur the effect re-runs and re-normalizes.
    effect(() => {
      const rec = this.record();
      if (!this.jsonFocused()) {
        this.jsonText.set(JSON.stringify(rec, null, 2));
      }
    });

    // Update shell context when category/edit state changes
    effect(() => {
      this.updateShellContext();
    });
  }

  ngOnInit(): void {
    const proposalPayload = this.readProposalPayload();
    this.route.params.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const category = params['category'] as string;
      const editName = params['modelName'] as string | undefined;

      this.category.set(category);
      if (editName) {
        this.isEditMode.set(true);
        this.modelName.set(editName);
        this.operation.set('update');
        this.loadModelForEdit(category, editName, proposalPayload);
      } else {
        this.isEditMode.set(false);
        this.modelName.set(null);
        this.operation.set('create');
        this.form.set(
          proposalPayload
            ? editFormFromRecord(category as MODEL_REFERENCE_CATEGORY, proposalPayload)
            : blankForm(category as MODEL_REFERENCE_CATEGORY),
        );
        this.loading.set(false);
        this.updateShellContext();
      }
    });
  }

  // -----------------------------------------------------------------------
  // Public methods
  // -----------------------------------------------------------------------

  hasUnsavedChanges(): boolean {
    if (this.submitting() || this.submitSuccess()) return false;
    // Simple check: form has a name
    return this.form().name.trim().length > 0;
  }

  setStep(step: number): void {
    if (step >= 0 && step < this.steps().length) {
      this.currentStep.set(step as WizardStep);
    }
  }

  patchForm(partial: Partial<WriteFormState>): void {
    this.form.update((f) => ({ ...f, ...partial }));
  }

  onCategorySwitch(newCategory: string): void {
    if (newCategory === this.category()) return;
    this.router.navigate(['/categories', newCategory, 'create']);
  }

  onJsonEdit(event: Event): void {
    const textarea = event.target as HTMLTextAreaElement;
    const txt = textarea.value;
    this.jsonText.set(txt);

    try {
      const o = JSON.parse(txt) as Record<string, unknown>;
      const licensing = o['licensing'] as Record<string, unknown> | undefined;
      const evidence = Array.isArray(licensing?.['evidence'])
        ? (licensing?.['evidence'][0] as Record<string, unknown> | undefined)
        : undefined;
      this.jsonError.set(null);

      // Patch form from parsed JSON (two-way sync)
      this.form.update((f) => ({
        ...f,
        name: (o['name'] as string) ?? f.name,
        display_name: (o['display_name'] as string) ?? '',
        description: (o['description'] as string) ?? '',
        version: (o['version'] as string) ?? '',
        baseline: (o['baseline'] as string) ?? f.baseline,
        nsfw: !!(o['nsfw'] as boolean | undefined),
        style: (o['style'] as string) ?? f.style,
        inpainting: !!(o['inpainting'] as boolean | undefined),
        tags: Array.isArray(o['tags']) ? (o['tags'] as string[]).join(', ') : f.tags,
        trigger: Array.isArray(o['trigger']) ? (o['trigger'] as string[]).join(', ') : f.trigger,
        parameters: o['parameters'] != null ? String(o['parameters']) : f.parameters,
        instruct_format: (o['instruct_format'] as string) ?? f.instruct_format,
        text_model_group: (o['text_model_group'] as string) ?? f.text_model_group,
        homepage: (o['homepage'] as string) ?? f.homepage,
        min_bridge_version:
          o['min_bridge_version'] != null ? String(o['min_bridge_version']) : f.min_bridge_version,
        license_expression:
          (licensing?.['license_expression'] as string | undefined) ?? f.license_expression,
        license_ids: Array.isArray(licensing?.['license_ids'])
          ? (licensing['license_ids'] as string[]).join(', ')
          : f.license_ids,
        commercial_use:
          (licensing?.['commercial_use'] as WriteFormState['commercial_use'] | undefined) ??
          f.commercial_use,
        redistribution:
          (licensing?.['redistribution'] as WriteFormState['redistribution'] | undefined) ??
          f.redistribution,
        license_obligations: Array.isArray(licensing?.['obligations'])
          ? (licensing['obligations'] as WriteFormState['license_obligations'])
          : f.license_obligations,
        license_attribution:
          (licensing?.['attribution'] as string | undefined) ?? f.license_attribution,
        license_evidence_source:
          (evidence?.['source'] as string | undefined) ?? f.license_evidence_source,
        license_evidence_description:
          (evidence?.['description'] as string | undefined) ?? f.license_evidence_description,
        license_reviewed_by:
          (licensing?.['reviewed_by'] as string | undefined) ?? f.license_reviewed_by,
        license_reviewed_at:
          (licensing?.['reviewed_at'] as string | undefined) ?? f.license_reviewed_at,
        license_notes: (licensing?.['notes'] as string | undefined) ?? f.license_notes,
        download: this.extractDownloads(o as Record<string, unknown>, f.download),
      }));
    } catch (e) {
      this.jsonError.set((e as Error).message);
    }
  }

  submit(): void {
    if (!this.canSubmit() || this.submitting()) return;

    this.validationService.clearServerErrors();
    this.submitting.set(true);
    const record = this.record();
    const cat = this.category() as MODEL_REFERENCE_CATEGORY;
    const name = record['name'] as string;
    const isEdit = this.isEditMode();
    const diffEntries = this.diffEntries();

    // Build the pending change payload
    const change = {
      operation: isEdit ? ('update' as const) : ('create' as const),
      category: cat,
      model_name: name,
      payload: record,
      diff:
        diffEntries.length > 0
          ? diffEntries.map((d) => ({
              field: d.field,
              before: d.before,
              after: d.after,
              kind: d.kind,
            }))
          : isEdit
            ? [
                {
                  field: '(updated via wizard)',
                  before: 'current',
                  after: 'proposed',
                  kind: 'modify' as const,
                },
              ]
            : Object.keys(record)
                .filter((k) => k !== 'config')
                .slice(0, 5)
                .map((k) => ({
                  field: k,
                  before: null as string | null,
                  after: JSON.stringify(record[k]),
                  kind: 'add' as const,
                })),
    };

    // Use the submitProposal seam
    this.api.submitProposal(change).subscribe({
      next: (result) => {
        this.submitting.set(false);
        this.submitSuccess.set(true);
        const changeId = result.change_id ?? 0;
        this.submitChangeId.set(changeId);
        this.submitResultMessage.set(`Change #${changeId} submitted for review`);
        this.notifications.success(this.submitResultMessage());
        // Refresh pending queue in the background
        this.pendingQueue.startPolling();
      },
      error: (_err) => {
        this.submitting.set(false);
        const detail = _err?.error?.detail ?? _err?.message ?? 'Unknown error';
        this.notifications.error(`Submission failed: ${detail}`);
        console.error('Submit proposal error:', _err);
      },
    });
  }

  navigateToQueue(): void {
    const id = this.submitChangeId();
    if (id != null) {
      this.router.navigate(['/pending-queue'], { queryParams: { focus: id } });
    } else {
      this.router.navigate(['/pending-queue']);
    }
  }

  // -----------------------------------------------------------------------
  // Private methods
  // -----------------------------------------------------------------------

  private loadModelForEdit(
    category: string,
    modelName: string,
    proposalPayload: Record<string, unknown> | null = null,
  ): void {
    this.api.getFormModel(category, modelName).subscribe({
      next: (model) => {
        if (model) {
          // Convert FormModelData to WriteFormState
          const record = this.formModelDataToRecord(model);
          this.originalRecord.set(record);
          const formState = editFormFromRecord(
            category as MODEL_REFERENCE_CATEGORY,
            proposalPayload ?? record,
          );
          this.form.set(formState);
          // Init JSON text to match
          this.jsonText.set(
            JSON.stringify(formToRecord(formState, category as MODEL_REFERENCE_CATEGORY), null, 2),
          );
        } else {
          this.notifications.error('Model not found');
          this.router.navigate(['/categories', category]);
          return;
        }
        this.loading.set(false);
      },
      error: () => {
        this.notifications.error('Failed to load model');
        this.router.navigate(['/categories', category]);
        this.loading.set(false);
      },
    });
  }

  private readProposalPayload(): Record<string, unknown> | null {
    const navigationState =
      this.router.getCurrentNavigation()?.extras.state ?? window.history.state;
    const payload = navigationState?.['proposalPayload'];
    if (payload == null || typeof payload !== 'object' || Array.isArray(payload)) {
      return null;
    }
    return payload as Record<string, unknown>;
  }

  private formModelDataToRecord(
    model: import('../../adapters/model-format-adapter').FormModelData,
  ): Record<string, unknown> {
    const record: Record<string, unknown> = { name: '' };
    // Merge common data
    Object.assign(record, model.commonData);
    // Merge category data
    if (model.categoryData.kind !== 'generic' && model.categoryData.data) {
      Object.assign(record, model.categoryData.data as Record<string, unknown>);
    }
    // Downloads
    if (model.downloads.length > 0) {
      record['config'] = { download: model.downloads };
    }
    if (model.licensing) {
      record['licensing'] = model.licensing;
    }
    return record;
  }

  private licensingIsValid(): boolean {
    const form = this.form();
    const expression = form.license_expression.trim();
    if (!expression) return false;
    if (expression.toUpperCase() === 'NOASSERTION') return true;
    if (!form.license_ids.trim() || !form.license_evidence_source.trim()) return false;
    try {
      new URL(form.license_evidence_source);
      return true;
    } catch {
      return false;
    }
  }

  private updateShellContext(): void {
    const isEdit = this.isEditMode();

    this.shell.setContext({
      breadcrumb: [
        { label: 'Contribute', route: ['/propose'] },
        { label: isEdit ? 'Edit' : 'Propose' },
      ],
      title: isEdit ? `Edit ${this.modelName() ?? ''}` : 'Propose a model',
      sub: `Routes to the ${this.api.backendCapabilities().canonicalFormat === 'legacy' ? 'v1 (legacy canonical)' : 'v2'} write API · enqueued for review`,
      actions: [],
    });
  }

  /** Extract download records from parsed JSON object, falling back to current form downloads. */
  private extractDownloads(
    obj: Record<string, unknown>,
    fallback: WriteFormDownload[],
  ): WriteFormDownload[] {
    const config = obj['config'] as Record<string, unknown> | undefined;
    const configDownload = config?.['download'] as unknown[] | undefined;
    if (!configDownload?.length) return fallback;
    return (
      configDownload as {
        file_name?: string;
        file_url?: string;
        sha256sum?: string;
        known_slow_download?: boolean;
      }[]
    ).map((d) => ({
      file_name: d.file_name ?? '',
      file_url: d.file_url ?? '',
      sha256sum: d.sha256sum ?? '',
      known_slow_download: !!d.known_slow_download,
    }));
  }
}
