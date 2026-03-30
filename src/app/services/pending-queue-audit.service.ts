import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { BASE_PATH, CanonicalFormat } from '../api-client';
import type { BatchNetChangeResponse } from '../api-client/model/models';
import {
  AuditDomain,
  PendingQueueAuditBatchDetail,
  PendingQueueAuditBatchPage,
  PendingQueueAuditBatchSummary,
  PendingQueueAuditCurrentResponse,
  PendingQueueAuditDetailOptions,
  PendingQueueAuditListOptions,
} from '../models/pending-queue-audit';
import { NotificationService } from './notification.service';

export class AuditDisabledError extends Error {
  constructor(
    message = 'Audit trail is disabled on this deployment. Enable it to view pending data.',
  ) {
    super(message);
    this.name = 'AuditDisabledError';
  }
}

@Injectable({
  providedIn: 'root',
})
export class PendingQueueAuditService {
  private readonly http = inject(HttpClient);
  private readonly basePath = (inject(BASE_PATH) ?? '').replace(/\/*$/, '');
  private readonly notifications = inject(NotificationService);

  private readonly detailCache = new Map<string, PendingQueueAuditBatchDetail>();
  private readonly netChangesCache = new Map<string, BatchNetChangeResponse>();
  private readonly auditRoutePrefix = '/model_references/v2/pending_queue/audit';

  private get auditBaseUrl(): string {
    return `${this.basePath}${this.auditRoutePrefix}`;
  }

  getCurrent(domain?: AuditDomain | null): Observable<PendingQueueAuditCurrentResponse> {
    const params = this.buildParams({ domain });
    return this.http
      .get<PendingQueueAuditCurrentResponse>(`${this.auditBaseUrl}/current`, { params })
      .pipe(catchError((error) => this.handleError(error, 'Unable to load pending changes.')));
  }

  listBatches(options: PendingQueueAuditListOptions = {}): Observable<PendingQueueAuditBatchPage> {
    const params = this.buildParams(options);
    return this.http
      .get<PendingQueueAuditBatchPage>(`${this.auditBaseUrl}/batches`, { params })
      .pipe(catchError((error) => this.handleError(error, 'Unable to load audit batches.')));
  }

  getBatchDetail(
    batchId: number,
    options: PendingQueueAuditDetailOptions = {},
  ): Observable<PendingQueueAuditBatchDetail> {
    if (!Number.isFinite(batchId)) {
      return throwError(() => new Error('A valid batch id is required.'));
    }

    const cacheKey = this.buildCacheKey(batchId, options.domain);
    const existing = this.detailCache.get(cacheKey);
    if (existing && !options.forceRefresh) {
      return of(existing);
    }

    const params = this.buildParams({ domain: options.domain ?? null });
    return this.http
      .get<PendingQueueAuditBatchDetail>(`${this.auditBaseUrl}/batches/${batchId}`, { params })
      .pipe(
        tap((detail) => this.detailCache.set(cacheKey, detail)),
        catchError((error) => this.handleError(error, 'Unable to load batch details.')),
      );
  }

  getBatchNetChanges(
    batchId: number,
    options: PendingQueueAuditDetailOptions = {},
  ): Observable<BatchNetChangeResponse> {
    if (!Number.isFinite(batchId)) {
      return throwError(() => new Error('A valid batch id is required.'));
    }

    const cacheKey = this.buildCacheKey(batchId, options.domain);
    const existing = this.netChangesCache.get(cacheKey);
    if (existing && !options.forceRefresh) {
      return of(existing);
    }

    const params = this.buildParams({ domain: options.domain ?? null });
    return this.http
      .get<BatchNetChangeResponse>(`${this.auditBaseUrl}/batches/${batchId}/net_changes`, {
        params,
      })
      .pipe(
        tap((netChanges) => this.netChangesCache.set(cacheKey, netChanges)),
        catchError((error) => this.handleError(error, 'Unable to compute batch net changes.')),
      );
  }

  clearDetailCache(): void {
    this.detailCache.clear();
    this.netChangesCache.clear();
  }

  updateCacheFromPage(page: PendingQueueAuditBatchPage, domain?: AuditDomain | null): void {
    page.batches.forEach((summary: PendingQueueAuditBatchSummary) => {
      const domainValue = domain ?? (page.domain === 'LEGACY' ? 'legacy' : page.domain);
      const cacheKey = this.buildCacheKey(summary.batch_id, domainValue as AuditDomain);
      const cached = this.detailCache.get(cacheKey);
      if (cached) {
        this.detailCache.set(cacheKey, { ...cached, ...summary });
      }
    });
  }

  private buildCacheKey(batchId: number, domain?: AuditDomain | null): string {
    const domainKey = domain ?? 'canonical';
    return `${domainKey}:${batchId}`;
  }

  private buildParams({ domain, cursor, limit }: PendingQueueAuditListOptions): HttpParams {
    let params = new HttpParams();

    if (domain) {
      // Map internal lowercase 'legacy' to API's uppercase 'LEGACY'
      const apiDomain = domain === 'legacy' ? CanonicalFormat.Legacy : CanonicalFormat.V2;
      params = params.set('domain_override', apiDomain);
    }

    if (cursor && cursor > 0) {
      params = params.set('cursor', cursor.toString());
    }

    if (limit && limit > 0) {
      params = params.set('limit', limit.toString());
    }

    return params;
  }

  private handleError(error: HttpErrorResponse, fallback: string): Observable<never> {
    if (error.status === 503) {
      const auditError = new AuditDisabledError();
      this.notifications.warning(auditError.message);
      return throwError(() => auditError);
    }

    if (error.status === 404) {
      return throwError(() => new Error('Requested audit resource was not found.'));
    }

    if (error.status >= 500) {
      this.notifications.error('Audit service is unavailable. Please try again later.');
      return throwError(() => new Error('Audit service unavailable.'));
    }

    return throwError(() => new Error(fallback));
  }
}
