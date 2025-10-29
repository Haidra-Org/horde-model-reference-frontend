import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, catchError, defer, finalize, forkJoin, of, tap } from 'rxjs';
import {
  HordeModelState,
  HordeModelStatsResponse,
  HordeModelStatus,
  HordeModelType,
  HordeTotalStatsResponse,
  HordeWorker,
} from '../models/horde-api.models';
import { NotificationService } from './notification.service';

@Injectable({
  providedIn: 'root',
})
export class HordeApiService {
  private readonly http = inject(HttpClient);
  private readonly notificationService = inject(NotificationService);

  private readonly baseUrl = 'https://aihorde.net/api/v2';

  private readonly pendingRequests = signal(0);
  readonly isLoading = computed(() => this.pendingRequests() > 0);

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

  getCombinedModelData(
    type: HordeModelType,
    minCount?: number,
  ): Observable<{
    status: HordeModelStatus[];
    stats: HordeModelStatsResponse;
  }> {
    return this.trackLoading(
      forkJoin({
        status: this.fetchModelStatus(type, minCount, 'known'),
        stats: this.fetchModelStats(type, 'known'),
      }),
    );
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
