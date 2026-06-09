import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal, provideZonelessChangeDetection } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute } from '@angular/router';
import { BASE_PATH } from '../../api-client';
import { ModelDetailComponent } from './model-detail.component';
import { ModelReferenceApiService } from '../../services/model-reference-api.service';
import { ShellContextService } from '../../services/shell-context.service';
import { AuthService } from '../../services/auth.service';
import { PendingQueueSummaryService } from '../../services/pending-queue-summary.service';
import type { BrowseModel } from '../../services/browse-models.service';
import type { LegacyRecordUnion } from '../../models/api.models';
import { of, ReplaySubject } from 'rxjs';
import { map } from 'rxjs/operators';

function makeBrowseModel(overrides: Partial<BrowseModel> = {}): BrowseModel {
  return {
    name: 'test-model',
    display_name: 'Test Model',
    description: 'Test description.',
    version: '1.0',
    style: 'realistic',
    nsfw: false,
    baseline: 'stable_diffusion_xl',
    tags: ['test'],
    category: 'image_generation',
    _raw: {
      name: 'test-model',
      display_name: 'Test Model',
      description: 'Test description.',
      version: '1.0',
      baseline: 'stable_diffusion_xl',
      nsfw: false,
      model_classification: { domain: 'image', purpose: 'generation' },
      metadata: { added: '2025-01-01T00:00:00Z', updated: '2025-06-01T00:00:00Z' },
      config: { download: [] },
      homepage: null,
    } as unknown as LegacyRecordUnion,
    ...overrides,
  };
}

describe('ModelDetailComponent', () => {
  let fixture: ComponentFixture<ModelDetailComponent>;
  let nativeEl: HTMLElement;
  let shellContext: ShellContextService;

  const backendCapabilities = signal({
    writable: true,
    mode: 'PRIMARY' as const,
    canonicalFormat: 'v2' as const,
  });

  const isAuthenticated = signal(false);
  const isRequestor = signal(false);
  const isApprover = signal(false);

  const paramMapSubject = new ReplaySubject<Record<string, string>>(1);
  const queryParamMapSubject = new ReplaySubject<Record<string, string>>(1);

  const apiStub = {
    backendCapabilities: backendCapabilities.asReadonly(),
    getDisplayModelsAsArray: vi.fn(),
    getModelsWithStats: vi.fn(),
    getCategoryAudit: vi.fn(),
  };

  const authStub = {
    isAuthenticated: isAuthenticated.asReadonly(),
    isRequestor: isRequestor.asReadonly(),
    isApprover: isApprover.asReadonly(),
  };

  const pendingSummaryStub = {
    records: signal([]).asReadonly(),
    pendingCount: signal(0).asReadonly(),
  };

  beforeEach(async () => {
    isAuthenticated.set(false);
    isRequestor.set(false);
    isApprover.set(false);

    apiStub.getDisplayModelsAsArray.mockReset();
    apiStub.getModelsWithStats.mockReset();
    apiStub.getCategoryAudit.mockReset();

    await TestBed.configureTestingModule({
      imports: [ModelDetailComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: BASE_PATH, useValue: 'http://localhost:19800/api' },
        { provide: ModelReferenceApiService, useValue: apiStub },
        { provide: AuthService, useValue: authStub },
        { provide: PendingQueueSummaryService, useValue: pendingSummaryStub },
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: paramMapSubject.pipe(map((p) => new Map(Object.entries(p)))),
            queryParamMap: queryParamMapSubject.pipe(map((p) => new Map(Object.entries(p)))),
          },
        },
        ShellContextService,
      ],
    }).compileComponents();

    shellContext = TestBed.inject(ShellContextService);
    fixture = TestBed.createComponent(ModelDetailComponent);
    nativeEl = fixture.nativeElement;
  });

  it('should create', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should show loading state initially', () => {
    fixture.detectChanges();
    expect(nativeEl.textContent).toContain('Loading model');
  });

  it('should show model not found when no model matches', () => {
    apiStub.getDisplayModelsAsArray.mockReturnValue(of([]));
    paramMapSubject.next({ category: 'image_generation', modelName: 'nonexistent' });
    fixture.detectChanges();

    expect(nativeEl.textContent).toContain('Model not found');
  });

  it('should render model details when loaded', () => {
    apiStub.getDisplayModelsAsArray.mockReturnValue(of([makeBrowseModel()._raw]));
    apiStub.getModelsWithStats.mockReturnValue(of(null));
    apiStub.getCategoryAudit.mockReturnValue(of(null));

    paramMapSubject.next({ category: 'image_generation', modelName: 'test-model' });
    fixture.detectChanges();

    const rail = nativeEl.querySelector('app-model-identity-rail');
    expect(rail).toBeTruthy();

    const tiles = nativeEl.querySelectorAll('app-stat-tile');
    expect(tiles.length).toBeGreaterThanOrEqual(4);
  });

  it('should show edit action when user can write', () => {
    isRequestor.set(true);

    apiStub.getDisplayModelsAsArray.mockReturnValue(of([makeBrowseModel()._raw]));
    apiStub.getModelsWithStats.mockReturnValue(of(null));
    apiStub.getCategoryAudit.mockReturnValue(of(null));

    paramMapSubject.next({ category: 'image_generation', modelName: 'test-model' });
    fixture.detectChanges();

    const ctx = shellContext.context();
    const editAction = ctx.actions.find((a) => a.id === 'edit');
    expect(editAction).toBeTruthy();
    expect(editAction!.label).toBe('Edit');
  });

  it('should show homepage action when model has homepage', () => {
    const model = makeBrowseModel();
    (model._raw as unknown as Record<string, unknown>)['homepage'] = 'https://example.com';

    apiStub.getDisplayModelsAsArray.mockReturnValue(of([model._raw]));
    apiStub.getModelsWithStats.mockReturnValue(of(null));
    apiStub.getCategoryAudit.mockReturnValue(of(null));

    paramMapSubject.next({ category: 'image_generation', modelName: 'test-model' });
    fixture.detectChanges();

    const ctx = shellContext.context();
    const hpAction = ctx.actions.find((a) => a.id === 'homepage');
    expect(hpAction).toBeTruthy();
  });

  it('should display model name in the template', () => {
    apiStub.getDisplayModelsAsArray.mockReturnValue(of([makeBrowseModel()._raw]));
    apiStub.getModelsWithStats.mockReturnValue(of(null));
    apiStub.getCategoryAudit.mockReturnValue(of(null));

    paramMapSubject.next({ category: 'image_generation', modelName: 'test-model' });
    fixture.detectChanges();

    expect(nativeEl.textContent).toContain('Test Model');
  });

  it('should show overview tab by default', () => {
    apiStub.getDisplayModelsAsArray.mockReturnValue(of([makeBrowseModel()._raw]));
    apiStub.getModelsWithStats.mockReturnValue(of(null));
    apiStub.getCategoryAudit.mockReturnValue(of(null));

    paramMapSubject.next({ category: 'image_generation', modelName: 'test-model' });
    fixture.detectChanges();

    const overviewTab = nativeEl.querySelector('app-overview-tab');
    expect(overviewTab).toBeTruthy();
  });
});
