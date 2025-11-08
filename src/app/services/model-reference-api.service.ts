import { HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { catchError, map, Observable, of, tap, throwError } from 'rxjs';
import {
  DefaultService,
  V1Service,
  V2Service,
  V1CreateUpdateService,
  StatisticsService,
  AuditService,
  MODEL_REFERENCE_CATEGORY,
  ReplicateMode,
  ResponseReadV2ReferenceValue,
  LegacyStableDiffusionRecordInput,
  LegacyTextGenerationRecordInput,
  LegacyClipRecordInput,
  LegacyBlipRecordInput,
  LegacyControlnetRecordInput,
  LegacyEsrganRecordInput,
  LegacyGfpganRecordInput,
  LegacyCodeformerRecordInput,
  LegacySafetyCheckerRecordInput,
  LegacyMiscellaneousRecordInput,
  LegacyBlipRecordOutput,
  LegacyClipRecordOutput,
  LegacyCodeformerRecordOutput,
  LegacyControlnetRecordOutput,
  LegacyEsrganRecordOutput,
  LegacyGfpganRecordOutput,
  LegacyMiscellaneousRecordOutput,
  LegacySafetyCheckerRecordOutput,
  LegacyTextGenerationRecordOutput,
  CategoryStatistics,
  CategoryAuditResponse,
} from '../api-client';
import { BackendCapabilities, LegacyModelsResponse, LegacyRecordUnion } from '../models/api.models';

type LegacyRecordInputUnion =
  | LegacyStableDiffusionRecordInput
  | LegacyTextGenerationRecordInput
  | LegacyClipRecordInput
  | LegacyBlipRecordInput
  | LegacyControlnetRecordInput
  | LegacyEsrganRecordInput
  | LegacyGfpganRecordInput
  | LegacyCodeformerRecordInput
  | LegacySafetyCheckerRecordInput
  | LegacyMiscellaneousRecordInput;

type LegacyRecordOutputUnion =
  | LegacyBlipRecordOutput
  | LegacyClipRecordOutput
  | LegacyCodeformerRecordOutput
  | LegacyControlnetRecordOutput
  | LegacyEsrganRecordOutput
  | LegacyGfpganRecordOutput
  | LegacyMiscellaneousRecordOutput
  | LegacySafetyCheckerRecordOutput
  | LegacyTextGenerationRecordOutput
  | Record<string, unknown>;

@Injectable({
  providedIn: 'root',
})
export class ModelReferenceApiService {
  private readonly defaultService = inject(DefaultService);
  private readonly legacyService = inject(V1Service);
  private readonly v2Service = inject(V2Service);
  private readonly v1CreateUpdateService = inject(V1CreateUpdateService);
  private readonly statisticsService = inject(StatisticsService);
  private readonly auditService = inject(AuditService);

  readonly backendCapabilities = signal<BackendCapabilities>({
    writable: false,
    mode: 'UNKNOWN',
    canonicalFormat: 'UNKNOWN',
  });

  detectBackendCapabilities(): Observable<BackendCapabilities> {
    return this.defaultService.replicateModeReplicateModeGet().pipe(
      map((mode: ReplicateMode) => {
        const isPrimary = mode === ReplicateMode.Primary;
        const capabilities: BackendCapabilities = {
          writable: isPrimary,
          mode: isPrimary ? 'PRIMARY' : 'REPLICA',
          canonicalFormat: 'legacy',
        };

        return capabilities;
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

  createLegacyModel(
    category: string,
    modelName: string,
    modelData: LegacyRecordInputUnion,
  ): Observable<LegacyRecordOutputUnion> {
    if (!this.backendCapabilities().writable) {
      return throwError(
        () => new Error('Backend does not support write operations (REPLICA mode or wrong format)'),
      );
    }

    const basePayload = {
      ...modelData,
      name: modelData.name ?? modelName,
    };

    let createObservable: Observable<LegacyRecordOutputUnion>;

    switch (category) {
      case 'image_generation':
        createObservable = this.v1CreateUpdateService.createLegacyImageGenerationModel(
          basePayload as LegacyStableDiffusionRecordInput,
        );
        break;
      case 'text_generation':
        createObservable = this.v1CreateUpdateService.createLegacyTextGenerationModel(
          basePayload as LegacyTextGenerationRecordInput,
        );
        break;
      case 'clip':
        createObservable = this.v1CreateUpdateService.createLegacyClipModel(
          basePayload as LegacyClipRecordInput,
        );
        break;
      case 'controlnet':
        createObservable = this.v1CreateUpdateService.createLegacyControlnetModel(
          basePayload as LegacyControlnetRecordInput,
        );
        break;
      case 'blip':
        createObservable = this.v1CreateUpdateService.createLegacyBlipModel(
          basePayload as LegacyBlipRecordInput,
        );
        break;
      case 'esrgan':
        createObservable = this.v1CreateUpdateService.createLegacyEsrganModel(
          basePayload as LegacyEsrganRecordInput,
        );
        break;
      case 'gfpgan':
        createObservable = this.v1CreateUpdateService.createLegacyGfpganModel(
          basePayload as LegacyGfpganRecordInput,
        );
        break;
      case 'codeformer':
        createObservable = this.v1CreateUpdateService.createLegacyCodeformerModel(
          basePayload as LegacyCodeformerRecordInput,
        );
        break;
      case 'safety_checker':
        createObservable = this.v1CreateUpdateService.createLegacySafetyCheckerModel(
          basePayload as LegacySafetyCheckerRecordInput,
        );
        break;
      case 'miscellaneous':
        createObservable = this.v1CreateUpdateService.createLegacyMiscellaneousModel(
          basePayload as LegacyMiscellaneousRecordInput,
        );
        break;
      default:
        return throwError(() => new Error(`Unsupported category: ${category}`));
    }

    return createObservable.pipe(
      map((response: LegacyRecordOutputUnion) => ({
        ...response,
        name: response.name ?? modelName,
      })),
      catchError(this.handleError),
    );
  }

  updateLegacyModel(
    category: string,
    modelName: string,
    modelData: Partial<LegacyRecordInputUnion>,
  ): Observable<LegacyRecordOutputUnion> {
    if (!this.backendCapabilities().writable) {
      return throwError(
        () => new Error('Backend does not support write operations (REPLICA mode or wrong format)'),
      );
    }

    const basePayload = {
      ...modelData,
      name: modelName,
    };

    let updateObservable: Observable<LegacyRecordOutputUnion>;

    switch (category) {
      case 'image_generation':
        updateObservable = this.v1CreateUpdateService.updateLegacyModel(
          basePayload as LegacyStableDiffusionRecordInput,
        );
        break;
      case 'text_generation':
        updateObservable = this.v1CreateUpdateService.updateLegacyTextGenerationModel(
          basePayload as LegacyTextGenerationRecordInput,
        );
        break;
      case 'clip':
        updateObservable = this.v1CreateUpdateService.updateLegacyClipModel(
          basePayload as LegacyClipRecordInput,
        );
        break;
      case 'controlnet':
        updateObservable = this.v1CreateUpdateService.updateLegacyControlnetModel(
          basePayload as LegacyControlnetRecordInput,
        );
        break;
      case 'blip':
        updateObservable = this.v1CreateUpdateService.updateLegacyBlipModel(
          basePayload as LegacyBlipRecordInput,
        );
        break;
      case 'esrgan':
        updateObservable = this.v1CreateUpdateService.updateLegacyEsrganModel(
          basePayload as LegacyEsrganRecordInput,
        );
        break;
      case 'gfpgan':
        updateObservable = this.v1CreateUpdateService.updateLegacyGfpganModel(
          basePayload as LegacyGfpganRecordInput,
        );
        break;
      case 'codeformer':
        updateObservable = this.v1CreateUpdateService.updateLegacyCodeformerModel(
          basePayload as LegacyCodeformerRecordInput,
        );
        break;
      case 'safety_checker':
        updateObservable = this.v1CreateUpdateService.updateLegacySafetyCheckerModel(
          basePayload as LegacySafetyCheckerRecordInput,
        );
        break;
      case 'miscellaneous':
        updateObservable = this.v1CreateUpdateService.updateLegacyMiscellaneousModel(
          basePayload as LegacyMiscellaneousRecordInput,
        );
        break;
      default:
        return throwError(() => new Error(`Unsupported category: ${category}`));
    }

    return updateObservable.pipe(
      map((response: LegacyRecordOutputUnion) => ({
        ...response,
        name: response.name ?? modelName,
      })),
      catchError(this.handleError),
    );
  }

  deleteModel(category: string, modelName: string): Observable<void> {
    if (!this.backendCapabilities().writable) {
      return throwError(
        () => new Error('Backend does not support write operations (REPLICA mode or wrong format)'),
      );
    }

    return this.v1CreateUpdateService
      .deleteLegacyModel(category as MODEL_REFERENCE_CATEGORY, modelName)
      .pipe(
        map(() => undefined),
        catchError(this.handleError),
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
   * @returns Observable of CategoryAuditResponse or null on error
   */
  getCategoryAudit(
    category: string,
    groupTextModels = false,
    preset?: string,
  ): Observable<CategoryAuditResponse | null> {
    return this.auditService
      .readV2CategoryAudit(
        category as MODEL_REFERENCE_CATEGORY,
        groupTextModels,
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

  private handleError(error: HttpErrorResponse): Observable<never> {
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
        case 422:
          errorMessage = `Validation Error: ${error.error?.detail || 'Invalid data'}`;
          break;
        case 503:
          errorMessage = `Service Unavailable: ${error.error?.detail || 'Backend does not support this operation'}`;
          break;
        default:
          errorMessage = `Error ${error.status}: ${error.error?.detail || error.message}`;
      }
    }

    return throwError(() => new Error(errorMessage));
  }
}
