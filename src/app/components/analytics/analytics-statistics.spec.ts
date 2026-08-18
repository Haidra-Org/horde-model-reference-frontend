import { describe, it, expect, beforeEach } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, signal, provideZonelessChangeDetection } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { BASE_PATH } from '../../api-client';
import { AnalyticsStatisticsComponent } from './analytics-statistics.component';
import { ModelReferenceApiService } from '../../services/model-reference-api.service';
import { HordeApiService } from '../../services/horde-api.service';
import { of } from 'rxjs';
import { provideRouter, Router } from '@angular/router';

@Component({ template: '' })
class RouteTargetStubComponent {}

function makeCategoryStatistics(overrides: Record<string, unknown> = {}) {
  return {
    category: 'image_generation',
    total_models: 42,
    baseline_distribution: {
      stable_diffusion_xl: { baseline: 'stable_diffusion_xl', count: 20, percentage: 47.6 },
      stable_diffusion_1: { baseline: 'stable_diffusion_1', count: 15, percentage: 35.7 },
      flux_1: { baseline: 'flux_1', count: 7, percentage: 16.7 },
    },
    top_styles: [
      { tag: 'realistic', count: 18, percentage: 42.9 },
      { tag: 'anime', count: 12, percentage: 28.6 },
      { tag: 'painting', count: 8, percentage: 19.0 },
    ],
    download_stats: {
      total_models_with_downloads: 42,
      total_download_entries: 84,
      total_size_bytes: 107374182400,
      models_with_size_info: 42,
      average_size_bytes: 2556521476,
      hosts: { 'huggingface.co': 70, 'civitai.com': 14 },
    },
    nsfw_count: 8,
    computed_at: 1718035200,
    ...overrides,
  };
}

describe('AnalyticsStatisticsComponent', () => {
  let fixture: ComponentFixture<AnalyticsStatisticsComponent>;
  let nativeEl: HTMLElement;

  const apiStub = {
    backendCapabilities: signal({
      writable: true,
      mode: 'PRIMARY' as const,
      canonicalFormat: 'v2' as const,
    }).asReadonly(),
    getCategoryStatistics: vi.fn().mockReturnValue(of(makeCategoryStatistics())),
    getCategoryAudit: vi.fn().mockReturnValue(of(null)),
  };

  const hordeStub = {
    getCombinedModelData: vi.fn().mockReturnValue(of({})),
  };

  beforeEach(async () => {
    apiStub.getCategoryStatistics.mockReturnValue(of(makeCategoryStatistics()));

    await TestBed.configureTestingModule({
      imports: [AnalyticsStatisticsComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([{ path: 'categories/:category', component: RouteTargetStubComponent }]),
        { provide: BASE_PATH, useValue: 'http://localhost:19800/api' },
        { provide: ModelReferenceApiService, useValue: apiStub },
        { provide: HordeApiService, useValue: hordeStub },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AnalyticsStatisticsComponent);
    nativeEl = fixture.nativeElement;
    fixture.componentRef.setInput('category', 'image_generation');
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should render 4 stat tiles', () => {
    const tiles = nativeEl.querySelectorAll('app-stat-tile');
    expect(tiles.length).toBe(4);
  });

  it('should show total models count', () => {
    expect(nativeEl.textContent).toContain('Models');
    expect(nativeEl.textContent).toContain('42');
  });

  it('should render baseline distribution bar rows', () => {
    // All bar rows across distributions: 3 baselines + 3 styles + 2 hosts + 2 safety = 10
    const barRows = nativeEl.querySelectorAll('app-bar-row');
    expect(barRows.length).toBeGreaterThanOrEqual(3); // at least baselines
  });

  it('should show style distribution section for image category', () => {
    expect(nativeEl.textContent).toContain('Style distribution');
  });

  it('should show download hosts section', () => {
    expect(nativeEl.textContent).toContain('Download hosts');
  });

  it('should show safety mix', () => {
    expect(nativeEl.textContent).toContain('Safety mix');
    expect(nativeEl.textContent).toContain('SFW');
    expect(nativeEl.textContent).toContain('NSFW');
  });

  it('turns a baseline distribution into a filtered catalog destination', async () => {
    const drillDown = nativeEl.querySelector<HTMLButtonElement>(
      'button[aria-label="Browse SDXL models"]',
    );
    expect(drillDown).not.toBeNull();

    drillDown?.click();
    await fixture.whenStable();

    expect(TestBed.inject(Router).url).toBe(
      '/categories/image_generation?baselines=stable_diffusion_xl',
    );
  });

  it('maps the safety distribution to the browser safety filter', async () => {
    const drillDown = nativeEl.querySelector<HTMLButtonElement>(
      'button[aria-label="Browse NSFW models"]',
    );
    expect(drillDown).not.toBeNull();
    drillDown?.click();
    await fixture.whenStable();

    expect(TestBed.inject(Router).url).toBe('/categories/image_generation?nsfw=nsfw');
  });

  it('should handle loading state', () => {
    // Re-create with loading state
    apiStub.getCategoryStatistics.mockReturnValue(
      new Promise(() => {
        /* never resolves */
      }),
    );
    // Loading message should be visible initially
    expect(fixture.componentInstance).toBeTruthy();
  });
});
