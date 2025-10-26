import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable, catchError, of, tap } from 'rxjs';
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

  readonly isLoading = signal(false);

  getModelStatus(
    type: HordeModelType,
    minCount?: number,
    modelState: HordeModelState = 'known'
  ): Observable<HordeModelStatus[]> {
    this.isLoading.set(true);

    let params = new HttpParams()
      .set('type', type)
      .set('model_state', modelState);

    if (minCount !== undefined) {
      params = params.set('min_count', minCount.toString());
    }

    return this.http
      .get<HordeModelStatus[]>(`${this.baseUrl}/status/models`, { params })
      .pipe(
        tap(() => this.isLoading.set(false)),
        catchError((error) => {
          this.isLoading.set(false);
          this.notificationService.error(
            `Failed to fetch Horde model status: ${error.message}`
          );
          return of([]);
        })
      );
  }

  getModelStats(
    type: HordeModelType,
    modelState: HordeModelState = 'known'
  ): Observable<HordeModelStatsResponse> {
    this.isLoading.set(true);

    const endpoint =
      type === 'image' ? 'stats/img/models' : 'stats/text/models';
    const params = new HttpParams().set('model_state', modelState);

    return this.http
      .get<HordeModelStatsResponse>(`${this.baseUrl}/${endpoint}`, { params })
      .pipe(
        tap(() => this.isLoading.set(false)),
        catchError((error) => {
          this.isLoading.set(false);
          this.notificationService.error(
            `Failed to fetch Horde model stats: ${error.message}`
          );
          return of({ day: {}, month: {}, total: {} });
        })
      );
  }

  getTotalStats(type: HordeModelType): Observable<HordeTotalStatsResponse> {
    this.isLoading.set(true);

    const endpoint = type === 'image' ? 'stats/img/totals' : 'stats/text/totals';

    return this.http
      .get<HordeTotalStatsResponse>(`${this.baseUrl}/${endpoint}`)
      .pipe(
        tap(() => this.isLoading.set(false)),
        catchError((error) => {
          this.isLoading.set(false);
          this.notificationService.error(
            `Failed to fetch Horde total stats: ${error.message}`
          );
          return of({
            minute: {},
            hour: {},
            day: {},
            month: {},
            total: {},
          });
        })
      );
  }

  getCombinedModelData(
    type: HordeModelType,
    minCount?: number
  ): Observable<{
    status: HordeModelStatus[];
    stats: HordeModelStatsResponse;
  }> {
    this.isLoading.set(true);

    return new Observable((observer) => {
      let status: HordeModelStatus[] = [];
      let stats: HordeModelStatsResponse = { day: {}, month: {}, total: {} };
      let completedCalls = 0;

      const checkComplete = () => {
        completedCalls++;
        if (completedCalls === 2) {
          this.isLoading.set(false);
          observer.next({ status, stats });
          observer.complete();
        }
      };

      this.getModelStatus(type, minCount).subscribe({
        next: (data) => {
          status = data;
          checkComplete();
        },
        error: () => checkComplete(),
      });

      this.getModelStats(type).subscribe({
        next: (data) => {
          stats = data;
          checkComplete();
        },
        error: () => checkComplete(),
      });
    });
  }

  getWorkers(options?: {
    name?: string;
    type?: HordeModelType;
  }): Observable<HordeWorker[]> {
    this.isLoading.set(true);

    let params = new HttpParams();

    if (options?.name) {
      params = params.set('name', options.name);
    }

    if (options?.type) {
      params = params.set('type', options.type);
    }

    return this.http
      .get<HordeWorker[]>(`${this.baseUrl}/workers`, { params })
      .pipe(
        tap(() => this.isLoading.set(false)),
        catchError((error) => {
          this.isLoading.set(false);
          this.notificationService.error(
            `Failed to fetch Horde workers: ${error.message}`
          );
          return of([]);
        })
      );
  }
}
