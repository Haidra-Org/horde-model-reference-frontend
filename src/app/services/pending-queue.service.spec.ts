import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BASE_PATH } from '../api-client';
import type { PendingChangeRecord } from '../api-client';
import { NotificationService } from './notification.service';
import { PendingQueueService } from './pending-queue.service';

const BASE_URL = 'https://reference.test/api';

function pendingChange(overrides: Partial<PendingChangeRecord> = {}): PendingChangeRecord {
  return {
    change_id: 17,
    category: 'image_generation',
    model_name: 'contract-model',
    operation: 'update',
    requested_by: '123',
    requested_username: 'maintainer',
    status: 'approved',
    ...overrides,
  };
}

describe('PendingQueueService contracts', () => {
  let service: PendingQueueService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: BASE_PATH, useValue: BASE_URL },
        {
          provide: NotificationService,
          useValue: { warning: vi.fn(), error: vi.fn() },
        },
      ],
    });
    service = TestBed.inject(PendingQueueService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('loads caller-scoped submissions from my_changes without trusting a username filter', () => {
    let result: PendingChangeRecord[] = [];
    service.listMyChanges({ statuses: ['pending'], limit: 25 }).subscribe((page) => {
      result = page.items;
    });

    const request = http.expectOne(
      `${BASE_URL}/model_references/v2/pending_queue/my_changes?statuses=pending&limit=25`,
    );
    expect(request.request.params.has('requested_by')).toBe(false);
    request.flush({ items: [pendingChange({ status: 'pending' })], total: 1 });

    expect(result.map((change) => change.change_id)).toEqual([17]);
  });

  it('unwraps the real single-apply response contract', () => {
    let applied: PendingChangeRecord | undefined;
    service.applyChange(17, 'job-17').subscribe((change) => {
      applied = change;
    });

    const request = http.expectOne(
      `${BASE_URL}/model_references/v2/pending_queue/changes/17/apply`,
    );
    expect(request.request.body).toEqual({ job_id: 'job-17' });
    request.flush({ record: pendingChange({ status: 'applied' }), batch_split_occurred: false });

    expect(applied?.status).toBe('applied');
  });

  it('surfaces schema drift instead of presenting an unknown state as pending', () => {
    let message = '';
    service.listChanges().subscribe({ error: (error: Error) => (message = error.message) });

    const request = http.expectOne(`${BASE_URL}/model_references/v2/pending_queue/changes`);
    request.flush({ items: [{ ...pendingChange(), status: 'future_state' }], total: 1 });

    expect(message).toBe('Pending change response included unsupported status "future_state".');
  });
});
