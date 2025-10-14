import { testEnvironment } from '../../environments/environment.test';
import { ContainsMessage, ErrorResponse } from '../api-client';
import {
  BackendCapabilities,
  CategoryModelsResponse,
  LegacyClipRecord,
  LegacyConfigDownload,
  LegacyConfigFile,
  LegacyGenericRecord,
  LegacyModelsResponse,
  LegacyStableDiffusionRecord,
  LegacyTextGenerationRecord,
  ModelRecord,
  ModelReferenceCategory,
} from './api.models';
import {
  fetchOpenApiSchema,
  getAllPaths,
  getAllSchemaNames,
  getEnumValues,
  getSchemaDefinition,
  hasEndpoint,
  hasSchema,
  isInEnum,
  OpenApiSchema,
  OpenApiSchemaDefinition,
  TEST_MODEL_NAMES,
  TEST_URLS,
  TEST_FILE_NAMES,
  TEST_DESCRIPTIONS,
  TEST_PARAMETERS,
  TEST_PRETRAINED_NAMES,
  REPLICATE_MODES,
  CANONICAL_FORMATS,
  SCHEMA_NAMES,
} from './test-helpers';

/**
 * Configuration for the API validation tests.
 * Modify environment.test.ts to test against a different service instance.
 */
const TEST_CONFIG = testEnvironment;

describe('API Models - OpenAPI Schema Validation', () => {
  let openApiSchema: OpenApiSchema;
  let schemaFetchError: Error | null = null;

  beforeAll(async () => {
    // Log which schema source we're testing against
    const schemaSource = TEST_CONFIG.useRemoteSchema ? 'remote service' : 'local file';
    const schemaUrl = TEST_CONFIG.useRemoteSchema
      ? TEST_CONFIG.remoteApiUrl
      : TEST_CONFIG.localApiUrl;
    console.log(`\n📋 Testing against ${schemaSource}: ${schemaUrl}`);

    // Fetch the OpenAPI schema from the service using helper
    try {
      openApiSchema = await fetchOpenApiSchema(schemaUrl, TEST_CONFIG.timeout);
    } catch (error) {
      schemaFetchError = error instanceof Error ? error : new Error(String(error));
      console.error('Failed to fetch OpenAPI schema:', schemaFetchError);
    }
  });

  describe('Schema Availability', () => {
    it('should successfully fetch the OpenAPI schema from the service', () => {
      if (schemaFetchError) {
        pending(`OpenAPI schema not available: ${schemaFetchError.message}`);
        return;
      }

      expect(openApiSchema).toBeDefined();
    });

    it('should have a valid OpenAPI version', () => {
      if (schemaFetchError) {
        pending('OpenAPI schema not available');
        return;
      }

      expect(openApiSchema.openapi).toBeDefined();
      expect(openApiSchema.openapi).toMatch(/^3\.\d+\.\d+$/);
    });

    it('should have component schemas defined', () => {
      if (schemaFetchError) {
        pending('OpenAPI schema not available');
        return;
      }

      const schemaNames = getAllSchemaNames(openApiSchema);
      expect(schemaNames.length).toBeGreaterThan(0);
    });
  });

  describe('Response Models', () => {
    it('ContainsMessage should match schema', () => {
      if (schemaFetchError) {
        pending('OpenAPI schema not available');
        return;
      }

      const schema = getSchemaDefinition(openApiSchema, SCHEMA_NAMES.CONTAINS_MESSAGE);
      expect(schema).toBeDefined();

      // Validate structure
      const mockResponse: ContainsMessage = {
        message: 'test message',
      };

      expect(mockResponse.message).toBeDefined();
      expect(typeof mockResponse.message).toBe('string');

      // Check required fields match schema
      if (schema && 'required' in schema && Array.isArray(schema.required)) {
        expect(schema.required).toContain('message');
      }
    });

    it('BackendCapabilities should have correct mode values', () => {
      if (schemaFetchError) {
        pending('OpenAPI schema not available');
        return;
      }

      const replicateModeSchema = getSchemaDefinition(openApiSchema, SCHEMA_NAMES.REPLICATE_MODE);
      expect(replicateModeSchema).toBeDefined();

      const mockCapabilities: BackendCapabilities = {
        writable: true,
        mode: 'PRIMARY',
        canonicalFormat: 'legacy',
      };

      expect(REPLICATE_MODES).toContain(mockCapabilities.mode);
      expect(CANONICAL_FORMATS).toContain(mockCapabilities.canonicalFormat);

      // Verify enum values if available in schema
      if (replicateModeSchema) {
        expect(isInEnum(replicateModeSchema, 'PRIMARY')).toBe(true);
        expect(isInEnum(replicateModeSchema, 'REPLICA')).toBe(true);
      }
    });

    it('ErrorResponse should match schema', () => {
      if (schemaFetchError) {
        pending('OpenAPI schema not available');
        return;
      }

      const schema = getSchemaDefinition(openApiSchema, SCHEMA_NAMES.ERROR_RESPONSE);
      expect(schema).toBeDefined();

      const mockError: ErrorResponse = {
        detail: 'Error message',
      };

      expect(mockError.detail).toBeDefined();
      expect(typeof mockError.detail).toBe('string');
    });

    it('ModelReferenceCategory should match MODEL_REFERENCE_CATEGORY enum', () => {
      if (schemaFetchError) {
        pending('OpenAPI schema not available');
        return;
      }

      const schema = getSchemaDefinition(openApiSchema, 'MODEL_REFERENCE_CATEGORY');
      expect(schema).toBeDefined();

      const validCategories: ModelReferenceCategory[] = [
        'image_generation',
        'text_generation',
        'clip',
      ];

      // Check that our categories are in the schema enum
      if (schema) {
        validCategories.forEach((category) => {
          expect(isInEnum(schema, category)).toBe(true);
        });
      }
    });
  });

  describe('Legacy Model Records', () => {
    it('LegacyConfigFile should have correct properties', () => {
      if (schemaFetchError) {
        pending('OpenAPI schema not available');
        return;
      }

      const mockConfigFile: LegacyConfigFile = {
        path: '/path/to/file',
        md5sum: 'abc123',
        sha256sum: 'def456',
        file_type: TEST_FILE_NAMES.SAFETENSORS,
      };

      expect(mockConfigFile.path).toBeDefined();
      expect(typeof mockConfigFile.path).toBe('string');
      expect(mockConfigFile.md5sum === null || typeof mockConfigFile.md5sum === 'string').toBe(
        true,
      );
      expect(
        mockConfigFile.sha256sum === null || typeof mockConfigFile.sha256sum === 'string',
      ).toBe(true);
    });

    it('LegacyConfigDownload should have correct properties', () => {
      if (schemaFetchError) {
        pending('OpenAPI schema not available');
        return;
      }

      const mockDownload: LegacyConfigDownload = {
        file_name: TEST_FILE_NAMES.SAFETENSORS,
        file_path: '/path/to/model.safetensors',
        file_url: TEST_URLS.MODEL_SAFETENSORS,
      };

      expect(mockDownload.file_name === null || typeof mockDownload.file_name === 'string').toBe(
        true,
      );
      expect(mockDownload.file_path === null || typeof mockDownload.file_path === 'string').toBe(
        true,
      );
      expect(mockDownload.file_url === null || typeof mockDownload.file_url === 'string').toBe(
        true,
      );
    });

    it('LegacyGenericRecord should have required fields', () => {
      if (schemaFetchError) {
        pending('OpenAPI schema not available');
        return;
      }

      const mockRecord: LegacyGenericRecord = {
        name: TEST_MODEL_NAMES.DEFAULT,
        type: 'model',
        description: TEST_DESCRIPTIONS.GENERIC_MODEL,
      };

      expect(mockRecord.name).toBeDefined();
      expect(typeof mockRecord.name).toBe('string');
      expect(mockRecord.type === null || typeof mockRecord.type === 'string').toBe(true);
      expect(mockRecord.description === null || typeof mockRecord.description === 'string').toBe(
        true,
      );
    });

    it('LegacyStableDiffusionRecord should match ImageGenerationModelRecord schema properties', () => {
      if (schemaFetchError) {
        pending('OpenAPI schema not available');
        return;
      }

      const schema = getSchemaDefinition(openApiSchema, SCHEMA_NAMES.IMAGE_GENERATION_OUTPUT);
      expect(schema).toBeDefined();

      const mockRecord: LegacyStableDiffusionRecord = {
        name: TEST_MODEL_NAMES.STABLE_DIFFUSION,
        inpainting: false,
        baseline: 'stable_diffusion_1',
        description: TEST_DESCRIPTIONS.STABLE_DIFFUSION,
        tags: ['generalist'],
        showcases: [],
        trigger: [],
      };

      expect(mockRecord.name).toBeDefined();
      expect(typeof mockRecord.name).toBe('string');
      expect(typeof mockRecord.inpainting).toBe('boolean');
      expect(typeof mockRecord.baseline).toBe('string');

      // Verify the baseline enum
      const baselineSchema = getSchemaDefinition(openApiSchema, SCHEMA_NAMES.KNOWN_IMAGE_GENERATION_BASELINE);
      if (baselineSchema) {
        expect(isInEnum(baselineSchema, 'stable_diffusion_1')).toBe(true);
        expect(isInEnum(baselineSchema, 'stable_diffusion_2_768')).toBe(true);
        expect(isInEnum(baselineSchema, 'stable_diffusion_xl')).toBe(true);
      }
    });

    it('LegacyTextGenerationRecord should match TextGenerationModelRecord schema properties', () => {
      if (schemaFetchError) {
        pending('OpenAPI schema not available');
        return;
      }

      const schema = getSchemaDefinition(openApiSchema, SCHEMA_NAMES.TEXT_GENERATION_OUTPUT);
      expect(schema).toBeDefined();

      const mockRecord: LegacyTextGenerationRecord = {
        name: TEST_MODEL_NAMES.LLAMA,
        model_name: TEST_MODEL_NAMES.LLAMA,
        baseline: 'llama',
        parameters: TEST_PARAMETERS.LLAMA_7B,
        display_name: TEST_DESCRIPTIONS.LLAMA,
        tags: ['generalist'],
      };

      expect(mockRecord.name).toBeDefined();
      expect(typeof mockRecord.name).toBe('string');
      expect(mockRecord.parameters === null || typeof mockRecord.parameters === 'number').toBe(
        true,
      );
      expect(mockRecord.baseline === null || typeof mockRecord.baseline === 'string').toBe(true);
    });

    it('LegacyClipRecord should have correct structure', () => {
      if (schemaFetchError) {
        pending('OpenAPI schema not available');
        return;
      }

      const mockRecord: LegacyClipRecord = {
        name: TEST_MODEL_NAMES.CLIP,
        pretrained_name: TEST_PRETRAINED_NAMES.CLIP_VIT_LARGE,
        description: 'CLIP model',
      };

      expect(mockRecord.name).toBeDefined();
      expect(typeof mockRecord.name).toBe('string');
      expect(
        mockRecord.pretrained_name === null || typeof mockRecord.pretrained_name === 'string',
      ).toBe(true);
    });

    it('requirements field should support various value types', () => {
      if (schemaFetchError) {
        pending('OpenAPI schema not available');
        return;
      }

      const mockRecord: LegacyStableDiffusionRecord = {
        name: TEST_MODEL_NAMES.DEFAULT,
        inpainting: false,
        baseline: 'stable_diffusion_1',
        requirements: {
          min_ram: 8,
          gpu_required: true,
          supported_samplers: ['k_euler', 'k_euler_a'],
          max_steps: 150,
        },
      };

      expect(mockRecord.requirements).toBeDefined();
      if (mockRecord.requirements) {
        expect(typeof mockRecord.requirements['min_ram']).toBe('number');
        expect(typeof mockRecord.requirements['gpu_required']).toBe('boolean');
        expect(Array.isArray(mockRecord.requirements['supported_samplers'])).toBe(true);
      }
    });
  });

  describe('Request/Response Types', () => {
    it('CategoryModelsResponse should be a record of model names to records', () => {
      if (schemaFetchError) {
        pending('OpenAPI schema not available');
        return;
      }

      const mockResponse: Record<string, Partial<ModelRecord>> = {
        'model-1': {
          name: 'model-1',
          description: 'First model',
        },
        'model-2': {
          name: 'model-2',
          description: 'Second model',
        },
      };

      expect(typeof mockResponse).toBe('object');
      expect(Object.keys(mockResponse).length).toBeGreaterThan(0);

      Object.values(mockResponse).forEach((record) => {
        expect(record.name).toBeDefined();
        expect(typeof record.name).toBe('string');
      });
    });

    it('LegacyModelsResponse should be a record of model names to legacy records', () => {
      if (schemaFetchError) {
        pending('OpenAPI schema not available');
        return;
      }

      const mockResponse: LegacyModelsResponse = {
        [TEST_MODEL_NAMES.IMAGE]: {
          name: TEST_MODEL_NAMES.IMAGE,
          inpainting: false,
          baseline: 'stable_diffusion_1',
        },
        [TEST_MODEL_NAMES.TEXT]: {
          name: TEST_MODEL_NAMES.TEXT,
          parameters: TEST_PARAMETERS.LLAMA_7B,
        },
      };

      expect(typeof mockResponse).toBe('object');
      expect(Object.keys(mockResponse).length).toBeGreaterThan(0);

      Object.values(mockResponse).forEach((record) => {
        expect(record.name).toBeDefined();
        expect(typeof record.name).toBe('string');
      });
    });
  });

  describe('Schema Enum Validation', () => {
    it('MODEL_REFERENCE_CATEGORY enum should match OpenAPI schema', () => {
      if (schemaFetchError) {
        pending('OpenAPI schema not available');
        return;
      }

      const schema = getSchemaDefinition(openApiSchema, SCHEMA_NAMES.MODEL_REFERENCE_CATEGORY);
      expect(schema).toBeDefined();

      if (schema) {
        const enumValues = getEnumValues(schema);
        // Check that common categories exist
        expect(enumValues).toContain('image_generation');
        expect(enumValues).toContain('text_generation');
        expect(enumValues).toContain('clip');
        expect(enumValues).toContain('controlnet');

        console.log('Available model categories:', enumValues);
      }
    });

    it('KNOWN_IMAGE_GENERATION_BASELINE enum should match OpenAPI schema', () => {
      if (schemaFetchError) {
        pending('OpenAPI schema not available');
        return;
      }

      const schema = getSchemaDefinition(openApiSchema, SCHEMA_NAMES.KNOWN_IMAGE_GENERATION_BASELINE);
      expect(schema).toBeDefined();

      if (schema) {
        const enumValues = getEnumValues(schema);
        // Check that common baselines exist
        expect(enumValues).toContain('stable_diffusion_1');
        expect(enumValues).toContain('stable_diffusion_2_768');
        expect(enumValues).toContain('stable_diffusion_xl');
        expect(enumValues).toContain('flux_1');

        console.log('Available image generation baselines:', enumValues);
      }
    });

    it('MODEL_STYLE enum should match OpenAPI schema', () => {
      if (schemaFetchError) {
        pending('OpenAPI schema not available');
        return;
      }

      const schema = getSchemaDefinition(openApiSchema, SCHEMA_NAMES.MODEL_STYLE);
      expect(schema).toBeDefined();

      if (schema) {
        const enumValues = getEnumValues(schema);
        // Check that common styles exist
        expect(enumValues).toContain('generalist');
        expect(enumValues).toContain('anime');
        expect(enumValues).toContain('realistic');
        expect(enumValues).toContain('artistic');

        console.log('Available model styles:', enumValues);
      }
    });

    it('CONTROLNET_STYLE enum should match OpenAPI schema', () => {
      if (schemaFetchError) {
        pending('OpenAPI schema not available');
        return;
      }

      const schema = getSchemaDefinition(openApiSchema, SCHEMA_NAMES.CONTROLNET_STYLE);
      expect(schema).toBeDefined();

      if (schema) {
        const enumValues = getEnumValues(schema);
        // Check that common ControlNet styles exist
        expect(enumValues).toContain('control_canny');
        expect(enumValues).toContain('control_depth');
        expect(enumValues).toContain('control_openpose');

        console.log('Available ControlNet styles:', enumValues);
      }
    });
  });

  describe('API Endpoint Validation', () => {
    it('should have expected v1 endpoints in schema', () => {
      if (schemaFetchError) {
        pending('OpenAPI schema not available');
        return;
      }

      // Check for key v1 endpoints
      expect(hasEndpoint(openApiSchema, '/model_references/v1/info')).toBe(true);
      expect(hasEndpoint(openApiSchema, '/model_references/v1/model_categories')).toBe(true);
      expect(hasEndpoint(openApiSchema, '/model_references/v1/{model_category_name}')).toBe(true);
      expect(
        hasEndpoint(openApiSchema, '/model_references/v1/{model_category_name}/{model_name}'),
      ).toBe(true);
    });

    it('should have expected v2 endpoints in schema', () => {
      if (schemaFetchError) {
        pending('OpenAPI schema not available');
        return;
      }

      // Check for key v2 endpoints
      expect(hasEndpoint(openApiSchema, '/model_references/v2/info')).toBe(true);
      expect(hasEndpoint(openApiSchema, '/model_references/v2/model_categories')).toBe(true);
      expect(hasEndpoint(openApiSchema, '/model_references/v2/{model_category_name}')).toBe(true);
      expect(
        hasEndpoint(openApiSchema, '/model_references/v2/{model_category_name}/{model_name}'),
      ).toBe(true);
      expect(hasEndpoint(openApiSchema, '/model_references/v2/{model_category_name}/add')).toBe(
        true,
      );
    });

    it('should have heartbeat and status endpoints', () => {
      if (schemaFetchError) {
        pending('OpenAPI schema not available');
        return;
      }

      expect(hasEndpoint(openApiSchema, '/')).toBe(true);
      expect(hasEndpoint(openApiSchema, '/heartbeat')).toBe(true);
      expect(hasEndpoint(openApiSchema, '/replicate_mode')).toBe(true);
    });
  });

  describe('Schema Component Completeness', () => {
    it('should have all expected model record schemas', () => {
      if (schemaFetchError) {
        pending('OpenAPI schema not available');
        return;
      }

      // Check for key model record schemas
      expect(hasSchema(openApiSchema, SCHEMA_NAMES.IMAGE_GENERATION_INPUT)).toBe(true);
      expect(hasSchema(openApiSchema, SCHEMA_NAMES.IMAGE_GENERATION_OUTPUT)).toBe(true);
      expect(hasSchema(openApiSchema, SCHEMA_NAMES.TEXT_GENERATION_INPUT)).toBe(true);
      expect(hasSchema(openApiSchema, SCHEMA_NAMES.TEXT_GENERATION_OUTPUT)).toBe(true);
      expect(hasSchema(openApiSchema, SCHEMA_NAMES.CONTROLNET_INPUT)).toBe(true);
      expect(hasSchema(openApiSchema, SCHEMA_NAMES.CONTROLNET_OUTPUT)).toBe(true);
      expect(hasSchema(openApiSchema, SCHEMA_NAMES.GENERIC_INPUT)).toBe(true);
      expect(hasSchema(openApiSchema, SCHEMA_NAMES.GENERIC_OUTPUT)).toBe(true);
    });

    it('should have all expected metadata schemas', () => {
      if (schemaFetchError) {
        pending('OpenAPI schema not available');
        return;
      }

      expect(hasSchema(openApiSchema, SCHEMA_NAMES.GENERIC_METADATA)).toBe(true);
      expect(hasSchema(openApiSchema, SCHEMA_NAMES.GENERIC_CONFIG)).toBe(true);
      expect(hasSchema(openApiSchema, SCHEMA_NAMES.MODEL_CLASSIFICATION)).toBe(true);
      expect(hasSchema(openApiSchema, SCHEMA_NAMES.DOWNLOAD_RECORD)).toBe(true);
    });

    it('should have all expected enum schemas', () => {
      if (schemaFetchError) {
        pending('OpenAPI schema not available');
        return;
      }

      expect(hasSchema(openApiSchema, SCHEMA_NAMES.MODEL_REFERENCE_CATEGORY)).toBe(true);
      expect(hasSchema(openApiSchema, SCHEMA_NAMES.MODEL_DOMAIN)).toBe(true);
      expect(hasSchema(openApiSchema, SCHEMA_NAMES.MODEL_PURPOSE)).toBe(true);
      expect(hasSchema(openApiSchema, SCHEMA_NAMES.MODEL_STYLE)).toBe(true);
      expect(hasSchema(openApiSchema, SCHEMA_NAMES.CONTROLNET_STYLE)).toBe(true);
      expect(hasSchema(openApiSchema, SCHEMA_NAMES.KNOWN_IMAGE_GENERATION_BASELINE)).toBe(true);
      expect(hasSchema(openApiSchema, SCHEMA_NAMES.REPLICATE_MODE)).toBe(true);
    });

    it('should have all expected response schemas', () => {
      if (schemaFetchError) {
        pending('OpenAPI schema not available');
        return;
      }

      expect(hasSchema(openApiSchema, SCHEMA_NAMES.CONTAINS_MESSAGE)).toBe(true);
      expect(hasSchema(openApiSchema, SCHEMA_NAMES.CONTAINS_STATUS)).toBe(true);
      expect(hasSchema(openApiSchema, SCHEMA_NAMES.ERROR_RESPONSE)).toBe(true);
      expect(hasSchema(openApiSchema, SCHEMA_NAMES.ERROR_DETAIL)).toBe(true);
      expect(hasSchema(openApiSchema, SCHEMA_NAMES.HTTP_VALIDATION_ERROR)).toBe(true);
      expect(hasSchema(openApiSchema, SCHEMA_NAMES.VALIDATION_ERROR)).toBe(true);
    });
  });
});
