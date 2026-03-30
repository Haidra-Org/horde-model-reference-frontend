import { HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { catchError, map, Observable, of, tap, throwError } from 'rxjs';
import {
  FormModelData,
  formToLegacyApi,
  formToV2Api,
  legacyApiToForm,
  v2ApiToForm,
} from '../adapters/model-format-adapter';
import {
  DefaultService,
  V1Service,
  V1CreateUpdateService,
  V2Service,
  StatisticsService,
  DeletionRiskService,
  MODEL_REFERENCE_CATEGORY,
  BackendInfo,
  CanonicalFormat,
  ReplicateMode,
  ResponseReadV2ReferenceValue,
  CategoryStatistics,
  CategoryDeletionRiskResponse,
  PendingChangeRecord,
  HTTPValidationError,
  NewModelRecord,
  ImageGenerationModelRecordInput,
  TextGenerationModelRecordInput,
  ControlNetModelRecordInput,
  LegacyBlipRecordInput,
  LegacyClipRecordInput,
  LegacyCodeformerRecordInput,
  LegacyControlnetRecordInput,
  LegacyEsrganRecordInput,
  LegacyGfpganRecordInput,
  LegacyMiscellaneousRecordInput,
  LegacySafetyCheckerRecordInput,
  LegacyStableDiffusionRecordInput,
  LegacyTextGenerationRecordInput,
} from '../api-client';
import {
  BackendCapabilities,
  BackendStatisticsResponse,
  LegacyModelsResponse,
  LegacyRecordUnion,
} from '../models/api.models';
import { ModelValidationService } from './model-validation.service';
import { NotificationService } from './notification.service';

@Injectable({
  providedIn: 'root',
})
export class ModelReferenceApiService {
  private readonly defaultService = inject(DefaultService);
  private readonly legacyService = inject(V1Service);
  private readonly v1CreateUpdateService = inject(V1CreateUpdateService);
  private readonly v2Service = inject(V2Service);
  private readonly statisticsService = inject(StatisticsService);
  private readonly deletionRiskService = inject(DeletionRiskService);
  private readonly validationService = inject(ModelValidationService);
  private readonly notifications = inject(NotificationService);

  readonly backendCapabilities = signal<BackendCapabilities>({
    writable: false,
    mode: 'UNKNOWN',
    canonicalFormat: 'UNKNOWN',
  });

  detectBackendCapabilities(): Observable<BackendCapabilities> {
    return this.defaultService.replicateModeReplicateModeGet().pipe(
      map((info: BackendInfo) => {
        // Handle both old (string) and new (BackendInfo) response formats for backward compatibility
        const isBackendInfo = typeof info === 'object' && 'canonical_format' in info;

        if (isBackendInfo) {
          // New BackendInfo response
          const capabilities: BackendCapabilities = {
            writable: info.writable,
            mode: info.replicate_mode === ReplicateMode.Primary ? 'PRIMARY' : 'REPLICA',
            canonicalFormat: info.canonical_format === CanonicalFormat.Legacy ? 'legacy' : 'v2',
          };
          return capabilities;
        } else {
          // Fallback for old ReplicateMode-only response (backward compatibility)
          const mode = info as unknown as ReplicateMode;
          const isPrimary = mode === ReplicateMode.Primary;
          const capabilities: BackendCapabilities = {
            writable: isPrimary,
            mode: isPrimary ? 'PRIMARY' : 'REPLICA',
            canonicalFormat: 'legacy', // Default assumption for old backends
          };
          return capabilities;
        }
      }),
      tap((capabilities) => this.backendCapabilities.set(capabilities)),
      catchError(() => {
        const defaultCapabilities: BackendCapabilities = {
          writable: false,
          mode: 'UNKNOWN',
          canonicalFormat: 'UNKNOWN',
        };
        this.backendCapabilities.set(defaultCapabilities);
        return of(defaultCapabilities);
      }),
    );
  }

  getCategories(): Observable<string[]> {
    return this.legacyService.readLegacyReferencesNames().pipe(
      map((categories) =>
        categories.map((category) =>
          typeof category === 'string' ? category : String(category as unknown),
        ),
      ),
      catchError(this.handleError),
    );
  }

  getModelsInCategory(category: string): Observable<Record<string, ResponseReadV2ReferenceValue>> {
    return this.v2Service.readV2Reference(category as MODEL_REFERENCE_CATEGORY).pipe(
      map((response: Record<string, ResponseReadV2ReferenceValue>) => {
        const result: Record<string, ResponseReadV2ReferenceValue> = {};
        if (!response) {
          return result;
        }

        Object.entries(response).forEach(([name, data]) => {
          const recordData = data ?? ({} as ResponseReadV2ReferenceValue);
          const potentialName = recordData.name;
          const recordName = typeof potentialName === 'string' ? potentialName : name;

          result[name] = {
            ...recordData,
            name: recordName,
          };
        });

        return result;
      }),
      catchError(this.handleError),
    );
  }

  getLegacyModelsInCategory(category: string): Observable<LegacyModelsResponse> {
    // Use dedicated text_generation endpoint with include_group parameter
    if (category === 'text_generation') {
      return this.legacyService.readLegacyTextGenerationReference(true).pipe(
        map((response: LegacyModelsResponse) => response),
        catchError(this.handleError),
      );
    }

    return this.legacyService.readLegacyReference(category as MODEL_REFERENCE_CATEGORY).pipe(
      map((response: LegacyModelsResponse) => response),
      catchError(this.handleError),
    );
  }

  getLegacyModelsAsArray(category: string): Observable<LegacyRecordUnion[]> {
    return this.getLegacyModelsInCategory(category).pipe(
      map((response) =>
        Object.entries(response).map(([name, data]) => ({
          ...data,
          name,
        })),
      ),
    );
  }

  /**
   * Format-aware model array fetch for display contexts (list, audit).
   * Returns flat records with `name` suitable for `mergeMultipleBackendStatistics`.
   */
  getDisplayModelsAsArray(
    category: string,
  ): Observable<(LegacyRecordUnion | ResponseReadV2ReferenceValue)[]> {
    const canonicalFormat = this.backendCapabilities().canonicalFormat;

    if (canonicalFormat === 'legacy' || canonicalFormat === 'UNKNOWN') {
      return this.getLegacyModelsAsArray(category);
    }

    return this.getModelsInCategory(category).pipe(
      map((response) => Object.values(response)),
    );
  }

  /**
   * Fetch a single model as FormModelData for form population.
   * Returns null if the model is not found.
   */
  getFormModel(category: string, modelName: string): Observable<FormModelData | null> {
    return this.getFormModelsInCategory(category).pipe(
      map((models) => models[modelName] ?? null),
    );
  }

  getFormModelsInCategory(category: string): Observable<Record<string, FormModelData>> {
    const categoryEnum = category as MODEL_REFERENCE_CATEGORY;
    const canonicalFormat = this.backendCapabilities().canonicalFormat;

    if (canonicalFormat === 'legacy' || canonicalFormat === 'UNKNOWN') {
      return this.getLegacyModelsInCategory(category).pipe(
        map((response) => {
          const result: Record<string, FormModelData> = {};
          Object.entries(response).forEach(([name, data]) => {
            result[name] = legacyApiToForm(data, categoryEnum);
          });
          return result;
        }),
      );
    }

    return this.getModelsInCategory(category).pipe(
      map((response) => {
        const result: Record<string, FormModelData> = {};
        Object.entries(response).forEach(([name, data]) => {
          result[name] = v2ApiToForm(data, categoryEnum);
        });
        return result;
      }),
    );
  }

  /**
   * Format-native model creation. Accepts FormModelData and dispatches to the
   * correct API version based on canonical format, using the adapter layer for
   * type-safe payload conversion.
   */
  createModel(
    category: string,
    modelName: string,
    formData: FormModelData,
  ): Observable<PendingChangeRecord> {
    if (!this.backendCapabilities().writable) {
      return throwError(
        () => new Error('Backend does not support write operations (REPLICA mode or wrong format)'),
      );
    }

    const categoryEnum = category as MODEL_REFERENCE_CATEGORY;
    const canonicalFormat = this.backendCapabilities().canonicalFormat;

    if (canonicalFormat === 'legacy') {
      const payload = formToLegacyApi(formData, modelName, categoryEnum);
      return this.createViaV1Api(category, modelName, payload);
    } else {
      const payload = formToV2Api(formData, modelName, categoryEnum);
      return this.createViaV2Api(category, payload);
    }
  }

  /**
   * Format-native model update. Accepts FormModelData and dispatches to the
   * correct API version based on canonical format.
   */
  updateModel(
    category: string,
    modelName: string,
    formData: FormModelData,
  ): Observable<PendingChangeRecord> {
    if (!this.backendCapabilities().writable) {
      return throwError(
        () => new Error('Backend does not support write operations (REPLICA mode or wrong format)'),
      );
    }

    const categoryEnum = category as MODEL_REFERENCE_CATEGORY;
    const canonicalFormat = this.backendCapabilities().canonicalFormat;

    if (canonicalFormat === 'legacy') {
      const payload = formToLegacyApi(formData, modelName, categoryEnum);
      return this.updateViaV1Api(category, modelName, payload);
    } else {
      const payload = formToV2Api(formData, modelName, categoryEnum);
      return this.updateViaV2Api(category, modelName, payload);
    }
  }

  /** @deprecated Use createModel() with FormModelData instead. */
  createLegacyModel(
    category: string,
    modelName: string,
    modelData: LegacyRecordUnion,
  ): Observable<PendingChangeRecord> {
    if (!this.backendCapabilities().writable) {
      return throwError(
        () => new Error('Backend does not support write operations (REPLICA mode or wrong format)'),
      );
    }

    const categoryEnum = category as MODEL_REFERENCE_CATEGORY;
    const canonicalFormat = this.backendCapabilities().canonicalFormat;

    if (canonicalFormat === 'legacy') {
      return this.createViaV1Api(category, modelName, modelData);
    } else {
      const formData = legacyApiToForm(modelData, categoryEnum);
      const payload = formToV2Api(formData, modelName, categoryEnum);
      return this.createViaV2Api(category, payload);
    }
  }

  /** @deprecated Use updateModel() with FormModelData instead. */
  updateLegacyModel(
    category: string,
    modelName: string,
    modelData: Partial<LegacyRecordUnion>,
  ): Observable<PendingChangeRecord> {
    if (!this.backendCapabilities().writable) {
      return throwError(
        () => new Error('Backend does not support write operations (REPLICA mode or wrong format)'),
      );
    }

    const categoryEnum = category as MODEL_REFERENCE_CATEGORY;
    const canonicalFormat = this.backendCapabilities().canonicalFormat;

    if (canonicalFormat === 'legacy') {
      return this.updateViaV1Api(category, modelName, modelData);
    } else {
      const normalized: LegacyRecordUnion = { ...(modelData as LegacyRecordUnion), name: modelName };
      const formData = legacyApiToForm(normalized, categoryEnum);
      const payload = formToV2Api(formData, modelName, categoryEnum);
      return this.updateViaV2Api(category, modelName, payload);
    }
  }

  deleteModel(category: string, modelName: string): Observable<void> {
    if (!this.backendCapabilities().writable) {
      return throwError(
        () => new Error('Backend does not support write operations (REPLICA mode or wrong format)'),
      );
    }

    const canonicalFormat = this.backendCapabilities().canonicalFormat;

    // Route to the appropriate API based on canonical format
    if (canonicalFormat === 'legacy') {
      return this.v1CreateUpdateService
        .deleteLegacyModel(category as MODEL_REFERENCE_CATEGORY, modelName)
        .pipe(
          map(() => undefined),
          catchError(this.handleError),
        );
    } else {
      return this.v2Service.deleteV2Model(category as MODEL_REFERENCE_CATEGORY, modelName).pipe(
        map(() => undefined),
        catchError(this.handleError),
      );
    }
  }

  /**
   * Create a model using the V1 (legacy) API.
   * Routes to the category-specific endpoint based on the category.
   *
   * All generated Legacy*RecordInput types share `[key: string]: any` index signatures.
   * Typing the payload with the same index signature makes it directly assignable to
   * every generated input type without per-branch type assertions.
   */
  private createViaV1Api(
    category: string,
    modelName: string,
    modelData: LegacyRecordUnion,
  ): Observable<PendingChangeRecord> {
    const payload: Record<string, unknown> & { name: string } = {
      ...modelData,
      name: modelData.name ?? modelName,
    };

    const svc = this.v1CreateUpdateService;
    const categoryMethodMap: Record<string, () => Observable<unknown>> = {
      blip: () => svc.createLegacyBlipModel(payload as LegacyBlipRecordInput),
      clip: () => svc.createLegacyClipModel(payload as LegacyClipRecordInput),
      codeformer: () => svc.createLegacyCodeformerModel(payload as LegacyCodeformerRecordInput),
      controlnet: () => svc.createLegacyControlnetModel(payload as LegacyControlnetRecordInput),
      esrgan: () => svc.createLegacyEsrganModel(payload as LegacyEsrganRecordInput),
      gfpgan: () => svc.createLegacyGfpganModel(payload as LegacyGfpganRecordInput),
      image_generation: () =>
        svc.createLegacyImageGenerationModel(payload as LegacyStableDiffusionRecordInput),
      miscellaneous: () =>
        svc.createLegacyMiscellaneousModel(payload as LegacyMiscellaneousRecordInput),
      safety_checker: () =>
        svc.createLegacySafetyCheckerModel(payload as LegacySafetyCheckerRecordInput),
      text_generation: () =>
        svc.createLegacyTextGenerationModel(payload as LegacyTextGenerationRecordInput),
    };

    const createFn = categoryMethodMap[category];
    if (!createFn) {
      return throwError(() => new Error(`Unknown category: ${category}`));
    }

    return createFn().pipe(
      map((response) => response as PendingChangeRecord),
      catchError(this.handleError),
    );
  }

  /**
   * Create a model using the V2 API.
   * Accepts a pre-built NewModelRecord payload (no legacy-to-V2 conversion here).
   */
  private createViaV2Api(
    category: string,
    payload: NewModelRecord,
  ): Observable<PendingChangeRecord> {
    const categoryMethodMap: Record<string, () => Observable<PendingChangeRecord>> = {
      image_generation: () =>
        this.v2Service.createV2ImageGenerationModel(
          payload as ImageGenerationModelRecordInput,
        ),
      text_generation: () =>
        this.v2Service.createV2TextGenerationModel(
          payload as TextGenerationModelRecordInput,
        ),
      controlnet: () =>
        this.v2Service.createV2ControlnetModel(payload as ControlNetModelRecordInput),
    };

    const createFn = categoryMethodMap[category];
    if (createFn) {
      return createFn().pipe(catchError(this.handleError));
    }

    return this.v2Service
      .createV2Model(category as MODEL_REFERENCE_CATEGORY, payload)
      .pipe(catchError(this.handleError));
  }

  /**
   * Update a model using the V1 (legacy) API.
   * Routes to the category-specific endpoint based on the category.
   */
  private updateViaV1Api(
    category: string,
    modelName: string,
    modelData: Partial<LegacyRecordUnion>,
  ): Observable<PendingChangeRecord> {
    const payload: Record<string, unknown> & { name: string } = { ...modelData, name: modelName };

    const svc = this.v1CreateUpdateService;
    const categoryMethodMap: Record<string, () => Observable<unknown>> = {
      blip: () => svc.updateLegacyBlipModel(payload as LegacyBlipRecordInput),
      clip: () => svc.updateLegacyClipModel(payload as LegacyClipRecordInput),
      codeformer: () => svc.updateLegacyCodeformerModel(payload as LegacyCodeformerRecordInput),
      controlnet: () => svc.updateLegacyControlnetModel(payload as LegacyControlnetRecordInput),
      esrgan: () => svc.updateLegacyEsrganModel(payload as LegacyEsrganRecordInput),
      gfpgan: () => svc.updateLegacyGfpganModel(payload as LegacyGfpganRecordInput),
      image_generation: () => svc.updateLegacyModel(payload as LegacyStableDiffusionRecordInput),
      miscellaneous: () =>
        svc.updateLegacyMiscellaneousModel(payload as LegacyMiscellaneousRecordInput),
      safety_checker: () =>
        svc.updateLegacySafetyCheckerModel(payload as LegacySafetyCheckerRecordInput),
      text_generation: () =>
        svc.updateLegacyTextGenerationModel(payload as LegacyTextGenerationRecordInput),
    };

    const updateFn = categoryMethodMap[category];
    if (!updateFn) {
      return throwError(() => new Error(`Unknown category: ${category}`));
    }

    return updateFn().pipe(
      map((response) => response as PendingChangeRecord),
      catchError(this.handleError),
    );
  }

  /**
   * Update a model using the V2 API.
   * Accepts a pre-built NewModelRecord payload (no legacy-to-V2 conversion here).
   */
  private updateViaV2Api(
    category: string,
    modelName: string,
    payload: NewModelRecord,
  ): Observable<PendingChangeRecord> {
    return this.v2Service
      .updateV2Model(category as MODEL_REFERENCE_CATEGORY, modelName, payload)
      .pipe(catchError(this.handleError));
  }

  /**
   * Get models with Horde statistics including optional backend variations.
   *
   * @param category The category to get statistics for
   * @param includeBackendVariations Whether to include per-backend stats for text models
   * @returns Observable of BackendStatisticsResponse or null on error
   */
  getModelsWithStats(
    category: string,
    includeBackendVariations = false,
  ): Observable<BackendStatisticsResponse | null> {
    return this.statisticsService
      .readModelsWithStats(
        category as MODEL_REFERENCE_CATEGORY,
        false, // include_workers
        includeBackendVariations,
      )
      .pipe(
        map((response) => response as BackendStatisticsResponse),
        catchError((error: HttpErrorResponse) => {
          console.warn('Failed to fetch models with stats:', error);
          return of(null);
        }),
      );
  }

  /**
   * Get category-level statistics from backend
   *
   * @param category The category to get statistics for
   * @param groupTextModels Whether to group text models by base name (strips quantization)
   * @returns Observable of CategoryStatistics or null on error
   */
  getCategoryStatistics(
    category: string,
    groupTextModels = false,
  ): Observable<CategoryStatistics | null> {
    return this.statisticsService
      .readV2CategoryStatistics(category as MODEL_REFERENCE_CATEGORY, groupTextModels, undefined, 0)
      .pipe(
        catchError((error: HttpErrorResponse) => {
          console.warn('Failed to fetch category statistics:', error);
          return of(null);
        }),
      );
  }

  /**
   * Get category-level audit analysis from backend
   *
   * @param category The category to audit
   * @param groupTextModels Whether to group text models by base name (strips quantization)
   * @param preset Optional preset filter to apply (deletion_candidates, zero_usage, etc.)
   * @param includeBackendVariations Whether to include per-backend breakdown for text models (ungrouped view)
   * @returns Observable of CategoryDeletionRiskResponse or null on error
   */
  getCategoryAudit(
    category: string,
    groupTextModels = false,
    preset?: string,
    includeBackendVariations = false,
  ): Observable<CategoryDeletionRiskResponse | null> {
    return this.deletionRiskService
      .readV2CategoryDeletionRisk(
        category as MODEL_REFERENCE_CATEGORY,
        groupTextModels,
        includeBackendVariations,
        preset,
        undefined,
        0,
      )
      .pipe(
        catchError((error: HttpErrorResponse) => {
          console.warn('Failed to fetch category audit:', error);
          return of(null);
        }),
      );
  }

  private handleError = (error: HttpErrorResponse): Observable<never> => {
    let errorMessage = 'An unknown error occurred';

    if (error.error instanceof ErrorEvent) {
      errorMessage = `Error: ${error.error.message}`;
    } else {
      switch (error.status) {
        case 400:
          errorMessage = `Bad Request: ${error.error?.detail || 'Invalid request format'}`;
          break;
        case 404:
          errorMessage = `Not Found: ${error.error?.detail || 'Resource not found'}`;
          break;
        case 409:
          errorMessage = `Conflict: ${error.error?.detail || 'Resource already exists'}`;
          break;
        case 422: {
          // Handle validation errors from FastAPI
          const validationError = error.error as HTTPValidationError;
          if (validationError?.detail && Array.isArray(validationError.detail)) {
            // Map errors to fields and format for display
            this.validationService.mapServerErrors(validationError);
            errorMessage = `Validation Error: ${this.validationService.formatServerErrors(validationError)}`;
            // Show persistent notification for validation errors
            this.notifications.error(errorMessage, { persistent: true });
            return throwError(() => new Error(errorMessage));
          }
          errorMessage = `Validation Error: ${error.error?.detail || 'Invalid data'}`;
          break;
        }
        case 503:
          errorMessage = `Service Unavailable: ${error.error?.detail || 'Backend does not support this operation'}`;
          break;
        default:
          errorMessage = `Error ${error.status}: ${error.error?.detail || error.message}`;
      }
    }

    return throwError(() => new Error(errorMessage));
  };

}
