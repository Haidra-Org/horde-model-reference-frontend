import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, catchError, defer, finalize, of, tap } from 'rxjs';
import {
  HordeModelState,
  HordeModelStatsResponse,
  HordeModelStatus,
  HordeModelType,
  HordeTotalStatsResponse,
  HordeWorker,
} from '../models/horde-api.models';
import { NotificationService } from './notification.service';
import { environment } from '../../environments/environment';
import type { BackendStatisticsResponse } from '../models/api.models';

// Re-export backend statistics types from canonical location
export type {
  BackendCombinedModelStatistics,
  BackendStatisticsResponse,
  BackendVariation,
  HordeWorkerSummary,
  HordeModelUsageStats as BackendUsageStats,
} from '../models/api.models';

export type HordeStatsState = 'idle' | 'loading' | 'success' | 'error';

@Injectable({
  providedIn: 'root',
})
export class HordeApiService {
  private readonly http = inject(HttpClient);
  private readonly notificationService = inject(NotificationService);

  private readonly baseUrl = 'https://aihorde.net/api/v2';

  private readonly pendingRequests = signal(0);
  readonly isLoading = computed(() => this.pendingRequests() > 0);

  private readonly statsLoadState = signal<HordeStatsState>('idle');
  readonly hordeStatsState = this.statsLoadState.asReadonly();

  resetStatsState(): void {
    this.statsLoadState.set('idle');
  }

  getModelStatus(
    type: HordeModelType,
    minCount?: number,
    modelState: HordeModelState = 'known',
  ): Observable<HordeModelStatus[]> {
    return this.trackLoading(this.fetchModelStatus(type, minCount, modelState));
  }

  getModelStats(
    type: HordeModelType,
    modelState: HordeModelState = 'known',
  ): Observable<HordeModelStatsResponse> {
    return this.trackLoading(this.fetchModelStats(type, modelState));
  }

  getTotalStats(type: HordeModelType): Observable<HordeTotalStatsResponse> {
    return this.trackLoading(
      this.http
        .get<HordeTotalStatsResponse>(`${this.baseUrl}/${this.getTotalsEndpoint(type)}`)
        .pipe(
          catchError((error) => {
            this.notificationService.error(
              `Failed to fetch Horde total stats: ${this.getErrorMessage(error)}`,
            );
            return of({
              minute: {},
              hour: {},
              day: {},
              month: {},
              total: {},
            });
          }),
        ),
    );
  }

  /**
   * Get combined model data with statistics from the backend service.
   * This replaces direct aihorde.net API calls with backend-aggregated statistics.
   *
   * @param type The model type (image or text)
   * @param minCount Optional minimum worker count filter
   * @param includeBackendVariations Include per-backend statistics for text models (default: true for text, false for image)
   * @returns Observable of backend statistics response
   */
  getCombinedModelData(
    type: HordeModelType,
    minCount?: number,
    includeBackendVariations?: boolean,
  ): Observable<BackendStatisticsResponse> {
    const category = type === 'image' ? 'image_generation' : 'text_generation';
    let params = new HttpParams();

    if (minCount !== undefined) {
      params = params.set('min_worker_count', minCount.toString());
    }

    // Default to including backend variations for text models
    const shouldIncludeVariations = includeBackendVariations ?? type === 'text';
    if (shouldIncludeVariations) {
      params = params.set('include_backend_variations', 'true');
    }

    this.statsLoadState.set('loading');

    return this.trackLoading(
      this.http
        .get<BackendStatisticsResponse>(
          `${environment.apiBaseUrl}/model_references/statistics/${category}/with-stats`,
          { params },
        )
        .pipe(
          tap((response) => {
            this.checkStatsStaleness(response);
            this.statsLoadState.set('success');
          }),
          catchError((error) => {
            this.statsLoadState.set('error');
            this.notificationService.error(
              `Failed to fetch model statistics from backend: ${this.getErrorMessage(error)}`,
            );
            return of({} as BackendStatisticsResponse);
          }),
        ),
    );
  }

  /**
   * Check if statistics data appears stale and log warnings.
   * Backend statistics are cached with 60s TTL, but if data seems older,
   * it might indicate backend caching issues or stale Horde API data.
   */
  private checkStatsStaleness(response: BackendStatisticsResponse): void {
    // For now, we don't have timestamps in the response
    // This is a placeholder for future staleness detection
    // We could add a timestamp field to the backend response in the future
    const modelCount = Object.keys(response).length;
    if (modelCount === 0) {
      console.warn('[HordeApiService] Received empty statistics response from backend');
    }
  }

  getWorkers(options?: { name?: string; type?: HordeModelType }): Observable<HordeWorker[]> {
    return this.trackLoading(
      this.http
        .get<HordeWorker[]>(`${this.baseUrl}/workers`, {
          params: this.buildWorkerParams(options),
        })
        .pipe(
          catchError((error) => {
            this.notificationService.error(
              `Failed to fetch Horde workers: ${this.getErrorMessage(error)}`,
            );
            return of([]);
          }),
        ),
    );
  }

  /**
   * @deprecated Use getCombinedModelData instead
   * Fetches model status directly from aihorde.net (legacy method)
   */
  private fetchModelStatus(
    type: HordeModelType,
    minCount: number | undefined,
    modelState: HordeModelState,
  ): Observable<HordeModelStatus[]> {
    let params = new HttpParams().set('type', type).set('model_state', modelState);

    if (minCount !== undefined) {
      params = params.set('min_count', minCount.toString());
    }

    return this.http.get<HordeModelStatus[]>(`${this.baseUrl}/status/models`, { params }).pipe(
      catchError((error) => {
        this.notificationService.error(
          `Failed to fetch Horde model status: ${this.getErrorMessage(error)}`,
        );
        return of([]);
      }),
    );
  }

  /**
   * @deprecated Use getCombinedModelData instead
   * Fetches model stats directly from aihorde.net (legacy method)
   */
  private fetchModelStats(
    type: HordeModelType,
    modelState: HordeModelState,
  ): Observable<HordeModelStatsResponse> {
    const params = new HttpParams().set('model_state', modelState);

    return this.http
      .get<HordeModelStatsResponse>(`${this.baseUrl}/${this.getStatsEndpoint(type)}`, {
        params,
      })
      .pipe(
        catchError((error) => {
          this.notificationService.error(
            `Failed to fetch Horde model stats: ${this.getErrorMessage(error)}`,
          );
          return of(this.createEmptyStats());
        }),
      );
  }

  private trackLoading<T>(source$: Observable<T>): Observable<T> {
    return defer(() => {
      this.pendingRequests.update((count) => count + 1);
      let settled = false;

      const settle = () => {
        if (!settled) {
          this.pendingRequests.update((count) => Math.max(0, count - 1));
          settled = true;
        }
      };

      return source$.pipe(
        tap({
          next: settle,
          error: settle,
          complete: settle,
        }),
        finalize(settle),
      );
    });
  }

  private getStatsEndpoint(type: HordeModelType): string {
    return type === 'image' ? 'stats/img/models' : 'stats/text/models';
  }

  private getTotalsEndpoint(type: HordeModelType): string {
    return type === 'image' ? 'stats/img/totals' : 'stats/text/totals';
  }

  private createEmptyStats(): HordeModelStatsResponse {
    return { day: {}, month: {}, total: {} };
  }

  private getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    if (typeof error === 'string') {
      return error;
    }
    return 'Unknown error';
  }

  private buildWorkerParams(options?: { name?: string; type?: HordeModelType }): HttpParams {
    let params = new HttpParams();

    if (options?.name) {
      params = params.set('name', options.name);
    }

    if (options?.type) {
      params = params.set('type', options.type);
    }

    return params;
  }
}
