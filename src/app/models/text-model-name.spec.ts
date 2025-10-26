import {
  TextBackend,
  parseTextModelName,
  buildTextModelName,
  getBaseModelName,
  hasBackendPrefix,
  getModelNameVariations,
  groupModelsByBaseName,
  extractBackends,
} from './text-model-name';

describe('Text Model Name Utilities', () => {
  describe('parseTextModelName', () => {
    it('should parse a model name with no prefixes', () => {
      const result = parseTextModelName('L3-Super-Nova-RP-8B');

      expect(result.backend).toBeUndefined();
      expect(result.author).toBeUndefined();
      expect(result.modelName).toBe('L3-Super-Nova-RP-8B');
      expect(result.fullName).toBe('L3-Super-Nova-RP-8B');
    });

    it('should parse a model name with author prefix', () => {
      const result = parseTextModelName('Casual-Autopsy/L3-Super-Nova-RP-8B');

      expect(result.backend).toBeUndefined();
      expect(result.author).toBe('Casual-Autopsy');
      expect(result.modelName).toBe('L3-Super-Nova-RP-8B');
      expect(result.fullName).toBe('Casual-Autopsy/L3-Super-Nova-RP-8B');
    });

    it('should parse a model name with backend prefix only', () => {
      const result = parseTextModelName('aphrodite/L3-Super-Nova-RP-8B');

      expect(result.backend).toBe(TextBackend.Aphrodite);
      expect(result.author).toBeUndefined();
      expect(result.modelName).toBe('L3-Super-Nova-RP-8B');
      expect(result.fullName).toBe('aphrodite/L3-Super-Nova-RP-8B');
    });

    it('should parse a model name with koboldcpp backend prefix', () => {
      const result = parseTextModelName('koboldcpp/L3-Super-Nova-RP-8B');

      expect(result.backend).toBe(TextBackend.KoboldCpp);
      expect(result.author).toBeUndefined();
      expect(result.modelName).toBe('L3-Super-Nova-RP-8B');
      expect(result.fullName).toBe('koboldcpp/L3-Super-Nova-RP-8B');
    });

    it('should parse a model name with backend and author prefixes', () => {
      const result = parseTextModelName('aphrodite/Casual-Autopsy/L3-Super-Nova-RP-8B');

      expect(result.backend).toBe(TextBackend.Aphrodite);
      expect(result.author).toBe('Casual-Autopsy');
      expect(result.modelName).toBe('L3-Super-Nova-RP-8B');
      expect(result.fullName).toBe('aphrodite/Casual-Autopsy/L3-Super-Nova-RP-8B');
    });

    it('should handle case-insensitive backend detection', () => {
      const result1 = parseTextModelName('Aphrodite/Model-Name');
      expect(result1.backend).toBe(TextBackend.Aphrodite);

      const result2 = parseTextModelName('KOBOLDCPP/Model-Name');
      expect(result2.backend).toBe(TextBackend.KoboldCpp);
    });

    it('should handle empty string', () => {
      const result = parseTextModelName('');

      expect(result.backend).toBeUndefined();
      expect(result.author).toBeUndefined();
      expect(result.modelName).toBe('');
      expect(result.fullName).toBe('');
    });

    it('should handle model names with more than 3 parts when backend is present', () => {
      const result = parseTextModelName('aphrodite/org/repo/model-v1');

      expect(result.backend).toBe(TextBackend.Aphrodite);
      expect(result.modelName).toBe('org/repo/model-v1');
    });

    it('should handle model names with more than 3 parts when backend is not present', () => {
      const result = parseTextModelName('org/repo/model-v1');

      expect(result.backend).toBeUndefined();
      expect(result.author).toBe('org');
      expect(result.modelName).toBe('repo/model-v1');
    });

    it('should treat unknown prefix as author, not backend', () => {
      const result = parseTextModelName('unknown-backend/ModelName');

      expect(result.backend).toBeUndefined();
      expect(result.author).toBe('unknown-backend');
      expect(result.modelName).toBe('ModelName');
    });
  });

  describe('buildTextModelName', () => {
    it('should build name from model name only', () => {
      const name = buildTextModelName({
        modelName: 'L3-Super-Nova-RP-8B',
      });

      expect(name).toBe('L3-Super-Nova-RP-8B');
    });

    it('should build name with author', () => {
      const name = buildTextModelName({
        author: 'Casual-Autopsy',
        modelName: 'L3-Super-Nova-RP-8B',
      });

      expect(name).toBe('Casual-Autopsy/L3-Super-Nova-RP-8B');
    });

    it('should build name with backend only', () => {
      const name = buildTextModelName({
        backend: TextBackend.Aphrodite,
        modelName: 'L3-Super-Nova-RP-8B',
      });

      expect(name).toBe('aphrodite/L3-Super-Nova-RP-8B');
    });

    it('should build name with all components', () => {
      const name = buildTextModelName({
        backend: TextBackend.Aphrodite,
        author: 'Casual-Autopsy',
        modelName: 'L3-Super-Nova-RP-8B',
      });

      expect(name).toBe('aphrodite/Casual-Autopsy/L3-Super-Nova-RP-8B');
    });

    it('should return empty string when modelName is missing', () => {
      const name = buildTextModelName({
        backend: TextBackend.Aphrodite,
        author: 'Casual-Autopsy',
      });

      expect(name).toBe('');
    });
  });

  describe('getBaseModelName', () => {
    it('should extract base name from full name with no prefixes', () => {
      expect(getBaseModelName('L3-Super-Nova-RP-8B')).toBe('L3-Super-Nova-RP-8B');
    });

    it('should extract base name from full name with author', () => {
      expect(getBaseModelName('Casual-Autopsy/L3-Super-Nova-RP-8B')).toBe('L3-Super-Nova-RP-8B');
    });

    it('should extract base name from full name with backend', () => {
      expect(getBaseModelName('aphrodite/L3-Super-Nova-RP-8B')).toBe('L3-Super-Nova-RP-8B');
    });

    it('should extract base name from full name with all prefixes', () => {
      expect(getBaseModelName('aphrodite/Casual-Autopsy/L3-Super-Nova-RP-8B')).toBe('L3-Super-Nova-RP-8B');
    });
  });

  describe('hasBackendPrefix', () => {
    it('should return false for name with no backend', () => {
      expect(hasBackendPrefix('L3-Super-Nova-RP-8B')).toBe(false);
    });

    it('should return false for name with only author', () => {
      expect(hasBackendPrefix('Casual-Autopsy/L3-Super-Nova-RP-8B')).toBe(false);
    });

    it('should return true for name with aphrodite backend', () => {
      expect(hasBackendPrefix('aphrodite/L3-Super-Nova-RP-8B')).toBe(true);
    });

    it('should return true for name with koboldcpp backend', () => {
      expect(hasBackendPrefix('koboldcpp/L3-Super-Nova-RP-8B')).toBe(true);
    });

    it('should return true for name with backend and author', () => {
      expect(hasBackendPrefix('aphrodite/Casual-Autopsy/L3-Super-Nova-RP-8B')).toBe(true);
    });
  });

  describe('getModelNameVariations', () => {
    it('should generate all variations for a base model name', () => {
      const variations = getModelNameVariations('L3-Super-Nova-RP-8B');

      expect(variations).toContain('L3-Super-Nova-RP-8B');
      expect(variations).toContain('aphrodite/L3-Super-Nova-RP-8B');
      expect(variations).toContain('koboldcpp/L3-Super-Nova-RP-8B');
      expect(variations.length).toBe(3);
    });

    it('should generate variations preserving author', () => {
      const variations = getModelNameVariations('Casual-Autopsy/L3-Super-Nova-RP-8B');

      expect(variations).toContain('Casual-Autopsy/L3-Super-Nova-RP-8B');
      expect(variations).toContain('aphrodite/Casual-Autopsy/L3-Super-Nova-RP-8B');
      expect(variations).toContain('koboldcpp/Casual-Autopsy/L3-Super-Nova-RP-8B');
      expect(variations.length).toBe(3);
    });

    it('should generate variations when already has backend', () => {
      const variations = getModelNameVariations('aphrodite/Casual-Autopsy/L3-Super-Nova-RP-8B');

      expect(variations).toContain('Casual-Autopsy/L3-Super-Nova-RP-8B');
      expect(variations).toContain('aphrodite/Casual-Autopsy/L3-Super-Nova-RP-8B');
      expect(variations).toContain('koboldcpp/Casual-Autopsy/L3-Super-Nova-RP-8B');
      expect(variations.length).toBe(3);
    });
  });

  describe('groupModelsByBaseName', () => {
    it('should group models by their base name', () => {
      const models = [
        'L3-Super-Nova-RP-8B',
        'aphrodite/L3-Super-Nova-RP-8B',
        'koboldcpp/L3-Super-Nova-RP-8B',
        'OtherModel',
      ];

      const groups = groupModelsByBaseName(models);

      expect(groups.size).toBe(2);
      expect(groups.get('L3-Super-Nova-RP-8B')).toEqual([
        'L3-Super-Nova-RP-8B',
        'aphrodite/L3-Super-Nova-RP-8B',
        'koboldcpp/L3-Super-Nova-RP-8B',
      ]);
      expect(groups.get('OtherModel')).toEqual(['OtherModel']);
    });

    it('should group models preserving author in base name', () => {
      const models = [
        'Author/Model',
        'aphrodite/Author/Model',
        'koboldcpp/Author/Model',
        'DifferentAuthor/Model',
      ];

      const groups = groupModelsByBaseName(models);

      expect(groups.size).toBe(2);
      expect(groups.get('Author/Model')?.length).toBe(3);
      expect(groups.get('DifferentAuthor/Model')?.length).toBe(1);
    });

    it('should handle empty array', () => {
      const groups = groupModelsByBaseName([]);

      expect(groups.size).toBe(0);
    });

    it('should handle single model', () => {
      const groups = groupModelsByBaseName(['Model']);

      expect(groups.size).toBe(1);
      expect(groups.get('Model')).toEqual(['Model']);
    });
  });

  describe('extractBackends', () => {
    it('should extract unique backends from model names', () => {
      const models = [
        'L3-Super-Nova-RP-8B',
        'aphrodite/Model1',
        'aphrodite/Model2',
        'koboldcpp/Model3',
      ];

      const backends = extractBackends(models);

      expect(backends).toContain(TextBackend.Aphrodite);
      expect(backends).toContain(TextBackend.KoboldCpp);
      expect(backends.length).toBe(2);
    });

    it('should return empty array when no backends found', () => {
      const models = ['Model1', 'Author/Model2'];

      const backends = extractBackends(models);

      expect(backends.length).toBe(0);
    });

    it('should handle empty array', () => {
      const backends = extractBackends([]);

      expect(backends.length).toBe(0);
    });

    it('should return unique backends only', () => {
      const models = [
        'aphrodite/Model1',
        'aphrodite/Model2',
        'aphrodite/Model3',
      ];

      const backends = extractBackends(models);

      expect(backends).toEqual([TextBackend.Aphrodite]);
    });
  });

  describe('Round-trip parsing and building', () => {
    it('should maintain name through parse and build cycle', () => {
      const original = 'aphrodite/Casual-Autopsy/L3-Super-Nova-RP-8B';
      const parsed = parseTextModelName(original);
      const rebuilt = buildTextModelName(parsed);

      expect(rebuilt).toBe(original);
    });

    it('should maintain simple name through cycle', () => {
      const original = 'ModelName';
      const parsed = parseTextModelName(original);
      const rebuilt = buildTextModelName(parsed);

      expect(rebuilt).toBe(original);
    });

    it('should maintain author-only name through cycle', () => {
      const original = 'Author/ModelName';
      const parsed = parseTextModelName(original);
      const rebuilt = buildTextModelName(parsed);

      expect(rebuilt).toBe(original);
    });
  });
});
