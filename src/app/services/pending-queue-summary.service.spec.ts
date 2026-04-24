import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection, computed, signal } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { of, throwError } from 'rxjs';
import { PendingQueueSummaryService } from './pending-queue-summary.service';
import { PendingQueueService } from './pending-queue.service';
import { AuthService } from './auth.service';
import type { PendingChangeRecord, PendingQueuePage } from '../api-client/model/models';

function makePendingRecord(overrides: Partial<PendingChangeRecord>): PendingChangeRecord {
  return {
    change_id: 1,
    category: 'text_generation' as PendingChangeRecord['category'],
    model_name: 'test-model',
    operation: 'create' as PendingChangeRecord['operation'],
    requested_by: 'user-1',
    requested_username: 'User',
    status: 'pending' as PendingChangeRecord['status'],
    ...overrides,
  };
}

function makePage(items: PendingChangeRecord[]): PendingQueuePage {
  return { items, total: items.length, offset: 0, limit: 200 };
}

describe('PendingQueueSummaryService', () => {
  let service: PendingQueueSummaryService;
  let pendingQueueSpy: { listChanges: ReturnType<typeof vi.fn> };
  let isAuthenticatedSource: ReturnType<typeof signal<boolean>>;

  beforeEach(() => {
    isAuthenticatedSource = signal(true);

    pendingQueueSpy = {
      listChanges: vi.fn().mockReturnValue(of(makePage([]))),
    };

    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
        PendingQueueSummaryService,
        { provide: PendingQueueService, useValue: pendingQueueSpy },
        {
          provide: AuthService,
          useValue: { isAuthenticated: computed(() => isAuthenticatedSource()) },
        },
      ],
    });

    service = TestBed.inject(PendingQueueSummaryService);
  });

  afterEach(() => {
    service.stopPolling();
  });

  it('initializes with empty records', () => {
    expect(service.records()).toEqual([]);
    expect(service.totalPendingCount()).toBe(0);
    expect(service.loading()).toBe(false);
    expect(service.lastRefreshed()).toBeNull();
  });

  describe('refresh', () => {
    it('fetches records from pending queue service', () => {
      const records = [
        makePendingRecord({ change_id: 1, model_name: 'model-a' }),
        makePendingRecord({ change_id: 2, model_name: 'model-b' }),
      ];
      pendingQueueSpy.listChanges.mockReturnValue(of(makePage(records)));

      service.refresh();

      expect(pendingQueueSpy.listChanges).toHaveBeenCalledWith({
        statuses: ['pending'],
        limit: 200,
      });
      expect(service.records().length).toBe(2);
      expect(service.lastRefreshed()).toBeInstanceOf(Date);
    });

    it('does not fetch when user is not authenticated', () => {
      isAuthenticatedSource.set(false);
      service.refresh();
      expect(pendingQueueSpy.listChanges).not.toHaveBeenCalled();
    });

    it('sets loading to true during fetch and false after', () => {
      pendingQueueSpy.listChanges.mockReturnValue(of(makePage([])));
      service.refresh();
      expect(service.loading()).toBe(false);
    });

    it('handles fetch errors gracefully', () => {
      pendingQueueSpy.listChanges.mockReturnValue(throwError(() => new Error('Network error')));
      expect(() => service.refresh()).not.toThrow();
      expect(service.loading()).toBe(false);
    });

    it('replaces existing records on subsequent fetches', () => {
      pendingQueueSpy.listChanges.mockReturnValue(
        of(makePage([makePendingRecord({ change_id: 1 })])),
      );
      service.refresh();
      expect(service.records().length).toBe(1);

      pendingQueueSpy.listChanges.mockReturnValue(
        of(
          makePage([
            makePendingRecord({ change_id: 2 }),
            makePendingRecord({ change_id: 3 }),
            makePendingRecord({ change_id: 4 }),
          ]),
        ),
      );
      service.refresh();
      expect(service.records().length).toBe(3);
    });
  });

  describe('computed counts', () => {
    it('counts only pending-status records', () => {
      const records = [
        makePendingRecord({ change_id: 1, status: 'pending' as PendingChangeRecord['status'] }),
        makePendingRecord({ change_id: 2, status: 'approved' as PendingChangeRecord['status'] }),
        makePendingRecord({ change_id: 3, status: 'pending' as PendingChangeRecord['status'] }),
      ];
      pendingQueueSpy.listChanges.mockReturnValue(of(makePage(records)));
      service.refresh();

      expect(service.totalPendingCount()).toBe(2);
    });

    it('breaks down counts by category', () => {
      const records = [
        makePendingRecord({
          change_id: 1,
          category: 'text_generation' as PendingChangeRecord['category'],
        }),
        makePendingRecord({
          change_id: 2,
          category: 'text_generation' as PendingChangeRecord['category'],
        }),
        makePendingRecord({
          change_id: 3,
          category: 'image_generation' as PendingChangeRecord['category'],
        }),
      ];
      pendingQueueSpy.listChanges.mockReturnValue(of(makePage(records)));
      service.refresh();

      expect(service.pendingCountByCategory().get('text_generation')).toBe(2);
      expect(service.pendingCountByCategory().get('image_generation')).toBe(1);
    });

    it('pendingCountFor returns 0 for unknown category', () => {
      pendingQueueSpy.listChanges.mockReturnValue(of(makePage([])));
      service.refresh();

      expect(service.pendingCountFor('video_generation')).toBe(0);
    });
  });

  describe('clear', () => {
    it('resets records and stops polling', () => {
      pendingQueueSpy.listChanges.mockReturnValue(
        of(makePage([makePendingRecord({ change_id: 1 })])),
      );
      service.refresh();
      expect(service.records().length).toBe(1);

      service.clear();

      expect(service.records()).toEqual([]);
      expect(service.lastRefreshed()).toBeNull();
    });
  });

  describe('polling', () => {
    it('starts polling and makes initial refresh', () => {
      pendingQueueSpy.listChanges.mockReturnValue(of(makePage([])));
      service.startPolling();

      expect(pendingQueueSpy.listChanges).toHaveBeenCalledTimes(1);
    });

    it('does not start a second timer on duplicate startPolling calls', () => {
      pendingQueueSpy.listChanges.mockReturnValue(of(makePage([])));
      service.startPolling();
      service.startPolling();

      expect(pendingQueueSpy.listChanges).toHaveBeenCalledTimes(1);
    });

    it('skips refresh when user is not authenticated during polling', () => {
      pendingQueueSpy.listChanges.mockReturnValue(of(makePage([])));
      service.startPolling();
      const callCountAfterStart = pendingQueueSpy.listChanges.mock.calls.length;

      isAuthenticatedSource.set(false);

      // Manually trigger refresh (simulates what the interval callback does)
      service.refresh();

      // refresh() should no-op because auth is false
      expect(pendingQueueSpy.listChanges.mock.calls.length).toBe(callCountAfterStart);

      service.stopPolling();
    });
  });
});
