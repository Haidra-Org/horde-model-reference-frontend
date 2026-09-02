import { describe, it, expect, beforeEach } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal, provideZonelessChangeDetection } from '@angular/core';
import { provideHttpClient, withXhr } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { BASE_PATH } from '../../api-client';
import { ActivatedRoute } from '@angular/router';
import { AnalyticsRiskComponent } from './analytics-risk.component';
import { ModelReferenceApiService } from '../../services/model-reference-api.service';
import { of } from 'rxjs';
import type { CategoryDeletionRiskResponse } from '../../api-client/model/categoryDeletionRiskResponse';

function makeRiskResponse(
  overrides: Partial<CategoryDeletionRiskResponse> = {},
): CategoryDeletionRiskResponse {
  return {
    category: 'image_generation',
    category_total_month_usage: 5000000,
    total_count: 42,
    returned_count: 42,
    models: [
      {
        name: 'risky-model-1',
        category: 'image_generation',
        deletion_risk_flags: {
          zero_usage_month: true,
          no_active_workers: true,
          has_non_preferred_host: true,
        },
        at_risk: true,
        is_critical: true,
        has_warning: true,
        risk_score: 3,
        worker_count: 0,
        usage_day: 0,
        usage_month: 0,
        usage_total: 100,
        usage_percentage_of_category: 0,
        usage_trend: { day_to_month_ratio: null, month_to_total_ratio: 0 },
        cost_benefit_score: 1.5,
        size_gb: 4.2,
        download_hosts: ['civitai.com'],
        has_description: true,
        download_count: 1,
      },
      {
        name: 'healthy-model',
        category: 'image_generation',
        deletion_risk_flags: {},
        at_risk: false,
        is_critical: false,
        has_warning: false,
        risk_score: 0,
        worker_count: 12,
        usage_day: 500,
        usage_month: 15000,
        usage_total: 200000,
        usage_percentage_of_category: 0.3,
        usage_trend: { day_to_month_ratio: 0.033, month_to_total_ratio: 0.075 },
        cost_benefit_score: 9.5,
        size_gb: 6.8,
        download_hosts: ['huggingface.co'],
        has_description: true,
        download_count: 2,
      },
    ],
    summary: {
      total_models: 42,
      models_at_risk: 12,
      models_critical: 3,
      models_with_warnings: 8,
      models_with_no_active_workers: 5,
      models_with_non_preferred_hosts: 7,
      models_with_low_usage: 10,
      average_risk_score: 1.4,
      category_total_month_usage: 5000000,
    },
    ...overrides,
  };
}

describe('AnalyticsRiskComponent', () => {
  let fixture: ComponentFixture<AnalyticsRiskComponent>;
  let nativeEl: HTMLElement;

  const apiStub = {
    backendCapabilities: signal({
      writable: true,
      mode: 'PRIMARY' as const,
      canonicalFormat: 'v2' as const,
    }).asReadonly(),
    getCategoryAudit: vi.fn().mockReturnValue(of(makeRiskResponse())),
    getCategoryStatistics: vi.fn().mockReturnValue(of(null)),
  };

  beforeEach(async () => {
    apiStub.getCategoryAudit.mockReturnValue(of(makeRiskResponse()));

    await TestBed.configureTestingModule({
      imports: [AnalyticsRiskComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(withXhr()),
        provideHttpClientTesting(),
        { provide: BASE_PATH, useValue: 'http://localhost:19800/api' },
        { provide: ModelReferenceApiService, useValue: apiStub },
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: new Map() } } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AnalyticsRiskComponent);
    nativeEl = fixture.nativeElement;
    fixture.componentRef.setInput('category', 'image_generation');
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should render risk stat cards (5 tiles)', () => {
    const tiles = nativeEl.querySelectorAll('app-stat-tile');
    expect(tiles.length).toBe(5);
  });

  it('should show total models count', () => {
    expect(nativeEl.textContent).toContain('Total models');
    expect(nativeEl.textContent).toContain('42');
  });

  it('should show models at risk count', () => {
    expect(nativeEl.textContent).toContain('At risk');
    expect(nativeEl.textContent).toContain('12');
  });

  it('should show critical count', () => {
    expect(nativeEl.textContent).toContain('Critical');
    expect(nativeEl.textContent).toContain('3');
  });

  it('should render preset filter chips', () => {
    const chips = nativeEl.querySelectorAll('.filter-chip');
    expect(chips.length).toBe(6); // all, at_risk, critical, no_workers, low_usage, bad_host
  });

  it('should render the risk table', () => {
    expect(nativeEl.querySelector('.analytics-risk-table')).toBeTruthy();
  });

  it('should show model names in the table', () => {
    expect(nativeEl.textContent).toContain('risky-model-1');
    expect(nativeEl.textContent).toContain('healthy-model');
  });

  it('should show flag badges for at-risk models', () => {
    const badges = nativeEl.querySelectorAll('.badge-warning');
    expect(badges.length).toBeGreaterThan(0);
  });

  it('should show info banner', () => {
    expect(nativeEl.textContent).toContain('Deletion risk');
  });

  it('should show group toggle for text category', async () => {
    fixture.componentRef.setInput('category', 'text_generation');
    fixture.detectChanges();

    // Text domain should show group variants toggle
    expect(nativeEl.querySelector('app-segmented-control')).toBeTruthy();
  });

  it('routes grouped text risk rows to the group and its filtered exact-model list', () => {
    fixture.componentRef.setInput('category', 'text_generation');
    fixture.detectChanges();

    const destinations = Array.from<HTMLAnchorElement>(
      nativeEl.querySelectorAll('.analytics-risk-table a'),
    ).map((link) => link.getAttribute('href'));
    expect(destinations).toContain('/text-groups/group?name=risky-model-1');
    expect(destinations).toContain('/categories/text_generation?groups=risky-model-1');
    expect(destinations).not.toContain('/categories/text_generation/model/risky-model-1?tab=risk');
  });
});
