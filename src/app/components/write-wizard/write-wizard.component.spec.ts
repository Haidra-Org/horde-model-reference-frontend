/**
 * Tests for WriteWizardComponent — the Propose-a-Change wizard.
 */
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection, signal } from '@angular/core';
import { of } from 'rxjs';
import { describe, it, expect, vi } from 'vitest';
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
}): Parameters<typeof TestBed.configureTestingModule>[0]['providers'] {
  return [
    provideRouter([]),
    provideHttpClient(),
    provideHttpClientTesting(),
    provideZonelessChangeDetection(),
    {
      provide: ModelReferenceApiService,
      useValue: {
        backendCapabilities: signal(overrides?.caps ?? createBackendCapabilities()),
        getFormModel: () => of(null),
        getCategories: () => of([]),
        submitProposal: () => of({ change_id: 1 } as PendingChangeRecord),
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
      useValue: { validateRecord: () => [], serverErrors: signal([]) },
    },
  ];
}

describe('WriteWizardComponent', () => {
  async function createComponent(): Promise<{
    fixture: ComponentFixture<WriteWizardComponent>;
    component: WriteWizardComponent;
  }> {
    await TestBed.configureTestingModule({
      imports: [WriteWizardComponent],
      providers: baseProviders(),
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
    expect(steps).toHaveLength(4);
    expect(steps[0]).toBe('Identity');
    expect(steps[1]).toBe('Image');
    expect(steps[2]).toBe('Files');
    expect(steps[3]).toBe('Review');
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
});
