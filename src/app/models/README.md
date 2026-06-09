# `src/app/models` — custom types, the API-client seam, and drift guards

This directory holds hand-maintained TypeScript types and the **seam** between the app and the
auto-generated API client. The generated client (`src/app/api-client/`, from the OpenAPI schema) is
the source of truth for record shapes; the files here adapt and stabilize them for app consumption.

## The seam: `api.models.ts`

App code imports **generated record types through this module, not directly from `api-client`.** The
seam re-exports them under stable names, so a regeneration that renames a generated type (e.g. FastAPI
collapsing its `-Input`/`-Output` schemas into a single name) is absorbed by editing the aliases here
instead of rippling across adapters, services, and tests.

What it provides:

- **Re-exported generated record types** (stable surface): `ImageGenerationModelRecord`,
  `TextGenerationModelRecord`, `ControlNetModelRecord`, `GenericModelRecord`, `NewModelRecord`,
  `ResponseReadV2ReferenceValue`.
- **Convenience aliases**: `ModelRecord` (= `ResponseReadV2ReferenceValue`), `ModelReferenceCategory`
  (= `MODEL_REFERENCE_CATEGORY`).
- **V1 legacy write-payload aliases**: `LegacyImageGenerationPayload`, `LegacyTextGenerationPayload`,
  `LegacyControlnetPayload`, `LegacyClipPayload` — the exact shapes the generated v1 service methods
  accept (distinct names because the hand-written legacy domain types below share the unprefixed ones).
- **Hand-written legacy domain types**: `LegacyStableDiffusionRecord`, `LegacyTextGenerationRecord`,
  `LegacyClipRecord`, `LegacyGenericRecord`, `LegacyRecordUnion`, plus `LegacyConfig*` and
  `BackendCapabilities` / `CategoryModelsResponse` / `LegacyModelsResponse`.

## Import rules

- **Generated record types** → import from `./api.models` (the seam). An ESLint
  `no-restricted-imports` rule enforces this; the seam file and the schema specs are exempt.
- **Generated service classes / enums** (`V2Service`, `MODEL_REFERENCE_CATEGORY`, `BASE_PATH`, …) →
  import from `../api-client` directly.
- **Legacy/custom types and guards** → import from `./api.models`, `./legacy-type-guards`,
  `./legacy-validators`, or the `./` barrel (`index.ts` re-exports these three).

```typescript
import { ImageGenerationModelRecord, LegacyRecordUnion } from '../models/api.models';
import { MODEL_REFERENCE_CATEGORY, V2Service } from '../api-client';
import { isLegacyStableDiffusionRecord } from '../models/legacy-type-guards';
```

## Other key files

- `legacy-type-guards.ts` — type guards (`isLegacyStableDiffusionRecord()`, …) and helpers
  (`createDefaultRecordForCategory()`, `getRecordCategory()`, baseline display/normalization maps).
- `legacy-validators.ts` — structural validators for legacy records (`validateLegacyRecord()`, …).
- `unified-model.ts` — merges reference data with live Horde stats.
- `test-helpers/` — shared fixtures and OpenAPI/type assertion helpers used by the specs.

## Tests

| Spec                       | Backend?                                                                                                  | What it guards                                                                                                                                                                                                                                                          |
| -------------------------- | --------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `api.models.spec.ts`       | **Yes** — fetches the live OpenAPI schema (skips/pends if unavailable; runs in the CI `api-contract` job) | The hand-written types and enums still match the backend schema (fields, enum values, endpoints).                                                                                                                                                                       |
| `api.models.drift.spec.ts` | **No** — reads the committed `src/assets/openapi-schema.json`                                             | The schema still exposes the model-record union the generator relies on, every member resolves to a component schema, and (compile-time) each category record stays in the `NewModelRecord` / `ResponseReadV2ReferenceValue` unions and the seam keeps re-exporting it. |

```bash
npm test                                              # everything
npm test -- --include='**/api.models.spec.ts'         # backend contract (needs the service running)
npm test -- --include='**/api.models.drift.spec.ts'   # drift guard (no backend)
```

The drift spec is the cheap, always-on guard that the API-client tooling points at after a
regeneration. See `.github/instructions/api-client.instructions.md` for the full pipeline.

## Maintenance

Update these when the backend API changes:

- Regenerate the client (`npm run generate-client`) and follow the "After Regenerating" checklist in
  `api-client.instructions.md`. If generated type names changed, fix them in `api.models.ts` (the seam).
- Keep the hand-written legacy types and `api.models.spec.ts` assertions in step with new
  endpoints/enums/categories.
- Do not duplicate generated types here; alias or re-export them through the seam instead.
