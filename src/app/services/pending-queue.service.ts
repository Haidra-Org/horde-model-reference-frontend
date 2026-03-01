import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { BASE_PATH, HTTPValidationError } from '../api-client';
import type {
  ApplyPendingChangesResponse,
  AuditOperation,
  MODEL_REFERENCE_CATEGORY,
  PendingBatchResult,
  PendingChangeDiff,
  PendingChangeRecord,
  PendingChangeStatus,
  PendingQueuePage,
} from '../api-client/model/models';
import { ModelValidationService } from './model-validation.service';
import { NotificationService } from './notification.service';

export interface PendingQueueListOptions {
  statuses?: PendingChangeStatus[];
  categories?: MODEL_REFERENCE_CATEGORY[];
  batchId?: number | null;
  modelName?: string | null;
  requestedBy?: string | null;
  offset?: number;
  limit?: number;
}

export interface PendingBatchRequestPayload {
  batch_title: string;
  approved_ids?: number[] | null;
  rejected_ids?: number[] | null;
  reject_reason?: string | null;
}

export interface ApplyManyPayload {
  change_ids: number[];
  job_id?: string | null;
  allow_mixed_batch?: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class PendingQueueService {
  private readonly http = inject(HttpClient);
  private readonly basePath = (inject(BASE_PATH) ?? '').replace(/\/*$/, '');
  private readonly notifications = inject(NotificationService);
  private readonly validationService = inject(ModelValidationService);

  private get queueBaseUrl(): string {
    return `${this.basePath}/model_references/v2/pending_queue`;
  }

  listChanges(options: PendingQueueListOptions = {}): Observable<PendingQueuePage> {
    const params = this.buildListParams(options);
    return this.http.get<PendingQueuePage>(`${this.queueBaseUrl}/changes`, { params }).pipe(
      map((page) => ({
        ...page,
        items: (page.items ?? []).map((item) => this.normalizeChange(item)),
      })),
      catchError((error) => this.handleError(error, 'Unable to load pending changes.')),
    );
  }

  getChange(changeId: number): Observable<PendingChangeRecord> {
    return this.http.get<PendingChangeRecord>(`${this.queueBaseUrl}/changes/${changeId}`).pipe(
      map((change) => this.normalizeChange(change)),
      catchError((error) => this.handleError(error, 'Unable to load pending change.')),
    );
  }

  getChangeDiff(changeId: number): Observable<PendingChangeDiff> {
    return this.http.get<PendingChangeDiff>(`${this.queueBaseUrl}/changes/${changeId}/diff`).pipe(
      catchError((error) => this.handleError(error, 'Unable to load change diff.')),
    );
  }

  getChangeDiffs(changeIds: number[]): Observable<PendingChangeDiff[]> {
    let params = new HttpParams();
    for (const id of changeIds) {
      params = params.append('change_ids', id);
    }
    return this.http
      .get<{ diffs?: PendingChangeDiff[]; errors?: unknown[] }>(
        `${this.queueBaseUrl}/changes/diff`,
        { params },
      )
      .pipe(
        map((response) => response.diffs ?? []),
        catchError((error) => this.handleError(error, 'Unable to load change diffs.')),
      );
  }

  processBatch(payload: PendingBatchRequestPayload): Observable<PendingBatchResult> {
    return this.http.post<PendingBatchResult>(`${this.queueBaseUrl}/batches`, payload).pipe(
      map((result) => ({
        ...result,
        approved: (result.approved ?? []).map((change) => this.normalizeChange(change)),
        rejected: (result.rejected ?? []).map((change) => this.normalizeChange(change)),
      })),
      catchError((error) => this.handleError(error, 'Unable to process batch.')),
    );
  }

  applyChange(changeId: number, jobId?: string | null): Observable<PendingChangeRecord> {
    const body = jobId ? { job_id: jobId } : {};
    return this.http
      .post<PendingChangeRecord>(`${this.queueBaseUrl}/changes/${changeId}/apply`, body)
      .pipe(
        map((change) => this.normalizeChange(change)),
        catchError((error) => this.handleError(error, 'Unable to apply change.')),
      );
  }

  applyChanges(payload: ApplyManyPayload): Observable<ApplyPendingChangesResponse> {
    return this.http.post<ApplyPendingChangesResponse>(`${this.queueBaseUrl}/apply`, payload).pipe(
      map((response) => this.normalizeApplyResponse(response)),
      catchError((error) => this.handleError(error, 'Unable to apply changes.')),
    );
  }

  applyBatch(batchId: number, jobId?: string | null): Observable<ApplyPendingChangesResponse> {
    const params = jobId ? { job_id: jobId } : undefined;
    return this.http
      .post<ApplyPendingChangesResponse>(`${this.queueBaseUrl}/apply_batch/${batchId}`, undefined, {
        params,
      })
      .pipe(
        map((response) => this.normalizeApplyResponse(response)),
        catchError((error) => this.handleError(error, 'Unable to apply batch.')),
      );
  }

  private buildListParams(options: PendingQueueListOptions): HttpParams {
    let params = new HttpParams();

    if (options.statuses?.length) {
      options.statuses.forEach((status) => {
        params = params.append('statuses', status as unknown as string);
      });
    }

    if (options.categories?.length) {
      options.categories.forEach((category) => {
        params = params.append('categories', String(category));
      });
    }

    if (options.batchId && options.batchId > 0) {
      params = params.set('batch_id', options.batchId);
    }

    if (options.modelName?.trim()) {
      params = params.set('model_name', options.modelName.trim());
    }

    if (options.requestedBy?.trim()) {
      params = params.set('requested_by', options.requestedBy.trim());
    }

    if (options.offset && options.offset > 0) {
      params = params.set('offset', options.offset);
    }

    if (options.limit && options.limit > 0) {
      params = params.set('limit', options.limit);
    }

    return params;
  }

  private normalizeApplyResponse(
    response: ApplyPendingChangesResponse,
  ): ApplyPendingChangesResponse {
    return {
      ...response,
      applied: (response.applied ?? []).map((change) => this.normalizeChange(change)),
    };
  }

  private normalizeChange(change: PendingChangeRecord): PendingChangeRecord {
    return {
      ...change,
      status: this.normalizeStatus(change.status),
      operation: this.normalizeOperation(change.operation),
    };
  }

  private normalizeStatus(status: PendingChangeStatus | null | undefined): PendingChangeStatus {
    const normalized = (status ?? 'pending').toString().trim().toLowerCase();
    const allowed: PendingChangeStatus[] = ['pending', 'approved', 'rejected', 'applied'];
    return allowed.includes(normalized as PendingChangeStatus)
      ? (normalized as PendingChangeStatus)
      : 'pending';
  }

  private normalizeOperation(operation: AuditOperation | null | undefined): AuditOperation {
    const normalized = (operation ?? 'update').toString().trim().toLowerCase();
    const allowed: AuditOperation[] = ['create', 'update', 'delete'];
    return allowed.includes(normalized as AuditOperation)
      ? (normalized as AuditOperation)
      : 'update';
  }

  private handleError(error: HttpErrorResponse, fallback: string): Observable<never> {
    if (error.status === 401) {
      this.notifications.warning('You are not on the pending queue approver list.');
      return throwError(() => new Error('Unauthorized.'));
    }

    if (error.status === 404) {
      return throwError(() => new Error('Requested pending queue resource was not found.'));
    }

    if (error.status === 422) {
      // Handle validation errors from FastAPI
      const validationError = error.error as HTTPValidationError;
      if (validationError?.detail && Array.isArray(validationError.detail)) {
        // Map errors to fields and format for display
        this.validationService.mapServerErrors(validationError);
        const errorMessage = `Validation Error: ${this.validationService.formatServerErrors(validationError)}`;
        // Show persistent notification for validation errors
        this.notifications.error(errorMessage, { persistent: true });
        return throwError(() => new Error(errorMessage));
      }
      this.notifications.error('Validation Error: Invalid data', { persistent: true });
      return throwError(() => new Error('Validation error.'));
    }

    if (error.status === 503) {
      this.notifications.warning('Pending queue is disabled on this deployment.');
      return throwError(() => new Error('Pending queue unavailable.'));
    }

    if (error.status >= 500) {
      this.notifications.error('Pending queue service is unavailable. Please try again later.');
      return throwError(() => new Error('Service unavailable.'));
    }

    return throwError(() => new Error(fallback));
  }
}
