/**
 * Tests for PendingQueueComponent — the tabbed pending queue wired to
 * /pending-queue (Queue / My Submissions / Batches / History).
 */
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, Router, provideRouter } from '@angular/router';
import { provideZonelessChangeDetection, signal } from '@angular/core';
import { of } from 'rxjs';
import { describe, it, expect, vi } from 'vitest';
import { PendingQueueComponent } from './pending-queue.component';
import { PendingQueueService } from '../../services/pending-queue.service';
import { NotificationService } from '../../services/notification.service';
import { ModelValidationService } from '../../services/model-validation.service';
import { AuthService } from '../../services/auth.service';
import { ShellContextService } from '../../services/shell-context.service';
import type { PendingChangeRecord } from '../../api-client';

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

describe('PendingQueueComponent', () => {
  async function createComponent(overrides?: {
    isApprover?: boolean;
    isAuthenticated?: boolean;
    username?: string;
    records?: PendingChangeRecord[];
    applyChange?: ReturnType<typeof vi.fn>;
    tab?: string;
    focus?: number;
  }): Promise<{
    fixture: ComponentFixture<PendingQueueComponent>;
    component: PendingQueueComponent;
    applyChange: ReturnType<typeof vi.fn>;
  }> {
    const applyChange =
      overrides?.applyChange ?? vi.fn(() => of(makeChange({ status: 'applied' })));
    const listMyChanges = vi.fn(() => of({ items: overrides?.records ?? [], total: 0 }));

    await TestBed.configureTestingModule({
      imports: [PendingQueueComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              queryParamMap: new Map<string, string>([
                ...(overrides?.tab ? [['tab', overrides.tab] as [string, string]] : []),
                ...(overrides?.focus
                  ? [['focus', String(overrides.focus)] as [string, string]]
                  : []),
              ]),
            },
          },
        },
        {
          provide: AuthService,
          useValue: {
            isApprover: signal(overrides?.isApprover ?? false),
            isRequestor: signal(false),
            isAuthenticated: signal(overrides?.isAuthenticated ?? true),
            username: signal(overrides?.username ?? 'testuser'),
          },
        },
        {
          provide: ShellContextService,
          useValue: { setContext: vi.fn(), clearContext: vi.fn() },
        },
        {
          provide: ModelValidationService,
          useValue: { serverErrors: signal([]) },
        },
        {
          provide: PendingQueueService,
          useValue: {
            listChanges: () => of({ items: overrides?.records ?? [], total: 0 }),
            listMyChanges,
            getChangeDiff: () => of({ field_diffs: [] }),
            processBatch: () => of({ approved: [], rejected: [], batch_id: 1, batch_title: '' }),
            applyChange,
            applyBatch: () => of({ applied: [] }),
          },
        },
        {
          provide: NotificationService,
          useValue: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(PendingQueueComponent);
    return { fixture, component: fixture.componentInstance, applyChange };
  }

  it('creates the component and sets the shell context', async () => {
    const shell = { setContext: vi.fn(), clearContext: vi.fn() };
    await TestBed.configureTestingModule({
      imports: [PendingQueueComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        {
          provide: AuthService,
          useValue: {
            isApprover: signal(false),
            isRequestor: signal(false),
            isAuthenticated: signal(true),
            username: signal('testuser'),
          },
        },
        { provide: ShellContextService, useValue: shell },
        { provide: ModelValidationService, useValue: { serverErrors: signal([]) } },
        {
          provide: PendingQueueService,
          useValue: {
            listChanges: () => of({ items: [], total: 0 }),
            listMyChanges: () => of({ items: [], total: 0 }),
            getChangeDiff: () => of({ field_diffs: [] }),
            processBatch: () => of({}),
            applyChange: () => of({}),
            applyBatch: () => of({ applied: [] }),
          },
        },
        {
          provide: NotificationService,
          useValue: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(PendingQueueComponent);
    expect(fixture.componentInstance).toBeTruthy();
    expect(shell.setContext).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Review queue' }),
    );
  });

  it('renders the four tabs', async () => {
    const { fixture } = await createComponent({ records: [makeChange()] });
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('Review queue');
    expect(el.textContent).toContain('My Submissions');
    expect(el.textContent).toContain('Ready to apply');
    expect(el.textContent).toContain('History');
  });

  it('lists pending changes in the queue tab', async () => {
    const { fixture } = await createComponent({
      records: [makeChange({ model_name: 'model-alpha' })],
    });
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('model-alpha');
  });

  it('switching tab updates activeTab and syncs the URL', async () => {
    const { component } = await createComponent({ records: [makeChange()] });
    const router = TestBed.inject(Router);
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    component.setTab('batches');

    expect(component.activeTab()).toBe('batches');
    expect(navigate).toHaveBeenCalledWith(
      [],
      expect.objectContaining({ queryParams: { tab: 'batches' } }),
    );
  });

  it('restores the active tab from the ?tab= query param', async () => {
    const { component } = await createComponent({ records: [], tab: 'history' });
    expect(component.activeTab()).toBe('history');
  });

  it('opens a deep-linked change instead of dropping the post-submit focus target', async () => {
    const focused = makeChange({ change_id: 42, model_name: 'focused-model' });
    const { fixture, component } = await createComponent({ records: [focused], focus: 42 });
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(component.focusedChangeId()).toBe(42);
    expect(component.activeTab()).toBe('queue');
    const row = fixture.nativeElement.querySelector('#pending-change-42') as HTMLElement;
    expect(row?.getAttribute('aria-expanded')).toBe('true');
  });

  it('apply opens a confirmation modal without applying; confirming performs the apply', async () => {
    const applyChange = vi.fn(() => of(makeChange({ status: 'applied' })));
    const approved = makeChange({ change_id: 7, status: 'approved', operation: 'create' });
    const { component } = await createComponent({
      isApprover: true,
      records: [approved],
      applyChange,
    });

    component.apply(approved);
    expect(component.confirmationState()?.action).toBe('apply');
    expect(applyChange).not.toHaveBeenCalled();

    component.executeConfirmedAction();
    expect(applyChange).toHaveBeenCalledWith(7);
  });

  it('groups changes by batch in the byBatch summary', async () => {
    const { component } = await createComponent({
      records: [
        makeChange({ change_id: 1, batch_id: 10, status: 'approved', batch_title: 'Batch A' }),
        makeChange({ change_id: 2, batch_id: null, status: 'pending' }),
      ],
    });
    const groups = component.byBatch();
    expect(groups.some((g) => g.batchId === 10)).toBe(true);
    expect(groups.some((g) => g.batchId === null)).toBe(true);
  });

  it('approvedBatches excludes the pending-approval pseudo-group', async () => {
    const { component } = await createComponent({
      records: [
        makeChange({ change_id: 1, batch_id: 10, status: 'approved', batch_title: 'Batch A' }),
        makeChange({ change_id: 2, batch_id: null, status: 'pending' }),
      ],
    });
    const batches = component.approvedBatches();
    expect(batches.some((g) => g.batchId === 10)).toBe(true);
    expect(batches.some((g) => g.batchId === null)).toBe(false);
  });
});
