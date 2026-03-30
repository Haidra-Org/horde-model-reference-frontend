import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ModelValidationService } from './model-validation.service';
import type { HTTPValidationError } from '../api-client/model/models';

describe('ModelValidationService', () => {
  let service: ModelValidationService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection()],
    });
    service = TestBed.inject(ModelValidationService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('mapServerErrors', () => {
    it('should map simple validation errors', () => {
      const httpError: HTTPValidationError = {
        detail: [{ loc: ['body', 'baseline'], msg: 'Field required', type: 'missing' }],
      };

      const errors = service.mapServerErrors(httpError);

      expect(errors.length).toBe(1);
      expect(errors[0].path).toBe('baseline');
      expect(errors[0].field).toBe('baseline');
      expect(errors[0].message).toBe('Field required');
    });

    it('should map nested field paths', () => {
      const httpError: HTTPValidationError = {
        detail: [
          {
            loc: ['body', 'config', 'download', 0, 'file_url'],
            msg: 'Invalid URL',
            type: 'value_error',
          },
        ],
      };

      const errors = service.mapServerErrors(httpError);

      expect(errors.length).toBe(1);
      expect(errors[0].path).toBe('config.download[0].file_url');
      expect(errors[0].field).toBe('file_url');
    });

    it('should skip model type names in path', () => {
      const httpError: HTTPValidationError = {
        detail: [
          {
            loc: [
              'body',
              'function-after[validator_is_baseline_and_style_known(), function-after[validator_set_arrays_to_empty_if_none(), ImageGenerationModelRecord]]',
              'baseline',
            ],
            msg: 'Field required',
            type: 'missing',
          },
        ],
      };

      const errors = service.mapServerErrors(httpError);

      expect(errors.length).toBe(1);
      expect(errors[0].path).toBe('baseline');
      expect(errors[0].field).toBe('baseline');
    });

    it('should update serverErrors signal', () => {
      const httpError: HTTPValidationError = {
        detail: [{ loc: ['body', 'name'], msg: 'Name is required', type: 'missing' }],
      };

      service.mapServerErrors(httpError);

      expect(service.serverErrors().length).toBe(1);
      expect(service.serverErrors()[0].field).toBe('name');
    });

    it('should handle empty detail array', () => {
      const httpError: HTTPValidationError = { detail: [] };

      const errors = service.mapServerErrors(httpError);

      expect(errors.length).toBe(0);
    });

    it('should handle undefined detail', () => {
      const httpError: HTTPValidationError = {};

      const errors = service.mapServerErrors(httpError);

      expect(errors.length).toBe(0);
    });
  });

  describe('formatServerErrors', () => {
    it('should format single error', () => {
      const httpError: HTTPValidationError = {
        detail: [{ loc: ['body', 'baseline'], msg: 'Field required', type: 'missing' }],
      };

      const formatted = service.formatServerErrors(httpError);

      expect(formatted).toBe('baseline: Field required');
    });

    it('should format multiple errors', () => {
      const httpError: HTTPValidationError = {
        detail: [
          { loc: ['body', 'baseline'], msg: 'Field required', type: 'missing' },
          { loc: ['body', 'name'], msg: 'Name is required', type: 'missing' },
        ],
      };

      const formatted = service.formatServerErrors(httpError);

      expect(formatted).toBe('baseline: Field required; name: Name is required');
    });

    it('should truncate more than 3 errors', () => {
      const httpError: HTTPValidationError = {
        detail: [
          { loc: ['body', 'a'], msg: 'Error 1', type: 'missing' },
          { loc: ['body', 'b'], msg: 'Error 2', type: 'missing' },
          { loc: ['body', 'c'], msg: 'Error 3', type: 'missing' },
          { loc: ['body', 'd'], msg: 'Error 4', type: 'missing' },
        ],
      };

      const formatted = service.formatServerErrors(httpError);

      expect(formatted).toContain('(+1 more)');
    });

    it('should return fallback for empty detail', () => {
      const httpError: HTTPValidationError = { detail: [] };

      const formatted = service.formatServerErrors(httpError);

      expect(formatted).toBe('Validation failed');
    });
  });

  describe('clearServerErrors', () => {
    it('should clear the serverErrors signal', () => {
      const httpError: HTTPValidationError = {
        detail: [{ loc: ['body', 'name'], msg: 'Required', type: 'missing' }],
      };

      service.mapServerErrors(httpError);
      expect(service.serverErrors().length).toBe(1);

      service.clearServerErrors();

      expect(service.serverErrors().length).toBe(0);
    });
  });

  describe('hasFieldError', () => {
    beforeEach(() => {
      const httpError: HTTPValidationError = {
        detail: [
          { loc: ['body', 'baseline'], msg: 'Required', type: 'missing' },
          {
            loc: ['body', 'config', 'download', 0, 'file_url'],
            msg: 'Invalid',
            type: 'value_error',
          },
        ],
      };
      service.mapServerErrors(httpError);
    });

    it('should return true for field with error', () => {
      expect(service.hasFieldError('baseline')).toBe(true);
    });

    it('should return true for nested field path', () => {
      expect(service.hasFieldError('config.download[0].file_url')).toBe(true);
    });

    it('should return false for field without error', () => {
      expect(service.hasFieldError('description')).toBe(false);
    });
  });

  describe('getFieldError', () => {
    beforeEach(() => {
      const httpError: HTTPValidationError = {
        detail: [{ loc: ['body', 'baseline'], msg: 'Field is required', type: 'missing' }],
      };
      service.mapServerErrors(httpError);
    });

    it('should return error message for field with error', () => {
      expect(service.getFieldError('baseline')).toBe('Field is required');
    });

    it('should return undefined for field without error', () => {
      expect(service.getFieldError('description')).toBeUndefined();
    });
  });

  describe('validateRecord', () => {
    it('should validate a record and return issues', () => {
      const record = {
        name: '',
        description: 'Test',
        nsfw: false,
      };

      const issues = service.validateRecord(record);

      expect(issues.length).toBeGreaterThan(0);
      expect(issues.some((i) => i.field === 'name')).toBe(true);
    });
  });

  describe('analyzeIssues', () => {
    it('should group issues by severity', () => {
      const issues = [
        { field: 'name', message: 'Required', severity: 'error' as const },
        { field: 'description', message: 'Missing', severity: 'warning' as const },
        { field: 'style', message: 'Empty', severity: 'warning' as const },
      ];

      const analysis = service.analyzeIssues(issues);

      expect(analysis.errors.length).toBe(1);
      expect(analysis.warnings.length).toBe(2);
      expect(analysis.hasErrors).toBe(true);
    });

    it('should return hasErrors false when no errors', () => {
      const issues = [{ field: 'description', message: 'Missing', severity: 'warning' as const }];

      const analysis = service.analyzeIssues(issues);

      expect(analysis.hasErrors).toBe(false);
    });
  });
});
