import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { catchError, map, Observable, of, tap, throwError } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  ApiInfoResponse,
  BackendCapabilities,
  CategoryModelsResponse,
  ModelRecord,
  LegacyRecordUnion,
  LegacyModelsResponse,
  ModelReferenceCategory,
} from '../models/api.models';

@Injectable({
  providedIn: 'root',
})
export class ModelReferenceApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiBaseUrl;

  readonly backendCapabilities = signal<BackendCapabilities>({
    writable: false,
    mode: 'UNKNOWN',
    canonicalFormat: 'UNKNOWN',
  });

  detectBackendCapabilities(): Observable<BackendCapabilities> {
    return this.http.get<ApiInfoResponse>(`${this.baseUrl}/info`).pipe(
      map((response) => {
        const message = response.message.toLowerCase();
        const isLegacy = message.includes('legacy');
        const isPrimary = message.includes('primary');

        const capabilities: BackendCapabilities = {
          writable: isLegacy && isPrimary,
          mode: isPrimary ? 'PRIMARY' : 'REPLICA',
          canonicalFormat: isLegacy ? 'legacy' : 'v2',
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
      })
    );
  }

  getCategories(): Observable<string[]> {
    return this.http
      .get<string[]>(`${this.baseUrl}/model_categories`)
      .pipe(catchError(this.handleError));
  }

  getModelsInCategory(category: string): Observable<CategoryModelsResponse> {
    return this.http
      .get<CategoryModelsResponse>(`${this.baseUrl}/${category}`)
      .pipe(catchError(this.handleError));
  }

  getLegacyModelsInCategory(category: string): Observable<LegacyModelsResponse> {
    return this.http
      .get<LegacyModelsResponse>(`${this.baseUrl}/${category}`)
      .pipe(catchError(this.handleError));
  }

  getLegacyModelsAsArray(category: string): Observable<LegacyRecordUnion[]> {
    return this.getLegacyModelsInCategory(category).pipe(
      map((response) =>
        Object.entries(response).map(([name, data]) => ({
          ...data,
          name,
        }))
      )
    );
  }

  createModel(
    category: string,
    modelName: string,
    modelData: ModelRecord
  ): Observable<ModelRecord> {
    if (!this.backendCapabilities().writable) {
      return throwError(
        () =>
          new Error(
            'Backend does not support write operations (REPLICA mode or wrong format)'
          )
      );
    }

    return this.http
      .post<ModelRecord>(`${this.baseUrl}/${category}/${modelName}`, modelData)
      .pipe(catchError(this.handleError));
  }

  createLegacyModel(
    category: string,
    modelName: string,
    modelData: LegacyRecordUnion
  ): Observable<LegacyRecordUnion> {
    if (!this.backendCapabilities().writable) {
      return throwError(
        () =>
          new Error(
            'Backend does not support write operations (REPLICA mode or wrong format)'
          )
      );
    }

    return this.http
      .post<LegacyRecordUnion>(`${this.baseUrl}/${category}/${modelName}`, modelData)
      .pipe(catchError(this.handleError));
  }

  updateModel(
    category: string,
    modelName: string,
    modelData: ModelRecord
  ): Observable<ModelRecord> {
    if (!this.backendCapabilities().writable) {
      return throwError(
        () =>
          new Error(
            'Backend does not support write operations (REPLICA mode or wrong format)'
          )
      );
    }

    return this.http
      .put<ModelRecord>(`${this.baseUrl}/${category}/${modelName}`, modelData)
      .pipe(catchError(this.handleError));
  }

  updateLegacyModel(
    category: string,
    modelName: string,
    modelData: Partial<LegacyRecordUnion>
  ): Observable<LegacyRecordUnion> {
    if (!this.backendCapabilities().writable) {
      return throwError(
        () =>
          new Error(
            'Backend does not support write operations (REPLICA mode or wrong format)'
          )
      );
    }

    return this.http
      .put<LegacyRecordUnion>(`${this.baseUrl}/${category}/${modelName}`, modelData)
      .pipe(catchError(this.handleError));
  }

  deleteModel(category: string, modelName: string): Observable<void> {
    if (!this.backendCapabilities().writable) {
      return throwError(
        () =>
          new Error(
            'Backend does not support write operations (REPLICA mode or wrong format)'
          )
      );
    }

    return this.http
      .delete<void>(`${this.baseUrl}/${category}/${modelName}`)
      .pipe(catchError(this.handleError));
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
