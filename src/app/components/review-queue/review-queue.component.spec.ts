/**
 * Tests for ReviewQueueComponent — the redesigned pending queue.
 */
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { provideZonelessChangeDetection, signal } from '@angular/core';
import { of } from 'rxjs';
import { describe, it, expect, vi } from 'vitest';
import { ReviewQueueComponent } from './review-queue.component';
import { PendingQueueService } from '../../services/pending-queue.service';
import { PendingQueueSummaryService } from '../../services/pending-queue-summary.service';
import { NotificationService } from '../../services/notification.service';
import { AuthService } from '../../services/auth.service';
import { ShellContextService } from '../../services/shell-context.service';
import { ModelReferenceApiService } from '../../services/model-reference-api.service';
import type { PendingChangeRecord } from '../../api-client';
import type { BackendCapabilities } from '../../models/api.models';

function makeChange(overrides?: Partial<PendingChangeRecord>): PendingChangeRecord {
  return {
    change_id: overrides?.change_id ?? 1,
    category: overrides?.category ?? ('image_generation' as PendingChangeRecord['category']),
    model_name: overrides?.model_name ?? 'test-model',
    operation: overrides?.operation ?? 'create',
    requested_by: overrides?.requested_by ?? 'user1',
    requested_username: overrides?.requested_username ?? 'user1',
    requested_at: overrides?.requested_at ?? Math.floor(Date.now() / 1000) - 300,
    status: overrides?.status ?? 'pending',
    batch_id: overrides?.batch_id ?? null,
    ...overrides,
  };
}

function createBackendCapabilities(overrides?: Partial<BackendCapabilities>): BackendCapabilities {
  return {
    writable: overrides?.writable ?? true,
    mode: overrides?.mode ?? 'PRIMARY',
    canonicalFormat: overrides?.canonicalFormat ?? 'v2',
  };
}

describe('ReviewQueueComponent', () => {
  async function createComponent(overrides?: {
    isApprover?: boolean;
    isRequestor?: boolean;
    writable?: boolean;
    username?: string;
    records?: PendingChangeRecord[];
  }): Promise<{
    fixture: ComponentFixture<ReviewQueueComponent>;
    component: ReviewQueueComponent;
  }> {
    const caps = createBackendCapabilities({ writable: overrides?.writable ?? true });

    await TestBed.configureTestingModule({
      imports: [ReviewQueueComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        {
          provide: ModelReferenceApiService,
          useValue: {
            backendCapabilities: signal(caps),
            getFormModel: () => of(null),
            getCategories: () => of([]),
          },
        },
        {
          provide: AuthService,
          useValue: {
            isApprover: signal(overrides?.isApprover ?? false),
            isRequestor: signal(overrides?.isRequestor ?? false),
            isAuthenticated: signal(true),
            username: signal(overrides?.username ?? 'testuser'),
          },
        },
        {
          provide: ShellContextService,
          useValue: {
            setContext: vi.fn(),
            clearContext: vi.fn(),
            context: signal({ breadcrumb: [], title: '', actions: [] }),
          },
        },
        {
          provide: PendingQueueSummaryService,
          useValue: {
            refresh: vi.fn(),
            startPolling: vi.fn(),
            records: signal([]),
          },
        },
        {
          provide: PendingQueueService,
          useValue: {
            listChanges: () => of({ items: overrides?.records ?? [], total: 0 }),
            getChangeDiff: () => of({ field_diffs: [] }),
            processBatch: () => of({ approved: [], rejected: [], batch_id: 1, batch_title: '' }),
            applyChange: () => of({}),
            applyBatch: () => of({ applied: [] }),
          },
        },
        {
          provide: NotificationService,
          useValue: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(ReviewQueueComponent);
    const component = fixture.componentInstance;
    return { fixture, component };
  }

  it('creates the component', async () => {
    const { component } = await createComponent();
    expect(component).toBeTruthy();
  });

  it('shows status filter chips', async () => {
    const { fixture } = await createComponent({
      records: [
        makeChange({ status: 'pending' }),
        makeChange({ change_id: 2, status: 'approved' }),
      ],
    });
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('All');
  });

  it('displays pending changes in the list', async () => {
    const { fixture } = await createComponent({
      records: [makeChange({ model_name: 'model-alpha', status: 'pending' })],
    });
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('model-alpha');
  });

  it('shows empty state when no changes', async () => {
    const { fixture } = await createComponent({ records: [] });
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('No changes have been proposed');
  });

  it('shows read-only banner when not writable', async () => {
    const { fixture } = await createComponent({ writable: false });
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('read-only');
  });

  it('shows batches section for approver view', async () => {
    const { fixture } = await createComponent({
      isApprover: true,
      records: [
        makeChange({ change_id: 1, batch_id: 10, status: 'approved', batch_title: 'Batch A' }),
      ],
    });
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('Batches');
    expect(el.textContent).toContain('Batch A');
  });

  it('hides batches for my view (requestor non-approver)', async () => {
    const { fixture } = await createComponent({
      isApprover: false,
      isRequestor: true,
      records: [
        makeChange({
          change_id: 1,
          batch_id: 10,
          status: 'approved',
          requested_username: 'testuser',
        }),
      ],
    });
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).not.toContain('Batches');
  });

  it('selects a change and opens side panel', async () => {
    const change = makeChange({ change_id: 99, model_name: 'detail-model' });
    const { fixture, component } = await createComponent({
      records: [change],
    });
    fixture.detectChanges();

    component.selectChange(change);
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('.review-queue-detail')).toBeTruthy();
  });
});
