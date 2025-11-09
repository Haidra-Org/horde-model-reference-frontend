import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { ModelConstantsService } from './model-constants.service';
import { LegacyStableDiffusionRecord } from '../models/api.models';

describe('ModelConstantsService', () => {
  let service: ModelConstantsService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), ModelConstantsService],
    });
    service = TestBed.inject(ModelConstantsService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('getTagSuggestions', () => {
    it('should return empty array when no models provided', () => {
      const suggestions = service.getTagSuggestions([]);

      expect(suggestions).toEqual([]);
    });

    it('should extract tags from models', () => {
      const models: LegacyStableDiffusionRecord[] = [
        { name: 'model1', inpainting: false, baseline: 'sdxl', tags: ['custom-tag-1', 'anime'] },
        { name: 'model2', inpainting: false, baseline: 'sdxl', tags: ['custom-tag-2'] },
      ];

      const suggestions = service.getTagSuggestions(models);

      expect(suggestions).toContain('custom-tag-1');
      expect(suggestions).toContain('custom-tag-2');
      expect(suggestions).toContain('anime');
    });

    it('should deduplicate tags case-insensitively', () => {
      const models: LegacyStableDiffusionRecord[] = [
        { name: 'model1', inpainting: false, baseline: 'sdxl', tags: ['Anime', 'REALISTIC'] },
        { name: 'model2', inpainting: false, baseline: 'sdxl', tags: ['anime', 'realistic'] },
        { name: 'model3', inpainting: false, baseline: 'sdxl', tags: ['ANIME'] },
      ];

      const suggestions = service.getTagSuggestions(models);

      const animeCount = suggestions.filter((t) => t.toLowerCase() === 'anime').length;
      const realisticCount = suggestions.filter((t) => t.toLowerCase() === 'realistic').length;

      expect(animeCount).toBe(1);
      expect(realisticCount).toBe(1);
    });

    it('should preserve casing from first occurrence', () => {
      const models: LegacyStableDiffusionRecord[] = [
        { name: 'model1', inpainting: false, baseline: 'sdxl', tags: ['ANIME'] },
        { name: 'model2', inpainting: false, baseline: 'sdxl', tags: ['anime'] },
      ];

      const suggestions = service.getTagSuggestions(models);

      // Should use casing from first occurrence (uppercase 'ANIME')
      expect(suggestions).toContain('ANIME');
      expect(suggestions).not.toContain('anime');
    });

    it('should handle null and undefined tags gracefully', () => {
      const models: LegacyStableDiffusionRecord[] = [
        { name: 'model1', inpainting: false, baseline: 'sdxl', tags: null },
        { name: 'model2', inpainting: false, baseline: 'sdxl', tags: undefined },
        { name: 'model3', inpainting: false, baseline: 'sdxl', tags: ['valid-tag'] },
        { name: 'model4', inpainting: false, baseline: 'sdxl' },
      ];

      const suggestions = service.getTagSuggestions(models);

      expect(suggestions).toContain('valid-tag');
      expect(suggestions.every((t) => typeof t === 'string')).toBe(true);
    });

    it('should sort tags alphabetically', () => {
      const models: LegacyStableDiffusionRecord[] = [
        { name: 'model1', inpainting: false, baseline: 'sdxl', tags: ['zebra', 'apple', 'mango'] },
      ];

      const suggestions = service.getTagSuggestions(models);

      const sortedSuggestions = [...suggestions].sort((a, b) => a.localeCompare(b));
      expect(suggestions).toEqual(sortedSuggestions);
    });
  });

  describe('getStyleSuggestions', () => {
    it('should return empty array when no models provided', () => {
      const suggestions = service.getStyleSuggestions([]);

      expect(suggestions).toEqual([]);
    });

    it('should extract styles from models', () => {
      const models: LegacyStableDiffusionRecord[] = [
        { name: 'model1', inpainting: false, baseline: 'sdxl', style: 'anime' },
        { name: 'model2', inpainting: false, baseline: 'sdxl', style: 'realistic' },
        { name: 'model3', inpainting: false, baseline: 'sdxl', style: 'furry' },
      ];

      const suggestions = service.getStyleSuggestions(models);

      expect(suggestions).toContain('anime');
      expect(suggestions).toContain('realistic');
      expect(suggestions).toContain('furry');
    });

    it('should deduplicate styles case-insensitively', () => {
      const models: LegacyStableDiffusionRecord[] = [
        { name: 'model1', inpainting: false, baseline: 'sdxl', style: 'Anime' },
        { name: 'model2', inpainting: false, baseline: 'sdxl', style: 'anime' },
        { name: 'model3', inpainting: false, baseline: 'sdxl', style: 'ANIME' },
      ];

      const suggestions = service.getStyleSuggestions(models);

      const animeCount = suggestions.filter((s) => s.toLowerCase() === 'anime').length;
      expect(animeCount).toBe(1);
    });

    it('should preserve casing from first occurrence', () => {
      const models: LegacyStableDiffusionRecord[] = [
        { name: 'model1', inpainting: false, baseline: 'sdxl', style: 'Realistic' },
        { name: 'model2', inpainting: false, baseline: 'sdxl', style: 'realistic' },
      ];

      const suggestions = service.getStyleSuggestions(models);

      // Should use casing from first occurrence
      expect(suggestions).toContain('Realistic');
      expect(suggestions).not.toContain('realistic');
    });

    it('should sort styles alphabetically', () => {
      const models: LegacyStableDiffusionRecord[] = [
        { name: 'model1', inpainting: false, baseline: 'sdxl', style: 'zebra' },
        { name: 'model2', inpainting: false, baseline: 'sdxl', style: 'apple' },
        { name: 'model3', inpainting: false, baseline: 'sdxl', style: 'mango' },
      ];

      const suggestions = service.getStyleSuggestions(models);

      const sortedSuggestions = [...suggestions].sort((a, b) => a.localeCompare(b));
      expect(suggestions).toEqual(sortedSuggestions);
    });

    it('should handle models without style property', () => {
      const models: LegacyStableDiffusionRecord[] = [
        { name: 'model1', inpainting: false, baseline: 'sdxl', style: 'anime' },
        { name: 'model2', inpainting: false, baseline: 'sdxl' },
        { name: 'model3', inpainting: false, baseline: 'sdxl', style: null },
      ];

      const suggestions = service.getStyleSuggestions(models);

      expect(suggestions).toEqual(['anime']);
    });
  });
});
