/**
 * Tests for WriteWizardComponent — the Propose-a-Change wizard.
 */
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { provideHttpClient, withXhr } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection, signal } from '@angular/core';
import { of } from 'rxjs';
import { describe, it, expect, vi } from 'vitest';
import { legacyApiToForm } from '../../adapters/model-format-adapter';
import { MODEL_REFERENCE_CATEGORY } from '../../api-client';
import { WriteWizardComponent } from './write-wizard.component';
import { ModelReferenceApiService } from '../../services/model-reference-api.service';
import { AuthService } from '../../services/auth.service';
import { ShellContextService } from '../../services/shell-context.service';
import { PendingQueueSummaryService } from '../../services/pending-queue-summary.service';
import { PendingQueueService } from '../../services/pending-queue.service';
import { ModelValidationService } from '../../services/model-validation.service';
import type { BackendCapabilities } from '../../models/api.models';
import type { PendingChangeRecord } from '../../api-client';

function createBackendCapabilities(overrides?: Partial<BackendCapabilities>): BackendCapabilities {
  return {
    writable: overrides?.writable ?? true,
    mode: overrides?.mode ?? 'PRIMARY',
    canonicalFormat: overrides?.canonicalFormat ?? 'v2',
  };
}

/** Minimal providers common to all tests. */
function baseProviders(overrides?: {
  caps?: BackendCapabilities;
  isRequestor?: boolean;
  submitProposal?: ReturnType<typeof vi.fn>;
}): Parameters<typeof TestBed.configureTestingModule>[0]['providers'] {
  return [
    provideRouter([]),
    provideHttpClient(withXhr()),
    provideHttpClientTesting(),
    provideZonelessChangeDetection(),
    {
      provide: ModelReferenceApiService,
      useValue: {
        backendCapabilities: signal(overrides?.caps ?? createBackendCapabilities()),
        getFormModel: () => of(null),
        getCategories: () => of([]),
        submitProposal:
          overrides?.submitProposal ?? (() => of({ change_id: 1 } as PendingChangeRecord)),
      },
    },
    {
      provide: AuthService,
      useValue: {
        isRequestor: signal(overrides?.isRequestor ?? true),
        isApprover: signal(false),
      },
    },
    {
      provide: ShellContextService,
      useValue: {
        setContext: vi.fn(),
        clearContext: vi.fn(),
        context: signal({ breadcrumb: [], title: '', actions: [] }),
      },
    },
    {
      provide: PendingQueueSummaryService,
      useValue: { startPolling: vi.fn() },
    },
    {
      provide: PendingQueueService,
      useValue: { listChanges: () => of({ items: [] }) },
    },
    {
      provide: ModelValidationService,
      useValue: {
        validateRecord: () => [],
        serverErrors: signal([]),
        clearServerErrors: vi.fn(),
      },
    },
  ];
}

describe('WriteWizardComponent', () => {
  async function createComponent(overrides?: {
    submitProposal?: ReturnType<typeof vi.fn>;
  }): Promise<{
    fixture: ComponentFixture<WriteWizardComponent>;
    component: WriteWizardComponent;
  }> {
    await TestBed.configureTestingModule({
      imports: [WriteWizardComponent],
      providers: baseProviders(overrides),
    }).compileComponents();

    const fixture = TestBed.createComponent(WriteWizardComponent);
    const component = fixture.componentInstance;
    return { fixture, component };
  }

  it('creates the component', async () => {
    const { component } = await createComponent();
    expect(component).toBeTruthy();
  });

  it('shows step stepper labels for image generation', async () => {
    const { fixture, component } = await createComponent();
    fixture.detectChanges(); // trigger ngOnInit which may reset category from route
    component.category.set('image_generation');
    component.loading.set(false);
    fixture.detectChanges();

    const steps = component.steps();
    expect(steps).toHaveLength(5);
    expect(steps[0]).toBe('Identity');
    expect(steps[1]).toBe('Image');
    expect(steps[2]).toBe('Files');
    expect(steps[3]).toBe('Licensing');
    expect(steps[4]).toBe('Review');
  });

  it('shows step stepper labels for text generation', async () => {
    const { fixture, component } = await createComponent();
    fixture.detectChanges(); // trigger ngOnInit
    component.category.set('text_generation');
    component.loading.set(false);
    fixture.detectChanges();

    const steps = component.steps();
    expect(steps[1]).toBe('Model');
  });

  it('disables Next when name is empty (step 0)', async () => {
    const { fixture, component } = await createComponent();
    fixture.detectChanges();
    component.category.set('image_generation');
    component.loading.set(false);
    component.currentStep.set(0);
    component.form.set({ ...component.form(), name: '' });
    fixture.detectChanges();

    expect(component.canAdvance()).toBe(false);
  });

  it('enables Next when name is filled (step 0)', async () => {
    const { fixture, component } = await createComponent();
    fixture.detectChanges();
    component.category.set('image_generation');
    component.loading.set(false);
    component.currentStep.set(0);
    component.form.set({ ...component.form(), name: 'test-model' });
    fixture.detectChanges();

    expect(component.canAdvance()).toBe(true);
  });

  it('requires parameters for text generation step 1', async () => {
    const { fixture, component } = await createComponent();
    fixture.detectChanges();
    component.category.set('text_generation');
    component.loading.set(false);
    component.currentStep.set(1);
    component.form.set({ ...component.form(), parameters: '' });
    fixture.detectChanges();

    expect(component.isTextGeneration()).toBe(true);
    expect(component.canAdvance()).toBe(false);

    component.form.set({ ...component.form(), parameters: '8030000000' });
    fixture.detectChanges();
    expect(component.canAdvance()).toBe(true);
  });

  it('computes v2 endpoint string for create', async () => {
    const { fixture, component } = await createComponent();
    fixture.detectChanges();
    component.category.set('image_generation');
    component.loading.set(false);
    component.form.set({ ...component.form(), name: 'my-model' });
    fixture.detectChanges();

    expect(component.endpointStr()).toContain('POST /api/model_references/v2/image_generation');
  });

  it('computes hasUnsavedChanges correctly', async () => {
    const { component } = await createComponent();
    component.category.set('image_generation');
    component.loading.set(false);

    // Empty name → no unsaved changes
    component.form.set({ ...component.form(), name: '' });
    expect(component.hasUnsavedChanges()).toBe(false);

    // Filled name → has unsaved changes
    component.form.set({ ...component.form(), name: 'test' });
    expect(component.hasUnsavedChanges()).toBe(true);

    // After submit → no unsaved changes
    component.submitSuccess.set(true);
    expect(component.hasUnsavedChanges()).toBe(false);
  });

  it('patches form via partial update', async () => {
    const { fixture, component } = await createComponent();
    fixture.detectChanges();
    component.category.set('image_generation');
    component.loading.set(false);
    component.patchForm({ name: 'patched-model', display_name: 'Patched' });
    fixture.detectChanges();

    expect(component.form().name).toBe('patched-model');
    expect(component.form().display_name).toBe('Patched');
  });

  it('submits an explicit fail-closed licensing conclusion and reports the queued change', async () => {
    const submitProposal = vi.fn(() => of({ change_id: 73 } as PendingChangeRecord));
    const { fixture, component } = await createComponent({ submitProposal });
    fixture.detectChanges();
    component.category.set('image_generation');
    component.loading.set(false);
    component.form.set({ ...component.form(), name: 'licensed-model' });

    component.submit();

    expect(submitProposal).toHaveBeenCalledTimes(1);
    expect(submitProposal).toHaveBeenCalledWith(
      expect.objectContaining({
        operation: 'create',
        payload: expect.objectContaining({
          licensing: expect.objectContaining({
            license_expression: 'NOASSERTION',
            license_ids: [],
            commercial_use: 'unknown',
            redistribution: 'unknown',
          }),
        }),
      }),
    );
    expect(component.submitChangeId()).toBe(73);
    expect(component.submitSuccess()).toBe(true);
  });

  it('loads an existing model from the template route as a new proposal', async () => {
    const template = legacyApiToForm(
      {
        name: 'source',
        baseline: 'anima',
        inpainting: false,
        config: {
          files: [{ path: 'vae.safetensors', file_type: 'vae', sha256sum: 'original-sha' }],
          download: [{ file_name: 'vae.safetensors', file_url: 'https://example.com/vae' }],
        },
      },
      MODEL_REFERENCE_CATEGORY.ImageGeneration,
    );
    const getFormModel = vi.fn(() => of(template));
    await TestBed.configureTestingModule({
      imports: [WriteWizardComponent],
      providers: [
        ...baseProviders()!,
        {
          provide: ActivatedRoute,
          useValue: {
            params: of({ category: 'image_generation' }),
            snapshot: { queryParamMap: convertToParamMap({ template: 'source' }) },
          },
        },
        {
          provide: ModelReferenceApiService,
          useValue: { backendCapabilities: signal(createBackendCapabilities()), getFormModel },
        },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(WriteWizardComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    expect(getFormModel).toHaveBeenCalledWith('image_generation', 'source');
    expect(component.isEditMode()).toBe(false);
    expect(component.form().name).toBe('');
    expect(component.form().download[0]).toMatchObject({
      file_purpose: 'vae',
      sha256sum: 'original-sha',
    });
    expect(component.templateName()).toBe('source');
    expect(component.loading()).toBe(false);
  });

  it('keeps file metadata and additional attributes through JSON edits and allows removing every file', async () => {
    const { component } = await createComponent();
    component.category.set('image_generation');
    const record = {
      name: 'split',
      baseline: 'anima',
      nsfw: false,
      config: {
        download: [
          {
            file_name: 'vae.safetensors',
            file_url: 'https://example.com/vae',
            file_purpose: 'vae',
            content_hash: 'tensor-hash',
            size_bytes: 123,
          },
        ],
      },
      requirements: { samplers: ['er_sde'] },
      finetune_series: { name: 'Anima' },
    };
    component.onJsonEdit({ target: { value: JSON.stringify(record) } } as unknown as Event);
    expect(component.record()).toMatchObject(record);
    component.onJsonEdit({
      target: { value: JSON.stringify({ ...record, config: { download: [] } }) },
    } as unknown as Event);
    expect(component.record()['config']).toMatchObject({ download: [] });
  });

  it('exposes file roles in the Files step and includes changes in the proposal', async () => {
    const { fixture, component } = await createComponent();
    fixture.detectChanges();
    component.category.set('image_generation');
    component.loading.set(false);
    component.setStep(2);
    fixture.detectChanges();
    const input = (fixture.nativeElement as HTMLElement).querySelector(
      'app-autocomplete-input input',
    ) as HTMLInputElement;
    expect(input).toBeTruthy();
    input.value = 'text_encoders';
    input.dispatchEvent(new Event('input'));
    expect(component.form().download[0].file_purpose).toBe('text_encoders');
  });

  it('blocks a reviewed licensing conclusion without matching IDs and evidence', async () => {
    const submitProposal = vi.fn(() => of({ change_id: 74 } as PendingChangeRecord));
    const { fixture, component } = await createComponent({ submitProposal });
    fixture.detectChanges();
    component.category.set('image_generation');
    component.loading.set(false);
    component.form.set({
      ...component.form(),
      name: 'incomplete-license',
      license_expression: 'MIT',
      license_ids: '',
      license_evidence_source: '',
    });

    component.submit();

    expect(component.canSubmit()).toBe(false);
    expect(submitProposal).not.toHaveBeenCalled();
  });
});
