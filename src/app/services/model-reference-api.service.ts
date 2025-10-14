import { HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { catchError, map, Observable, of, tap, throwError } from 'rxjs';
import {
  DefaultService,
  ModelReferenceV1Service,
  ModelReferenceV2Service,
  MODEL_REFERENCE_CATEGORY,
  ModelCategoryName,
} from '../api-client';
import {
  BackendCapabilities,
  CategoryModelsResponse,
  LegacyModelsResponse,
  LegacyRecordUnion,
  ModelRecord,
} from '../models/api.models';

@Injectable({
  providedIn: 'root',
})
export class ModelReferenceApiService {
  private readonly defaultService = inject(DefaultService);
  private readonly legacyService = inject(ModelReferenceV1Service);
  private readonly v2Service = inject(ModelReferenceV2Service);

  readonly backendCapabilities = signal<BackendCapabilities>({
    writable: false,
    mode: 'UNKNOWN',
    canonicalFormat: 'UNKNOWN',
  });

  detectBackendCapabilities(): Observable<BackendCapabilities> {
    return this.defaultService.replicateModeReplicateModeGet().pipe(
      map((mode) => {
        const isPrimary = mode === 'PRIMARY';
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
    return this.legacyService.readLegacyReferenceNamesModelReferencesV1ModelCategoriesGet().pipe(
      map((categories) =>
        categories.map((category) =>
          typeof category === 'string' ? category : String(category as unknown),
        ),
      ),
      catchError(this.handleError),
    );
  }

  getModelsInCategory(category: string): Observable<CategoryModelsResponse> {
    return this.v2Service
      .getReferenceByCategoryModelReferencesV2ModelCategoryNameGet(
        category as MODEL_REFERENCE_CATEGORY,
      )
      .pipe(
        map((response) => {
          const result: CategoryModelsResponse = {};
          if (!response) {
            return result;
          }

          Object.entries(response).forEach(([name, data]) => {
            const recordData = (data ?? {}) as ModelRecord;
            const potentialName = recordData.name;
            const recordName = typeof potentialName === 'string' ? potentialName : name;

            result[name] = {
              ...recordData,
              name: recordName,
            } as ModelRecord;
          });

          return result;
        }),
        catchError(this.handleError),
      );
  }

  getLegacyModelsInCategory(category: string): Observable<LegacyModelsResponse> {
    return this.legacyService
      .readLegacyReferenceModelReferencesV1ModelCategoryNameGet(
        category as unknown as ModelCategoryName,
      )
      .pipe(
        map((response) => response as LegacyModelsResponse),
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
    modelData: LegacyRecordUnion,
  ): Observable<LegacyRecordUnion> {
    if (!this.backendCapabilities().writable) {
      return throwError(
        () => new Error('Backend does not support write operations (REPLICA mode or wrong format)'),
      );
    }

    const payload = {
      ...modelData,
      name: modelData.name ?? modelName,
    } as Record<string, unknown>;

    return this.legacyService
      .createLegacyModelModelReferencesV1ModelCategoryNameModelNamePost(
        category as MODEL_REFERENCE_CATEGORY,
        modelName,
        payload,
      )
      .pipe(
        map((response) => ({
          ...(response as LegacyRecordUnion),
          name: (response as LegacyRecordUnion)?.name ?? modelName,
        })),
        catchError(this.handleError),
      );
  }

  updateLegacyModel(
    category: string,
    modelName: string,
    modelData: Partial<LegacyRecordUnion>,
  ): Observable<LegacyRecordUnion> {
    if (!this.backendCapabilities().writable) {
      return throwError(
        () => new Error('Backend does not support write operations (REPLICA mode or wrong format)'),
      );
    }

    const payload = {
      ...modelData,
      name: modelName,
    } as Record<string, unknown>;

    return this.legacyService
      .updateLegacyModelModelReferencesV1ModelCategoryNameModelNamePut(
        category as MODEL_REFERENCE_CATEGORY,
        modelName,
        payload,
      )
      .pipe(
        map((response) => ({
          ...(response as LegacyRecordUnion),
          name: (response as LegacyRecordUnion)?.name ?? modelName,
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

    return this.legacyService
      .deleteLegacyModelModelReferencesV1ModelCategoryNameModelNameDelete(
        category as MODEL_REFERENCE_CATEGORY,
        modelName,
      )
      .pipe(
        map(() => undefined),
        catchError(this.handleError),
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
