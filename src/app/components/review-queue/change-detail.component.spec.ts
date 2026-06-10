/**
 * Tests for ChangeDetailComponent — the review queue side panel.
 */
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { of } from 'rxjs';
import { describe, it, expect } from 'vitest';
import { ChangeDetailComponent } from './change-detail.component';
import { PendingQueueService } from '../../services/pending-queue.service';
import type { PendingChangeRecord, PendingChangeDiff } from '../../api-client';

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
    batch_title: overrides?.batch_title ?? null,
    reject_reason: overrides?.reject_reason ?? null,
    applied_job_id: overrides?.applied_job_id ?? null,
    ...overrides,
  };
}

function makeDiff(overrides?: Partial<PendingChangeDiff>): PendingChangeDiff {
  return {
    change_id: overrides?.change_id ?? 1,
    category: overrides?.category ?? ('image_generation' as PendingChangeDiff['category']),
    model_name: overrides?.model_name ?? 'test-model',
    operation: overrides?.operation ?? 'update',
    net_operation: 'modified',
    field_diffs: overrides?.field_diffs ?? [
      { field_path: 'name', old_value: 'old', new_value: 'new', change_type: 'modified' },
    ],
    ...overrides,
  };
}

describe('ChangeDetailComponent', () => {
  async function createComponent(change: PendingChangeRecord): Promise<{
    fixture: ComponentFixture<ChangeDetailComponent>;
    component: ChangeDetailComponent;
  }> {
    await TestBed.configureTestingModule({
      imports: [ChangeDetailComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: PendingQueueService,
          useValue: {
            getChangeDiff: () => of(makeDiff()),
          },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(ChangeDetailComponent);
    const component = fixture.componentInstance;
    fixture.componentRef.setInput('change', change);
    return { fixture, component };
  }

  it('creates the component', async () => {
    const { component } = await createComponent(makeChange());
    expect(component).toBeTruthy();
  });

  it('displays model name and change ID', async () => {
    const { fixture } = await createComponent(makeChange({ model_name: 'my-model', change_id: 7 }));
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('my-model');
    expect(el.textContent).toContain('change #7');
  });

  it('shows diff and payload tabs', async () => {
    const { fixture } = await createComponent(makeChange());
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('Diff');
    expect(el.textContent).toContain('Payload JSON');
  });

  it('shows reject reason banner when present', async () => {
    const { fixture } = await createComponent(
      makeChange({ status: 'rejected', reject_reason: 'bad link' }),
    );
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('Rejected');
    expect(el.textContent).toContain('bad link');
  });

  it('shows batch info when batch_id is set', async () => {
    const { fixture } = await createComponent(makeChange({ batch_id: 5, applied_job_id: 'job-1' }));
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('#5');
    expect(el.textContent).toContain('job-1');
  });

  it('shows approve/reject footer for approver on pending', async () => {
    const { fixture } = await createComponent(makeChange({ status: 'pending' }));
    fixture.componentRef.setInput('approverMode', true);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('Reject');
    expect(el.textContent).toContain('Approve');
  });

  it('hides footer when not approver', async () => {
    const { fixture } = await createComponent(makeChange({ status: 'pending' }));
    fixture.componentRef.setInput('approverMode', false);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).not.toContain('Reject');
  });

  it('emits closed on close button click', async () => {
    const { fixture, component } = await createComponent(makeChange());
    fixture.detectChanges();

    let closed = false;
    const sub = component.closed.subscribe(() => {
      closed = true;
    });

    const btn = fixture.nativeElement.querySelector('.change-detail-close') as HTMLElement;
    btn?.dispatchEvent(new Event('click'));

    expect(closed).toBe(true);
    sub.unsubscribe();
  });
});
