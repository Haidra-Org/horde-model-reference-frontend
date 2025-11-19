import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { ModelReferenceApiService } from './model-reference-api.service';
import { environment } from '../../environments/environment';
import type { CategoryStatistics, CategoryAuditResponse } from '../api-client';
import { withDone } from '../../testing/with-done';

describe('ModelReferenceApiService', () => {
  let service: ModelReferenceApiService;
  let httpMock: HttpTestingController;
  const baseUrl = environment.apiBaseUrl;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        ModelReferenceApiService,
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    service = TestBed.inject(ModelReferenceApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  describe('getCategoryStatistics', () => {
    it('should fetch category statistics successfully', withDone((done) => {
      const category = 'image_generation';
      const mockStatistics: CategoryStatistics = {
        category: 'image_generation',
        total_models: 150,
        returned_models: 150,
        offset: 0,
        limit: undefined,
        nsfw_count: 45,
        baseline_distribution: {
          stable_diffusion_xl: {
            baseline: 'stable_diffusion_xl',
            count: 100,
            percentage: 66.67,
          },
        },
        download_stats: {
          total_models_with_downloads: 148,
          total_download_entries: 250,
          total_size_bytes: 500000000000,
          models_with_size_info: 140,
          average_size_bytes: 3571428571,
          hosts: { 'huggingface.co': 200, 'civitai.com': 50 },
        },
        top_tags: [
          { tag: 'anime', count: 80, percentage: 53.33 },
          { tag: 'realistic', count: 70, percentage: 46.67 },
        ],
        top_styles: [{ tag: 'anime', count: 80, percentage: 53.33 }],
        parameter_buckets: [],
        models_without_param_info: 0,
        models_with_trigger_words: 75,
        models_with_inpainting: 25,
        models_with_requirements: 10,
        models_with_showcases: 90,
        computed_at: Date.now(),
      };

      service.getCategoryStatistics(category).subscribe((result) => {
        expect(result).toEqual(mockStatistics);
        expect(result?.total_models).toBe(150);
        expect(result?.nsfw_count).toBe(45);
        expect(result?.download_stats).toBeDefined();
        expect(result?.download_stats?.hosts).toEqual({
          'huggingface.co': 200,
          'civitai.com': 50,
        });
        expect(result?.top_tags?.length).toBe(2);
        expect(result?.baseline_distribution).toBeDefined();
        done();
      });

      const req = httpMock.expectOne(
        `${baseUrl}/model_references/statistics/${category}?group_text_models=false&offset=0`,
      );
      expect(req.request.method).toBe('GET');
      req.flush(mockStatistics);
    }));

    it('should return null on error', withDone((done) => {
      const category = 'image_generation';

      service.getCategoryStatistics(category).subscribe((result) => {
        expect(result).toBeNull();
        done();
      });

      const req = httpMock.expectOne(
        `${baseUrl}/model_references/statistics/${category}?group_text_models=false&offset=0`,
      );
      req.error(new ProgressEvent('Network error'));
    }));

    it('should pass group_text_models parameter when true', withDone((done) => {
      const category = 'text_generation';
      const mockStatistics: CategoryStatistics = {
        category: 'text_generation',
        total_models: 50,
        returned_models: 50,
        offset: 0,
        nsfw_count: 5,
        baseline_distribution: {},
        download_stats: undefined,
        top_tags: [],
        top_styles: [],
        parameter_buckets: [
          {
            bucket_label: '3B-7B',
            min_params: 3000000000,
            max_params: 7000000000,
            count: 30,
            percentage: 60,
          },
          {
            bucket_label: '7B-13B',
            min_params: 7000000000,
            max_params: 13000000000,
            count: 20,
            percentage: 40,
          },
        ],
        models_without_param_info: 0,
        models_with_trigger_words: 0,
        models_with_inpainting: 0,
        models_with_requirements: 0,
        models_with_showcases: 10,
        computed_at: Date.now(),
      };

      service.getCategoryStatistics(category, true).subscribe((result) => {
        expect(result).toEqual(mockStatistics);
        expect(result?.parameter_buckets?.length).toBe(2);
        expect(result?.parameter_buckets?.[0].count).toBe(30);
        done();
      });

      const req = httpMock.expectOne(
        `${baseUrl}/model_references/statistics/${category}?group_text_models=true&offset=0`,
      );
      expect(req.request.method).toBe('GET');
      req.flush(mockStatistics);
    }));

    it('should handle statistics with minimal data', withDone((done) => {
      const category = 'clip';
      const mockStatistics: CategoryStatistics = {
        category: 'clip',
        total_models: 5,
        returned_models: 5,
        offset: 0,
        nsfw_count: 0,
        baseline_distribution: {},
        top_tags: [],
        top_styles: [],
        parameter_buckets: [],
        models_without_param_info: 0,
        models_with_trigger_words: 0,
        models_with_inpainting: 0,
        models_with_requirements: 0,
        models_with_showcases: 0,
        computed_at: Date.now(),
      };

      service.getCategoryStatistics(category).subscribe((result) => {
        expect(result).toEqual(mockStatistics);
        expect(result?.total_models).toBe(5);
        expect(result?.baseline_distribution).toEqual({});
        done();
      });

      const req = httpMock.expectOne(
        `${baseUrl}/model_references/statistics/${category}?group_text_models=false&offset=0`,
      );
      req.flush(mockStatistics);
    }));
  });

  describe('getCategoryAudit', () => {
    it('should fetch category audit successfully with default parameters', withDone((done) => {
      const category = 'image_generation';
      const mockAudit: CategoryAuditResponse = {
        category: 'image_generation',
        category_total_month_usage: 50000,
        total_count: 150,
        returned_count: 1,
        offset: 0,
        limit: undefined,
        models: [
          {
            name: 'test-model',
            category: 'image_generation',
            usage_day: 15,
            usage_month: 1250,
            usage_total: 2500,
            usage_hour: 1,
            usage_minute: 0,
            usage_percentage_of_category: 2.5,
            usage_trend: {
              day_to_month_ratio: 0.03,
              month_to_total_ratio: 0.5,
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
            is_critical: false,
            has_warning: false,
            worker_count: 10,
            baseline: 'stable_diffusion_xl',
            nsfw: false,
            has_description: true,
            download_count: 2,
            download_hosts: ['huggingface.co'],
            cost_benefit_score: 500.25,
            size_gb: 2.5,
          },
        ],
        summary: {
          total_models: 150,
          models_at_risk: 0,
          models_critical: 0,
          models_with_warnings: 0,
          models_with_zero_day_usage: 5,
          models_with_zero_month_usage: 2,
          models_with_zero_total_usage: 0,
          models_with_no_active_workers: 3,
          models_with_no_downloads: 1,
          models_with_non_preferred_hosts: 4,
          models_with_multiple_hosts: 2,
          models_with_low_usage: 8,
          average_risk_score: 0,
          category_total_month_usage: 50000,
        },
      };

      service.getCategoryAudit(category).subscribe((result) => {
        expect(result).toEqual(mockAudit);
        expect(result?.models.length).toBe(1);
        expect(result?.total_count).toBe(150);
        expect(result?.returned_count).toBe(1);
        expect(result?.summary.total_models).toBe(150);
        expect(result?.models[0].usage_trend.day_to_month_ratio).toBe(0.03);
        done();
      });

      const req = httpMock.expectOne(
        `${baseUrl}/model_references/statistics/${category}/audit?group_text_models=false&offset=0`,
      );
      expect(req.request.method).toBe('GET');
      req.flush(mockAudit);
    }));

    it('should return null on error', withDone((done) => {
      const category = 'image_generation';

      service.getCategoryAudit(category).subscribe((result) => {
        expect(result).toBeNull();
        done();
      });

      const req = httpMock.expectOne(
        `${baseUrl}/model_references/statistics/${category}/audit?group_text_models=false&offset=0`,
      );
      req.error(new ProgressEvent('Network error'));
    }));

    it('should pass preset parameter when provided', withDone((done) => {
      const category = 'image_generation';
      const preset = 'deletion_candidates';
      const mockAudit: CategoryAuditResponse = {
        category: 'image_generation',
        category_total_month_usage: 50000,
        total_count: 150,
        returned_count: 10,
        offset: 0,
        limit: undefined,
        models: [],
        summary: {
          total_models: 10,
          models_at_risk: 5,
          models_critical: 2,
          models_with_warnings: 3,
          models_with_zero_day_usage: 3,
          models_with_zero_month_usage: 2,
          models_with_zero_total_usage: 0,
          models_with_no_active_workers: 2,
          models_with_no_downloads: 1,
          models_with_non_preferred_hosts: 2,
          models_with_multiple_hosts: 1,
          models_with_low_usage: 4,
          average_risk_score: 3.5,
          category_total_month_usage: 50000,
        },
      };

      service.getCategoryAudit(category, false, preset).subscribe((result) => {
        expect(result).toEqual(mockAudit);
        expect(result?.total_count).toBe(150);
        expect(result?.returned_count).toBe(10);
        done();
      });

      const req = httpMock.expectOne(
        `${baseUrl}/model_references/statistics/${category}/audit?group_text_models=false&preset=${preset}&offset=0`,
      );
      expect(req.request.method).toBe('GET');
      req.flush(mockAudit);
    }));

    it('should handle group_text_models and preset together', withDone((done) => {
      const category = 'text_generation';
      const preset = 'zero_usage';
      const mockAudit: CategoryAuditResponse = {
        category: 'text_generation',
        category_total_month_usage: 10000,
        total_count: 50,
        returned_count: 5,
        offset: 0,
        limit: undefined,
        models: [],
        summary: {
          total_models: 5,
          models_at_risk: 5,
          models_critical: 3,
          models_with_warnings: 2,
          models_with_zero_day_usage: 5,
          models_with_zero_month_usage: 5,
          models_with_zero_total_usage: 2,
          models_with_no_active_workers: 3,
          models_with_no_downloads: 1,
          models_with_non_preferred_hosts: 1,
          models_with_multiple_hosts: 0,
          models_with_low_usage: 5,
          average_risk_score: 6.2,
          category_total_month_usage: 10000,
        },
      };

      service.getCategoryAudit(category, true, preset).subscribe((result) => {
        expect(result).toEqual(mockAudit);
        expect(result?.total_count).toBe(50);
        expect(result?.returned_count).toBe(5);
        done();
      });

      const req = httpMock.expectOne(
        `${baseUrl}/model_references/statistics/${category}/audit?group_text_models=true&preset=${preset}&offset=0`,
      );
      expect(req.request.method).toBe('GET');
      req.flush(mockAudit);
    }));

    it('should handle audit response with critical flags', withDone((done) => {
      const category = 'image_generation';
      const mockAudit: CategoryAuditResponse = {
        category: 'image_generation',
        category_total_month_usage: 50000,
        total_count: 1,
        returned_count: 1,
        offset: 0,
        limit: undefined,
        models: [
          {
            name: 'unused-model',
            category: 'image_generation',
            usage_day: 0,
            usage_month: 0,
            usage_total: 0,
            usage_hour: null,
            usage_minute: null,
            usage_percentage_of_category: 0,
            usage_trend: {
              day_to_month_ratio: null,
              month_to_total_ratio: null,
            },
            deletion_risk_flags: {
              zero_usage_day: true,
              zero_usage_month: true,
              zero_usage_total: true,
              no_active_workers: true,
              has_multiple_hosts: false,
              has_non_preferred_host: false,
              has_unknown_host: false,
              no_download_urls: true,
              missing_description: true,
              missing_baseline: true,
              low_usage: true,
            },
            risk_score: 8,
            at_risk: true,
            is_critical: false,
            has_warning: true,
            worker_count: 0,
            baseline: null,
            nsfw: null,
            has_description: false,
            download_count: 0,
            download_hosts: [],
            cost_benefit_score: null,
            size_gb: null,
          },
        ],
        summary: {
          total_models: 1,
          models_at_risk: 1,
          models_critical: 1,
          models_with_warnings: 1,
          models_with_zero_day_usage: 1,
          models_with_zero_month_usage: 1,
          models_with_zero_total_usage: 1,
          models_with_no_active_workers: 1,
          models_with_no_downloads: 1,
          models_with_non_preferred_hosts: 0,
          models_with_multiple_hosts: 0,
          models_with_low_usage: 1,
          average_risk_score: 8,
          category_total_month_usage: 50000,
        },
      };

      service.getCategoryAudit(category).subscribe((result) => {
        expect(result?.models[0].at_risk).toBe(true);
        expect(result?.models[0].deletion_risk_flags?.zero_usage_month).toBe(true);
        expect(result?.models[0].deletion_risk_flags?.zero_usage_total).toBe(true);
        expect(result?.models[0].deletion_risk_flags?.no_active_workers).toBe(true);
        expect(result?.models[0].deletion_risk_flags?.no_download_urls).toBe(true);
        expect(result?.models[0].deletion_risk_flags?.missing_description).toBe(true);
        expect(result?.models[0].deletion_risk_flags?.missing_baseline).toBe(true);
        expect(result?.models[0].risk_score).toBe(8);
        expect(result?.models[0].usage_trend.day_to_month_ratio).toBeNull();
        expect(result?.models[0].usage_trend.month_to_total_ratio).toBeNull();
        expect(result?.summary.models_critical).toBe(1);
        done();
      });

      const req = httpMock.expectOne(
        `${baseUrl}/model_references/statistics/${category}/audit?group_text_models=false&offset=0`,
      );
      req.flush(mockAudit);
    }));

    it('should validate all deletion risk flags are present', withDone((done) => {
      const category = 'image_generation';
      const mockAudit: CategoryAuditResponse = {
        category: 'image_generation',
        category_total_month_usage: 50000,
        total_count: 1,
        returned_count: 1,
        offset: 0,
        models: [
          {
            name: 'test-model',
            category: 'image_generation',
            usage_day: 0,
            usage_month: 0,
            usage_total: 0,
            usage_percentage_of_category: 0,
            usage_trend: {
              day_to_month_ratio: null,
              month_to_total_ratio: null,
            },
            deletion_risk_flags: {
              zero_usage_day: true,
              zero_usage_month: true,
              zero_usage_total: true,
              no_active_workers: true,
              has_multiple_hosts: true,
              has_non_preferred_host: true,
              has_unknown_host: true,
              no_download_urls: true,
              missing_description: true,
              missing_baseline: true,
              low_usage: true,
            },
            risk_score: 11,
            at_risk: true,
            is_critical: false,
            has_warning: true,
            worker_count: 0,
            has_description: false,
            download_count: 0,
            download_hosts: [],
          },
        ],
        summary: {
          total_models: 1,
          models_at_risk: 1,
          models_critical: 1,
          models_with_warnings: 1,
          models_with_zero_day_usage: 1,
          models_with_zero_month_usage: 1,
          models_with_zero_total_usage: 1,
          models_with_no_active_workers: 1,
          models_with_no_downloads: 1,
          models_with_non_preferred_hosts: 1,
          models_with_multiple_hosts: 1,
          models_with_low_usage: 1,
          average_risk_score: 11,
          category_total_month_usage: 50000,
        },
      };

      service.getCategoryAudit(category).subscribe((result) => {
        const flags = result?.models[0].deletion_risk_flags;
        expect(flags?.zero_usage_day).toBe(true);
        expect(flags?.zero_usage_month).toBe(true);
        expect(flags?.zero_usage_total).toBe(true);
        expect(flags?.no_active_workers).toBe(true);
        expect(flags?.has_multiple_hosts).toBe(true);
        expect(flags?.has_non_preferred_host).toBe(true);
        expect(flags?.has_unknown_host).toBe(true);
        expect(flags?.no_download_urls).toBe(true);
        expect(flags?.missing_description).toBe(true);
        expect(flags?.missing_baseline).toBe(true);
        expect(flags?.low_usage).toBe(true);
        expect(result?.models[0].risk_score).toBe(11);
        done();
      });

      const req = httpMock.expectOne(
        `${baseUrl}/model_references/statistics/${category}/audit?group_text_models=false&offset=0`,
      );
      req.flush(mockAudit);
    }));

    it('should handle preset filtering with different presets', withDone((done) => {
      const category = 'image_generation';
      const preset = 'critical';
      const mockAudit: CategoryAuditResponse = {
        category: 'image_generation',
        category_total_month_usage: 50000,
        total_count: 150,
        returned_count: 2,
        offset: 0,
        models: [
          {
            name: 'critical-model-1',
            category: 'image_generation',
            usage_day: 0,
            usage_month: 0,
            usage_total: 10,
            usage_percentage_of_category: 0,
            usage_trend: {
              day_to_month_ratio: null,
              month_to_total_ratio: 0,
            },
            deletion_risk_flags: {
              zero_usage_day: true,
              zero_usage_month: true,
              zero_usage_total: false,
              no_active_workers: true,
              has_multiple_hosts: false,
              has_non_preferred_host: false,
              has_unknown_host: false,
              no_download_urls: false,
              missing_description: false,
              missing_baseline: false,
              low_usage: true,
            },
            risk_score: 4,
            at_risk: true,
            is_critical: false,
            has_warning: true,
            worker_count: 0,
            has_description: true,
            download_count: 1,
            download_hosts: ['huggingface.co'],
          },
        ],
        summary: {
          total_models: 2,
          models_at_risk: 2,
          models_critical: 2,
          models_with_warnings: 0,
          models_with_zero_day_usage: 2,
          models_with_zero_month_usage: 2,
          models_with_zero_total_usage: 0,
          models_with_no_active_workers: 2,
          models_with_no_downloads: 0,
          models_with_non_preferred_hosts: 0,
          models_with_multiple_hosts: 0,
          models_with_low_usage: 2,
          average_risk_score: 4.0,
          category_total_month_usage: 50000,
        },
      };

      service.getCategoryAudit(category, false, preset).subscribe((result) => {
        expect(result?.returned_count).toBe(2);
        expect(result?.summary.models_critical).toBe(2);
        done();
      });

      const req = httpMock.expectOne(
        `${baseUrl}/model_references/statistics/${category}/audit?group_text_models=false&preset=${preset}&offset=0`,
      );
      req.flush(mockAudit);
    }));
  });

  describe('error handling', () => {
    it('should handle 404 errors gracefully for statistics', withDone((done) => {
      const category = 'nonexistent';

      service.getCategoryStatistics(category).subscribe((result) => {
        expect(result).toBeNull();
        done();
      });

      const req = httpMock.expectOne(
        `${baseUrl}/model_references/statistics/${category}?group_text_models=false&offset=0`,
      );
      req.flush('Not found', { status: 404, statusText: 'Not Found' });
    }));

    it('should handle 500 errors gracefully for audit', withDone((done) => {
      const category = 'image_generation';

      service.getCategoryAudit(category).subscribe((result) => {
        expect(result).toBeNull();
        done();
      });

      const req = httpMock.expectOne(
        `${baseUrl}/model_references/statistics/${category}/audit?group_text_models=false&offset=0`,
      );
      req.flush('Server error', { status: 500, statusText: 'Internal Server Error' });
    }));
  });
});
