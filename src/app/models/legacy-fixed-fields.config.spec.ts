import {
  LEGACY_FIXED_FIELDS,
  getFixedFieldsForCategory,
  getHiddenFieldNamesForCategory,
  applyFixedFields,
  isFieldHidden,
} from './legacy-fixed-fields.config';
import { ModelReferenceCategory } from './api.models';

describe('legacy-fixed-fields.config', () => {
  describe('LEGACY_FIXED_FIELDS', () => {
    it('should have common fixed fields for all categories', () => {
      expect(LEGACY_FIXED_FIELDS.all).toBeDefined();
      expect(LEGACY_FIXED_FIELDS.all['available']).toBeDefined();
      expect(LEGACY_FIXED_FIELDS.all['available'].value).toBe(null);
    });

    it('should have category-specific fixed fields for image_generation', () => {
      expect(LEGACY_FIXED_FIELDS.categories.image_generation).toBeDefined();
      expect(LEGACY_FIXED_FIELDS.categories.image_generation?.['type']).toBeDefined();
      expect(LEGACY_FIXED_FIELDS.categories.image_generation?.['type']?.value).toBe('ckpt');
      expect(LEGACY_FIXED_FIELDS.categories.image_generation?.['download_all']).toBeDefined();
      expect(LEGACY_FIXED_FIELDS.categories.image_generation?.['download_all']?.value).toBe(false);
    });

    it('should have category-specific fixed fields for text_generation', () => {
      expect(LEGACY_FIXED_FIELDS.categories.text_generation).toBeDefined();
      expect(LEGACY_FIXED_FIELDS.categories.text_generation?.['download_all']).toBeDefined();
      expect(LEGACY_FIXED_FIELDS.categories.text_generation?.['download_all']?.value).toBe(false);
    });

    it('should have category-specific fixed fields for clip', () => {
      expect(LEGACY_FIXED_FIELDS.categories.clip).toBeDefined();
      expect(LEGACY_FIXED_FIELDS.categories.clip?.['download_all']).toBeDefined();
      expect(LEGACY_FIXED_FIELDS.categories.clip?.['download_all']?.value).toBe(false);
    });
  });

  describe('getFixedFieldsForCategory', () => {
    it('should return merged fixed fields for image_generation', () => {
      const fixedFields = getFixedFieldsForCategory('image_generation' as ModelReferenceCategory);
      expect(fixedFields['available']).toBeDefined();
      expect(fixedFields['available'].value).toBe(null);
      expect(fixedFields['type']).toBeDefined();
      expect(fixedFields['type'].value).toBe('ckpt');
      expect(fixedFields['download_all']).toBeDefined();
      expect(fixedFields['download_all'].value).toBe(false);
    });

    it('should return merged fixed fields for text_generation', () => {
      const fixedFields = getFixedFieldsForCategory('text_generation' as ModelReferenceCategory);
      expect(fixedFields['available']).toBeDefined();
      expect(fixedFields['available'].value).toBe(null);
      expect(fixedFields['download_all']).toBeDefined();
      expect(fixedFields['download_all'].value).toBe(false);
      expect(fixedFields['type']).toBeUndefined();
    });

    it('should return only common fixed fields for a category without specific overrides', () => {
      const fixedFields = getFixedFieldsForCategory('clip' as ModelReferenceCategory);
      expect(fixedFields['available']).toBeDefined();
      expect(fixedFields['download_all']).toBeDefined();
    });
  });

  describe('getHiddenFieldNamesForCategory', () => {
    it('should return correct hidden field names for image_generation', () => {
      const hiddenFields = getHiddenFieldNamesForCategory(
        'image_generation' as ModelReferenceCategory,
      );
      expect(hiddenFields).toContain('available');
      expect(hiddenFields).toContain('type');
      expect(hiddenFields).toContain('download_all');
      expect(hiddenFields.length).toBe(3);
    });

    it('should return correct hidden field names for text_generation', () => {
      const hiddenFields = getHiddenFieldNamesForCategory(
        'text_generation' as ModelReferenceCategory,
      );
      expect(hiddenFields).toContain('available');
      expect(hiddenFields).toContain('download_all');
      expect(hiddenFields.length).toBe(2);
    });

    it('should return correct hidden field names for clip', () => {
      const hiddenFields = getHiddenFieldNamesForCategory('clip' as ModelReferenceCategory);
      expect(hiddenFields).toContain('available');
      expect(hiddenFields).toContain('download_all');
      expect(hiddenFields.length).toBe(2);
    });
  });

  describe('applyFixedFields', () => {
    it('should apply fixed fields to image_generation model data', () => {
      const modelData = {
        name: 'test-model',
        description: 'A test model',
        baseline: 'stable_diffusion_1',
        inpainting: false,
      };

      const result = applyFixedFields('image_generation' as ModelReferenceCategory, modelData);

      expect(result.name).toBe('test-model');
      expect(result.description).toBe('A test model');
      expect((result as Record<string, unknown>)['available']).toBe(null);
      expect((result as Record<string, unknown>)['type']).toBe('ckpt');
      expect((result as Record<string, unknown>)['download_all']).toBe(false);
    });

    it('should apply fixed fields to text_generation model data', () => {
      const modelData = {
        name: 'test-model',
        description: 'A test model',
        parameters: 1000,
      };

      const result = applyFixedFields('text_generation' as ModelReferenceCategory, modelData);

      expect(result.name).toBe('test-model');
      expect(result.description).toBe('A test model');
      expect((result as Record<string, unknown>)['available']).toBe(null);
      expect((result as Record<string, unknown>)['download_all']).toBe(false);
      expect((result as Record<string, unknown>)['type']).toBeUndefined();
    });

    it('should override user-provided values with fixed values', () => {
      const modelData = {
        name: 'test-model',
        type: 'safetensors', // User tries to set this
        download_all: true, // User tries to set this
        available: true, // User tries to set this
      };

      const result = applyFixedFields('image_generation' as ModelReferenceCategory, modelData);

      // Fixed values should override user input
      expect((result as Record<string, unknown>)['type']).toBe('ckpt');
      expect((result as Record<string, unknown>)['download_all']).toBe(false);
      expect((result as Record<string, unknown>)['available']).toBeNull();
    });
  });

  describe('isFieldHidden', () => {
    it('should return true for hidden fields in image_generation', () => {
      expect(isFieldHidden('image_generation' as ModelReferenceCategory, 'available')).toBe(true);
      expect(isFieldHidden('image_generation' as ModelReferenceCategory, 'type')).toBe(true);
      expect(isFieldHidden('image_generation' as ModelReferenceCategory, 'download_all')).toBe(
        true,
      );
    });

    it('should return false for non-hidden fields in image_generation', () => {
      expect(isFieldHidden('image_generation' as ModelReferenceCategory, 'description')).toBe(
        false,
      );
      expect(isFieldHidden('image_generation' as ModelReferenceCategory, 'baseline')).toBe(false);
      expect(isFieldHidden('image_generation' as ModelReferenceCategory, 'nsfw')).toBe(false);
    });

    it('should return true for hidden fields in text_generation', () => {
      expect(isFieldHidden('text_generation' as ModelReferenceCategory, 'available')).toBe(true);
      expect(isFieldHidden('text_generation' as ModelReferenceCategory, 'download_all')).toBe(true);
    });

    it('should return false for type field in text_generation (not hidden in this category)', () => {
      expect(isFieldHidden('text_generation' as ModelReferenceCategory, 'type')).toBe(false);
    });
  });
});
