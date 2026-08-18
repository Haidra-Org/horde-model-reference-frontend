import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal, provideZonelessChangeDetection } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, Router } from '@angular/router';
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
      style: 'realistic',
      tags: ['test'],
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
    getModelsInCategory: vi.fn(),
    getGroupMembers: vi.fn(),
    getModelsWithStats: vi.fn(),
    getCategoryAudit: vi.fn(),
    submitProposal: vi.fn(),
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
    apiStub.getModelsInCategory.mockReset();
    apiStub.getGroupMembers.mockReset();
    apiStub.getModelsWithStats.mockReset();
    apiStub.getCategoryAudit.mockReset();
    apiStub.submitProposal.mockReset();

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

  it('requires the exact model name before submitting a removal proposal', () => {
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    isRequestor.set(true);
    apiStub.getDisplayModelsAsArray.mockReturnValue(of([makeBrowseModel()._raw]));
    apiStub.getModelsWithStats.mockReturnValue(of(null));
    apiStub.getCategoryAudit.mockReturnValue(of(null));
    apiStub.submitProposal.mockReturnValue(
      of({ change_id: 91, operation: 'delete', status: 'pending' }),
    );

    paramMapSubject.next({ category: 'image_generation', modelName: 'test-model' });
    fixture.detectChanges();

    const removalAction = shellContext.context().actions.find((action) => action.id === 'delete');
    expect(removalAction?.label).toBe('Propose removal');
    removalAction!.action();
    fixture.detectChanges();

    const dialog = nativeEl.querySelector('[role="dialog"]');
    const confirmationInput = dialog?.querySelector<HTMLInputElement>('#delete-model-confirmation');
    const confirmButton = Array.from(dialog?.querySelectorAll('button') ?? []).find((button) =>
      button.textContent?.includes('Submit removal proposal'),
    );
    expect(dialog).toBeTruthy();
    expect(confirmButton?.disabled).toBe(true);

    confirmationInput!.value = 'wrong-model';
    confirmationInput!.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(confirmButton?.disabled).toBe(true);
    expect(apiStub.submitProposal).not.toHaveBeenCalled();

    confirmationInput!.value = 'test-model';
    confirmationInput!.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(confirmButton?.disabled).toBe(false);
    confirmButton!.click();

    expect(apiStub.submitProposal).toHaveBeenCalledWith(
      expect.objectContaining({
        operation: 'delete',
        category: 'image_generation',
        model_name: 'test-model',
      }),
    );
    expect(navigate).toHaveBeenCalledWith(['/pending-queue'], { queryParams: { focus: 91 } });
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

  it('cross-links model concepts to filtered catalog destinations', () => {
    apiStub.getDisplayModelsAsArray.mockReturnValue(of([makeBrowseModel()._raw]));
    apiStub.getModelsWithStats.mockReturnValue(of(null));
    apiStub.getCategoryAudit.mockReturnValue(of(null));

    paramMapSubject.next({ category: 'image_generation', modelName: 'test-model' });
    fixture.detectChanges();

    expect(nativeEl.textContent).toContain('Image Generation');
    const links = Array.from<HTMLAnchorElement>(nativeEl.querySelectorAll('app-overview-tab a'));
    expect(
      links.some((link) => link.getAttribute('href')?.includes('baselines=stable_diffusion_xl')),
    ).toBe(true);
    expect(links.some((link) => link.getAttribute('href')?.includes('styles=realistic'))).toBe(
      true,
    );
  });

  it('shows the persisted family, group, and exact-record hierarchy for text models', () => {
    apiStub.getModelsInCategory.mockReturnValue(
      of({
        'publisher/atlas-7b': {
          name: 'publisher/atlas-7b',
          display_name: 'Atlas 7B',
          record_type: 'text_generation',
          text_model_group: 'Atlas',
          parameters: 7_000_000_000,
        },
      }),
    );
    apiStub.getGroupMembers.mockReturnValue(
      of({
        group_name: 'Atlas',
        members: [],
        related_family: { family_name: 'Atlas family', members: ['Atlas'] },
      }),
    );
    apiStub.getModelsWithStats.mockReturnValue(of(null));
    apiStub.getCategoryAudit.mockReturnValue(of(null));

    paramMapSubject.next({ category: 'text_generation', modelName: 'publisher/atlas-7b' });
    fixture.detectChanges();

    const hierarchy = nativeEl.querySelector<HTMLElement>('[aria-label="Text model hierarchy"]');
    expect(hierarchy?.textContent).toContain('Atlas family');
    expect(hierarchy?.textContent).toContain('Atlas');
    expect(hierarchy?.textContent).toContain('publisher/atlas-7b');
    const destinations = Array.from(hierarchy?.querySelectorAll('a') ?? []).map((link) =>
      link.getAttribute('href'),
    );
    expect(destinations).toContain('/text-groups?families=Atlas%20family');
    expect(destinations).toContain('/text-groups/group?name=Atlas');
    expect(destinations).toContain('/categories/text_generation?groups=Atlas');
  });

  it('exposes an associated tab and panel relationship to assistive technology', () => {
    apiStub.getDisplayModelsAsArray.mockReturnValue(of([makeBrowseModel()._raw]));
    apiStub.getModelsWithStats.mockReturnValue(of(null));
    apiStub.getCategoryAudit.mockReturnValue(of(null));

    paramMapSubject.next({ category: 'image_generation', modelName: 'test-model' });
    fixture.detectChanges();

    const selectedTab = nativeEl.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]');
    const panel = nativeEl.querySelector<HTMLElement>('[role="tabpanel"]');
    expect(selectedTab?.getAttribute('aria-controls')).toBe(panel?.id);
    expect(panel?.getAttribute('aria-labelledby')).toBe(selectedTab?.id);
  });

  it('supports arrow-key navigation between detail sections', () => {
    apiStub.getDisplayModelsAsArray.mockReturnValue(of([makeBrowseModel()._raw]));
    apiStub.getModelsWithStats.mockReturnValue(of(null));
    apiStub.getCategoryAudit.mockReturnValue(of(null));

    paramMapSubject.next({ category: 'image_generation', modelName: 'test-model' });
    fixture.detectChanges();

    const overviewTab = nativeEl.querySelector<HTMLButtonElement>('#model-detail-tab-overview');
    overviewTab?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    fixture.detectChanges();

    expect(
      nativeEl
        .querySelector<HTMLElement>('[role="tab"][aria-selected="true"]')
        ?.textContent?.trim(),
    ).toBe('Licensing');
    expect(nativeEl.querySelector('app-licensing-tab')).toBeTruthy();
  });

  it('does not request Horde runtime analytics for a category the API does not support', () => {
    const utilityModel = makeBrowseModel({ category: 'blip' });
    apiStub.getDisplayModelsAsArray.mockReturnValue(of([utilityModel._raw]));

    paramMapSubject.next({ category: 'blip', modelName: 'test-model' });
    fixture.detectChanges();

    expect(nativeEl.textContent).toContain('Test Model');
    expect(nativeEl.textContent).toContain(
      'An image-captioning model used to derive natural-language descriptions',
    );
    expect(apiStub.getModelsWithStats).not.toHaveBeenCalled();
    expect(apiStub.getCategoryAudit).not.toHaveBeenCalled();
  });
});
