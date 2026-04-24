import { describe, it, expect } from 'vitest';
import {
  legacyApiToForm,
  formToLegacyApi,
  v2ApiToForm,
  formToV2Api,
  legacyApiToV2Api,
} from './model-format-adapter';
import {
  MODEL_REFERENCE_CATEGORY,
  ImageGenerationModelRecordInput,
  TextGenerationModelRecordInput,
  ControlNetModelRecordInput,
  GenericModelRecordInput,
  ImageGenerationModelRecordOutput,
  TextGenerationModelRecordOutput,
  ControlNetModelRecordOutput,
  GenericModelRecordOutput,
} from '../api-client';
import { LegacyRecordUnion } from '../models/api.models';

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

function makeLegacyImageGenModel(overrides: Partial<LegacyRecordUnion> = {}): LegacyRecordUnion {
  return {
    name: 'test-sd-model',
    description: 'A test SD model',
    version: '1.0',
    nsfw: true,
    style: 'realistic',
    type: 'ckpt',
    download_all: false,
    available: null,
    config: {
      files: [{ path: 'model.safetensors' }],
      download: [
        {
          file_name: 'model.safetensors',
          file_url: 'https://example.com/model.safetensors',
          sha256sum: 'abc123',
        },
      ],
    },
    inpainting: false,
    baseline: 'stable_diffusion_xl',
    tags: ['anime', 'realistic'],
    showcases: ['https://example.com/showcase1.png'],
    trigger: ['trigger1'],
    homepage: 'https://example.com',
    size_on_disk_bytes: 5000000000,
    optimization: 'fp16',
    requirements: { min_vram: 8 },
    ...overrides,
  } as LegacyRecordUnion;
}

function makeLegacyTextGenModel(overrides: Partial<LegacyRecordUnion> = {}): LegacyRecordUnion {
  return {
    name: 'test-llm',
    description: 'A test LLM',
    version: '2.0',
    nsfw: false,
    style: null,
    config: {
      files: [],
      download: [{ file_name: 'model.gguf', file_url: 'https://example.com/model.gguf' }],
    },
    parameters: 7000000000,
    model_name: 'TestLLM-7B',
    baseline: 'llama',
    display_name: 'TestLLM 7B',
    url: 'https://example.com/model',
    tags: ['chat'],
    settings: { max_length: 4096 },
    ...overrides,
  } as LegacyRecordUnion;
}

function makeLegacyControlnetModel(overrides: Partial<LegacyRecordUnion> = {}): LegacyRecordUnion {
  return {
    name: 'test-controlnet',
    description: 'A test ControlNet',
    version: '1.0',
    nsfw: false,
    config: {
      files: [],
      download: [],
    },
    controlnet_style: 'canny',
    ...overrides,
  } as LegacyRecordUnion;
}

function makeV2ImageGenModel(): ImageGenerationModelRecordOutput {
  return {
    name: 'test-sd-model',
    record_type: MODEL_REFERENCE_CATEGORY.ImageGeneration,
    description: 'A test SD model',
    version: '1.0',
    nsfw: true,
    style: 'realistic',
    baseline: 'stable_diffusion_xl',
    inpainting: false,
    tags: ['anime', 'realistic'],
    showcases: ['https://example.com/showcase1.png'],
    trigger: ['trigger1'],
    homepage: 'https://example.com',
    size_on_disk_bytes: 5000000000,
    optimization: 'fp16',
    requirements: { min_vram: 8 },
    config: {
      download: [
        {
          file_name: 'model.safetensors',
          file_url: 'https://example.com/model.safetensors',
          sha256sum: 'abc123',
        },
      ],
    },
    model_classification: { domain: 'image', purpose: 'generation' },
    finetune_series: null,
  } as ImageGenerationModelRecordOutput;
}

function makeV2TextGenModel(): TextGenerationModelRecordOutput {
  return {
    name: 'test-llm',
    record_type: MODEL_REFERENCE_CATEGORY.TextGeneration,
    description: 'A test LLM',
    version: '2.0',
    nsfw: false,
    style: null,
    parameters: 7000000000,
    baseline: 'llama',
    display_name: 'TestLLM 7B',
    url: 'https://example.com/model',
    tags: ['chat'],
    settings: { max_length: 4096 },
    config: {
      download: [{ file_name: 'model.gguf', file_url: 'https://example.com/model.gguf' }],
    },
    model_classification: { domain: 'text', purpose: 'generation' },
    finetune_series: null,
  } as TextGenerationModelRecordOutput;
}

function makeV2ControlnetModel(): ControlNetModelRecordOutput {
  return {
    name: 'test-controlnet',
    record_type: MODEL_REFERENCE_CATEGORY.Controlnet,
    description: 'A test ControlNet',
    version: '1.0',
    controlnet_style: 'canny',
    config: { download: [] },
    model_classification: { domain: 'image', purpose: 'auxiliary_or_patch' },
    finetune_series: null,
  } as ControlNetModelRecordOutput;
}

// ---------------------------------------------------------------------------
// Legacy → Form → Legacy round-trip tests
// ---------------------------------------------------------------------------

describe('model-format-adapter', () => {
  describe('legacy round-trip: legacyApiToForm → formToLegacyApi', () => {
    it('should round-trip image generation models', () => {
      const original = makeLegacyImageGenModel();
      const category = MODEL_REFERENCE_CATEGORY.ImageGeneration;

      const formData = legacyApiToForm(original, category);
      const roundTripped = formToLegacyApi(formData, 'test-sd-model', category);

      expect(roundTripped.name).toBe('test-sd-model');
      expect(roundTripped.description).toBe(original.description);
      expect(roundTripped.nsfw).toBe(original.nsfw);
      expect(roundTripped.style).toBe(original.style);
      expect((roundTripped as Record<string, unknown>)['baseline']).toBe('stable_diffusion_xl');
      expect((roundTripped as Record<string, unknown>)['inpainting']).toBe(false);
      expect((roundTripped as Record<string, unknown>)['tags']).toEqual(['anime', 'realistic']);
      expect((roundTripped as Record<string, unknown>)['trigger']).toEqual(['trigger1']);
      expect((roundTripped as Record<string, unknown>)['homepage']).toBe('https://example.com');
      expect((roundTripped as Record<string, unknown>)['requirements']).toEqual({ min_vram: 8 });
    });

    it('should round-trip text generation models', () => {
      const original = makeLegacyTextGenModel();
      const category = MODEL_REFERENCE_CATEGORY.TextGeneration;

      const formData = legacyApiToForm(original, category);
      const roundTripped = formToLegacyApi(formData, 'test-llm', category);

      expect(roundTripped.name).toBe('test-llm');
      expect(roundTripped.description).toBe(original.description);
      expect(roundTripped.nsfw).toBe(false);
      expect((roundTripped as Record<string, unknown>)['parameters']).toBe(7000000000);
      expect((roundTripped as Record<string, unknown>)['baseline']).toBe('llama');
      expect((roundTripped as Record<string, unknown>)['display_name']).toBe('TestLLM 7B');
      expect((roundTripped as Record<string, unknown>)['tags']).toEqual(['chat']);
      expect((roundTripped as Record<string, unknown>)['settings']).toEqual({ max_length: 4096 });
    });

    it('should round-trip controlnet models', () => {
      const original = makeLegacyControlnetModel();
      const category = MODEL_REFERENCE_CATEGORY.Controlnet;

      const formData = legacyApiToForm(original, category);
      const roundTripped = formToLegacyApi(formData, 'test-controlnet', category);

      expect(roundTripped.name).toBe('test-controlnet');
      expect((roundTripped as Record<string, unknown>)['controlnet_style']).toBe('canny');
    });

    it('should preserve download config through round-trip', () => {
      const original = makeLegacyImageGenModel();
      const category = MODEL_REFERENCE_CATEGORY.ImageGeneration;

      const formData = legacyApiToForm(original, category);
      const roundTripped = formToLegacyApi(formData, 'test-sd-model', category);

      // Config converter moves sha256sum to files and adds file_path to downloads
      const dl = roundTripped.config?.download?.[0];
      expect(dl?.file_name).toBe('model.safetensors');
      expect(dl?.file_url).toBe('https://example.com/model.safetensors');
    });

    it('should preserve legacy files through round-trip', () => {
      const original = makeLegacyImageGenModel();
      const category = MODEL_REFERENCE_CATEGORY.ImageGeneration;

      const formData = legacyApiToForm(original, category);

      expect(formData.legacyFiles).toEqual([{ path: 'model.safetensors' }]);

      const roundTripped = formToLegacyApi(formData, 'test-sd-model', category);
      // Config converter merges sha256sum into files from downloads
      const files = roundTripped.config?.files;
      expect(files?.length).toBe(1);
      expect(files?.[0].path).toBe('model.safetensors');
    });

    it('should apply legacy fixed fields for image_generation', () => {
      const original = makeLegacyImageGenModel({ type: undefined, available: true });
      const category = MODEL_REFERENCE_CATEGORY.ImageGeneration;

      const formData = legacyApiToForm(original, category);
      const roundTripped = formToLegacyApi(formData, 'test-sd-model', category);

      // applyFixedFields sets type='ckpt' and available=null for image_generation
      expect(roundTripped.type).toBe('ckpt');
      expect(roundTripped.available).toBeNull();
    });

    it('should handle generic/unmapped categories', () => {
      const model: LegacyRecordUnion = {
        name: 'test-esrgan',
        description: 'An ESRGAN model',
        version: '1.0',
        config: { files: [], download: [] },
      };
      const category = MODEL_REFERENCE_CATEGORY.Esrgan;

      const formData = legacyApiToForm(model, category);
      expect(formData.categoryData.kind).toBe('generic');
      expect(formData.categoryData.data).toBeNull();

      const roundTripped = formToLegacyApi(formData, 'test-esrgan', category);
      expect(roundTripped.name).toBe('test-esrgan');
      expect(roundTripped.description).toBe('An ESRGAN model');
    });
  });

  // ---------------------------------------------------------------------------
  // V2 → Form → V2 round-trip tests
  // ---------------------------------------------------------------------------

  describe('V2 round-trip: v2ApiToForm → formToV2Api', () => {
    it('should round-trip image generation models', () => {
      const original = makeV2ImageGenModel();
      const category = MODEL_REFERENCE_CATEGORY.ImageGeneration;

      const formData = v2ApiToForm(original, category);
      const roundTripped = formToV2Api(
        formData,
        'test-sd-model',
        category,
      ) as ImageGenerationModelRecordInput;

      expect(roundTripped.name).toBe('test-sd-model');
      expect(roundTripped.record_type).toBe(MODEL_REFERENCE_CATEGORY.ImageGeneration);
      expect(roundTripped.description).toBe('A test SD model');
      expect(roundTripped.nsfw).toBe(true);
      expect(roundTripped.style).toBe('realistic');
      expect(roundTripped.baseline).toBe('stable_diffusion_xl');
      expect(roundTripped.inpainting).toBe(false);
      expect(roundTripped.tags).toEqual(['anime', 'realistic']);
      expect(roundTripped.trigger).toEqual(['trigger1']);
      expect(roundTripped.homepage).toBe('https://example.com');
      expect(roundTripped.requirements).toEqual({ min_vram: 8 });
    });

    it('should round-trip text generation models', () => {
      const original = makeV2TextGenModel();
      const category = MODEL_REFERENCE_CATEGORY.TextGeneration;

      const formData = v2ApiToForm(original, category);
      const roundTripped = formToV2Api(
        formData,
        'test-llm',
        category,
      ) as TextGenerationModelRecordInput;

      expect(roundTripped.name).toBe('test-llm');
      expect(roundTripped.record_type).toBe(MODEL_REFERENCE_CATEGORY.TextGeneration);
      expect(roundTripped.parameters).toBe(7000000000);
      expect(roundTripped.baseline).toBe('llama');
      expect(roundTripped.display_name).toBe('TestLLM 7B');
      expect(roundTripped.tags).toEqual(['chat']);
      expect(roundTripped.settings).toEqual({ max_length: 4096 });
    });

    it('should round-trip controlnet models', () => {
      const original = makeV2ControlnetModel();
      const category = MODEL_REFERENCE_CATEGORY.Controlnet;

      const formData = v2ApiToForm(original, category);
      const roundTripped = formToV2Api(
        formData,
        'test-controlnet',
        category,
      ) as ControlNetModelRecordInput;

      expect(roundTripped.name).toBe('test-controlnet');
      expect(roundTripped.controlnet_style).toBe('canny');
    });

    it('should default controlnet_style to empty string when null or undefined', () => {
      const category = MODEL_REFERENCE_CATEGORY.Controlnet;

      const withNull = {
        ...makeV2ControlnetModel(),
        controlnet_style: null,
      } as ControlNetModelRecordOutput;
      const nullForm = v2ApiToForm(withNull, category);
      expect(nullForm.categoryData.kind).toBe('controlnet');
      if (nullForm.categoryData.kind === 'controlnet') {
        expect(nullForm.categoryData.data.controlnet_style).toBe('');
      }

      const withUndefined = {
        ...makeV2ControlnetModel(),
        controlnet_style: undefined,
      } as ControlNetModelRecordOutput;
      const undefForm = v2ApiToForm(withUndefined, category);
      if (undefForm.categoryData.kind === 'controlnet') {
        expect(undefForm.categoryData.data.controlnet_style).toBe('');
      }
    });

    it('should preserve V2 fields (model_classification, finetune_series)', () => {
      const original = makeV2ImageGenModel();
      const category = MODEL_REFERENCE_CATEGORY.ImageGeneration;

      const formData = v2ApiToForm(original, category);

      expect(formData.v2Fields).not.toBeNull();
      expect(formData.v2Fields!.modelClassification).toEqual({
        domain: 'image',
        purpose: 'generation',
      });
      expect(formData.v2Fields!.finetuneSeries).toBeNull();

      const roundTripped = formToV2Api(
        formData,
        'test-sd-model',
        category,
      ) as ImageGenerationModelRecordInput;
      expect(roundTripped.model_classification).toEqual({
        domain: 'image',
        purpose: 'generation',
      });
    });

    it('should preserve download config through V2 round-trip', () => {
      const original = makeV2ImageGenModel();
      const category = MODEL_REFERENCE_CATEGORY.ImageGeneration;

      const formData = v2ApiToForm(original, category);
      const roundTripped = formToV2Api(formData, 'test-sd-model', category);

      expect(roundTripped.config?.download).toEqual([
        {
          file_name: 'model.safetensors',
          file_url: 'https://example.com/model.safetensors',
          sha256sum: 'abc123',
        },
      ]);
    });

    it('should set legacyFiles to empty array for V2 sources', () => {
      const original = makeV2ImageGenModel();
      const formData = v2ApiToForm(original, MODEL_REFERENCE_CATEGORY.ImageGeneration);

      expect(formData.legacyFiles).toEqual([]);
    });

    it('should handle generic V2 models (e.g., ESRGAN)', () => {
      const model: GenericModelRecordOutput = {
        name: 'test-esrgan',
        record_type: 'esrgan',
        description: 'ESRGAN model',
        version: '1.0',
        config: { download: [] },
        model_classification: { domain: 'image', purpose: 'miscellaneous' },
      } as GenericModelRecordOutput;
      const category = MODEL_REFERENCE_CATEGORY.Esrgan;

      const formData = v2ApiToForm(model, category);
      expect(formData.categoryData.kind).toBe('generic');

      const roundTripped = formToV2Api(
        formData,
        'test-esrgan',
        category,
      ) as GenericModelRecordInput;
      expect(roundTripped.name).toBe('test-esrgan');
      expect(roundTripped.record_type).toBe(MODEL_REFERENCE_CATEGORY.Esrgan);
    });
  });

  // ---------------------------------------------------------------------------
  // Cross-format: legacy → form → V2 (used by deprecated compat methods)
  // ---------------------------------------------------------------------------

  describe('cross-format: legacyApiToV2Api', () => {
    it('should convert legacy image_generation model to V2 format', () => {
      const legacy = makeLegacyImageGenModel();
      const result = legacyApiToV2Api(
        legacy,
        'test-sd-model',
        MODEL_REFERENCE_CATEGORY.ImageGeneration,
      ) as ImageGenerationModelRecordInput;

      expect(result.name).toBe('test-sd-model');
      expect(result.record_type).toBe(MODEL_REFERENCE_CATEGORY.ImageGeneration);
      expect(result.baseline).toBe('stable_diffusion_xl');
      expect(result.nsfw).toBe(true);
      expect(result.inpainting).toBe(false);
    });

    it('should convert legacy text_generation model to V2 format', () => {
      const legacy = makeLegacyTextGenModel();
      const result = legacyApiToV2Api(
        legacy,
        'test-llm',
        MODEL_REFERENCE_CATEGORY.TextGeneration,
      ) as TextGenerationModelRecordInput;

      expect(result.name).toBe('test-llm');
      expect(result.parameters).toBe(7000000000);
      expect(result.baseline).toBe('llama');
    });
  });

  // ---------------------------------------------------------------------------
  // FormModelData structure tests
  // ---------------------------------------------------------------------------

  describe('FormModelData structure', () => {
    it('should set v2Fields to null when loading from legacy', () => {
      const legacy = makeLegacyImageGenModel();
      const formData = legacyApiToForm(legacy, MODEL_REFERENCE_CATEGORY.ImageGeneration);

      expect(formData.v2Fields).toBeNull();
    });

    it('should populate v2Fields when loading from V2', () => {
      const v2 = makeV2ImageGenModel();
      const formData = v2ApiToForm(v2, MODEL_REFERENCE_CATEGORY.ImageGeneration);

      expect(formData.v2Fields).not.toBeNull();
      expect(formData.v2Fields!.recordType).toBe(MODEL_REFERENCE_CATEGORY.ImageGeneration);
    });

    it('should correctly discriminate category form data kinds', () => {
      const imageForm = legacyApiToForm(
        makeLegacyImageGenModel(),
        MODEL_REFERENCE_CATEGORY.ImageGeneration,
      );
      expect(imageForm.categoryData.kind).toBe('image_generation');

      const textForm = legacyApiToForm(
        makeLegacyTextGenModel(),
        MODEL_REFERENCE_CATEGORY.TextGeneration,
      );
      expect(textForm.categoryData.kind).toBe('text_generation');

      const controlnetForm = legacyApiToForm(
        makeLegacyControlnetModel(),
        MODEL_REFERENCE_CATEGORY.Controlnet,
      );
      expect(controlnetForm.categoryData.kind).toBe('controlnet');
    });

    it('should extract common fields identically from both formats', () => {
      const legacyForm = legacyApiToForm(
        makeLegacyImageGenModel(),
        MODEL_REFERENCE_CATEGORY.ImageGeneration,
      );
      const v2Form = v2ApiToForm(makeV2ImageGenModel(), MODEL_REFERENCE_CATEGORY.ImageGeneration);

      expect(legacyForm.commonData.nsfw).toBe(v2Form.commonData.nsfw);
      expect(legacyForm.commonData.description).toBe(v2Form.commonData.description);
      expect(legacyForm.commonData.version).toBe(v2Form.commonData.version);
    });
  });

  // ---------------------------------------------------------------------------
  // Edge cases
  // ---------------------------------------------------------------------------

  describe('edge cases', () => {
    it('should handle models with no config', () => {
      const model: LegacyRecordUnion = {
        name: 'no-config-model',
        description: 'Model without config',
      } as LegacyRecordUnion;
      const formData = legacyApiToForm(model, MODEL_REFERENCE_CATEGORY.ImageGeneration);

      expect(formData.downloads).toEqual([]);
      expect(formData.legacyFiles).toEqual([]);
    });

    it('should handle models with empty downloads', () => {
      const model = makeLegacyImageGenModel({
        config: { files: [], download: [] },
      });
      const formData = legacyApiToForm(model, MODEL_REFERENCE_CATEGORY.ImageGeneration);
      expect(formData.downloads).toEqual([]);
    });

    it('should handle null/undefined optional fields gracefully', () => {
      const model: LegacyRecordUnion = {
        name: 'sparse-model',
        description: null,
        version: undefined,
        nsfw: undefined,
        style: undefined,
      } as unknown as LegacyRecordUnion;

      const formData = legacyApiToForm(model, MODEL_REFERENCE_CATEGORY.ImageGeneration);
      expect(formData.commonData.description).toBeNull();
      // nsfw defaults to true for safety when not specified in legacy records
      expect(formData.commonData.nsfw).toBe(true);
    });

    it('should produce valid V2 output even when v2Fields is null (legacy source)', () => {
      const legacy = makeLegacyImageGenModel();
      const formData = legacyApiToForm(legacy, MODEL_REFERENCE_CATEGORY.ImageGeneration);

      expect(formData.v2Fields).toBeNull();

      // Should still produce valid V2 output (model_classification will be undefined)
      const v2Result = formToV2Api(
        formData,
        'test-model',
        MODEL_REFERENCE_CATEGORY.ImageGeneration,
      ) as ImageGenerationModelRecordInput;
      expect(v2Result.name).toBe('test-model');
      expect(v2Result.record_type).toBe(MODEL_REFERENCE_CATEGORY.ImageGeneration);
      expect(v2Result.model_classification).toBeUndefined();
    });
  });
});
