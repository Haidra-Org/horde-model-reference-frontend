import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { vi } from 'vitest';
import { PendingQueueAuditDetailDrawerComponent } from './pending-queue-audit-detail-drawer.component';
import { NotificationService } from '../../services/notification.service';
import type { PendingQueueAuditBatchDetail } from '../../models/pending-queue-audit';

class MockNotificationService {
  success = vi.fn();
  error = vi.fn();
  warning = vi.fn();
  info = vi.fn();
}

describe('PendingQueueAuditDetailDrawerComponent', () => {
  let fixture: ComponentFixture<PendingQueueAuditDetailDrawerComponent>;
  let component: PendingQueueAuditDetailDrawerComponent;
  let notifications: MockNotificationService;

  const detail: PendingQueueAuditBatchDetail = {
    batch_id: 10,
    batch_title: 'Weekly approvals',
    changes: [
      {
        change_id: 1,
        status: 'applied',
        operation: 'create',
        requested_by: 'alice',
        model_name: 'Alpha',
        events: [],
      },
      {
        change_id: 2,
        status: 'rejected',
        operation: 'update',
        requested_by: 'bob',
        model_name: 'Beta',
        events: [],
      },
    ],
  };

  beforeEach(() => {
    notifications = new MockNotificationService();

    TestBed.configureTestingModule({
      imports: [PendingQueueAuditDetailDrawerComponent],
      providers: [
        provideZonelessChangeDetection(),
        { provide: NotificationService, useValue: notifications },
      ],
    });

    fixture = TestBed.createComponent(PendingQueueAuditDetailDrawerComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('detail', detail);
    fixture.detectChanges();
  });

  it('filters changes by status and search term', () => {
    expect(component.filteredChanges().length).toBe(2);

    component.setStatusFilter('applied');
    expect(component.filteredChanges().length).toBe(1);

    component.setStatusFilter('all');
    component.onSearchTermChange('beta');
    expect(component.filteredChanges().length).toBe(1);
    expect(component.filteredChanges()[0].model_name).toBe('Beta');
  });
});
