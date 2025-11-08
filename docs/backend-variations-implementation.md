# Backend Variations Implementation

## Overview

This document describes the implementation of per-backend statistics for text generation models, enabling the frontend to display separate worker counts, performance metrics, and usage statistics for different backend types (e.g., aphrodite, koboldcpp).

## Problem Statement

The Horde API returns separate entries for backend-prefixed models (e.g., `koboldcpp/Qwen3-0.6B`, `aphrodite/Qwen3-0.6B`), but the backend was aggregating these into a single entry, losing backend-specific detail. Users needed to see per-backend statistics in the UI.

## Solution Architecture

### Backend Changes

#### 1. Fixed Typo in `meta_consts.py`

**File:** `src/horde_model_reference/meta_consts.py` (line 405)

Fixed critical typo that broke variant generation:

```python
# Before
_TEXT_LEGACY_CONVERT_bBACKEND_PREFIXES = ["koboldcpp", "aphrodite"]

# After
_TEXT_LEGACY_CONVERT_BACKEND_PREFIXES = ["koboldcpp", "aphrodite"]
```

#### 2. Added BackendVariation Model

**File:** `src/horde_model_reference/model_reference_api/horde_api_models.py`

Created Pydantic model for backend-specific statistics:

```python
class BackendVariation(BaseModel):
    backend: str
    variant_name: str
    worker_count: int | None = None
    performance: float | None = None
    queued: int | None = None
    queued_jobs: int | None = None
    eta: int | None = None
    usage_day: int | None = None
    usage_month: int | None = None
    usage_total: int | None = None
```

#### 3. Added Variation Tracking Methods

**File:** `src/horde_model_reference/model_reference_api/horde_api_models.py`

- `IndexedHordeModelStatus.get_status_with_variations()` - Returns aggregated status + per-backend status dict
- `IndexedHordeModelStats.get_stats_with_variations()` - Returns aggregated stats + per-backend stats dict

#### 4. Updated CombinedModelStatistics

**File:** `src/horde_model_reference/model_reference_api/data_merger.py`

Added optional field:

```python
backend_variations: dict[str, BackendVariation] | None = None
```

#### 5. Modified Merge Functions

**File:** `src/horde_model_reference/model_reference_api/data_merger.py`

Updated `merge_model_with_horde_data()` to accept `include_backend_variations` parameter and populate variations when requested.

#### 6. Updated Statistics Endpoint

**File:** `src/horde_model_reference/model_reference_api/statistics.py`

Added query parameter:

```python
@router.get("/statistics/{category}/with-stats")
async def read_models_with_stats(
    category: str,
    include_backend_variations: bool = False,
    ...
)
```

### Frontend Changes

#### 1. Added TypeScript Types

**File:** `src/app/models/api.models.ts`

Manually defined TypeScript interfaces for backend variations:

```typescript
export interface BackendVariation {
  backend: string;
  variant_name: string;
  worker_count?: number;
  performance?: number;
  queued?: number;
  eta?: number;
  usage_day?: number;
  usage_month?: number;
  usage_total?: number;
}

export interface BackendCombinedModelStatistics {
  worker_count?: number;
  queued_jobs?: number;
  performance?: number;
  eta?: number;
  queued?: number;
  usage_stats?: HordeModelUsageStats;
  worker_summaries?: Record<string, HordeWorkerSummary>;
  backend_variations?: Record<string, BackendVariation>;
}
```

#### 2. Updated HordeApiService

**File:** `src/app/services/horde-api.service.ts`

Modified `getCombinedModelData()` to pass `include_backend_variations=true` for text models:

```typescript
getCombinedModelData(hordeType: HordeType): Observable<BackendStatisticsResponse> {
  return this.apiService.readModelsWithStats(
    hordeType,
    hordeType === 'text' ? true : undefined, // includeBackendVariations
  ).pipe(
    map((response) => response as BackendStatisticsResponse),
  );
}
```

#### 3. Updated Model Merging Logic

**File:** `src/app/models/unified-model.ts`

Modified `mergeMultipleBackendStatistics()` to extract backend variations and create additional `UnifiedModelData` entries:

```typescript
export function mergeMultipleBackendStatistics<T extends { name: string }>(
  referenceModels: T[],
  backendStats: Record<string, BackendCombinedModelStatistics> | undefined,
  options?: { parseTextModelNames?: boolean },
): UnifiedModelData[] {
  const result: UnifiedModelData[] = [];

  for (const model of referenceModels) {
    const unified = mergeBackendStatistics(model, backendStats, options);
    result.push(unified);

    // Check if this model has backend variations
    if (backendStats && model.name) {
      const stats = backendStats[model.name];
      if (stats?.backend_variations) {
        // Create a UnifiedModelData entry for each backend variation
        for (const [backendName, variation] of Object.entries(stats.backend_variations)) {
          const backendVariation: UnifiedModelData = {
            ...model,
            name: variation.variant_name,
            workerCount: variation.worker_count ?? undefined,
            queuedJobs: variation.queued ?? undefined,
            performance: variation.performance ?? undefined,
            eta: variation.eta ?? undefined,
            queued: variation.queued ?? undefined,
          };

          if (options?.parseTextModelNames) {
            backendVariation.parsedName = parseTextModelName(variation.variant_name);
          }

          if (variation.usage_day !== undefined || variation.usage_month !== undefined || variation.usage_total !== undefined) {
            backendVariation.usageStats = {
              day: variation.usage_day ?? 0,
              month: variation.usage_month ?? 0,
              total: variation.usage_total ?? 0,
            };
          }

          result.push(backendVariation);
        }
      }
    }
  }

  return result;
}
```

## Data Flow

1. **Frontend requests text model data:**
   - `HordeApiService.getCombinedModelData('text')` calls backend with `include_backend_variations=true`

2. **Backend processes request:**
   - Loads model reference data
   - Fetches Horde API status for all backend variants (e.g., `model_name`, `koboldcpp/model_name`, `aphrodite/model_name`)
   - Aggregates statistics across all variants
   - If `include_backend_variations=true`, also tracks per-backend statistics in `backend_variations` dict

3. **Backend returns response:**

   ```json
   {
     "Qwen3-0.6B": {
       "worker_count": 15,
       "performance": 1234.5,
       "backend_variations": {
         "koboldcpp": {
           "backend": "koboldcpp",
           "variant_name": "koboldcpp/Qwen3-0.6B",
           "worker_count": 8,
           "performance": 678.9,
           "usage_total": 1000
         },
         "aphrodite": {
           "backend": "aphrodite",
           "variant_name": "aphrodite/Qwen3-0.6B",
           "worker_count": 7,
           "performance": 555.6,
           "usage_total": 500
         }
       }
     }
   }
   ```

4. **Frontend processes response:**
   - `mergeMultipleBackendStatistics()` creates three `UnifiedModelData` entries:
     - One for `Qwen3-0.6B` (aggregated)
     - One for `koboldcpp/Qwen3-0.6B` (backend-specific)
     - One for `aphrodite/Qwen3-0.6B` (backend-specific)

5. **Frontend groups models:**
   - `createGroupedTextModels()` groups all three entries by base name
   - Creates `GroupedTextModel` with `variations` array containing all three entries
   - Extracts `availableBackends: ['koboldcpp', 'aphrodite']`

6. **UI displays data:**
   - Main row shows aggregated statistics
   - Variations table shows per-backend rows with individual worker counts and usage

## Benefits

- **Backward Compatibility:** The `include_backend_variations` parameter is optional and defaults to `false`, maintaining existing behavior
- **Performance:** Backend does aggregation, avoiding expensive client-side matching
- **Type Safety:** Full Pydantic and TypeScript type coverage
- **Reusability:** Variations integrate seamlessly with existing grouping and display logic

## Testing Checklist

- [ ] Verify backend endpoint returns `backend_variations` when `include_backend_variations=true`
- [ ] Verify frontend receives and parses `backend_variations` correctly
- [ ] Verify variations table displays per-backend worker counts
- [ ] Verify variations table displays per-backend usage statistics
- [ ] Verify aggregation still works correctly with new variation sources
- [ ] Verify image models (which don't use backend variations) still work
- [ ] Verify backward compatibility when `include_backend_variations=false`

## Files Modified

### Backend

- `src/horde_model_reference/meta_consts.py` - Fixed typo
- `src/horde_model_reference/model_reference_api/horde_api_models.py` - Added BackendVariation model and variation tracking methods
- `src/horde_model_reference/model_reference_api/data_merger.py` - Added backend_variations field and population logic
- `src/horde_model_reference/model_reference_api/statistics.py` - Added include_backend_variations parameter

### Frontend

- `src/app/models/api.models.ts` - Added BackendVariation and related TypeScript types
- `src/app/services/horde-api.service.ts` - Updated to pass include_backend_variations parameter
- `src/app/models/unified-model.ts` - Updated mergeMultipleBackendStatistics to extract and create backend variation entries
- `src/assets/openapi-schema.json` - Regenerated (API client update)
