# Custom Models Directory

This directory contains **custom types and utilities** for working with the API. The type system is based on **generated API client models** as the authoritative source, with these custom types anchoring expectations for legacy formats and additional utilities.

## Architecture

**Generated types** from `../api-client/` are the **primary source of truth**, automatically generated from the OpenAPI schema.

**Custom types** in this directory provide simplified TypeScript interfaces. Tests validate that these types remain compatible with the generated types, alerting developers to any schema changes.

## File Overview

### `api.models.ts`

Main exports combining generated and custom types:

- **Type Aliases**: `ModelRecord`, `ModelReferenceCategory` (based on generated types)
- **Re-exports**: Common generated types for convenience
- **Legacy Record Types**: `LegacyStableDiffusionRecord`, `LegacyTextGenerationRecord`, `LegacyClipRecord`, `LegacyGenericRecord`
- **Custom Types**: `BackendCapabilities`, `CategoryModelsResponse`, `LegacyModelsResponse`

### `api.models.spec.ts`

OpenAPI schema validation tests that ensure:

- Schema availability and validity
- Generated client types work correctly
- Enum values match OpenAPI definitions
- All expected endpoints and schemas exist

### `api.models.drift.spec.ts` ⭐ NEW

**Drift detection tests** that explicitly check when local definitions diverge from generated types:

- Type compatibility validation
- Field mapping documentation
- Enum value consistency checks
- Conversion utility examples

**These tests will fail if types drift**, alerting you to schema changes.

### `legacy-type-guards.ts`

Type guard functions for legacy format:

- **Legacy Record Types**: `LegacyStableDiffusionRecord`, `LegacyTextGenerationRecord`, `LegacyClipRecord`, `LegacyGenericRecord`, `LegacyRecordUnion`
- **Legacy Config Types**: `LegacyConfig`, `LegacyConfigFile`, `LegacyConfigDownload`
- **Response Types**: `BackendCapabilities`, `CategoryModelsResponse`, `LegacyModelsResponse`
- **Type Aliases**: `ModelRecord`, `ModelReferenceCategory`

### `legacy-type-guards.ts`

Type guard functions and utilities for working with legacy records:

- Type guards: `isLegacyStableDiffusionRecord()`, `isLegacyTextGenerationRecord()`, `isLegacyClipRecord()`, `isLegacyGenericRecord()`
- Factory functions: `createDefaultRecordForCategory()`, `getRecordCategory()`
- Display maps: `BASELINE_DISPLAY_MAP`, `BASELINE_NORMALIZATION_MAP`

### `legacy-validators.ts`

Validation utilities for legacy model records:

- Field validators: `validateConfigFile()`, `validateConfigDownload()`, `validateConfig()`
- Record validators: `validateLegacyRecord()`, `validateStableDiffusionRecord()`, `validateTextGenerationRecord()`
- Helper functions: `hasErrorIssues()`, `groupIssuesBySeverity()`

### `index.ts`

Public API - re-exports all custom types and utilities

## Usage Guidelines

### Importing Types

**For generated API types**, import directly from `api-client`:

```typescript
import { MODELREFERENCECATEGORY, ModelReferenceV1Service } from '../api-client';
```

**For custom/legacy types**, import from this directory:

```typescript
import { LegacyRecordUnion, BackendCapabilities } from '../models/api.models';
import { isLegacyStableDiffusionRecord } from '../models/legacy-type-guards';
import { validateLegacyRecord } from '../models/legacy-validators';
```

**For convenience**, you can import everything through the index:

```typescript
import { LegacyRecordUnion, isLegacyStableDiffusionRecord, validateLegacyRecord } from '../models';
```

## Related Directories

- **`../api-client/`** - Auto-generated API client from OpenAPI schema (do not edit manually)
- **`../services/`** - Service layer that uses both generated and custom types
- **`../components/`** - UI components that consume the types

## Development Notes

- The types in this directory are **manually maintained** to support the legacy API format
- Generated types in `api-client` should **not be duplicated** here
- Keep type aliases minimal - only create them when they improve readability
- All validators should return structured error information

---

## API Models Testing

The test suite in `api.models.spec.ts` validates that the TypeScript API models correctly match the OpenAPI schema definitions from the backend service.

### Configuration

By default, tests connect to the service URL configured in `environment.test.ts`. To test against a different service instance, modify the test environment configuration.

### Running Tests

Run all tests:

```bash
npm test
```

Run only the API model tests:

```bash
npm test -- --include='**/api.models.spec.ts'
```

### What is Validated

The test suite validates:

1. **Schema Availability**
   - Successful fetching of OpenAPI schema
   - Valid OpenAPI version
   - Presence of component schemas

2. **Response Models**
   - `ContainsMessage` schema structure
   - `BackendCapabilities` has correct mode values
   - `ErrorResponse` schema structure
   - `ModelReferenceCategory` matches `MODEL_REFERENCE_CATEGORY` enum

3. **Legacy Model Records**
   - `LegacyConfigFile` structure
   - `LegacyConfigDownload` structure
   - `LegacyGenericRecord` required fields
   - `LegacyStableDiffusionRecord` matches `ImageGenerationModelRecord` schema
   - `LegacyTextGenerationRecord` matches `TextGenerationModelRecord` schema
   - `LegacyClipRecord` structure
   - Requirements field type support

4. **Request/Response Types**
   - `CategoryModelsResponse` structure
   - `LegacyModelsResponse` structure

5. **Schema Enum Validation**
   - `MODEL_REFERENCE_CATEGORY` enum values
   - `KNOWN_IMAGE_GENERATION_BASELINE` enum values
   - `MODEL_STYLE` enum values
   - `CONTROLNET_STYLE` enum values

6. **API Endpoint Validation**
   - V1 endpoint presence
   - V2 endpoint presence
   - Heartbeat and status endpoints

7. **Schema Component Completeness**
   - All expected model record schemas
   - All metadata schemas
   - All enum schemas
   - All response schemas

### Test Results

Tests will output:

- ✓ Pass: Model definitions match the OpenAPI schema
- ✗ Fail: Discrepancies found between models and schema
- Pending: Tests skipped if OpenAPI schema cannot be fetched

### Prerequisites

1. **Backend Service Running**: The horde-model-reference service must be running and accessible
2. **Network Access**: Tests make actual HTTP requests to fetch the OpenAPI schema

### Troubleshooting

**Problem**: Tests are all pending with "OpenAPI schema not available"

- **Solution**: Ensure the horde-model-reference service is running at the configured URL
- Check the service is accessible: `curl http://localhost:19800/api/openapi.json`

**Problem**: Schema validation fails

- **Solution**: This indicates a mismatch between TypeScript definitions and backend schema
- Review the specific test failure message
- Update `api.models.ts` to match the backend schema, or update the backend if the TypeScript definitions are correct

### Maintenance

Keep these tests updated when:

- Backend API changes (new endpoints, schema updates)
- Frontend model definitions are added or modified
- OpenAPI specification version changes
- New model categories or types are introduced

## Test Suite: `api.models.spec.ts`

The test suite validates that the TypeScript API models in `api.models.ts` correctly match the OpenAPI schema definitions from the backend service.

### Configuration

By default, tests connect to `http://localhost:19800`. To test against a different service instance, you can modify the `TEST_CONFIG` object in the spec file:

```typescript
const TEST_CONFIG = {
  apiUrl: 'http://localhost:19800', // Change this to your service URL
  timeout: 10000, // Timeout in milliseconds
};
```

### Running Tests

Run all tests:

```bash
npm test
```

Run only the API model tests:

```bash
npm test -- --include='**/api.models.spec.ts'
```

### What is Validated

The test suite validates:

1. **Schema Availability**
   - Successful fetching of OpenAPI schema
   - Valid OpenAPI version
   - Presence of component schemas

2. **Response Models**
   - `ApiInfoResponse` matches `ContainsMessage` schema
   - `BackendCapabilities` has correct mode values
   - `ApiErrorResponse` matches `ErrorResponse` schema
   - `ModelReferenceCategory` matches `MODEL_REFERENCE_CATEGORY` enum

3. **Legacy Model Records**
   - `LegacyConfigFile` structure
   - `LegacyConfigDownload` structure
   - `LegacyGenericRecord` required fields
   - `LegacyStableDiffusionRecord` matches `ImageGenerationModelRecord` schema
   - `LegacyTextGenerationRecord` matches `TextGenerationModelRecord` schema
   - `LegacyClipRecord` structure
   - Requirements field type support

4. **Request/Response Types**
   - `CreateModelRequest` structure
   - `UpdateModelRequest` structure
   - `DeleteModelRequest` structure
   - `CategoryModelsResponse` structure
   - `LegacyModelsResponse` structure

5. **Schema Enum Validation**
   - `MODEL_REFERENCE_CATEGORY` enum values
   - `KNOWN_IMAGE_GENERATION_BASELINE` enum values
   - `MODEL_STYLE` enum values
   - `CONTROLNET_STYLE` enum values

6. **API Endpoint Validation**
   - V1 endpoint presence
   - V2 endpoint presence
   - Heartbeat and status endpoints

7. **Schema Component Completeness**
   - All expected model record schemas
   - All metadata schemas
   - All enum schemas
   - All response schemas

### Test Results

Tests will output:

- ✓ Pass: Model definitions match the OpenAPI schema
- ✗ Fail: Discrepancies found between models and schema
- Pending: Tests skipped if OpenAPI schema cannot be fetched

If the OpenAPI schema cannot be fetched (e.g., service not running), tests will be marked as "pending" rather than failing.

### Prerequisites

1. **Backend Service Running**: The horde-model-reference service must be running and accessible at the configured URL
2. **Network Access**: Tests make actual HTTP requests to fetch the OpenAPI schema

### Troubleshooting

**Problem**: Tests are all pending with "OpenAPI schema not available"

- **Solution**: Ensure the horde-model-reference service is running at the configured URL
- Check the service is accessible: `curl http://localhost:19800/api/openapi.json`

**Problem**: Schema validation fails

- **Solution**: This indicates a mismatch between TypeScript definitions and backend schema
- Review the specific test failure message
- Update `api.models.ts` to match the backend schema, or
- Update the backend schema if the TypeScript definitions are correct

**Problem**: Timeout errors

- **Solution**: Increase the timeout in `TEST_CONFIG.timeout`
- Check network connectivity to the service

### Adding New Model Validations

To add validation for new models:

1. Add the TypeScript interface to `api.models.ts`
2. Add a corresponding test in `api.models.spec.ts` following the existing patterns
3. Reference the appropriate OpenAPI schema component
4. Validate structure, required fields, and type correctness

Example:

```typescript
it('NewModelType should match OpenAPI schema', () => {
  if (schemaFetchError) {
    pending('OpenAPI schema not available');
    return;
  }

  const schema = openApiSchema.components?.schemas?.['NewModelSchema'];
  expect(schema).toBeDefined();

  const mockModel: NewModelType = {
    requiredField: 'value',
  };

  expect(mockModel.requiredField).toBeDefined();
  expect(typeof mockModel.requiredField).toBe('string');
});
```

### CI/CD Integration

For continuous integration:

1. Ensure the backend service is running in your CI environment
2. Set the appropriate service URL if not using localhost
3. Run tests as part of your build pipeline
4. Consider making these tests optional if backend service availability varies

Example for GitHub Actions:

```yaml
- name: Start backend service
  run: docker-compose up -d

- name: Wait for service
  run: |
    timeout 30 bash -c 'until curl -f http://localhost:19800/heartbeat; do sleep 1; done'

- name: Run API model tests
  run: npm test -- --include='**/api.models.spec.ts'
```

### Maintenance

Keep these tests updated when:

- Backend API changes (new endpoints, schema updates)
- Frontend model definitions are added or modified
- OpenAPI specification version changes
- New model categories or types are introduced

Regular test execution helps ensure the frontend stays synchronized with the backend API contract.
