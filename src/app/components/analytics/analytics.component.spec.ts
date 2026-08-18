import { describe, it, expect, beforeEach } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal, provideZonelessChangeDetection } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute } from '@angular/router';
import { BASE_PATH } from '../../api-client';
import { AnalyticsComponent } from './analytics.component';
import { ModelReferenceApiService } from '../../services/model-reference-api.service';
import { ShellContextService } from '../../services/shell-context.service';
import { ViewerCapabilitiesService } from '../../services/viewer-capabilities.service';
import { of, ReplaySubject } from 'rxjs';
import { map } from 'rxjs/operators';

describe('AnalyticsComponent', () => {
  let fixture: ComponentFixture<AnalyticsComponent>;
  let nativeEl: HTMLElement;
  let shellContext: ShellContextService;

  const queryParamMapSubject = new ReplaySubject<Record<string, string>>(1);

  const backendCapabilities = signal({
    writable: true,
    mode: 'PRIMARY' as const,
    canonicalFormat: 'v2' as const,
  });

  const apiStub = {
    backendCapabilities: backendCapabilities.asReadonly(),
    getCategories: vi.fn().mockReturnValue(of(['image_generation', 'text_generation', 'clip'])),
    getCategoryStatistics: vi.fn().mockReturnValue(of(null)),
    getCategoryAudit: vi.fn().mockReturnValue(of(null)),
    getDisplayModelsAsArray: vi.fn().mockReturnValue(of([])),
  };

  const canSeeCuration = signal(false);

  const viewerStub = {
    canSeeCuration: canSeeCuration.asReadonly(),
    canPropose: signal(false).asReadonly(),
    canApprove: canSeeCuration.asReadonly(),
    canEditLicensing: signal(false).asReadonly(),
  };

  /** Re-render after flipping viewer entitlement, which the tab strip derives from. */
  const asCurator = async (): Promise<void> => {
    canSeeCuration.set(true);
    await fixture.whenStable();
    fixture.detectChanges();
  };

  beforeEach(async () => {
    queryParamMapSubject.next({ category: 'image_generation', tab: 'statistics' });
    canSeeCuration.set(false);

    await TestBed.configureTestingModule({
      imports: [AnalyticsComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: BASE_PATH, useValue: 'http://localhost:19800/api' },
        { provide: ModelReferenceApiService, useValue: apiStub },
        { provide: ViewerCapabilitiesService, useValue: viewerStub },
        {
          provide: ActivatedRoute,
          useValue: {
            queryParamMap: queryParamMapSubject.pipe(map((p) => new Map(Object.entries(p)))),
          },
        },
        ShellContextService,
      ],
    }).compileComponents();

    shellContext = TestBed.inject(ShellContextService);
    fixture = TestBed.createComponent(AnalyticsComponent);
    nativeEl = fixture.nativeElement;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should render category selector', () => {
    expect(nativeEl.querySelector('app-category-selector')).toBeTruthy();
  });

  it('should render the tab segmented control', () => {
    expect(nativeEl.querySelector('app-segmented-control')).toBeTruthy();
  });

  it('should hide the cache TTL badge from a visitor', () => {
    expect(nativeEl.textContent).not.toContain('Cache');
  });

  it('should render the cache TTL badge for a curator', async () => {
    await asCurator();
    expect(nativeEl.textContent).toContain('Cache');
  });

  it('should show statistics tab by default', () => {
    expect(nativeEl.querySelector('app-analytics-statistics')).toBeTruthy();
  });

  it('should fall back to statistics when a visitor requests the risk tab', async () => {
    // Deletion risk is a curation judgement; a bookmarked ?tab=risk must not reinstate it.
    queryParamMapSubject.next({ category: 'image_generation', tab: 'risk' });
    fixture.detectChanges();

    expect(nativeEl.querySelector('app-analytics-risk')).toBeNull();
    expect(nativeEl.querySelector('app-analytics-statistics')).toBeTruthy();
  });

  it('should show risk tab when query param is risk and the viewer is a curator', async () => {
    queryParamMapSubject.next({ category: 'image_generation', tab: 'risk' });
    await asCurator();

    expect(nativeEl.querySelector('app-analytics-risk')).toBeTruthy();
  });

  it('should show showcases tab when query param is showcases', async () => {
    queryParamMapSubject.next({ category: 'image_generation', tab: 'showcases' });
    fixture.detectChanges();

    expect(nativeEl.querySelector('app-analytics-showcases')).toBeTruthy();
  });

  it('should set shell context with breadcrumb and title', () => {
    const ctx = shellContext.context();
    expect(ctx.breadcrumb.length).toBeGreaterThan(0);
    expect(ctx.title).toBe('Catalog statistics');
  });

  it('should default to DEFAULT_CATEGORY when no category query param', async () => {
    queryParamMapSubject.next({});
    fixture.detectChanges();
    // Component should still work with default category
    expect(fixture.componentInstance).toBeTruthy();
  });
});
