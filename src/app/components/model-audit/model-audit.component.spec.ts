import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { ModelAuditComponent } from './model-audit.component';
import { ModelReferenceApiService } from '../../services/model-reference-api.service';
import { NotificationService } from '../../services/notification.service';
import type {
  CategoryAuditResponse,
  ModelAuditInfo,
  MODEL_REFERENCE_CATEGORY,
} from '../../api-client';
import {
  ModelAuditInfoBuilder,
  CategoryAuditResponseBuilder,
  generateLargeAuditResponse,
} from '../../models/test-helpers/audit-test-helpers';

// Helper function to set up CSV export mocks
function setupCSVExportMocks() {
  const mockLink = document.createElement('a');
  const createObjectURLSpy = spyOn(URL, 'createObjectURL').and.returnValue('blob:mock-url');
  const originalCreateElement = document.createElement.bind(document);

  spyOn(document, 'createElement').and.callFake((tagName: string) => {
    if (tagName === 'a') {
      return mockLink;
    }
    return originalCreateElement(tagName);
  });

  const appendChildSpy = spyOn(document.body, 'appendChild').and.callThrough();
  const removeChildSpy = spyOn(document.body, 'removeChild').and.callThrough();
  const clickSpy = spyOn(mockLink, 'click');

  return {
    mockLink,
    createObjectURLSpy,
    appendChildSpy,
    removeChildSpy,
    clickSpy,
  };
}

describe('ModelAuditComponent', () => {
  let component: ModelAuditComponent;
  let fixture: ComponentFixture<ModelAuditComponent>;
  let apiService: jasmine.SpyObj<ModelReferenceApiService>;
  let notificationService: jasmine.SpyObj<NotificationService>;
  const mockModels = [
    {
      name: 'test-model-1',
      baseline: 'stable_diffusion_xl',
      nsfw: false,
      description: 'Test model 1',
      usageStats: {
        day: 10,
        month: 100,
        total: 500,
      },
      workerCount: 5,
      inpainting: false,
    },
    {
      name: 'test-model-2',
      baseline: 'stable_diffusion_1',
      nsfw: true,
      description: 'Test model 2',
      usageStats: {
        day: 5,
        month: 50,
        total: 200,
      },
      workerCount: 2,
      inpainting: false,
    },
  ];

  const mockAuditResponse: CategoryAuditResponse = {
    category: 'image_generation',
    category_total_month_usage: 150,
    total_count: 2,
    returned_count: 2,
    offset: 0,
    models: [
      {
        name: 'test-model-1',
        category: 'image_generation',
        usage_day: 10,
        usage_month: 100,
        usage_total: 500,
        usage_hour: 1,
        usage_minute: 0,
        usage_percentage_of_category: 66.67,
        usage_trend: {
          day_to_month_ratio: 0.1,
          month_to_total_ratio: 0.2,
        },
        deletion_risk_flags: {
          zero_usage_day: false,
          zero_usage_month: false,
          zero_usage_total: false,
          no_active_workers: false,
          has_multiple_hosts: false,
          has_non_preferred_host: false,
          has_unknown_host: false,
          no_download_urls: false,
          missing_description: false,
          missing_baseline: false,
          low_usage: false,
        },
        risk_score: 0,
        at_risk: false,
        worker_count: 5,
        baseline: 'stable_diffusion_xl',
        nsfw: false,
        has_description: true,
        download_count: 2,
        download_hosts: ['huggingface.co'],
        cost_benefit_score: 40.0,
        size_gb: 2.5,
      } as ModelAuditInfo,
      {
        name: 'test-model-2',
        category: 'image_generation',
        usage_day: 5,
        usage_month: 50,
        usage_total: 200,
        usage_hour: 0,
        usage_minute: null,
        usage_percentage_of_category: 33.33,
        usage_trend: {
          day_to_month_ratio: 0.1,
          month_to_total_ratio: 0.25,
        },
        deletion_risk_flags: {
          zero_usage_day: false,
          zero_usage_month: false,
          zero_usage_total: false,
          no_active_workers: false,
          has_multiple_hosts: false,
          has_non_preferred_host: false,
          has_unknown_host: false,
          no_download_urls: false,
          missing_description: false,
          missing_baseline: false,
          low_usage: false,
        },
        risk_score: 0,
        at_risk: false,
        worker_count: 2,
        baseline: 'stable_diffusion_1',
        nsfw: true,
        has_description: true,
        download_count: 1,
        download_hosts: ['civitai.com'],
        cost_benefit_score: null,
        size_gb: null,
      } as ModelAuditInfo,
    ],
    summary: {
      total_models: 2,
      models_at_risk: 0,
      models_critical: 0,
      models_with_warnings: 0,
      models_with_zero_day_usage: 0,
      models_with_zero_month_usage: 0,
      models_with_zero_total_usage: 0,
      models_with_no_active_workers: 0,
      models_with_no_downloads: 0,
      models_with_non_preferred_hosts: 0,
      models_with_multiple_hosts: 0,
      models_with_low_usage: 0,
      average_risk_score: 0,
      category_total_month_usage: 150,
    },
  };

  beforeEach(async () => {
    const apiServiceSpy = jasmine.createSpyObj('ModelReferenceApiService', [
      'getLegacyModelsAsArray',
      'getCategoryAudit',
    ]);
    const notificationServiceSpy = jasmine.createSpyObj('NotificationService', [
      'error',
      'warning',
      'success',
    ]);

    await TestBed.configureTestingModule({
      imports: [ModelAuditComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: ModelReferenceApiService, useValue: apiServiceSpy },
        { provide: NotificationService, useValue: notificationServiceSpy },
        {
          provide: ActivatedRoute,
          useValue: {
            params: of({ category: 'image_generation' }),
          },
        },
      ],
    }).compileComponents();

    apiService = TestBed.inject(
      ModelReferenceApiService,
    ) as jasmine.SpyObj<ModelReferenceApiService>;
    notificationService = TestBed.inject(
      NotificationService,
    ) as jasmine.SpyObj<NotificationService>;

    fixture = TestBed.createComponent(ModelAuditComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('initialization and data loading', () => {
    it('should load models and audit data on init', () => {
      apiService.getLegacyModelsAsArray.and.returnValue(of(mockModels));
      apiService.getCategoryAudit.and.returnValue(of(mockAuditResponse));

      fixture.detectChanges(); // Triggers ngOnInit

      expect(component.category()).toBe('image_generation');
      expect(component.models().length).toBe(2);
      expect(component.auditResponse()).toEqual(mockAuditResponse);
      expect(component.loading()).toBe(false);
      expect(component.degradedMode()).toBe(false);
    });

    it('should enter degraded mode when audit API fails', () => {
      apiService.getLegacyModelsAsArray.and.returnValue(of(mockModels));
      apiService.getCategoryAudit.and.returnValue(of(null));

      fixture.detectChanges();

      expect(component.degradedMode()).toBe(true);
      expect(notificationService.warning).toHaveBeenCalledWith(
        jasmine.stringContaining('Audit analysis unavailable'),
      );
    });

    it('should handle model loading error', () => {
      apiService.getLegacyModelsAsArray.and.returnValue(throwError(() => new Error('API error')));

      fixture.detectChanges();

      expect(notificationService.error).toHaveBeenCalled();
      expect(component.loading()).toBe(false);
    });

    it('should display loading state initially', () => {
      apiService.getLegacyModelsAsArray.and.returnValue(of(mockModels));
      apiService.getCategoryAudit.and.returnValue(of(mockAuditResponse));

      expect(component.loading()).toBe(true);
    });

    it('should display category in the header', () => {
      apiService.getLegacyModelsAsArray.and.returnValue(of(mockModels));
      apiService.getCategoryAudit.and.returnValue(of(mockAuditResponse));

      fixture.detectChanges();

      const headerText = fixture.nativeElement.querySelector('h1, h2')?.textContent;
      expect(headerText).toContain('Image Generation');
    });
  });

  describe('computed properties', () => {
    beforeEach(() => {
      apiService.getLegacyModelsAsArray.and.returnValue(of(mockModels));
      apiService.getCategoryAudit.and.returnValue(of(mockAuditResponse));
      fixture.detectChanges();
    });

    it('should compute category total usage from audit response', () => {
      expect(component.categoryTotalUsage()).toBe(150);
    });

    it('should map audit info to models with metrics', () => {
      const metricsModels = component.modelsWithAuditMetrics();
      expect(metricsModels.length).toBe(2);
      expect(metricsModels[0].model.name).toBe('test-model-1');
      expect(metricsModels[0].auditInfo).toBeTruthy();
      expect(metricsModels[0].usagePercentage).toBeCloseTo(66.67);
      expect(metricsModels[0].flags).toBeTruthy();
      expect(metricsModels[0].isCritical).toBe(false);
    });

    it('should correctly identify text generation category', () => {
      component.category.set('text_generation');
      expect(component.isTextGeneration()).toBe(true);
      expect(component.isImageGeneration()).toBe(false);
    });

    it('should correctly identify image generation category', () => {
      component.category.set('image_generation');
      expect(component.isImageGeneration()).toBe(true);
      expect(component.isTextGeneration()).toBe(false);
    });
  });

  describe('degraded mode', () => {
    beforeEach(() => {
      apiService.getLegacyModelsAsArray.and.returnValue(of(mockModels));
      apiService.getCategoryAudit.and.returnValue(of(null));
      fixture.detectChanges();
    });

    it('should compute metrics without audit data in degraded mode', () => {
      const metricsModels = component.modelsWithAuditMetrics();
      expect(metricsModels.length).toBe(2);
      expect(metricsModels[0].auditInfo).toBeNull();
      expect(metricsModels[0].flags).toBeNull();
      expect(metricsModels[0].isCritical).toBe(false);
      expect(metricsModels[0].hasWarning).toBe(false);
    });

    it('should calculate usage percentage in degraded mode', () => {
      const metricsModels = component.modelsWithAuditMetrics();
      // 100 / 150 * 100 = 66.67
      expect(metricsModels[0].usagePercentage).toBeCloseTo(66.67);
      // 50 / 150 * 100 = 33.33
      expect(metricsModels[1].usagePercentage).toBeCloseTo(33.33);
    });

    it('should calculate usage trends in degraded mode', () => {
      const metricsModels = component.modelsWithAuditMetrics();
      const trend = metricsModels[0].usageTrend;
      // day_to_month: 10 / 100 = 0.1
      expect(trend.dayToMonthRatio).toBeCloseTo(0.1);
      // month_to_total: 100 / 500 = 0.2
      expect(trend.monthToTotalRatio).toBeCloseTo(0.2);
    });
  });

  describe('critical and warning flags', () => {
    it('should identify critical models (zero month usage AND no workers)', () => {
      const criticalAudit: CategoryAuditResponse = {
        ...mockAuditResponse,
        models: [
          {
            ...mockAuditResponse.models[0],
            usage_month: 0,
            worker_count: 0,
            deletion_risk_flags: {
              ...mockAuditResponse.models[0].deletion_risk_flags,
              zero_usage_month: true,
              no_active_workers: true,
            },
            risk_score: 2,
            at_risk: true,
          } as ModelAuditInfo,
        ],
      };

      apiService.getLegacyModelsAsArray.and.returnValue(of(mockModels));
      apiService.getCategoryAudit.and.returnValue(of(criticalAudit));

      fixture.detectChanges();

      const metricsModels = component.modelsWithAuditMetrics();
      expect(metricsModels[0].isCritical).toBe(true);
    });

    it('should identify models with warnings (host issues)', () => {
      const warningAudit: CategoryAuditResponse = {
        ...mockAuditResponse,
        models: [
          {
            ...mockAuditResponse.models[0],
            deletion_risk_flags: {
              ...mockAuditResponse.models[0].deletion_risk_flags,
              has_multiple_hosts: true,
              has_non_preferred_host: true,
            },
            risk_score: 2,
            at_risk: true,
          } as ModelAuditInfo,
        ],
      };

      apiService.getLegacyModelsAsArray.and.returnValue(of(mockModels));
      apiService.getCategoryAudit.and.returnValue(of(warningAudit));

      fixture.detectChanges();

      const metricsModels = component.modelsWithAuditMetrics();
      expect(metricsModels[0].hasWarning).toBe(true);
    });
  });

  describe('sorting', () => {
    beforeEach(() => {
      apiService.getLegacyModelsAsArray.and.returnValue(of(mockModels));
      apiService.getCategoryAudit.and.returnValue(of(mockAuditResponse));
      fixture.detectChanges();
    });

    it('should sort models by usage month ascending', () => {
      component.toggleSort('usageMonth');
      expect(component.sortColumn()).toBe('usageMonth');
      expect(component.sortDirection()).toBe('asc');

      const sorted = component.sortedFilteredModels();
      expect(sorted[0].model.name).toBe('test-model-2'); // 50 usage
      expect(sorted[1].model.name).toBe('test-model-1'); // 100 usage
    });

    it('should sort models by usage month descending', () => {
      component.toggleSort('usageMonth');
      component.toggleSort('usageMonth'); // Toggle again for desc

      expect(component.sortDirection()).toBe('desc');

      const sorted = component.sortedFilteredModels();
      expect(sorted[0].model.name).toBe('test-model-1'); // 100 usage
      expect(sorted[1].model.name).toBe('test-model-2'); // 50 usage
    });

    it('should clear sort when toggling three times', () => {
      component.toggleSort('usageMonth');
      component.toggleSort('usageMonth');
      component.toggleSort('usageMonth'); // Third toggle clears

      expect(component.sortColumn()).toBeNull();
      expect(component.sortDirection()).toBeNull();
    });
  });

  describe('preset filtering', () => {
    it('should request audit data with preset parameter', () => {
      const filteredAudit: CategoryAuditResponse = {
        ...mockAuditResponse,
        total_count: 2,
        returned_count: 1,
        models: [mockAuditResponse.models[0]],
      };

      apiService.getLegacyModelsAsArray.and.returnValue(of(mockModels));
      apiService.getCategoryAudit.and.returnValue(of(filteredAudit));

      fixture.detectChanges();

      component.selectedPresetName.set('Zero Usage');
      component.refreshAuditData();

      expect(apiService.getCategoryAudit).toHaveBeenCalledWith(
        'image_generation',
        false,
        'zero_usage',
      );
    });
  });

  describe('data staleness detection', () => {
    beforeEach(() => {
      apiService.getLegacyModelsAsArray.and.returnValue(of(mockModels));
      apiService.getCategoryAudit.and.returnValue(of(mockAuditResponse));
      fixture.detectChanges();
    });

    it('should detect fresh data', () => {
      component.lastRefreshTime.set(Date.now());
      expect(component.isDataStale()).toBe(false);
    });

    it('should detect stale data (> 5 minutes)', () => {
      const sixMinutesAgo = Date.now() - 6 * 60 * 1000;
      component.lastRefreshTime.set(sixMinutesAgo);
      expect(component.isDataStale()).toBe(true);
    });
  });

  describe('selection functionality', () => {
    beforeEach(() => {
      apiService.getLegacyModelsAsArray.and.returnValue(of(mockModels));
      apiService.getCategoryAudit.and.returnValue(of(mockAuditResponse));
      fixture.detectChanges();
    });

    it('should toggle model selection', () => {
      component.toggleModelSelection('test-model-1');
      expect(component.isModelSelected('test-model-1')).toBe(true);

      component.toggleModelSelection('test-model-1');
      expect(component.isModelSelected('test-model-1')).toBe(false);
    });

    it('should select all models', () => {
      component.selectAll();
      expect(component.selectedModels().size).toBe(2);
      expect(component.isModelSelected('test-model-1')).toBe(true);
      expect(component.isModelSelected('test-model-2')).toBe(true);
    });

    it('should clear all selections', () => {
      component.selectAll();
      component.selectNone();
      expect(component.selectedModels().size).toBe(0);
    });

    it('should count selected models', () => {
      component.toggleModelSelection('test-model-1');
      expect(component.selectedCount()).toBe(1);

      component.toggleModelSelection('test-model-2');
      expect(component.selectedCount()).toBe(2);
    });
  });

  describe('usage statistics extraction', () => {
    beforeEach(() => {
      apiService.getLegacyModelsAsArray.and.returnValue(of(mockModels));
      apiService.getCategoryAudit.and.returnValue(of(mockAuditResponse));
      fixture.detectChanges();
    });

    it('should extract usage day from audit info', () => {
      const metrics = component.modelsWithAuditMetrics()[0];
      expect(component.getUsageDay(metrics)).toBe(10);
    });

    it('should extract usage month from audit info', () => {
      const metrics = component.modelsWithAuditMetrics()[0];
      expect(component.getUsageMonth(metrics)).toBe(100);
    });

    it('should extract usage total from audit info', () => {
      const metrics = component.modelsWithAuditMetrics()[0];
      expect(component.getUsageTotal(metrics)).toBe(500);
    });

    it('should fall back to model usage stats in degraded mode', () => {
      apiService.getCategoryAudit.and.returnValue(of(null));
      fixture.detectChanges();

      const metrics = component.modelsWithAuditMetrics()[0];
      expect(component.getUsageDay(metrics)).toBe(10);
      expect(component.getUsageMonth(metrics)).toBe(100);
      expect(component.getUsageTotal(metrics)).toBe(500);
    });
  });

  describe('row styling', () => {
    it('should apply critical styling for critical models', () => {
      const criticalAudit: CategoryAuditResponse = {
        ...mockAuditResponse,
        models: [
          {
            ...mockAuditResponse.models[0],
            deletion_risk_flags: {
              ...mockAuditResponse.models[0].deletion_risk_flags,
              zero_usage_month: true,
              no_active_workers: true,
            },
          } as ModelAuditInfo,
        ],
      };

      apiService.getLegacyModelsAsArray.and.returnValue(of(mockModels));
      apiService.getCategoryAudit.and.returnValue(of(criticalAudit));

      fixture.detectChanges();

      const metrics = component.modelsWithAuditMetrics()[0];
      const rowClass = component.getRowClass(metrics);
      expect(rowClass).toContain('border-danger-500');
    });

    it('should apply warning styling for models with warnings', () => {
      const warningAudit: CategoryAuditResponse = {
        ...mockAuditResponse,
        models: [
          {
            ...mockAuditResponse.models[0],
            deletion_risk_flags: {
              ...mockAuditResponse.models[0].deletion_risk_flags,
              has_multiple_hosts: true,
            },
          } as ModelAuditInfo,
        ],
      };

      apiService.getLegacyModelsAsArray.and.returnValue(of(mockModels));
      apiService.getCategoryAudit.and.returnValue(of(warningAudit));

      fixture.detectChanges();

      const metrics = component.modelsWithAuditMetrics()[0];
      const rowClass = component.getRowClass(metrics);
      expect(rowClass).toContain('border-warning-500');
    });

    it('should not apply special styling in degraded mode', () => {
      apiService.getLegacyModelsAsArray.and.returnValue(of(mockModels));
      apiService.getCategoryAudit.and.returnValue(of(null));

      fixture.detectChanges();

      const metrics = component.modelsWithAuditMetrics()[0];
      const rowClass = component.getRowClass(metrics);
      expect(rowClass).toBe('');
    });
  });

  describe('CSV export', () => {
    it('should create CSV blob with correct content structure', () => {
      apiService.getLegacyModelsAsArray.and.returnValue(of(mockModels));
      apiService.getCategoryAudit.and.returnValue(of(mockAuditResponse));
      fixture.detectChanges();

      const { createObjectURLSpy } = setupCSVExportMocks();
      component.exportToCSV();

      expect(createObjectURLSpy).toHaveBeenCalled();
      const blobArgs = createObjectURLSpy.calls.mostRecent().args[0] as Blob;
      expect(blobArgs.type).toBe('text/csv;charset=utf-8;');
    });

    it('should trigger download with correct filename', () => {
      apiService.getLegacyModelsAsArray.and.returnValue(of(mockModels));
      apiService.getCategoryAudit.and.returnValue(of(mockAuditResponse));
      fixture.detectChanges();

      const { mockLink, clickSpy } = setupCSVExportMocks();
      component.category.set('image_generation');
      component.exportToCSV();

      expect(mockLink.download).toBe('model-audit-image_generation.csv');
      expect(mockLink.href).toBe('blob:mock-url');
      expect(clickSpy).toHaveBeenCalled();
    });

    it('should include all models in CSV export', () => {
      apiService.getLegacyModelsAsArray.and.returnValue(of(mockModels));
      apiService.getCategoryAudit.and.returnValue(of(mockAuditResponse));
      fixture.detectChanges();

      const { createObjectURLSpy, appendChildSpy, removeChildSpy, mockLink } =
        setupCSVExportMocks();
      component.exportToCSV();

      expect(createObjectURLSpy).toHaveBeenCalled();
      expect(appendChildSpy).toHaveBeenCalledWith(mockLink);
      expect(removeChildSpy).toHaveBeenCalledWith(mockLink);
    });

    it('should handle models with special characters in CSV', () => {
      const specialModels = [
        {
          name: 'model, with comma',
          baseline: 'stable_diffusion_1',
          nsfw: false,
          description: 'Test "quotes"',
          usageStats: { day: 10, month: 100, total: 500 },
          workerCount: 5,
          inpainting: false,
        },
      ];

      const specialAudit = new CategoryAuditResponseBuilder()
        .withCategory('image_generation' as MODEL_REFERENCE_CATEGORY)
        .withCategoryTotalUsage(100)
        .withModels([
          new ModelAuditInfoBuilder().withName('model, with comma').withUsage(10, 100, 500).build(),
        ])
        .build();

      apiService.getLegacyModelsAsArray.and.returnValue(of(specialModels));
      apiService.getCategoryAudit.and.returnValue(of(specialAudit));

      fixture.detectChanges();

      const { createObjectURLSpy } = setupCSVExportMocks();
      component.exportToCSV();

      expect(createObjectURLSpy).toHaveBeenCalled();
    });
  });

  describe('performance with large datasets', () => {
    it('should handle 100 models without performance issues', () => {
      const largeDataset = generateLargeAuditResponse(100);
      const largeModels = largeDataset.models.map((m) => ({
        name: m.name,
        baseline: m.baseline ?? 'stable_diffusion_1',
        nsfw: m.nsfw ?? false,
        usageStats: {
          day: m.usage_day ?? 0,
          month: m.usage_month ?? 0,
          total: m.usage_total ?? 0,
        },
        workerCount: m.worker_count ?? 0,
        inpainting: false,
      }));

      apiService.getLegacyModelsAsArray.and.returnValue(of(largeModels));
      apiService.getCategoryAudit.and.returnValue(of(largeDataset));

      const startTime = performance.now();
      fixture.detectChanges();

      const duration = performance.now() - startTime;
      expect(component.models().length).toBe(100);
      expect(component.modelsWithAuditMetrics().length).toBe(100);
      expect(duration).toBeLessThan(2000); // Under 2 seconds for 100 models
    });

    it('should sort large datasets efficiently', () => {
      const largeDataset = generateLargeAuditResponse(500);
      const largeModels = largeDataset.models.map((m) => ({
        name: m.name,
        baseline: m.baseline ?? 'stable_diffusion_1',
        nsfw: m.nsfw ?? false,
        usageStats: {
          day: m.usage_day ?? 0,
          month: m.usage_month ?? 0,
          total: m.usage_total ?? 0,
        },
        workerCount: m.worker_count ?? 0,
        inpainting: false,
      }));

      apiService.getLegacyModelsAsArray.and.returnValue(of(largeModels));
      apiService.getCategoryAudit.and.returnValue(of(largeDataset));

      fixture.detectChanges();

      const startTime = performance.now();
      component.toggleSort('usageMonth');
      const sorted = component.sortedFilteredModels();
      const duration = performance.now() - startTime;

      expect(sorted.length).toBe(500);
      expect(duration).toBeLessThan(200); // Under 200ms for sorting
    });

    it('should export large datasets to CSV efficiently', () => {
      const largeDataset = generateLargeAuditResponse(1000);
      const largeModels = largeDataset.models.map((m) => ({
        name: m.name,
        baseline: m.baseline ?? 'stable_diffusion_1',
        nsfw: m.nsfw ?? false,
        usageStats: {
          day: m.usage_day ?? 0,
          month: m.usage_month ?? 0,
          total: m.usage_total ?? 0,
        },
        workerCount: m.worker_count ?? 0,
        inpainting: false,
      }));

      apiService.getLegacyModelsAsArray.and.returnValue(of(largeModels));
      apiService.getCategoryAudit.and.returnValue(of(largeDataset));

      fixture.detectChanges();

      setupCSVExportMocks();

      const startTime = performance.now();
      component.exportToCSV();
      const duration = performance.now() - startTime;

      expect(duration).toBeLessThan(1000); // Under 1 second for CSV export
    });
  });

  describe('edge cases', () => {
    it('should handle empty models array', () => {
      apiService.getLegacyModelsAsArray.and.returnValue(of([]));
      apiService.getCategoryAudit.and.returnValue(
        of(
          new CategoryAuditResponseBuilder()
            .withCategory('image_generation' as MODEL_REFERENCE_CATEGORY)
            .withCategoryTotalUsage(0)
            .withModels([])
            .build(),
        ),
      );

      fixture.detectChanges();

      expect(component.models().length).toBe(0);
      expect(component.modelsWithAuditMetrics().length).toBe(0);
      expect(component.categoryTotalUsage()).toBe(0);
    });

    it('should handle zero category total usage (division by zero)', () => {
      const zeroUsageAudit = new CategoryAuditResponseBuilder()
        .withCategory('image_generation' as MODEL_REFERENCE_CATEGORY)
        .withCategoryTotalUsage(0)
        .withModels([
          new ModelAuditInfoBuilder()
            .withName('test-model-1')
            .withUsage(0, 0, 0)
            .withUsagePercentage(0)
            .build(),
        ])
        .build();

      apiService.getLegacyModelsAsArray.and.returnValue(of(mockModels));
      apiService.getCategoryAudit.and.returnValue(of(zeroUsageAudit));

      fixture.detectChanges();

      const metrics = component.modelsWithAuditMetrics()[0];
      expect(metrics.usagePercentage).toBe(0);
      expect(isNaN(metrics.usagePercentage)).toBe(false);
    });

    it('should handle null/undefined optional fields in audit info', () => {
      const nullFieldsAudit = new CategoryAuditResponseBuilder()
        .withCategory('image_generation' as MODEL_REFERENCE_CATEGORY)
        .withCategoryTotalUsage(100)
        .withModels([
          new ModelAuditInfoBuilder().withName('test-model-1').withUsage(10, 100, 500).build(), // All optional fields remain null
        ])
        .build();

      apiService.getLegacyModelsAsArray.and.returnValue(of(mockModels));
      apiService.getCategoryAudit.and.returnValue(of(nullFieldsAudit));

      fixture.detectChanges();

      const metrics = component.modelsWithAuditMetrics()[0];
      expect(metrics.costBenefitScore).toBeNull();
      expect(metrics.sizeGB).toBeNull();
      expect(metrics.baseline).toBeNull();
    });

    it('should detect staleness at exact 5 minute boundary', () => {
      apiService.getLegacyModelsAsArray.and.returnValue(of(mockModels));
      apiService.getCategoryAudit.and.returnValue(of(mockAuditResponse));

      fixture.detectChanges();

      const now = Date.now();
      // Exactly 5 minutes and 1ms ago (should be stale)
      const fiveMinutesAgo = now - 300001;
      component.lastRefreshTime.set(fiveMinutesAgo);
      expect(component.isDataStale()).toBe(true);

      // Just under 5 minutes (should not be stale)
      const almostFiveMinutes = now - 299000;
      component.lastRefreshTime.set(almostFiveMinutes);
      expect(component.isDataStale()).toBe(false);
    });

    it('should handle all critical flag combinations', () => {
      const criticalCombos = new CategoryAuditResponseBuilder()
        .withCategory('image_generation' as MODEL_REFERENCE_CATEGORY)
        .withCategoryTotalUsage(100)
        .withModels([
          new ModelAuditInfoBuilder().withName('critical-model').withCriticalFlags().build(),
          new ModelAuditInfoBuilder().withName('warning-model').withWarningFlags().build(),
          new ModelAuditInfoBuilder()
            .withName('both-flags')
            .withFlags({
              zero_usage_month: true,
              no_active_workers: true,
              has_multiple_hosts: true,
              has_non_preferred_host: true,
            })
            .withRiskScore(4)
            .build(),
        ])
        .build();

      const comboModels = [
        {
          name: 'critical-model',
          baseline: 'stable_diffusion_1',
          nsfw: false,
          usageStats: { day: 0, month: 0, total: 0 },
          workerCount: 0,
          inpainting: false,
        },
        {
          name: 'warning-model',
          baseline: 'stable_diffusion_1',
          nsfw: false,
          usageStats: { day: 10, month: 100, total: 500 },
          workerCount: 5,
          inpainting: false,
        },
        {
          name: 'both-flags',
          baseline: 'stable_diffusion_1',
          nsfw: false,
          usageStats: { day: 0, month: 0, total: 0 },
          workerCount: 0,
          inpainting: false,
        },
      ];

      apiService.getLegacyModelsAsArray.and.returnValue(of(comboModels));
      apiService.getCategoryAudit.and.returnValue(of(criticalCombos));

      fixture.detectChanges();

      const metrics = component.modelsWithAuditMetrics();
      expect(metrics[0].isCritical).toBe(true); // Critical only
      expect(metrics[1].isCritical).toBe(false); // Warning only
      expect(metrics[1].hasWarning).toBe(true);
      expect(metrics[2].isCritical).toBe(true); // Both (critical takes precedence)
      expect(metrics[2].hasWarning).toBe(true);
    });

    it('should handle text_generation category differences', () => {
      component.category.set('text_generation');
      expect(component.isTextGeneration()).toBe(true);
      expect(component.isImageGeneration()).toBe(false);
      expect(component.recordDisplayName()).toBe('Text Generation');
    });

    it('should handle models with null usage stats in degraded mode', () => {
      const modelsWithoutStats = [
        {
          name: 'no-stats-model',
          baseline: 'stable_diffusion_1',
          nsfw: false,
          workerCount: 5,
          inpainting: false,
        },
      ];

      apiService.getLegacyModelsAsArray.and.returnValue(of(modelsWithoutStats));
      apiService.getCategoryAudit.and.returnValue(of(null));

      fixture.detectChanges();

      const metrics = component.modelsWithAuditMetrics()[0];
      expect(component.getUsageDay(metrics)).toBe(0);
      expect(component.getUsageMonth(metrics)).toBe(0);
      expect(component.getUsageTotal(metrics)).toBe(0);
    });

    it('should handle extreme usage values', () => {
      const extremeModels = [
        {
          name: 'extreme-model',
          baseline: 'stable_diffusion_1',
          nsfw: false,
          usageStats: { day: 999999999, month: 999999999, total: 999999999 },
          workerCount: 5,
          inpainting: false,
        },
      ];

      const extremeAudit = new CategoryAuditResponseBuilder()
        .withCategory('image_generation' as MODEL_REFERENCE_CATEGORY)
        .withCategoryTotalUsage(1000000000) // 1 billion
        .withModels([
          new ModelAuditInfoBuilder()
            .withName('extreme-model')
            .withUsage(999999999, 999999999, 999999999)
            .withUsagePercentage(99.9999)
            .build(),
        ])
        .build();

      apiService.getLegacyModelsAsArray.and.returnValue(of(extremeModels));
      apiService.getCategoryAudit.and.returnValue(of(extremeAudit));

      fixture.detectChanges();

      const metrics = component.modelsWithAuditMetrics()[0];
      expect(metrics.usagePercentage).toBeGreaterThan(0);
      expect(isFinite(metrics.usagePercentage)).toBe(true);
    });
  });

  describe('additional computed properties', () => {
    it('should count selected critical models', () => {
      const criticalAudit = new CategoryAuditResponseBuilder()
        .withCategory('image_generation' as MODEL_REFERENCE_CATEGORY)
        .withCategoryTotalUsage(100)
        .withModels([
          new ModelAuditInfoBuilder().withName('test-model-1').withCriticalFlags().build(),
          new ModelAuditInfoBuilder().withName('test-model-2').withUsage(10, 100, 500).build(),
        ])
        .build();

      apiService.getLegacyModelsAsArray.and.returnValue(of(mockModels));
      apiService.getCategoryAudit.and.returnValue(of(criticalAudit));
      fixture.detectChanges();

      component.toggleModelSelection('test-model-1');
      expect(component.selectedCriticalCount()).toBe(1);

      component.toggleModelSelection('test-model-2');
      expect(component.selectedCriticalCount()).toBe(1); // Still 1, second isn't critical
    });

    it('should count selected warning models', () => {
      const warningAudit = new CategoryAuditResponseBuilder()
        .withCategory('image_generation' as MODEL_REFERENCE_CATEGORY)
        .withCategoryTotalUsage(100)
        .withModels([
          new ModelAuditInfoBuilder().withName('test-model-1').withWarningFlags().build(),
          new ModelAuditInfoBuilder().withName('test-model-2').withUsage(10, 100, 500).build(),
        ])
        .build();

      apiService.getLegacyModelsAsArray.and.returnValue(of(mockModels));
      apiService.getCategoryAudit.and.returnValue(of(warningAudit));
      fixture.detectChanges();

      component.toggleModelSelection('test-model-1');
      expect(component.selectedWarningCount()).toBe(1);
    });

    it('should calculate total models count', () => {
      apiService.getLegacyModelsAsArray.and.returnValue(of(mockModels));
      apiService.getCategoryAudit.and.returnValue(of(mockAuditResponse));
      fixture.detectChanges();

      expect(component.totalModels()).toBe(2);
    });

    it('should calculate models with workers count', () => {
      apiService.getLegacyModelsAsArray.and.returnValue(of(mockModels));
      apiService.getCategoryAudit.and.returnValue(of(mockAuditResponse));
      fixture.detectChanges();

      expect(component.modelsWithWorkers()).toBe(2); // Both have workerCount > 0
    });

    it('should calculate average usage percentage', () => {
      apiService.getLegacyModelsAsArray.and.returnValue(of(mockModels));
      apiService.getCategoryAudit.and.returnValue(of(mockAuditResponse));
      fixture.detectChanges();

      const avgPercentage = component.averageUsagePercentage();
      // With 2 models: 66.67% and 33.33%, average should be 50%
      expect(avgPercentage).toBeGreaterThan(0);
      expect(avgPercentage).toBeLessThanOrEqual(100);
      expect(avgPercentage).toBeCloseTo(50, 0); // Approximately 50%
    });

    it('should select only flagged models', () => {
      const flaggedAudit = new CategoryAuditResponseBuilder()
        .withCategory('image_generation' as MODEL_REFERENCE_CATEGORY)
        .withCategoryTotalUsage(150)
        .withModels([
          new ModelAuditInfoBuilder()
            .withName('test-model-1')
            .withCriticalFlags()
            .withUsage(0, 0, 0)
            .build(),
          new ModelAuditInfoBuilder().withName('test-model-2').withUsage(10, 100, 500).build(),
        ])
        .build();

      apiService.getLegacyModelsAsArray.and.returnValue(of(mockModels));
      apiService.getCategoryAudit.and.returnValue(of(flaggedAudit));
      fixture.detectChanges();

      component.selectFlagged();
      expect(component.selectedCount()).toBe(1);
      expect(component.isModelSelected('test-model-1')).toBe(true);
      expect(component.isModelSelected('test-model-2')).toBe(false);
    });
  });
});
