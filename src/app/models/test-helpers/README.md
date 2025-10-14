# Test Helpers

This directory contains shared utilities for testing model-related functionality.

## Used By

- `api.models.spec.ts` - OpenAPI schema validation tests
- `api.models.drift.spec.ts` - API drift detection tests

## Files

### `test-constants.ts`

Centralized constants used across multiple test files:

- `TEST_MODEL_NAMES` - Common model names for testing
- `TEST_PRETRAINED_NAMES` - Pretrained model identifiers (e.g., CLIP)
- `TEST_URLS` - Standard URLs for test data
- `TEST_FILE_NAMES` - Common file names
- `TEST_DESCRIPTIONS` - Standard descriptions
- `TEST_TAGS` - Common tag arrays
- `TEST_PARAMETERS` - Numeric parameters
- `TEST_MODEL_CLASSIFICATION` - Model classification objects
- `TEST_REQUIREMENTS` - Model requirement objects
- `TEST_SETTINGS` - Model setting objects
- `ALL_MODEL_CATEGORIES` - Complete list of expected model categories
- `ACTIVE_MODEL_CATEGORIES` - Categories actively used in the app
- `ALL_BASELINES` - All expected baseline values
- `ALL_STYLES` - All expected style values
- `REPLICATE_MODES` - Backend replicate mode values
- `CANONICAL_FORMATS` - Backend canonical format values
- `SCHEMA_NAMES` - OpenAPI schema names for consistent test references

### `enum-validation.helpers.ts`

Utilities for validating enum completeness:

- `validateEnumExhaustiveness()` - Checks that generated enums match expected values

### `type-assertion.helpers.ts`

Compile-time type checking utilities:

- `assertBidirectionalTypeCompatibility()` - Verifies types are mutually assignable
- `testLogger` - Logging utility for verbose test output

### `model-builders.ts`

Builder pattern classes for creating test model instances:

- `ImageModelBuilder` - Fluent API for building ImageGenerationModelRecordOutput instances
- `TextModelBuilder` - Fluent API for building TextGenerationModelRecordOutput instances

### `openapi-validation.helpers.ts`

OpenAPI schema validation utilities:

- `fetchOpenApiSchema()` - Fetches schema from service or local file
- `getSchemaDefinition()` - Gets specific schema by name
- `isFieldRequired()` - Checks if field is required
- `getFieldType()` - Gets field type
- `isInEnum()` / `getEnumValues()` - Enum validation
- `validateRequiredFields()` - Validates object against schema
- `getAllPaths()` / `hasEndpoint()` - Path validation
- `getAllSchemaNames()` / `hasSchema()` - Schema name validation

### `schema-test.helpers.ts`

Utilities for schema-based testing:

- `isSchemaUnavailable()` - Check if schema fetch failed and test should be skipped

### `index.ts`

Centralized exports for all test helper utilities. Import from this file to access all helpers:

```typescript
import {
  TEST_MODEL_NAMES,
  ImageModelBuilder,
  validateEnumExhaustiveness,
  testLogger,
  // ... etc
} from './test-helpers';
```

## Usage

### Using Test Constants

```typescript
import { 
  TEST_MODEL_NAMES, 
  TEST_URLS, 
  SCHEMA_NAMES, 
  REPLICATE_MODES 
} from './test-helpers';

const model = {
  name: TEST_MODEL_NAMES.STABLE_DIFFUSION,
  url: TEST_URLS.MODEL_SAFETENSORS,
};

// Use schema name constants
const schema = getSchemaDefinition(openApiSchema, SCHEMA_NAMES.IMAGE_GENERATION_OUTPUT);

// Check mode values
expect(REPLICATE_MODES).toContain('PRIMARY');
```

### Using Model Builders

```typescript
import { ImageModelBuilder } from './test-helpers';

const model = new ImageModelBuilder()
  .withName('my-model')
  .withBaseline('stable_diffusion_xl')
  .withTags(['realistic', 'portrait'])
  .build();
```

### Using Enum Validation

```typescript
import { validateEnumExhaustiveness, ALL_MODEL_CATEGORIES } from './test-helpers';
import { MODEL_REFERENCE_CATEGORY } from '../api-client';

const result = validateEnumExhaustiveness(
  MODEL_REFERENCE_CATEGORY,
  ALL_MODEL_CATEGORIES as unknown as string[],
  'MODEL_REFERENCE_CATEGORY'
);

expect(result.countMatches).toBe(true);
expect(result.allValuesPresent).toBe(true);
```

### Using Type Assertions

```typescript
import { assertBidirectionalTypeCompatibility } from './test-helpers';

const typeCheck = assertBidirectionalTypeCompatibility<MyType, GeneratedType>();
expect(typeCheck.forward).toBe(true);
expect(typeCheck.backward).toBe(true);
```

### Using OpenAPI Validation

```typescript
import { fetchOpenApiSchema, getSchemaDefinition } from './test-helpers';

const schema = await fetchOpenApiSchema('http://localhost:8000');
const modelSchema = getSchemaDefinition(schema, 'ImageGenerationModelRecord-Output');
```

## Design Principles

1. **Centralization** - All shared test utilities live in one place
2. **Reusability** - Functions and constants can be used across multiple test files
3. **Type Safety** - All utilities maintain strong TypeScript typing
4. **Documentation** - Each export is documented with JSDoc comments
5. **Single Import** - Use `index.ts` for convenient access to all helpers

## Adding New Helpers

When adding new test utilities:

1. Create a new file with a descriptive name (e.g., `validation.helpers.ts`)
2. Export utilities with clear, descriptive names
3. Add JSDoc comments to all exports
4. Re-export from `index.ts`
5. Update this README with usage examples
