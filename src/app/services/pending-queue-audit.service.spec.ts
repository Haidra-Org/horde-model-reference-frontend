import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideHttpClient, withXhr } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { vi } from 'vitest';
import { PendingQueueAuditService, AuditDisabledError } from './pending-queue-audit.service';
import { NotificationService } from './notification.service';
import { BASE_PATH } from '../api-client';
import type {
  PendingQueueAuditBatchDetail,
  PendingQueueAuditBatchPage,
  PendingQueueAuditCurrentResponse,
} from '../models/pending-queue-audit';

describe('PendingQueueAuditService', () => {
  let service: PendingQueueAuditService;
  let httpMock: HttpTestingController;
  let notifications: NotificationService;
  const basePath = 'http://localhost:19800/api';
  const auditBase = `${basePath}/model_references/v2/pending_queue/audit`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(withXhr()),
        provideHttpClientTesting(),
        PendingQueueAuditService,
        NotificationService,
        { provide: BASE_PATH, useValue: basePath },
      ],
    });

    service = TestBed.inject(PendingQueueAuditService);
    httpMock = TestBed.inject(HttpTestingController);
    notifications = TestBed.inject(NotificationService);
  });

  afterEach(() => {
    httpMock.verify();
    service.clearDetailCache();
  });

  it('requests the current snapshot with optional domain override', () => {
    const payload: PendingQueueAuditCurrentResponse = {
      domain: 'v2',
      pending_changes: [],
      total_pending: 0,
      generated_at: 1700000000,
    };

    service.getCurrent('v2').subscribe((response) => {
      expect(response).toEqual(payload);
    });

    const request = httpMock.expectOne((req) => req.url === `${auditBase}/current`);
    expect(request.request.params.get('domain_override')).toBe('v2');
    request.flush(payload);
  });

  it('lists batches with cursor and limit parameters', () => {
    const page: PendingQueueAuditBatchPage = {
      domain: 'legacy',
      batches: [],
      next_cursor: 42,
    };

    service.listBatches({ domain: 'legacy', cursor: 99, limit: 5 }).subscribe((response) => {
      expect(response).toEqual(page);
    });

    const request = httpMock.expectOne(
      (req) =>
        req.url === `${auditBase}/batches` &&
        req.params.get('cursor') === '99' &&
        req.params.get('limit') === '5',
    );
    expect(request.request.params.get('domain_override')).toBe('legacy');
    request.flush(page);
  });

  it('caches batch detail responses when forceRefresh is false', () => {
    const detail: PendingQueueAuditBatchDetail = {
      batch_id: 10,
      batch_title: 'Weekly approvals',
      changes: [],
    };

    service.getBatchDetail(10, { domain: 'legacy' }).subscribe((response) => {
      expect(response).toEqual(detail);
    });

    const first = httpMock.expectOne(
      (req) =>
        req.url === `${auditBase}/batches/10` && req.params.get('domain_override') === 'legacy',
    );
    first.flush(detail);

    service.getBatchDetail(10, { domain: 'legacy' }).subscribe((response) => {
      expect(response).toEqual(detail);
    });

    httpMock.expectNone((req) => req.url === `${auditBase}/batches/10`);
  });

  it('does not reuse cached detail across domains', () => {
    const detailLegacy: PendingQueueAuditBatchDetail = {
      batch_id: 11,
      batch_title: 'Legacy batch',
      changes: [],
    };

    const detailV2: PendingQueueAuditBatchDetail = {
      batch_id: 11,
      batch_title: 'V2 batch',
      changes: [],
    };

    service.getBatchDetail(11, { domain: 'legacy' }).subscribe();
    const first = httpMock.expectOne(
      (req) =>
        req.url === `${auditBase}/batches/11` && req.params.get('domain_override') === 'legacy',
    );
    first.flush(detailLegacy);

    service.getBatchDetail(11, { domain: 'v2' }).subscribe((response) => {
      expect(response).toEqual(detailV2);
    });
    const second = httpMock.expectOne(
      (req) => req.url === `${auditBase}/batches/11` && req.params.get('domain_override') === 'v2',
    );
    second.flush(detailV2);
  });

  it('surfaces friendly errors when audit is disabled', () => {
    const warningSpy = vi.spyOn(notifications, 'warning');

    service.getCurrent('legacy').subscribe({
      next: () => {
        throw new Error('Expected request to fail');
      },
      error: (error: Error) => {
        expect(error).toBeInstanceOf(AuditDisabledError);
        expect(error.message).toContain('Audit trail is disabled');
      },
    });

    const request = httpMock.expectOne(
      (req) => req.url === `${auditBase}/current` && req.params.get('domain_override') === 'legacy',
    );
    request.flush(
      { detail: 'Audit trail disabled' },
      { status: 503, statusText: 'Service Unavailable' },
    );

    expect(warningSpy).toHaveBeenCalled();
  });
});
