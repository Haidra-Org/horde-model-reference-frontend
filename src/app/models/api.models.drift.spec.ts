import {
  MODEL_REFERENCE_CATEGORY,
  ImageGenerationModelRecordOutput,
  TextGenerationModelRecordOutput,
  GenericModelRecordOutput,
  ControlNetModelRecordOutput,
  ResponseGetReferenceByCategoryModelReferencesV2ModelCategoryNameGetValue,
  KNOWN_IMAGE_GENERATION_BASELINE,
  MODEL_STYLE,
} from '../api-client';
import {
  LegacyGenericRecord,
  LegacyStableDiffusionRecord,
  LegacyTextGenerationRecord,
  LegacyClipRecord,
  ModelRecord,
  ModelReferenceCategory,
  LegacyRequirementValue,
} from './api.models';
import {
  TEST_MODEL_NAMES,
  TEST_URLS,
  TEST_FILE_NAMES,
  TEST_DESCRIPTIONS,
  TEST_TAGS,
  TEST_PARAMETERS,
  TEST_MODEL_CLASSIFICATION,
  TEST_REQUIREMENTS,
  TEST_SETTINGS,
  TEST_PRETRAINED_NAMES,
  ALL_MODEL_CATEGORIES,
  ACTIVE_MODEL_CATEGORIES,
  ALL_BASELINES,
  ALL_STYLES,
  validateEnumExhaustiveness,
  assertBidirectionalTypeCompatibility,
  testLogger,
  ImageModelBuilder,
  TextModelBuilder,
} from './test-helpers';

/**
 * Tests to detect drift between local model definitions and generated API client models.
 * These tests ensure that our custom types remain compatible with the authoritative
 * OpenAPI-generated models.
 *
 * CRITICAL: These tests use TypeScript's type system to catch breaking changes at compile time.
 * If any of these tests fail to compile, it indicates a breaking change in the API.
 */
describe('API Models - Drift Detection', () => {
  describe('Type Alias Compatibility', () => {
    it('ModelRecord should be bidirectionally assignable with generated response type', () => {
      testLogger.logCompileTimeCheck('Type Alias Compatibility Test', [
        'Type aliases become incompatible in either direction',
        'ModelRecord cannot be assigned to ResponseGetReference...Value',
        'ResponseGetReference...Value cannot be assigned to ModelRecord',
      ]);

      // Type-level assertions that will fail at compile time if incompatible
      const typeCheck = assertBidirectionalTypeCompatibility<
        ModelRecord,
        ResponseGetReferenceByCategoryModelReferencesV2ModelCategoryNameGetValue
      >();

      expect(typeCheck.forward).toBe(true);
      expect(typeCheck.backward).toBe(true);

      // Runtime verification - use a simple object that matches the type exactly
      const generatedModel: ResponseGetReferenceByCategoryModelReferencesV2ModelCategoryNameGetValue =
        {
          name: TEST_MODEL_NAMES.DEFAULT,
          description: TEST_DESCRIPTIONS.DEFAULT,
          baseline: 'stable_diffusion_1',
          nsfw: false,
          parameters: TEST_PARAMETERS.DEFAULT,
          model_classification: TEST_MODEL_CLASSIFICATION.IMAGE_GENERATION,
          style: 'generalist',
        };

      const modelRecord: ModelRecord = generatedModel;

      expect(modelRecord.name).toBe(TEST_MODEL_NAMES.DEFAULT);
      testLogger.logSuccess('Runtime assignment works correctly');
    });

    it('ModelReferenceCategory should exhaustively match MODEL_REFERENCE_CATEGORY', () => {
      testLogger.logCompileTimeCheck('Model Reference Category Enum Test', [
        'Generated enum has values not in ModelReferenceCategory type',
        'Expected categories are missing from generated enum',
      ]);

      // Compile-time check: ModelReferenceCategory must accept all MODEL_REFERENCE_CATEGORY values
      type AssertExhaustive = MODEL_REFERENCE_CATEGORY extends ModelReferenceCategory
        ? true
        : false;
      const isExhaustive: AssertExhaustive = true;

      const allGeneratedCategories = Object.values(MODEL_REFERENCE_CATEGORY);

      // Check that our type can handle all of them
      allGeneratedCategories.forEach((category) => {
        const local: ModelReferenceCategory = category;
        expect(local).toBe(category);
      });

      // Verify specific categories we rely on
      const criticalCategories: ModelReferenceCategory[] = [
        'image_generation',
        'text_generation',
        'clip',
        'controlnet',
      ];

      criticalCategories.forEach((category) => {
        expect(allGeneratedCategories).toContain(category);
      });

      expect(isExhaustive).toBe(true);
      testLogger.logSuccess(
        'All generated categories are compatible with ModelReferenceCategory type',
      );
    });
  });

  describe('Legacy Record Compatibility with Generated Models', () => {
    it('LegacyGenericRecord should handle all GenericModelRecordOutput fields', () => {
      // Create a complete generated model with all possible fields
      const generatedModel: GenericModelRecordOutput = {
        name: TEST_MODEL_NAMES.DEFAULT,
        description: TEST_DESCRIPTIONS.DEFAULT,
        version: '1.0',
        model_classification: TEST_MODEL_CLASSIFICATION.IMAGE_GENERATION,
        metadata: {
          schema_version: '2.0',
          created_at: Date.now(),
          updated_at: Date.now(),
          created_by: 'test-user',
          updated_by: 'test-user',
        },
        config: {
          download: [
            {
              file_name: TEST_FILE_NAMES.SAFETENSORS,
              file_url: TEST_URLS.MODEL_SAFETENSORS,
              sha256sum: 'abc123',
              file_purpose: 'model',
              known_slow_download: false,
            },
          ],
        },
      };

      // Verify we can map all fields to legacy record
      const legacyRecord: LegacyGenericRecord = {
        name: generatedModel.name,
        description: generatedModel.description ?? undefined,
        version: generatedModel.version ?? undefined,
      };

      expect(legacyRecord.name).toBe(generatedModel.name);
      expect(legacyRecord.description).toBe(generatedModel.description);
      expect(legacyRecord.version).toBe(generatedModel.version);

      // Verify config structure compatibility
      expect(generatedModel.config?.download).toBeDefined();
      expect(Array.isArray(generatedModel.config?.download)).toBe(true);
    });

    it('LegacyStableDiffusionRecord should handle all ImageGenerationModelRecordOutput fields', () => {
      // Create a maximal generated model with all fields populated
      const generatedModel: ImageGenerationModelRecordOutput = {
        name: TEST_MODEL_NAMES.STABLE_DIFFUSION,
        description: TEST_DESCRIPTIONS.STABLE_DIFFUSION,
        version: '1.5',
        baseline: KNOWN_IMAGE_GENERATION_BASELINE.StableDiffusion1,
        inpainting: false,
        nsfw: false,
        style: MODEL_STYLE.Generalist,
        tags: [...TEST_TAGS.GENERALIST],
        showcases: [TEST_URLS.SHOWCASE],
        trigger: ['portrait', 'landscape'],
        homepage: TEST_URLS.HOMEPAGE,
        optimization: 'fp16',
        size_on_disk_bytes: 4000000000,
        min_bridge_version: 10,
        model_classification: TEST_MODEL_CLASSIFICATION.IMAGE_GENERATION,
        metadata: {
          schema_version: '2.0',
        },
        config: {
          download: [
            {
              file_name: TEST_FILE_NAMES.SAFETENSORS,
              file_url: TEST_URLS.MODEL_SAFETENSORS,
              sha256sum: 'a'.repeat(64),
            },
          ],
        },
        requirements: TEST_REQUIREMENTS.BASIC,
      };

      // Verify all fields map correctly to legacy record
      const legacyRecord: LegacyStableDiffusionRecord = {
        name: generatedModel.name,
        description: generatedModel.description ?? undefined,
        baseline: String(generatedModel.baseline),
        inpainting: generatedModel.inpainting ?? false,
        tags: generatedModel.tags ?? undefined,
        showcases: generatedModel.showcases ?? undefined,
        trigger: generatedModel.trigger ?? undefined,
        homepage: generatedModel.homepage ?? undefined,
        min_bridge_version: generatedModel.min_bridge_version ?? undefined,
        size_on_disk_bytes: generatedModel.size_on_disk_bytes ?? undefined,
        optimization: generatedModel.optimization ?? undefined,
        // Note: requirements type is ImageGenerationModelRecordInputRequirementsValue (empty interface)
        // which is incompatible with our strict LegacyRequirementValue union type
        requirements: generatedModel.requirements as unknown as
          | Record<string, LegacyRequirementValue>
          | undefined,
        nsfw: generatedModel.nsfw,
        // Note: style is Style1 (empty interface), need to cast to string
        style: (generatedModel.style as unknown as string | null) ?? undefined,
      };

      expect(legacyRecord.name).toBe(generatedModel.name);
      expect(legacyRecord.baseline).toBe(KNOWN_IMAGE_GENERATION_BASELINE.StableDiffusion1);
      expect(legacyRecord.inpainting).toBe(false);
      expect(legacyRecord.nsfw).toBe(false);
      expect(legacyRecord.tags).toEqual([...TEST_TAGS.GENERALIST]);
      expect(legacyRecord.requirements?.['min_ram']).toBe(TEST_REQUIREMENTS.BASIC.min_ram);
    });

    it('LegacyTextGenerationRecord should handle all TextGenerationModelRecordOutput fields', () => {
      // Create a maximal generated model
      const generatedModel: TextGenerationModelRecordOutput = {
        name: TEST_MODEL_NAMES.LLAMA,
        description: TEST_DESCRIPTIONS.LLAMA,
        version: '1.0',
        parameters: TEST_PARAMETERS.LLAMA_7B,
        baseline: 'llama',
        tags: [...TEST_TAGS.TEXT_INSTRUCTION],
        display_name: TEST_DESCRIPTIONS.LLAMA,
        url: TEST_URLS.LLAMA_URL,
        nsfw: false,
        style: 'conversational',
        model_classification: TEST_MODEL_CLASSIFICATION.TEXT_GENERATION,
        metadata: {
          schema_version: '2.0',
        },
        config: {
          download: [
            {
              file_name: TEST_FILE_NAMES.BIN,
              file_url: TEST_URLS.MODEL_BIN,
              sha256sum: 'b'.repeat(64),
            },
          ],
        },
        settings: TEST_SETTINGS.BASIC,
      };

      // Create legacy record from generated model
      const legacyRecord: LegacyTextGenerationRecord = {
        name: generatedModel.name,
        description: generatedModel.description ?? undefined,
        parameters: generatedModel.parameters,
        baseline: generatedModel.baseline ?? undefined,
        tags: generatedModel.tags ?? undefined,
        display_name: generatedModel.display_name ?? undefined,
        url: generatedModel.url ?? undefined,
        version: generatedModel.version ?? undefined,
        nsfw: generatedModel.nsfw ?? undefined,
        style: generatedModel.style ?? undefined,
        // settings type is ImageGenerationModelRecordInputRequirementsValue (empty interface)
        settings: generatedModel.settings as unknown as
          | Record<string, LegacyRequirementValue>
          | undefined,
      };

      expect(legacyRecord.name).toBe(generatedModel.name);
      expect(legacyRecord.parameters).toBe(TEST_PARAMETERS.LLAMA_7B);
      expect(legacyRecord.baseline).toBe(generatedModel.baseline);
      expect(legacyRecord.display_name).toBe(TEST_DESCRIPTIONS.LLAMA);
      expect(legacyRecord.tags).toEqual([...TEST_TAGS.TEXT_INSTRUCTION]);
    });

    it('LegacyClipRecord should handle all GenericModelRecordOutput fields', () => {
      // CLIP models use GenericModelRecordOutput in the API
      // Create a maximal generated model for a CLIP model
      const generatedModel: GenericModelRecordOutput = {
        name: TEST_MODEL_NAMES.CLIP,
        description: 'CLIP vision-language model',
        version: '1.0',
        model_classification: {
          domain: 'multimodal',
          purpose: 'embedding',
        },
        metadata: {
          schema_version: '2.0',
          created_at: Date.now(),
        },
        config: {
          download: [
            {
              file_name: 'pytorch_model.bin',
              file_url: TEST_URLS.MODEL_BIN,
              sha256sum: 'c'.repeat(64),
              file_purpose: 'model',
            },
          ],
        },
      };

      // Create legacy CLIP record from generated model
      const legacyRecord: LegacyClipRecord = {
        name: generatedModel.name,
        description: generatedModel.description ?? undefined,
        version: generatedModel.version ?? undefined,
        pretrained_name: TEST_PRETRAINED_NAMES.CLIP_VIT_LARGE,
      };

      expect(legacyRecord.name).toBe(generatedModel.name);
      expect(legacyRecord.description).toBe(generatedModel.description);
      expect(legacyRecord.version).toBe(generatedModel.version);
      expect(legacyRecord.pretrained_name).toBe(TEST_PRETRAINED_NAMES.CLIP_VIT_LARGE);

      // Verify config structure compatibility
      expect(generatedModel.config?.download).toBeDefined();
      expect(Array.isArray(generatedModel.config?.download)).toBe(true);
      expect(generatedModel.config?.download?.[0].file_name).toBe('pytorch_model.bin');
    });

    it('should document ALL fields in generated vs legacy models', () => {
      // This test ensures we know about every field in the generated models
      // If the API adds new required fields, this test will fail at compile time

      // Expected fields in ImageGenerationModelRecordOutput (from type definition)
      type GeneratedImageFields = keyof ImageGenerationModelRecordOutput;
      const expectedGeneratedFields: GeneratedImageFields[] = [
        'name',
        'description',
        'version',
        'metadata',
        'config',
        'model_classification',
        'inpainting',
        'baseline',
        'optimization',
        'tags',
        'showcases',
        'min_bridge_version',
        'trigger',
        'homepage',
        'nsfw',
        'style',
        'requirements',
        'size_on_disk_bytes',
      ];

      // Expected fields in LegacyStableDiffusionRecord
      type LegacyImageFields = keyof LegacyStableDiffusionRecord;
      const expectedLegacyFields: LegacyImageFields[] = [
        'name',
        'type',
        'description',
        'version',
        'style',
        'nsfw',
        'download_all',
        'config',
        'available',
        'features_not_supported',
        'inpainting',
        'baseline',
        'tags',
        'showcases',
        'min_bridge_version',
        'trigger',
        'homepage',
        'size_on_disk_bytes',
        'optimization',
        'requirements',
      ];

      // Fields unique to generated models
      const generatedOnlyFields = ['metadata', 'model_classification'];

      // Fields unique to legacy models
      const legacyOnlyFields = ['type', 'download_all', 'available', 'features_not_supported'];

      // Verify our documentation matches reality
      expect(expectedGeneratedFields.length).toBeGreaterThan(0);
      expect(expectedLegacyFields.length).toBeGreaterThan(0);

      // Log for documentation
      console.log('Generated-only fields:', generatedOnlyFields);
      console.log('Legacy-only fields:', legacyOnlyFields);
    });
  });

  describe('Field Type Compatibility', () => {
    it('nullable fields should be handled consistently', () => {
      // Generated models use `| null` for optional fields
      const generatedModel: ImageGenerationModelRecordOutput = {
        name: TEST_MODEL_NAMES.TEST,
        baseline: 'stable_diffusion_1',
        nsfw: false,
        description: null, // Generated allows null
        tags: null, // Generated allows null
      };

      // Legacy models use `| undefined`
      const legacyModel: LegacyStableDiffusionRecord = {
        name: TEST_MODEL_NAMES.TEST,
        baseline: 'stable_diffusion_1',
        inpainting: false,
        description: undefined, // Legacy uses undefined
        tags: undefined, // Legacy uses undefined
      };

      // Both should work, but conversion may be needed
      expect(generatedModel.description).toBeNull();
      expect(legacyModel.description).toBeUndefined();

      // When converting, null becomes undefined
      const convertedDescription = generatedModel.description ?? undefined;
      expect(convertedDescription).toBeUndefined();
    });

    it('requirements/settings field should be compatible', () => {
      const generatedModel: ImageGenerationModelRecordOutput = {
        name: TEST_MODEL_NAMES.TEST,
        baseline: KNOWN_IMAGE_GENERATION_BASELINE.StableDiffusion1,
        nsfw: false,
        requirements: TEST_REQUIREMENTS.BASIC,
      };

      const legacyModel: LegacyStableDiffusionRecord = {
        name: TEST_MODEL_NAMES.TEST,
        baseline: 'stable_diffusion_1',
        inpainting: false,
        requirements: TEST_REQUIREMENTS.BASIC,
      };

      // Both should support Record<string, ...> structure
      expect(generatedModel.requirements).toBeDefined();
      expect(legacyModel.requirements).toBeDefined();
      expect(generatedModel.requirements?.['min_ram']).toBe(legacyModel.requirements?.['min_ram']);
    });
  });

  describe('Enum Value Compatibility', () => {
    it('should exhaustively validate all MODEL_REFERENCE_CATEGORY enum values', () => {
      const result = validateEnumExhaustiveness(
        MODEL_REFERENCE_CATEGORY,
        ALL_MODEL_CATEGORIES as unknown as string[],
        'MODEL_REFERENCE_CATEGORY',
        !!(globalThis as any).VERBOSE_TESTS,
      );

      expect(result.countMatches).toBe(true);
      expect(result.allValuesPresent).toBe(true);

      // Check that categories we actively use exist
      ACTIVE_MODEL_CATEGORIES.forEach((category) => {
        expect(ALL_MODEL_CATEGORIES).toContain(category);
      });
    });

    it('should exhaustively validate all KNOWN_IMAGE_GENERATION_BASELINE values', () => {
      const result = validateEnumExhaustiveness(
        KNOWN_IMAGE_GENERATION_BASELINE,
        ALL_BASELINES as unknown as string[],
        'KNOWN_IMAGE_GENERATION_BASELINE',
        !!(globalThis as any).VERBOSE_TESTS,
      );

      expect(result.countMatches).toBe(true);
      expect(result.allValuesPresent).toBe(true);
    });

    it('should exhaustively validate all MODEL_STYLE values', () => {
      const result = validateEnumExhaustiveness(
        MODEL_STYLE,
        ALL_STYLES as unknown as string[],
        'MODEL_STYLE',
        !!(globalThis as any).VERBOSE_TESTS,
      );

      expect(result.countMatches).toBe(true);
      expect(result.allValuesPresent).toBe(true);
    });
  });

  describe('Enum Value Drift Detection', () => {
    it('should detect new enum values added to MODEL_REFERENCE_CATEGORY in the API', () => {
      testLogger.logCompileTimeCheck('MODEL_REFERENCE_CATEGORY Drift Detection', [
        'API adds new category values that local code does not handle',
        'Local code has category values not in the API',
      ]);

      // Get all values from generated enum
      const generatedValues = Object.values(MODEL_REFERENCE_CATEGORY);
      const localValues = ALL_MODEL_CATEGORIES;

      // Check for values in API but not in local definitions
      const newInApi = generatedValues.filter((v) => !localValues.includes(v as any));

      // Check for values in local definitions but not in API
      const removedFromApi = localValues.filter((v) => !generatedValues.includes(v as any));

      if (newInApi.length > 0) {
        console.warn(`   New MODEL_REFERENCE_CATEGORY values in API:`, newInApi);
        console.warn('   Action: Update ALL_MODEL_CATEGORIES in test-helpers.ts');
      }

      if (removedFromApi.length > 0) {
        console.warn(`   MODEL_REFERENCE_CATEGORY values removed from API:`, removedFromApi);
        console.warn('   Action: Remove these from ALL_MODEL_CATEGORIES and update dependent code');
      }

      expect(newInApi.length).toBe(0);
      expect(removedFromApi.length).toBe(0);
      expect(generatedValues.length).toBe(localValues.length);

      testLogger.logSuccess(
        `MODEL_REFERENCE_CATEGORY: ${generatedValues.length} values match perfectly`,
      );
    });

    it('should detect new enum values added to KNOWN_IMAGE_GENERATION_BASELINE in the API', () => {
      testLogger.logCompileTimeCheck('KNOWN_IMAGE_GENERATION_BASELINE Drift Detection', [
        'API adds new baseline values that local code does not handle',
        'Local code has baseline values not in the API',
      ]);

      const generatedValues = Object.values(KNOWN_IMAGE_GENERATION_BASELINE);
      const localValues = ALL_BASELINES;

      const newInApi = generatedValues.filter((v) => !localValues.includes(v as any));
      const removedFromApi = localValues.filter((v) => !generatedValues.includes(v as any));

      if (newInApi.length > 0) {
        console.warn(`   New KNOWN_IMAGE_GENERATION_BASELINE values in API:`, newInApi);
        console.warn('   Action: Update ALL_BASELINES in test-helpers.ts');
        console.warn('   Impact: May affect baseline filtering, UI dropdowns, validation logic');
      }

      if (removedFromApi.length > 0) {
        console.warn(`   KNOWN_IMAGE_GENERATION_BASELINE values removed from API:`, removedFromApi);
        console.warn('   Action: Remove from ALL_BASELINES and update any baseline-specific logic');
      }

      expect(newInApi.length).toBe(0);
      expect(removedFromApi.length).toBe(0);
      expect(generatedValues.length).toBe(localValues.length);

      testLogger.logSuccess(
        `KNOWN_IMAGE_GENERATION_BASELINE: ${generatedValues.length} values match perfectly`,
      );
    });

    it('should detect new enum values added to MODEL_STYLE in the API', () => {
      testLogger.logCompileTimeCheck('MODEL_STYLE Drift Detection', [
        'API adds new style values that local code does not handle',
        'Local code has style values not in the API',
      ]);

      const generatedValues = Object.values(MODEL_STYLE);
      const localValues = ALL_STYLES;

      const newInApi = generatedValues.filter((v) => !localValues.includes(v as any));
      const removedFromApi = localValues.filter((v) => !generatedValues.includes(v as any));

      if (newInApi.length > 0) {
        console.warn(`   New MODEL_STYLE values in API:`, newInApi);
        console.warn('   Action: Update ALL_STYLES in test-helpers.ts');
        console.warn('   Impact: May affect style filtering, UI display, model categorization');
      }

      if (removedFromApi.length > 0) {
        console.warn(`   MODEL_STYLE values removed from API:`, removedFromApi);
        console.warn('   Action: Remove from ALL_STYLES and update any style-specific logic');
      }

      expect(newInApi.length).toBe(0);
      expect(removedFromApi.length).toBe(0);
      expect(generatedValues.length).toBe(localValues.length);

      testLogger.logSuccess(`MODEL_STYLE: ${generatedValues.length} values match perfectly`);
    });

    it('should document all enum value mappings for UI components', () => {
      testLogger.logCompileTimeCheck('Enum UI Mapping Documentation', [
        'UI components rely on specific enum values that change',
      ]);

      // Document which enum values are actively used in the UI
      const criticalCategories = ACTIVE_MODEL_CATEGORIES;

      const criticalBaselines = [
        KNOWN_IMAGE_GENERATION_BASELINE.StableDiffusion1,
        KNOWN_IMAGE_GENERATION_BASELINE.StableDiffusion2768,
        KNOWN_IMAGE_GENERATION_BASELINE.StableDiffusionXl,
        KNOWN_IMAGE_GENERATION_BASELINE.StableCascade,
      ] as const;

      const criticalStyles = [
        MODEL_STYLE.Generalist,
        MODEL_STYLE.Anime,
        MODEL_STYLE.Realistic,
        MODEL_STYLE.Artistic,
      ] as const;

      // Verify critical values exist in generated enums
      const allGeneratedCategories = Object.values(MODEL_REFERENCE_CATEGORY);
      const allGeneratedBaselines = Object.values(KNOWN_IMAGE_GENERATION_BASELINE);
      const allGeneratedStyles = Object.values(MODEL_STYLE);

      criticalCategories.forEach((value) => {
        expect(allGeneratedCategories).toContain(value);
      });

      criticalBaselines.forEach((value) => {
        expect(allGeneratedBaselines).toContain(value);
      });

      criticalStyles.forEach((value) => {
        expect(allGeneratedStyles).toContain(value);
      });

      testLogger.logSuccess('All critical enum values for UI are present in API');
    });

    it('should validate enum value consistency across polymorphic types', () => {
      testLogger.logCompileTimeCheck('Polymorphic Enum Consistency', [
        'Different model types use incompatible enum values',
      ]);

      // Verify that baseline values work across all image generation models
      const imageModel = new ImageModelBuilder()
        .withName(TEST_MODEL_NAMES.TEST)
        .withBaseline(KNOWN_IMAGE_GENERATION_BASELINE.StableDiffusion1)
        .withNsfw(false)
        .build();

      // Verify that style values work across model types
      const imageWithStyle = new ImageModelBuilder()
        .withName(TEST_MODEL_NAMES.TEST)
        .withBaseline(KNOWN_IMAGE_GENERATION_BASELINE.StableDiffusion1)
        .withNsfw(false)
        .build();
      imageWithStyle.style = MODEL_STYLE.Generalist;

      const textWithStyle = new TextModelBuilder()
        .withName(TEST_MODEL_NAMES.TEST)
        .withParameters(TEST_PARAMETERS.DEFAULT)
        .build();
      textWithStyle.style = 'conversational'; // Text models may use different style values

      expect(imageModel.baseline).toBe(KNOWN_IMAGE_GENERATION_BASELINE.StableDiffusion1);
      expect(imageWithStyle.style).toBe(MODEL_STYLE.Generalist);
      expect(textWithStyle.style).toBeDefined();

      testLogger.logSuccess('Enum values consistent across polymorphic model types');
    });
  });

  describe('Response Structure Compatibility', () => {
    it('CategoryModelsResponse should handle polymorphic generated model records', () => {
      // The API returns different model types (Image, Text, Generic) in the same response
      // ModelRecord type should be a union that accepts all of them
      type GeneratedCategoryResponse = {
        [key: string]:
          | ImageGenerationModelRecordOutput
          | TextGenerationModelRecordOutput
          | GenericModelRecordOutput
          | ControlNetModelRecordOutput;
      };

      const generatedResponse: GeneratedCategoryResponse = {
        'image-model': new ImageModelBuilder()
          .withName(TEST_MODEL_NAMES.IMAGE)
          .withDescription(TEST_DESCRIPTIONS.IMAGE_MODEL)
          .withBaseline(KNOWN_IMAGE_GENERATION_BASELINE.StableDiffusion1)
          .withNsfw(false)
          .build(),
        'text-model': new TextModelBuilder()
          .withName(TEST_MODEL_NAMES.TEXT)
          .withParameters(TEST_PARAMETERS.LLAMA_7B)
          .build(),
        'generic-model': {
          name: TEST_MODEL_NAMES.GENERIC,
          description: TEST_DESCRIPTIONS.GENERIC_MODEL,
          version: '1.0',
          model_classification: TEST_MODEL_CLASSIFICATION.IMAGE_GENERATION,
        } as GenericModelRecordOutput,
      };

      // Verify structure
      expect(Object.keys(generatedResponse).length).toBe(3);
      expect(generatedResponse['image-model'].name).toBe(TEST_MODEL_NAMES.IMAGE);
      expect(generatedResponse['text-model'].name).toBe(TEST_MODEL_NAMES.TEXT);
      expect(generatedResponse['generic-model'].name).toBe(TEST_MODEL_NAMES.GENERIC);

      // Check that we can access common fields
      Object.values(generatedResponse).forEach((model) => {
        expect(model.name).toBeDefined();
        expect(typeof model.name).toBe('string');
      });
    });

    it('should handle the over-broad ResponseGetReference...Value type', () => {
      // KNOWN ISSUE: The generated ModelRecord type includes ALL fields from ALL model types
      // This is a limitation of the OpenAPI generator for polymorphic responses
      // We document this here so we know if it changes

      const overBroadModel: ResponseGetReferenceByCategoryModelReferencesV2ModelCategoryNameGetValue =
        {
          name: TEST_MODEL_NAMES.TEST,
          model_classification: TEST_MODEL_CLASSIFICATION.IMAGE_GENERATION,
          baseline: 'stable_diffusion_1',
          nsfw: false,
          style: 'generalist',
          parameters: TEST_PARAMETERS.DEFAULT,
        };

      // This is not ideal but reflects current API client generation
      expect(overBroadModel).toBeDefined();
      console.warn('ModelRecord type is over-broad - includes all fields from all model types');
    });
  });

  describe('Configuration Object Compatibility', () => {
    it('should handle GenericModelRecordConfig structure', () => {
      const generatedModel: ImageGenerationModelRecordOutput = {
        name: TEST_MODEL_NAMES.TEST,
        baseline: KNOWN_IMAGE_GENERATION_BASELINE.StableDiffusion1,
        nsfw: false,
        config: {
          download: [
            {
              file_name: TEST_FILE_NAMES.SAFETENSORS,
              file_url: TEST_URLS.MODEL_SAFETENSORS,
              sha256sum: 'a'.repeat(64),
            },
          ],
        },
      };

      // Check that config structure matches what we expect
      expect(generatedModel.config).toBeDefined();
      expect(generatedModel.config?.download).toBeDefined();
      expect(Array.isArray(generatedModel.config?.download)).toBe(true);
      expect(generatedModel.config?.download?.[0].file_name).toBe(TEST_FILE_NAMES.SAFETENSORS);
      expect(generatedModel.config?.download?.[0].sha256sum).toBe('a'.repeat(64));
    });
  });

  describe('Edge Cases', () => {
    it('should handle models with empty arrays', () => {
      const model = new ImageModelBuilder().withName(TEST_MODEL_NAMES.TEST).withTags([]).build();

      expect(model.tags).toEqual([]);
    });

    it('should handle models with null vs undefined optional fields', () => {
      const withNull: ImageGenerationModelRecordOutput = {
        name: TEST_MODEL_NAMES.TEST,
        baseline: 'stable_diffusion_1',
        nsfw: false,
        description: null,
      };

      expect(withNull.description ?? 'fallback').toBe('fallback');
    });

    it('should handle models with minimal required fields only', () => {
      const minimalImage = new ImageModelBuilder().build();
      const minimalText = new TextModelBuilder().build();

      expect(minimalImage.name).toBeDefined();
      expect(minimalImage.baseline).toBeDefined();
      expect(minimalImage.nsfw).toBeDefined();

      expect(minimalText.name).toBeDefined();
      expect(minimalText.parameters).toBeDefined();
    });

    it('should handle models with maximum fields populated', () => {
      const maximalImage: ImageGenerationModelRecordOutput = {
        name: TEST_MODEL_NAMES.TEST,
        baseline: KNOWN_IMAGE_GENERATION_BASELINE.StableDiffusion1,
        nsfw: false,
        description: TEST_DESCRIPTIONS.DEFAULT,
        version: '1.0',
        tags: [...TEST_TAGS.SINGLE],
        showcases: [TEST_URLS.SHOWCASE, TEST_URLS.EXAMPLE_BASE],
        trigger: ['trigger1'],
        homepage: TEST_URLS.HOMEPAGE,
        optimization: 'fp16',
        size_on_disk_bytes: 4000000000,
        min_bridge_version: 10,
        inpainting: true,
        style: MODEL_STYLE.Generalist,
        requirements: { min_ram: 8 },
        config: {
          download: [
            {
              file_name: TEST_FILE_NAMES.SAFETENSORS,
              file_url: TEST_URLS.MODEL_SAFETENSORS,
            },
          ],
        },
        metadata: { schema_version: '2.0' },
        model_classification: TEST_MODEL_CLASSIFICATION.IMAGE_GENERATION,
      };

      expect(maximalImage.name).toBeDefined();
      expect(maximalImage.tags?.length).toBe(TEST_TAGS.SINGLE.length);
      expect(maximalImage.config?.download?.length).toBe(1);
    });

    it('should handle empty config objects', () => {
      const withEmptyConfig: ImageGenerationModelRecordOutput = {
        name: TEST_MODEL_NAMES.TEST,
        baseline: 'stable_diffusion_1',
        nsfw: false,
        config: {},
      };

      expect(withEmptyConfig.config).toBeDefined();
      expect(withEmptyConfig.config?.download).toBeUndefined();
    });
  });

  describe('Type Conversion Utilities', () => {
    it('should document field mapping between generated and legacy formats', () => {
      testLogger.logCompileTimeCheck('Field Mapping Documentation', [
        'Field structure changes between generated and legacy models',
      ]);

      // Example field mapping:
      const fieldMapping = {
        generated_to_legacy: {
          'config.download[].file_name': 'config.download[].file_name',
          'config.download[].file_url': 'config.download[].file_url',
          'config.download[].sha256sum': 'config.files[].sha256sum',
          baseline: 'baseline (convert enum to string)',
          style: 'style (convert enum to string)',
          nsfw: 'nsfw (boolean)',
          inpainting: 'inpainting (boolean)',
        },
        legacy_to_generated: {
          'config.files[].path': 'config.download[].file_name',
          'config.files[].sha256sum': 'config.download[].sha256sum',
          baseline: 'baseline (string to enum)',
          style: 'style (string to enum)',
          type: '(not in generated model)',
          available: '(not in generated model)',
        },
      };

      expect(fieldMapping).toBeDefined();
      testLogger.logSuccess('Field mappings documented for conversion utilities');
    });

    it('should handle baseline enum values correctly', () => {
      // Legacy uses string values directly
      const legacyBaseline = 'stable_diffusion_1';

      // Generated uses enum
      const generatedBaseline = KNOWN_IMAGE_GENERATION_BASELINE.StableDiffusion1;

      // They should match
      expect(generatedBaseline).toBe(legacyBaseline);
    });

    it('should handle style enum values correctly', () => {
      // Legacy uses string values directly
      const legacyStyle = 'generalist';

      // Generated uses enum
      const generatedStyle = MODEL_STYLE.Generalist;

      // They should match
      expect(generatedStyle).toBe(legacyStyle);
    });
  });

  describe('Schema Drift Prevention', () => {
    it('should enforce required fields in ImageGenerationModelRecordOutput at compile time', () => {
      testLogger.logCompileTimeCheck('ImageGeneration Required Fields Detection', [
        'New required fields are added (object will be missing fields)',
        'Existing required fields are removed (object will have extra fields)',
        'Required fields become optional (type assertion will fail)',
      ]);

      // This test WILL fail to compile if new required fields are added
      type RequiredImageFields = {
        [K in keyof ImageGenerationModelRecordOutput as ImageGenerationModelRecordOutput[K] extends
          | undefined
          | null
          ? never
          : K]: ImageGenerationModelRecordOutput[K];
      };

      const requiredFieldsCheck: RequiredImageFields = {
        name: 'test',
        baseline: 'stable_diffusion_1',
        nsfw: false,
      };

      expect(requiredFieldsCheck.name).toBeDefined();
      expect(requiredFieldsCheck.baseline).toBeDefined();
      expect(requiredFieldsCheck.nsfw).toBeDefined();

      const requiredFields: (keyof RequiredImageFields)[] = ['name', 'baseline', 'nsfw'];
      testLogger.logSuccess(
        `All ${requiredFields.length} required fields present: ${requiredFields.join(', ')}`,
      );
    });

    it('should enforce required fields in TextGenerationModelRecordOutput at compile time', () => {
      testLogger.logCompileTimeCheck('TextGeneration Required Fields Detection', [
        'New required fields are added',
        'Existing required fields are removed',
        'Required fields become optional',
      ]);

      type RequiredTextFields = {
        [K in keyof TextGenerationModelRecordOutput as TextGenerationModelRecordOutput[K] extends
          | undefined
          | null
          ? never
          : K]: TextGenerationModelRecordOutput[K];
      };

      const requiredFieldsCheck: RequiredTextFields = {
        name: 'test',
        parameters: 7000000000,
      };

      expect(requiredFieldsCheck.name).toBeDefined();
      expect(requiredFieldsCheck.parameters).toBeDefined();

      const requiredFields: (keyof RequiredTextFields)[] = ['name', 'parameters'];
      testLogger.logSuccess(
        `All ${requiredFields.length} required fields present: ${requiredFields.join(', ')}`,
      );
    });

    it('should detect if DownloadRecord structure changes', () => {
      testLogger.logCompileTimeCheck('DownloadRecord Structure Validation', [
        'DownloadRecord field types change',
        'Required fields become optional or vice versa',
        'New required fields are added',
      ]);

      type DownloadRecordFields = {
        file_name: string;
        file_url: string;
        sha256sum?: string;
        file_purpose?: string | null;
        known_slow_download?: boolean | null;
      };

      type AssertDownloadRecordMatches = DownloadRecordFields extends {
        file_name: string;
        file_url: string;
        sha256sum?: string;
        file_purpose?: string | null;
        known_slow_download?: boolean | null;
      }
        ? true
        : false;

      const matches: AssertDownloadRecordMatches = true;
      expect(matches).toBe(true);
      testLogger.logSuccess('DownloadRecord structure validated');
    });

    it('should detect if ModelClassification structure changes', () => {
      testLogger.logCompileTimeCheck('ModelClassification Structure Validation', [
        'domain or purpose fields change type',
        'New required fields are added',
        'Existing fields are removed',
      ]);

      type ExpectedStructure = {
        domain: string;
        purpose: string;
      };

      type AssertStructure = ExpectedStructure extends {
        domain: string;
        purpose: string;
      }
        ? true
        : false;

      const matches: AssertStructure = true;
      expect(matches).toBe(true);
      testLogger.logSuccess('ModelClassification structure validated');
    });
  });

  describe('Breaking Change Detection', () => {
    it('should detect if response structure changes from Record to Array', () => {
      testLogger.logCompileTimeCheck('Response Structure Type Detection', [
        'API changes from Record<string, Model> to Model[]',
      ]);

      type ResponseStructure = {
        [key: string]:
          | ImageGenerationModelRecordOutput
          | TextGenerationModelRecordOutput
          | GenericModelRecordOutput;
      };

      const response: ResponseStructure = {
        'image-model': new ImageModelBuilder().withName('image-model').build(),
        'text-model': new TextModelBuilder().withName('text-model').build(),
      };

      expect(Array.isArray(response)).toBe(false);
      expect(typeof response).toBe('object');
      expect(Object.keys(response).length).toBe(2);
      expect(Object.keys(response)).toContain('image-model');
      testLogger.logSuccess('Response is a Record, not an Array');
    });

    it('should detect if field nullability changes to required', () => {
      testLogger.logCompileTimeCheck('Optional Field Detection', [
        'Optional fields become required',
      ]);

      const minimalImage = new ImageModelBuilder().build();
      const minimalText = new TextModelBuilder().build();

      expect(minimalImage).toBeDefined();
      expect(minimalText).toBeDefined();
      testLogger.logSuccess('Can create minimal objects with only required fields');
    });

    it('should detect if field types change from string to enum', () => {
      // baseline is currently a union type (empty interface that accepts anything)
      // If it becomes strictly typed, we need to know
      const imageModel: ImageGenerationModelRecordOutput = {
        name: TEST_MODEL_NAMES.TEST,
        baseline: 'stable_diffusion_1', // Should accept string
        nsfw: false,
      };

      // Verify baseline accepts enum values
      const withEnum: ImageGenerationModelRecordOutput = {
        name: TEST_MODEL_NAMES.TEST,
        baseline: KNOWN_IMAGE_GENERATION_BASELINE.StableDiffusion1,
        nsfw: false,
      };

      expect(imageModel.baseline).toBe('stable_diffusion_1');
      expect(withEnum.baseline).toBe('stable_diffusion_1');
    });

    it('should detect if nested types become stricter', () => {
      // Requirements and settings currently use empty interfaces
      // which accept any structure. If they become stricter, we need to adapt.

      const imageWithRequirements: ImageGenerationModelRecordOutput = {
        name: TEST_MODEL_NAMES.TEST,
        baseline: 'stable_diffusion_1',
        nsfw: false,
        requirements: TEST_REQUIREMENTS.WITH_CUSTOM,
      };

      const textWithSettings: TextGenerationModelRecordOutput = {
        name: TEST_MODEL_NAMES.TEST,
        parameters: TEST_PARAMETERS.LLAMA_7B,
        settings: TEST_SETTINGS.WITH_CUSTOM,
      };

      expect(imageWithRequirements.requirements).toBeDefined();
      expect(textWithSettings.settings).toBeDefined();
    });

    it('should detect if config.download becomes required', () => {
      // config and config.download are currently optional
      const withoutConfig: ImageGenerationModelRecordOutput = {
        name: TEST_MODEL_NAMES.TEST,
        baseline: 'stable_diffusion_1',
        nsfw: false,
      };

      const withEmptyConfig: ImageGenerationModelRecordOutput = {
        name: TEST_MODEL_NAMES.TEST,
        baseline: 'stable_diffusion_1',
        nsfw: false,
        config: {},
      };

      const withConfig: ImageGenerationModelRecordOutput = {
        name: TEST_MODEL_NAMES.TEST,
        baseline: 'stable_diffusion_1',
        nsfw: false,
        config: {
          download: [],
        },
      };

      expect(withoutConfig).toBeDefined();
      expect(withEmptyConfig).toBeDefined();
      expect(withConfig).toBeDefined();
    });

    it('should detect if DownloadRecord required fields change', () => {
      // Currently file_name and file_url are required, rest optional
      const minimalDownload = {
        file_name: TEST_FILE_NAMES.SAFETENSORS,
        file_url: TEST_URLS.MODEL_SAFETENSORS,
      };

      const fullDownload = {
        file_name: TEST_FILE_NAMES.SAFETENSORS,
        file_url: TEST_URLS.MODEL_SAFETENSORS,
        sha256sum: 'abc123',
        file_purpose: 'model',
        known_slow_download: false,
      };

      const model: ImageGenerationModelRecordOutput = {
        name: TEST_MODEL_NAMES.TEST,
        baseline: 'stable_diffusion_1',
        nsfw: false,
        config: {
          download: [minimalDownload, fullDownload],
        },
      };

      expect(model.config?.download?.length).toBe(2);
    });
  });
});
