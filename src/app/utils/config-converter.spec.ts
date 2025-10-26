import { legacyConfigToSimplified, simplifiedToLegacyConfig } from './config-converter';
import { LegacyConfig } from '../models/api.models';

describe('Config Converter', () => {
  describe('legacyConfigToSimplified', () => {
    it('should convert legacy config with downloads to simplified format', () => {
      const legacyConfig: LegacyConfig = {
        files: [],
        download: [
          {
            file_name: 'model.ckpt',
            file_path: '',
            file_url: 'https://example.com/model.ckpt',
          },
        ],
      };

      const result = legacyConfigToSimplified(legacyConfig);

      expect(result.download.length).toBe(1);
      expect(result.download[0].file_name).toBe('model.ckpt');
      expect(result.download[0].file_url).toBe('https://example.com/model.ckpt');
    });

    it('should handle null legacy config', () => {
      const result = legacyConfigToSimplified(null);

      expect(result.download).toEqual([]);
    });

    it('should handle undefined legacy config', () => {
      const result = legacyConfigToSimplified(undefined);

      expect(result.download).toEqual([]);
    });

    it('should handle legacy config with no downloads', () => {
      const legacyConfig: LegacyConfig = {
        files: [],
        download: [],
      };

      const result = legacyConfigToSimplified(legacyConfig);

      expect(result.download).toEqual([]);
    });

    it('should convert multiple downloads', () => {
      const legacyConfig: LegacyConfig = {
        files: [],
        download: [
          {
            file_name: 'model1.ckpt',
            file_path: '',
            file_url: 'https://example.com/model1.ckpt',
          },
          {
            file_name: 'model2.safetensors',
            file_path: '',
            file_url: 'https://example.com/model2.safetensors',
          },
        ],
      };

      const result = legacyConfigToSimplified(legacyConfig);

      expect(result.download.length).toBe(2);
      expect(result.download[0].file_name).toBe('model1.ckpt');
      expect(result.download[1].file_name).toBe('model2.safetensors');
    });
  });

  describe('simplifiedToLegacyConfig', () => {
    it('should convert simplified downloads to legacy config format', () => {
      const simplified = {
        download: [
          {
            file_name: 'model.ckpt',
            file_url: 'https://example.com/model.ckpt',
          },
        ],
      };

      const result = simplifiedToLegacyConfig(simplified);

      expect(result.files).toEqual([]);
      expect(result.download?.length).toBe(1);
      expect(result.download![0].file_name).toBe('model.ckpt');
      expect(result.download![0].file_url).toBe('https://example.com/model.ckpt');
      expect(result.download![0].file_path).toBe(''); // Always empty string
    });

    it('should handle null simplified config', () => {
      const result = simplifiedToLegacyConfig(null);

      expect(result.files).toEqual([]);
      expect(result.download).toEqual([]);
    });

    it('should handle undefined simplified config', () => {
      const result = simplifiedToLegacyConfig(undefined);

      expect(result.files).toEqual([]);
      expect(result.download).toEqual([]);
    });

    it('should preserve existing files array', () => {
      const simplified = {
        download: [
          {
            file_name: 'model.ckpt',
            file_url: 'https://example.com/model.ckpt',
          },
        ],
      };

      const existingFiles = [
        {
          path: 'existing-config.yaml',
          sha256sum: 'abc123',
        },
      ];

      const result = simplifiedToLegacyConfig(simplified, existingFiles);

      expect(result.files).toEqual(existingFiles);
      expect(result.download?.length).toBe(1);
    });

    it('should convert multiple downloads', () => {
      const simplified = {
        download: [
          {
            file_name: 'model1.ckpt',
            file_url: 'https://example.com/model1.ckpt',
          },
          {
            file_name: 'model2.safetensors',
            file_url: 'https://example.com/model2.safetensors',
          },
        ],
      };

      const result = simplifiedToLegacyConfig(simplified);

      expect(result.download?.length).toBe(2);
      expect(result.download![0].file_name).toBe('model1.ckpt');
      expect(result.download![0].file_path).toBe('');
      expect(result.download![1].file_name).toBe('model2.safetensors');
      expect(result.download![1].file_path).toBe('');
    });

    it('should handle empty download array', () => {
      const simplified = {
        download: [],
      };

      const result = simplifiedToLegacyConfig(simplified);

      expect(result.files).toEqual([]);
      expect(result.download).toEqual([]);
    });
  });

  describe('round-trip conversion', () => {
    it('should maintain data integrity through round-trip conversion', () => {
      const originalLegacy: LegacyConfig = {
        files: [],
        download: [
          {
            file_name: 'model.ckpt',
            file_path: '',
            file_url: 'https://example.com/model.ckpt',
          },
        ],
      };

      // Convert to simplified
      const simplified = legacyConfigToSimplified(originalLegacy);

      // Convert back to legacy
      const backToLegacy = simplifiedToLegacyConfig(simplified, originalLegacy.files);

      expect(backToLegacy.download?.length).toBe(1);
      expect(backToLegacy.download![0].file_name).toBe(originalLegacy.download![0].file_name);
      expect(backToLegacy.download![0].file_url).toBe(originalLegacy.download![0].file_url);
      expect(backToLegacy.download![0].file_path).toBe(''); // Always normalized to empty string
    });

    it('should preserve files array through round-trip', () => {
      const originalLegacy: LegacyConfig = {
        files: [
          {
            path: 'config.yaml',
            sha256sum: 'abc123',
          },
        ],
        download: [
          {
            file_name: 'model.ckpt',
            file_path: '',
            file_url: 'https://example.com/model.ckpt',
          },
        ],
      };

      const simplified = legacyConfigToSimplified(originalLegacy);
      const backToLegacy = simplifiedToLegacyConfig(simplified, originalLegacy.files);

      expect(backToLegacy.files).toEqual(originalLegacy.files);
    });
  });
});
