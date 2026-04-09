import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection, signal } from '@angular/core';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';

import { PendingQueueAuditComponent } from './pending-queue-audit.component';
import {
  PendingQueueAuditService,
  AuditDisabledError,
} from '../../services/pending-queue-audit.service';
import { AuditDomainPreferenceService } from '../../services/audit-domain-preference.service';
import type {
  AuditDomain,
  PendingQueueAuditBatchPage,
  PendingQueueAuditChange,
  PendingQueueAuditCurrentResponse,
} from '../../models/pending-queue-audit';
import { NotificationService } from '../../services/notification.service';

class MockPendingQueueAuditService {
  getCurrent = vi.fn();
  listBatches = vi.fn();
  getBatchDetail = vi.fn();
  clearDetailCache = vi.fn();
  updateCacheFromPage = vi.fn();
}

class MockAuditDomainPreferenceService {
  private readonly domainSignal = signal<AuditDomain>('legacy');
  readonly domain = this.domainSignal.asReadonly();
  readonly setDomain = vi.fn((domain: AuditDomain) => this.domainSignal.set(domain));

  setInitialDomain(domain: AuditDomain): void {
    this.domainSignal.set(domain);
  }
}

describe('PendingQueueAuditComponent', () => {
  let fixture: ComponentFixture<PendingQueueAuditComponent>;
  let component: PendingQueueAuditComponent;
  let auditService: MockPendingQueueAuditService;
  let domainPreference: MockAuditDomainPreferenceService;

  const pendingChange = (
    override: Partial<PendingQueueAuditChange> = {},
  ): PendingQueueAuditChange => ({
    change_id: 1,
    status: 'pending',
    operation: 'create',
    category: 'image_generation',
    model_name: 'Alpha',
    requested_by: 'alice',
    requested_at: 1_700_000_000,
    events: [],
    ...override,
  });

  const currentSnapshot = (
    changes: PendingQueueAuditChange[],
  ): PendingQueueAuditCurrentResponse => ({
    domain: 'LEGACY',
    pending_changes: changes,
    total_pending: changes.length,
    generated_at: 1_700_000_100,
  });

  const batchPage = (batches: number[], nextCursor: number | null): PendingQueueAuditBatchPage => ({
    domain: 'LEGACY',
    batches: batches.map((id) => ({
      batch_id: id,
      batch_title: `Batch ${id}`,
      approved_change_count: 1,
      rejected_change_count: 0,
      applied_change_count: 1,
      total_change_count: 1,
      approved_by: 'mod',
      approved_at: 1_700_000_200,
      applied_at: 1_700_000_400,
      last_event_id: id,
    })),
    next_cursor: nextCursor,
  });

  const createComponent = (): void => {
    fixture = TestBed.createComponent(PendingQueueAuditComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [PendingQueueAuditComponent],
      providers: [
        provideZonelessChangeDetection(),
        { provide: PendingQueueAuditService, useClass: MockPendingQueueAuditService },
        { provide: AuditDomainPreferenceService, useClass: MockAuditDomainPreferenceService },
        NotificationService,
      ],
    });

    auditService = TestBed.inject(
      PendingQueueAuditService,
    ) as unknown as MockPendingQueueAuditService;
    domainPreference = TestBed.inject(
      AuditDomainPreferenceService,
    ) as unknown as MockAuditDomainPreferenceService;
  });

  it('loads current snapshot and batches for the preferred domain on init', () => {
    auditService.getCurrent.mockImplementation(() => of(currentSnapshot([pendingChange()])));
    auditService.listBatches.mockImplementation(() => of(batchPage([1, 2], 42)));

    createComponent();

    expect(auditService.getCurrent).toHaveBeenCalledWith('legacy');
    expect(auditService.listBatches).toHaveBeenCalledWith({ domain: 'legacy', limit: 10 });
    expect(component.pendingChanges().length).toBe(1);
    expect(component.batchSummaries().length).toBe(2);
    expect(component.nextCursor()).toBe(42);
  });

  it('re-fetches data when the domain preference changes', async () => {
    auditService.getCurrent.mockImplementation(() => of(currentSnapshot([pendingChange()])));
    auditService.listBatches.mockImplementation(() => of(batchPage([1], null)));

    createComponent();

    component.onDomainChange('v2');

    await Promise.resolve();

    expect(domainPreference.setDomain).toHaveBeenCalledWith('v2');
    expect(auditService.getCurrent).toHaveBeenCalledTimes(2);
    expect(auditService.listBatches).toHaveBeenCalledTimes(2);
    const lastListArgs = auditService.listBatches.mock.calls.at(-1)?.[0];
    expect(lastListArgs?.domain).toBe('v2');
  });

  it('forces reload when refreshing the same domain', () => {
    auditService.getCurrent.mockImplementation(() => of(currentSnapshot([pendingChange()])));
    auditService.listBatches.mockImplementation(() => of(batchPage([1], null)));

    createComponent();

    component.refresh();

    expect(auditService.getCurrent).toHaveBeenCalledTimes(2);
    expect(auditService.listBatches).toHaveBeenCalledTimes(2);
  });

  it('appends additional batches when loading more data', () => {
    auditService.getCurrent.mockImplementation(() => of(currentSnapshot([pendingChange()])));
    auditService.listBatches
      .mockReturnValueOnce(of(batchPage([1, 2], 90)))
      .mockReturnValueOnce(of(batchPage([3], null)));

    createComponent();

    component.loadMoreBatches();

    expect(auditService.listBatches).toHaveBeenCalledWith({
      domain: 'legacy',
      cursor: 90,
      limit: 10,
    });
    expect(component.batchSummaries().map((b) => b.batch_id)).toEqual([1, 2, 3]);
    expect(component.nextCursor()).toBeNull();
  });

  it('surfaces audit-disabled errors without showing a generic message', () => {
    const disabledError = new AuditDisabledError();
    auditService.getCurrent.mockReturnValue(throwError(() => disabledError));
    auditService.listBatches.mockReturnValue(throwError(() => disabledError));

    createComponent();

    expect(component.auditDisabled()).toBe(true);
    expect(component.errorMessage()).toBeNull();
    expect(component.pendingChanges().length).toBe(0);
  });
});
