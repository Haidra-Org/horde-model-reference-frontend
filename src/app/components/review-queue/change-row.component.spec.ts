/**
 * Tests for ChangeRowComponent — the review queue list row.
 */
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { describe, it, expect } from 'vitest';
import { ChangeRowComponent } from './change-row.component';
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

describe('ChangeRowComponent', () => {
  async function createComponent(change: PendingChangeRecord): Promise<{
    fixture: ComponentFixture<ChangeRowComponent>;
    component: ChangeRowComponent;
  }> {
    await TestBed.configureTestingModule({
      imports: [ChangeRowComponent],
      providers: [provideZonelessChangeDetection()],
    }).compileComponents();

    const fixture = TestBed.createComponent(ChangeRowComponent);
    const component = fixture.componentInstance;
    fixture.componentRef.setInput('change', change);
    return { fixture, component };
  }

  it('creates the component', async () => {
    const { component } = await createComponent(makeChange());
    expect(component).toBeTruthy();
  });

  it('displays model name and change ID', async () => {
    const { fixture } = await createComponent(
      makeChange({ model_name: 'my-model', change_id: 42 }),
    );
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('my-model');
    expect(el.textContent).toContain('#42');
  });

  it('shows checkbox in approver mode for pending changes', async () => {
    const { fixture } = await createComponent(makeChange({ status: 'pending' }));
    fixture.componentRef.setInput('approverMode', true);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('.change-row-check')).toBeTruthy();
  });

  it('hides checkbox when not in approver mode', async () => {
    const { fixture } = await createComponent(makeChange({ status: 'pending' }));
    fixture.componentRef.setInput('approverMode', false);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('.change-row-check')).toBeFalsy();
  });

  it('emits selectedChange on click', async () => {
    const change = makeChange();
    const { fixture, component } = await createComponent(change);
    fixture.detectChanges();

    let emitted: PendingChangeRecord | undefined;
    const sub = component.selectedChange.subscribe((c: PendingChangeRecord) => {
      emitted = c;
    });

    const row = fixture.nativeElement.querySelector('.change-row') as HTMLElement;
    row?.dispatchEvent(new Event('click'));

    expect(emitted?.change_id).toBe(change.change_id);
    sub.unsubscribe();
  });

  it('shows apply button for approved changes in approver mode', async () => {
    const { fixture } = await createComponent(makeChange({ status: 'approved' }));
    fixture.componentRef.setInput('approverMode', true);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('Apply');
  });

  it('hides apply button when not approver', async () => {
    const { fixture } = await createComponent(makeChange({ status: 'approved' }));
    fixture.componentRef.setInput('approverMode', false);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).not.toContain('Apply');
  });

  it('emits applyRequested on apply click', async () => {
    const change = makeChange({ status: 'approved' });
    const { fixture, component } = await createComponent(change);
    fixture.componentRef.setInput('approverMode', true);
    fixture.detectChanges();

    let emitted: PendingChangeRecord | undefined;
    const sub = component.applyRequested.subscribe((c: PendingChangeRecord) => {
      emitted = c;
    });

    const btn = fixture.nativeElement.querySelector('.btn-primary') as HTMLElement;
    btn?.dispatchEvent(new Event('click'));

    expect(emitted?.change_id).toBe(change.change_id);
    sub.unsubscribe();
  });
});
