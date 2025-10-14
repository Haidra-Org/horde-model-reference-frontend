/**
 * Common test constants used throughout model tests
 */

/**
 * Common test model names used throughout tests
 */
export const TEST_MODEL_NAMES = {
  DEFAULT: 'test-model',
  TEST: 'test',
  IMAGE: 'image-model',
  TEXT: 'text-model',
  GENERIC: 'generic-model',
  STABLE_DIFFUSION: 'stable-diffusion-v1-5',
  LLAMA: 'llama-7b',
  CLIP: 'clip-vit-large',
} as const;

/**
 * Common pretrained model identifiers
 */
export const TEST_PRETRAINED_NAMES = {
  CLIP_VIT_LARGE: 'openai/clip-vit-large-patch14',
} as const;

/**
 * Common test URLs used throughout tests
 */
export const TEST_URLS = {
  EXAMPLE_BASE: 'https://example.com',
  MODEL_SAFETENSORS: 'https://example.com/model.safetensors',
  MODEL_BIN: 'https://example.com/model.bin',
  HOMEPAGE: 'https://example.com',
  SHOWCASE: 'https://example.com/showcase1.png',
  LLAMA_URL: 'https://example.com/llama-7b',
} as const;

/**
 * Common test file names
 */
export const TEST_FILE_NAMES = {
  SAFETENSORS: 'model.safetensors',
  BIN: 'model.bin',
} as const;

/**
 * Common test descriptions
 */
export const TEST_DESCRIPTIONS = {
  DEFAULT: 'Test description',
  IMAGE_MODEL: 'An image generation model',
  TEXT_MODEL: 'A text generation model',
  GENERIC_MODEL: 'A generic model',
  STABLE_DIFFUSION: 'Stable Diffusion v1.5',
  LLAMA: 'Llama 7B',
} as const;

/**
 * Common test tags
 */
export const TEST_TAGS = {
  GENERALIST: ['generalist', 'versatile'],
  TEXT_INSTRUCTION: ['generalist', 'instruction-following'],
  SINGLE: ['tag1', 'tag2'],
} as const;

/**
 * Common test parameters
 */
export const TEST_PARAMETERS = {
  LLAMA_7B: 7000000000,
  DEFAULT: 0,
} as const;

/**
 * Common test model classification
 */
export const TEST_MODEL_CLASSIFICATION = {
  IMAGE_GENERATION: {
    domain: 'image',
    purpose: 'generation',
  },
  TEXT_GENERATION: {
    domain: 'text',
    purpose: 'generation',
  },
} as const;

/**
 * Common test requirements
 */
export const TEST_REQUIREMENTS = {
  BASIC: {
    min_ram: 8,
    gpu_required: true,
  },
  WITH_CUSTOM: {
    min_ram: 8,
    gpu_required: true,
    custom_field: 'should work with empty interface',
  },
} as const;

/**
 * Common test settings
 */
export const TEST_SETTINGS = {
  BASIC: {
    max_tokens: 2048,
    temperature: 0.7,
  },
  WITH_CUSTOM: {
    max_tokens: 2048,
    temperature: 0.7,
    custom_setting: true,
  },
} as const;

/**
 * All expected MODEL_REFERENCE_CATEGORY enum values
 */
export const ALL_MODEL_CATEGORIES = [
  'blip',
  'clip',
  'codeformer',
  'controlnet',
  'esrgan',
  'gfpgan',
  'safety_checker',
  'image_generation',
  'text_generation',
  'video_generation',
  'audio_generation',
  'miscellaneous',
] as const;

/**
 * Actively used model categories in the application
 */
export const ACTIVE_MODEL_CATEGORIES = [
  'image_generation',
  'text_generation',
  'clip',
  'controlnet',
] as const;

/**
 * All expected KNOWN_IMAGE_GENERATION_BASELINE values
 */
export const ALL_BASELINES = [
  'infer',
  'stable_diffusion_1',
  'stable_diffusion_2_768',
  'stable_diffusion_2_512',
  'stable_diffusion_xl',
  'stable_cascade',
  'flux_1',
  'flux_schnell',
  'flux_dev',
] as const;

/**
 * All expected MODEL_STYLE values
 */
export const ALL_STYLES = [
  'generalist',
  'anime',
  'furry',
  'artistic',
  'other',
  'realistic',
] as const;

/**
 * Replicate mode values for backend capabilities
 */
export const REPLICATE_MODES = ['PRIMARY', 'REPLICA', 'UNKNOWN'] as const;

/**
 * Canonical format values for backend capabilities
 */
export const CANONICAL_FORMATS = ['legacy', 'v2', 'UNKNOWN'] as const;

/**
 * Common OpenAPI schema names used in tests
 */
export const SCHEMA_NAMES = {
  // Response models
  CONTAINS_MESSAGE: 'ContainsMessage',
  CONTAINS_STATUS: 'ContainsStatus',
  ERROR_RESPONSE: 'ErrorResponse',
  ERROR_DETAIL: 'ErrorDetail',
  HTTP_VALIDATION_ERROR: 'HTTPValidationError',
  VALIDATION_ERROR: 'ValidationError',
  
  // Model records
  IMAGE_GENERATION_INPUT: 'ImageGenerationModelRecord-Input',
  IMAGE_GENERATION_OUTPUT: 'ImageGenerationModelRecord-Output',
  TEXT_GENERATION_INPUT: 'TextGenerationModelRecord-Input',
  TEXT_GENERATION_OUTPUT: 'TextGenerationModelRecord-Output',
  CONTROLNET_INPUT: 'ControlNetModelRecord-Input',
  CONTROLNET_OUTPUT: 'ControlNetModelRecord-Output',
  GENERIC_INPUT: 'GenericModelRecord-Input',
  GENERIC_OUTPUT: 'GenericModelRecord-Output',
  
  // Metadata
  GENERIC_METADATA: 'GenericModelRecordMetadata',
  GENERIC_CONFIG: 'GenericModelRecordConfig',
  MODEL_CLASSIFICATION: 'ModelClassification',
  DOWNLOAD_RECORD: 'DownloadRecord',
  
  // Enums
  MODEL_REFERENCE_CATEGORY: 'MODEL_REFERENCE_CATEGORY',
  MODEL_DOMAIN: 'MODEL_DOMAIN',
  MODEL_PURPOSE: 'MODEL_PURPOSE',
  MODEL_STYLE: 'MODEL_STYLE',
  CONTROLNET_STYLE: 'CONTROLNET_STYLE',
  KNOWN_IMAGE_GENERATION_BASELINE: 'KNOWN_IMAGE_GENERATION_BASELINE',
  REPLICATE_MODE: 'ReplicateMode',
} as const;
